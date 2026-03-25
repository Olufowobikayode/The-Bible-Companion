import { useState } from 'react';
import { Search, User as UserIcon, ChevronRight } from 'lucide-react';
import { api } from '../lib/api';
import { motion, AnimatePresence } from 'motion/react';
import { Link } from 'react-router-dom';

export default function UserSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setIsLoading(true);
    try {
      const data = await api.get(`/api/users/search?q=${encodeURIComponent(query)}`);
      setResults(data);
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-8 space-y-8">
      <div className="text-center space-y-4">
        <h1 className="serif text-4xl font-semibold text-sage-dark">Community Search</h1>
        <p className="text-ink/60">Find and connect with fellow travelers on the spiritual path.</p>
      </div>

      <form onSubmit={handleSearch} className="relative group">
        <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-6 h-6 text-sage/40 group-focus-within:text-sage transition-colors" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by username..."
          className="w-full pl-16 pr-6 py-5 bg-white border border-sage/10 rounded-[2rem] shadow-xl shadow-sage/5 focus:outline-none focus:border-sage transition-all text-lg"
        />
        <button
          type="submit"
          disabled={isLoading}
          className="absolute right-3 top-1/2 -translate-y-1/2 bg-sage text-white px-8 py-3 rounded-2xl font-medium hover:bg-sage-dark transition-all disabled:opacity-50"
        >
          {isLoading ? '...' : 'Search'}
        </button>
      </form>

      <div className="space-y-4">
        <AnimatePresence mode="popLayout">
          {results.map((user, idx) => (
            <motion.div
              key={user.uid}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="group"
            >
              <Link
                to={`/profile/${user.username}`}
                className="flex items-center justify-between p-6 bg-white border border-sage/10 rounded-3xl hover:border-sage/30 hover:shadow-xl hover:shadow-sage/5 transition-all"
              >
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-sage-light rounded-2xl flex items-center justify-center text-sage">
                    <UserIcon size={28} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sage-dark text-lg">@{user.username}</h3>
                    <p className="text-sm text-ink/40">{user.displayName || 'Spiritual Traveler'}</p>
                  </div>
                </div>
                <ChevronRight className="text-sage/20 group-hover:text-sage group-hover:translate-x-1 transition-all" />
              </Link>
            </motion.div>
          ))}
        </AnimatePresence>

        {!isLoading && query && results.length === 0 && (
          <div className="text-center py-12 space-y-4">
            <div className="w-20 h-20 bg-sage-light/30 rounded-full flex items-center justify-center mx-auto">
              <Search className="w-10 h-10 text-sage/20" />
            </div>
            <p className="text-ink/40 italic">No users found matching "{query}"</p>
          </div>
        )}
      </div>
    </div>
  );
}
