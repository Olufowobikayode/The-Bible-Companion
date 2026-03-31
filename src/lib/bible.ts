// Using a public API for Bible text. 
// Note: Bible.com doesn't have a simple public API for free text access without a key.
// We'll use Bible-API.com as a fallback or mock the translation logic if needed.
// For this app, we'll implement a robust fetcher that can handle multiple translations.

import { askBibleQuestion, getExtraBookChapter } from './gemini';
import { db_local } from './db';

export const BOOKS = [
  "Genesis", "Exodus", "Leviticus", "Numbers", "Deuteronomy", "Joshua", "Judges", "Ruth", "1 Samuel", "2 Samuel",
  "1 Kings", "2 Kings", "1 Chronicles", "2 Chronicles", "Ezra", "Nehemiah", "Esther", "Job", "Psalms", "Proverbs",
  "Ecclesiastes", "Song of Solomon", "Isaiah", "Jeremiah", "Lamentations", "Ezekiel", "Daniel", "Hosea", "Joel", "Amos",
  "Obadiah", "Jonah", "Micah", "Nahum", "Habakkuk", "Zephaniah", "Haggai", "Zechariah", "Malachi",
  "Matthew", "Mark", "Luke", "John", "Acts", "Romans", "1 Corinthians", "2 Corinthians", "Galatians", "Ephesians", "Philippians",
  "Colossians", "1 Thessalonians", "2 Thessalonians", "1 Timothy", "2 Timothy", "Titus", "Philemon", "Hebrews", "James", "1 Peter",
  "2 Peter", "1 John", "2 John", "3 John", "Jude", "Revelation"
];

// Added "Lost" books as requested
export const EXTRA_BOOKS = [
  "Enoch", "Jasher", "Jubilees", "Gospel of Thomas", "Gospel of Mary", "Didache", "Letter of Barnabas", "1 Clement", "2 Clement", "Shepherd of Hermas",
  "Gospel of Philip", "Gospel of Judas", "Apocryphon of John", "Sophia of Jesus Christ", "Acts of Paul and Thecla", "Infancy Gospel of Thomas", "Protevangelium of James", "Acts of Peter", "Acts of John", "Acts of Thomas",
  "Book of Adam and Eve", "Testament of the Twelve Patriarchs", "Psalms of Solomon", "Odes of Solomon", "3 Maccabees", "4 Maccabees", "Prayer of Manasseh", "Letter of Aristeas", "Life of Adam and Eve", "Ascension of Isaiah",
  "Apocalypse of Abraham", "Apocalypse of Zephaniah", "4 Ezra", "2 Baruch", "3 Baruch", "Sibylline Oracles", "Book of the Bee", "Cave of Treasures", "Conflict of Adam and Eve with Satan"
];

export const ALL_BOOKS = [...BOOKS, ...EXTRA_BOOKS];

export const BOOK_CHAPTER_COUNTS: Record<string, number> = {
  "Genesis": 50, "Exodus": 40, "Leviticus": 27, "Numbers": 36, "Deuteronomy": 34, "Joshua": 24, "Judges": 21, "Ruth": 4,
  "1 Samuel": 31, "2 Samuel": 24, "1 Kings": 22, "2 Kings": 25, "1 Chronicles": 29, "2 Chronicles": 36, "Ezra": 10,
  "Nehemiah": 13, "Esther": 10, "Job": 42, "Psalms": 150, "Proverbs": 31, "Ecclesiastes": 12, "Song of Solomon": 8,
  "Isaiah": 66, "Jeremiah": 52, "Lamentations": 5, "Ezekiel": 48, "Daniel": 12, "Hosea": 14, "Joel": 3, "Amos": 9,
  "Obadiah": 1, "Jonah": 4, "Micah": 7, "Nahum": 3, "Habakkuk": 3, "Zephaniah": 3, "Haggai": 2, "Zechariah": 14, "Malachi": 4,
  "Matthew": 28, "Mark": 16, "Luke": 24, "John": 21, "Acts": 28, "Romans": 16, "1 Corinthians": 16, "2 Corinthians": 13,
  "Galatians": 6, "Ephesians": 6, "Philippians": 4, "Colossians": 4, "1 Thessalonians": 5, "2 Thessalonians": 3,
  "1 Timothy": 6, "2 Timothy": 4, "Titus": 3, "Philemon": 1, "Hebrews": 13, "James": 5, "1 Peter": 5, "2 Peter": 3,
  "1 John": 5, "2 John": 1, "3 John": 1, "Jude": 1, "Revelation": 22,
  // Approximate for extra books
  "Enoch": 108, "Jasher": 91, "Jubilees": 50, "Gospel of Thomas": 1, "Gospel of Mary": 1, "Didache": 1, "Letter of Barnabas": 1,
  "1 Clement": 1, "2 Clement": 1, "Shepherd of Hermas": 1, "Gospel of Philip": 1, "Gospel of Judas": 1, "Apocryphon of John": 1,
  "Sophia of Jesus Christ": 1, "Acts of Paul and Thecla": 1, "Infancy Gospel of Thomas": 1, "Protevangelium of James": 1,
  "Acts of Peter": 1, "Acts of John": 1, "Acts of Thomas": 1, "Book of Adam and Eve": 1, "Testament of the Twelve Patriarchs": 1,
  "Psalms of Solomon": 1, "Odes of Solomon": 1, "3 Maccabees": 1, "4 Maccabees": 1, "Prayer of Manasseh": 1, "Letter of Aristeas": 1,
  "Life of Adam and Eve": 1, "Ascension of Isaiah": 1, "Apocalypse of Abraham": 1, "Apocalypse of Zephaniah": 1, "4 Ezra": 1,
  "2 Baruch": 1, "3 Baruch": 1, "Sibylline Oracles": 1, "Book of the Bee": 1, "Cave of Treasures": 1, "Conflict of Adam and Eve with Satan": 1
};

// Mapping requested translations to bible-api.com supported ones
const TRANSLATION_MAP: Record<string, string> = {
  'KJV': 'kjv',
  'NKJV': 'kjv', // Fallback
  'NIV': 'web',  // Fallback to World English Bible
  'ESV': 'web',  // Fallback
  'Amplified': 'web', // Fallback
  'NLT': 'web', // Fallback
  'The Message': 'web' // Fallback
};

export const fetchRandomVerse = async () => {
  const randomVerses = [
    "Matthew 18:20",
    "Philippians 4:6",
    "1 Thessalonians 5:17",
    "James 5:16",
    "Romans 8:26",
    "Ephesians 6:18",
    "Colossians 4:2",
    "Hebrews 4:16",
    "1 John 5:14",
    "Psalm 145:18",
    "Isaiah 40:31",
    "Matthew 6:6",
    "Psalm 5:3",
    "Psalm 34:17",
    "Psalm 55:22",
    "Psalm 62:8",
    "Psalm 107:28",
    "Proverbs 15:29",
    "Jeremiah 29:12",
    "Matthew 7:7",
    "Matthew 21:22",
    "Mark 11:24",
    "Luke 11:9",
    "Luke 18:1",
    "John 14:13",
    "John 15:7",
    "Acts 1:14",
    "Acts 12:5",
    "Romans 12:12",
    "2 Corinthians 1:11",
    "Ephesians 3:20",
    "Philippians 4:7",
    "Colossians 4:3",
    "1 Timothy 2:1",
    "James 4:8",
    "James 5:13",
    "1 Peter 4:7",
    "1 Peter 5:7",
    "1 John 3:22",
    "Jude 1:20"
  ];
  const randomRef = randomVerses[Math.floor(Math.random() * randomVerses.length)];
  return fetchBibleVerse(randomRef);
};

export const fetchBibleVerse = async (reference: string, translation: string = 'KJV') => {
  try {
    const apiTranslation = TRANSLATION_MAP[translation] || 'kjv';
    const response = await fetch(`https://bible-api.com/${encodeURIComponent(reference)}?translation=${apiTranslation}`);
    if (!response.ok) throw new Error('Verse not found');
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching Bible verse:', error);
    return null;
  }
};

export const fetchSefariaText = async (book: string, chapter: number) => {
  try {
    // Sefaria API uses standard book names, e.g., "Genesis 1"
    const response = await fetch(`https://www.sefaria.org/api/texts/${encodeURIComponent(book)}.${chapter}?context=0`);
    if (!response.ok) throw new Error('Sefaria text not found');
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching Sefaria text:', error);
    return null;
  }
};

export const fetchChapter = async (book: string, chapter: number, translation: string = 'KJV') => {
  const chapterId = `${translation}_${book}_${chapter}`;
  
  // 1. Check local DB first
  const cached = await db_local.bible_chapters.get(chapterId);
  if (cached) return cached.content;

  // 2. Fetch from API or AI
  let data: any = null;

  if (EXTRA_BOOKS.includes(book)) {
    try {
      data = await getExtraBookChapter(book, chapter, translation);
    } catch (error) {
      console.error('Error fetching extra book chapter:', error);
    }
  } else {
    try {
      const apiTranslation = TRANSLATION_MAP[translation] || 'kjv';
      const response = await fetch(`https://bible-api.com/${encodeURIComponent(book)}+${chapter}?translation=${apiTranslation}`);
      if (response.ok) {
        data = await response.json();
      } else {
        console.warn("Bible API failed, falling back to Gemini...");
        data = await getExtraBookChapter(book, chapter, translation);
      }
    } catch (error) {
      console.error('Error fetching chapter:', error);
      // Fallback to Gemini if API fails
      data = await getExtraBookChapter(book, chapter, translation);
    }
  }

  // 3. Cache the result
  if (data) {
    await db_local.bible_chapters.put({
      id: chapterId,
      translation,
      book,
      chapter,
      content: data,
      updatedAt: new Date().toISOString()
    });
  }

  return data;
};

