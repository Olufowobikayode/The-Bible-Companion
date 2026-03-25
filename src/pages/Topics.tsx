import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { fetchBibleVerse } from '../lib/bible';
import { Loader2, Heart, Sparkles, BookOpen, MapPin, Search, BrainCircuit } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { getTopicVerses, getNewsTopic, performSemanticSearch } from '../lib/gemini';
import { toast } from 'sonner';

const TOPICS = [
  { id: 'peace', name: 'Peace', icon: '🕊️', description: 'Finding calm in the midst of the storm.' },
  { id: 'anxiety', name: 'Anxiety', icon: '🌿', description: 'Casting your cares upon Him.' },
  { id: 'healing', name: 'Healing', icon: '✨', description: 'Restoration for body and soul.' },
  { id: 'forgiveness', name: 'Forgiveness', icon: '🤍', description: 'The power of letting go.' },
  { id: 'strength', name: 'Strength', icon: '🛡️', description: 'Power when you are weak.' },
  { id: 'faith', name: 'Faith', icon: '🌟', description: 'Believing in the unseen.' },
  { id: 'hope', name: 'Hope', icon: '⚓', description: 'An anchor for the soul.' },
  { id: 'guidance', name: 'Guidance', icon: '🧭', description: 'Light for your path.' },
  { id: 'fear', name: 'Fear', icon: '🦁', description: 'Courage in the face of giants.' },
  { id: 'rest', name: 'Rest', icon: '🌙', description: 'Sabbath for the weary.' }
];

export default function Topics() {
  const [selectedTopic, setSelectedTopic] = useState<any>(null);
  const [verses, setVerses] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [customTopic, setCustomTopic] = useState('');
  const [loadingNews, setLoadingNews] = useState(false);
  const [semanticResult, setSemanticResult] = useState<any>(null);

  useEffect(() => {
    if (selectedTopic) {
      loadTopicVerses();
    }
  }, [selectedTopic]);

  const loadTopicVerses = async () => {
    setLoading(true);
    setSemanticResult(null);
    try {
      // Use semantic search for more depth
      const result = await performSemanticSearch(selectedTopic.name);
      setSemanticResult(result);
      
      const results = await Promise.all(result.verses.map((ref: string) => fetchBibleVerse(ref)));
      setVerses(results.filter(r => r !== null));
    } catch (error) {
      console.error("Failed to load topic verses:", error);
      toast.error('Failed to load verses for this topic.');
    } finally {
      setLoading(false);
    }
  };

  const handleNewsTopic = async () => {
    setLoadingNews(true);
    navigator.geolocation.getCurrentPosition(async (position) => {
      const { latitude, longitude } = position.coords;
      try {
        const topic = await getNewsTopic(latitude, longitude);
        setSelectedTopic({ ...topic, id: 'news', icon: '📰' });
        toast.success('Generated topic based on local news.');
      } catch (error) {
        console.error("Failed to generate news topic:", error);
        toast.error('Failed to generate topic from local news.');
      } finally {
        setLoadingNews(false);
      }
    }, (error) => {
      console.error("Geolocation error:", error);
      toast.error('Location access denied. Cannot fetch local news topic.');
      setLoadingNews(false);
    });
  };

  const handleCustomTopic = () => {
    if (!customTopic.trim()) return;
    setSelectedTopic({ name: customTopic, description: 'A custom topic for your reflection.', id: 'custom', icon: '💡' });
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      {!selectedTopic ? (
        <div className="space-y-12">
          <div className="text-center">
            <h1 className="serif text-4xl font-semibold text-sage-dark mb-4">Scripture by Topic</h1>
            <p className="text-ink/60 max-w-xl mx-auto">Select a theme to find relevant verses and reflections for your journey.</p>
          </div>

          <div className="flex flex-col md:flex-row gap-4 justify-center items-center">
            <div className="flex gap-2">
              <input
                type="text"
                value={customTopic}
                onChange={(e) => setCustomTopic(e.target.value)}
                placeholder="Enter custom topic..."
                className="bg-white border border-sage/20 rounded-2xl px-6 py-4 focus:outline-none focus:border-sage"
              />
              <button
                onClick={handleCustomTopic}
                className="bg-sage-light text-sage-dark px-6 py-4 rounded-2xl font-medium hover:bg-sage-light/80 transition-all"
              >
                <Search className="w-5 h-5" />
              </button>
            </div>
            <button
              onClick={handleNewsTopic}
              disabled={loadingNews}
              className="bg-sage text-white px-6 py-4 rounded-2xl font-medium hover:bg-sage-dark transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {loadingNews ? <Loader2 className="w-5 h-5 animate-spin" /> : <MapPin className="w-5 h-5" />}
              Topic from Local News
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {TOPICS.map((topic) => (
              <motion.button
                key={topic.id}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setSelectedTopic(topic)}
                className="bg-white p-8 rounded-3xl border border-sage/10 shadow-sm hover:shadow-md transition-all text-left group"
              >
                <span className="text-4xl mb-4 block">{topic.icon}</span>
                <h3 className="serif text-2xl font-medium text-sage-dark mb-2 group-hover:text-sage transition-colors">{topic.name}</h3>
                <p className="text-ink/60 text-sm">{topic.description}</p>
              </motion.button>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-12">
          <button
            onClick={() => setSelectedTopic(null)}
            className="text-sage-dark hover:text-sage font-medium flex items-center gap-2"
          >
            ← Back to Topics
          </button>

          <div className="bg-sage-light p-12 rounded-3xl border border-sage/10 text-center">
            <span className="text-6xl mb-6 block">{selectedTopic.icon}</span>
            <h1 className="serif text-5xl font-semibold text-sage-dark mb-4">{selectedTopic.name}</h1>
            <p className="text-ink/60 max-w-2xl mx-auto italic">"{selectedTopic.description}"</p>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 space-y-4">
              <Loader2 className="w-10 h-10 animate-spin text-sage" />
              <p className="text-ink/40 serif italic">Gathering wisdom...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-6">
                <h2 className="serif text-2xl font-medium text-sage-dark flex items-center gap-2">
                  <BookOpen className="w-6 h-6" />
                  Relevant Verses
                </h2>
                {verses.map((v, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className="bg-white p-6 rounded-2xl border border-sage/5 shadow-sm"
                  >
                    <p className="serif italic text-lg text-ink/80 mb-3">"{v.text}"</p>
                    <p className="text-sage-dark font-semibold text-sm">— {v.reference}</p>
                  </motion.div>
                ))}
              </div>

              <div className="space-y-6">
                <div className="bg-white p-8 rounded-3xl border border-sage/10 sticky top-24">
                  <h3 className="serif text-xl font-medium text-sage-dark mb-4 flex items-center gap-2">
                    <BrainCircuit className="w-5 h-5 text-sage" />
                    Theological Insight
                  </h3>
                  <div className="markdown-body text-ink/80 prose prose-sage">
                    {semanticResult ? (
                      <ReactMarkdown>{semanticResult.insight}</ReactMarkdown>
                    ) : (
                      <p>
                        When we focus on <strong>{selectedTopic.name.toLowerCase()}</strong>, we are reminded that God's Word is a lamp to our feet. 
                        In every season, His promises remain true. 
                      </p>
                    )}
                  </div>
                  
                  {semanticResult?.themes && (
                    <div className="mt-8 pt-6 border-t border-sage/10">
                      <h4 className="text-[10px] font-bold text-sage uppercase tracking-widest mb-3">Key Themes</h4>
                      <div className="flex flex-wrap gap-2">
                        {semanticResult.themes.map((theme: string, i: number) => (
                          <span key={i} className="px-3 py-1 bg-sage-light/30 text-sage-dark text-[10px] font-bold rounded-full uppercase tracking-wider">
                            {theme}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
