import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ALL_BOOKS, fetchChapter, fetchBibleVerse, BOOK_CHAPTER_COUNTS } from '../lib/bible';
import { askBibleQuestion, performSemanticSearch, getOriginalText, getCrossReferences, getScriptureContext } from '../lib/gemini';
import { TRANSLATIONS, Translation } from '../types';
import { db_local } from '../lib/db';
import { ChevronLeft, ChevronRight, Search, Loader2, Bookmark, MessageCircle, Share2, X, Languages, Download, CheckCircle2, BookOpenText, Sparkles } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { api } from '../lib/api';
import { useNavigate, useLocation } from 'react-router-dom';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import ReactMarkdown from 'react-markdown';
import { toast } from 'sonner';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function Bible() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as { book?: string; chapter?: number; verse?: number } | null;

  const [book, setBook] = useState(state?.book || 'John');
  const [chapter, setChapter] = useState(state?.chapter || 3);
  const [translation, setTranslation] = useState<Translation>('KJV');
  const [content, setContent] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [semanticResults, setSemanticResults] = useState<number[]>([]);
  const [loadingSemantic, setLoadingSemantic] = useState(false);
  const [insights, setInsights] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedVerse, setSelectedVerse] = useState<any>(null);
  const [showOriginal, setShowOriginal] = useState(false);
  const [userBookmarks, setUserBookmarks] = useState<{ [key: string]: string }>({});
  const [hoveredVerse, setHoveredVerse] = useState<string | null>(null);
  const [syncProgress, setSyncProgress] = useState<{ current: number; total: number } | null>(null);
  const [user, setUser] = useState<any>(null);
  const verseRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  useEffect(() => {
    loadChapter();
  }, [book, chapter, translation]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (user) {
      fetchBookmarks();
    } else {
      setUserBookmarks({});
    }
  }, [user]);

  const fetchBookmarks = async () => {
    try {
      const bookmarks = await api.get('/api/bookmarks');
      const bookmarkMap: { [key: string]: string } = {};
      bookmarks.forEach((b: any) => {
        bookmarkMap[`${b.verseRef}_${b.translation}`] = b.id;
      });
      setUserBookmarks(bookmarkMap);
    } catch (error) {
      console.error('Failed to fetch bookmarks:', error);
    }
  };

  useEffect(() => {
    if (state?.verse && content && !loading) {
      const verseKey = `${state.book} ${state.chapter}:${state.verse}`;
      const element = verseRefs.current[verseKey];
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        navigate(location.pathname, { replace: true, state: {} });
      }
    }
  }, [state, content, loading]);

  useEffect(() => {
    if (selectedVerse) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [selectedVerse]);

  const loadChapter = async () => {
    setLoading(true);
    setInsights(null);
    const data = await fetchChapter(book, chapter, translation);
    setContent(data);
    setLoading(false);
    loadInsights(book, chapter);

    // Track activity
    if (user) {
      try {
        await api.post('/api/user/activity', {
          type: 'bible_read',
          metadata: { book, chapter, translation }
        });
      } catch (error) {
        console.error("Failed to track Bible reading:", error);
      }
    }
  };

  const loadInsights = async (b: string, c: number) => {
    setLoadingInsights(true);
    try {
      const prompt = `Provide deep theological insights, historical context, and thematic cross-references for ${b} chapter ${c}. 
      Include insights from both canonical and non-canonical perspectives where relevant. 
      Tone: Scholarly, profound, reverent.`;
      const result = await askBibleQuestion(prompt);
      setInsights(result);
    } catch (e) {
      console.error("Failed to load insights", e);
    } finally {
      setLoadingInsights(false);
    }
  };

  const handleSemanticSearch = async () => {
    if (!searchQuery.trim()) return;
    setLoadingSemantic(true);
    try {
      if (content) {
        const chapterText = content.verses.map((v: any) => `${v.verse}: ${v.text}`).join('\n');
        const results = await performSemanticSearch(searchQuery, chapterText);
        setSemanticResults(results);
        if (results.length === 0) {
          toast.info("No specific matches found in this chapter. Try a broader search.");
        }
      } else {
        // Global search if no chapter is loaded (though one usually is)
        const result = await performSemanticSearch(searchQuery);
        if (result.verses && result.verses.length > 0) {
          // Navigate to the first result? Or show a list?
          // For now, let's just toast the first reference
          toast.info(`Top match: ${result.verses[0]}`);
        }
      }
    } catch (error) {
      console.error("Semantic search failed:", error);
      toast.error("Failed to perform AI search.");
    } finally {
      setLoadingSemantic(false);
    }
  };

  const handleSyncBook = async () => {
    const total = BOOK_CHAPTER_COUNTS[book] || 1;
    setSyncProgress({ current: 0, total });
    for (let c = 1; c <= total; c++) {
      setSyncProgress({ current: c, total });
      await fetchChapter(book, c, translation);
    }
    setTimeout(() => setSyncProgress(null), 3000);
  };

  const handleNext = () => setChapter(chapter + 1);
  const handlePrev = () => setChapter(Math.max(1, chapter - 1));

  const handleBookmark = async (verse: any) => {
    if (!user) {
      toast.error('Please sign in to bookmark verses.');
      return;
    }

    const verseRef = `${book} ${chapter}:${verse.verse}`;
    const bookmarkKey = `${verseRef}_${translation}`;
    const existingBookmarkId = userBookmarks[bookmarkKey];

    try {
      if (existingBookmarkId) {
        await api.delete(`/api/bookmarks/${existingBookmarkId}`);
        const newBookmarks = { ...userBookmarks };
        delete newBookmarks[bookmarkKey];
        setUserBookmarks(newBookmarks);
        toast.success('Bookmark removed');
      } else {
        const newBookmark = await api.post('/api/bookmarks', {
          verseRef,
          text: verse.text,
          translation,
        });
        setUserBookmarks({
          ...userBookmarks,
          [bookmarkKey]: newBookmark.id
        });
        toast.success('Verse bookmarked');
      }
    } catch (error) {
      console.error('Failed to toggle bookmark:', error);
      toast.error('Failed to update bookmark');
    }
  };

  const handleShare = async () => {
    const shareData = {
      title: 'The Bible Companion',
      text: `Check out ${book} ${chapter} on The Bible Companion`,
      url: window.location.href,
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(window.location.href);
        toast.success('Link copied to clipboard!');
      }
    } catch (err) {
      console.error('Share failed:', err);
    }
  };

  const highlightText = (text: string, query: string) => {
    if (!query.trim()) return parseReferences(text);
    const parts = text.split(new RegExp(`(${query})`, 'gi'));
    return (
      <>
        {parts.map((part, i) => 
          part.toLowerCase() === query.toLowerCase() ? (
            <mark key={i} className="bg-yellow-200 text-ink rounded px-0.5">{part}</mark>
          ) : parseReferences(part)
        )}
      </>
    );
  };

  const parseReferences = (text: string) => {
    if (typeof text !== 'string') return text;
    // Simple regex for Book Chapter:Verse
    const refRegex = /([1-3]?\s?[A-Z][a-z]+)\s(\d+):(\d+)/g;
    const parts = text.split(refRegex);
    if (parts.length === 1) return text;

    const result = [];
    let lastIndex = 0;
    let match;
    
    // Reset regex index
    refRegex.lastIndex = 0;
    while ((match = refRegex.exec(text)) !== null) {
      const [full, b, c, v] = match;
      const index = match.index;
      
      // Add text before match
      result.push(text.substring(lastIndex, index));
      
      // Add clickable link
      result.push(
        <button
          key={index}
          onClick={() => handleReferenceClick(b, parseInt(c), parseInt(v))}
          className="text-sage font-bold hover:underline decoration-dotted"
        >
          {full}
        </button>
      );
      
      lastIndex = refRegex.lastIndex;
    }
    result.push(text.substring(lastIndex));
    return result;
  };

  const handleReferenceClick = async (b: string, c: number, v: number) => {
    setLoading(true);
    const data = await fetchBibleVerse(`${b} ${c}:${v}`, translation);
    if (data) {
      setSelectedVerse({
        reference: `${b} ${c}:${v}`,
        text: data.text,
      });
    }
    setLoading(false);
  };

  const getSearchSummary = () => {
    if (!searchQuery.trim() || !content) return null;
    let count = 0;
    content.verses.forEach((v: any) => {
      const matches = v.text.match(new RegExp(searchQuery, 'gi'));
      if (matches) count += matches.length;
    });
    if (count === 0) return null;
    return (
      <div className="bg-sage-light/50 px-4 py-2 rounded-full text-xs font-medium text-sage-dark animate-pulse">
        Found "{searchQuery}" {count} {count === 1 ? 'time' : 'times'} in this chapter
      </div>
    );
  };

  const getVerseMatchCount = (text: string) => {
    if (!searchQuery.trim()) return 0;
    const matches = text.match(new RegExp(searchQuery, 'gi'));
    return matches ? matches.length : 0;
  };

  return (
    <div className="max-w-5xl mx-auto px-0 sm:px-4 py-6 sm:py-12">
      <div className="bg-white sm:rounded-3xl shadow-xl shadow-sage/5 border-y sm:border border-sage/10 overflow-hidden">
        {/* Controls */}
        <div className="bg-sage-light p-4 sm:p-6 border-b border-sage/10 space-y-4">
          <div className="flex flex-wrap items-center gap-2 sm:gap-4">
            <select
              value={book}
              onChange={(e) => { setBook(e.target.value); setChapter(1); }}
              className="flex-grow sm:flex-grow-0 bg-white border border-sage/20 rounded-xl px-3 sm:px-4 py-2 text-sm focus:outline-none focus:border-sage"
            >
              {ALL_BOOKS.map(b => <option key={b} value={b}>{b}</option>)}
            </select>

            <div className="flex items-center space-x-1 sm:space-x-2">
              <button onClick={handlePrev} className="p-2 hover:bg-sage/10 rounded-lg transition-colors">
                <ChevronLeft className="w-5 h-5" />
              </button>
              <input
                type="number"
                value={chapter}
                onChange={(e) => setChapter(parseInt(e.target.value) || 1)}
                className="w-12 sm:w-16 bg-white border border-sage/20 rounded-xl px-2 sm:px-3 py-2 text-center text-sm focus:outline-none focus:border-sage"
              />
              <button onClick={handleNext} className="p-2 hover:bg-sage/10 rounded-lg transition-colors">
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            <select
              value={translation}
              onChange={(e) => setTranslation(e.target.value as Translation)}
              className="flex-grow sm:flex-grow-0 bg-white border border-sage/20 rounded-xl px-3 sm:px-4 py-2 text-sm focus:outline-none focus:border-sage"
            >
              {TRANSLATIONS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>

            <button
              onClick={handleShare}
              className="p-2 text-ink/40 hover:text-sage transition-colors ml-auto sm:ml-0"
              title="Share Chapter"
            >
              <Share2 className="w-5 h-5" />
            </button>

            <div className="w-full sm:w-auto sm:flex-grow relative">
              <input
                type="text"
                placeholder="Search verse or keyword..."
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setSemanticResults([]); }}
                className="w-full bg-white border border-sage/20 rounded-xl px-4 py-2 pl-10 text-sm focus:outline-none focus:border-sage"
              />
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-ink/40" />
            </div>
            
            <div className="flex w-full sm:w-auto gap-2">
              <button
                onClick={handleSemanticSearch}
                disabled={loadingSemantic || !searchQuery.trim()}
                className="flex-1 sm:flex-none justify-center bg-sage-dark text-white px-4 py-2 rounded-xl text-sm hover:bg-sage transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {loadingSemantic ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                <span className="hidden sm:inline">Semantic Search</span>
                <span className="sm:hidden">AI Search</span>
              </button>

              <button 
                onClick={() => navigate('/chat', { state: { initialQuery: `Tell me more about the book of ${book}` } })}
                className="flex-1 sm:flex-none justify-center flex items-center gap-2 bg-sage text-white px-4 py-2 rounded-xl text-sm hover:bg-sage-dark transition-colors"
              >
                <MessageCircle className="w-4 h-4" />
                <span>Research</span>
              </button>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            {getSearchSummary()}
            <div className="flex flex-wrap gap-2 w-full sm:w-auto">
              <button
                onClick={() => setShowOriginal(!showOriginal)}
                className={cn(
                  "flex-1 sm:flex-none justify-center flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium transition-all",
                  showOriginal ? "bg-sage text-white" : "bg-white border border-sage/20 text-ink/40"
                )}
              >
                <Languages className="w-4 h-4" />
                <span>Study Mode</span>
              </button>

              <button
                onClick={handleSyncBook}
                disabled={!!syncProgress}
                className="flex-1 sm:flex-none justify-center flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium bg-white border border-sage/20 text-sage hover:bg-sage-light transition-all disabled:opacity-50"
              >
                {syncProgress ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="truncate max-w-[120px]">Downloading {book}...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    <span>Offline</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 p-4 sm:p-12 min-h-[60vh]">
          <div className="lg:col-span-2">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-full py-20 space-y-4">
                <Loader2 className="w-10 h-10 animate-spin text-sage" />
                <p className="text-ink/40 serif italic">Opening the Word...</p>
              </div>
            ) : content ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-6 sm:space-y-8"
              >
                <div className="text-center mb-8 sm:mb-12">
                  <h2 className="serif text-3xl sm:text-4xl font-semibold text-sage-dark">{content.reference}</h2>
                  <p className="text-ink/30 text-[10px] sm:text-sm mt-2 uppercase tracking-widest">{translation} Translation</p>
                </div>

                <div className="prose prose-sage max-w-none">
                  {content.verses.map((v: any) => {
                    const matchCount = getVerseMatchCount(v.text);
                    const verseRef = `${book} ${chapter}:${v.verse}`;
                    return (
                      <div 
                        key={v.verse} 
                        ref={el => { verseRefs.current[verseRef] = el; }}
                        className="group relative mb-4"
                      >
                        <div className="flex items-start gap-3 sm:gap-4">
                          <sup className="text-sage-dark font-bold mt-2 text-[10px] shrink-0">{v.verse}</sup>
                          <div className="flex-grow">
                            <span 
                              onClick={() => setSelectedVerse({ reference: verseRef, text: v.text })}
                              className={cn(
                                "text-ink/80 text-base sm:text-lg hover:bg-sage-light transition-colors rounded px-1 cursor-pointer leading-relaxed",
                                searchQuery && v.text.toLowerCase().includes(searchQuery.toLowerCase()) && "bg-sage-light/30",
                                semanticResults.includes(v.verse) && "bg-sage-light/60 ring-2 ring-sage rounded"
                              )}
                            >
                              {highlightText(v.text, searchQuery)}
                            </span>
                            {matchCount > 0 && (
                              <span className="ml-2 text-[10px] font-bold text-sage bg-sage-light px-1.5 py-0.5 rounded-full">
                                {matchCount}
                              </span>
                            )}
                            {showOriginal && (
                              <div className="mt-2 text-sm font-serif text-sage/60 italic border-l-2 border-sage/20 pl-4">
                                <OriginalText verseRef={verseRef} />
                              </div>
                            )}
                            
                          </div>
                          <button
                            onClick={() => handleBookmark(v)}
                            className={cn(
                              "opacity-100 sm:opacity-0 group-hover:opacity-100 p-2 transition-all",
                              userBookmarks[`${book} ${chapter}:${v.verse}_${translation}`] 
                                ? "text-sage" 
                                : "text-sage hover:text-sage-dark"
                            )}
                            title={userBookmarks[`${book} ${chapter}:${v.verse}_${translation}`] ? "Remove Bookmark" : "Bookmark Verse"}
                          >
                            <Bookmark 
                              className="w-4 h-4" 
                              fill={userBookmarks[`${book} ${chapter}:${v.verse}_${translation}`] ? "currentColor" : "none"} 
                            />
                          </button>
                          <button
                            onClick={async () => {
                              const shareText = `"${v.text}" — ${book} ${chapter}:${v.verse} (${translation})`;
                              try {
                                if (navigator.share) {
                                  await navigator.share({
                                    title: 'Bible Verse Share',
                                    text: shareText,
                                    url: window.location.href
                                  });
                                } else {
                                  await navigator.clipboard.writeText(shareText);
                                  toast.success('Verse copied to clipboard!');
                                }
                              } catch (err) {
                                console.error('Share failed:', err);
                              }
                            }}
                            className="opacity-100 sm:opacity-0 group-hover:opacity-100 p-2 text-sage hover:text-sage-dark transition-all"
                            title="Share Verse"
                          >
                            <Share2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            ) : (
              <div className="text-center py-20 text-ink/40 italic">
                Could not load chapter. Please try another book or translation.
              </div>
            )}
          </div>

          {/* Theological Insights Panel */}
          <div className="lg:col-span-1">
            <div className="bg-sage-light/20 rounded-[2rem] p-6 sm:p-8 border border-sage/10 sticky top-8">
              <h2 className="serif text-xl sm:text-2xl font-semibold text-sage-dark mb-4 sm:mb-6 flex items-center gap-2">
                <BookOpenText className="w-6 h-6" />
                Insights
              </h2>
              {loadingInsights ? (
                <div className="flex flex-col items-center gap-4 py-10 text-sage">
                  <Loader2 className="w-8 h-8 animate-spin" />
                  <p className="text-sm">Seeking wisdom...</p>
                </div>
              ) : insights ? (
                <div className="prose prose-sage prose-sm max-w-none text-ink/70">
                  <ReactMarkdown>{insights}</ReactMarkdown>
                </div>
              ) : (
                <p className="text-ink/40 text-sm">No insights available for this chapter.</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Verse Modal */}
      <AnimatePresence>
        {selectedVerse && (
          <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedVerse(null)}
              className="absolute inset-0 bg-ink/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-lg bg-cream rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-2xl p-8 sm:p-12 border border-sage/10 mt-auto sm:mt-0 max-h-[90vh] overflow-y-auto"
            >
              <button
                onClick={() => setSelectedVerse(null)}
                className="absolute right-6 top-6 p-2 text-ink/40 hover:text-sage transition-colors"
              >
                <X size={24} />
              </button>
              <div className="space-y-6">
                <h3 className="serif text-2xl font-semibold text-sage-dark">{selectedVerse.reference}</h3>
                <p className="serif italic text-xl text-ink/80 leading-relaxed">"{selectedVerse.text}"</p>
                
                <div className="pt-6 border-t border-sage/10 space-y-6">
                  <ScriptureContext verseRef={selectedVerse.reference} verseText={selectedVerse.text} />
                  
                  <CrossReferences 
                    verseRef={selectedVerse.reference} 
                    verseText={selectedVerse.text} 
                    onNavigate={(b, c) => {
                      setBook(b);
                      setChapter(c);
                      setSelectedVerse(null);
                    }}
                  />
                </div>

                <div className="flex justify-end pt-4">
                  <button
                    onClick={() => {
                      const [b, ref] = selectedVerse.reference.split(' ');
                      const [c] = ref.split(':');
                      setBook(b);
                      setChapter(parseInt(c));
                      setSelectedVerse(null);
                    }}
                    className="text-sage font-bold hover:underline text-sm"
                  >
                    Go to Chapter
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function OriginalText({ verseRef, detailed }: { verseRef: string; detailed?: boolean }) {
  const [data, setData] = useState<{ original: string; transliteration?: string; definition?: string } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchOriginal = async () => {
      setLoading(true);
      try {
        const cacheKey = `original_${verseRef}_${detailed ? 'detailed' : 'simple'}`;
        const cached = await db_local.concordance_entries.get(cacheKey);
        if (cached) {
          setData(cached.data);
          setLoading(false);
          return;
        }

        const result = await getOriginalText(verseRef, !!detailed);
        setData(result);
        await db_local.concordance_entries.put({
          word: cacheKey,
          data: result,
          updatedAt: new Date().toISOString()
        });
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchOriginal();
  }, [verseRef, detailed]);

  if (loading) return <span className="animate-pulse text-xs text-ink/30">Loading...</span>;
  if (!data) return null;

  if (detailed) {
    return (
      <div className="space-y-2">
        <div className="text-2xl font-serif text-sage">{data.original}</div>
        <div className="text-xs text-ink/40 font-mono italic">{data.transliteration}</div>
        <div className="text-xs text-ink/60 leading-relaxed">{data.definition}</div>
      </div>
    );
  }

  return <span>{data.original}</span>;
}

function ScriptureContext({ verseRef, verseText }: { verseRef: string; verseText: string }) {
  const [context, setContext] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchContext = async () => {
    setLoading(true);
    try {
      const result = await getScriptureContext(verseRef, verseText);
      setContext(result);
    } catch (err) {
      console.error("Failed to load scripture context", err);
    } finally {
      setLoading(false);
    }
  };

  if (!context && !loading) {
    return (
      <button 
        onClick={fetchContext}
        className="flex items-center gap-2 text-xs font-bold text-sage hover:text-sage-dark transition-colors uppercase tracking-widest"
      >
        <BookOpenText className="w-3 h-3" />
        Get Context & Synthesis
      </button>
    );
  }

  if (loading) return <span className="animate-pulse text-xs text-ink/30">Analyzing context...</span>;
  if (!context) return null;

  return (
    <div className="space-y-3 bg-sage-light/20 p-4 rounded-2xl border border-sage/10">
      <h4 className="text-xs font-bold text-sage-dark uppercase tracking-wider flex items-center gap-2">
        <BookOpenText className="w-4 h-4" />
        Scripture Context
      </h4>
      <div className="prose prose-sage prose-sm max-w-none text-ink/80 text-sm">
        <ReactMarkdown>{context}</ReactMarkdown>
      </div>
    </div>
  );
}

function CrossReferences({ verseRef, verseText, onNavigate }: { verseRef: string; verseText: string; onNavigate?: (book: string, chapter: number) => void }) {
  const [refs, setRefs] = useState<{ reference: string; reason: string }[] | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchRefs = async () => {
    setLoading(true);
    try {
      const cacheKey = `crossrefs_${verseRef}`;
      const cached = await db_local.concordance_entries.get(cacheKey);
      if (cached && cached.data) {
        setRefs(cached.data);
        setLoading(false);
        return;
      }

      const result = await getCrossReferences(verseRef, verseText);
      
      setRefs(result);
      if (result && result.length > 0) {
        await db_local.concordance_entries.put({
          word: cacheKey,
          data: result,
          updatedAt: new Date().toISOString()
        });
      }
    } catch (err) {
      console.error("Failed to load cross-references", err);
    } finally {
      setLoading(false);
    }
  };

  const handleRefClick = (ref: string) => {
    if (!onNavigate) return;
    // Parse reference like "John 3:16" or "1 John 2:1"
    const parts = ref.split(' ');
    const versePart = parts.pop() || '';
    const bookPart = parts.join(' ');
    const [chapterPart] = versePart.split(':');
    
    if (bookPart && chapterPart) {
      onNavigate(bookPart, parseInt(chapterPart));
    }
  };

  if (!refs && !loading) {
    return (
      <button 
        onClick={fetchRefs}
        className="flex items-center gap-2 text-xs font-bold text-sage hover:text-sage-dark transition-colors uppercase tracking-widest"
      >
        <Sparkles className="w-3 h-3" />
        Find Cross-References
      </button>
    );
  }

  if (loading) return <span className="animate-pulse text-xs text-ink/30">Finding related verses...</span>;
  if (!refs || refs.length === 0) return <p className="text-xs text-ink/40 italic">No cross-references found for this verse.</p>;

  return (
    <div className="space-y-3">
      <h4 className="text-xs font-bold text-sage-dark uppercase tracking-wider">Cross-References</h4>
      <div className="space-y-2">
        {refs.map((r, i) => (
          <div key={i} className="text-sm">
            <button 
              onClick={() => handleRefClick(r.reference)}
              className="font-semibold text-sage hover:underline text-left"
            >
              {r.reference}
            </button>
            <p className="text-xs text-ink/60 mt-0.5">{r.reason}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
