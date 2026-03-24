import { Routes, Route } from 'react-router-dom';
import ForumList from '../components/forum/ForumList';
import ThreadList from '../components/forum/ThreadList';
import ThreadView from '../components/forum/ThreadView';

export default function Forum() {
  return (
    <Routes>
      <Route path="/" element={<ForumList />} />
      <Route path="/:forumId" element={<ThreadList />} />
      <Route path="/:forumId/threads/:threadId" element={<ThreadView />} />
    </Routes>
  );
}
