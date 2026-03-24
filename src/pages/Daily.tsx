import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { fetchBibleVerse } from '../lib/bible';
import { Heart, Share2, Bookmark, Loader2, Sparkles } from 'lucide-react';
import { db, auth } from '../firebase';
import { collection, addDoc } from 'firebase/firestore';

const DAILY_VERSES = [
  "Lamentations 3:22-23", "Psalm 118:24", "Isaiah 40:31", "Philippians 4:13", "Psalm 23:1", "Proverbs 3:5-6", "John 14:27"
];

export default function Daily() {
  const [verse, setVerse] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDailyVerse();
  }, []);

  const loadDailyVerse = async () => {
    setLoading(true);
    // Use the day of the year to pick a verse
    const dayOfYear = Math.floor((new Date().getTime() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
    const ref = DAILY_VERSES[dayOfYear % DAILY_VERSES.length];
    const data = await fetchBibleVerse(ref);
    setVerse(data);
    setLoading(false);
  };

  const handleBookmark = async () => {
    if (!auth.currentUser) return alert('Please sign in to bookmark.');
    try {
      await addDoc(collection(db, 'bookmarks'), {
        uid: auth.currentUser.uid,
        verseRef: verse.reference,
        text: verse.text,
        translation: 'KJV',
        createdAt: new Date().toISOString()
      });
      alert('Bookmarked!');
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <div className="text-center mb-16">
        <h1 className="serif text-4xl font-semibold text-sage-dark mb-4">Daily Encouragement</h1>
        <p className="text-ink/60 italic">A fresh word for a new day.</p>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-4">
          <Loader2 className="w-10 h-10 animate-spin text-sage" />
        </div>
      ) : verse ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white rounded-[3rem] shadow-2xl shadow-sage/10 p-12 sm:p-20 border border-sage/10 text-center relative overflow-hidden"
        >
          <div className="absolute top-0 left-0 w-full h-2 bg-sage"></div>
          
          <Sparkles className="w-12 h-12 text-sage/20 mx-auto mb-8" />
          
          <blockquote className="serif text-3xl sm:text-4xl font-medium text-ink/80 leading-tight mb-10">
            "{verse.text}"
          </blockquote>
          
          <p className="text-sage-dark font-bold text-xl mb-12">— {verse.reference}</p>
          
          <div className="max-w-xl mx-auto text-ink/60 leading-relaxed mb-12 text-lg">
            <p>
              Today, let this truth settle in your heart. No matter what challenges lie ahead, 
              God's grace is sufficient for you. His mercies are new every morning. 
              Walk in confidence, knowing you are loved and guided.
            </p>
          </div>

          <div className="flex justify-center gap-6">
            <button 
              onClick={handleBookmark}
              className="flex items-center gap-2 bg-sage-light text-sage-dark px-6 py-3 rounded-full hover:bg-sage hover:text-white transition-all"
            >
              <Bookmark className="w-5 h-5" />
              <span>Bookmark</span>
            </button>
            <button className="flex items-center gap-2 border border-sage/20 text-ink/60 px-6 py-3 rounded-full hover:bg-cream transition-all">
              <Share2 className="w-5 h-5" />
              <span>Share</span>
            </button>
          </div>
        </motion.div>
      ) : null}
    </div>
  );
}
