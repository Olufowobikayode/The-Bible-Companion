require("dotenv").config();
const axios = require("axios");
const cheerio = require("cheerio");
const { MongoClient } = require("mongodb");
const pLimit = require("p-limit");
const fs = require("fs");
const { execSync } = require("child_process");

if (!process.env.MONGODB_URI) {
  throw new Error("MONGODB_URI missing in .env");
}

const client = new MongoClient(process.env.MONGODB_URI);

// Split limiters to prevent cross-source API throttling & 429 errors
const limitSefaria = pLimit(2);
const limitBibleAPI = pLimit(2);
const limitScrape = pLimit(1);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Adaptive rate limiter state
let apiErrorCount = 0;

async function adaptiveSleep(baseMs = 500) {
  if (apiErrorCount > 5) {
    console.log("⚠️ High API error rate detected. Throttling heavily...");
    await sleep(3000);
  } else {
    await sleep(baseMs);
  }
}

// Observability metrics
const metrics = {
  run_id: `run_${Date.now()}`,
  total_books: 0,
  completed: 0,
  failed: 0,
  skipped: 0,
  start_time: Date.now()
};

/** 
 * ==========================================
 * DATA ARRAYS
 * ==========================================
 */
const OT_BOOKS =["Genesis", "Exodus", "Leviticus", "Numbers", "Deuteronomy", "Joshua", "Judges", "I_Samuel", "II_Samuel", "I_Kings", "II_Kings", "Isaiah", "Jeremiah", "Ezekiel", "Hosea", "Joel", "Amos", "Obadiah", "Jonah", "Micah", "Nahum", "Habakkuk", "Zephaniah", "Haggai", "Zechariah", "Malachi", "Psalms", "Proverbs", "Job", "Song_of_Songs", "Ruth", "Lamentations", "Ecclesiastes", "Esther", "Daniel", "Ezra", "Nehemiah", "I_Chronicles", "II_Chronicles"];

const NON_CANONICAL =["Enoch_1", "Jubilees", "Jasher", "Tobit", "Judith", "Wisdom_of_Solomon", "Sirach", "Baruch", "I_Maccabees", "II_Maccabees", "III_Maccabees", "IV_Maccabees", "Letter_of_Jeremiah", "Prayer_of_Azariah", "Susanna", "Bel_and_the_Dragon", "I_Esdras", "II_Esdras", "Prayer_of_Manasseh", "Psalms_of_Solomon", "Odes_of_Solomon", "Letter_of_Aristeas", "Sibylline_Oracles", "Testament_of_Reuben", "Testament_of_Simeon", "Testament_of_Levi", "Testament_of_Judah", "Testament_of_Issachar", "Testament_of_Zebulun", "Testament_of_Dan", "Testament_of_Naphtali", "Testament_of_Gad", "Testament_of_Asher", "Testament_of_Joseph", "Testament_of_Benjamin"];

const NT_BOOKS =[
  { title: "Matthew", chapters: 28, apiName: "Matthew" }, { title: "Mark", chapters: 16, apiName: "Mark" },
  { title: "Luke", chapters: 24, apiName: "Luke" }, { title: "John", chapters: 21, apiName: "John" },
  { title: "Acts", chapters: 28, apiName: "Acts" }, { title: "Romans", chapters: 16, apiName: "Romans" },
  { title: "I_Corinthians", chapters: 16, apiName: "1 Corinthians" }, { title: "II_Corinthians", chapters: 13, apiName: "2 Corinthians" },
  { title: "Galatians", chapters: 6, apiName: "Galatians" }, { title: "Ephesians", chapters: 6, apiName: "Ephesians" },
  { title: "Philippians", chapters: 4, apiName: "Philippians" }, { title: "Colossians", chapters: 4, apiName: "Colossians" },
  { title: "I_Thessalonians", chapters: 5, apiName: "1 Thessalonians" }, { title: "II_Thessalonians", chapters: 3, apiName: "2 Thessalonians" },
  { title: "I_Timothy", chapters: 6, apiName: "1 Timothy" }, { title: "II_Timothy", chapters: 4, apiName: "2 Timothy" },
  { title: "Titus", chapters: 3, apiName: "Titus" }, { title: "Philemon", chapters: 1, apiName: "Philemon" },
  { title: "Hebrews", chapters: 13, apiName: "Hebrews" }, { title: "James", chapters: 5, apiName: "James" },
  { title: "I_Peter", chapters: 5, apiName: "1 Peter" }, { title: "II_Peter", chapters: 3, apiName: "2 Peter" },
  { title: "I_John", chapters: 5, apiName: "1 John" }, { title: "II_John", chapters: 1, apiName: "2 John" },
  { title: "III_John", chapters: 1, apiName: "3 John" }, { title: "Jude", chapters: 1, apiName: "Jude" },
  { title: "Revelation", chapters: 22, apiName: "Revelation" }
];

const GNOSTIC_MAP = {
  "Gospel of Mary Magdala": "https://www.gnosis.org/library/marygosp.htm",
  "Gospel of Thomas": "https://www.gnosis.org/naghamm/gosthom.html",
  "Gospel of Philip": "https://www.gnosis.org/naghamm/gophip.html",
  "Gospel of Judas": "https://www.gnosis.org/naghamm/gostjud.html",
  "Gospel of Truth": "https://www.gnosis.org/naghamm/got.html",
  "Apocryphon of John": "https://www.gnosis.org/naghamm/apocjn.html",
  "Pistis Sophia": "https://www.gnosis.org/library/pistis-sophia.html",
  "Sophia of Jesus Christ": "https://www.gnosis.org/naghamm/sjc.html",
  "Dialogue of the Savior": "https://www.gnosis.org/naghamm/dial.html",
  "Trimorphic Protennoia": "https://www.gnosis.org/naghamm/trimorp.html",
  "Thunder: Perfect Mind": "https://www.gnosis.org/naghamm/thunder.html",
  "Apocalypse of Peter (Gnostic)": "https://www.gnosis.org/naghamm/apopet.html",
  "Apocalypse of Paul (Gnostic)": "https://www.gnosis.org/naghamm/apopau.html",
  "Zostrianos": "https://www.gnosis.org/naghamm/zost.html",
  "Allogenes": "https://www.gnosis.org/naghamm/allogenes.html",
  "Didache": "https://www.earlychristianwritings.com/text/didache-roberts.html",
  "Shepherd of Hermas": "https://www.earlychristianwritings.com/text/shepherd.html",
  "Letter of Barnabas": "https://www.earlychristianwritings.com/text/barnabas-lightfoot.html",
  "1 Clement": "https://www.earlychristianwritings.com/text/1clement-lightfoot.html",
  "2 Clement": "https://www.earlychristianwritings.com/text/2clement-lightfoot.html",
  "Letter of Ignatius to the Ephesians": "https://www.earlychristianwritings.com/text/ignatius-ephesians-lightfoot.html",
  "Letter of Ignatius to the Magnesians": "https://www.earlychristianwritings.com/text/ignatius-magnesians-lightfoot.html",
  "Letter of Ignatius to the Trallians": "https://www.earlychristianwritings.com/text/ignatius-trallians-lightfoot.html",
  "Letter of Ignatius to the Romans": "https://www.earlychristianwritings.com/text/ignatius-romans-lightfoot.html",
  "Letter of Ignatius to the Philadelphians": "https://www.earlychristianwritings.com/text/ignatius-philadelphians-lightfoot.html",
  "Letter of Ignatius to the Smyrnaeans": "https://www.earlychristianwritings.com/text/ignatius-smyrnaeans-lightfoot.html",
  "Letter of Ignatius to Polycarp": "https://www.earlychristianwritings.com/text/ignatius-polycarp-lightfoot.html",
  "Polycarp to the Philippians": "https://www.earlychristianwritings.com/text/polycarp-lightfoot.html",
  "Martyrdom of Polycarp": "https://www.earlychristianwritings.com/text/polycarp-martyrdom-lightfoot.html",
  "Epistle to Diognetus": "https://www.earlychristianwritings.com/text/diognetus-lightfoot.html",
  "Protoevangelium of James": "https://www.gnosis.org/library/gosjames.htm",
  "Infancy Gospel of Thomas": "https://www.earlychristianwritings.com/text/infancythomas.html",
  "Acts of Peter": "https://www.earlychristianwritings.com/text/actspeter.html",
  "Acts of Paul": "https://www.earlychristianwritings.com/text/actspaul.html",
  "Acts of John": "https://www.gnosis.org/library/actjohn.htm",
  "Acts of Thomas": "https://www.earlychristianwritings.com/text/actsthomas.html",
  "Acts of Andrew": "https://www.earlychristianwritings.com/text/actsandrew.html",
  "Acts of Philip": "https://www.earlychristianwritings.com/text/actsphil.html"
};

/**
 * ==========================================
 * HELPERS & PIPELINE UTILS
 * ==========================================
 */
async function fetchWithRetry(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await axios.get(url, { 
        timeout: 25000,
        headers: { 
          "Accept-Encoding": "gzip, deflate, br",
          "User-Agent": "VisionPlatformDataEngine/7.0"
        }
      });
      if (apiErrorCount > 0) apiErrorCount--; 
      return res;
    } catch (err) {
      apiErrorCount++;
      if (i === retries - 1) throw err;
      await adaptiveSleep(1500 * (i + 1));
    }
  }
}

async function safeFetch(url, retries = 3) {
  try {
    return await fetchWithRetry(url, retries);
  } catch (err) {
    return null; 
  }
}

function cleanText(text) {
  if (!text) return "";
  return text.replace(/[ \t]+/g, " ").replace(/\n\s*\n/g, "\n\n").trim();
}

function normalizeId(title) {
  return title.replace(/\s+/g, "_");
}

async function isProcessed(db, title) {
  const state = await db.collection("pipeline_state").findOne({ title });
  return state?.status === "completed";
}

async function markProcessed(db, title, metadata = {}) {
  await db.collection("pipeline_state").updateOne(
    { title },
    { $set: { title, status: "completed", timestamp: new Date(), ...metadata } },
    { upsert: true }
  );
}

// Checkpoint persistence & Retry Queue mechanism
async function markFailed(db, title, errorMsg, context = {}) {
  const existing = await db.collection("pipeline_state").findOne({ title });
  const retryCount = (existing?.retry_count || 0) + 1;
  
  await db.collection("pipeline_state").updateOne(
    { title },
    {
      $set: {
        title,
        status: "failed",
        error: errorMsg,
        retry_count: retryCount,
        last_attempt: new Date()
      }
    },
    { upsert: true }
  );

  // Add to failed jobs collection for tracking/reprocessing later
  await db.collection("failed_jobs").updateOne(
    { title },
    {
      $set: {
        title,
        error: errorMsg,
        context,
        retry_count: retryCount,
        timestamp: new Date()
      }
    },
    { upsert: true }
  );
}

/** Validation Layer: Verifies structural integrity before DB writes */
function validateChapterVerses(book, chapter, verses) {
  if (!verses || verses.length === 0) {
    throw new Error(`Validation Error: No verses found for ${book} Ch ${chapter}`);
  }
  
  const ids = new Set();
  let maxVerse = 0;
  
  for (const v of verses) {
    if (!v.translations || v.translations.length === 0) {
      throw new Error(`Validation Error: Empty translations array in ${v.id}`);
    }
    if (v.translations.some(t => !t.text || t.text.trim() === "")) {
      throw new Error(`Validation Error: Empty text content in translation for ${v.id}`);
    }
    if (ids.has(v.id)) {
      throw new Error(`Validation Error: Duplicate verse ID detected: ${v.id}`);
    }
    ids.add(v.id);
    if (v.verse > maxVerse) maxVerse = v.verse;
  }
  
  if (verses.length < maxVerse) {
    console.warn(`⚠️ Warning: Missing verse numbers detected in ${book} Ch ${chapter} (found ${verses.length}, expected up to ${maxVerse})`);
  }
}

function extractGnosisContent(html) {
  const $ = cheerio.load(html);
  $("script, style, nav, footer, header").remove();
  let text = "";
  $("p, h1, h2, h3, blockquote").each((_, el) => {
    const chunk = $(el).text().replace(/\s+/g, " ").trim();
    if (chunk) text += chunk + "\n\n";
  });
  return cleanText(text);
}

function formatSefariaVerses(bookTitle, enArray, heArray) {
  const chapters =[];
  if (!Array.isArray(enArray)) return chapters;

  const is1D = enArray.length > 0 && typeof enArray[0] === "string";
  const bookId = normalizeId(bookTitle);

  if (is1D) {
    let verses =[];
    for (let v = 0; v < Math.max(enArray.length, (heArray ||[]).length); v++) {
      verses.push({
        id: `${bookId}.1.${v + 1}`,
        verse: v + 1,
        translations:[
          { lang: "en", version: "Sefaria Default English", text: cleanText(enArray[v] || "") },
          { lang: "he", version: "Sefaria Default Hebrew", text: cleanText((heArray && heArray[v]) ? heArray[v] : "") }
        ].filter(t => t.text !== "")
      });
    }
    chapters.push({ chapter: 1, verses });
  } else {
    for (let c = 0; c < Math.max(enArray.length, (heArray || []).length); c++) {
      let verses =[];
      let enCh = enArray[c] || [];
      let heCh = (heArray && heArray[c]) ? heArray[c] :[];
      
      for (let v = 0; v < Math.max(enCh.length, heCh.length); v++) {
        verses.push({
          id: `${bookId}.${c + 1}.${v + 1}`,
          verse: v + 1,
          translations:[
            { lang: "en", version: "Sefaria Default English", text: cleanText(enCh[v] || "") },
            { lang: "he", version: "Sefaria Default Hebrew", text: cleanText(heCh[v] || "") }
          ].filter(t => t.text !== "")
        });
      }
      chapters.push({ chapter: c + 1, verses });
    }
  }
  return chapters;
}

/**
 * ==========================================
 * DATASET INGESTION PIPELINES
 * ==========================================
 */

function handleLocalSefariaDump() {
  if (fs.existsSync("./dump")) {
    console.log("📦 Found local Sefaria dump! Restoring into database...");
    try {
      execSync(`mongorestore --uri="${process.env.MONGODB_URI}" dump/ --drop`, { stdio: 'inherit' });
      console.log("✅ Dump restored successfully.");
    } catch (err) {
      console.log("⚠️ mongorestore warning or already imported. Continuing pipeline...");
    }
  } else {
    console.log("ℹ️ No local './dump' folder found. Ensure you downloaded it from: https://storage.googleapis.com/sefaria-mongo-backup/dump.tar.gz");
  }
}

async function ingestSefaria(db, books, label) {
  console.log(`📖 Ingesting ${label} (Unified Multi-Language Dataset)...`);
  
  const sefariaTexts = db.collection("texts");
  const hasDump = await sefariaTexts.countDocuments() > 0;

  // FIX 5: Force Sefaria Dump usage explicitly to prevent massive rate limits and structural corruption.
  if (!hasDump) {
    console.warn(`CRITICAL: Sefaria dataset dump required for ${label}. Download from: https://storage.googleapis.com/sefaria-mongo-backup/dump.tar.gz and extract 'dump/' to bypass API limits and ensure completeness.`);
    return;
  }

  const tasks = books.map(book => limitSefaria(async () => {
    try {
      if (await isProcessed(db, book)) {
        console.log(`⏭️  Skipped ${book} (already in DB)`);
        metrics.skipped++;
        return;
      }

      const formattedBook = book.replace(/_/g, " ");
      const enDoc = await sefariaTexts.findOne({ title: formattedBook, language: "en" });
      const heDoc = await sefariaTexts.findOne({ title: formattedBook, language: "he" });

      const enArray = enDoc?.chapter ||[];
      const heArray = heDoc?.chapter ||[];

      const chapters = formatSefariaVerses(book, enArray, heArray);

      if (chapters.length === 0 || chapters[0].verses.length === 0) {
        throw new Error("Parsed dataset empty or missing from Sefaria dump.");
      }

      // FIX 3: Stream verse writes via chunked bulkWrite across chapters
      let ops =[];
      for (const ch of chapters) {
        // Validation Layer execution
        validateChapterVerses(book, ch.chapter, ch.verses);

        for (const v of ch.verses) {
          ops.push({
            updateOne: {
              filter: { _id: v.id },
              update: { $set: {
                book: book,
                chapter: ch.chapter,
                verse: v.verse,
                translations: v.translations
              }},
              upsert: true
            }
          });
        }

        // Batch execution per ~2000 ops to maintain low memory profile
        if (ops.length >= 2000) {
          await db.collection("sacred_verses").bulkWrite(ops, { ordered: false });
          ops =[];
        }
      }

      // Write remaining ops
      if (ops.length > 0) {
        await db.collection("sacred_verses").bulkWrite(ops, { ordered: false });
      }

      // Save book metadata
      await db.collection("sacred_books").updateOne(
        { title: book },
        { $set: {
          title: book,
          category: label,
          source_type: "dataset_dump",
          original_language: "Hebrew",
          meta: { total_chapters: chapters.length, ingested_at: new Date() },
          updatedAt: new Date()
        }},
        { upsert: true }
      );

      await markProcessed(db, book, { chapters: chapters.length, source: "dataset_dump" });
      
      console.log(`✅ ${book}[dataset_dump]`);
      metrics.completed++;

    } catch (err) {
      console.log(`❌ ${book}: ${err.message}`);
      await markFailed(db, book, err.message, { type: "sefaria_dump", label });
      metrics.failed++;
    }
  }));
  await Promise.all(tasks);
}

async function ingestNT(db, books = NT_BOOKS) {
  console.log("📘 Ingesting New Testament (Verse-Level Parallel Alignment)...");
  const tasks = books.map(book => limitBibleAPI(async () => {
    try {
      if (await isProcessed(db, book.title)) {
        console.log(`⏭️  Skipped ${book.title} (already complete in DB)`);
        metrics.skipped++;
        return;
      }

      let successfulChapters = 0;
      const bookId = normalizeId(book.title);

      for (let ch = 1; ch <= book.chapters; ch++) {
        // FIX 2: Checkpoint checking per chapter
        const chState = await db.collection("chapter_state").findOne({ book: book.title, chapter: ch });
        if (chState?.status === "completed") {
          successfulChapters++;
          continue;
        }

        const reference = encodeURIComponent(`${book.apiName} ${ch}`);
        
        const [en, gr] = await Promise.all([
          safeFetch(`https://bible-api.com/${reference}`),
          safeFetch(`https://bible-api.com/${reference}?translation=el_greek`)
        ]);

        if (!en?.data?.verses) {
          console.log(`⚠️  ${book.title} Ch ${ch} failed, will retry on next run.`);
          await markFailed(db, book.title, `API failed for Ch ${ch}`, { type: "NT_api", chapter: ch });
          continue;
        }

        let versesMap = {};
        en.data.verses.forEach(v => {
          versesMap[v.verse] = { 
            id: `${bookId}.${ch}.${v.verse}`,
            verse: v.verse, 
            translations:[
              { lang: "en", version: "WEB (Bible-API)", text: cleanText(v.text) }
            ] 
          };
        });

        if (gr?.data?.verses) {
          gr.data.verses.forEach(v => {
            if (!versesMap[v.verse]) {
              versesMap[v.verse] = { id: `${bookId}.${ch}.${v.verse}`, verse: v.verse, translations:[] };
            }
            if (v.text && cleanText(v.text) !== "") {
              versesMap[v.verse].translations.push({
                lang: "gr", version: "Greek (Textus Receptus/LXX)", text: cleanText(v.text)
              });
            }
          });
        }

        const sortedVerses = Object.values(versesMap).sort((a, b) => a.verse - b.verse);

        // Validation Layer Execution
        validateChapterVerses(book.title, ch, sortedVerses);

        // FIX 3: Stream writes for the chapter immediately
        const ops = sortedVerses.map(v => ({
          updateOne: {
            filter: { _id: v.id },
            update: { $set: {
              book: book.title,
              chapter: ch,
              verse: v.verse,
              translations: v.translations
            }},
            upsert: true
          }
        }));

        if (ops.length > 0) {
          await db.collection("sacred_verses").bulkWrite(ops, { ordered: false });
        }

        // Checkpoint success
        await db.collection("chapter_state").updateOne(
          { book: book.title, chapter: ch },
          { $set: { status: "completed", timestamp: new Date() } },
          { upsert: true }
        );

        successfulChapters++;
        await adaptiveSleep(400); // FIX 4: Adaptive rate limiter
      }

      // FIX 1: Strict dataset completeness validation
      if (successfulChapters < book.chapters) {
        throw new Error(`Incomplete Dataset: Fetched ${successfulChapters}/${book.chapters} chapters.`);
      }

      await db.collection("sacred_books").updateOne(
        { title: book.title },
        { $set: {
          title: book.title,
          category: "New Testament",
          source_type: "api",
          original_language: "Greek",
          meta: { total_chapters: book.chapters, ingested_at: new Date() },
          updatedAt: new Date()
        }},
        { upsert: true }
      );

      await markProcessed(db, book.title, { chapters: successfulChapters });
      console.log(`✅ ${book.title} (${successfulChapters}/${book.chapters} chs)`);
      metrics.completed++;

    } catch (err) {
      console.log(`❌ ${book.title}: ${err.message}`);
      await markFailed(db, book.title, err.message, { type: "NT_api" });
      metrics.failed++;
    }
  }));
  await Promise.all(tasks);
}

async function ingestExtra(db, titles = Object.keys(GNOSTIC_MAP)) {
  console.log("🧾 Ingesting Non-Canonical / Early Church (Scrape -> Parallel Mapping)...");
  const tasks = titles.map(title => limitScrape(async () => {
    try {
      if (await isProcessed(db, title)) {
        console.log(`⏭️  Skipped ${title} (already in DB)`);
        metrics.skipped++;
        return;
      }

      const url = GNOSTIC_MAP[title];
      const res = await fetchWithRetry(url);
      const content = extractGnosisContent(res.data);
      
      if (content.length < 500) throw new Error("Parsed content empty or invalid layout.");

      const bookId = normalizeId(title);
      const paragraphs = content.split(/\n\n+/);
      const verses = paragraphs.map((p, i) => ({
        id: `${bookId}.1.${i + 1}`,
        verse: i + 1,
        translations:[
          { lang: "en", version: "Public Domain / Early Christian Writings", text: cleanText(p) }
        ]
      }));

      // Validation Layer Execution
      validateChapterVerses(title, 1, verses);

      // Stream verses write
      const ops = verses.map(v => ({
        updateOne: {
          filter: { _id: v.id },
          update: { $set: {
            book: title,
            chapter: 1,
            verse: v.verse,
            translations: v.translations
          }},
          upsert: true
        }
      }));

      if (ops.length > 0) {
        await db.collection("sacred_verses").bulkWrite(ops, { ordered: false });
      }

      await db.collection("sacred_books").updateOne(
        { title: title },
        { $set: {
          title: title,
          category: "Non-Canonical / Gnostic",
          source_type: "scrape",
          original_language: "Mixed/Greek/Coptic",
          meta: { total_chapters: 1, total_verses: verses.length, ingested_at: new Date() },
          updatedAt: new Date()
        }},
        { upsert: true }
      );

      await markProcessed(db, title, { verses: verses.length });
      console.log(`✅ ${title}`);
      metrics.completed++;
      await adaptiveSleep(1000);

    } catch (err) {
      console.log(`❌ ${title}: ${err.message}`);
      await markFailed(db, title, err.message, { type: "scrape_gnostic" });
      metrics.failed++;
    }
  }));
  await Promise.all(tasks);
}

async function syncConcordance(db) {
  console.log("📊 Syncing Concordance...");
  try {
    if (await isProcessed(db, "CONCORDANCE_SYNC")) {
      console.log("⏭️  Concordance already synced.");
      return;
    }

    const [greek, hebrew] = await Promise.all([
      fetchWithRetry("https://cdn.jsdelivr.net/gh/joshuablackburn216/strongs-dictionary-json@master/strongs-greek-dictionary.json"),
      fetchWithRetry("https://cdn.jsdelivr.net/gh/joshuablackburn216/strongs-dictionary-json@master/strongs-hebrew-dictionary.json")
    ]);
    
    const data =[
      ...Object.entries(greek.data).map(([k, v]) => ({ _id: `G${k}`, ...v })),
      ...Object.entries(hebrew.data).map(([k, v]) => ({ _id: `H${k}`, ...v }))
    ];
    
    await db.collection("concordance").deleteMany({});
    
    const chunkSize = 1500;
    for (let i = 0; i < data.length; i += chunkSize) {
      await db.collection("concordance").insertMany(data.slice(i, i + chunkSize));
    }
    
    await markProcessed(db, "CONCORDANCE_SYNC", { entries: data.length });
    console.log(`✅ Concordance ready (${data.length} entries)`);
  } catch (err) {
    console.log(`❌ Concordance failed: ${err.message}`);
  }
}

async function reprocessFailedJobs(db) {
  console.log("\n🔄 Checking for failed jobs to reprocess...");
  
  const jobs = await db.collection("failed_jobs")
    .find({ retry_count: { $lt: 5 } })
    .limit(50)
    .toArray();

  if (jobs.length === 0) {
    console.log("✅ No failed jobs pending retry.");
    return;
  }

  for (const job of jobs) {
    console.log(`🔁 Retrying ${job.title} (Attempt ${job.retry_count + 1})...`);
    
    // Re-run based on type
    if (job.context?.type === "NT_api") {
      const book = NT_BOOKS.find(b => b.title === job.title);
      if (book) await ingestNT(db, [book]);
    } else if (job.context?.type === "sefaria_dump") {
      await ingestSefaria(db,[job.title], job.context.label || "Reprocessed Sefaria");
    } else if (job.context?.type === "scrape_gnostic") {
      await ingestExtra(db, [job.title]);
    }

    // Verify success and clear job
    const isNowCompleted = await isProcessed(db, job.title);
    if (isNowCompleted) {
      await db.collection("failed_jobs").deleteOne({ _id: job._id });
      console.log(`✅ Successfully recovered ${job.title}`);
    } else {
      console.log(`⚠️ ${job.title} still incomplete after retry.`);
    }
  }
}

/**
 * ==========================================
 * MAIN EXECUTION
 * ==========================================
 */
async function run() {
  try {
    await client.connect();
    const db = client.db("vision");
    console.log("🚀 MISSION START: ENTERPRISE DATASET PLATFORM");

    metrics.total_books = OT_BOOKS.length + NON_CANONICAL.length + NT_BOOKS.length + Object.keys(GNOSTIC_MAP).length;

    // Infrastructure setup & Indexing
    await db.collection("sacred_books").createIndex({ title: 1 }, { unique: true });
    await db.collection("sacred_verses").createIndex({ book: 1, chapter: 1, verse: 1 });
    await db.collection("pipeline_state").createIndex({ title: 1 }, { unique: true });
    await db.collection("chapter_state").createIndex({ book: 1, chapter: 1 }, { unique: true });
    await db.collection("failed_jobs").createIndex({ title: 1 }, { unique: true });
    await db.collection("metrics_log").createIndex({ run_id: 1 }, { unique: true });

    handleLocalSefariaDump();

    await ingestSefaria(db, OT_BOOKS, "Old Testament");
    await ingestSefaria(db, NON_CANONICAL, "Non-Canonical");
    await ingestNT(db);
    await ingestExtra(db);
    await syncConcordance(db);

    // Final Stage: Attempt recovery of any flagged failures
    await reprocessFailedJobs(db);

    const durationSeconds = ((Date.now() - metrics.start_time) / 1000).toFixed(1);
    
    // Progress persistence logic
    await db.collection("metrics_log").insertOne({
      ...metrics,
      duration_seconds: parseFloat(durationSeconds),
      timestamp: new Date()
    });
    
    console.log("\n==========================================");
    console.log("🏁 MISSION COMPLETE. PIPELINE OBSERVABILITY");
    console.log("==========================================");
    console.log(`⏱️  Duration: ${durationSeconds}s`);
    console.log(`📚 Total Target: ${metrics.total_books}`);
    console.log(`✅ Completed:  ${metrics.completed}`);
    console.log(`⏭️  Skipped:   ${metrics.skipped}`);
    console.log(`❌ Failed:     ${metrics.failed}`);
    console.log("==========================================");

  } catch (err) {
    console.error("FATAL ERROR:", err);
  } finally {
    await client.close();
  }
}

run();
