import { useState, useEffect } from 'react';
import { DAILY_SCRIPTURES } from '../lib/scriptures';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles } from 'lucide-react';

export default function DailyScripture() {
  const [scripture, setScripture] = useState(DAILY_SCRIPTURES[0]);

  useEffect(() => {
    // Get a deterministic scripture based on the current date
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 0);
    const diff = now.getTime() - startOfYear.getTime();
    const oneDay = 1000 * 60 * 60 * 24;
    const dayOfYear = Math.floor(diff / oneDay);
    
    const index = dayOfYear % DAILY_SCRIPTURES.length;
    setScripture(DAILY_SCRIPTURES[index]);
  }, []);

  return (
    <div className="bg-sage-dark text-white py-2 px-4 overflow-hidden relative">
      <div className="max-w-7xl mx-auto flex items-center justify-center gap-4 text-center">
        <Sparkles size={14} className="text-sage-light shrink-0 hidden sm:block" />
        <AnimatePresence mode="wait">
          <motion.div
            key={scripture.reference}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2"
          >
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-sage-light">Daily Word:</span>
            <p className="text-[11px] sm:text-sm font-medium italic line-clamp-1">"{scripture.text}"</p>
            <span className="text-[10px] sm:text-xs font-bold text-sage-light whitespace-nowrap">— {scripture.reference}</span>
          </motion.div>
        </AnimatePresence>
        <Sparkles size={14} className="text-sage-light shrink-0 hidden sm:block" />
      </div>
      
      {/* Subtle background glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-full bg-sage-light/10 blur-xl pointer-events-none" />
    </div>
  );
}
