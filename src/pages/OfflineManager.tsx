import { useState, useEffect } from 'react';
import { db_local } from '../lib/db';
import { ALL_BOOKS, BOOK_CHAPTER_COUNTS, fetchChapter } from '../lib/bible';
import { TRANSLATIONS } from '../types';
import { Download, Trash2, CheckCircle2, Loader2, Database } from 'lucide-react';

export default function OfflineManager() {
  const [downloadedBooks, setDownloadedBooks] = useState<{ book: string; translation: string; count: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncProgress, setSyncProgress] = useState<{ book: string; translation: string; current: number; total: number } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ book: string; translation: string } | null>(null);
  
  const [selectedBook, setSelectedBook] = useState(ALL_BOOKS[0]);
  const [selectedTranslation, setSelectedTranslation] = useState(TRANSLATIONS[0]);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    setLoading(true);
    try {
      const allChapters = await db_local.bible_chapters.toArray();
      const stats: Record<string, number> = {};
      
      allChapters.forEach(ch => {
        const key = `${ch.book}_${ch.translation}`;
        stats[key] = (stats[key] || 0) + 1;
      });

      const formattedStats = Object.keys(stats).map(key => {
        const [book, translation] = key.split('_');
        return { book, translation, count: stats[key] };
      });

      setDownloadedBooks(formattedStats);
    } catch (error) {
      console.error("Failed to load offline stats", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    const total = BOOK_CHAPTER_COUNTS[selectedBook] || 1;
    setSyncProgress({ book: selectedBook, translation: selectedTranslation, current: 0, total });
    
    for (let c = 1; c <= total; c++) {
      setSyncProgress({ book: selectedBook, translation: selectedTranslation, current: c, total });
      await fetchChapter(selectedBook, c, selectedTranslation);
    }
    
    setSyncProgress(null);
    loadStats();
  };

  const handleDelete = (book: string, translation: string) => {
    setConfirmDelete({ book, translation });
  };

  const executeDelete = async () => {
    if (!confirmDelete) return;
    const { book, translation } = confirmDelete;
    setConfirmDelete(null);
    
    try {
      const chaptersToDelete = await db_local.bible_chapters
        .where('book').equals(book)
        .and(ch => ch.translation === translation)
        .toArray();
        
      const idsToDelete = chaptersToDelete.map(ch => ch.id);
      await db_local.bible_chapters.bulkDelete(idsToDelete);
      loadStats();
    } catch (error) {
      console.error("Failed to delete offline book", error);
    }
  };

  const isFullyDownloaded = (book: string, translation: string) => {
    const stat = downloadedBooks.find(d => d.book === book && d.translation === translation);
    const total = BOOK_CHAPTER_COUNTS[book] || 1;
    return stat && stat.count >= total;
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex items-center gap-3 mb-8">
        <Database className="w-8 h-8 text-sage-dark" />
        <h1 className="text-3xl font-bold text-sage-dark">Offline Storage</h1>
      </div>
      
      <p className="text-ink/70 mb-8">
        Download specific books and translations to your device so you can read them without an internet connection.
      </p>

      <div className="bg-sage-light/20 p-6 rounded-2xl border border-sage-light/50 mb-10">
        <h2 className="text-xl font-semibold mb-4 text-sage-dark">Download New Book</h2>
        <div className="flex flex-wrap items-center gap-4">
          <select
            value={selectedBook}
            onChange={(e) => setSelectedBook(e.target.value)}
            className="bg-white border border-sage/20 rounded-xl px-4 py-3 focus:outline-none focus:border-sage min-w-[200px]"
            disabled={!!syncProgress}
          >
            {ALL_BOOKS.map(b => <option key={b} value={b}>{b}</option>)}
          </select>

          <select
            value={selectedTranslation}
            onChange={(e) => setSelectedTranslation(e.target.value as any)}
            className="bg-white border border-sage/20 rounded-xl px-4 py-3 focus:outline-none focus:border-sage min-w-[150px]"
            disabled={!!syncProgress}
          >
            {TRANSLATIONS.map(t => <option key={t} value={t}>{t}</option>)}
          </select>

          <button
            onClick={handleDownload}
            disabled={!!syncProgress || isFullyDownloaded(selectedBook, selectedTranslation)}
            className="bg-sage text-white px-6 py-3 rounded-xl font-medium hover:bg-sage-dark transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {syncProgress ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Downloading ({syncProgress.current}/{syncProgress.total})
              </>
            ) : isFullyDownloaded(selectedBook, selectedTranslation) ? (
              <>
                <CheckCircle2 className="w-5 h-5" />
                Already Downloaded
              </>
            ) : (
              <>
                <Download className="w-5 h-5" />
                Download for Offline
              </>
            )}
          </button>
        </div>
      </div>

      <h2 className="text-xl font-semibold mb-4 text-sage-dark">Downloaded Content</h2>
      
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-sage" />
        </div>
      ) : downloadedBooks.length === 0 ? (
        <div className="text-center py-12 text-ink/50 bg-white border border-sage/10 rounded-2xl">
          You haven't downloaded any books for offline reading yet.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {downloadedBooks.map((stat, i) => {
            const total = BOOK_CHAPTER_COUNTS[stat.book] || 1;
            const progress = Math.round((stat.count / total) * 100);
            
            return (
              <div key={i} className="bg-white p-5 border border-sage/20 rounded-2xl flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-lg text-sage-dark">{stat.book}</h3>
                  <p className="text-sm text-ink/60">{stat.translation} Translation</p>
                  <div className="mt-2 flex items-center gap-2">
                    <div className="w-32 h-2 bg-sage-light/30 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-sage" 
                        style={{ width: `${Math.min(100, progress)}%` }}
                      />
                    </div>
                    <span className="text-xs text-ink/50">{stat.count}/{total} chapters</span>
                  </div>
                </div>
                
                <button
                  onClick={() => handleDelete(stat.book, stat.translation)}
                  className="p-3 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                  title="Remove from offline storage"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {confirmDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
          <div className="bg-white p-8 rounded-[2.5rem] max-w-sm w-full shadow-2xl">
            <h3 className="serif text-2xl font-semibold text-sage-dark mb-4">Confirm Deletion</h3>
            <p className="text-ink/70 mb-8 leading-relaxed">
              Are you sure you want to delete <strong>{confirmDelete.book} ({confirmDelete.translation})</strong> from offline storage?
            </p>
            <div className="flex gap-3">
              <button 
                onClick={() => setConfirmDelete(null)}
                className="flex-1 px-6 py-3 rounded-xl border border-sage/20 font-medium hover:bg-sage-light transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={executeDelete}
                className="flex-1 px-6 py-3 bg-destructive text-white rounded-xl font-medium hover:bg-destructive/90 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
