import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// This script downloads Bible chapters and saves them as JSON files.
// To run this on your computer:
// 1. Install Node.js (https://nodejs.org)
// 2. Open your terminal/command prompt in this project folder
// 3. Run: npm run download-db

const BOOKS = [
  "Genesis", "Exodus", "Leviticus", "Numbers", "Deuteronomy", "Matthew", "Mark", "Luke", "John", "Revelation"
  // Add the rest of the books here...
];

const CHAPTER_COUNTS = {
  "Genesis": 50, "Exodus": 40, "Matthew": 28, "Mark": 16, "Luke": 24, "John": 21, "Revelation": 22
  // Add the rest of the chapter counts here...
};

const TRANSLATION = 'kjv';
const OUTPUT_DIR = path.join(__dirname, '../public/database');

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function downloadChapter(book, chapter) {
  const url = `https://bible-api.com/${encodeURIComponent(book)}+${chapter}?translation=${TRANSLATION}`;
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Status ${response.status}`);
    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`Failed to download ${book} ${chapter}:`, error.message);
    return null;
  }
}

async function main() {
  console.log('Starting Database Download...');
  
  // Create output directories
  const biblesDir = path.join(OUTPUT_DIR, 'bibles', TRANSLATION);
  if (!fs.existsSync(biblesDir)) {
    fs.mkdirSync(biblesDir, { recursive: true });
  }

  for (const book of BOOKS) {
    const bookDirName = book.toLowerCase().replace(/\s+/g, '_');
    const bookDir = path.join(biblesDir, bookDirName);
    
    if (!fs.existsSync(bookDir)) {
      fs.mkdirSync(bookDir, { recursive: true });
    }

    const chapters = CHAPTER_COUNTS[book] || 1;
    
    for (let chapter = 1; chapter <= chapters; chapter++) {
      const filePath = path.join(bookDir, `${chapter}.json`);
      
      if (fs.existsSync(filePath)) {
        console.log(`Skipping ${book} ${chapter} (Already exists)`);
        continue;
      }

      console.log(`Downloading ${book} ${chapter}...`);
      const data = await downloadChapter(book, chapter);
      
      if (data) {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
      }
      
      // Be nice to the API - wait 1 second between requests
      await delay(1000);
    }
  }
  
  console.log('Download Complete! Your JSON database is ready.');
}

main();
