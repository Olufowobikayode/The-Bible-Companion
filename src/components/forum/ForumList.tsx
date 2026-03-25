import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { api } from '../../lib/api';
import { useEffect, useState } from 'react';
import { Trash2, MessageSquare, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';

interface Forum {
  id: string;
  title: string;
  description: string;
}

export default function ForumList() {
  const [forums, setForums] = useState<Forum[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  const [newForumTitle, setNewForumTitle] = useState('');
  const [newForumDescription, setNewForumDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    const fetchForums = async () => {
      try {
        const data = await api.get('/api/forums');
        setForums(data);
      } catch (error) {
        console.error("Error fetching forums:", error);
      } finally {
        setLoading(false);
      }
    };

    const checkAdmin = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
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
        setIsAdmin(false);
      }
    };

    fetchForums();
    checkAdmin();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        checkAdmin();
      } else {
        setIsAdmin(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleDeleteForum = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setConfirmDeleteId(id);
  };

  const executeDeleteForum = async () => {
    if (!confirmDeleteId) return;
    const id = confirmDeleteId;
    setConfirmDeleteId(null);
    
    try {
      await api.delete(`/api/forums/${id}`);
      setForums(prev => prev.filter(f => f.id !== id));
    } catch (error) {
      console.error("Error deleting forum:", error);
    }
  };

  const handleCreateForum = async () => {
    if (!newForumTitle) return;
    
    setIsSubmitting(true);
    try {
      const newForum = await api.post('/api/forums', {
        title: newForumTitle,
        description: newForumDescription,
      });
      setForums(prev => [...prev, newForum]);
      setNewForumTitle('');
      setNewForumDescription('');
    } catch (error) {
      console.error("Error creating forum:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 text-sage animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-0 sm:px-4 py-6 sm:py-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-8 px-4 sm:px-0">
        <div>
          <h1 className="serif text-3xl sm:text-4xl font-semibold text-sage-dark">Community Forums</h1>
          <p className="text-ink/60 mt-2">Connect, share, and grow with others.</p>
        </div>
        {isAdmin && (
          <div className="p-6 sm:p-8 bg-sage-light/20 rounded-[2rem] border border-sage/10 w-full sm:w-auto sm:min-w-[400px]">
            <h2 className="serif text-xl sm:text-2xl font-semibold text-sage-dark mb-4">Create New Forum</h2>
            <div className="space-y-3">
              <input 
                value={newForumTitle} 
                onChange={(e) => setNewForumTitle(e.target.value)}
                className="w-full p-4 bg-white border border-sage/20 rounded-2xl text-sm focus:outline-none focus:border-sage"
                placeholder="Forum Title"
                disabled={isSubmitting}
              />
              <input 
                value={newForumDescription} 
                onChange={(e) => setNewForumDescription(e.target.value)}
                className="w-full p-4 bg-white border border-sage/20 rounded-2xl text-sm focus:outline-none focus:border-sage"
                placeholder="Forum Description"
                disabled={isSubmitting}
              />
              <button 
                onClick={handleCreateForum} 
                disabled={isSubmitting || !newForumTitle}
                className="w-full bg-sage text-white px-8 py-3 rounded-xl font-medium hover:bg-sage-dark transition-all disabled:opacity-50 shadow-lg shadow-sage/10"
              >
                {isSubmitting ? 'Creating...' : 'Create Forum'}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 px-4 sm:px-0">
        {forums.map(forum => (
          <motion.div
            key={forum.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="group relative bg-white rounded-3xl p-6 sm:p-8 border border-sage/10 hover:border-sage/30 transition-all hover:shadow-xl hover:shadow-sage/5"
          >
            <Link to={`/forum/${forum.id}`} className="block">
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 bg-sage-light rounded-2xl text-sage group-hover:bg-sage group-hover:text-white transition-colors">
                  <MessageSquare className="w-6 h-6" />
                </div>
              </div>
              <h3 className="serif text-xl sm:text-2xl font-semibold text-sage-dark mb-2 group-hover:text-sage transition-colors">
                {forum.title}
              </h3>
              <p className="text-ink/60 text-sm line-clamp-2 leading-relaxed">
                {forum.description}
              </p>
            </Link>
            {isAdmin && (
              <button 
                onClick={(e) => handleDeleteForum(forum.id, e)}
                className="absolute top-6 right-6 p-2 text-ink/20 hover:text-destructive transition-colors"
                title="Delete Forum"
              >
                <Trash2 size={20} />
              </button>
            )}
          </motion.div>
        ))}
      </div>

      {confirmDeleteId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white p-8 rounded-[2.5rem] max-w-sm w-full shadow-2xl"
          >
            <h3 className="serif text-2xl font-semibold text-sage-dark mb-4">Confirm Deletion</h3>
            <p className="text-ink/70 mb-8 leading-relaxed">Are you sure you want to delete this forum? All threads and posts will be inaccessible.</p>
            <div className="flex gap-3">
              <button 
                onClick={() => setConfirmDeleteId(null)}
                className="flex-1 px-6 py-3 rounded-xl border border-sage/20 font-medium hover:bg-sage-light transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={executeDeleteForum}
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
