import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { generateEmotionResponse, safeParseJSON } from '../lib/gemini';
import { supabase } from '../lib/supabase';
import { api } from '../lib/api';
import { Search, Heart, Loader2, Sparkles } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { toast } from 'sonner';
import { User as SupabaseUser } from '@supabase/supabase-js';

const SUGGESTED_EMOTIONS = [
  "Peace", "Anxiety", "Stress", "Fear", "Grief", "Anger", "Hope", "Gratitude", "Loneliness"
];

export default function Home() {
  const [emotion, setEmotion] = useState('');
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<any>(null);
  const [user, setUser] = useState<SupabaseUser | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e?: React.FormEvent, selectedEmotion?: string) => {
    e?.preventDefault();
    const finalEmotion = selectedEmotion || emotion;
    if (!finalEmotion.trim()) return;

    setLoading(true);
    setResponse(null);

    try {
      const result = await generateEmotionResponse(finalEmotion);
      if (!result) {
        throw new Error('AI service is currently unavailable.');
      }
      const parsed = safeParseJSON(result);
      if (!parsed) {
        throw new Error('Failed to parse AI response.');
      }
      setResponse(parsed);

      if (user) {
        // Optional: Save to history if endpoint exists
        // await api.post('/api/history', { emotion: finalEmotion, response: result });
      }
    } catch (error) {
      console.error('Failed to generate response:', error);
      toast.error('Failed to generate response. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleBookmark = async (verse: any) => {
    if (!user) {
      toast.error('Please sign in to bookmark verses.');
      return;
    }

    try {
      await api.post('/api/bookmarks', {
        verseRef: verse.reference,
        text: verse.text,
        translation: 'WEB'
      });
      toast.success('Verse bookmarked!');
    } catch (error) {
      console.error('Error bookmarking:', error);
      toast.error('Failed to bookmark verse.');
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-12 sm:py-20">
      <div className="text-center mb-12">
        <motion.h1 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="serif text-4xl sm:text-6xl font-semibold text-sage-dark mb-6"
        >
          A quiet place for your soul.
        </motion.h1>
        <motion.p 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-ink/60 text-lg max-w-2xl mx-auto"
        >
          Find Scripture, encouragement, and peace during difficult moments.
        </motion.p>
      </div>

      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.2 }}
        className="bg-white rounded-[2rem] sm:rounded-3xl shadow-xl shadow-sage/5 p-6 sm:p-12 border border-sage/10"
      >
        <form onSubmit={handleSubmit} className="relative mb-6 sm:mb-8">
          <input
            type="text"
            value={emotion}
            onChange={(e) => setEmotion(e.target.value)}
            placeholder="How are you feeling today?"
            className="w-full bg-cream border-2 border-sage/20 rounded-2xl px-5 py-4 sm:px-6 sm:py-5 text-lg sm:text-xl focus:outline-none focus:border-sage transition-all pr-14 sm:pr-16"
          />
          <button
            type="submit"
            disabled={loading}
            className="absolute right-2 top-2 bottom-2 bg-sage text-white px-4 sm:px-6 rounded-xl hover:bg-sage-dark transition-colors disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-5 h-5 sm:w-6 sm:h-6 animate-spin" /> : <Search className="w-5 h-5 sm:w-6 sm:h-6" />}
          </button>
        </form>

        <div className="flex flex-wrap justify-center gap-2 sm:gap-3">
          {SUGGESTED_EMOTIONS.map((e) => (
            <button
              key={e}
              onClick={() => {
                setEmotion(e);
                handleSubmit(undefined, e);
              }}
              className="px-4 py-2 rounded-full border border-sage/20 text-xs sm:text-sm font-medium text-ink/60 hover:bg-sage-light hover:text-sage-dark hover:border-sage transition-all active:scale-95"
            >
              {e}
            </button>
          ))}
        </div>
      </motion.div>

      <AnimatePresence>
        {response && (
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            className="mt-12 space-y-8"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-6">
                <h2 className="serif text-2xl font-medium text-sage-dark flex items-center gap-2">
                  <Heart className="w-6 h-6" />
                  Scripture for you
                </h2>
                {response.verses.map((v: any, i: number) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className="bg-white p-6 rounded-2xl border border-sage/5 shadow-sm group relative"
                  >
                    <button
                      onClick={() => handleBookmark(v)}
                      className="absolute top-4 right-4 p-2 text-ink/10 hover:text-sage hover:bg-sage-light rounded-full transition-all opacity-0 group-hover:opacity-100"
                      title="Bookmark Verse"
                    >
                      <Heart className="w-4 h-4" />
                    </button>
                    <p className="serif italic text-lg text-ink/80 mb-3 pr-8">"{v.text}"</p>
                    <p className="text-sage-dark font-semibold text-sm">— {v.reference}</p>
                  </motion.div>
                ))}
              </div>

              <div className="space-y-6">
                <div className="bg-sage-light p-8 rounded-3xl border border-sage/10">
                  <h3 className="serif text-xl font-medium text-sage-dark mb-4 flex items-center gap-2">
                    <Sparkles className="w-5 h-5" />
                    A Moment of Reflection
                  </h3>
                  <div className="markdown-body text-ink/80">
                    <ReactMarkdown>{response.reflection}</ReactMarkdown>
                  </div>
                  <div className="mt-8 pt-6 border-t border-sage/20">
                    <p className="serif italic text-sage-dark text-lg">
                      {response.encouragement}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
