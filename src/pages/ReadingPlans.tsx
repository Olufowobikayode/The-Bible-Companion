import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { db, auth } from '../firebase';
import { collection, query, where, onSnapshot, addDoc, updateDoc, doc, getDocs } from 'firebase/firestore';
import { BookOpen, CheckCircle2, Circle, Loader2, Sparkles, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';

interface ReadingPlan {
  id?: string;
  title: string;
  description: string;
  days: { day: number; reference: string; completed: boolean }[];
  category: string;
  uid?: string;
}

const DEFAULT_PLANS = [
  {
    title: "30 Days of Psalms",
    description: "A journey through the songs of praise, lament, and wisdom.",
    category: "Wisdom",
    days: Array.from({ length: 30 }, (_, i) => ({ day: i + 1, reference: `Psalms ${i + 1}`, completed: false }))
  },
  {
    title: "Gospel of John in 7 Days",
    description: "Explore the life and divinity of Jesus through the Beloved Disciple's eyes.",
    category: "Gospels",
    days: [
      { day: 1, reference: "John 1-3", completed: false },
      { day: 2, reference: "John 4-6", completed: false },
      { day: 3, reference: "John 7-9", completed: false },
      { day: 4, reference: "John 10-12", completed: false },
      { day: 5, reference: "John 13-15", completed: false },
      { day: 6, reference: "John 16-18", completed: false },
      { day: 7, reference: "John 19-21", completed: false },
    ]
  },
  {
    title: "Peace in Anxiety",
    description: "Scriptures to calm the heart and mind.",
    category: "Topical",
    days: [
      { day: 1, reference: "Philippians 4:6-7", completed: false },
      { day: 2, reference: "Matthew 11:28-30", completed: false },
      { day: 3, reference: "Isaiah 41:10", completed: false },
      { day: 4, reference: "Psalm 23", completed: false },
      { day: 5, reference: "John 14:27", completed: false },
    ]
  }
];

export default function ReadingPlans() {
  const [userPlans, setUserPlans] = useState<ReadingPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'my-plans' | 'browse'>('browse');

  useEffect(() => {
    if (!auth.currentUser) {
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'reading_plans'),
      where('uid', '==', auth.currentUser.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ReadingPlan[];
      setUserPlans(items);
      setLoading(false);
      if (items.length > 0) setActiveTab('my-plans');
    }, (error) => {
      console.error('Error fetching plans:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleStartPlan = async (plan: any) => {
    if (!auth.currentUser) {
      alert('Please sign in to start a reading plan.');
      return;
    }

    try {
      await addDoc(collection(db, 'reading_plans'), {
        ...plan,
        uid: auth.currentUser.uid,
        startedAt: new Date().toISOString()
      });
      setActiveTab('my-plans');
    } catch (error) {
      console.error('Error starting plan:', error);
    }
  };

  const toggleDay = async (planId: string, dayIndex: number) => {
    const plan = userPlans.find(p => p.id === planId);
    if (!plan || !plan.id) return;

    const newDays = [...plan.days];
    newDays[dayIndex].completed = !newDays[dayIndex].completed;

    try {
      await updateDoc(doc(db, 'reading_plans', plan.id), {
        days: newDays
      });
    } catch (error) {
      console.error('Error updating day:', error);
    }
  };

  const calculateProgress = (plan: ReadingPlan) => {
    const completed = plan.days.filter(d => d.completed).length;
    return Math.round((completed / plan.days.length) * 100);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      <div className="text-center mb-12">
        <h1 className="serif text-5xl font-semibold text-sage-dark mb-4">Reading Plans</h1>
        <p className="text-ink/60 max-w-2xl mx-auto">
          Structured journeys through the Word. Track your progress and stay consistent in your walk with God.
        </p>
      </div>

      <div className="flex justify-center mb-12">
        <div className="bg-white p-1 rounded-2xl border border-sage/10 flex shadow-sm">
          <button
            onClick={() => setActiveTab('browse')}
            className={`px-8 py-3 rounded-xl text-sm font-medium transition-all ${activeTab === 'browse' ? 'bg-sage text-white shadow-md' : 'text-ink/40 hover:text-sage'}`}
          >
            Browse Plans
          </button>
          <button
            onClick={() => setActiveTab('my-plans')}
            className={`px-8 py-3 rounded-xl text-sm font-medium transition-all ${activeTab === 'my-plans' ? 'bg-sage text-white shadow-md' : 'text-ink/40 hover:text-sage'}`}
          >
            My Progress
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-10 h-10 animate-spin text-sage" />
        </div>
      ) : (
        <AnimatePresence mode="wait">
          {activeTab === 'browse' ? (
            <motion.div
              key="browse"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="grid grid-cols-1 md:grid-cols-3 gap-8"
            >
              {DEFAULT_PLANS.map((plan, i) => (
                <div key={i} className="bg-white rounded-[2.5rem] p-8 border border-sage/10 shadow-sm hover:shadow-xl transition-all flex flex-col">
                  <div className="mb-6">
                    <span className="text-[10px] text-sage-dark font-bold uppercase tracking-widest bg-sage-light px-3 py-1 rounded-full">
                      {plan.category}
                    </span>
                  </div>
                  <h3 className="serif text-2xl font-semibold text-sage-dark mb-4">{plan.title}</h3>
                  <p className="text-ink/60 text-sm mb-8 flex-grow">{plan.description}</p>
                  <div className="flex items-center justify-between mt-auto">
                    <span className="text-xs text-ink/40 font-medium">{plan.days.length} Days</span>
                    <button
                      onClick={() => handleStartPlan(plan)}
                      className="flex items-center gap-2 bg-sage text-white px-6 py-2 rounded-xl text-sm font-medium hover:bg-sage-dark transition-colors"
                    >
                      <Plus size={16} />
                      Start Plan
                    </button>
                  </div>
                </div>
              ))}
              <div className="bg-sage-light/30 rounded-[2.5rem] p-8 border border-dashed border-sage/20 flex flex-col items-center justify-center text-center">
                <Sparkles className="w-10 h-10 text-sage mb-4" />
                <h3 className="serif text-xl font-medium text-sage-dark mb-2">Custom Plan?</h3>
                <p className="text-ink/40 text-sm mb-6">Ask the Companion to generate a personalized reading plan for you.</p>
                <Link to="/chat" className="text-sage font-bold text-sm hover:underline">Go to Companion</Link>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="my-plans"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-12"
            >
              {userPlans.length > 0 ? (
                userPlans.map((plan) => (
                  <div key={plan.id} className="bg-white rounded-[3rem] p-10 border border-sage/10 shadow-sm">
                    <div className="flex flex-wrap justify-between items-start gap-6 mb-10">
                      <div>
                        <h3 className="serif text-3xl font-semibold text-sage-dark mb-2">{plan.title}</h3>
                        <p className="text-ink/40">{plan.description}</p>
                      </div>
                      <div className="text-right">
                        <div className="text-4xl font-bold text-sage mb-1">{calculateProgress(plan)}%</div>
                        <div className="text-[10px] text-ink/30 uppercase tracking-widest">Overall Progress</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      {plan.days.map((day, idx) => (
                        <button
                          key={idx}
                          onClick={() => plan.id && toggleDay(plan.id, idx)}
                          className={`flex items-center gap-4 p-4 rounded-2xl border transition-all ${day.completed ? 'bg-sage-light/30 border-sage/20' : 'bg-cream/50 border-sage/5 hover:border-sage/20'}`}
                        >
                          {day.completed ? (
                            <CheckCircle2 className="w-6 h-6 text-sage shrink-0" />
                          ) : (
                            <Circle className="w-6 h-6 text-ink/10 shrink-0" />
                          )}
                          <div className="text-left">
                            <div className={`text-xs font-bold uppercase tracking-tighter ${day.completed ? 'text-sage' : 'text-ink/30'}`}>Day {day.day}</div>
                            <div className={`text-sm font-medium ${day.completed ? 'text-sage-dark' : 'text-ink/60'}`}>{day.reference}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-20">
                  <BookOpen className="w-16 h-16 text-sage/20 mx-auto mb-6" />
                  <p className="text-ink/40 serif italic text-xl mb-8">You haven't started any plans yet.</p>
                  <button
                    onClick={() => setActiveTab('browse')}
                    className="bg-sage text-white px-8 py-3 rounded-2xl font-medium hover:bg-sage-dark transition-all"
                  >
                    Browse Available Plans
                  </button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  );
}
