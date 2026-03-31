import { supabase } from './supabase';

const API_BASE = '/api';

async function getHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session?.access_token || ''}`
  };
}

export const api = {
  async request(path: string, options: RequestInit = {}, retries = 3): Promise<any> {
    const headers = await getHeaders();
    const fullPath = path.startsWith('/api') ? path : `${API_BASE}${path}`;
    console.log('Fetching:', fullPath);
    
    try {
      const res = await fetch(fullPath, {
        cache: 'no-store',
        ...options,
        headers: { ...headers, ...options.headers }
      });

      if (res.status === 429 && retries > 0) {
        console.warn(`Rate limited (429). Retrying in 2s... (${retries} retries left)`);
        await new Promise(resolve => setTimeout(resolve, 2000));
        return this.request(path, options, retries - 1);
      }

      if (!res.ok) {
        const text = await res.text();
        let errorMessage = `API Error: ${res.status} ${res.statusText}`;
        try {
          const json = JSON.parse(text);
          if (json.error) errorMessage += ` - ${json.error}`;
        } catch (e) {
          if (text) errorMessage += ` - ${text}`;
        }
        throw new Error(errorMessage);
      }
      
      return res.json();
    } catch (error: any) {
      if (error.name === 'TypeError' && error.message === 'Failed to fetch') {
        if (retries > 0) {
          console.warn(`Network error (Failed to fetch). Retrying in 1s... (${retries} retries left)`);
          await new Promise(resolve => setTimeout(resolve, 1000));
          return this.request(path, options, retries - 1);
        }
        throw new Error('Network error: Could not reach the server. Please check your connection.');
      }
      throw error;
    }
  },

  async get(path: string) {
    return this.request(path);
  },
  async post(path: string, body: any) {
    return this.request(path, {
      method: 'POST',
      body: JSON.stringify(body)
    });
  },
  async put(path: string, body: any) {
    return this.request(path, {
      method: 'PUT',
      body: JSON.stringify(body)
    });
  },
  async delete(path: string) {
    return this.request(path, {
      method: 'DELETE'
    });
  }
};
