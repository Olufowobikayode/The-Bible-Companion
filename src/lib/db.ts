import Dexie, { type Table } from 'dexie';

export interface BibleChapter {
  id: string; // translation_book_chapter
  translation: string;
  book: string;
  chapter: number;
  content: any;
  updatedAt: string;
}

export interface ConcordanceEntry {
  word: string;
  data: any;
  updatedAt: string;
}

export interface GeminiCache {
  key: string; // prompt + model
  response: string;
  updatedAt: number;
}

export class BibleCompanionDB extends Dexie {
  bible_chapters!: Table<BibleChapter>;
  concordance_entries!: Table<ConcordanceEntry>;
  gemini_cache!: Table<GeminiCache>;

  constructor() {
    super('BibleCompanionDB');
    this.version(1).stores({
      bible_chapters: 'id, translation, book, chapter',
      concordance_entries: 'word',
      gemini_cache: 'key'
    });
  }
}

export const db_local = new BibleCompanionDB();
