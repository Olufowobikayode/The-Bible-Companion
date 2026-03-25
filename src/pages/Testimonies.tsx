import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { api } from '../lib/api';
import { motion } from 'motion/react';
import { toast } from 'sonner';
import { Trash2, MessageSquareHeart } from 'lucide-react';
import { moderateContent } from '../lib/moderation';

interface Testimony {
  id: string;
  content: string;
  authorUid: string;
  authorName: string;
  isAnonymous: boolean;
  createdAt: any;
  reactions?: { [key: string]: number };
}

interface Comment {
  id: string;
  content: string;
  authorName: string;
  authorUid: string;
  createdAt: any;
}

export default function Testimonies() {
  const [testimonies, setTestimonies] = useState<Testimony[]>([]);
  const [newTestimony, setNewTestimony] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [activeCommentsId, setActiveCommentsId] = useState<string | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isCommenting, setIsCommenting] = useState(false);
  const [user, setUser] = useState<any>(null);

  const fetchTestimonies = async () => {
    try {
      const data = await api.get('/api/testimonies');
      setTestimonies(data);
    } catch (error) {
      console.error("Error fetching testimonies:", error);
    }
  };

  useEffect(() => {
    fetchTestimonies();

    const checkAdmin = async (u: any) => {
      if (u) {
        if (u.email === 'kayodeolufowobi709@gmail.com') {
          setIsAdmin(true);
          return;
        }
        try {
          const profile = await api.get(`/api/user-profiles/${u.id}`);
          if (profile?.role === 'admin') {
            setIsAdmin(true);
          }
        } catch (error) {
          console.error("Error checking admin status:", error);
        }
      }
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) checkAdmin(session.user);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) checkAdmin(session.user);
      else setIsAdmin(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!activeCommentsId) {
      setComments([]);
      return;
    }

    const fetchComments = async () => {
      try {
        const data = await api.get(`/api/testimonies/${activeCommentsId}/comments`);
        setComments(data);
      } catch (error) {
        console.error("Error fetching comments:", error);
      }
    };
    fetchComments();
  }, [activeCommentsId]);

  const handleReaction = async (testimonyId: string, emoji: string) => {
    if (!user) {
      toast.error("Please sign in to react.");
      return;
    }

    try {
      await api.post(`/api/testimonies/${testimonyId}/reactions`, { emoji });
      setTestimonies(prev => prev.map(t => {
        if (t.id === testimonyId) {
          const reactions = { ...(t.reactions || {}) };
          reactions[emoji] = (reactions[emoji] || 0) + 1;
          return { ...t, reactions };
        }
        return t;
      }));
    } catch (error) {
      console.error("Error adding reaction:", error);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !user || !activeCommentsId) return;

    setIsCommenting(true);
    try {
      const moderationResult = await moderateContent(newComment);
      if (!moderationResult.isApproved) {
        toast.error(`Comment rejected: ${moderationResult.reason}`);
        setIsCommenting(false);
        return;
      }

      const comment = await api.post(`/api/testimonies/${activeCommentsId}/comments`, {
        content: newComment,
        authorName: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Anonymous',
      });

      setComments(prev => [...prev, comment]);
      setNewComment('');
      toast.success("Comment added!");
    } catch (error) {
      console.error("Error adding comment:", error);
      toast.error("Failed to add comment.");
    } finally {
      setIsCommenting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTestimony.trim() || !user) return;

    setIsSubmitting(true);
    try {
      // Moderate testimony
      const moderationResult = await moderateContent(newTestimony);
      if (!moderationResult.isApproved) {
        toast.error(`Testimony rejected: ${moderationResult.reason}`);
        setIsSubmitting(false);
        return;
      }

      const testimony = await api.post('/api/testimonies', {
        content: newTestimony,
        authorName: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Anonymous',
        isAnonymous,
      });
      
      setTestimonies(prev => [testimony, ...prev]);
      setNewTestimony('');
      setIsAnonymous(false);
      toast.success("Testimony shared successfully!");
    } catch (error) {
      console.error("Error submitting testimony:", error);
      toast.error("Failed to share testimony.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("Are you sure you want to delete this testimony?")) {
      try {
        await api.delete(`/api/testimonies/${id}`);
        setTestimonies(prev => prev.filter(t => t.id !== id));
        toast.success("Testimony deleted");
      } catch (error) {
        console.error("Error deleting testimony:", error);
        toast.error("Failed to delete testimony");
      }
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 sm:py-12">
      <div className="text-center mb-12">
        <h1 className="serif text-3xl sm:text-4xl font-semibold text-sage-dark mb-4 flex items-center justify-center gap-3">
          <MessageSquareHeart className="w-8 h-8 text-sage" />
          Testimonies
        </h1>
        <p className="text-ink/60 max-w-2xl mx-auto">
          "They triumphed over him by the blood of the Lamb and by the word of their testimony." - Revelation 12:11
        </p>
      </div>

      {user ? (
        <div className="bg-sage-light/20 p-6 sm:p-8 rounded-[2rem] border border-sage/10 mb-12">
          <h2 className="serif text-xl font-semibold text-sage-dark mb-4">Share Your Testimony</h2>
          <form onSubmit={handleSubmit}>
            <textarea
              value={newTestimony}
              onChange={(e) => setNewTestimony(e.target.value)}
              placeholder="What has God done in your life? Share your story..."
              className="w-full p-4 bg-white border border-sage/20 rounded-2xl resize-none h-32 focus:outline-none focus:border-sage mb-4 text-sm"
              disabled={isSubmitting}
            />
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <label className="flex items-center gap-2 text-sm text-ink/70 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={isAnonymous} 
                  onChange={(e) => setIsAnonymous(e.target.checked)}
                  className="rounded text-sage"
                />
                Share Anonymously
              </label>
              <button 
                type="submit"
                disabled={isSubmitting || !newTestimony.trim()}
                className="w-full sm:w-auto bg-sage text-white px-8 py-3 rounded-xl font-medium hover:bg-sage-dark transition-all disabled:opacity-50 shadow-lg shadow-sage/10"
              >
                {isSubmitting ? 'Sharing...' : 'Share Testimony'}
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div className="bg-sage-light/20 p-8 rounded-[2rem] border border-sage/10 mb-12 text-center">
          <p className="text-ink/60">Please sign in to share your testimony.</p>
        </div>
      )}

      <div className="space-y-6">
        {testimonies.map((testimony) => (
          <motion.div
            key={testimony.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white p-6 sm:p-8 rounded-3xl border border-sage/10 shadow-sm relative group"
          >
            <p className="text-ink/80 leading-relaxed whitespace-pre-wrap mb-6">
              "{testimony.content}"
            </p>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-sage-light flex items-center justify-center text-sage font-bold">
                  {testimony.isAnonymous ? 'A' : (testimony.authorName?.[0] || 'U')}
                </div>
                <div>
                  <p className="font-medium text-sage-dark text-sm">
                    {testimony.isAnonymous ? 'Anonymous' : (testimony.authorName || 'User')}
                  </p>
                  <p className="text-xs text-ink/40">
                    {testimony.createdAt?.toDate?.() ? testimony.createdAt.toDate().toLocaleString() : new Date(testimony.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {['🙏', '❤️', '🙌'].map(emoji => (
                  <button
                    key={emoji}
                    onClick={() => handleReaction(testimony.id, emoji)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-cream/50 border border-sage/5 hover:bg-sage-light/20 transition-all text-sm"
                  >
                    <span>{emoji}</span>
                    <span className="text-xs font-bold text-sage">{testimony.reactions?.[emoji] || 0}</span>
                  </button>
                ))}
                <button
                  onClick={() => setActiveCommentsId(activeCommentsId === testimony.id ? null : testimony.id)}
                  className="p-2 text-sage hover:bg-sage-light/20 rounded-full transition-all"
                  title="Comments"
                >
                  <MessageSquareHeart size={20} />
                </button>
              </div>
            </div>

            {activeCommentsId === testimony.id && (
              <div className="mt-8 pt-8 border-t border-sage/10 space-y-6">
                <div className="space-y-4">
                  {comments.map(comment => (
                    <div key={comment.id} className="flex gap-3">
                      <div className="w-8 h-8 rounded-full bg-sage-light/50 flex items-center justify-center text-xs font-bold text-sage shrink-0">
                        {comment.authorName?.[0] || 'U'}
                      </div>
                      <div className="flex-grow">
                        <div className="bg-cream/30 p-4 rounded-2xl border border-sage/5">
                          <p className="text-sm text-ink/80">{comment.content}</p>
                        </div>
                        <div className="flex items-center gap-2 mt-1 px-2">
                          <span className="text-[10px] font-bold text-sage-dark">{comment.authorName}</span>
                          <span className="text-[10px] text-ink/20">
                            {comment.createdAt?.toDate?.() ? comment.createdAt.toDate().toLocaleString() : 'Just now'}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {user ? (
                  <form onSubmit={handleAddComment} className="flex gap-2">
                    <input
                      type="text"
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      placeholder="Add an encouraging word..."
                      className="flex-grow px-4 py-2 bg-white border border-sage/20 rounded-xl text-sm focus:outline-none focus:border-sage"
                      disabled={isCommenting}
                    />
                    <button
                      type="submit"
                      disabled={isCommenting || !newComment.trim()}
                      className="bg-sage text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-sage-dark transition-all disabled:opacity-50"
                    >
                      Post
                    </button>
                  </form>
                ) : (
                  <p className="text-center text-xs text-ink/40">Please sign in to comment.</p>
                )}
              </div>
            )}
            
            {(isAdmin || (user && user.id === testimony.authorUid)) && (
              <button 
                onClick={() => handleDelete(testimony.id)}
                className="absolute top-6 right-6 p-2 text-ink/20 hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
                title="Delete Testimony"
              >
                <Trash2 size={18} />
              </button>
            )}
          </motion.div>
        ))}
        
        {testimonies.length === 0 && (
          <div className="text-center py-12 text-ink/40 italic">
            No testimonies shared yet. Be the first to share!
          </div>
        )}
      </div>
    </div>
  );
}
