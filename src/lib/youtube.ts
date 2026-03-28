const YOUTUBE_API_KEY = import.meta.env.VITE_YOUTUBE_API_KEY || '';

export const searchYouTube = async (query: string, maxResults = 12, pageToken = '') => {
  if (!YOUTUBE_API_KEY) {
    console.warn('YouTube API Key is missing.');
    return { items: [], nextPageToken: '' };
  }

  try {
    const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(
      query
    )}&type=video&maxResults=${maxResults}&key=${YOUTUBE_API_KEY}${pageToken ? `&pageToken=${pageToken}` : ''}`;
    
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error('Failed to fetch YouTube videos');
    }

    const data = await response.json();
    return {
      items: data.items.map((item: any) => ({
        id: item.id.videoId,
        title: item.snippet.title,
        description: item.snippet.description,
        thumbnail: item.snippet?.thumbnails?.high?.url,
        channelTitle: item.snippet.channelTitle,
      })),
      nextPageToken: data.nextPageToken || ''
    };
  } catch (error) {
    console.error('Error searching YouTube:', error);
    return { items: [], nextPageToken: '' };
  }
};
