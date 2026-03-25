import { motion, AnimatePresence } from 'motion/react';
import { X, LogIn, User, Mail, Lock } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import { useState } from 'react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
      const body = isLogin ? { username, password } : { email, username, password };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Authentication failed');

      // Set the session in Supabase client
      const { error } = await supabase.auth.setSession(data.session);
      if (error) throw error;

      toast.success(isLogin ? 'Welcome back!' : 'Account created successfully!');
      onClose();
    } catch (error: any) {
      console.error('Auth error:', error);
      toast.error(error.message);
    } finally {
      setIsLoading(false);
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
              <div className="w-16 h-16 bg-sage-light rounded-full flex items-center justify-center mx-auto mb-4">
                <LogIn className="w-8 h-8 text-sage" />
              </div>
              
              <h2 className="serif text-3xl font-semibold text-sage-dark">
                {isLogin ? 'Welcome Back' : 'Join the Community'}
              </h2>
              <p className="text-ink/60 text-sm">
                {isLogin 
                  ? 'Sign in to access your personalized spiritual journey.' 
                  : 'Create an account to start your journey with us.'}
              </p>

              <form onSubmit={handleSubmit} className="space-y-4 text-left">
                {!isLogin && (
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-ink/40 uppercase tracking-wider ml-1">Email</label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-sage/40" />
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full pl-12 pr-4 py-3 bg-white border border-sage/20 rounded-xl focus:outline-none focus:border-sage transition-colors"
                        placeholder="your@email.com"
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-ink/40 uppercase tracking-wider ml-1">Username</label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-sage/40" />
                    <input
                      type="text"
                      required
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full pl-12 pr-4 py-3 bg-white border border-sage/20 rounded-xl focus:outline-none focus:border-sage transition-colors"
                      placeholder="username"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-ink/40 uppercase tracking-wider ml-1">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-sage/40" />
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-12 pr-4 py-3 bg-white border border-sage/20 rounded-xl focus:outline-none focus:border-sage transition-colors"
                      placeholder="••••••••"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-sage text-white py-4 rounded-xl font-semibold hover:bg-sage-dark transition-all shadow-lg shadow-sage/20 disabled:opacity-50"
                >
                  {isLoading ? 'Processing...' : (isLogin ? 'Sign In' : 'Create Account')}
                </button>
              </form>

              <div className="pt-4 space-y-2">
                <button
                  onClick={() => setIsLogin(!isLogin)}
                  className="text-sm text-sage font-medium hover:underline block w-full"
                >
                  {isLogin ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
                </button>
                
                <button
                  onClick={async () => {
                    setIsLoading(true);
                    try {
                      const res = await fetch('/api/auth/create-demo', { method: 'POST' });
                      const data = await res.json();
                      if (!res.ok) throw new Error(data.error);
                      
                      // Auto login after creating demo
                      const loginRes = await fetch('/api/auth/login', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ username: data.username, password: data.password })
                      });
                      const loginData = await loginRes.json();
                      if (!loginRes.ok) throw new Error(loginData.error);
                      
                      const { error } = await supabase.auth.setSession(loginData.session);
                      if (error) throw error;
                      
                      toast.success('Demo user ready! Welcome.');
                      onClose();
                    } catch (error: any) {
                      toast.error(error.message);
                    } finally {
                      setIsLoading(false);
                    }
                  }}
                  className="text-xs text-ink/40 hover:text-sage transition-colors"
                >
                  Create & Login as Demo User
                </button>
              </div>

              <p className="text-[10px] text-ink/30 uppercase tracking-widest pt-4">
                Safe • Secure • Respectful
              </p>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
