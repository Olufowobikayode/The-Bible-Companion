import { useParams, Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { User, Calendar, Mail, ChevronLeft, MapPin, Heart, BookOpen, MessageCircle } from 'lucide-react';
import { motion } from 'motion/react';
import { toast } from 'sonner';

export default function UserProfile() {
  const { username } = useParams<{ username: string }>();
  const [profile, setProfile] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!username) return;
      setIsLoading(true);
      try {
        const data = await api.get(`/api/users/by-username/${username}`);
        setProfile(data);
      } catch (error) {
        console.error('Failed to fetch profile:', error);
        toast.error('User not found');
      } finally {
        setIsLoading(false);
      }
    };
    fetchProfile();
  }, [username]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-12 h-12 border-4 border-sage/20 border-t-sage rounded-full animate-spin" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="max-w-md mx-auto p-12 text-center space-y-6">
        <div className="w-24 h-24 bg-sage-light/30 rounded-full flex items-center justify-center mx-auto">
          <User className="w-12 h-12 text-sage/20" />
        </div>
        <h1 className="serif text-3xl font-semibold text-sage-dark">User Not Found</h1>
        <p className="text-ink/60">The traveler you're looking for hasn't joined our community yet.</p>
        <Link to="/search" className="inline-block bg-sage text-white px-8 py-3 rounded-2xl font-medium hover:bg-sage-dark transition-all">
          Back to Search
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-8 space-y-8">
      <Link to="/search" className="inline-flex items-center gap-2 text-sage hover:text-sage-dark font-medium transition-colors">
        <ChevronLeft size={20} />
        Back to Search
      </Link>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden bg-white border border-sage/10 rounded-[3rem] shadow-2xl shadow-sage/5"
      >
        <div className="h-48 bg-gradient-to-br from-sage-light/40 to-sage/10" />
        
        <div className="px-8 pb-12 -mt-16 space-y-8">
          <div className="flex flex-col sm:flex-row items-end gap-6">
            <div className="w-32 h-32 bg-cream border-8 border-white rounded-[2.5rem] flex items-center justify-center text-sage shadow-xl">
              <User size={64} />
            </div>
            <div className="flex-grow pb-4 space-y-1">
              <h1 className="serif text-4xl font-semibold text-sage-dark">@{profile.username}</h1>
              <p className="text-xl text-ink/40">{profile.displayName || 'Spiritual Traveler'}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
            <div className="space-y-6">
              <div className="space-y-4">
                <h2 className="text-xs font-bold text-ink/20 uppercase tracking-[0.2em]">About</h2>
                <p className="text-ink/70 leading-relaxed text-lg italic">
                  "{profile.bio || 'This traveler is still writing their story...'}"
                </p>
              </div>

              <div className="flex flex-wrap gap-4">
                <div className="flex items-center gap-2 px-4 py-2 bg-sage-light/20 rounded-xl text-sage text-sm font-medium">
                  <Calendar size={16} />
                  Joined {new Date(profile.createdAt).toLocaleDateString()}
                </div>
                {profile.location && (
                  <div className="flex items-center gap-2 px-4 py-2 bg-sage-light/20 rounded-xl text-sage text-sm font-medium">
                    <MapPin size={16} />
                    {profile.location}
                  </div>
                )}
              </div>
            </div>

            <div className="bg-sage-light/10 rounded-[2.5rem] p-8 space-y-6 border border-sage/5">
              <h2 className="text-xs font-bold text-ink/20 uppercase tracking-[0.2em]">Spiritual Footprint</h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-white rounded-2xl border border-sage/10 text-center space-y-1">
                  <Heart className="w-5 h-5 text-sage/40 mx-auto" />
                  <p className="text-2xl font-bold text-sage-dark">0</p>
                  <p className="text-[10px] text-ink/30 uppercase tracking-widest font-bold">Prayers</p>
                </div>
                <div className="p-4 bg-white rounded-2xl border border-sage/10 text-center space-y-1">
                  <BookOpen className="w-5 h-5 text-sage/40 mx-auto" />
                  <p className="text-2xl font-bold text-sage-dark">0</p>
                  <p className="text-[10px] text-ink/30 uppercase tracking-widest font-bold">Studies</p>
                </div>
                <div className="p-4 bg-white rounded-2xl border border-sage/10 text-center space-y-1">
                  <MessageCircle className="w-5 h-5 text-sage/40 mx-auto" />
                  <p className="text-2xl font-bold text-sage-dark">0</p>
                  <p className="text-[10px] text-ink/30 uppercase tracking-widest font-bold">Posts</p>
                </div>
                <div className="p-4 bg-white rounded-2xl border border-sage/10 text-center space-y-1">
                  <User className="w-5 h-5 text-sage/40 mx-auto" />
                  <p className="text-2xl font-bold text-sage-dark">0</p>
                  <p className="text-[10px] text-ink/30 uppercase tracking-widest font-bold">Followers</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
