import { Bell } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function NotificationCenter() {
  return (
    <Link to="/notifications" className="p-2 text-ink/40 hover:text-sage transition-colors relative">
      <Bell size={22} />
    </Link>
  );
}
