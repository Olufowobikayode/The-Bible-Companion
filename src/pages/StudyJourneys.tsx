import { useState } from 'react';
import { motion } from 'motion/react';
import { getGuidedStudyJourney } from '../lib/gemini';
import { Loader2, Sparkles, BookOpen } from 'lucide-react';

export default function StudyJourneys() {
  const [theme, setTheme] = useState('');
  const [journey, setJourney] = useState<{ title: string, description: string, steps: string[] } | null>(null);
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    if (!theme.trim()) return;
    setLoading(true);
    try {
      const result = await getGuidedStudyJourney(theme);
      setJourney(result);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <div className="text-center mb-12">
        <h1 className="serif text-4xl font-semibold text-sage-dark mb-4">Guided Study Journeys</h1>
        <p className="text-ink/60">Explore curated, AI-assisted study paths for your theological journey.</p>
      </div>

      <div className="bg-white rounded-3xl shadow-xl shadow-sage/5 border border-sage/10 p-8 mb-8">
        <div className="flex gap-4">
          <input
            type="text"
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
            placeholder="Enter a theological theme (e.g., 'Grace', 'The Nature of Creation')..."
            className="flex-grow bg-sage-light/20 border border-sage/20 rounded-xl px-4 py-3 focus:outline-none focus:border-sage"
          />
          <button
            onClick={handleGenerate}
            disabled={loading || !theme.trim()}
            className="bg-sage text-white px-6 py-3 rounded-xl hover:bg-sage-dark transition-all disabled:opacity-50 flex items-center gap-2"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
            Generate Journey
          </button>
        </div>
      </div>

      {journey && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-cream rounded-3xl p-8 border border-sage/10 space-y-6"
        >
          <h2 className="serif text-3xl font-semibold text-sage-dark">{journey.title}</h2>
          <p className="text-ink/80 leading-relaxed">{journey.description}</p>
          <div className="space-y-4">
            {journey.steps.map((step, i) => (
              <div key={i} className="flex gap-4 items-start bg-white p-4 rounded-xl border border-sage/5">
                <div className="bg-sage text-white w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 font-bold">
                  {i + 1}
                </div>
                <p className="text-ink/80 pt-1">{step}</p>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}
