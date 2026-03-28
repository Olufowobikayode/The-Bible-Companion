import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../lib/supabase';
import { api } from '../lib/api';
import { Bookmark as BookmarkIcon, Trash2, Loader2, BookOpen } from 'lucide-react';
import { Bookmark } from '../types';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';

export default function Bookmarks() {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const fetchBookmarks = async () => {
    try {
      const data = await api.get('/api/bookmarks');
      setBookmarks(data.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    } catch (error) {
      console.error('Error fetching bookmarks:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) fetchBookmarks();
      else setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) fetchBookmarks();
      else {
        setBookmarks([]);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleDelete = async (id: string) => {
    setConfirmDeleteId(id);
  };

  const executeDelete = async () => {
    if (!confirmDeleteId) return;
    const id = confirmDeleteId;
    setConfirmDeleteId(null);
    try {
      await api.delete(`/api/bookmarks/${id}`);
      setBookmarks(prev => prev.filter(b => b.id !== id));
      toast.success('Bookmark removed');
    } catch (error) {
      console.error('Delete failed:', error);
      toast.error('Failed to remove bookmark');
    }
  };

  if (!user) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <div className="w-20 h-20 bg-sage-light rounded-full flex items-center justify-center mx-auto mb-8">
          <BookmarkIcon className="w-10 h-10 text-sage" />
        </div>
        <h2 className="serif text-3xl font-semibold text-sage-dark mb-4">Your Bookmarks</h2>
        <p className="text-ink/60 mb-8">Please sign in to view and manage your saved verses.</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <div className="flex justify-between items-center mb-12">
        <div>
          <h1 className="serif text-4xl font-semibold text-sage-dark mb-2">My Bookmarks</h1>
          <p className="text-ink/40">Your personal collection of cherished Scripture.</p>
        </div>
        <div className="bg-sage-light px-4 py-2 rounded-full text-sage-dark font-bold text-sm">
          {bookmarks.length} Verses
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-10 h-10 animate-spin text-sage" />
        </div>
      ) : bookmarks.length > 0 ? (
        <div className="grid gap-6">
          <AnimatePresence>
            {bookmarks.map((b) => (
              <motion.div
                key={b.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white p-8 rounded-3xl border border-sage/10 shadow-sm hover:shadow-md transition-all group"
              >
                <div className="flex justify-between items-start gap-4">
                  <div className="space-y-4 flex-grow">
                    <p className="serif italic text-xl text-ink/80 leading-relaxed">"{b.text}"</p>
                    <div className="flex items-center gap-3">
                      <span className="text-sage-dark font-bold">— {b.verseRef}</span>
                      <span className="text-[10px] text-ink/30 uppercase tracking-widest bg-cream px-2 py-0.5 rounded border border-sage/5">
                        {b.translation}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => b.id && handleDelete(b.id)}
                    className="p-2 text-ink/20 hover:text-red-500 hover:bg-red-50 rounded-full transition-all"
                    title="Remove Bookmark"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      ) : (
        <div className="text-center py-20 bg-white rounded-[3rem] border border-dashed border-sage/20">
          <BookOpen className="w-12 h-12 text-sage/20 mx-auto mb-4" />
          <p className="text-ink/40 serif italic text-lg">Your collection is empty.</p>
          <Link to="/bible" className="text-sage font-medium hover:underline mt-4 inline-block">
            Explore the Bible
          </Link>
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
            <p className="text-ink/70 mb-8 leading-relaxed">Are you sure you want to delete this bookmark? This action cannot be undone.</p>
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
