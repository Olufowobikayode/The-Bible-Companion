import { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, deleteDoc, doc, getDoc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { motion } from 'motion/react';
import { toast } from 'sonner';
import { Users, Plus, Trash2, LogIn, LogOut } from 'lucide-react';
import { moderateContent } from '../lib/moderation';

interface Group {
  id: string;
  name: string;
  description: string;
  creatorUid: string;
  creatorName: string;
  members: string[];
  createdAt: any;
}

export default function Groups() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDescription, setNewGroupDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'groups'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setGroups(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Group)));
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
  }, []);

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim() || !newGroupDescription.trim() || !auth.currentUser) return;

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

      await addDoc(collection(db, 'groups'), {
        name: newGroupName,
        description: newGroupDescription,
        creatorUid: auth.currentUser.uid,
        creatorName: auth.currentUser.displayName || 'Anonymous',
        members: [auth.currentUser.uid],
        createdAt: serverTimestamp()
      });
      
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
        await deleteDoc(doc(db, 'groups', id));
        toast.success("Group deleted");
      } catch (error) {
        console.error("Error deleting group:", error);
        toast.error("Failed to delete group");
      }
    }
  };

  const handleJoinGroup = async (groupId: string) => {
    if (!auth.currentUser) {
      toast.error("Please sign in to join a group.");
      return;
    }
    try {
      await updateDoc(doc(db, 'groups', groupId), {
        members: arrayUnion(auth.currentUser.uid)
      });
      toast.success("Joined group!");
    } catch (error) {
      console.error("Error joining group:", error);
      toast.error("Failed to join group");
    }
  };

  const handleLeaveGroup = async (groupId: string) => {
    if (!auth.currentUser) return;
    try {
      await updateDoc(doc(db, 'groups', groupId), {
        members: arrayRemove(auth.currentUser.uid)
      });
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

      {auth.currentUser ? (
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
          const isMember = auth.currentUser ? group.members.includes(auth.currentUser.uid) : false;
          
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

                {(isAdmin || (auth.currentUser && auth.currentUser.uid === group.creatorUid)) && (
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
