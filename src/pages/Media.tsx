import React, { useState, useRef } from 'react';
import Hls from 'hls.js';
import { Play, Pause, Radio, Loader2 } from 'lucide-react';

export default function Media() {
  // --- Data Structures ---
  const tvChannels = [
    { id: "TBN.us", name: "TBN", url: "https://acaooyalahd2-lh.akamaihd.net/i/TBN01_delivery@186239/master.m3u8", desc: "Live broadcast of TBN Christian programming.", type: 'video' },
    { id: "Daystar.us", name: "Daystar", url: "https://live20.bozztv.com/dvrfl05/gin-daystar/index.m3u8", desc: "Live stream of the Daystar Television Network.", type: 'video' },
    { id: "GODTV.us", name: "God TV", url: "https://ooyalahd2-f.akamaihd.net/i/godtv01_delivery@17341/master.m3u8", desc: "International Christian media network live feed.", type: 'video' },
    { id: "HopeChannel.us", name: "Hope Channel", url: "https://videodelivery.net/75bc18929102141938b334b01793ca3e/manifest/video.m3u8", desc: "Christian lifestyle and educational programming.", type: 'video' }
  ];

  const radioStations = [
    { name: "BBN English", url: "https://streams.radiomast.io/844b0a81-f4b9-485e-adaa-aab8d3ea9f7f", desc: "Bible Broadcasting Network - English Feed", type: 'audio' },
    { name: "BBN Spanish", url: "https://streams.radiomast.io/475ebed1-595e-4717-b888-64fe8fc6b09f", desc: "Red de Radiodifusión Bíblica", type: 'audio' },
    { name: "Abiding Radio Sacred", url: "https://streams.abidingradio.com:7810/1", desc: "Sacred Vocal and Instrumental Music", type: 'audio' },
    { name: "Abiding Radio Instrumental", url: "https://streams.abidingradio.com:7810/2", desc: "Conservative Instrumental Music", type: 'audio' },
    { name: "Calvary Chapel (CSN)", url: "https://ice7.securenetsystems.net/CSNAAC", desc: "Christian Satellite Network International", type: 'audio' }
  ];

  // --- Logic & State ---
  const [currentMedia, setCurrentMedia] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);

  const playMedia = (item: any) => {
    setCurrentMedia(item);
    setIsLoading(true);
    const video = videoRef.current;
    if (!video) return;

    // Clean up existing HLS stream to prevent memory leaks
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    if (item.type === 'video') {
      if (Hls.isSupported()) {
        const hls = new Hls();
        hls.loadSource(item.url);
        hls.attachMedia(video);
        hlsRef.current = hls;
        hls.on(Hls.Events.MANIFEST_PARSED, () => video.play().catch(() => {}));
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = item.url;
        video.play().catch(() => {});
      }
    } else {
      // Audio stream logic (native browser handling for mp3/aac)
      video.src = item.url;
      video.play().catch(() => {});
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      <div className="mb-8">
        <h1 className="serif text-4xl font-bold text-sage-dark mb-2">Christian Media</h1>
        <p className="text-ink/60">A place for praise, worship, and spiritual nourishment.</p>
      </div>

      {/* Video Player */}
      <div className="bg-sage/5 border border-sage/10 rounded-3xl p-4 mb-8">
        <video 
          ref={videoRef} 
          controls 
          className="w-full rounded-2xl"
          onPlaying={() => setIsLoading(false)}
          onWaiting={() => setIsLoading(true)}
        />
      </div>

      {/* Now Playing Section */}
      <div className="bg-white border border-sage/10 rounded-3xl p-6 mb-8 flex items-center gap-4">
        {isLoading && <Loader2 className="w-8 h-8 animate-spin text-sage" />}
        <div className="info-text">
          <h2 className="text-2xl font-bold text-sage-dark">
            {currentMedia ? currentMedia.name : "Select a Channel"}
          </h2>
          <p className="text-ink/60">
            {currentMedia ? currentMedia.desc : "Choose a TV or Radio station to begin."}
          </p>
        </div>
      </div>

      {/* Selection Lists */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <section>
          <h3 className="text-xl font-bold text-sage-dark mb-4">Live TV</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {tvChannels.map((ch) => (
              <button key={ch.id} onClick={() => playMedia(ch)} className="p-4 bg-white border border-sage/10 rounded-2xl hover:border-sage/30 transition-all text-left">
                <span className="font-bold text-sage-dark">{ch.name}</span>
              </button>
            ))}
          </div>
        </section>

        <section>
          <h3 className="text-xl font-bold text-sage-dark mb-4">Christian Radio</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {radioStations.map((st) => (
              <button key={st.name} onClick={() => playMedia(st)} className="p-4 bg-white border border-sage/10 rounded-2xl hover:border-sage/30 transition-all text-left">
                <span className="font-bold text-sage-dark">{st.name}</span>
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
