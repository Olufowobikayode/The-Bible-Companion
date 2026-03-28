import { useState, useEffect } from 'react';
import { Trash2, Heart, Loader2, Share2, MessageSquare, Send, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { toast } from 'sonner';
import { moderateContent } from '../../lib/moderation';
import { api } from '../../lib/api';
import { supabase } from '../../lib/supabase';
import { generatePrayerCompanion } from '../../lib/gemini';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface PrayerRequest {
  id: string;
  content: string;
  prayCount: number;
  authorUid: string;
  authorName: string;
  isAnonymous: boolean;
  createdAt: any;
}

export default function PrayerWall() {
  const [requests, setRequests] = useState<PrayerRequest[]>([]);
  const [newRequest, setNewRequest] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userPrayers, setUserPrayers] = useState<Set<string>>(new Set());
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [typingPrayerId, setTypingPrayerId] = useState<string | null>(null);
  const [typedPrayer, setTypedPrayer] = useState('');
  const [isTypingSubmitting, setIsTypingSubmitting] = useState(false);
  const [viewingPrayersId, setViewingPrayersId] = useState<string | null>(null);
  const [typedPrayersList, setTypedPrayersList] = useState<any[]>([]);
  const [user, setUser] = useState<any>(null);
  const [isGeneratingPrayer, setIsGeneratingPrayer] = useState(false);

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        setUser(session?.user ?? null);
        setIsAuthLoading(false);

        if (session?.user) {
          const userEmail = session.user.email;
          if (userEmail === 'kayodeolufowobi709@gmail.com') {
            setIsAdmin(true);
          } else {
            const profile = await api.get(`/api/profile/${session.user.id}`);
            if (profile && profile.role === 'admin') {
              setIsAdmin(true);
            }
          }
          
          const prayerIds = await api.get('/api/user-prayers');
          setUserPrayers(new Set(prayerIds));
        }

        const prayerRequests = await api.get('/api/prayer-requests');
        setRequests(prayerRequests);
      } catch (error) {
        console.error("Error fetching initial data:", error);
      }
    };

    fetchInitialData();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        const prayerIds = await api.get('/api/user-prayers');
        setUserPrayers(new Set(prayerIds));
      } else {
        setIsAdmin(false);
        setUserPrayers(new Set());
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async () => {
    if (!newRequest.trim() || !user) return;
    setIsSubmitting(true);

    try {
      const moderationResult = await moderateContent(newRequest);
      if (!moderationResult.isApproved) {
        toast.error(`Prayer request rejected: ${moderationResult.reason}`);
        setIsSubmitting(false);
        return;
      }

      const request = await api.post('/api/prayer-requests', {
        content: newRequest,
        authorName: user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
        isAnonymous
      });
      
      setRequests(prev => [request, ...prev]);
      setNewRequest('');
      setIsAnonymous(false);
      toast.success("Prayer request posted!");

      // Track activity
      await api.post('/api/user/activity', {
        type: 'prayer_post',
        metadata: { length: newRequest.length }
      });
    } catch (error) {
      console.error("Error submitting prayer request:", error);
      toast.error("Failed to post prayer request.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    setConfirmDeleteId(id);
  };

  const executeDelete = async () => {
    if (!confirmDeleteId) return;
    const id = confirmDeleteId;
    setConfirmDeleteId(null);
    
    try {
      await api.delete(`/api/prayer-requests/${id}`);
      setRequests(prev => prev.filter(r => r.id !== id));
      toast.success("Prayer request deleted.");
    } catch (error) {
      console.error("Error deleting prayer request:", error);
      toast.error("Failed to delete prayer request.");
    }
  };

  const handlePray = async (id: string) => {
    if (!user) {
      toast.error("Please sign in to pray for others.");
      return;
    }

    try {
      const result = await api.post(`/api/prayer-requests/${id}/pray`, {});
      
      setUserPrayers(prev => {
        const next = new Set(prev);
        if (result.prayed) next.add(id);
        else next.delete(id);
        return next;
      });

      setRequests(prev => prev.map(r => 
        r.id === id ? { ...r, prayCount: r.prayCount + (result.prayed ? 1 : -1) } : r
      ));

      toast.success(result.prayed ? "Prayer registered!" : "Prayer removed.");

      // Track activity
      if (result.prayed) {
        await api.post('/api/user/activity', {
          type: 'prayer_react',
          metadata: { prayerId: id }
        });
      }
    } catch (error) {
      console.error("Error updating prayer status:", error);
      toast.error("Failed to update prayer status.");
    }
  };

  const handleTypePrayer = async (id: string) => {
    if (!typedPrayer.trim() || !user) return;
    setIsTypingSubmitting(true);

    try {
      const moderationResult = await moderateContent(typedPrayer);
      if (!moderationResult.isApproved) {
        toast.error(`Prayer rejected: ${moderationResult.reason}`);
        setIsTypingSubmitting(false);
        return;
      }

      await api.post(`/api/prayer-requests/${id}/typed-prayers`, {
        text: typedPrayer,
        authorName: user.user_metadata?.full_name || user.email?.split('@')[0] || 'User'
      });

      setTypedPrayer('');
      setTypingPrayerId(null);
      toast.success("Your prayer has been shared!");
    } catch (error) {
      console.error("Error submitting typed prayer:", error);
      toast.error("Failed to share prayer.");
    } finally {
      setIsTypingSubmitting(false);
    }
  };

  const handleGeneratePrayer = async (requestContent: string) => {
    setIsGeneratingPrayer(true);
    try {
      const generated = await generatePrayerCompanion(requestContent);
      setTypedPrayer(generated);
      toast.success('Prayer drafted. Feel free to edit it.');
    } catch (error) {
      console.error('Failed to generate prayer:', error);
      toast.error('Failed to generate prayer.');
    } finally {
      setIsGeneratingPrayer(false);
    }
  };

  const fetchTypedPrayers = async (id: string) => {
    setViewingPrayersId(id);
    try {
      const prayers = await api.get(`/api/prayer-requests/${id}/typed-prayers`);
      setTypedPrayersList(prayers);
    } catch (error) {
      console.error("Error fetching typed prayers:", error);
      toast.error("Failed to load prayers.");
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-0 sm:px-4 py-6 sm:py-12">
      <div className="mb-8 px-4 sm:px-0">
        <h1 className="serif text-3xl sm:text-4xl font-semibold text-sage-dark">Prayer Wall</h1>
        <p className="text-ink/60 mt-2">Share your prayer requests and lift others up in prayer.</p>
      </div>

      {isAuthLoading ? (
        <div className="mb-8 p-12 mx-4 sm:mx-0 bg-sage-light/10 rounded-[2rem] border border-sage/5 flex justify-center">
          <Loader2 className="w-6 h-6 text-sage animate-spin" />
        </div>
      ) : user ? (
        <div className="mb-8 p-6 sm:p-8 mx-4 sm:mx-0 bg-sage-light/20 rounded-[2rem] border border-sage/10">
          <h2 className="serif text-xl sm:text-2xl font-semibold text-sage-dark mb-4">Share a Request</h2>
          <textarea
            value={newRequest}
            onChange={(e) => setNewRequest(e.target.value)}
            className="w-full p-4 bg-white border border-sage/20 rounded-2xl mb-4 focus:outline-none focus:border-sage resize-none h-32 text-sm"
            placeholder="What would you like us to pray for?"
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
              Post Anonymously
            </label>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || !newRequest.trim()}
              className="w-full sm:w-auto bg-sage text-white px-8 py-3 rounded-xl font-medium hover:bg-sage-dark transition-all disabled:opacity-50 shadow-lg shadow-sage/10"
            >
              {isSubmitting ? 'Submitting...' : 'Post Request'}
            </button>
          </div>
        </div>
      ) : (
        <div className="mb-8 p-8 mx-4 sm:mx-0 bg-sage-light/20 rounded-[2rem] border border-sage/10 text-center">
          <p className="text-ink/60">Please sign in to share a prayer request.</p>
        </div>
      )}

      <div className="grid gap-4 sm:gap-6 md:grid-cols-2 px-4 sm:px-0">
        {requests.map(request => (
          <motion.div 
            key={request.id} 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-6 sm:p-8 bg-white border border-sage/10 rounded-3xl shadow-sm hover:shadow-xl hover:shadow-sage/5 transition-all relative group"
          >
            <p className="serif text-lg sm:text-xl text-sage-dark mb-1 leading-relaxed">"{request.content}"</p>
            <div className="flex items-center gap-2 mb-6">
              <span className="text-[10px] text-ink/40 italic">
                — {request.isAnonymous ? 'Anonymous' : (request.authorName || 'User')}
              </span>
              {request.createdAt && (
                <span className="text-[10px] text-ink/20 font-medium">
                  • {new Date(request.createdAt).toLocaleString()}
                </span>
              )}
            </div>
            <div className="flex items-center justify-between border-t border-sage/10 pt-4">
              <span className="text-xs font-medium text-ink/40">
                {request.prayCount} {request.prayCount === 1 ? 'person is' : 'people are'} praying
              </span>
              <button
                onClick={() => handlePray(request.id)}
                className={cn(
                  "flex items-center gap-2 font-bold px-4 py-2 rounded-xl transition-all text-sm",
                  userPrayers.has(request.id) ? "bg-sage text-white" : "text-sage hover:bg-sage-light"
                )}
              >
                <Heart size={18} className={userPrayers.has(request.id) ? 'fill-white' : ''} />
                <span>Pray</span>
              </button>
              <button
                onClick={() => setTypingPrayerId(request.id)}
                className="flex items-center gap-2 font-bold px-4 py-2 rounded-xl text-sage hover:bg-sage-light transition-all text-sm"
                title="Type a Prayer"
              >
                <MessageSquare size={18} />
                <span>Type Prayer</span>
              </button>
              <button
                onClick={async () => {
                  const shareText = `Prayer Request: "${request.content}" — ${request.authorName}`;
                  try {
                    if (navigator.share) {
                      await navigator.share({
                        title: 'Prayer Request Share',
                        text: shareText,
                        url: window.location.href
                      });
                    } else {
                      await navigator.clipboard.writeText(shareText);
                      toast.success('Prayer request copied to clipboard!');
                    }
                  } catch (err) {
                    console.error('Share failed:', err);
                  }
                }}
                className="flex items-center gap-2 font-bold px-4 py-2 rounded-xl text-sage hover:bg-sage-light transition-all text-sm"
                title="Share Request"
              >
                <Share2 size={18} />
                <span>Share</span>
              </button>
            </div>
            {(isAdmin || (user && user.id === request.authorUid)) && (
              <button 
                onClick={() => handleDelete(request.id)}
                className="absolute top-6 right-6 p-2 text-ink/20 hover:text-destructive transition-colors"
                title="Delete Request"
              >
                <Trash2 size={18} />
              </button>
            )}
            <div className="mt-4">
              <button 
                onClick={() => fetchTypedPrayers(request.id)}
                className="text-xs text-sage hover:underline"
              >
                View prayers for this request
              </button>
            </div>
          </motion.div>
        ))}
        {requests.length === 0 && (
          <div className="col-span-full text-center py-12 text-ink/40 italic">
            No prayer requests yet. Be the first to share one.
          </div>
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
            <p className="text-ink/70 mb-8 leading-relaxed">Are you sure you want to delete this prayer request? This action cannot be undone.</p>
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

      {/* Type Prayer Modal */}
      {typingPrayerId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white p-8 rounded-[2.5rem] max-w-md w-full shadow-2xl"
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="serif text-2xl font-semibold text-sage-dark">Type a Prayer</h3>
              <button
                onClick={() => {
                  const req = requests.find(r => r.id === typingPrayerId);
                  if (req) handleGeneratePrayer(req.content);
                }}
                disabled={isGeneratingPrayer}
                className="text-xs font-bold text-sage hover:text-sage-dark transition-colors uppercase tracking-widest flex items-center gap-1 disabled:opacity-50"
              >
                {isGeneratingPrayer ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                AI Draft
              </button>
            </div>
            <textarea
              value={typedPrayer}
              onChange={(e) => setTypedPrayer(e.target.value)}
              className="w-full h-40 p-4 rounded-xl border border-sage/20 bg-cream/30 focus:bg-white focus:ring-2 focus:ring-sage/30 transition-all resize-none mb-6"
              placeholder="Write a short prayer for this request..."
              disabled={isTypingSubmitting}
            />
            <div className="flex gap-3">
              <button 
                onClick={() => setTypingPrayerId(null)}
                className="flex-1 px-6 py-3 rounded-xl border border-sage/20 font-medium hover:bg-sage-light transition-colors"
                disabled={isTypingSubmitting}
              >
                Cancel
              </button>
              <button 
                onClick={() => handleTypePrayer(typingPrayerId)}
                disabled={isTypingSubmitting || !typedPrayer.trim()}
                className="flex-1 bg-sage text-white px-6 py-3 rounded-xl font-medium hover:bg-sage-dark transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Send size={18} />
                {isTypingSubmitting ? 'Sharing...' : 'Share Prayer'}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* View Prayers Modal */}
      {viewingPrayersId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white p-8 rounded-[2.5rem] max-w-lg w-full shadow-2xl max-h-[80vh] flex flex-col"
          >
            <div className="flex justify-between items-center mb-6">
              <h3 className="serif text-2xl font-semibold text-sage-dark">Prayers</h3>
              <button onClick={() => setViewingPrayersId(null)} className="text-ink/40 hover:text-ink">Close</button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-4 pr-2">
              {typedPrayersList.length > 0 ? typedPrayersList.map(p => (
                <div key={p.id} className="p-4 bg-cream/30 rounded-2xl border border-sage/10">
                  <p className="text-ink/80 mb-2 italic">"{p.text}"</p>
                  <div className="flex justify-between items-center text-[10px] text-ink/40">
                    <span>— {p.authorName}</span>
                    <span>{new Date(p.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              )) : (
                <p className="text-center text-ink/40 italic py-8">No typed prayers yet.</p>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
