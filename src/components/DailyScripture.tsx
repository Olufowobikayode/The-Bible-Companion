import { useState, useEffect } from 'react';
import { DAILY_SCRIPTURES } from '../lib/scriptures';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles } from 'lucide-react';
import { callGemini, safeParseJSON } from '../lib/gemini';
import { Type } from '@google/genai';

export default function DailyScripture() {
  const [scripture, setScripture] = useState(DAILY_SCRIPTURES[Math.floor(Math.random() * DAILY_SCRIPTURES.length)]);

  useEffect(() => {
    const fetchDaily = async () => {
      try {
        const res = await fetch('/api/scripture/daily');
        if (res.ok) {
          const data = await res.json();
          if (data) {
            setScripture(data);
          } else {
            // Generate new one using Gemini if backend has no cached version
            console.log("[DailyScripture] No cached scripture, generating new one...");
            const response = await callGemini({
              model: "gemini-3-flash-preview",
              contents: "Provide a beautiful, encouraging Bible verse for today. Return ONLY a JSON object: { \"reference\": \"string\", \"text\": \"string\" }",
              config: {
                responseMimeType: "application/json",
                responseSchema: {
                  type: Type.OBJECT,
                  properties: {
                    reference: { type: Type.STRING },
                    text: { type: Type.STRING }
                  },
                  required: ["reference", "text"]
                }
              }
            });
            
            const newScripture = safeParseJSON(response);
            if (newScripture && newScripture.reference) {
              setScripture(newScripture);
              // Save to backend for other users
              await fetch('/api/scripture/daily', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ scripture: newScripture })
              });
            }
          }
        }
      } catch (error) {
        console.error("Error fetching daily scripture:", error);
      }
    };
    fetchDaily();
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
