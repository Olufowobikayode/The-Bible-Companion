import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Video, Users, Plus, X, Loader2, MessageSquare } from 'lucide-react';
import { db, auth } from '../firebase';
import { collection, query, onSnapshot, addDoc, serverTimestamp, deleteDoc, doc } from 'firebase/firestore';
import { toast } from 'sonner';

import { moderateContent } from '../lib/moderation';

interface Room {
  id: string;
  name: string;
  description: string;
  createdBy: string;
  creatorName: string;
  createdAt: any;
  participantCount: number;
}

export default function PrayerRooms() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomDesc, setNewRoomDesc] = useState('');
  const [activeRoom, setActiveRoom] = useState<Room | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'prayer_rooms'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const roomsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Room[];
      setRooms(roomsData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleCreateRoom = async () => {
    if (!auth.currentUser || !newRoomName.trim()) return;
    setIsCreating(true);

    try {
      // Moderate room name and description
      const nameModeration = await moderateContent(newRoomName);
      if (!nameModeration.isApproved) {
        toast.error(`Room name rejected: ${nameModeration.reason}`);
        setIsCreating(false);
        return;
      }

      const descModeration = await moderateContent(newRoomDesc);
      if (!descModeration.isApproved) {
        toast.error(`Room description rejected: ${descModeration.reason}`);
        setIsCreating(false);
        return;
      }

      await addDoc(collection(db, 'prayer_rooms'), {
        name: newRoomName.trim(),
        description: newRoomDesc.trim(),
        createdBy: auth.currentUser.uid,
        creatorName: auth.currentUser.displayName || 'Anonymous',
        createdAt: serverTimestamp(),
        participantCount: 0
      });
      setNewRoomName('');
      setNewRoomDesc('');
      setShowCreateModal(false);
      toast.success('Prayer room created!');
    } catch (error) {
      console.error('Error creating room:', error);
      toast.error('Failed to create room.');
    } finally {
      setIsCreating(false);
    }
  };

  const joinRoom = (room: Room) => {
    setActiveRoom(room);
  };

  if (activeRoom) {
    return (
      <div className="fixed inset-0 bg-black z-[200] flex flex-col">
        <div className="bg-sage-dark p-4 flex items-center justify-between text-white">
          <div className="flex items-center gap-3">
            <Video className="text-sage-light" />
            <div>
              <h3 className="font-bold">{activeRoom.name}</h3>
              <p className="text-xs text-white/60">Live Prayer Room</p>
            </div>
          </div>
          <button 
            onClick={() => setActiveRoom(null)}
            className="p-2 hover:bg-white/10 rounded-full transition-colors"
          >
            <X />
          </button>
        </div>
        <div className="flex-1 bg-ink/90 relative">
          <iframe
            src={`https://meet.jit.si/${activeRoom.id.replace(/\s+/g, '-')}`}
            allow="camera; microphone; fullscreen; display-capture"
            className="w-full h-full border-none"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
        <div>
          <h1 className="serif text-4xl sm:text-5xl font-bold text-sage-dark mb-4">Video Prayer Rooms</h1>
          <p className="text-ink/60 text-lg max-w-2xl">
            Join live video rooms to pray together in real-time. "For where two or three are gathered in my name, there am I among them."
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center justify-center gap-2 bg-sage text-white px-8 py-4 rounded-2xl font-bold hover:bg-sage-dark transition-all shadow-xl shadow-sage/20"
        >
          <Plus size={20} />
          <span>Start a Room</span>
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 text-sage animate-spin" />
        </div>
      ) : rooms.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-[3rem] border-2 border-dashed border-sage/10">
          <Video className="w-16 h-16 text-sage/20 mx-auto mb-6" />
          <h3 className="serif text-2xl font-bold text-sage-dark mb-2">No Active Rooms</h3>
          <p className="text-ink/60 mb-8">Start a room and invite others to pray with you.</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="text-sage font-bold hover:underline"
          >
            Create the first room
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {rooms.map((room) => (
            <motion.div
              key={room.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white p-8 rounded-[2.5rem] border border-sage/10 hover:border-sage/30 transition-all group shadow-sm hover:shadow-xl hover:shadow-sage/5"
            >
              <div className="flex items-start justify-between mb-6">
                <div className="p-3 bg-sage-light/30 rounded-2xl text-sage group-hover:bg-sage group-hover:text-white transition-colors">
                  <Users size={24} />
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1 bg-green-50 text-green-600 rounded-full text-xs font-bold uppercase tracking-wider">
                  <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                  Live
                </div>
              </div>
              <h3 className="serif text-2xl font-bold text-sage-dark mb-2">{room.name}</h3>
              <p className="text-ink/60 text-sm mb-6 line-clamp-2">{room.description}</p>
              <div className="flex items-center justify-between pt-6 border-t border-sage/5">
                <div className="text-xs text-ink/40">
                  Started by <span className="font-bold text-ink/60">{room.creatorName}</span>
                </div>
                <button
                  onClick={() => joinRoom(room)}
                  className="bg-sage text-white px-6 py-2.5 rounded-xl font-bold hover:bg-sage-dark transition-all"
                >
                  Join Room
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Create Room Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[250] p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white p-8 sm:p-10 rounded-[3rem] max-w-md w-full shadow-2xl"
          >
            <div className="flex items-center justify-between mb-8">
              <h2 className="serif text-3xl font-bold text-sage-dark">New Prayer Room</h2>
              <button onClick={() => setShowCreateModal(false)} className="p-2 hover:bg-sage-light rounded-full transition-colors">
                <X />
              </button>
            </div>
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-bold text-ink/60 mb-2 uppercase tracking-wider">Room Name</label>
                <input
                  type="text"
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  className="w-full p-4 bg-sage-light/10 border border-sage/10 rounded-2xl focus:outline-none focus:border-sage"
                  placeholder="e.g., Morning Intercession"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-ink/60 mb-2 uppercase tracking-wider">Description</label>
                <textarea
                  value={newRoomDesc}
                  onChange={(e) => setNewRoomDesc(e.target.value)}
                  className="w-full p-4 bg-sage-light/10 border border-sage/10 rounded-2xl focus:outline-none focus:border-sage h-24 resize-none"
                  placeholder="What will you be praying for?"
                />
              </div>
              <button
                onClick={handleCreateRoom}
                disabled={isCreating || !newRoomName.trim()}
                className="w-full bg-sage text-white py-4 rounded-2xl font-bold hover:bg-sage-dark transition-all disabled:opacity-50 shadow-xl shadow-sage/20"
              >
                {isCreating ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Launch Room'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
