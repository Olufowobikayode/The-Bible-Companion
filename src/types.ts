export interface UserProfile {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
  createdAt: string;
  lastLogin: string;
}

export interface Bookmark {
  id?: string;
  uid: string;
  verseRef: string;
  text: string;
  translation: string;
  createdAt: string;
}

export interface HistoryItem {
  id?: string;
  uid: string;
  emotion: string;
  response: string;
  createdAt: string;
}

export interface BibleVerse {
  reference: string;
  text: string;
  translation: string;
}

export interface AIResponse {
  verses: BibleVerse[];
  reflection: string;
  encouragement: string;
}

export type Translation = 'KJV' | 'NKJV' | 'NIV' | 'ESV' | 'Amplified' | 'NLT' | 'The Message';

export const TRANSLATIONS: Translation[] = ['KJV', 'NKJV', 'NIV', 'ESV', 'Amplified', 'NLT', 'The Message'];
