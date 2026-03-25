const YOUTUBE_API_KEY = import.meta.env.VITE_YOUTUBE_API_KEY || '';

export const searchYouTube = async (query: string, maxResults = 5) => {
  if (!YOUTUBE_API_KEY) {
    console.warn('YouTube API Key is missing.');
    return [];
  }

  try {
    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(
        query
      )}&type=video&maxResults=${maxResults}&key=${YOUTUBE_API_KEY}`
    );

    if (!response.ok) {
      throw new Error('Failed to fetch YouTube videos');
    }

    const data = await response.json();
    return data.items.map((item: any) => ({
      id: item.id.videoId,
      title: item.snippet.title,
      description: item.snippet.description,
      thumbnail: item.snippet?.thumbnails?.high?.url,
      channelTitle: item.snippet.channelTitle,
    }));
  } catch (error) {
    console.error('Error searching YouTube:', error);
    return [];
  }
};
