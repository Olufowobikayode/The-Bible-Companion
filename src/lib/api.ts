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
  async get(path: string) {
    const headers = await getHeaders();
    const fullPath = path.startsWith('/api') ? path : `${API_BASE}${path}`;
    const res = await fetch(fullPath, { headers });
    if (!res.ok) throw new Error(`API Error: ${res.statusText}`);
    return res.json();
  },
  async post(path: string, body: any) {
    const headers = await getHeaders();
    const fullPath = path.startsWith('/api') ? path : `${API_BASE}${path}`;
    const res = await fetch(fullPath, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error(`API Error: ${res.statusText}`);
    return res.json();
  },
  async put(path: string, body: any) {
    const headers = await getHeaders();
    const fullPath = path.startsWith('/api') ? path : `${API_BASE}${path}`;
    const res = await fetch(fullPath, {
      method: 'PUT',
      headers,
      body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error(`API Error: ${res.statusText}`);
    return res.json();
  },
  async delete(path: string) {
    const headers = await getHeaders();
    const fullPath = path.startsWith('/api') ? path : `${API_BASE}${path}`;
    const res = await fetch(fullPath, {
      method: 'DELETE',
      headers
    });
    if (!res.ok) throw new Error(`API Error: ${res.statusText}`);
    return res.json();
  }
};
