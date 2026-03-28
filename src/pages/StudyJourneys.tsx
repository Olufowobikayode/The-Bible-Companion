import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { getGuidedStudyJourney } from '../lib/gemini';
import { Loader2, Sparkles, BookOpen, Bookmark, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../lib/api';

export default function StudyJourneys() {
  const [theme, setTheme] = useState('');
  const [journey, setJourney] = useState<{ title: string, description: string, steps: string[] } | null>(null);
  const [savedJourneys, setSavedJourneys] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    fetchSavedJourneys();
  }, []);

  const fetchSavedJourneys = async () => {
    try {
      const data = await api.get('/api/study-journeys');
      setSavedJourneys(data);
    } catch (error) {
      console.error("Error fetching saved journeys:", error);
    }
  };

  const handleGenerate = async () => {
    if (!theme.trim()) return;
    setLoading(true);
    try {
      const result = await getGuidedStudyJourney(theme);
      setJourney(result);
      toast.success('Study journey generated!');
    } catch (e) {
      console.error(e);
      toast.error('Failed to generate study journey.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveJourney = async () => {
    if (!journey) return;
    setIsSaving(true);
    try {
      await api.post('/api/study-journeys', journey);
      toast.success('Journey bookmarked!');
      fetchSavedJourneys();
    } catch (error) {
      toast.error('Failed to bookmark journey.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteJourney = async (id: string) => {
    setConfirmDeleteId(id);
  };

  const executeDelete = async () => {
    if (!confirmDeleteId) return;
    const id = confirmDeleteId;
    setConfirmDeleteId(null);
    try {
      await api.delete(`/api/study-journeys/${id}`);
      setSavedJourneys(prev => prev.filter(j => j.id !== id));
      toast.success('Journey deleted');
    } catch (error) {
      toast.error('Failed to delete journey');
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
          className="bg-cream rounded-3xl p-8 border border-sage/10 space-y-6 mb-12"
        >
          <div className="flex justify-between items-start">
            <h2 className="serif text-3xl font-semibold text-sage-dark">{journey.title}</h2>
            <button
              onClick={handleSaveJourney}
              disabled={isSaving}
              className="flex items-center gap-2 text-sage hover:text-sage-dark font-bold bg-white px-4 py-2 rounded-xl border border-sage/10 transition-all"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bookmark className="w-4 h-4" />}
              Save Journey
            </button>
          </div>
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

      {savedJourneys.length > 0 && (
        <div className="space-y-8">
          <h2 className="serif text-3xl font-bold text-sage-dark">Your Bookmarked Journeys</h2>
          <div className="grid gap-6">
            {savedJourneys.map((sj) => (
              <div key={sj.id} className="bg-white p-6 rounded-3xl border border-sage/10 hover:border-sage/30 transition-all group">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="serif text-xl font-bold text-sage-dark">{sj.title}</h3>
                  <button
                    onClick={() => handleDeleteJourney(sj.id)}
                    className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
                <p className="text-ink/60 text-sm mb-4 line-clamp-2">{sj.description}</p>
                <div className="space-y-2">
                  {sj.steps.slice(0, 2).map((step: string, i: number) => (
                    <div key={i} className="flex gap-2 items-start text-xs text-ink/50">
                      <div className="w-4 h-4 rounded-full bg-sage/10 text-sage flex items-center justify-center flex-shrink-0 font-bold">{i + 1}</div>
                      <p className="line-clamp-1">{step}</p>
                    </div>
                  ))}
                  {sj.steps.length > 2 && <p className="text-[10px] text-sage font-bold uppercase tracking-widest">+ {sj.steps.length - 2} more steps</p>}
                </div>
                <button 
                  onClick={() => setJourney(sj)}
                  className="mt-6 w-full py-3 rounded-xl bg-sage-light/20 text-sage font-bold hover:bg-sage-light/40 transition-all text-sm"
                >
                  Continue Journey
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {confirmDeleteId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white p-8 rounded-[2.5rem] max-w-sm w-full shadow-2xl"
          >
            <h3 className="serif text-2xl font-semibold text-sage-dark mb-4">Confirm Deletion</h3>
            <p className="text-ink/70 mb-8 leading-relaxed">Are you sure you want to delete this study journey? This action cannot be undone.</p>
            <div className="flex gap-3">
              <button 
                onClick={() => setConfirmDeleteId(null)}
                className="flex-1 px-6 py-3 rounded-xl border border-sage/20 font-medium hover:bg-sage-light transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={executeDelete}
                className="flex-1 px-6 py-3 bg-destructive text-white rounded-xl font-medium hover:bg-destructive/90 transition-colors"
              >
                Delete
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
