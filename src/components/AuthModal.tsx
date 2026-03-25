import { motion, AnimatePresence } from 'motion/react';
import { X, LogIn } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const handleGoogleSignIn = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin
        }
      });
      if (error) throw error;
      // Note: signInWithOAuth redirects, so toast/onClose won't be seen immediately
    } catch (error) {
      console.error('Sign in failed:', error);
      toast.error('Sign in failed. Please try again.');
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-ink/40 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative w-full max-w-md bg-cream rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-2xl p-8 sm:p-12 border border-sage/10 mt-auto sm:mt-0"
          >
            <button
              onClick={onClose}
              className="absolute right-6 top-6 p-2 text-ink/40 hover:text-sage transition-colors"
            >
              <X size={24} />
            </button>

            <div className="text-center space-y-6">
              <div className="w-20 h-20 bg-sage-light rounded-full flex items-center justify-center mx-auto mb-8">
                <LogIn className="w-10 h-10 text-sage" />
              </div>
              
              <h2 className="serif text-3xl font-semibold text-sage-dark">Welcome Back</h2>
              <p className="text-ink/60">
                Sign in to save your bookmarks, track your journey, and access personalized encouragement.
              </p>

              <button
                onClick={handleGoogleSignIn}
                className="w-full flex items-center justify-center gap-3 bg-white border border-sage/20 text-ink/80 px-6 py-4 rounded-2xl font-medium hover:bg-sage-light hover:border-sage transition-all shadow-sm"
              >
                <img src="https://www.google.com/favicon.ico" alt="" className="w-5 h-5" />
                Continue with Google
              </button>

              <p className="text-[10px] text-ink/30 uppercase tracking-widest">
                Safe • Secure • Respectful
              </p>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
