import { ReactNode, useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { auth, signOut } from '../firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { supabase } from '../lib/supabase';
import { User as SupabaseUser } from '@supabase/supabase-js';
import DailyScripture from './DailyScripture';
import { Book, Heart, Home, MessageCircle, LogOut, Search, Menu, X, User as UserIcon, BookOpen, Languages, MessageSquare, Database, PenLine, Play, Activity, Send, Video, Music, LayoutDashboard, Sparkles, Compass, Calendar, Bookmark, Quote, Users, UserPlus, Hash, Sun } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import AuthModal from './AuthModal';
import NotificationCenter from './NotificationCenter';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const location = useLocation();

  const [isFirebaseOffline, setIsFirebaseOffline] = useState(false);
  const [isGeminiMissing, setIsGeminiMissing] = useState(false);

  useEffect(() => {
    // Initial session check
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setIsAuthLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setIsAuthLoading(false);
    });

    // Dynamic offline detection
    const handleOnlineStatus = () => {
      setIsFirebaseOffline(!navigator.onLine);
    };

    window.addEventListener('online', handleOnlineStatus);
    window.addEventListener('offline', handleOnlineStatus);
    
    // Initial check
    handleOnlineStatus();

    // Check Gemini API Key
    if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'undefined') {
      setIsGeminiMissing(true);
    }

    return () => {
      subscription.unsubscribe();
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
        { name: 'Spiritual Dashboard', path: '/dashboard', icon: Activity },
        { name: 'Study Journeys', path: '/study-journeys', icon: BookOpen },
      ]
    },
    {
      title: 'Fellowship',
      items: [
        { name: 'Community Tabernacle', path: '/forum', icon: MessageSquare },
        { name: 'Cloud of Witnesses', path: '/testimonies', icon: Heart },
        { name: 'Prayer Groups', path: '/groups', icon: UserIcon },
        { name: 'Brethren', path: '/friends', icon: UserIcon },
        { name: 'Word for Someone', path: '/messages', icon: Send },
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
        { name: 'Worship Sanctuary', path: '/media', icon: Play },
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

  return (
    <div className="min-h-screen flex flex-col bg-cream">
      <DailyScripture />
      {(isFirebaseOffline || isGeminiMissing) && (
        <div className="bg-destructive text-white px-4 py-2 text-center text-[10px] sm:text-xs font-bold sticky top-0 z-[100] animate-pulse">
          {isFirebaseOffline && "Firebase is offline. Check your connection or configuration. "}
          {isGeminiMissing && "Gemini API Key is missing. AI features will be disabled. "}
          Please check the Settings menu to configure API keys.
        </div>
      )}
      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />
      
      <header className="sticky top-0 z-50 bg-cream border-b border-sage/10 shadow-sm safe-top">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16 md:h-20">
            <Link to="/" className="flex items-center space-x-3 group">
              <div className="w-9 h-9 md:w-11 md:h-11 bg-sage rounded-xl flex items-center justify-center text-white shadow-lg shadow-sage/20 group-hover:scale-105 transition-transform">
                <Book className="w-5 h-5 md:w-6 md:h-6" />
              </div>
              <span className="serif text-xl md:text-2xl font-bold text-sage-dark tracking-tight">The Bible Companion</span>
            </Link>

            {/* Desktop Nav */}
            <nav className="hidden md:flex items-center space-x-1">
              {navItems.slice(0, 6).map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    "px-4 py-2 rounded-xl text-sm font-semibold transition-all hover:bg-sage-light/50",
                    location.pathname === item.path ? "text-sage-dark bg-sage-light" : "text-ink/60 hover:text-sage-dark"
                  )}
                >
                  {item.name}
                </Link>
              ))}
              <div className="w-px h-6 bg-sage/10 mx-4" />
              {isAuthLoading ? (
                <div className="w-24 h-10 bg-sage/5 animate-pulse rounded-xl" />
              ) : user ? (
                <div className="flex items-center space-x-3 pl-2">
                  <NotificationCenter />
                  <div className="flex flex-col items-end">
                    <span className="text-xs font-bold text-ink/80 leading-none">{user.user_metadata?.full_name || user.email}</span>
                    <span className="text-[10px] text-sage font-bold uppercase tracking-widest mt-1">Member</span>
                  </div>
                  <img src={user.user_metadata?.avatar_url || ''} alt="" className="w-10 h-10 rounded-xl border-2 border-white shadow-md" />
                  <button 
                    onClick={handleLogout} 
                    className="p-2 text-ink/30 hover:text-red-500 transition-colors hover:bg-red-50 rounded-lg"
                    title="Sign Out"
                  >
                    <LogOut size={18} />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setIsAuthModalOpen(true)}
                  className="bg-sage text-white px-8 py-2.5 rounded-xl text-sm font-bold hover:bg-sage-dark transition-all shadow-lg shadow-sage/20 active:scale-95"
                >
                  Sign In
                </button>
              )}
            </nav>

            {/* Mobile Menu Toggle */}
            <div className="md:hidden flex items-center space-x-3">
              {user && <NotificationCenter />}
              {isAuthLoading ? (
                <div className="w-8 h-8 bg-sage/5 animate-pulse rounded-lg" />
              ) : user ? (
                <button 
                  onClick={() => setIsMenuOpen(true)}
                  className="flex items-center space-x-2 p-1 pr-3 bg-white rounded-xl border border-sage/10 shadow-sm active:scale-95 transition-transform"
                >
                  <img src={user.user_metadata?.avatar_url || ''} alt="" className="w-8 h-8 rounded-lg border border-sage-light shadow-sm" />
                  <Menu size={18} className="text-sage-dark" />
                </button>
              ) : (
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setIsAuthModalOpen(true)}
                    className="text-xs font-bold text-sage-dark uppercase tracking-widest px-3 py-2"
                  >
                    Sign In
                  </button>
                  <button 
                    className="bg-white p-2 rounded-xl text-sage-dark border border-sage/10 shadow-sm active:scale-95 transition-transform" 
                    onClick={() => setIsMenuOpen(!isMenuOpen)}
                  >
                    <Menu size={22} />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Mobile Nav Overlay */}
        <AnimatePresence>
          {isMenuOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsMenuOpen(false)}
                className="fixed inset-0 bg-ink/40 backdrop-blur-md z-40 md:hidden"
              />
              <motion.div
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="fixed right-0 top-0 bottom-0 w-[85%] max-w-sm bg-white z-50 md:hidden shadow-[-20px_0_50px_rgba(0,0,0,0.1)] flex flex-col safe-top safe-bottom"
              >
                <div className="p-6 flex justify-between items-center border-b border-sage/10 bg-white/50">
                  <div className="flex items-center space-x-3">
                    <div className="w-9 h-9 bg-sage rounded-xl flex items-center justify-center text-white shadow-lg shadow-sage/20">
                      <Book className="w-5 h-5" />
                    </div>
                    <span className="serif text-xl font-bold text-sage-dark">Library Menu</span>
                  </div>
                  <button 
                    onClick={() => setIsMenuOpen(false)} 
                    className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-sage-light text-ink/40 transition-colors"
                  >
                    <X size={24} />
                  </button>
                </div>
                
                <div className="flex-grow overflow-y-auto p-6 space-y-8">
                  {user && (
                    <div className="flex items-center space-x-4 p-4 bg-sage-light/10 rounded-3xl mb-6 border border-sage/5">
                      <img src={user.user_metadata?.avatar_url || ''} alt="" className="w-14 h-14 rounded-full border-2 border-white shadow-md" />
                      <div className="overflow-hidden">
                        <p className="font-bold text-ink/80 truncate">{user.user_metadata?.full_name || user.email}</p>
                        <p className="text-xs text-ink/40 truncate">{user.email}</p>
                      </div>
                    </div>
                  )}
                  
                  {navGroups.map((group) => (
                    <div key={group.title} className="space-y-3">
                      <h3 className="text-[10px] font-bold text-sage uppercase tracking-[0.2em] px-4">{group.title}</h3>
                      <div className="grid grid-cols-1 gap-1">
                        {group.items.map((item) => (
                          <Link
                            key={item.path}
                            to={item.path}
                            onClick={() => setIsMenuOpen(false)}
                            className={cn(
                              "flex items-center space-x-4 px-4 py-3.5 rounded-2xl text-base font-medium transition-all group",
                              location.pathname === item.path 
                                ? "bg-sage text-white shadow-lg shadow-sage/20" 
                                : "text-ink/60 hover:bg-sage-light/10 hover:text-sage-dark"
                            )}
                          >
                            <div className={cn(
                              "p-2 rounded-xl transition-colors",
                              location.pathname === item.path ? "bg-white/20" : "bg-sage-light/5 group-hover:bg-sage-light/20"
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
                      className="w-full bg-sage text-white px-4 py-4 rounded-2xl text-base font-bold hover:bg-sage-dark shadow-xl shadow-sage/20 active:scale-95 transition-all"
                    >
                      Sign In to Your Account
                    </button>
                  ) : (
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center justify-center space-x-2 text-red-500 px-4 py-4 rounded-2xl border border-red-100 bg-red-50/5 font-bold hover:bg-red-100/20 transition-colors"
                    >
                      <LogOut size={20} />
                      <span>Sign Out</span>
                    </button>
                  )}
                  <p className="text-[10px] text-center text-ink/30 uppercase tracking-[0.2em] font-medium">
                    The Bible Companion • v1.0
                  </p>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </header>

      <main className="flex-grow pb-24 md:pb-0">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Mobile Bottom Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-cream/90 backdrop-blur-lg border-t border-sage/10 z-50 safe-bottom">
        <div className="flex justify-around items-center h-16 px-2">
          {bottomNavItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex flex-col items-center justify-center space-y-1 flex-1 h-full transition-all",
                location.pathname === item.path ? "text-sage-dark scale-110" : "text-ink/40"
              )}
            >
              <item.icon className={cn("w-5 h-5", location.pathname === item.path && "fill-sage/10")} />
              <span className="text-[10px] font-bold uppercase tracking-tighter">{item.name}</span>
            </Link>
          ))}
        </div>
      </nav>

      <footer className="bg-cream border-t border-sage/10 py-12 mt-20 hidden md:block">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="serif text-xl text-sage-dark mb-4">The Bible Companion</p>
          <p className="text-ink/40 text-sm max-w-md mx-auto">
            A quiet place for Scripture, encouragement, and peace during difficult moments. Interactive faith-based companion with AI-powered guidance, full Bible access, and daily devotionals.
          </p>
          <div className="mt-8 pt-8 border-t border-sage/5 text-ink/30 text-xs">
            © {new Date().getFullYear()} The Bible Companion. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
