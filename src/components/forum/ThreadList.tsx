import { useParams, Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { api } from '../../lib/api';
import { useEffect, useState } from 'react';
import { Trash2, ChevronLeft } from 'lucide-react';
import { motion } from 'motion/react';
import { toast } from 'sonner';
import { moderateContent } from '../../lib/moderation';

interface Thread {
  id: string;
  title: string;
  authorUid: string;
  authorName: string;
  isAnonymous: boolean;
}

export default function ThreadList() {
  const { forumId } = useParams<{ forumId: string }>();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [newThreadTitle, setNewThreadTitle] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const fetchThreads = async () => {
    if (!forumId) return;
    try {
      const data = await api.get(`/api/forums/${forumId}/threads`);
      setThreads(data);
    } catch (error) {
      console.error("Error fetching threads:", error);
    }
  };

  useEffect(() => {
    fetchThreads();
    const checkAdmin = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUser(session.user);
        if (session.user.email === 'kayodeolufowobi709@gmail.com') {
          setIsAdmin(true);
        } else {
          try {
            const profile = await api.get(`/api/user-profiles/${session.user.id}`);
            if (profile?.role === 'admin') {
              setIsAdmin(true);
            }
          } catch (error) {
            console.error("Error checking admin status:", error);
          }
        }
      } else {
        setUser(null);
        setIsAdmin(false);
      }
    };
    checkAdmin();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        setUser(session.user);
        checkAdmin();
      } else {
        setUser(null);
        setIsAdmin(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [forumId]);

  const handleDeleteThread = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setConfirmDeleteId(id);
  };

  const executeDeleteThread = async () => {
    if (!confirmDeleteId || !forumId) return;
    const id = confirmDeleteId;
    setConfirmDeleteId(null);
    
    try {
      await api.delete(`/api/forums/${forumId}/threads/${id}`);
      setThreads(prev => prev.filter(t => t.id !== id));
      toast.success("Thread deleted");
    } catch (error) {
      console.error("Error deleting thread:", error);
      toast.error("Failed to delete thread.");
    }
  };

  const handleCreateThread = async () => {
    if (!newThreadTitle || !user || !forumId) return;
    setIsSubmitting(true);
    try {
      const moderationResult = await moderateContent(newThreadTitle);
      if (!moderationResult.isApproved) {
        toast.error(`Thread rejected: ${moderationResult.reason}`);
        setIsSubmitting(false);
        return;
      }

      const newThread = await api.post(`/api/forums/${forumId}/threads`, {
        title: newThreadTitle,
        authorUid: user.id,
        authorName: user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
        isAnonymous,
      });
      setThreads(prev => [newThread, ...prev]);
      setNewThreadTitle('');
      setIsAnonymous(false);
      toast.success("Thread created");
    } catch (error) {
      console.error("Error creating thread:", error);
      toast.error("Failed to create thread.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-0 sm:px-4 py-6 sm:py-12">
      <div className="mb-8 px-4 sm:px-0">
        <Link to="/forum" className="text-sage hover:text-sage-dark mb-4 inline-flex items-center gap-2 text-sm font-medium transition-colors">
          <ChevronLeft size={18} />
          Back to Forums
        </Link>
        <h1 className="serif text-3xl sm:text-4xl font-semibold text-sage-dark">Threads</h1>
      </div>
      
      {user ? (
        <div className="mb-8 p-6 sm:p-8 mx-4 sm:mx-0 bg-sage-light/20 rounded-[2rem] border border-sage/10">
          <h2 className="serif text-xl sm:text-2xl font-semibold text-sage-dark mb-4">Start a Discussion</h2>
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <input 
              value={newThreadTitle} 
              onChange={(e) => setNewThreadTitle(e.target.value)}
              className="flex-grow p-4 bg-white border border-sage/20 rounded-2xl text-sm focus:outline-none focus:border-sage"
              placeholder="What's on your mind?"
              disabled={isSubmitting}
            />
            <button 
              onClick={handleCreateThread} 
              disabled={isSubmitting || !newThreadTitle}
              className="bg-sage text-white px-8 py-3 rounded-xl font-medium hover:bg-sage-dark transition-all disabled:opacity-50 shadow-lg shadow-sage/10"
            >
              {isSubmitting ? 'Creating...' : 'Create Thread'}
            </button>
          </div>
          <label className="flex items-center gap-2 text-sm text-ink/70 cursor-pointer">
            <input 
              type="checkbox" 
              checked={isAnonymous} 
              onChange={(e) => setIsAnonymous(e.target.checked)}
              className="rounded text-sage"
            />
            Post Anonymously
          </label>
        </div>
      ) : (
        <div className="mb-8 p-8 mx-4 sm:mx-0 bg-sage-light/20 rounded-[2rem] border border-sage/10 text-center">
          <p className="text-ink/60">Please sign in to create a new thread.</p>
        </div>
      )}

      <div className="grid gap-4 px-4 sm:px-0">
        {threads.filter(thread => thread.id).map(thread => (
          <motion.div 
            key={thread.id} 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative group"
          >
            <Link to={`/forum/${forumId}/threads/${thread.id}`} className="block p-6 sm:p-8 bg-white border border-sage/10 rounded-3xl hover:border-sage/30 hover:shadow-xl hover:shadow-sage/5 transition-all">
              <h2 className="serif text-xl sm:text-2xl font-semibold text-sage-dark mb-2 group-hover:text-sage transition-colors">{thread.title}</h2>
              <p className="text-xs text-ink/40 italic">
                Posted by {thread.isAnonymous ? 'Anonymous' : (thread.authorName || 'User')}
              </p>
            </Link>
            {(isAdmin || (user && user.id === thread.authorUid)) && (
              <button 
                onClick={(e) => handleDeleteThread(thread.id, e)}
                className="absolute top-6 right-6 p-2 text-ink/20 hover:text-destructive transition-colors"
                title="Delete Thread"
              >
                <Trash2 size={18} />
              </button>
            )}
          </motion.div>
        ))}
        {threads.length === 0 && (
          <div className="text-center py-12 text-ink/40 italic">No threads yet. Be the first to post!</div>
        )}
      </div>

      {confirmDeleteId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white p-8 rounded-[2.5rem] max-w-sm w-full shadow-2xl"
          >
            <h3 className="serif text-2xl font-semibold text-sage-dark mb-4">Confirm Deletion</h3>
            <p className="text-ink/70 mb-8 leading-relaxed">Are you sure you want to delete this thread? This action cannot be undone.</p>
            <div className="flex gap-3">
              <button 
                onClick={() => setConfirmDeleteId(null)}
                className="flex-1 px-6 py-3 rounded-xl border border-sage/20 font-medium hover:bg-sage-light transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={executeDeleteThread}
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
