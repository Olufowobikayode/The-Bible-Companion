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
    const res = await fetch(fullPath, {
      ...options,
      headers: { ...headers, ...options.headers }
    });

    if (res.status === 429 && retries > 0) {
      await new Promise(resolve => setTimeout(resolve, 2000 * (4 - retries)));
      return this.request(path, options, retries - 1);
    }

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`API Error: ${res.statusText} - ${text}`);
    }
    return res.json();
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
