import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Video, Users, Plus, Loader2, Share2, Sparkles } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { api } from '../lib/api';
import { toast } from 'sonner';
import { fetchBibleVerse } from '../lib/bible';

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
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomDesc, setNewRoomDesc] = useState('');
  const [user, setUser] = useState<any>(null);
  const [verse, setVerse] = useState<any>(null);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);

  const fetchRooms = async () => {
    try {
      const data = await api.get('/api/prayer-rooms');
      setRooms(data);
    } catch (error) {
      console.error('Error fetching rooms:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRooms();
    fetchBibleVerse("Psalm 122:6").then(setVerse);
    
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });
  }, []);

  const handleCreateRoom = async () => {
    if (!user || !newRoomName.trim()) return;

    try {
      const newRoom = await api.post('/api/prayer-rooms', {
        name: newRoomName.trim(),
        description: newRoomDesc.trim(),
        creatorName: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Anonymous',
      });
      
      setRooms(prev => [newRoom, ...prev]);
      setNewRoomName('');
      setNewRoomDesc('');
      toast.success('Prayer room created!');
    } catch (error) {
      console.error('Error creating room:', error);
      toast.error('Failed to create room.');
    }
  };

  const handleShare = (roomId: string) => {
    const url = `https://meet.jit.si/${roomId}`;
    navigator.clipboard.writeText(url);
    toast.success('Room link copied to clipboard!');
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Scripture Display */}
      {verse && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-sage-light/30 p-8 rounded-2xl border border-sage/10 mb-12 text-center"
        >
          <Sparkles className="w-8 h-8 text-sage mx-auto mb-4" />
          <blockquote className="serif text-2xl font-medium text-ink/80 mb-2">
            "{verse.text}"
          </blockquote>
          <p className="text-sage-dark font-bold">— {verse.reference}</p>
        </motion.div>
      )}

      <h1 className="text-3xl font-bold text-sage-dark mb-8">Video Prayer Rooms</h1>
      
      {/* Create Room Form */}
      <div className="bg-white p-6 rounded-xl border border-sage/10 shadow-sm mb-12">
        <h2 className="text-xl font-semibold text-sage-dark mb-4">Create New Room</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input placeholder="Room Name" value={newRoomName} onChange={e => setNewRoomName(e.target.value)} className="p-3 rounded-lg border border-sage/20" />
          <input placeholder="Description" value={newRoomDesc} onChange={e => setNewRoomDesc(e.target.value)} className="p-3 rounded-lg border border-sage/20" />
          <button onClick={handleCreateRoom} className="bg-sage text-white px-6 py-3 rounded-lg flex items-center justify-center gap-2 hover:bg-sage-dark transition-colors">
            <Plus size={18} /> Create Room
          </button>
        </div>
      </div>
      
      {/* Room List */}
      {loading ? <Loader2 className="animate-spin text-sage mx-auto" /> : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {rooms.map(room => (
            <div key={room.id} className="bg-white p-6 rounded-xl border border-sage/10 shadow-sm">
              <h3 className="font-bold text-lg text-sage-dark mb-1">{room.name}</h3>
              <p className="text-sm text-ink/60 mb-4">{room.description}</p>
              <div className="flex gap-2">
                <button 
                  onClick={() => setActiveRoomId(room.id)}
                  className="flex-1 bg-sage text-white py-2 rounded-lg text-sm font-medium hover:bg-sage-dark transition-colors"
                >
                  Join Room
                </button>
                <button 
                  onClick={() => handleShare(room.id)}
                  className="px-4 py-2 rounded-lg border border-sage/20 text-sage hover:bg-sage-light transition-colors"
                >
                  <Share2 size={18} />
                </button>
              </div>
              {activeRoomId === room.id && (
                <div className="mt-4">
                  <iframe
                    src={`https://meet.jit.si/${room.id}`}
                    className="w-full h-64 border-0 rounded-lg"
                    allow="camera; microphone; fullscreen; display-capture"
                  />
                  <button 
                    onClick={() => setActiveRoomId(null)}
                    className="mt-2 text-xs text-destructive hover:underline"
                  >
                    Close Room
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
