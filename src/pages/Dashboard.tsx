import React, { useState, useEffect } from 'react';
import { Activity, BookOpen, Heart, Award, TrendingUp, Calendar, MessageSquare, MessageCircle, Sun, PenLine } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { api } from '../lib/api';

export default function Dashboard() {
  const [stats, setStats] = useState<any>({
    prayers: 0,
    posts: 0,
    testimonies: 0,
    bookmarks: 0,
    notes: 0,
    studyJourneys: 0,
    bibleReadCount: 0,
    topicExploreCount: 0,
    streak: 0,
  });
  const [milestones, setMilestones] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          setUser(session.user);
          const [dashboardStats, milestoneData, activityData] = await Promise.all([
            api.get('/api/dashboard/stats'),
            api.get('/api/milestones'),
            api.get('/api/user/activity')
          ]);
          setStats(dashboardStats);
          setMilestones(milestoneData);
          setActivities(activityData);
        }
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        setUser(session.user);
        fetchData();
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return <div className="flex justify-center items-center min-h-[50vh]"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sage"></div></div>;
  }

  if (!user) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center">
        <h1 className="serif text-3xl font-semibold text-sage-dark mb-4">Spiritual Growth Dashboard</h1>
        <p className="text-ink/60">Please sign in to view your spiritual growth dashboard.</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12 gap-4">
        <div>
          <h1 className="serif text-4xl font-bold text-sage-dark mb-2">Spiritual Growth Dashboard</h1>
          <p className="text-ink/60">Track your study consistency, thematic depth, and prayer engagement.</p>
        </div>
        <div className="bg-sage/10 px-6 py-3 rounded-2xl border border-sage/20">
          <span className="text-xs font-bold text-sage uppercase tracking-widest">Current Streak</span>
          <div className="flex items-center gap-2 mt-1">
            <Sun className="w-5 h-5 text-sage" />
            <span className="text-2xl font-bold text-sage-dark">7 Days</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-12">
        {[
          { label: 'Prayers', value: stats.prayers, icon: Heart, color: 'text-red-500', bg: 'bg-red-50' },
          { label: 'Posts', value: stats.posts, icon: MessageSquare, color: 'text-blue-500', bg: 'bg-blue-50' },
          { label: 'Testimonies', value: stats.testimonies, icon: MessageCircle, color: 'text-amber-500', bg: 'bg-amber-50' },
          { label: 'Bookmarks', value: stats.bookmarks, icon: BookOpen, color: 'text-sage', bg: 'bg-sage-light/20' },
          { label: 'Notes', value: stats.notes, icon: PenLine, color: 'text-purple-500', bg: 'bg-purple-50' },
          { label: 'Journeys', value: stats.studyJourneys, icon: Activity, color: 'text-emerald-500', bg: 'bg-emerald-50' },
        ].map((stat, i) => (
          <div key={i} className="bg-white p-6 rounded-3xl border border-sage/10 shadow-sm flex flex-col items-center text-center">
            <div className={`w-12 h-12 rounded-2xl ${stat.bg} ${stat.color} flex items-center justify-center mb-4`}>
              <stat.icon className="w-6 h-6" />
            </div>
            <p className="text-2xl font-bold text-sage-dark">{stat.value}</p>
            <p className="text-[10px] font-bold text-ink/40 uppercase tracking-widest mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div>
          <h2 className="serif text-2xl font-semibold text-sage-dark mb-6 flex items-center gap-2">
            <Award className="w-6 h-6 text-sage" />
            Theological Milestones
          </h2>
          <div className="space-y-4">
            {milestones.map((milestone, i) => {
              const Icon = milestone.icon === 'Award' ? Award : milestone.icon === 'Activity' ? Activity : milestone.icon === 'Heart' ? Heart : TrendingUp;
              return (
                <div key={i} className={`p-6 rounded-3xl border flex items-start gap-4 transition-all ${milestone.achieved ? 'bg-sage/5 border-sage/30 shadow-sm' : 'bg-white border-sage/10 opacity-60'}`}>
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${milestone.achieved ? 'bg-sage text-white shadow-lg shadow-sage/20' : 'bg-sage/10 text-sage/40'}`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-bold text-ink">{milestone.title}</h4>
                    <p className="text-sm text-ink/60 leading-relaxed">{milestone.desc}</p>
                    {milestone.achieved && (
                      <span className="text-[10px] font-bold text-sage uppercase tracking-widest mt-2 block">Achieved</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div>
          <h2 className="serif text-2xl font-semibold text-sage-dark mb-6 flex items-center gap-2">
            <Calendar className="w-6 h-6 text-sage" />
            Recent Activity
          </h2>
          <div className="bg-white rounded-[2rem] border border-sage/10 p-6 shadow-sm min-h-[400px]">
            <div className="space-y-6">
              {activities.length > 0 ? activities.map((activity, i) => (
                <div key={i} className="flex gap-4">
                  <div className="w-2 h-2 rounded-full bg-sage mt-2 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-ink">
                      {activity.type === 'bible_read' && `Read ${activity.metadata.book} ${activity.metadata.chapter}`}
                      {activity.type === 'topic_explore' && `Explored topic: ${activity.metadata.topic}`}
                      {activity.type === 'prayer_post' && `Posted a prayer request`}
                      {activity.type === 'prayer_react' && `Prayed for a brother/sister`}
                      {activity.type === 'testimony_share' && `Shared a testimony`}
                      {activity.type === 'note_create' && `Created a new note`}
                    </p>
                    <p className="text-xs text-ink/40">{new Date(activity.createdAt).toLocaleDateString()} at {new Date(activity.createdAt).toLocaleDateString()}</p>
                  </div>
                </div>
              )) : (
                <p className="text-sm text-ink/40 italic">No recent activity recorded.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
