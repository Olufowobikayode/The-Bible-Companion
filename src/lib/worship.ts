/**
 * Worship Sanctuary - Synchronized Playback Logic
 * 
 * This module provides a list of Christian worship songs and an algorithm
 * to ensure all users see the same song at the same time.
 */

export interface WorshipSong {
  id: string;
  title: string;
  artist: string;
  duration: number; // in seconds
}

export const WORSHIP_PLAYLIST: WorshipSong[] = [
  { id: 'PUtll3mNj5U', title: 'Way Maker', artist: 'Leeland', duration: 500 },
  { id: 'Z8-z_37881A', title: 'Goodness of God', artist: 'Bethel Music', duration: 300 },
  { id: 'uH6u7_p6p-A', title: '10,000 Reasons (Bless the Lord)', artist: 'Matt Redman', duration: 340 },
  { id: 'f8TkUMJtK5k', title: 'What a Beautiful Name', artist: 'Hillsong Worship', duration: 340 },
  { id: 'C9_7XmN_YpY', title: 'Gratitude', artist: 'Brandon Lake', duration: 360 },
  { id: 'y81yIo1_3o8', title: 'How Great Is Our God', artist: 'Chris Tomlin', duration: 280 },
  { id: 'H_p_98881A', title: 'Holy Forever', artist: 'Chris Tomlin', duration: 310 },
  { id: 'H_p_98881A', title: 'Reckless Love', artist: 'Cory Asbury', duration: 330 },
  { id: 'H_p_98881A', title: 'Oceans (Where Feet May Fail)', artist: 'Hillsong UNITED', duration: 530 },
  { id: 'H_p_98881A', title: 'Build My Life', artist: 'Housefires', duration: 480 },
  { id: 'H_p_98881A', title: 'The Blessing', artist: 'Kari Jobe & Cody Carnes', duration: 700 },
  { id: 'H_p_98881A', title: 'Graves Into Gardens', artist: 'Elevation Worship', duration: 450 },
  { id: 'H_p_98881A', title: 'Firm Foundation (He Won\'t)', artist: 'Cody Carnes', duration: 380 },
  { id: 'H_p_98881A', title: 'Jireh', artist: 'Elevation Worship & Maverick City Music', duration: 600 },
  { id: 'H_p_98881A', title: 'Promises', artist: 'Maverick City Music', duration: 660 },
  { id: 'H_p_98881A', title: 'King of Kings', artist: 'Hillsong Worship', duration: 290 },
  { id: 'H_p_98881A', title: 'Living Hope', artist: 'Phil Wickham', duration: 320 },
  { id: 'H_p_98881A', title: 'Battle Belongs', artist: 'Phil Wickham', duration: 280 },
  { id: 'H_p_98881A', title: 'Amen', artist: 'For KING & COUNTRY', duration: 230 },
  { id: 'H_p_98881A', title: 'God Only Knows', artist: 'For KING & COUNTRY', duration: 220 },
];

/**
 * Calculates the current song and its offset based on the current time.
 * This ensures all users are synchronized.
 */
export function getCurrentWorshipState() {
  const totalDuration = WORSHIP_PLAYLIST.reduce((acc, song) => acc + song.duration, 0);
  const now = Math.floor(Date.now() / 1000);
  const epoch = 1700000000; // Fixed epoch (Nov 2023)
  
  const elapsedSinceEpoch = now - epoch;
  
  // To make it take "years" to repeat the exact sequence, we can shuffle the playlist
  // based on the cycle number.
  const cycleNumber = Math.floor(elapsedSinceEpoch / totalDuration);
  const timeInCycle = elapsedSinceEpoch % totalDuration;
  
  // For simplicity in this demo, we'll use a fixed order but we could shuffle
  // using a seed derived from cycleNumber.
  
  let currentOffset = 0;
  for (const song of WORSHIP_PLAYLIST) {
    if (timeInCycle < currentOffset + song.duration) {
      return {
        song,
        startTime: timeInCycle - currentOffset,
      };
    }
    currentOffset += song.duration;
  }
  
  return {
    song: WORSHIP_PLAYLIST[0],
    startTime: 0,
  };
}
