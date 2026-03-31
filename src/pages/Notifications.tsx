import React, { useState, useEffect } from 'react';
import { Bell, MessageSquare, Heart, Award, Info, ChevronLeft } from 'lucide-react';
import { api } from '../lib/api';
import { motion } from 'motion/react';
import { Link, useNavigate } from 'react-router-dom';

interface Notification {
  id: string;
  type: 'reply' | 'prayer' | 'milestone' | 'info';
  title: string;
  message: string;
  link?: string;
  read: boolean;
  createdAt: any;
}

export default function Notifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const navigate = useNavigate();

  const fetchNotifications = async () => {
    try {
      const data = await api.get('/api/notifications');
      setNotifications(data);
    } catch (error) {
      console.error("Error fetching notifications:", error);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const markAsRead = async (id: string) => {
    try {
      await api.post(`/api/notifications/${id}/read`, {});
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'reply': return <MessageSquare className="w-5 h-5 text-blue-500" />;
      case 'prayer': return <Heart className="w-5 h-5 text-red-500" />;
      case 'milestone': return <Award className="w-5 h-5 text-amber-500" />;
      default: return <Info className="w-5 h-5 text-sage" />;
    }
  };

  return (
    <div className="min-h-screen bg-cream p-4 pb-8">
      <div className="flex items-center gap-4 mb-8">
        <button onClick={() => navigate(-1)} className="p-2 rounded-full hover:bg-sage/10">
          <ChevronLeft size={24} className="text-sage-dark" />
        </button>
        <h1 className="serif text-2xl font-bold text-sage-dark">Notifications</h1>
      </div>

      <div className="space-y-4">
        {notifications.length > 0 ? (
          notifications.map(n => (
            <div 
              key={n.id} 
              className={`p-4 rounded-2xl border border-sage/10 bg-white transition-colors ${!n.read ? 'border-sage/30' : ''}`}
              onClick={() => !n.read && markAsRead(n.id)}
            >
              <div className="flex gap-4">
                <div className="mt-1">{getIcon(n.type)}</div>
                <div className="flex-grow">
                  <p className={`text-sm ${!n.read ? 'font-bold' : 'font-medium'} text-ink`}>{n.title}</p>
                  <p className="text-xs text-ink/60 mt-1">{n.message}</p>
                  <div className="flex justify-between items-center mt-3">
                    <span className="text-[10px] text-ink/40">
                      {new Date(n.createdAt).toLocaleString()}
                    </span>
                    {n.link && (
                      <Link 
                        to={n.link} 
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
    </div>
  );
}
