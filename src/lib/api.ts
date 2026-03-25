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
    const res = await fetch(`${API_BASE}${path}`, { headers });
    if (!res.ok) throw new Error(`API Error: ${res.statusText}`);
    return res.json();
  },
  async post(path: string, body: any) {
    const headers = await getHeaders();
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error(`API Error: ${res.statusText}`);
    return res.json();
  },
  async put(path: string, body: any) {
    const headers = await getHeaders();
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error(`API Error: ${res.statusText}`);
    return res.json();
  },
  async delete(path: string) {
    const headers = await getHeaders();
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'DELETE',
      headers
    });
    if (!res.ok) throw new Error(`API Error: ${res.statusText}`);
    return res.json();
  }
};
