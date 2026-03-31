import React, { createContext, useContext, useState, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import ReactPlayer from 'react-player';

interface RadioStation {
  name: string;
  url: string;
  desc: string;
  isEmbed?: boolean;
}

interface AudioContextType {
  currentStation: RadioStation | null;
  isPlaying: boolean;
  playStation: (station: RadioStation) => void;
  stopStation: () => void;
  togglePlay: () => void;
}

const AudioContext = createContext<AudioContextType | undefined>(undefined);

const Player = ReactPlayer as any;

export function AudioProvider({ children }: { children: React.ReactNode }) {
  const [currentStation, setCurrentStation] = useState<RadioStation | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const playerRef = useRef<any>(null);

  const playStation = (station: RadioStation) => {
    if (currentStation?.url === station.url) {
      setIsPlaying(!isPlaying);
      return;
    }

    setCurrentStation(station);
    setIsPlaying(true);
  };

  const stopStation = () => {
    setIsPlaying(false);
    setCurrentStation(null);
  };

  const togglePlay = () => {
    setIsPlaying(!isPlaying);
  };

  return (
    <AudioContext.Provider value={{ currentStation, isPlaying, playStation, stopStation, togglePlay }}>
      {children}
      <Player
        ref={playerRef}
        url={currentStation?.url || ''}
        playing={isPlaying}
        onPlay={() => { if (!isPlaying) setIsPlaying(true); }}
        onPause={() => { if (isPlaying) setIsPlaying(false); }}
        width="0"
        height="0"
        config={ {
          file: {
            forceAudio: true,
            attributes: {
              crossOrigin: 'anonymous'
            }
          }
        } as any }
        onError={(err: any) => {
          console.error("ReactPlayer error:", err);
          if (currentStation) {
            toast.error(`Failed to play ${currentStation.name}. The stream might be unavailable.`);
          }
          setIsPlaying(false);
        }}
      />
    </AudioContext.Provider>
  );
}

export function useAudio() {
  const context = useContext(AudioContext);
  if (context === undefined) {
    throw new Error('useAudio must be used within an AudioProvider');
  }
  return context;
}
