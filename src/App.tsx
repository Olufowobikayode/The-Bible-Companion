import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
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

export default function App() {
  return (
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
          <Route path="/study-journeys" element={<StudyJourneys />} />
          <Route path="/prayer-wall" element={<PrayerWall />} />
          <Route path="/offline" element={<OfflineManager />} />
          <Route path="/notepad" element={<Notepad />} />
        </Routes>
      </Layout>
    </Router>
  );
}
