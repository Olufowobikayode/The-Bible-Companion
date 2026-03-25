import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { api } from '../lib/api';
import { motion } from 'motion/react';
import { toast } from 'sonner';
import { Users, UserPlus, UserMinus, Search } from 'lucide-react';
import { Link } from 'react-router-dom';

interface UserProfile {
  uid: string;
  username: string;
  displayName: string;
  photoURL?: string;
  bio?: string;
}

export default function Friends() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [following, setFollowing] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const usersData = await api.get('/api/users/search?q=');
        setUsers(usersData);
      } catch (error) {
        console.error("Error fetching users:", error);
      }
    };

    const fetchFollowing = async (u: any) => {
      if (!u) return;
      try {
        const profile = await api.get(`/api/user-profiles/${u.id}`);
        setFollowing(profile?.following || []);
      } catch (error) {
        console.error("Error fetching following:", error);
      }
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      Promise.all([fetchUsers(), fetchFollowing(session?.user)]).then(() => setLoading(false));
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) fetchFollowing(session.user);
      else setFollowing([]);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleAddFriend = async (friendUid: string) => {
    if (!user) {
      toast.error("Please sign in to follow users.");
      return;
    }
    try {
      await api.post(`/api/users/${friendUid}/follow`, {});
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
      await api.post(`/api/users/${friendUid}/unfollow`, {});
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

      {loading ? (
        <div className="text-center py-12 text-ink/40">Loading users...</div>
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
