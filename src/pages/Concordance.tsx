import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, Loader2, Book, Languages, Sparkles, Plus, X, Save, ChevronDown, Download, CheckCircle2 } from 'lucide-react';
import { askBibleQuestion, getConcordanceEntry } from '../lib/gemini';
import ReactMarkdown from 'react-markdown';
import { db, auth } from '../firebase';
import { collection, addDoc, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { db_local } from '../lib/db';
import { toast } from 'sonner';

interface ConcordanceResult {
  word: string;
  original: string;
  transliteration: string;
  language: 'Hebrew' | 'Greek';
  definition: string;
  usage: string[];
  etymology: string;
  isCustom?: boolean;
}

const COMMON_WORDS = [
  'Grace', 'Love', 'Peace', 'Word', 'Faith', 'Spirit', 'Truth', 'Mercy', 'Holy', 'Glory', 'Shalom', 'Logos', 'Agape', 'Pistis', 'Pneuma'
];

export default function Concordance() {
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ConcordanceResult | null>(null);
  const [customEntries, setCustomEntries] = useState<ConcordanceResult[]>([]);
  const [isAddingCustom, setIsAddingCustom] = useState(false);
  const [showDetailedOriginal, setShowDetailedOriginal] = useState(false);
  const [syncProgress, setSyncProgress] = useState<{ current: number; total: number } | null>(null);
  const [newEntry, setNewEntry] = useState<Partial<ConcordanceResult>>({
    language: 'Hebrew',
    usage: []
  });
  const navigate = useNavigate();

  useEffect(() => {
    if (!auth.currentUser) return;

    const q = query(
      collection(db, 'custom_concordance'),
      where('uid', '==', auth.currentUser.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const entries = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id,
        isCustom: true
      })) as any[];
      setCustomEntries(entries);
    });

    return () => unsubscribe();
  }, []);

  const handleSearch = async (wordToSearch?: string) => {
    const term = wordToSearch || searchQuery;
    if (!term.trim()) return;

    setLoading(true);
    setResult(null);

    // 1. Check custom entries first
    const localMatch = customEntries.find(e => 
      e.word.toLowerCase() === term.toLowerCase()
    );

    if (localMatch) {
      setResult(localMatch);
      setLoading(false);
      return;
    }

    // 2. Check local IndexedDB cache
    const cached = await db_local.concordance_entries.get(term.toLowerCase());
    if (cached) {
      setResult(cached.data);
      setLoading(false);
      return;
    }

    // 3. Fetch from AI
    try {
      const data = await getConcordanceEntry(term);
      if (data) {
        setResult(data);
        
        // Cache in local DB
        await db_local.concordance_entries.put({
          word: term.toLowerCase(),
          data: data,
          updatedAt: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error('Concordance search failed:', error);
      toast.error('Failed to search concordance.');
    } finally {
      setLoading(false);
    }
  };

  const handleSyncCommon = async () => {
    setSyncProgress({ current: 0, total: COMMON_WORDS.length });
    for (let i = 0; i < COMMON_WORDS.length; i++) {
      const word = COMMON_WORDS[i];
      const cached = await db_local.concordance_entries.get(word.toLowerCase());
      if (!cached) {
        await handleSearch(word);
      }
      setSyncProgress({ current: i + 1, total: COMMON_WORDS.length });
    }
    setTimeout(() => setSyncProgress(null), 3000);
    toast.success('Common words synced for offline use.');
  };

  const handleAddCustom = async () => {
    if (!auth.currentUser) {
      toast.error('Please sign in to add custom entries.');
      return;
    }

    if (!newEntry.word || !newEntry.definition) {
      toast.error('Word and Definition are required.');
      return;
    }

    try {
      await addDoc(collection(db, 'custom_concordance'), {
        word: newEntry.word,
        original: newEntry.original || '',
        transliteration: newEntry.transliteration || '',
        language: newEntry.language || 'Hebrew',
        definition: newEntry.definition,
        usage: newEntry.usage || [],
        etymology: newEntry.etymology || '',
        uid: auth.currentUser.uid,
        createdAt: new Date().toISOString()
      });
      setIsAddingCustom(false);
      setNewEntry({ language: 'Hebrew', usage: [] });
      toast.success('Custom entry saved!');
    } catch (error) {
      console.error('Failed to add custom entry:', error);
      toast.error('Failed to save entry. Please try again.');
    }
  };

  const parseReferences = (text: string) => {
    const refRegex = /([1-3]?\s?[A-Z][a-z]+)\s(\d+):(\d+)/g;
    const parts = text.split(refRegex);
    if (parts.length === 1) return text;

    const result = [];
    let lastIndex = 0;
    let match;
    
    refRegex.lastIndex = 0;
    while ((match = refRegex.exec(text)) !== null) {
      const [full, b, c, v] = match;
      const index = match.index;
      result.push(text.substring(lastIndex, index));
      result.push(
        <button
          key={index}
          onClick={() => navigate('/bible', { state: { book: b, chapter: parseInt(c), verse: parseInt(v) } })}
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

  const sortedWords = Array.from(new Set([...COMMON_WORDS, ...customEntries.map(e => e.word)])).sort();
  
  const groupedWords = sortedWords.reduce((acc, word) => {
    const firstChar = word[0].toUpperCase();
    const key = /^[A-Z]$/.test(firstChar) ? firstChar : '#';
    if (!acc[key]) acc[key] = [];
    acc[key].push(word);
    return acc;
  }, {} as Record<string, string[]>);

  const sortedKeys = Object.keys(groupedWords).sort((a, b) => {
    if (a === '#') return 1;
    if (b === '#') return -1;
    return a.localeCompare(b);
  });

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <div className="text-center mb-12">
        <h1 className="serif text-5xl font-semibold text-sage-dark mb-4">Biblical Concordance</h1>
        <p className="text-ink/60 max-w-2xl mx-auto">
          Deepen your study with original Hebrew and Greek meanings, etymology, and theological insights.
        </p>
      </div>

      <div className="flex flex-col md:flex-row gap-4 mb-12">
        <div className="flex-grow flex flex-col gap-2">
          <div className="flex gap-2">
            <div className="relative flex-grow">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search for a word..."
                className="w-full bg-white border-2 border-sage/20 rounded-2xl px-6 py-4 text-lg focus:outline-none focus:border-sage transition-all pr-16"
              />
              <button
                onClick={() => handleSearch()}
                disabled={loading}
                className="absolute right-2 top-2 bottom-2 bg-sage text-white px-5 rounded-xl hover:bg-sage-dark transition-colors disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
              </button>
            </div>
            
            <div className="relative group">
              <select
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  handleSearch(e.target.value);
                }}
                className="appearance-none bg-white border-2 border-sage/20 rounded-2xl px-6 py-4 text-lg focus:outline-none focus:border-sage transition-all pr-12 cursor-pointer"
                value=""
              >
                <option value="" disabled>Browse Words...</option>
                {sortedKeys.map(key => (
                  <optgroup key={key} label={key}>
                    {groupedWords[key].map(word => (
                      <option key={word} value={word}>{word}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-sage-dark pointer-events-none" />
            </div>
          </div>

          <div className="flex items-center justify-between px-2">
            <button
              onClick={handleSyncCommon}
              disabled={!!syncProgress}
              className="text-xs font-medium text-sage hover:text-sage-dark flex items-center gap-2 transition-colors disabled:opacity-50"
            >
              {syncProgress ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>Downloading Common Words ({syncProgress.current}/{syncProgress.total})...</span>
                </>
              ) : (
                <>
                  <Download className="w-3 h-3" />
                  <span>Download Common Words for Offline Use</span>
                </>
              )}
            </button>
            
            {syncProgress?.current === syncProgress?.total && syncProgress?.total > 0 && (
              <span className="text-xs text-emerald-600 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                Synced
              </span>
            )}
          </div>
        </div>
        
        <button
          onClick={() => setIsAddingCustom(true)}
          className="bg-white border border-sage/20 rounded-[2rem] px-8 py-4 text-sage-dark font-medium hover:bg-sage-light transition-all flex items-center justify-center gap-2 shadow-sm whitespace-nowrap h-fit"
        >
          <Plus className="w-5 h-5" />
          Add Custom
        </button>
      </div>

      {/* Custom Entry Modal */}
      <AnimatePresence>
        {isAddingCustom && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddingCustom(false)}
              className="absolute inset-0 bg-ink/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-2xl bg-white rounded-[2.5rem] shadow-2xl p-8 sm:p-12 border border-sage/10 overflow-y-auto max-h-[90vh]"
            >
              <button
                onClick={() => setIsAddingCustom(false)}
                className="absolute right-6 top-6 p-2 text-ink/40 hover:text-sage transition-colors"
              >
                <X size={24} />
              </button>
              <h2 className="serif text-3xl font-semibold text-sage-dark mb-8">New Custom Entry</h2>
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-xs font-bold text-ink/40 uppercase tracking-widest mb-2">Word</label>
                    <input
                      type="text"
                      value={newEntry.word || ''}
                      onChange={(e) => setNewEntry({ ...newEntry, word: e.target.value })}
                      className="w-full bg-cream border border-sage/20 rounded-xl px-4 py-3 focus:outline-none focus:border-sage"
                      placeholder="e.g. Agape"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-ink/40 uppercase tracking-widest mb-2">Original Script</label>
                    <input
                      type="text"
                      value={newEntry.original || ''}
                      onChange={(e) => setNewEntry({ ...newEntry, original: e.target.value })}
                      className="w-full bg-cream border border-sage/20 rounded-xl px-4 py-3 focus:outline-none focus:border-sage"
                      placeholder="e.g. ἀγάπη"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-xs font-bold text-ink/40 uppercase tracking-widest mb-2">Transliteration</label>
                    <input
                      type="text"
                      value={newEntry.transliteration || ''}
                      onChange={(e) => setNewEntry({ ...newEntry, transliteration: e.target.value })}
                      className="w-full bg-cream border border-sage/20 rounded-xl px-4 py-3 focus:outline-none focus:border-sage"
                      placeholder="e.g. agapē"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-ink/40 uppercase tracking-widest mb-2">Language</label>
                    <select
                      value={newEntry.language}
                      onChange={(e) => setNewEntry({ ...newEntry, language: e.target.value as any })}
                      className="w-full bg-cream border border-sage/20 rounded-xl px-4 py-3 focus:outline-none focus:border-sage"
                    >
                      <option value="Hebrew">Hebrew</option>
                      <option value="Greek">Greek</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-ink/40 uppercase tracking-widest mb-2">Definition</label>
                  <textarea
                    value={newEntry.definition || ''}
                    onChange={(e) => setNewEntry({ ...newEntry, definition: e.target.value })}
                    className="w-full bg-cream border border-sage/20 rounded-xl px-4 py-3 focus:outline-none focus:border-sage h-32 resize-none"
                    placeholder="Enter detailed definition..."
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-ink/40 uppercase tracking-widest mb-2">Usage Examples (one per line)</label>
                  <textarea
                    value={newEntry.usage?.join('\n') || ''}
                    onChange={(e) => setNewEntry({ ...newEntry, usage: e.target.value.split('\n').filter(l => l.trim()) })}
                    className="w-full bg-cream border border-sage/20 rounded-xl px-4 py-3 focus:outline-none focus:border-sage h-24 resize-none"
                    placeholder="e.g. John 3:16"
                  />
                </div>
                <button
                  onClick={handleAddCustom}
                  className="w-full bg-sage text-white py-4 rounded-2xl font-semibold hover:bg-sage-dark transition-all flex items-center justify-center gap-2 shadow-lg shadow-sage/20"
                >
                  <Save className="w-5 h-5" />
                  Save Entry
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="space-y-8"
          >
            <div className="bg-white rounded-[3rem] p-10 border border-sage/10 shadow-sm relative">
              {result.isCustom && (
                <span className="absolute top-6 right-10 bg-sage-light text-sage-dark px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest">
                  Custom Entry
                </span>
              )}
              <div className="flex flex-wrap justify-between items-start gap-6 mb-10 border-b border-sage/10 pb-8">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-[10px] text-sage-dark font-bold uppercase tracking-widest bg-sage-light px-3 py-1 rounded-full">
                      {result.language}
                    </span>
                    <span className="text-ink/30 text-xs font-mono">{result.transliteration}</span>
                  </div>
                  <h2 className="serif text-5xl font-semibold text-sage-dark">{result.word}</h2>
                </div>
                <div className="text-right">
                  <button 
                    onClick={() => setShowDetailedOriginal(true)}
                    className="text-6xl font-serif text-sage mb-2 hover:scale-105 transition-transform cursor-pointer"
                    title="Click for details"
                  >
                    {result.original}
                  </button>
                  <div className="text-[10px] text-ink/30 uppercase tracking-widest">Original Script (Click for details)</div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                <div className="space-y-8">
                  <section>
                    <h3 className="serif text-xl font-medium text-sage-dark mb-4 flex items-center gap-2">
                      <Book className="w-5 h-5" />
                      Definition & Significance
                    </h3>
                    <div className="text-ink/70 leading-relaxed">
                      <ReactMarkdown>{result.definition}</ReactMarkdown>
                    </div>
                  </section>

                  {result.etymology && (
                    <section>
                      <h3 className="serif text-xl font-medium text-sage-dark mb-4 flex items-center gap-2">
                        <Languages className="w-5 h-5" />
                        Etymology
                      </h3>
                      <p className="text-ink/60 italic">{result.etymology}</p>
                    </section>
                  )}
                </div>

                <div className="space-y-8">
                  <section className="bg-sage-light/30 p-8 rounded-3xl border border-sage/10">
                    <h3 className="serif text-xl font-medium text-sage-dark mb-6 flex items-center gap-2">
                      <Sparkles className="w-5 h-5" />
                      Key Occurrences
                    </h3>
                    <ul className="space-y-4">
                      {result.usage.map((ref, i) => (
                        <li key={i} className="flex items-start gap-3 text-sm text-ink/70">
                          <div className="w-1.5 h-1.5 bg-sage rounded-full mt-1.5 shrink-0" />
                          <div className="flex-grow">{parseReferences(ref)}</div>
                        </li>
                      ))}
                    </ul>
                  </section>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Detailed Original Modal */}
      <AnimatePresence>
        {showDetailedOriginal && result && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowDetailedOriginal(false)}
              className="absolute inset-0 bg-ink/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-lg bg-cream rounded-[2.5rem] shadow-2xl p-8 sm:p-12 border border-sage/10"
            >
              <button
                onClick={() => setShowDetailedOriginal(false)}
                className="absolute right-6 top-6 p-2 text-ink/40 hover:text-sage transition-colors"
              >
                <X size={24} />
              </button>
              <div className="space-y-6 text-center">
                <div className="text-7xl font-serif text-sage mb-4">{result.original}</div>
                <div className="text-xl font-mono text-ink/40 italic mb-6">{result.transliteration}</div>
                <div className="space-y-4 text-left">
                  <div>
                    <h4 className="text-xs font-bold text-sage-dark uppercase tracking-widest mb-1">Meaning</h4>
                    <p className="text-ink/70 leading-relaxed">{result.definition}</p>
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-sage-dark uppercase tracking-widest mb-1">Etymology</h4>
                    <p className="text-ink/60 italic">{result.etymology}</p>
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-sage-dark uppercase tracking-widest mb-1">Usage Examples</h4>
                    <ul className="list-disc list-inside text-ink/70 leading-relaxed text-sm">
                      {result.usage.map((u, i) => <li key={i}>{u}</li>)}
                    </ul>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {customEntries.length > 0 && !result && (
        <div className="mt-20">
          <h2 className="serif text-2xl font-semibold text-sage-dark mb-8">My Custom Entries</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {customEntries.map((entry: any) => (
              <button
                key={entry.id}
                onClick={() => setResult(entry)}
                className="bg-white p-6 rounded-2xl border border-sage/10 hover:border-sage transition-all text-left shadow-sm group"
              >
                <div className="flex justify-between items-start mb-2">
                  <h3 className="serif text-xl font-medium text-sage-dark">{entry.word}</h3>
                  <span className="text-[10px] text-ink/30 uppercase tracking-widest">{entry.language}</span>
                </div>
                <p className="text-ink/40 text-sm line-clamp-2">{entry.definition}</p>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
