import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { api } from '../lib/api';
import { motion } from 'motion/react';
import { toast } from 'sonner';
import { UserPlus, UserMinus, Grid, Heart, MessageCircle, MapPin, Link as LinkIcon, Calendar } from 'lucide-react';

interface UserProfile {
  id: string;
  uid: string;
  username: string;
  displayName: string;
  photoURL?: string;
  bio?: string;
  location?: string;
  website?: string;
  joinedAt?: string;
  followers?: string[];
  following?: string[];
}

export default function Profile() {
  const { username } = useParams<{ username: string }>();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);
  const [activeTab, setActiveTab] = useState<'posts' | 'prayers' | 'testimonies'>('posts');
  const [isMessageModalOpen, setIsMessageModalOpen] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const currentUid = user?.id;
  const isOwnProfile = profile && currentUid === profile.uid;

  useEffect(() => {
    const fetchProfile = async () => {
      if (!username) return;
      try {
        const data = await api.get(`/api/users/by-username/${username}`);
        setProfile(data);
        if (currentUid && data.followers?.includes(currentUid)) {
          setIsFollowing(true);
        }
      } catch (error) {
        console.error("Error fetching profile:", error);
        toast.error("User not found");
        navigate('/');
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [username, currentUid, navigate]);

  const handleFollow = async () => {
    if (!currentUid || !profile) {
      toast.error("Please sign in to follow users.");
      return;
    }

    try {
      if (isFollowing) {
        await api.post(`/api/users/${profile.uid}/unfollow`, {});
        setIsFollowing(false);
        setProfile(prev => prev ? { ...prev, followers: prev.followers?.filter(id => id !== currentUid) } : null);
        toast.success(`Unfollowed ${profile.displayName}`);
      } else {
        await api.post(`/api/users/${profile.uid}/follow`, {});
        setIsFollowing(true);
        setProfile(prev => prev ? { ...prev, followers: [...(prev.followers || []), currentUid] } : null);
        toast.success(`Following ${profile.displayName}`);
      }
    } catch (error) {
      console.error("Error updating follow status:", error);
      toast.error("Failed to update follow status");
    }
  };

  const handleSendMessage = async () => {
    if (!messageText.trim() || !currentUid || !profile) return;
    
    setIsSendingMessage(true);
    try {
      const { moderateContent } = await import('../lib/moderation');
      const moderationResult = await moderateContent(messageText);
      
      if (!moderationResult.isApproved) {
        toast.error(`Message rejected: ${moderationResult.reason}`);
        setIsSendingMessage(false);
        return;
      }

      await api.post('/api/messages', {
        text: messageText,
        recipientId: profile.uid,
      });

      toast.success(`Encouragement sent to ${profile.displayName}!`);
      setMessageText('');
      setIsMessageModalOpen(false);
    } catch (error) {
      console.error("Error sending message:", error);
      toast.error("Failed to send message.");
    } finally {
      setIsSendingMessage(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center min-h-[50vh]"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sage"></div></div>;
  }

  if (!profile) return null;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 sm:py-12">
      {/* Profile Header */}
      <div className="flex flex-col md:flex-row items-center md:items-start gap-8 mb-12">
        {/* Avatar */}
        <div className="w-32 h-32 md:w-40 md:h-40 rounded-full bg-sage-light flex-shrink-0 overflow-hidden border-4 border-white shadow-xl">
          {profile.photoURL ? (
            <img src={profile.photoURL} alt={profile.displayName} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-sage text-5xl font-bold">
              {profile.displayName?.[0]?.toUpperCase() || 'U'}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 text-center md:text-left">
          <div className="flex flex-col md:flex-row md:items-center gap-4 mb-4">
            <h1 className="text-2xl md:text-3xl font-bold text-sage-dark">{profile.displayName}</h1>
            
            {!isOwnProfile && (
              <div className="flex gap-2 justify-center md:justify-start">
                <button
                  onClick={handleFollow}
                  className={`px-6 py-2 rounded-xl font-medium transition-all ${
                    isFollowing 
                      ? 'bg-sage-light text-sage-dark hover:bg-sage-light/80' 
                      : 'bg-sage text-white hover:bg-sage-dark shadow-md'
                  }`}
                >
                  {isFollowing ? (
                    <span className="flex items-center gap-2"><UserMinus size={18} /> Unfollow</span>
                  ) : (
                    <span className="flex items-center gap-2"><UserPlus size={18} /> Follow</span>
                  )}
                </button>
                <button
                  onClick={() => setIsMessageModalOpen(true)}
                  className="px-6 py-2 rounded-xl font-medium bg-cream border border-sage/20 text-sage-dark hover:bg-white transition-all shadow-sm flex items-center gap-2"
                >
                  <MessageCircle size={18} /> Send a Word
                </button>
              </div>
            )}
            {isOwnProfile && (
              <button className="px-6 py-2 rounded-xl font-medium bg-sage-light text-sage-dark hover:bg-sage-light/80 transition-all">
                Edit Profile
              </button>
            )}
          </div>

          {/* Stats */}
          <div className="flex justify-center md:justify-start gap-6 mb-6">
            <div className="text-center md:text-left">
              <span className="font-bold text-sage-dark text-lg">0</span>
              <span className="text-ink/60 text-sm ml-1">Posts</span>
            </div>
            <div className="text-center md:text-left cursor-pointer hover:opacity-80">
              <span className="font-bold text-sage-dark text-lg">{profile.followers?.length || 0}</span>
              <span className="text-ink/60 text-sm ml-1">Followers</span>
            </div>
            <div className="text-center md:text-left cursor-pointer hover:opacity-80">
              <span className="font-bold text-sage-dark text-lg">{profile.following?.length || 0}</span>
              <span className="text-ink/60 text-sm ml-1">Following</span>
            </div>
          </div>

          {/* Bio */}
          <div className="space-y-2">
            {profile.bio && <p className="text-ink/80 whitespace-pre-wrap">{profile.bio}</p>}
            
            <div className="flex flex-wrap justify-center md:justify-start gap-4 text-sm text-ink/60 mt-4">
              {profile.location && (
                <div className="flex items-center gap-1"><MapPin size={16} /> {profile.location}</div>
              )}
              {profile.website && (
                <a href={profile.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-sage hover:underline">
                  <LinkIcon size={16} /> {profile.website.replace(/^https?:\/\//, '')}
                </a>
              )}
              {profile.joinedAt && (
                <div className="flex items-center gap-1"><Calendar size={16} /> Joined {new Date(profile.joinedAt).toLocaleDateString()}</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Message Modal */}
      {isMessageModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl"
          >
            <h2 className="serif text-2xl font-semibold text-sage-dark mb-4">Send a Word to {profile.displayName}</h2>
            <textarea
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              placeholder="Write an encouraging word, scripture, or prayer..."
              className="w-full h-40 p-4 rounded-xl border border-sage/20 bg-cream/30 focus:bg-white focus:ring-2 focus:ring-sage/30 transition-all resize-none mb-6"
              disabled={isSendingMessage}
            />
            <div className="flex gap-3">
              <button
                onClick={() => setIsMessageModalOpen(false)}
                className="flex-1 px-6 py-3 rounded-xl font-medium text-ink/60 hover:bg-cream transition-colors"
                disabled={isSendingMessage}
              >
                Cancel
              </button>
              <button
                onClick={handleSendMessage}
                disabled={isSendingMessage || !messageText.trim()}
                className="flex-1 bg-sage text-white px-6 py-3 rounded-xl font-medium hover:bg-sage-dark transition-colors disabled:opacity-50"
              >
                {isSendingMessage ? 'Sending...' : 'Send Word'}
              </button>
            </div>
            <p className="text-[10px] text-ink/40 text-center mt-4">
              Private messages are moderated by AI to ensure safety and encouragement.
            </p>
          </motion.div>
        </div>
      )}

      {/* Tabs */}
      <div className="border-t border-sage/10 mb-8">
        <div className="flex justify-center gap-12">
          <button 
            onClick={() => setActiveTab('posts')}
            className={`flex items-center gap-2 py-4 text-sm font-medium uppercase tracking-wider border-t-2 transition-colors ${
              activeTab === 'posts' ? 'border-sage text-sage-dark' : 'border-transparent text-ink/40 hover:text-ink/60'
            }`}
          >
            <Grid size={16} /> Posts
          </button>
          <button 
            onClick={() => setActiveTab('prayers')}
            className={`flex items-center gap-2 py-4 text-sm font-medium uppercase tracking-wider border-t-2 transition-colors ${
              activeTab === 'prayers' ? 'border-sage text-sage-dark' : 'border-transparent text-ink/40 hover:text-ink/60'
            }`}
          >
            <Heart size={16} /> Prayers
          </button>
          <button 
            onClick={() => setActiveTab('testimonies')}
            className={`flex items-center gap-2 py-4 text-sm font-medium uppercase tracking-wider border-t-2 transition-colors ${
              activeTab === 'testimonies' ? 'border-sage text-sage-dark' : 'border-transparent text-ink/40 hover:text-ink/60'
            }`}
          >
            <MessageCircle size={16} /> Testimonies
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="min-h-[300px] flex items-center justify-center text-ink/40 italic">
        {activeTab === 'posts' && "No posts yet."}
        {activeTab === 'prayers' && "No prayers shared yet."}
        {activeTab === 'testimonies' && "No testimonies shared yet."}
      </div>
    </div>
  );
}
