import { useState, useEffect } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { api } from '../lib/api';
import { motion } from 'motion/react';
import { toast } from 'sonner';
import { Users, UserPlus, UserMinus, Search, Loader2 } from 'lucide-react';

interface UserProfile {
  uid: string;
  username: string;
  displayName: string;
  photoURL?: string;
  bio?: string;
}

export default function Friends() {
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const initialTab = (queryParams.get('tab') as 'brethren' | 'followers' | 'following') || 'brethren';
  const targetUid = queryParams.get('uid');

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [following, setFollowing] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'brethren' | 'followers' | 'following'>(initialTab);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        setUser(session?.user ?? null);

        let usersData: UserProfile[] = [];
        if (activeTab === 'brethren') {
          usersData = await api.get('/api/users/brethren');
        } else if (activeTab === 'followers') {
          usersData = await api.get(`/api/users/${session?.user?.id}/followers`);
        } else if (activeTab === 'following') {
          usersData = await api.get(`/api/users/${session?.user?.id}/following`);
        } else {
          usersData = await api.get('/api/users/search?q=');
        }
        setUsers(usersData);

        if (session?.user) {
          const profile = await api.get(`/api/users/me`);
          setFollowing(profile?.following || []);
        }
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [activeTab]);

  const handleAddFriend = async (friendUid: string) => {
    if (!user) {
      toast.error("Please sign in to follow users.");
      return;
    }
    try {
      await api.post(`/api/follow`, { targetId: friendUid });
      setFollowing(prev => [...prev, friendUid]);
      toast.success("Following user!");
    } catch (error) {
      console.error("Error following user:", error);
      toast.error("Failed to follow user");
    }
  };

  const handleRemoveFriend = async (friendUid: string) => {
    if (!user) return;
    try {
      await api.post(`/api/unfollow`, { targetId: friendUid });
      setFollowing(prev => prev.filter(id => id !== friendUid));
      toast.success("Unfollowed user");
    } catch (error) {
      console.error("Error unfollowing user:", error);
      toast.error("Failed to unfollow user");
    }
  };

  const filteredUsers = users.filter(u => 
    u.uid !== user?.id && 
    (u.displayName?.toLowerCase().includes(searchQuery.toLowerCase()) || 
     u.username?.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 sm:py-12">
      <div className="text-center mb-12">
        <h1 className="serif text-3xl sm:text-4xl font-semibold text-sage-dark mb-4 flex items-center justify-center gap-3">
          <Users className="w-8 h-8 text-sage" />
          Community
        </h1>
        <p className="text-ink/60 max-w-2xl mx-auto">
          "A friend loves at all times, and a brother is born for a time of adversity." - Proverbs 17:17
        </p>
      </div>

      <div className="mb-8 relative max-w-md mx-auto">
        <input
          type="text"
          placeholder="Search for users..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-white border border-sage/20 rounded-xl px-4 py-3 pl-10 text-sm focus:outline-none focus:border-sage shadow-sm"
        />
        <Search className="absolute left-3 top-3.5 w-4 h-4 text-ink/40" />
      </div>

      <div className="flex justify-center gap-4 mb-12">
        {[
          { id: 'brethren', label: 'All Brethren' },
          { id: 'followers', label: 'Followers' },
          { id: 'following', label: 'Following' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${
              activeTab === tab.id 
                ? 'bg-sage text-white shadow-lg shadow-sage/20' 
                : 'bg-white text-ink/40 hover:text-sage border border-sage/10'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 text-sage animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredUsers.map((user) => {
            const isFollowing = following.includes(user.uid);
            
            return (
              <motion.div
                key={user.uid}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white p-6 rounded-3xl border border-sage/10 shadow-sm flex flex-col items-center text-center"
              >
                <Link to={`/profile/${user.username}`} className="w-20 h-20 rounded-full bg-sage-light flex items-center justify-center text-sage font-bold text-2xl mb-4 overflow-hidden">
                  {user.photoURL ? (
                    <img src={user.photoURL} alt={user.displayName} className="w-full h-full object-cover" />
                  ) : (
                    user.displayName?.[0] || 'U'
                  )}
                </Link>
                <Link to={`/profile/${user.username}`} className="serif text-lg font-semibold text-sage-dark mb-1 hover:underline">
                  {user.displayName || 'Unknown User'}
                </Link>
                <p className="text-ink/50 text-xs mb-6 line-clamp-2 h-8">{user.bio || 'No bio provided.'}</p>
                
                {isFollowing ? (
                  <button 
                    onClick={() => handleRemoveFriend(user.uid)}
                    className="mt-auto w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border border-sage/20 text-ink/60 hover:bg-sage-light hover:text-sage transition-colors"
                  >
                    <UserMinus className="w-4 h-4" />
                    Unfollow
                  </button>
                ) : (
                  <button 
                    onClick={() => handleAddFriend(user.uid)}
                    className="mt-auto w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-sage text-white hover:bg-sage-dark transition-colors shadow-sm"
                  >
                    <UserPlus className="w-4 h-4" />
                    Follow
                  </button>
                )}
              </motion.div>
            );
          })}
          
          {filteredUsers.length === 0 && (
            <div className="col-span-full text-center py-12 text-ink/40 italic">
              No users found matching your search.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
