import { useState, useEffect, useRef } from 'react';
import { Search, User, Users, Book, Bookmark, FileText, Loader2, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { motion, AnimatePresence } from 'motion/react';

export default function GlobalSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (query.trim().length > 2) {
        setLoading(true);
        try {
          const data = await api.get(`/api/search/global?q=${encodeURIComponent(query)}`);
          setResults(data);
        } catch (error) {
          console.error('Global search failed:', error);
        } finally {
          setLoading(false);
        }
      } else {
        setResults(null);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [query]);

  const handleSelect = (item: any) => {
    setIsOpen(false);
    setQuery('');
    setResults(null);

    switch (item.type) {
      case 'user':
        navigate(`/profile/${item.username}`);
        break;
      case 'topic':
        navigate(`/topics`); // Ideally navigate to specific topic if supported
        break;
      case 'note':
        navigate(`/notepad`);
        break;
      case 'bookmark':
        navigate(`/bookmarks`);
        break;
    }
  };

  return (
    <div className="relative" ref={searchRef}>
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder="Search VISION..."
          className="w-48 lg:w-64 bg-sage/5 border border-sage/10 rounded-full py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-sage/20 focus:bg-white transition-all"
        />
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink/40" />
        {query && (
          <button 
            onClick={() => setQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-ink/40 hover:text-ink/60"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>

      <AnimatePresence>
        {isOpen && (query.trim().length > 0) && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute top-full mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-sage/10 overflow-hidden z-[100]"
          >
            {loading ? (
              <div className="p-8 flex flex-col items-center gap-3 text-sage">
                <Loader2 className="w-6 h-6 animate-spin" />
                <p className="text-xs font-medium uppercase tracking-widest">Searching the archives...</p>
              </div>
            ) : results && (Object.values(results).some((arr: any) => arr.length > 0)) ? (
              <div className="max-h-[70vh] overflow-y-auto p-2">
                {results.users.length > 0 && (
                  <div className="mb-4">
                    <h3 className="px-3 py-2 text-[10px] font-bold text-sage uppercase tracking-widest">Brethren</h3>
                    {results.users.map((u: any) => (
                      <button
                        key={u.id}
                        onClick={() => handleSelect(u)}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-sage/5 transition-colors text-left"
                      >
                        <div className="w-8 h-8 rounded-full bg-sage/10 flex items-center justify-center text-sage">
                          <User className="w-4 h-4" />
                        </div>
                        <span className="text-sm font-medium text-ink/80">{u.name}</span>
                      </button>
                    ))}
                  </div>
                )}

                {results.topics.length > 0 && (
                  <div className="mb-4">
                    <h3 className="px-3 py-2 text-[10px] font-bold text-sage uppercase tracking-widest">Scripture Topics</h3>
                    {results.topics.map((t: any) => (
                      <button
                        key={t.id}
                        onClick={() => handleSelect(t)}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-sage/5 transition-colors text-left"
                      >
                        <div className="w-8 h-8 rounded-lg bg-sage/10 flex items-center justify-center text-sage">
                          <Book className="w-4 h-4" />
                        </div>
                        <span className="text-sm font-medium text-ink/80">{t.name}</span>
                      </button>
                    ))}
                  </div>
                )}

                {results.notes.length > 0 && (
                  <div className="mb-4">
                    <h3 className="px-3 py-2 text-[10px] font-bold text-sage uppercase tracking-widest">Your Notes</h3>
                    {results.notes.map((n: any) => (
                      <button
                        key={n.id}
                        onClick={() => handleSelect(n)}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-sage/5 transition-colors text-left"
                      >
                        <div className="w-8 h-8 rounded-lg bg-sage/10 flex items-center justify-center text-sage">
                          <FileText className="w-4 h-4" />
                        </div>
                        <span className="text-sm font-medium text-ink/80">{n.name}</span>
                      </button>
                    ))}
                  </div>
                )}

                {results.bookmarks.length > 0 && (
                  <div className="mb-4">
                    <h3 className="px-3 py-2 text-[10px] font-bold text-sage uppercase tracking-widest">Bookmarks</h3>
                    {results.bookmarks.map((b: any) => (
                      <button
                        key={b.id}
                        onClick={() => handleSelect(b)}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-sage/5 transition-colors text-left"
                      >
                        <div className="w-8 h-8 rounded-lg bg-sage/10 flex items-center justify-center text-sage">
                          <Bookmark className="w-4 h-4" />
                        </div>
                        <div className="flex flex-col overflow-hidden">
                          <span className="text-sm font-medium text-ink/80">{b.name}</span>
                          <span className="text-[10px] text-ink/40 truncate italic">"{b.text}"</span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : query.trim().length > 2 ? (
              <div className="p-8 text-center">
                <p className="text-sm text-ink/40 italic">No results found in the archives.</p>
              </div>
            ) : (
              <div className="p-8 text-center">
                <p className="text-sm text-ink/40 italic">Type at least 3 characters to search...</p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
