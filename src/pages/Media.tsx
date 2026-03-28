import React, { useState, useEffect, useCallback } from 'react';
import { Search, Play, Loader2, Music, Radio, X, ChevronDown } from 'lucide-react';
import { searchYouTube } from '../lib/youtube';
import YouTube from 'react-youtube';
import { toast } from 'sonner';
import { getCurrentWorshipState, WorshipSong } from '../lib/worship';

export default function Media() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextPageToken, setNextPageToken] = useState('');
  const [activeVideo, setActiveVideo] = useState<string | null>(null);
  const [liveWorship, setLiveWorship] = useState<{ song: WorshipSong; startTime: number } | null>(null);
  const [isLiveMode, setIsLiveMode] = useState(true);
  const [activeTab, setActiveTab] = useState<'youtube' | 'radio'>('youtube');

  const fetchLiveWorship = useCallback(async (retries = 3) => {
    try {
      const res = await fetch('/api/worship/current');
      if (res.status === 429 && retries > 0) {
        setTimeout(() => fetchLiveWorship(retries - 1), 5000);
        return;
      }
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Failed to fetch live worship: ${text}`);
      }
      const data = await res.json();
      setLiveWorship(data);
    } catch (error) {
      console.error("Error fetching live worship:", error);
    }
  }, []);

  useEffect(() => {
    fetchLiveWorship();
    const interval = setInterval(fetchLiveWorship, 60000); // Sync every 60s
    
    return () => clearInterval(interval);
  }, [fetchLiveWorship]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    
    setLoading(true);
    setIsLiveMode(false);
    setResults([]);
    setNextPageToken('');
    try {
      if (activeTab === 'youtube') {
        const { items, nextPageToken: token } = await searchYouTube(query + ' worship sermon');
        setResults(items);
        setNextPageToken(token);
      }
      
      if (results.length === 0 && !loading) {
        // toast.info('No results found.');
      }
    } catch (error) {
      console.error("Error searching media:", error);
      toast.error('Failed to search media.');
    } finally {
      setLoading(false);
    }
  };

  const handleLoadMore = async () => {
    if (!nextPageToken || loadingMore) return;

    setLoadingMore(true);
    try {
      if (activeTab === 'youtube') {
        const { items, nextPageToken: token } = await searchYouTube(query + ' worship sermon', 12, nextPageToken);
        setResults(prev => [...prev, ...items]);
        setNextPageToken(token);
      }
    } catch (error) {
      console.error("Error loading more results:", error);
      toast.error('Failed to load more results.');
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="serif text-4xl font-bold text-sage-dark mb-2">Media Search</h1>
          <p className="text-ink/60">A quiet place for praise, worship, and spiritual nourishment.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button 
            onClick={() => setIsLiveMode(true)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${isLiveMode ? 'bg-sage text-white shadow-lg shadow-sage/20' : 'bg-white text-sage-dark border border-sage/20'}`}
          >
            <Radio className="w-4 h-4" />
            Live
          </button>
          <button 
            onClick={() => { setIsLiveMode(false); setActiveTab('youtube'); }}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${!isLiveMode && activeTab === 'youtube' ? 'bg-sage text-white shadow-lg shadow-sage/20' : 'bg-white text-sage-dark border border-sage/20'}`}
          >
            YouTube
          </button>
          <button 
            onClick={() => { setIsLiveMode(false); setActiveTab('radio'); }}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${!isLiveMode && activeTab === 'radio' ? 'bg-sage text-white shadow-lg shadow-sage/20' : 'bg-white text-sage-dark border border-sage/20'}`}
          >
            <Music className="w-4 h-4" />
            Radio
          </button>
        </div>
      </div>

      {isLiveMode && liveWorship && (
        <div className="mb-12">
          <div className="bg-sage/5 border border-sage/10 rounded-3xl p-6 md:p-8 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-sage rounded-xl flex items-center justify-center text-white animate-pulse">
                <Music className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-sage-dark">Now Playing in the Sanctuary</h2>
                <p className="text-xs text-sage font-bold uppercase tracking-widest">Synchronized for all believers</p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-center">
              <div className="lg:col-span-2 aspect-video rounded-2xl overflow-hidden shadow-2xl bg-black ring-1 ring-sage/10">
                {liveWorship.song.id && (
                  <YouTube 
                    videoId={liveWorship.song.id} 
                    opts={{ 
                      width: '100%', 
                      height: '100%', 
                      playerVars: { 
                        autoplay: 1, 
                        start: Math.floor(liveWorship.startTime),
                        controls: 1,
                        modestbranding: 1,
                        rel: 0
                      } 
                    }} 
                    onEnd={() => fetchLiveWorship()}
                    className="w-full h-full"
                  />
                )}
              </div>
              <div className="space-y-6">
                <div className="bg-white/50 backdrop-blur-sm p-6 rounded-2xl border border-sage/10">
                  <h3 className="text-2xl serif font-bold text-sage-dark mb-1">{liveWorship.song.title}</h3>
                  <p className="text-sage font-medium mb-4">{liveWorship.song.artist}</p>
                  <div className="flex items-center gap-2 text-xs text-ink/40 font-bold uppercase tracking-widest">
                    <span className="w-2 h-2 bg-red-500 rounded-full animate-ping" />
                    Live Transmission
                  </div>
                </div>
                <div className="p-6 bg-sage text-white rounded-2xl shadow-lg shadow-sage/20">
                  <p className="text-sm font-medium italic mb-2">"Let everything that has breath praise the Lord."</p>
                  <p className="text-xs font-bold opacity-80">— Psalm 150:6</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {!isLiveMode && (
        <>
          <form onSubmit={handleSearch} className="relative mb-12">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search for worship, sermons, or spiritual teachings..."
              className="w-full pl-14 pr-4 py-5 rounded-2xl border border-sage/20 bg-white shadow-sm focus:ring-4 focus:ring-sage/10 transition-all text-lg"
            />
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-6 h-6 text-sage" />
            <button 
              type="submit"
              className="absolute right-3 top-1/2 -translate-y-1/2 bg-sage text-white px-6 py-2.5 rounded-xl text-sm font-bold hover:bg-sage-dark transition-all shadow-lg shadow-sage/20"
              disabled={loading}
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Search'}
            </button>
          </form>

          {activeVideo && activeTab === 'youtube' && (
            <div className="mb-12 rounded-2xl overflow-hidden shadow-2xl bg-black aspect-video ring-1 ring-sage/10">
              <YouTube 
                videoId={activeVideo} 
                opts={{ 
                  width: '100%', 
                  height: '100%', 
                  playerVars: { 
                    autoplay: 1,
                    modestbranding: 1,
                    rel: 0
                  } 
                }} 
                className="w-full h-full"
              />
            </div>
          )}

          {activeTab === 'radio' && (
            <div className="mb-12 rounded-2xl p-8 bg-white border border-sage/10 shadow-sm flex flex-col items-center justify-center gap-6">
              <div className="w-20 h-20 bg-sage/10 rounded-full flex items-center justify-center text-sage">
                <Radio className="w-10 h-10" />
              </div>
              <h2 className="text-2xl font-bold text-sage-dark">Christian Radio</h2>
              <p className="text-ink/60 text-center max-w-md">Listen to uplifting worship music and teachings 24/7.</p>
              <audio controls className="w-full max-w-md">
                <source src="https://stream.hopefm.net/hopefm" type="audio/mpeg" />
                Your browser does not support the audio element.
              </audio>
            </div>
          )}

          {activeTab !== 'radio' && (
            <div className="space-y-12">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {results.map((video) => (
                  <div 
                    key={video.id} 
                    className="bg-white rounded-2xl overflow-hidden shadow-sm border border-sage/10 hover:shadow-xl transition-all cursor-pointer group hover:-translate-y-1"
                    onClick={() => {
                      setActiveVideo(video.id);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                  >
                    <div className="relative aspect-video">
                      <img 
                        src={video.thumbnail} 
                        alt={video.title}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                        <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 scale-75 group-hover:scale-100 transition-all">
                          <Play className="w-6 h-6 fill-current" />
                        </div>
                      </div>
                    </div>
                    <div className="p-5">
                      <h3 className="font-bold text-ink line-clamp-2 mb-2 group-hover:text-sage transition-colors" dangerouslySetInnerHTML={{ __html: video.title || '' }} />
                      <p className="text-xs font-bold text-sage uppercase tracking-widest">{video.channelTitle}</p>
                    </div>
                  </div>
                ))}
              </div>

              {nextPageToken && (
                <div className="flex justify-center pt-8">
                  <button
                    onClick={handleLoadMore}
                    disabled={loadingMore}
                    className="flex items-center gap-2 px-8 py-3 rounded-2xl bg-white border border-sage/20 text-sage-dark font-bold hover:bg-sage-light/20 transition-all shadow-sm"
                  >
                    {loadingMore ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        <ChevronDown className="w-5 h-5" />
                        Load More Results
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
