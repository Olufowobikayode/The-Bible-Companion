import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from 'sonner';
import { AuthProvider } from './contexts/AuthContext';
import Layout from './components/Layout';
import Home from './pages/Home';
import Bible from './pages/Bible';
import Topics from './pages/Topics';
import Daily from './pages/Daily';
import Devotional from './pages/Devotional';
import Chat from './pages/Chat';
import Forum from './pages/Forum';
import StudyJourneys from './pages/StudyJourneys';
import Bookmarks from './pages/Bookmarks';

import ReadingPlans from './pages/ReadingPlans';
import Concordance from './pages/Concordance';
import PrayerWall from './components/prayer/PrayerWall';
import OfflineManager from './pages/OfflineManager';
import Notepad from './pages/Notepad';
import Testimonies from './pages/Testimonies';
import Community from './pages/Community';
import GroupDetail from './pages/GroupDetail';
import Friends from './pages/Friends';
import Profile from './pages/Profile';
import PrayerRooms from './pages/PrayerRooms';
import Media from './pages/Media';
import Dashboard from './pages/Dashboard';
import Messages from './pages/Messages';

import UserSearch from './components/UserSearch';
import UserProfile from './components/UserProfile';

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <Layout>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/bible" element={<Bible />} />
            <Route path="/bookmarks" element={<Bookmarks />} />
            <Route path="/topics" element={<Topics />} />
            <Route path="/reading-plans" element={<ReadingPlans />} />
            <Route path="/concordance" element={<Concordance />} />
            <Route path="/daily" element={<Daily />} />
            <Route path="/devotional" element={<Devotional />} />
            <Route path="/chat" element={<Chat />} />
            <Route path="/forum/*" element={<Forum />} />
            <Route path="/testimonies" element={<Testimonies />} />
            <Route path="/community" element={<Community />} />
            <Route path="/community/:groupId" element={<GroupDetail />} />
            <Route path="/friends" element={<Friends />} />
            <Route path="/profile/:username" element={<UserProfile />} />
            <Route path="/search" element={<UserSearch />} />
            <Route path="/media" element={<Media />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/messages" element={<Messages />} />
            <Route path="/study-journeys" element={<StudyJourneys />} />
            <Route path="/prayer-wall" element={<PrayerWall />} />
            <Route path="/prayer-rooms" element={<PrayerRooms />} />
            <Route path="/offline" element={<OfflineManager />} />
            <Route path="/notepad" element={<Notepad />} />
          </Routes>
        </Layout>
        <Toaster position="top-center" richColors />
      </Router>
    </AuthProvider>
  );
}
