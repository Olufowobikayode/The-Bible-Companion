import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { api } from '../lib/api';
import { motion } from 'motion/react';
import { toast } from 'sonner';
import { Users, Plus, Trash2, LogIn, LogOut } from 'lucide-react';
import { moderateContent } from '../lib/moderation';
import { useAuth } from '../contexts/AuthContext';

interface Group {
  id: string;
  name: string;
  description: string;
  creatorUid: string;
  creatorName: string;
  members: string[];
  createdAt: string;
}

export default function Groups() {
  const { user } = useAuth();
  const [groups, setGroups] = useState<Group[]>([]);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDescription, setNewGroupDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
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

  useEffect(() => {
    fetchGroups();
    checkAdmin();
  }, [user]);

  const fetchGroups = async () => {
    try {
      const data = await api.get('/api/groups');
      setGroups(data);
    } catch (error) {
      console.error("Error fetching groups:", error);
    }
  };

  const checkAdmin = async () => {
    if (user) {
      if (user.email === 'kayodeolufowobi709@gmail.com') {
        setIsAdmin(true);
        return;
      }
      try {
        const profile = await api.get(`/api/user-profiles/${user.id}`);
        if (profile && profile.role === 'admin') {
          setIsAdmin(true);
        }
      } catch (error) {
        console.error("Error checking admin status:", error);
      }
    }
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim() || !newGroupDescription.trim() || !user) return;

    setIsSubmitting(true);
    try {
      const moderationResultName = await moderateContent(newGroupName);
      if (!moderationResultName.isApproved) {
        toast.error(`Group name rejected: ${moderationResultName.reason}`);
        setIsSubmitting(false);
        return;
      }

      const moderationResultDesc = await moderateContent(newGroupDescription);
      if (!moderationResultDesc.isApproved) {
        toast.error(`Group description rejected: ${moderationResultDesc.reason}`);
        setIsSubmitting(false);
        return;
      }

      const newGroup = await api.post('/api/groups', {
        name: newGroupName,
        description: newGroupDescription,
      });
      
      setGroups([newGroup, ...groups]);
      setNewGroupName('');
      setNewGroupDescription('');
      toast.success("Group created successfully!");
    } catch (error) {
      console.error("Error creating group:", error);
      toast.error("Failed to create group.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteGroup = async (id: string) => {
    if (window.confirm("Are you sure you want to delete this group?")) {
      try {
        await api.delete(`/api/groups/${id}`);
        setGroups(groups.filter(g => g.id !== id));
        toast.success("Group deleted");
      } catch (error) {
        console.error("Error deleting group:", error);
        toast.error("Failed to delete group");
      }
    }
  };

  const handleJoinGroup = async (groupId: string) => {
    if (!user) {
      toast.error("Please sign in to join a group.");
      return;
    }
    try {
      await api.post(`/api/groups/${groupId}/join`, {});
      setGroups(groups.map(g => g.id === groupId ? { ...g, members: [...g.members, user.id] } : g));
      toast.success("Joined group!");
    } catch (error) {
      console.error("Error joining group:", error);
      toast.error("Failed to join group");
    }
  };

  const handleLeaveGroup = async (groupId: string) => {
    if (!user) return;
    try {
      await api.post(`/api/groups/${groupId}/leave`, {});
      setGroups(groups.map(g => g.id === groupId ? { ...g, members: g.members.filter(id => id !== user.id) } : g));
      toast.success("Left group");
    } catch (error) {
      console.error("Error leaving group:", error);
      toast.error("Failed to leave group");
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 sm:py-12">
      <div className="text-center mb-12">
        <h1 className="serif text-3xl sm:text-4xl font-semibold text-sage-dark mb-4 flex items-center justify-center gap-3">
          <Users className="w-8 h-8 text-sage" />
          Community Groups
        </h1>
        <p className="text-ink/60 max-w-2xl mx-auto">
          "For where two or three gather in my name, there am I with them." - Matthew 18:20
        </p>
      </div>

      {user ? (
        <div className="bg-sage-light/20 p-6 sm:p-8 rounded-[2rem] border border-sage/10 mb-12">
          <h2 className="serif text-xl font-semibold text-sage-dark mb-4 flex items-center gap-2">
            <Plus className="w-5 h-5" />
            Create a New Group
          </h2>
          <form onSubmit={handleCreateGroup} className="space-y-4">
            <input
              type="text"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              placeholder="Group Name (e.g., Morning Prayer Warriors)"
              className="w-full p-4 bg-white border border-sage/20 rounded-2xl focus:outline-none focus:border-sage text-sm"
              disabled={isSubmitting}
            />
            <textarea
              value={newGroupDescription}
              onChange={(e) => setNewGroupDescription(e.target.value)}
              placeholder="What is this group about?"
              className="w-full p-4 bg-white border border-sage/20 rounded-2xl resize-none h-24 focus:outline-none focus:border-sage text-sm"
              disabled={isSubmitting}
            />
            <div className="flex justify-end">
              <button 
                type="submit"
                disabled={isSubmitting || !newGroupName.trim() || !newGroupDescription.trim()}
                className="w-full sm:w-auto bg-sage text-white px-8 py-3 rounded-xl font-medium hover:bg-sage-dark transition-all disabled:opacity-50 shadow-lg shadow-sage/10"
              >
                {isSubmitting ? 'Creating...' : 'Create Group'}
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div className="bg-sage-light/20 p-8 rounded-[2rem] border border-sage/10 mb-12 text-center">
          <p className="text-ink/60">Please sign in to create or join groups.</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {groups.map((group) => {
          const isMember = user ? group.members.includes(user.id) : false;
          
          return (
            <motion.div
              key={group.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white p-6 sm:p-8 rounded-3xl border border-sage/10 shadow-sm relative group flex flex-col h-full"
            >
              <div className="flex-grow">
                <h3 className="serif text-xl font-semibold text-sage-dark mb-2">{group.name}</h3>
                <p className="text-ink/70 text-sm mb-4 line-clamp-3">{group.description}</p>
                <div className="flex items-center gap-2 text-xs text-ink/40 mb-6">
                  <Users className="w-4 h-4" />
                  <span>{group.members.length} {group.members.length === 1 ? 'member' : 'members'}</span>
                  <span className="mx-2">•</span>
                  <span>Created by {group.creatorName}</span>
                </div>
              </div>
              
              <div className="mt-auto pt-4 border-t border-sage/10 flex justify-between items-center">
                {isMember ? (
                  <button 
                    onClick={() => handleLeaveGroup(group.id)}
                    className="flex items-center gap-2 text-sm font-medium text-ink/50 hover:text-destructive transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    Leave Group
                  </button>
                ) : (
                  <button 
                    onClick={() => handleJoinGroup(group.id)}
                    className="flex items-center gap-2 text-sm font-medium text-sage hover:text-sage-dark transition-colors"
                  >
                    <LogIn className="w-4 h-4" />
                    Join Group
                  </button>
                )}

                {(isAdmin || (user && user.id === group.creatorUid)) && (
                  <button 
                    onClick={() => handleDeleteGroup(group.id)}
                    className="p-2 text-ink/20 hover:text-destructive transition-colors"
                    title="Delete Group"
                  >
                    <Trash2 size={18} />
                  </button>
                )}
              </div>
            </motion.div>
          );
        })}
        
        {groups.length === 0 && (
          <div className="col-span-full text-center py-12 text-ink/40 italic">
            No groups created yet. Be the first to start one!
          </div>
        )}
      </div>
    </div>
  );
}
