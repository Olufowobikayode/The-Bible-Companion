import React, { useState, useEffect } from 'react';
import { Bell, X, MessageSquare, Heart, Award, Info } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { api } from '../lib/api';
import { motion, AnimatePresence } from 'motion/react';
import { Link } from 'react-router-dom';

interface Notification {
  id: string;
  type: 'reply' | 'prayer' | 'milestone' | 'info';
  title: string;
  message: string;
  link?: string;
  read: boolean;
  createdAt: any;
}

export default function NotificationCenter() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [user, setUser] = useState<any>(null);

  const fetchNotifications = async () => {
    try {
      const data = await api.get('/api/notifications');
      setNotifications(data);
      setUnreadCount(data.filter((n: any) => !n.read).length);
    } catch (error) {
      console.error("Error fetching notifications:", error);
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) fetchNotifications();
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) fetchNotifications();
      else {
        setNotifications([]);
        setUnreadCount(0);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const markAsRead = async (id: string) => {
    try {
      await api.post(`/api/notifications/${id}/read`, {});
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'reply': return <MessageSquare className="w-4 h-4 text-blue-500" />;
      case 'prayer': return <Heart className="w-4 h-4 text-red-500" />;
      case 'milestone': return <Award className="w-4 h-4 text-amber-500" />;
      default: return <Info className="w-4 h-4 text-sage" />;
    }
  };

  return (
    <div className="relative">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 text-ink/40 hover:text-sage transition-colors relative"
      >
        <Bell size={22} />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-cream">
            {unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <div 
              className="fixed inset-0 z-[60]" 
              onClick={() => setIsOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-3xl shadow-2xl border border-sage/10 z-[70] overflow-hidden"
            >
              <div className="p-6 border-b border-sage/10 flex justify-between items-center bg-sage-light/10">
                <h3 className="serif text-xl font-bold text-sage-dark">Notifications</h3>
                <button onClick={() => setIsOpen(false)} className="text-ink/20 hover:text-ink">
                  <X size={20} />
                </button>
              </div>

              <div className="max-h-[400px] overflow-y-auto">
                {notifications.length > 0 ? (
                  notifications.map(n => (
                    <div 
                      key={n.id} 
                      className={`p-4 border-b border-sage/5 hover:bg-sage-light/5 transition-colors relative ${!n.read ? 'bg-sage-light/10' : ''}`}
                      onClick={() => !n.read && markAsRead(n.id)}
                    >
                      <div className="flex gap-3">
                        <div className="mt-1">{getIcon(n.type)}</div>
                        <div className="flex-grow">
                          <p className={`text-sm ${!n?.read ? 'font-bold' : 'font-medium'} text-ink`}>{n?.title || ''}</p>
                          <p className="text-xs text-ink/60 mt-1">{n.message}</p>
                          <div className="flex justify-between items-center mt-2">
                            <span className="text-[10px] text-ink/20">
                              {new Date(n.createdAt).toLocaleString()}
                            </span>
                            {n.link && (
                              <Link 
                                to={n.link} 
                                onClick={() => setIsOpen(false)}
                                className="text-[10px] font-bold text-sage uppercase tracking-widest hover:underline"
                              >
                                View
                              </Link>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-12 text-center">
                    <Bell className="w-12 h-12 text-sage/10 mx-auto mb-4" />
                    <p className="text-sm text-ink/40 italic">No notifications yet.</p>
                  </div>
                )}
              </div>
              
              <div className="p-4 bg-sage-light/5 text-center">
                <button className="text-[10px] font-bold text-sage uppercase tracking-widest hover:underline">
                  Mark all as read
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
