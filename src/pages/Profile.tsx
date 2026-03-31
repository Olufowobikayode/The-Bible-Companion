import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { api } from '../lib/api';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { 
  UserPlus, UserMinus, Grid, Heart, MessageCircle, MapPin, 
  Link as LinkIcon, Calendar, Bookmark, Activity, BookOpen, 
  Award, TrendingUp, Sun, PenLine, Settings, Loader2
} from 'lucide-react';

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
  followersCount?: number;
  followingCount?: number;
}

export default function Profile() {
  const { username } = useParams<{ username: string }>();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);
  const [activeTab, setActiveTab] = useState<'posts' | 'prayers' | 'testimonies' | 'dashboard'>('posts');
  const [user, setUser] = useState<any>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editData, setEditData] = useState({
    displayName: '',
    bio: '',
    location: '',
    website: '',
    photoURL: ''
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Dashboard state
  const [stats, setStats] = useState<any>(null);
  const [activities, setActivities] = useState<any[]>([]);
  const [milestones, setMilestones] = useState<any[]>([]);

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

  const [userPosts, setUserPosts] = useState<any[]>([]);
  const [userPrayers, setUserPrayers] = useState<any[]>([]);
  const [userTestimonies, setUserTestimonies] = useState<any[]>([]);
  const [loadingContent, setLoadingContent] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      setLoading(true);
      setIsFollowing(false);
      try {
        let data;
        if (username) {
          data = await api.get(`/api/users/by-username/${username}`);
        } else {
          data = await api.get('/api/users/me');
          if (!data.uid) {
            toast.error("Profile not found. Please complete your registration.");
            navigate('/');
            return;
          }
        }
        
        setProfile(data);
        setEditData({
          displayName: data.displayName || '',
          bio: data.bio || '',
          location: data.location || '',
          website: data.website || '',
          photoURL: data.photoURL || ''
        });

        if (data.uid) {
          fetchUserContent(data.uid);
        }

        if (currentUid && data.uid !== currentUid) {
          try {
            const followData = await api.get(`/api/users/${data.uid}/is-following`);
            setIsFollowing(followData.isFollowing);
          } catch (e) {
            console.error("Error checking follow status:", e);
          }
        } else if (currentUid && data.uid === currentUid) {
          // Fetch dashboard data if it's own profile
          const [dashboardStats, milestoneData, activityData] = await Promise.all([
            api.get('/api/dashboard/stats'),
            api.get('/api/milestones'),
            api.get('/api/user/activity')
          ]);
          setStats(dashboardStats);
          setMilestones(milestoneData);
          setActivities(activityData);
          setActiveTab('dashboard');
        }
      } catch (error: any) {
        if (error.message && error.message.includes('404')) {
          toast.error("User not found");
          navigate('/');
        } else {
          console.error("Error fetching profile:", error);
          toast.error("Failed to fetch profile");
          navigate('/');
        }
      } finally {
        setLoading(false);
      }
    };

    const fetchUserContent = async (uid: string) => {
      setLoadingContent(true);
      try {
        const [posts, prayers, testimonies] = await Promise.all([
          api.get(`/api/forum-posts/user/${uid}`),
          api.get(`/api/prayer-requests/user/${uid}`),
          api.get(`/api/testimonies/user/${uid}`)
        ]);
        setUserPosts(posts);
        setUserPrayers(prayers);
        setUserTestimonies(testimonies);
      } catch (error) {
        console.error("Error fetching user content:", error);
      } finally {
        setLoadingContent(false);
      }
    };

    fetchProfile();
  }, [username, currentUid, navigate]);

  const isOwnProfile = profile && currentUid === profile.uid;

  const handleSaveProfile = async () => {
    setIsSaving(true);
    try {
      const updated = await api.put('/api/users/profile', editData);
      setProfile(updated);
      setIsEditModalOpen(false);
      toast.success("Profile updated successfully!");
    } catch (error) {
      console.error("Error saving profile:", error);
      toast.error("Failed to update profile.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    try {
      await api.delete('/api/users/me');
      await supabase.auth.signOut();
      toast.success("Account deleted successfully.");
      navigate('/');
    } catch (error) {
      console.error("Error deleting account:", error);
      toast.error("Failed to delete account.");
      setIsDeleting(false);
      setIsDeleteModalOpen(false);
    }
  };

  const handleFollow = async () => {
    if (!currentUid || !profile) {
      toast.error("Please sign in to follow users.");
      return;
    }

    try {
      if (isFollowing) {
        await api.post(`/api/unfollow`, { targetId: profile.uid });
        setIsFollowing(false);
        setProfile(prev => prev ? { ...prev, followersCount: Math.max(0, (prev.followersCount || 0) - 1) } : null);
        toast.success(`Unfollowed ${profile.displayName}`);
      } else {
        await api.post(`/api/follow`, { targetId: profile.uid });
        setIsFollowing(true);
        setProfile(prev => prev ? { ...prev, followersCount: (prev.followersCount || 0) + 1 } : null);
        toast.success(`Following ${profile.displayName}`);
      }
    } catch (error) {
      console.error("Error updating follow status:", error);
      toast.error("Failed to update follow status");
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center min-h-[50vh]"><Loader2 className="w-8 h-8 animate-spin text-sage" /></div>;
  }

  if (!profile) return null;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 sm:py-12">
      {/* Profile Header */}
      <div className="bg-white rounded-[3rem] p-8 sm:p-12 border border-sage/10 shadow-sm mb-12 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-sage/5 rounded-full -mr-32 -mt-32 blur-3xl" />
        
        <div className="flex flex-col md:flex-row items-center md:items-start gap-10 relative z-10">
          {/* Avatar */}
          <div className="w-32 h-32 md:w-44 md:h-44 rounded-full bg-sage-light flex-shrink-0 overflow-hidden border-4 border-white shadow-2xl">
            {profile.photoURL ? (
              <img src={profile.photoURL} alt={profile.displayName} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-sage text-6xl font-bold">
                {profile.displayName?.[0]?.toUpperCase() || 'U'}
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 text-center md:text-left">
            <div className="flex flex-col md:flex-row md:items-center gap-6 mb-6">
              <div>
                <h1 className="text-3xl md:text-4xl font-bold text-sage-dark mb-1">{profile.displayName}</h1>
                <p className="text-ink/40 font-medium">@{profile.username}</p>
              </div>
              
              <div className="flex gap-3 justify-center md:justify-start">
                {!isOwnProfile ? (
                  <>
                    <button
                      onClick={handleFollow}
                      className={`px-8 py-3 rounded-2xl font-bold transition-all ${
                        isFollowing 
                          ? 'bg-sage-light text-sage-dark hover:bg-sage-light/80' 
                          : 'bg-sage text-white hover:bg-sage-dark shadow-lg shadow-sage/20'
                      }`}
                    >
                      {isFollowing ? (
                        <span className="flex items-center gap-2"><UserMinus size={20} /> Unfollow</span>
                      ) : (
                        <span className="flex items-center gap-2"><UserPlus size={20} /> Follow</span>
                      )}
                    </button>
                    <Link
                      to="/messages"
                      state={{ userId: profile.uid }}
                      className="px-8 py-3 rounded-2xl font-bold bg-cream border border-sage/20 text-sage-dark hover:bg-white transition-all shadow-sm flex items-center gap-2"
                    >
                      <MessageCircle size={20} /> Message
                    </Link>
                  </>
                ) : (
                  <>
                    <button 
                      onClick={() => setIsEditModalOpen(true)}
                      className="px-8 py-3 rounded-2xl font-bold bg-sage-light text-sage-dark hover:bg-sage-light/80 transition-all flex items-center gap-2"
                    >
                      <Settings size={20} /> Edit Profile
                    </button>
                    <Link
                      to="/bookmarks"
                      className="px-8 py-3 rounded-2xl font-bold bg-cream border border-sage/20 text-sage-dark hover:bg-white transition-all shadow-sm flex items-center gap-2"
                    >
                      <Bookmark size={20} /> Bookmarks
                    </Link>
                  </>
                )}
              </div>
            </div>

            {/* Stats */}
            <div className="flex justify-center md:justify-start gap-10 mb-8">
              <button onClick={() => setActiveTab('posts')} className="text-center md:text-left hover:opacity-80 transition-opacity">
                <p className="text-2xl font-bold text-sage-dark">{stats?.posts || 0}</p>
                <p className="text-[10px] font-bold text-ink/40 uppercase tracking-widest">Posts</p>
              </button>
              <Link to={`/friends?tab=followers&uid=${profile.uid}`} className="text-center md:text-left hover:opacity-80 transition-opacity">
                <p className="text-2xl font-bold text-sage-dark">{profile.followersCount || 0}</p>
                <p className="text-[10px] font-bold text-ink/40 uppercase tracking-widest">Followers</p>
              </Link>
              <Link to={`/friends?tab=following&uid=${profile.uid}`} className="text-center md:text-left hover:opacity-80 transition-opacity">
                <p className="text-2xl font-bold text-sage-dark">{profile.followingCount || 0}</p>
                <p className="text-[10px] font-bold text-ink/40 uppercase tracking-widest">Following</p>
              </Link>
            </div>

            {/* Bio */}
            <div className="space-y-4">
              {profile.bio && <p className="text-ink/70 text-lg leading-relaxed max-w-2xl">{profile.bio}</p>}
              
              <div className="flex flex-wrap justify-center md:justify-start gap-6 text-sm text-ink/40">
                {profile.location && (
                  <div className="flex items-center gap-2"><MapPin size={18} className="text-sage" /> {profile.location}</div>
                )}
                {profile.website && (
                  <a href={profile.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sage hover:underline font-medium">
                    <LinkIcon size={18} /> {profile.website.replace(/^https?:\/\//, '')}
                  </a>
                )}
                {profile.joinedAt && (
                  <div className="flex items-center gap-2"><Calendar size={18} className="text-sage" /> Joined {new Date(profile.joinedAt).toLocaleDateString()}</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex justify-center gap-8 sm:gap-16 mb-12 border-b border-sage/10">
        {[
          { id: 'dashboard', label: 'Dashboard', icon: Activity, show: isOwnProfile },
          { id: 'posts', label: 'Posts', icon: Grid, show: true },
          { id: 'prayers', label: 'Prayers', icon: Heart, show: true },
          { id: 'testimonies', label: 'Testimonies', icon: MessageCircle, show: true },
        ].filter(t => t.show).map(tab => (
          <button 
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 py-4 text-xs font-bold uppercase tracking-widest border-b-2 transition-all ${
              activeTab === tab.id ? 'border-sage text-sage-dark' : 'border-transparent text-ink/40 hover:text-ink/60'
            }`}
          >
            <tab.icon size={16} /> {tab.label}
          </button>
        ))}
      </div>

      {/* Content Area */}
      <div className="min-h-[400px]">
        {activeTab === 'dashboard' && isOwnProfile && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-12">
            {/* Streak & Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="md:col-span-2 bg-sage-dark text-white p-8 rounded-[2.5rem] shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl" />
                <span className="text-[10px] font-bold uppercase tracking-widest opacity-60">Current Streak</span>
                <div className="flex items-center gap-4 mt-2">
                  <Sun className="w-10 h-10 text-amber-400" />
                  <span className="text-5xl font-bold">7 Days</span>
                </div>
                <p className="mt-4 text-white/60 text-sm italic">"Let us not grow weary in doing good..." - Galatians 6:9</p>
              </div>
              
              <Link to="/bible" className="bg-white p-8 rounded-[2.5rem] border border-sage/10 shadow-sm flex flex-col justify-center hover:border-sage/30 transition-all group">
                <p className="text-3xl font-bold text-sage-dark group-hover:text-sage">{stats?.bibleReadCount || 0}</p>
                <p className="text-[10px] font-bold text-ink/40 uppercase tracking-widest mt-1">Chapters Read</p>
              </Link>
              
              <Link to="/bookmarks" className="bg-white p-8 rounded-[2.5rem] border border-sage/10 shadow-sm flex flex-col justify-center hover:border-sage/30 transition-all group">
                <p className="text-3xl font-bold text-sage-dark group-hover:text-sage">{stats?.bookmarks || 0}</p>
                <p className="text-[10px] font-bold text-ink/40 uppercase tracking-widest mt-1">Saved Verses</p>
              </Link>
            </div>

            {/* Media Status */}
            <div className="bg-cream/50 p-8 rounded-[2.5rem] border border-sage/5 flex items-center gap-6">
              <div className="w-16 h-16 bg-sage/10 rounded-2xl flex items-center justify-center text-sage shrink-0">
                <Activity className="w-8 h-8 animate-pulse" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-sage uppercase tracking-widest mb-1">Now Playing</p>
                <p className="text-ink font-bold">Worship Sanctuary: Morning Praise</p>
                <p className="text-xs text-ink/40">Listening on Vision Media</p>
              </div>
              <Link to="/media" className="ml-auto text-sage font-bold text-sm hover:underline">Join In</Link>
            </div>

            {/* Milestones & Activity */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
              <div>
                <h3 className="serif text-2xl font-bold text-sage-dark mb-6 flex items-center gap-3">
                  <Award className="w-6 h-6 text-sage" />
                  Theological Milestones
                </h3>
                <div className="space-y-4">
                  {milestones.map((m, i) => (
                    <div key={i} className={`p-6 rounded-3xl border flex items-start gap-4 transition-all ${m.achieved ? 'bg-sage/5 border-sage/30 shadow-sm' : 'bg-white border-sage/10 opacity-60'}`}>
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${m.achieved ? 'bg-sage text-white shadow-lg shadow-sage/20' : 'bg-sage/10 text-sage/40'}`}>
                        <Award className="w-6 h-6" />
                      </div>
                      <div>
                        <h4 className="font-bold text-ink">{m.title}</h4>
                        <p className="text-sm text-ink/60 leading-relaxed">{m.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="serif text-2xl font-bold text-sage-dark mb-6 flex items-center gap-3">
                  <Calendar className="w-6 h-6 text-sage" />
                  Recent Activity
                </h3>
                <div className="bg-white rounded-[2.5rem] border border-sage/10 p-8 shadow-sm">
                  <div className="space-y-6">
                    {activities.length > 0 ? activities.map((activity, i) => (
                      <div key={i} className="flex gap-4">
                        <div className="w-2 h-2 rounded-full bg-sage mt-2 shrink-0" />
                        <div>
                          <p className="text-sm font-medium text-ink">
                            {activity.type === 'bible_read' && `Read ${activity.metadata.book} ${activity.metadata.chapter}`}
                            {activity.type === 'topic_explore' && `Explored topic: ${activity.metadata.topic}`}
                            {activity.type === 'prayer_post' && `Posted a prayer request`}
                            {activity.type === 'testimony_share' && `Shared a testimony`}
                            {activity.type === 'note_create' && `Created a new note`}
                          </p>
                          <p className="text-[10px] text-ink/40 mt-1 uppercase tracking-widest">
                            {new Date(activity.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    )) : (
                      <p className="text-sm text-ink/40 italic text-center py-8">No recent activity recorded.</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'posts' && (
          <div className="space-y-6">
            {loadingContent ? (
              <div className="flex justify-center py-10"><Loader2 className="w-8 h-8 text-sage animate-spin" /></div>
            ) : userPosts.length > 0 ? (
              userPosts.map(post => (
                <div key={post.id} className="bg-white p-6 rounded-3xl border border-sage/10 shadow-sm">
                  <h3 className="serif text-xl font-bold text-sage-dark mb-2">{post.title}</h3>
                  <p className="text-ink/70 text-sm mb-4">{post.content}</p>
                  <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-ink/40">
                    <span>{new Date(post.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-20 bg-white rounded-[3rem] border border-dashed border-sage/20">
                <Grid className="w-12 h-12 text-sage/20 mx-auto mb-4" />
                <p className="text-ink/40 serif italic text-lg">No posts shared yet.</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'prayers' && (
          <div className="space-y-6">
            {loadingContent ? (
              <div className="flex justify-center py-10"><Loader2 className="w-8 h-8 text-sage animate-spin" /></div>
            ) : userPrayers.length > 0 ? (
              userPrayers.map(prayer => (
                <div key={prayer.id} className="bg-white p-6 rounded-3xl border border-sage/10 shadow-sm">
                  <p className="text-ink/70 text-sm mb-4">{prayer.content}</p>
                  <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-ink/40">
                    <span>{new Date(prayer.createdAt).toLocaleDateString()}</span>
                    <span className="text-sage">{prayer.prayedCount || 0} prayers</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-20 bg-white rounded-[3rem] border border-dashed border-sage/20">
                <Heart className="w-12 h-12 text-sage/20 mx-auto mb-4" />
                <p className="text-ink/40 serif italic text-lg">No prayers shared yet.</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'testimonies' && (
          <div className="space-y-6">
            {loadingContent ? (
              <div className="flex justify-center py-10"><Loader2 className="w-8 h-8 text-sage animate-spin" /></div>
            ) : userTestimonies.length > 0 ? (
              userTestimonies.map(testimony => (
                <div key={testimony.id} className="bg-white p-6 rounded-3xl border border-sage/10 shadow-sm">
                  <h3 className="serif text-xl font-bold text-sage-dark mb-2">{testimony.title}</h3>
                  <p className="text-ink/70 text-sm mb-4">{testimony.content}</p>
                  <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-ink/40">
                    <span>{new Date(testimony.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-20 bg-white rounded-[3rem] border border-dashed border-sage/20">
                <MessageCircle className="w-12 h-12 text-sage/20 mx-auto mb-4" />
                <p className="text-ink/40 serif italic text-lg">No testimonies shared yet.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Edit Profile Modal */}
      <AnimatePresence>
        {isEditModalOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4 sm:p-6">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-[2.5rem] p-8 sm:p-10 max-w-xl w-full shadow-2xl space-y-8 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex justify-between items-center">
                <h2 className="serif text-3xl font-bold text-sage-dark">Edit Profile</h2>
                <button onClick={() => setIsEditModalOpen(false)} className="text-ink/20 hover:text-ink transition-colors">
                  <Settings size={24} />
                </button>
              </div>
              
              <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-[10px] font-bold text-ink/40 uppercase tracking-widest mb-2">Display Name</label>
                    <input
                      type="text"
                      value={editData.displayName}
                      onChange={(e) => setEditData({ ...editData, displayName: e.target.value })}
                      className="w-full p-4 rounded-2xl border border-sage/20 bg-cream/30 focus:bg-white focus:ring-2 focus:ring-sage/30 transition-all outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-ink/40 uppercase tracking-widest mb-2">Photo URL</label>
                    <input
                      type="text"
                      value={editData.photoURL}
                      onChange={(e) => setEditData({ ...editData, photoURL: e.target.value })}
                      className="w-full p-4 rounded-2xl border border-sage/20 bg-cream/30 focus:bg-white focus:ring-2 focus:ring-sage/30 transition-all outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-ink/40 uppercase tracking-widest mb-2">Bio</label>
                  <textarea
                    value={editData.bio}
                    onChange={(e) => setEditData({ ...editData, bio: e.target.value })}
                    className="w-full h-32 p-4 rounded-2xl border border-sage/20 bg-cream/30 focus:bg-white focus:ring-2 focus:ring-sage/30 transition-all outline-none resize-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-[10px] font-bold text-ink/40 uppercase tracking-widest mb-2">Location</label>
                    <input
                      type="text"
                      value={editData.location}
                      onChange={(e) => setEditData({ ...editData, location: e.target.value })}
                      className="w-full p-4 rounded-2xl border border-sage/20 bg-cream/30 focus:bg-white focus:ring-2 focus:ring-sage/30 transition-all outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-ink/40 uppercase tracking-widest mb-2">Website</label>
                    <input
                      type="text"
                      value={editData.website}
                      onChange={(e) => setEditData({ ...editData, website: e.target.value })}
                      className="w-full p-4 rounded-2xl border border-sage/20 bg-cream/30 focus:bg-white focus:ring-2 focus:ring-sage/30 transition-all outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-4 pt-4">
                <div className="flex gap-4">
                  <button
                    onClick={() => setIsEditModalOpen(false)}
                    className="flex-1 px-8 py-4 rounded-2xl font-bold text-ink/40 hover:bg-cream transition-all"
                    disabled={isSaving}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveProfile}
                    disabled={isSaving}
                    className="flex-1 bg-sage text-white px-8 py-4 rounded-2xl font-bold hover:bg-sage-dark transition-all disabled:opacity-50 shadow-lg shadow-sage/20"
                  >
                    {isSaving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
                <div className="border-t border-sage/10 pt-4 mt-2">
                  <button
                    onClick={() => setIsDeleteModalOpen(true)}
                    className="w-full bg-red-50 text-red-600 px-8 py-4 rounded-2xl font-bold hover:bg-red-100 transition-all"
                  >
                    Delete Account
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Account Confirmation Modal */}
      <AnimatePresence>
        {isDeleteModalOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[110] p-4 sm:p-6">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-[2.5rem] p-8 sm:p-10 max-w-md w-full shadow-2xl space-y-6"
            >
              <h2 className="serif text-3xl font-bold text-red-600">Delete Account?</h2>
              <p className="text-ink/70 leading-relaxed">
                Are you sure you want to delete your account? This action cannot be undone and will permanently delete all your posts, prayers, testimonies, and activities.
              </p>
              <div className="flex gap-4 pt-4">
                <button
                  onClick={() => setIsDeleteModalOpen(false)}
                  className="flex-1 px-6 py-3 rounded-2xl font-bold text-ink/40 hover:bg-cream transition-all"
                  disabled={isDeleting}
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteAccount}
                  disabled={isDeleting}
                  className="flex-1 bg-red-600 text-white px-6 py-3 rounded-2xl font-bold hover:bg-red-700 transition-all disabled:opacity-50 shadow-lg shadow-red-600/20"
                >
                  {isDeleting ? 'Deleting...' : 'Yes, Delete'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
