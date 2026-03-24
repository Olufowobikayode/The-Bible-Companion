import { useState, useEffect } from 'react';
import { collection, addDoc, serverTimestamp, query, orderBy, onSnapshot, doc, updateDoc, increment, setDoc, getDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { db, auth } from '../../firebase';
import { Trash2, Heart, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

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

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (u) => {
      setIsAuthLoading(false);
      if (u) {
        if (u.email === 'kayodeolufowobi709@gmail.com') {
          setIsAdmin(true);
        } else {
          getDoc(doc(db, 'user_profiles', u.uid)).then(userDoc => {
            if (userDoc.exists() && userDoc.data().role === 'admin') {
              setIsAdmin(true);
            }
          });
        }
      } else {
        setIsAdmin(false);
      }
    });

    const q = query(collection(db, 'prayer_requests'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setRequests(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PrayerRequest)));
    });

    return () => {
      unsubscribeAuth();
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!auth.currentUser) {
      setUserPrayers(new Set());
      return;
    }

    // This is a bit tricky to track across all requests efficiently without a subcollection query
    // For now, we'll rely on the handlePray function to check if the user has already prayed
    // or we could fetch the user's prayers if we had a top-level collection for it.
    // Given the rules, we'll just check the specific prayer doc when the user clicks.
  }, [auth.currentUser]);

  const handleSubmit = async () => {
    if (!newRequest.trim() || !auth.currentUser) return;
    setIsSubmitting(true);

    try {
      // Basic moderation using AI
      try {
        const modResponse = await fetch('/api/ai/moderate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ postContent: newRequest })
        });
        
        if (modResponse.ok) {
          const modData = await modResponse.json();
          if (modData.allowed === false) {
            // Use a more subtle way to show rejection if possible, but for now we'll just return
            // and maybe set an error state
            console.warn(`Prayer request rejected: ${modData.reason}`);
            setIsSubmitting(false);
            return;
          }
        }
      } catch (e) {
        console.warn("Moderation service failed, allowing post.");
      }

      await addDoc(collection(db, 'prayer_requests'), {
        content: newRequest,
        prayCount: 0,
        authorUid: auth.currentUser.uid,
        authorName: auth.currentUser.displayName || 'Anonymous',
        isAnonymous,
        createdAt: serverTimestamp()
      });
      
      setNewRequest('');
      setIsAnonymous(false);
    } catch (error) {
      console.error("Error submitting prayer request:", error);
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
      await deleteDoc(doc(db, 'prayer_requests', id));
    } catch (error) {
      console.error("Error deleting prayer request:", error);
      alert("Failed to delete prayer request.");
    }
  };

  const handlePray = async (id: string) => {
    if (!auth.currentUser) {
      alert("Please sign in to pray for others.");
      return;
    }

    const prayerRef = doc(db, `prayer_requests/${id}/prayers`, auth.currentUser.uid);
    const prayerDoc = await getDoc(prayerRef);

    if (prayerDoc.exists()) {
      alert("You have already prayed for this request.");
      return;
    }

    try {
      const batch = writeBatch(db);
      const requestRef = doc(db, 'prayer_requests', id);
      
      batch.set(prayerRef, {
        uid: auth.currentUser.uid,
        createdAt: serverTimestamp()
      });
      
      batch.update(requestRef, {
        prayCount: increment(1)
      });

      await batch.commit();
      setUserPrayers(prev => new Set(prev).add(id));
    } catch (error) {
      console.error("Error praying for request:", error);
      alert("Failed to register your prayer. Please try again.");
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
      ) : auth.currentUser ? (
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
            <p className="serif text-lg sm:text-xl text-sage-dark mb-3 leading-relaxed">"{request.content}"</p>
            <p className="text-xs text-ink/40 mb-6 italic">
              — {request.isAnonymous ? 'Anonymous' : (request.authorName || 'Unknown')}
            </p>
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
            </div>
            {(isAdmin || (auth.currentUser && auth.currentUser.uid === request.authorUid)) && (
              <button 
                onClick={() => handleDelete(request.id)}
                className="absolute top-6 right-6 p-2 text-ink/20 hover:text-destructive transition-colors"
                title="Delete Request"
              >
                <Trash2 size={18} />
              </button>
            )}
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
    </div>
  );
}
