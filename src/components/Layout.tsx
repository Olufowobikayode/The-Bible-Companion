import { ReactNode, useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import DailyScripture from './DailyScripture';
import { Book, Heart, Home, MessageCircle, LogOut, Search, Menu, X, User as UserIcon, BookOpen, Languages, MessageSquare, Database, PenLine, Play, Activity, Send, Video, Music, LayoutDashboard, Sparkles, Compass, Calendar, Bookmark, Quote, Users, UserPlus, Hash, Sun, UserSearch } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import AuthModal from './AuthModal';
import NotificationCenter from './NotificationCenter';
import GlobalSearch from './GlobalSearch';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const { user, loading: isAuthLoading } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const normalizedPath = location.pathname.replace(/\/$/, '') || '/';
  const isChatPage = normalizedPath === '/chat';
  const isPrayerRoomsPage = normalizedPath === '/prayer-rooms';
  const isSpecificPrayerRoomPage = normalizedPath.startsWith('/prayer-rooms/') && normalizedPath.length > '/prayer-rooms/'.length;
  const isForumPage = normalizedPath.startsWith('/forum');
  const isNotificationsPage = normalizedPath === '/notifications';
  const isSpecificMessagePage = normalizedPath.startsWith('/messages/') && normalizedPath.length > '/messages/'.length;

  const shouldHideMenu = isChatPage || isNotificationsPage || isSpecificMessagePage || isSpecificPrayerRoomPage;

  const [isFirebaseOffline, setIsFirebaseOffline] = useState(false);
  const [isGeminiMissing, setIsGeminiMissing] = useState(false);

  useEffect(() => {
    // Dynamic offline detection
    const handleOnlineStatus = () => {
      setIsFirebaseOffline(!navigator.onLine);
    };

    window.addEventListener('online', handleOnlineStatus);
    window.addEventListener('offline', handleOnlineStatus);
    
    // Initial check
    handleOnlineStatus();

    // Check Gemini API Key (Backend handles this, so we just assume it's there or handle errors gracefully)
    // if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'undefined') {
    //   setIsGeminiMissing(true);
    // }

    return () => {
      window.removeEventListener('online', handleOnlineStatus);
      window.removeEventListener('offline', handleOnlineStatus);
    };
  }, []);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const navGroups = [
    {
      title: 'The Word',
      items: [
        { name: 'Holy Bible', path: '/bible', icon: Book },
        { name: 'Scripture Topics', path: '/topics', icon: Search },
        { name: 'Reading Plans', path: '/reading-plans', icon: BookOpen },
        { name: 'Biblical Concordance', path: '/concordance', icon: Languages },
      ]
    },
    {
      title: 'Spiritual Growth',
      items: [
        { name: 'Daily Bread', path: '/daily', icon: Heart },
        { name: 'Devotionals', path: '/devotional', icon: Book },
        { name: 'Holy Spirit Guidance', path: '/chat', icon: MessageCircle },
        { name: 'Prayer Journal', path: '/notepad', icon: PenLine },
        { name: 'Study Journeys', path: '/study-journeys', icon: BookOpen },
      ]
    },
    {
      title: 'Fellowship',
      items: [
        { name: 'Community Tabernacle', path: '/forum', icon: MessageSquare },
        { name: 'Cloud of Witnesses', path: '/testimonies', icon: Heart },
        { name: 'Connections', path: '/friends', icon: UserIcon },
        { name: 'Messages', path: '/messages', icon: Send },
        { name: 'My Bookmarks', path: '/bookmarks', icon: Bookmark },
        { name: 'My Profile', path: '/profile', icon: UserIcon },
      ]
    },
    {
      title: 'Intercession',
      items: [
        { name: 'Altar of Incense', path: '/prayer-wall', icon: Heart },
        { name: 'Upper Room', path: '/prayer-rooms', icon: Video },
      ]
    },
    {
      title: 'Resources',
      items: [
        { name: 'Media Search', path: '/media', icon: Search },
        { name: 'Manna (Offline)', path: '/offline', icon: Database },
      ]
    }
  ];

  const navItems = navGroups.flatMap(g => g.items);

  const bottomNavItems = [
    { name: 'Home', path: '/', icon: Home },
    { name: 'Bible', path: '/bible', icon: Book },
    { name: 'Companion', path: '/chat', icon: MessageCircle },
    { name: 'Prayer', path: '/prayer-wall', icon: Heart },
    { name: 'Forum', path: '/forum', icon: MessageSquare },
  ];

  if (isAuthLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cream">
        <motion.div
          animate={{ scale: [1, 1.05, 1], opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          className="flex flex-col items-center space-y-6"
        >
          <h1 className="serif text-5xl md:text-6xl font-bold text-sage-dark tracking-[0.2em]">VISION</h1>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-cream font-sans">
      <DailyScripture />
      {(isFirebaseOffline || isGeminiMissing) && (
        <div className="bg-destructive text-white px-4 py-2 text-center text-[10px] sm:text-xs font-bold sticky top-0 z-[100] animate-pulse">
          {isFirebaseOffline && "Firebase is offline. Check your connection or configuration. "}
          {isGeminiMissing && "Gemini API Key is missing. AI features will be disabled. "}
          Please check the Settings menu to configure API keys.
        </div>
      )}
      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />
      
      {!shouldHideMenu && (
        <header className="sticky top-0 z-50 bg-cream/80 backdrop-blur-xl border-b border-sage/10 shadow-sm safe-top transition-all duration-500">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-20 md:h-24">
              <Link to="/" className="flex items-center space-x-3 group">
                <span className="serif text-2xl md:text-3xl font-bold text-sage-dark tracking-[0.15em]">VISION</span>
              </Link>

              <div className="hidden lg:block flex-1 max-w-md mx-8">
                <GlobalSearch />
              </div>

              {/* Desktop Nav */}
              <nav className="hidden md:flex items-center space-x-2">
                {navItems.slice(0, 6).map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={cn(
                      "px-5 py-2.5 rounded-[2rem] text-sm font-medium transition-all duration-300",
                      location.pathname === item.path ? "text-sage-dark bg-sage/10 shadow-sm" : "text-ink/60 hover:text-sage-dark hover:bg-sage/5"
                    )}
                  >
                    {item.name}
                  </Link>
                ))}
                <div className="w-px h-6 bg-sage/20 mx-4" />
                {user ? (
                  <div className="flex items-center space-x-4 pl-2">
                    <NotificationCenter />
                    <Link to="/profile" className="flex items-center space-x-3 hover:opacity-80 transition-opacity">
                      <div className="flex flex-col items-end">
                        <span className="text-sm font-medium text-ink/80 leading-none">{user.user_metadata?.full_name || user.email}</span>
                      </div>
                      {user.user_metadata?.avatar_url ? (
                        <img src={user.user_metadata.avatar_url} alt="" className="w-10 h-10 rounded-full border border-sage/20 shadow-sm object-cover" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-sage-light flex items-center justify-center text-sage font-bold border border-sage/20 shadow-sm">
                          {(user.user_metadata?.full_name || user.email || 'U')[0].toUpperCase()}
                        </div>
                      )}
                    </Link>
                    <button 
                      onClick={handleLogout} 
                      className="p-2.5 text-ink/40 hover:text-sage-dark transition-colors hover:bg-sage/10 rounded-full"
                      title="Sign Out"
                    >
                      <LogOut size={18} />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setIsAuthModalOpen(true)}
                    className="bg-sage text-white px-8 py-3 rounded-[2rem] text-sm font-medium hover:bg-sage-dark transition-all shadow-md shadow-sage/10 active:scale-95"
                  >
                    Sign In
                  </button>
                )}
              </nav>

              {/* Mobile Menu Toggle */}
              <div className="md:hidden flex items-center space-x-3">
                {user && <NotificationCenter />}
                {user ? (
                  <button 
                    onClick={() => setIsMenuOpen(true)}
                    className="flex items-center space-x-2 p-1.5 pr-3 bg-white rounded-[2rem] border border-sage/10 shadow-sm active:scale-95 transition-transform"
                  >
                    <img src={user.user_metadata?.avatar_url || null} alt="" className="w-8 h-8 rounded-full border border-sage/10" />
                    <Menu size={18} className="text-sage-dark" />
                  </button>
                ) : (
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setIsAuthModalOpen(true)}
                      className="text-xs font-medium text-sage-dark uppercase tracking-widest px-3 py-2"
                    >
                      Sign In
                    </button>
                    <button 
                      className="bg-white p-2.5 rounded-full text-sage-dark border border-sage/10 shadow-sm active:scale-95 transition-transform" 
                      onClick={() => setIsMenuOpen(!isMenuOpen)}
                    >
                      <Menu size={20} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>
      )}

      {/* Mobile Nav Overlay */}
      <AnimatePresence>
        {isMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4, ease: "easeInOut" }}
              onClick={() => setIsMenuOpen(false)}
              className="fixed inset-0 bg-cream/80 backdrop-blur-sm z-[60] md:hidden"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 250 }}
              className="fixed right-0 top-0 bottom-0 w-[85%] max-w-sm bg-cream z-[70] md:hidden shadow-[-20px_0_50px_rgba(0,0,0,0.05)] flex flex-col safe-top safe-bottom border-l border-sage/10"
            >
              <div className="p-6 flex justify-between items-center border-b border-sage/10">
                <span className="serif text-2xl font-bold text-sage-dark tracking-[0.15em]">VISION</span>
                <button 
                  onClick={() => setIsMenuOpen(false)} 
                  className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-sage/10 text-ink/60 transition-colors"
                >
                  <X size={24} />
                </button>
              </div>
              
              <div className="flex-grow overflow-y-auto p-6 space-y-8">
                <div className="mb-6">
                  <GlobalSearch />
                </div>
                {user && (
                  <Link to="/profile" onClick={() => setIsMenuOpen(false)} className="flex items-center space-x-4 p-4 bg-white rounded-[2rem] mb-6 border border-sage/10 shadow-sm hover:bg-sage/5 transition-colors">
                    {user.user_metadata?.avatar_url ? (
                      <img src={user.user_metadata.avatar_url} alt="" className="w-14 h-14 rounded-full border border-sage/20 object-cover" />
                    ) : (
                      <div className="w-14 h-14 rounded-full bg-sage-light flex items-center justify-center text-sage font-bold border border-sage/20 shadow-sm text-xl">
                        {(user.user_metadata?.full_name || user.email || 'U')[0].toUpperCase()}
                      </div>
                    )}
                    <div className="overflow-hidden">
                      <p className="font-medium text-ink/80 truncate">{user.user_metadata?.full_name || user.email}</p>
                      <p className="text-xs text-ink/40 truncate">{user.email}</p>
                    </div>
                  </Link>
                )}
                
                {navGroups.map((group) => (
                  <div key={group?.title || ''} className="space-y-3">
                    <h3 className="text-[10px] font-medium text-sage uppercase tracking-[0.2em] px-4">{group?.title || ''}</h3>
                    <div className="grid grid-cols-1 gap-1">
                      {group.items.map((item) => (
                        <Link
                          key={item.path}
                          to={item.path}
                          onClick={() => setIsMenuOpen(false)}
                          className={cn(
                            "flex items-center space-x-4 px-4 py-3.5 rounded-[2rem] text-base font-medium transition-all group",
                            location.pathname === item.path 
                              ? "bg-sage/10 text-sage-dark shadow-sm" 
                              : "text-ink/60 hover:bg-sage/5 hover:text-sage-dark"
                          )}
                        >
                          <div className={cn(
                            "p-2 rounded-full transition-colors",
                            location.pathname === item.path ? "bg-white" : "bg-sage/5 group-hover:bg-sage/10"
                          )}>
                            <item.icon className="w-5 h-5" />
                          </div>
                          <span>{item.name}</span>
                        </Link>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-6 border-t border-sage/10 bg-white/50 space-y-4">
                {!user ? (
                  <button
                    onClick={() => { setIsMenuOpen(false); setIsAuthModalOpen(true); }}
                    className="w-full bg-sage text-white px-4 py-4 rounded-[2rem] text-base font-medium hover:bg-sage-dark shadow-md shadow-sage/10 active:scale-95 transition-all"
                  >
                    Sign In
                  </button>
                ) : (
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center justify-center space-x-2 text-sage-dark px-4 py-4 rounded-[2rem] border border-sage/20 bg-white font-medium hover:bg-sage/5 transition-colors"
                  >
                    <LogOut size={20} />
                    <span>Sign Out</span>
                  </button>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <main className={cn("flex-grow", !shouldHideMenu && "pb-24 md:pb-0")}>
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="h-full"
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Mobile Bottom Nav */}
      {!shouldHideMenu && (
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-cream/90 backdrop-blur-xl border-t border-sage/10 z-[100] safe-bottom">
          <div className="flex justify-around items-center h-20 px-2">
            {bottomNavItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex flex-col items-center justify-center space-y-1.5 flex-1 h-full transition-all duration-300",
                  location.pathname === item.path ? "text-sage-dark scale-105" : "text-ink/40 hover:text-ink/60"
                )}
              >
                <div className={cn(
                  "p-2 rounded-full transition-colors duration-300",
                  location.pathname === item.path ? "bg-sage/10" : "bg-transparent"
                )}>
                  <item.icon className={cn("w-5 h-5", location.pathname === item.path && "fill-sage/10")} />
                </div>
                <span className="text-[10px] font-medium tracking-wide">{item.name}</span>
              </Link>
            ))}
          </div>
        </nav>
      )}

      <footer className="bg-cream border-t border-sage/10 py-16 mt-20 hidden md:block">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="serif text-3xl text-sage-dark mb-6 tracking-[0.15em]">VISION</p>
          <p className="text-ink/60 text-sm max-w-md mx-auto leading-relaxed">
            A respectful, calm, prayerful digital companion for Bible reading, daily encouragement, prayer support, study, community interaction, and spiritual growth.
          </p>
          <div className="mt-12 pt-8 border-t border-sage/10 text-ink/40 text-xs tracking-widest uppercase">
            © {new Date().getFullYear()} VISION. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
