import { useParams, Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { api } from '../../lib/api';
import { useEffect, useState } from 'react';
import { Trash2, ChevronLeft, Heart, MessageCircle, Sparkles, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';
import { toast } from 'sonner';
import { moderateContent } from '../../lib/moderation';
import { summarizeForumThread } from '../../lib/gemini';
import ReactMarkdown from 'react-markdown';

interface Post {
  id: string;
  content: string;
  authorUid: string;
  authorName: string;
  isAnonymous: boolean;
  likes?: number;
  createdAt?: any;
  replyTo?: {
    id: string;
    authorName: string;
    content: string;
  };
}

export default function ThreadView() {
  const { forumId, threadId } = useParams<{ forumId: string, threadId: string }>();
  const [posts, setPosts] = useState<Post[]>([]);
  const [newPostContent, setNewPostContent] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<Post | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [isSummarizing, setIsSummarizing] = useState(false);

  const handleSummarize = async () => {
    if (posts.length === 0) return;
    setIsSummarizing(true);
    try {
      const formattedPosts = posts.map(p => ({
        author: p.isAnonymous ? 'Anonymous' : p.authorName,
        content: p.content
      }));
      const result = await summarizeForumThread(formattedPosts);
      setSummary(result);
    } catch (error) {
      console.error("Error summarizing thread:", error);
      toast.error("Failed to summarize thread.");
    } finally {
      setIsSummarizing(false);
    }
  };

  const fetchPosts = async () => {
    if (!forumId || !threadId) return;
    try {
      const data = await api.get(`/api/forums/${forumId}/threads/${threadId}/posts`);
      setPosts(data);
    } catch (error) {
      console.error("Error fetching posts:", error);
    }
  };

  useEffect(() => {
    fetchPosts();
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
  }, [forumId, threadId]);

  const handleDeletePost = async (id: string) => {
    setConfirmDeleteId(id);
  };

  const executeDeletePost = async () => {
    if (!confirmDeleteId || !forumId || !threadId) return;
    const id = confirmDeleteId;
    setConfirmDeleteId(null);
    
    try {
      await api.delete(`/api/forums/${forumId}/threads/${threadId}/posts/${id}`);
      setPosts(prev => prev.filter(p => p.id !== id));
      toast.success("Post deleted");
    } catch (error) {
      console.error("Error deleting post:", error);
      toast.error("Failed to delete post.");
    }
  };

  const [likedPosts, setLikedPosts] = useState<Set<string>>(new Set());

  const handleLike = async (postId: string) => {
    if (!user) {
      toast.error("Please sign in to like posts.");
      return;
    }
    if (likedPosts.has(postId)) return;

    try {
      await api.post(`/api/forums/${forumId}/threads/${threadId}/posts/${postId}/like`, {});
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, likes: (p.likes || 0) + 1 } : p));
      setLikedPosts(prev => new Set(prev).add(postId));
    } catch (error: any) {
      if (error.message && error.message.includes("Already liked")) {
        setLikedPosts(prev => new Set(prev).add(postId));
        return;
      }
      console.error("Error liking post:", error);
      toast.error("Failed to like post.");
    }
  };

  const handleCreatePost = async () => {
    if (!newPostContent || !user || !forumId || !threadId) return;
    
    setIsSubmitting(true);
    try {
      const moderationResult = await moderateContent(newPostContent);
      if (!moderationResult.isApproved) {
        toast.error(`Post rejected: ${moderationResult.reason}`);
        setIsSubmitting(false);
        return;
      }
      
      const postData: any = {
        content: newPostContent,
        authorUid: user.id,
        authorName: isAnonymous ? 'Anonymous' : (user.user_metadata?.full_name || user.email?.split('@')[0] || 'User'),
        isAnonymous,
      };

      if (replyingTo) {
        postData.replyTo = {
          id: replyingTo.id,
          authorName: replyingTo.authorName,
          content: replyingTo.content.substring(0, 100) + (replyingTo.content.length > 100 ? '...' : '')
        };
      }

      const newPost = await api.post(`/api/forums/${forumId}/threads/${threadId}/posts`, postData);
      setPosts(prev => [...prev, newPost]);
      
      setNewPostContent('');
      setIsAnonymous(false);
      setReplyingTo(null);
    } catch (error) {
      console.error("Error creating post:", error);
      toast.error("Failed to create post. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <div className="mb-6 flex items-center gap-4">
        <Link to={`/forum/${forumId}`} className="text-sage hover:text-sage-dark p-2 rounded-full hover:bg-sage/10 transition-colors">
          <ChevronLeft size={24} />
        </Link>
        <h1 className="serif text-2xl font-semibold text-sage-dark">Discussion</h1>
      </div>

      {summary && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 bg-sage-light/10 p-4 rounded-2xl border border-sage/10"
        >
          <h3 className="text-sm font-semibold text-sage-dark mb-2 flex items-center gap-2">
            <Sparkles className="w-4 h-4" />
            AI Summary
          </h3>
          <div className="prose prose-sage prose-sm max-w-none text-ink/80">
            <ReactMarkdown>{summary}</ReactMarkdown>
          </div>
        </motion.div>
      )}
      
      <div className="grid gap-4 mb-8 px-4 sm:px-0">
        {posts.filter(post => post.id).map(post => (
          <motion.div 
            key={post.id} 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`p-6 sm:p-8 border rounded-3xl relative group ${post.authorUid === 'AI_ASSISTANT' ? 'bg-sage-light/30 border-sage-light' : 'bg-white border-sage/10'}`}
          >
            {post.replyTo && (
              <div className="mb-4 p-3 bg-sage-light/10 border-l-4 border-sage rounded-r-xl text-xs">
                <p className="font-bold text-sage mb-1">Replying to {post.replyTo.authorName}</p>
                <p className="text-ink/60 italic">"{post.replyTo.content}"</p>
              </div>
            )}
            <p className="text-ink/80 whitespace-pre-wrap leading-relaxed text-sm sm:text-base">{post.content}</p>
            <div className="flex items-center justify-between mt-6">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${post.authorUid === 'AI_ASSISTANT' ? 'bg-sage text-white' : 'bg-sage-light text-sage'}`}>
                  {post.authorUid === 'AI_ASSISTANT' ? 'AI' : (post.authorName?.[0] || 'U')}
                </div>
                <span className="text-xs font-medium text-ink/40">
                  {post.authorUid === 'AI_ASSISTANT' ? 'AI Assistant' : (post.isAnonymous ? 'Anonymous' : (post.authorName || 'User'))}
                </span>
                {post.createdAt && (
                  <span className="text-[10px] text-ink/20 font-medium">
                    • {post.createdAt?.toDate?.() ? post.createdAt.toDate().toLocaleString() : new Date(post.createdAt).toLocaleString()}
                  </span>
                )}
              </div>
              
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => handleLike(post.id)}
                  className="flex items-center gap-1 text-ink/40 hover:text-sage transition-colors text-sm"
                >
                  <Heart className="w-4 h-4" />
                  <span>{post.likes || 0}</span>
                </button>
                <button 
                  onClick={() => {
                    setReplyingTo(post);
                    const textarea = document.getElementById('reply-textarea');
                    textarea?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  }}
                  className="flex items-center gap-1 text-ink/40 hover:text-sage transition-colors text-sm"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>Reply</span>
                </button>
              </div>
            </div>
            {(isAdmin || (user && user.id === post.authorUid)) && post.authorUid !== 'AI_ASSISTANT' && (
              <button 
                onClick={() => handleDeletePost(post.id)}
                className="absolute top-6 right-6 p-2 text-ink/20 hover:text-destructive transition-colors"
                title="Delete Post"
              >
                <Trash2 size={16} />
              </button>
            )}
          </motion.div>
        ))}
        {posts.length === 0 && (
          <div className="text-center py-12 text-ink/40 italic">No posts yet. Be the first to reply!</div>
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
            <p className="text-ink/70 mb-8 leading-relaxed">Are you sure you want to delete this post? This action cannot be undone.</p>
            <div className="flex gap-3">
              <button 
                onClick={() => setConfirmDeleteId(null)}
                className="flex-1 px-6 py-3 rounded-xl border border-sage/20 font-medium hover:bg-sage-light transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={executeDeletePost}
                className="flex-1 px-6 py-3 bg-destructive text-white rounded-xl font-medium hover:bg-destructive/90 transition-colors"
              >
                Delete
              </button>
            </div>
          </motion.div>
        </div>
      )}
      
      {user ? (
        <div className="p-6 sm:p-8 mx-4 sm:mx-0 bg-sage-light/20 rounded-[2rem] border border-sage/10">
          <div className="flex justify-between items-center mb-4">
            <h2 className="serif text-xl sm:text-2xl font-semibold text-sage-dark">Reply to Discussion</h2>
            {replyingTo && (
              <button 
                onClick={() => setReplyingTo(null)}
                className="text-xs font-bold text-red-500 uppercase tracking-widest hover:underline"
              >
                Cancel Reply
              </button>
            )}
          </div>
          
          {replyingTo && (
            <div className="mb-4 p-4 bg-white border-l-4 border-sage rounded-r-2xl text-sm">
              <p className="font-bold text-sage mb-1">Replying to {replyingTo.authorName}</p>
              <p className="text-ink/60 italic truncate">"{replyingTo.content}"</p>
            </div>
          )}

          <textarea 
            id="reply-textarea"
            value={newPostContent} 
            onChange={(e) => setNewPostContent(e.target.value)}
            className="w-full p-4 bg-white border border-sage/20 rounded-2xl resize-none h-32 focus:outline-none focus:border-sage mb-4 text-sm"
            placeholder={replyingTo ? `Replying to ${replyingTo.authorName}...` : "Write a reply..."}
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
              onClick={handleCreatePost} 
              disabled={isSubmitting || !newPostContent.trim()}
              className="w-full sm:w-auto bg-sage text-white px-8 py-3 rounded-xl font-medium hover:bg-sage-dark transition-all disabled:opacity-50 shadow-lg shadow-sage/10"
            >
              {isSubmitting ? 'Posting...' : 'Post Reply'}
            </button>
          </div>
        </div>
      ) : (
        <div className="mb-8 p-8 mx-4 sm:mx-0 bg-sage-light/20 rounded-[2rem] border border-sage/10 text-center">
          <p className="text-ink/60">Please sign in to reply to this thread.</p>
        </div>
      )}
    </div>
  );
}
