import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Book, ChevronRight, ChevronLeft, Sparkles, Heart, ShieldCheck, Loader2 } from 'lucide-react';
import { db, auth } from '../firebase';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';

const DEVOTIONAL_DAYS = Array.from({ length: 30 }, (_, i) => ({
  day: i + 1,
  title: i === 0 ? "Peace in Chaos" : `Day ${i + 1}: Finding Strength`,
  scripture: i === 0 ? "John 16:33" : "Philippians 4:13",
  reflection: i === 0 
    ? "In the midst of the world's chaos, Jesus offers a peace that surpasses all understanding. He doesn't promise a life without trouble, but He promises His presence through it all. When the waves crash, He is the anchor."
    : "Today we focus on the strength that comes not from our own abilities, but from the one who sustains us. When we feel weak, His power is made perfect.",
  prayer: i === 0
    ? "Lord, thank You for Your peace. When the world feels loud and chaotic, help me to hear Your still, small voice. Anchor my soul in Your truth. Amen."
    : "Father, give me strength for today. Help me to rely on You and not my own understanding. Amen.",
  challenge: i === 0
    ? "Peace Challenge: Take 5 minutes of silence today to simply listen for God's presence."
    : "Peace Challenge: Write down three things you are grateful for today."
}));

export default function Devotional() {
  const [currentDay, setCurrentDay] = useState(1);
  const [loading, setLoading] = useState(true);
  const dayData = DEVOTIONAL_DAYS[currentDay - 1];

  useEffect(() => {
    if (!auth.currentUser) {
      setLoading(false);
      return;
    }

    const userDocRef = doc(db, 'user_profiles', auth.currentUser.uid);
    const unsubscribe = onSnapshot(userDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.devotionalDay) {
          setCurrentDay(data.devotionalDay);
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleDayChange = async (day: number) => {
    setCurrentDay(day);
    if (auth.currentUser) {
      try {
        await setDoc(doc(db, 'user_profiles', auth.currentUser.uid), {
          devotionalDay: day
        }, { merge: true });
      } catch (error) {
        console.error('Error saving progress:', error);
      }
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[60vh]">
        <Loader2 className="w-10 h-10 animate-spin text-sage" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <div className="flex flex-col md:flex-row gap-12">
        {/* Sidebar */}
        <div className="w-full md:w-64 space-y-4">
          <h2 className="serif text-2xl font-semibold text-sage-dark mb-6">30-Day Devotional</h2>
          <div className="grid grid-cols-5 md:grid-cols-3 gap-2">
            {DEVOTIONAL_DAYS.map((d) => (
              <button
                key={d.day}
                onClick={() => handleDayChange(d.day)}
                className={`aspect-square flex items-center justify-center rounded-xl text-sm font-medium transition-all ${
                  currentDay === d.day 
                    ? "bg-sage text-white shadow-lg shadow-sage/20" 
                    : "bg-white border border-sage/10 text-ink/40 hover:bg-sage-light"
                }`}
              >
                {d.day}
              </button>
            ))}
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-grow">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentDay}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="bg-white rounded-[2.5rem] border border-sage/10 shadow-xl shadow-sage/5 p-8 sm:p-12"
            >
              <div className="flex justify-between items-center mb-8">
                <span className="bg-sage-light text-sage-dark px-4 py-1 rounded-full text-xs font-bold uppercase tracking-widest">
                  Day {dayData.day}
                </span>
                <div className="flex gap-2">
                  <button 
                    disabled={currentDay === 1}
                    onClick={() => handleDayChange(currentDay - 1)}
                    className="p-2 rounded-full hover:bg-sage-light disabled:opacity-30"
                  >
                    <ChevronLeft />
                  </button>
                  <button 
                    disabled={currentDay === 30}
                    onClick={() => handleDayChange(currentDay + 1)}
                    className="p-2 rounded-full hover:bg-sage-light disabled:opacity-30"
                  >
                    <ChevronRight />
                  </button>
                </div>
              </div>

              <h1 className="serif text-4xl font-semibold text-sage-dark mb-6">{dayData.title}</h1>
              
              <div className="bg-cream p-6 rounded-2xl border-l-4 border-sage mb-10">
                <p className="serif italic text-xl text-ink/80">"{dayData.scripture}"</p>
              </div>

              <div className="prose prose-sage max-w-none mb-12 text-ink/70 leading-relaxed">
                <p className="text-lg">{dayData.reflection}</p>
              </div>

              <div className="space-y-6">
                <div className="bg-sage-light/50 p-6 rounded-2xl border border-sage/10">
                  <h3 className="serif text-lg font-medium text-sage-dark mb-3 flex items-center gap-2">
                    <Heart className="w-5 h-5" />
                    Today's Prayer
                  </h3>
                  <p className="italic text-ink/60">{dayData.prayer}</p>
                </div>

                <div className="bg-sage p-6 rounded-2xl text-white shadow-lg shadow-sage/20">
                  <h3 className="serif text-lg font-medium mb-2 flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5" />
                    Peace Challenge
                  </h3>
                  <p className="text-white/90">{dayData.challenge}</p>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
