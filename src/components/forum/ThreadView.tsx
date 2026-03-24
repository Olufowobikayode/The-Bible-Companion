import { useParams, Link } from 'react-router-dom';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, deleteDoc, doc, getDoc } from 'firebase/firestore';
import { db, auth } from '../../firebase';
import { useEffect, useState } from 'react';
import { Trash2, ChevronLeft } from 'lucide-react';
import { motion } from 'motion/react';

interface Post {
  id: string;
  content: string;
  authorUid: string;
  authorName: string;
  isAnonymous: boolean;
}

export default function ThreadView() {
  const { forumId, threadId } = useParams<{ forumId: string, threadId: string }>();
  const [posts, setPosts] = useState<Post[]>([]);
  const [newPostContent, setNewPostContent] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    if (!forumId || !threadId) return;
    const q = query(collection(db, `forums/${forumId}/threads/${threadId}/posts`), orderBy('createdAt', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setPosts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Post)));
    });

    const checkAdmin = async () => {
      if (auth.currentUser) {
        if (auth.currentUser.email === 'kayodeolufowobi709@gmail.com') {
          setIsAdmin(true);
          return;
        }
        const userDoc = await getDoc(doc(db, 'user_profiles', auth.currentUser.uid));
        if (userDoc.exists() && userDoc.data().role === 'admin') {
          setIsAdmin(true);
        }
      }
    };
    checkAdmin();

    return () => unsubscribe();
  }, [forumId, threadId]);

  const handleDeletePost = async (id: string) => {
    setConfirmDeleteId(id);
  };

  const executeDeletePost = async () => {
    if (!confirmDeleteId) return;
    const id = confirmDeleteId;
    setConfirmDeleteId(null);
    
    try {
      await deleteDoc(doc(db, `forums/${forumId}/threads/${threadId}/posts`, id));
    } catch (error) {
      console.error("Error deleting post:", error);
      alert("Failed to delete post.");
    }
  };

  const handleCreatePost = async () => {
    if (!newPostContent || !auth.currentUser || !forumId || !threadId) return;
    
    setIsSubmitting(true);
    try {
      // 1. Moderate post
      const modResponse = await fetch('/api/ai/moderate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postContent: newPostContent })
      });
      
      if (!modResponse.ok) {
        console.warn("Moderation service failed, allowing post.");
      } else {
        const modData = await modResponse.json();
        if (modData.allowed === false) {
          alert(`Post rejected: ${modData.reason}`);
          setIsSubmitting(false);
          return;
        }
      }
      
      // 2. Add user post
      await addDoc(collection(db, `forums/${forumId}/threads/${threadId}/posts`), {
        threadId,
        content: newPostContent,
        authorUid: auth.currentUser.uid,
        authorName: auth.currentUser.displayName || 'Anonymous',
        isAnonymous,
        createdAt: serverTimestamp()
      });
      
      setNewPostContent('');
      setIsAnonymous(false);

      // 3. Trigger AI response
      try {
        const aiResponse = await fetch('/api/ai/respond', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            forumId, 
            threadId, 
            postContent: newPostContent,
            context: "A Christian community forum discussion."
          })
        });
        
        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          if (aiData.response) {
            await addDoc(collection(db, `forums/${forumId}/threads/${threadId}/posts`), {
              threadId,
              content: aiData.response,
              authorUid: 'AI_ASSISTANT',
              authorName: 'AI Assistant',
              isAnonymous: false,
              createdAt: serverTimestamp()
            });
          }
        }
      } catch (error) {
        console.error("AI response failed:", error);
      }
    } catch (error) {
      console.error("Error creating post:", error);
      alert("Failed to create post. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-0 sm:px-4 py-6 sm:py-12">
      <div className="mb-8 px-4 sm:px-0">
        <Link to={`/forum/${forumId}`} className="text-sage hover:text-sage-dark mb-4 inline-flex items-center gap-2 text-sm font-medium transition-colors">
          <ChevronLeft size={18} />
          Back to Threads
        </Link>
        <h1 className="serif text-3xl sm:text-4xl font-semibold text-sage-dark">Discussion</h1>
      </div>
      
      <div className="grid gap-4 mb-8 px-4 sm:px-0">
        {posts.map(post => (
          <motion.div 
            key={post.id} 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`p-6 sm:p-8 border rounded-3xl relative group ${post.authorUid === 'AI_ASSISTANT' ? 'bg-sage-light/30 border-sage-light' : 'bg-white border-sage/10'}`}
          >
            <p className="text-ink/80 whitespace-pre-wrap leading-relaxed text-sm sm:text-base">{post.content}</p>
            <div className="flex items-center gap-3 mt-6">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${post.authorUid === 'AI_ASSISTANT' ? 'bg-sage text-white' : 'bg-sage-light text-sage'}`}>
                {post.authorUid === 'AI_ASSISTANT' ? 'AI' : (post.authorName?.[0] || 'U')}
              </div>
              <span className="text-xs font-medium text-ink/40">
                {post.authorUid === 'AI_ASSISTANT' ? 'AI Assistant' : (post.isAnonymous ? 'Anonymous' : (post.authorName || 'User'))}
              </span>
            </div>
            {(isAdmin || (auth.currentUser && auth.currentUser.uid === post.authorUid)) && post.authorUid !== 'AI_ASSISTANT' && (
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
      
      {auth.currentUser ? (
        <div className="p-6 sm:p-8 mx-4 sm:mx-0 bg-sage-light/20 rounded-[2rem] border border-sage/10">
          <h2 className="serif text-xl sm:text-2xl font-semibold text-sage-dark mb-4">Reply to Discussion</h2>
          <textarea 
            value={newPostContent} 
            onChange={(e) => setNewPostContent(e.target.value)}
            className="w-full p-4 bg-white border border-sage/20 rounded-2xl resize-none h-32 focus:outline-none focus:border-sage mb-4 text-sm"
            placeholder="Write a reply..."
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
