import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Video, Users, Plus, Loader2, Trash2, X, Calendar, ArrowLeft } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { api } from '../lib/api';
import { toast } from 'sonner';
import { useNavigate, useParams } from 'react-router-dom';

interface Room {
  id: string;
  name: string;
  description: string;
  createdBy: string;
  creatorName: string;
  createdAt: any;
  startDate?: string;
  expiryDate?: string;
}

export default function PrayerRooms() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const navigate = useNavigate();
  const { roomId } = useParams<{ roomId?: string }>();
  
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomDesc, setNewRoomDesc] = useState('');
  const [newRoomStart, setNewRoomStart] = useState('');
  const [newRoomExpiry, setNewRoomExpiry] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });
    fetchRooms();
  }, []);

  const fetchRooms = async () => {
    try {
      const data = await api.get('/api/prayer-rooms');
      setRooms(data);
    } catch (error) {
      console.error("Error fetching rooms:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRoom = async () => {
    if (!newRoomName.trim() || !newRoomDesc.trim()) {
      toast.error('Name and Description are required');
      return;
    }
    setIsCreating(true);
    try {
      const room = await api.post('/api/prayer-rooms', {
        name: newRoomName,
        description: newRoomDesc,
        startDate: newRoomStart,
        expiryDate: newRoomExpiry
      });
      setRooms(prev => [...prev, room]);
      setNewRoomName('');
      setNewRoomDesc('');
      setNewRoomStart('');
      setNewRoomExpiry('');
      toast.success('Room created');
    } catch (error) {
      toast.error('Failed to create room');
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteRoom = async (id: string) => {
    try {
      await api.delete(`/api/prayer-rooms/${id}`);
      setRooms(prev => prev.filter(r => r.id !== id));
      toast.success('Room deleted');
    } catch (error) {
      toast.error('Failed to delete room');
    }
  };

  const handleJoinCall = (roomName: string, isDefault: boolean) => {
    const formattedId = roomName.trim().replace(/\s+/g, '');
    navigate(`/prayer-rooms/${formattedId}`);
  };

  if (roomId) {
    return (
      <div className="fixed inset-0 z-[60] bg-sage/5 flex flex-col">
        <div className="bg-white border-b border-sage/10 p-4 flex justify-between items-center shadow-sm safe-top">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => navigate('/prayer-rooms')}
              className="p-2 -ml-2 text-sage-dark hover:bg-sage/10 rounded-full transition-colors"
            >
              <ArrowLeft size={24} />
            </button>
            <Video className="w-6 h-6 text-sage" />
            <span className="font-bold text-sage-dark text-lg truncate max-w-[150px] sm:max-w-xs">Room: {roomId}</span>
          </div>
          <button 
            onClick={() => navigate('/prayer-rooms')}
            className="bg-red-50 text-red-600 hover:bg-red-100 px-4 py-2 sm:px-5 sm:py-2.5 rounded-xl text-sm font-bold transition-colors flex items-center gap-2 shadow-sm shrink-0"
          >
            <X className="w-4 h-4" />
            <span className="hidden sm:inline">Leave Room</span>
            <span className="sm:hidden">Leave</span>
          </button>
        </div>
        <div className="flex-1 w-full h-full bg-black">
          <iframe
            src={`https://meet.jit.si/${roomId}#config.prejoinPageEnabled=false&config.startWithAudioMuted=false&config.startWithVideoMuted=false&config.disableModeratorIndicator=true&interfaceConfig.SHOW_JITSI_WATERMARK=false&interfaceConfig.SHOW_WATERMARK_FOR_GUESTS=false&interfaceConfig.HIDE_INVITE_MORE_HEADER=true&userInfo.displayName=${encodeURIComponent(user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User')}`}
            className="w-full h-full border-0"
            allow="camera; microphone; fullscreen; display-capture; autoplay"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <div className="text-center mb-12">
        <h1 className="serif text-4xl font-bold text-sage-dark mb-4">Prayer Rooms</h1>
        <p className="text-ink/70">Connect with believers around the world to pray together.</p>
      </div>
      
      {user && (
        <div className="bg-white p-8 rounded-[2rem] border border-sage/10 shadow-sm mb-12">
          <h2 className="text-xl font-bold text-sage-dark mb-6">Create a Room</h2>
          <input 
            placeholder="Room Name (Required)" 
            value={newRoomName} 
            onChange={e => setNewRoomName(e.target.value)} 
            className="w-full p-4 rounded-xl border border-sage/20 focus:outline-none focus:ring-2 focus:ring-sage/50 bg-sage/5 mb-4" 
          />
          <input 
            placeholder="Description (Required)" 
            value={newRoomDesc} 
            onChange={e => setNewRoomDesc(e.target.value)} 
            className="w-full p-4 rounded-xl border border-sage/20 focus:outline-none focus:ring-2 focus:ring-sage/50 bg-sage/5 mb-4" 
          />
          <div className="flex gap-4 mb-6">
            <div className="w-full">
              <label className="text-xs font-bold text-sage-dark uppercase tracking-wider mb-1 block">Start Date</label>
              <input 
                type="date"
                value={newRoomStart} 
                onChange={e => setNewRoomStart(e.target.value)} 
                className="w-full p-4 rounded-xl border border-sage/20 focus:outline-none focus:ring-2 focus:ring-sage/50 bg-sage/5" 
              />
            </div>
            <div className="w-full">
              <label className="text-xs font-bold text-sage-dark uppercase tracking-wider mb-1 block">Expiry Date</label>
              <input 
                type="date"
                value={newRoomExpiry} 
                onChange={e => setNewRoomExpiry(e.target.value)} 
                className="w-full p-4 rounded-xl border border-sage/20 focus:outline-none focus:ring-2 focus:ring-sage/50 bg-sage/5" 
              />
            </div>
          </div>
          <button 
            onClick={handleCreateRoom} 
            disabled={isCreating}
            className="w-full bg-sage text-white px-6 py-4 rounded-xl flex items-center justify-center gap-2 hover:bg-sage-dark transition-colors font-medium shadow-lg shadow-sage/20 text-lg"
          >
            {isCreating ? <Loader2 className="animate-spin" /> : <Plus size={20} />} Create Room
          </button>
        </div>
      )}

      <div className="space-y-4 mb-12">
        <h3 className="text-sm font-bold text-sage-dark uppercase tracking-wider mb-4">Default Rooms</h3>
        {['General Prayer', 'Bible Study', 'Testimonies'].map(preset => (
          <div key={preset} className="bg-white p-6 rounded-2xl border border-sage/10 flex justify-between items-center">
            <span className="font-medium text-sage-dark">{preset}</span>
            <button 
              onClick={() => handleJoinCall(preset, true)}
              className="bg-sage/10 text-sage-dark px-5 py-2.5 rounded-full text-sm font-medium hover:bg-sage/20 transition-colors"
            >
              Join
            </button>
          </div>
        ))}
      </div>

      <div className="space-y-4">
        <h3 className="text-sm font-bold text-sage-dark uppercase tracking-wider mb-4">Community Rooms</h3>
        {loading ? <Loader2 className="animate-spin mx-auto text-sage" /> : rooms.map(room => (
          <div key={room.id} className="bg-white p-6 rounded-2xl border border-sage/10 flex justify-between items-center">
            <div>
              <h4 className="font-bold text-sage-dark">{room.name}</h4>
              <p className="text-sm text-ink/60">{room.description}</p>
              <p className="text-xs text-ink/40 mt-1">Creator: {room.creatorName}</p>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => handleJoinCall(room.name, false)}
                className="bg-sage text-white px-5 py-2.5 rounded-full text-sm font-medium hover:bg-sage-dark transition-colors"
              >
                Join
              </button>
              {(user?.id === room.createdBy || user?.email === 'kayodeolufowobi709@gmail.com') && (
                <button 
                  onClick={() => handleDeleteRoom(room.id)}
                  className="p-2.5 text-red-500 hover:bg-red-50 rounded-full transition-colors"
                >
                  <Trash2 size={18} />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
