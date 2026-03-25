import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI } from "@google/genai";
import { MongoClient } from "mongodb";
import { createClient } from "@supabase/supabase-js";
import Groq from "groq-sdk";
import dotenv from "dotenv";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Initialize Clients
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "dummy" });
  
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY || "dummy" });
  
  const supabaseAdmin = createClient(
    process.env.VITE_SUPABASE_URL || "https://dummy.supabase.co",
    process.env.SUPABASE_SERVICE_ROLE_KEY || "dummy"
  );

  let db: any = null;
  if (process.env.MONGODB_URI) {
    try {
      const mongoClient = new MongoClient(process.env.MONGODB_URI);
      await mongoClient.connect();
      db = mongoClient.db("vision");
      console.log("Connected to MongoDB");
    } catch (e) {
      console.error("MongoDB connection failed:", e);
    }
  }

  // Auth Middleware
  const authenticate = async (req: any, res: any, next: any) => {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ error: "Unauthorized" });

    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !user) return res.status(401).json({ error: "Unauthorized" });

    req.user = user;
    next();
  };

  // User Profiles
  app.get("/api/profile/:uid", async (req, res) => {
    if (!db) return res.status(500).json({ error: "DB not connected" });
    const profile = await db.collection("user_profiles").findOne({ uid: req.params.uid });
    res.json(profile || {});
  });

  app.get("/api/users/search", async (req, res) => {
    if (!db) return res.status(500).json({ error: "DB not connected" });
    const { q } = req.query;
    if (!q) return res.json([]);
    const users = await db.collection("user_profiles").find({
      username: { $regex: q, $options: "i" }
    }).limit(10).toArray();
    res.json(users);
  });

  app.get("/api/users/by-username/:username", async (req, res) => {
    if (!db) return res.status(500).json({ error: "DB not connected" });
    const profile = await db.collection("user_profiles").findOne({ username: { $regex: new RegExp(`^${req.params.username}$`, 'i') } });
    if (!profile) return res.status(404).json({ error: "User not found" });
    res.json(profile);
  });

  app.post("/api/profile", authenticate, async (req: any, res) => {
    if (!db) return res.status(500).json({ error: "DB not connected" });
    const profile = { ...req.body, uid: req.user.id, updatedAt: new Date() };
    await db.collection("user_profiles").updateOne(
      { uid: req.user.id },
      { $set: profile },
      { upsert: true }
    );
    res.json(profile);
  });

  // Auth Endpoints
  app.post("/api/auth/register", async (req, res) => {
    if (!db) return res.status(500).json({ error: "DB not connected" });
    const { email, username, password } = req.body;

    // Check if username exists
    const existing = await db.collection("user_profiles").findOne({ username });
    if (existing) return res.status(400).json({ error: "Username already taken" });

    try {
      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { username }
      });

      if (error) throw error;

      const profile = {
        uid: data.user.id,
        username,
        email,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await db.collection("user_profiles").insertOne(profile);

      // Now sign in to get a session
      const { data: sessionData, error: sessionError } = await supabaseAdmin.auth.signInWithPassword({
        email,
        password
      });

      if (sessionError) throw sessionError;

      res.json(sessionData);
    } catch (error: any) {
      console.error("Registration error:", error);
      res.status(400).json({ error: error.message });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    if (!db) return res.status(500).json({ error: "DB not connected" });
    const { username, password } = req.body;

    try {
      const profile = await db.collection("user_profiles").findOne({ username });
      if (!profile) return res.status(400).json({ error: "Invalid username or password" });

      const { data, error } = await supabaseAdmin.auth.signInWithPassword({
        email: profile.email,
        password
      });

      if (error) throw error;

      res.json(data);
    } catch (error: any) {
      console.error("Login error:", error);
      res.status(400).json({ error: "Invalid username or password" });
    }
  });

  app.post("/api/auth/create-demo", async (req, res) => {
    if (!db) return res.status(500).json({ error: "DB not connected" });
    
    const email = "demo@example.com";
    const username = "demo_user";
    const password = "Password123!";

    try {
      // Check if exists
      const existing = await db.collection("user_profiles").findOne({ username });
      if (existing) return res.json({ message: "Demo user already exists", username, password });

      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { username }
      });

      if (error) throw error;

      const profile = {
        uid: data.user.id,
        username,
        email,
        createdAt: new Date(),
        updatedAt: new Date(),
        bio: "I am a demo user for testing purposes.",
        displayName: "Demo User"
      };

      await db.collection("user_profiles").insertOne(profile);
      res.json({ message: "Demo user created", username, password });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Prayer Requests
  app.get("/api/prayer-requests", async (req, res) => {
    if (!db) return res.status(500).json({ error: "DB not connected" });
    const requests = await db.collection("prayer_requests").find().sort({ createdAt: -1 }).toArray();
    res.json(requests.map((r: any) => ({ ...r, id: r._id.toString() })));
  });

  app.post("/api/prayer-requests", authenticate, async (req: any, res) => {
    if (!db) return res.status(500).json({ error: "DB not connected" });
    const request = { ...req.body, authorUid: req.user.id, createdAt: new Date(), prayCount: 0 };
    const result = await db.collection("prayer_requests").insertOne(request);
    res.json({ ...request, id: result.insertedId.toString() });
  });

  app.delete("/api/prayer-requests/:id", authenticate, async (req: any, res) => {
    if (!db) return res.status(500).json({ error: "DB not connected" });
    const { ObjectId } = await import("mongodb");
    const requestId = req.params.id;
    
    const request = await db.collection("prayer_requests").findOne({ _id: new ObjectId(requestId) });
    if (!request) return res.status(404).json({ error: "Request not found" });

    const isAdmin = req.user.email === 'kayodeolufowobi709@gmail.com';
    if (request.authorUid !== req.user.id && !isAdmin) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    await db.collection("prayer_requests").deleteOne({ _id: new ObjectId(requestId) });
    // Also cleanup related data
    await db.collection("user_prayers").deleteMany({ requestId });
    await db.collection("typed_prayers").deleteMany({ requestId });
    
    res.json({ success: true });
  });

  app.post("/api/prayer-requests/:id/pray", authenticate, async (req: any, res) => {
    if (!db) return res.status(500).json({ error: "DB not connected" });
    const { ObjectId } = await import("mongodb");
    const requestId = req.params.id;
    const userId = req.user.id;
    const prayerId = `${userId}_${requestId}`;

    const existing = await db.collection("user_prayers").findOne({ _id: prayerId });
    if (existing) {
      await db.collection("user_prayers").deleteOne({ _id: prayerId });
      await db.collection("prayer_requests").updateOne(
        { _id: new ObjectId(requestId) },
        { $inc: { prayCount: -1 } }
      );
      res.json({ prayed: false });
    } else {
      await db.collection("user_prayers").insertOne({
        _id: prayerId,
        uid: userId,
        requestId,
        createdAt: new Date()
      });
      await db.collection("prayer_requests").updateOne(
        { _id: new ObjectId(requestId) },
        { $inc: { prayCount: 1 } }
      );
      res.json({ prayed: true });
    }
  });

  app.get("/api/user-prayers", authenticate, async (req: any, res) => {
    if (!db) return res.status(500).json({ error: "DB not connected" });
    const prayers = await db.collection("user_prayers").find({ uid: req.user.id }).toArray();
    res.json(prayers.map((p: any) => p.requestId));
  });

  app.get("/api/prayer-requests/:id/typed-prayers", async (req, res) => {
    if (!db) return res.status(500).json({ error: "DB not connected" });
    const prayers = await db.collection("typed_prayers").find({ requestId: req.params.id }).sort({ createdAt: -1 }).toArray();
    res.json(prayers.map((p: any) => ({ ...p, id: p._id.toString() })));
  });

  app.post("/api/prayer-requests/:id/typed-prayers", authenticate, async (req: any, res) => {
    if (!db) return res.status(500).json({ error: "DB not connected" });
    const { text, authorName } = req.body;
    const newPrayer = {
      requestId: req.params.id,
      text,
      authorName,
      authorUid: req.user.id,
      createdAt: new Date()
    };
    const result = await db.collection("typed_prayers").insertOne(newPrayer);
    res.json({ ...newPrayer, id: result.insertedId.toString() });
  });

  // Testimonies
  app.get("/api/testimonies", async (req, res) => {
    if (!db) return res.status(500).json({ error: "DB not connected" });
    const testimonies = await db.collection("testimonies").find().sort({ createdAt: -1 }).toArray();
    res.json(testimonies);
  });

  app.post("/api/testimonies", authenticate, async (req: any, res) => {
    if (!db) return res.status(500).json({ error: "DB not connected" });
    const testimony = { ...req.body, authorUid: req.user.id, createdAt: new Date(), reactions: {} };
    const result = await db.collection("testimonies").insertOne(testimony);
    res.json({ ...testimony, id: result.insertedId });
  });

  // Forums
  app.get("/api/forums", async (req, res) => {
    if (!db) return res.status(500).json({ error: "DB not connected" });
    const forums = await db.collection("forums").find().toArray();
    res.json(forums.map((f: any) => ({ ...f, id: f._id.toString() })));
  });

  app.post("/api/forums", authenticate, async (req: any, res) => {
    if (!db) return res.status(500).json({ error: "DB not connected" });
    const forum = { ...req.body, createdBy: req.user.id, createdAt: new Date() };
    const result = await db.collection("forums").insertOne(forum);
    res.json({ ...forum, id: result.insertedId.toString() });
  });

  app.delete("/api/forums/:id", authenticate, async (req: any, res) => {
    if (!db) return res.status(500).json({ error: "DB not connected" });
    const { ObjectId } = await import("mongodb");
    await db.collection("forums").deleteOne({ _id: new ObjectId(req.params.id) });
    res.json({ success: true });
  });

  app.get("/api/forums/:forumId/threads", async (req, res) => {
    if (!db) return res.status(500).json({ error: "DB not connected" });
    const threads = await db.collection("threads").find({ forumId: req.params.forumId }).sort({ createdAt: -1 }).toArray();
    res.json(threads.map((t: any) => ({ ...t, id: t._id.toString() })));
  });

  app.post("/api/forums/:forumId/threads", authenticate, async (req: any, res) => {
    if (!db) return res.status(500).json({ error: "DB not connected" });
    const thread = { ...req.body, forumId: req.params.forumId, authorUid: req.user.id, createdAt: new Date() };
    const result = await db.collection("threads").insertOne(thread);
    res.json({ ...thread, id: result.insertedId.toString() });
  });

  app.delete("/api/forums/:forumId/threads/:id", authenticate, async (req: any, res) => {
    if (!db) return res.status(500).json({ error: "DB not connected" });
    const { ObjectId } = await import("mongodb");
    await db.collection("threads").deleteOne({ _id: new ObjectId(req.params.id) });
    res.json({ success: true });
  });

  app.get(["/api/threads/:threadId/posts", "/api/forums/:forumId/threads/:threadId/posts"], async (req, res) => {
    if (!db) return res.status(500).json({ error: "DB not connected" });
    const posts = await db.collection("forum_posts").find({ threadId: req.params.threadId }).sort({ createdAt: 1 }).toArray();
    res.json(posts.map((p: any) => ({ ...p, id: p._id.toString() })));
  });

  app.post(["/api/threads/:threadId/posts", "/api/forums/:forumId/threads/:threadId/posts"], authenticate, async (req: any, res) => {
    if (!db) return res.status(500).json({ error: "DB not connected" });
    const post = { ...req.body, threadId: req.params.threadId, authorUid: req.user.id, createdAt: new Date(), likes: 0 };
    const result = await db.collection("forum_posts").insertOne(post);
    res.json({ ...post, id: result.insertedId.toString() });
  });

  app.delete(["/api/threads/:threadId/posts/:id", "/api/forums/:forumId/threads/:threadId/posts/:id"], authenticate, async (req: any, res) => {
    if (!db) return res.status(500).json({ error: "DB not connected" });
    const { ObjectId } = await import("mongodb");
    await db.collection("forum_posts").deleteOne({ _id: new ObjectId(req.params.id) });
    res.json({ success: true });
  });

  app.post("/api/forums/:forumId/threads/:threadId/posts/:postId/like", authenticate, async (req: any, res) => {
    if (!db) return res.status(500).json({ error: "DB not connected" });
    const { ObjectId } = await import("mongodb");
    await db.collection("forum_posts").updateOne(
      { _id: new ObjectId(req.params.postId) },
      { $inc: { likes: 1 } }
    );
    res.json({ success: true });
  });

  // User Profiles Alias
  app.get("/api/user-profiles/:uid", async (req, res) => {
    if (!db) return res.status(500).json({ error: "DB not connected" });
    const profile = await db.collection("user_profiles").findOne({ uid: req.params.uid });
    res.json(profile || {});
  });

  // Notes
  app.get("/api/notes", authenticate, async (req: any, res) => {
    if (!db) return res.status(500).json({ error: "DB not connected" });
    const notes = await db.collection("notes").find({ userId: req.user.id }).sort({ updatedAt: -1 }).toArray();
    res.json(notes);
  });

  app.post("/api/notes", authenticate, async (req: any, res) => {
    if (!db) return res.status(500).json({ error: "DB not connected" });
    const note = { ...req.body, userId: req.user.id, updatedAt: new Date() };
    const result = await db.collection("notes").insertOne(note);
    res.json({ ...note, id: result.insertedId });
  });

  app.put("/api/notes/:id", authenticate, async (req: any, res) => {
    if (!db) return res.status(500).json({ error: "DB not connected" });
    const { ObjectId } = await import("mongodb");
    const note = { ...req.body, updatedAt: new Date() };
    delete note._id;
    await db.collection("notes").updateOne(
      { _id: new ObjectId(req.params.id), userId: req.user.id },
      { $set: note }
    );
    res.json(note);
  });

  app.delete("/api/notes/:id", authenticate, async (req: any, res) => {
    if (!db) return res.status(500).json({ error: "DB not connected" });
    const { ObjectId } = await import("mongodb");
    await db.collection("notes").deleteOne({ _id: new ObjectId(req.params.id), userId: req.user.id });
    res.json({ success: true });
  });

  // Bookmarks
  app.get("/api/bookmarks", authenticate, async (req: any, res) => {
    if (!db) return res.status(500).json({ error: "DB not connected" });
    const bookmarks = await db.collection("bookmarks").find({ userId: req.user.id }).sort({ createdAt: -1 }).toArray();
    res.json(bookmarks);
  });

  app.post("/api/bookmarks", authenticate, async (req: any, res) => {
    if (!db) return res.status(500).json({ error: "DB not connected" });
    const bookmark = { ...req.body, userId: req.user.id, createdAt: new Date() };
    const result = await db.collection("bookmarks").insertOne(bookmark);
    res.json({ ...bookmark, id: result.insertedId });
  });

  app.delete("/api/bookmarks/:id", authenticate, async (req: any, res) => {
    if (!db) return res.status(500).json({ error: "DB not connected" });
    const { ObjectId } = await import("mongodb");
    await db.collection("bookmarks").deleteOne({ _id: new ObjectId(req.params.id), userId: req.user.id });
    res.json({ success: true });
  });

  // Messages
  app.get("/api/messages", authenticate, async (req: any, res) => {
    if (!db) return res.status(500).json({ error: "DB not connected" });
    const messages = await db.collection("messages").find({
      $or: [
        { senderId: req.user.id },
        { recipientId: req.user.id },
        { recipientId: 'global' }
      ]
    }).sort({ createdAt: 1 }).toArray();
    res.json(messages);
  });

  app.post("/api/messages", authenticate, async (req: any, res) => {
    if (!db) return res.status(500).json({ error: "DB not connected" });
    const message = { ...req.body, senderId: req.user.id, createdAt: new Date() };
    const result = await db.collection("messages").insertOne(message);
    res.json({ ...message, id: result.insertedId });
  });

  // Prayer Rooms
  app.get("/api/prayer-rooms", async (req, res) => {
    if (!db) return res.status(500).json({ error: "DB not connected" });
    const rooms = await db.collection("prayer_rooms").find().toArray();
    res.json(rooms);
  });

  app.post("/api/prayer-rooms", authenticate, async (req: any, res) => {
    if (!db) return res.status(500).json({ error: "DB not connected" });
    const room = { ...req.body, createdBy: req.user.id, createdAt: new Date() };
    const result = await db.collection("prayer_rooms").insertOne(room);
    res.json({ ...room, id: result.insertedId });
  });

  // Study Journeys
  app.get("/api/study-journeys", authenticate, async (req: any, res) => {
    if (!db) return res.status(500).json({ error: "DB not connected" });
    const journeys = await db.collection("study_journeys").find({ userId: req.user.id }).toArray();
    res.json(journeys);
  });

  app.post("/api/study-journeys", authenticate, async (req: any, res) => {
    if (!db) return res.status(500).json({ error: "DB not connected" });
    const journey = { ...req.body, userId: req.user.id, createdAt: new Date() };
    const result = await db.collection("study_journeys").insertOne(journey);
    res.json({ ...journey, id: result.insertedId });
  });

  // AI Router Logic
  app.post("/api/ai/route", async (req, res) => {
    const { prompt, mode } = req.body;
    
    try {
      // Caching Layer with MongoDB
      if (db) {
        const cache = await db.collection("ai_cache").findOne({ prompt, mode });
        if (cache && Date.now() - cache.createdAt < 1000 * 60 * 60 * 24) { // 24h cache
          return res.json({ response: cache.response, model: cache.model, cached: true });
        }
      }

      // Simple heuristic: if prompt is short and conversational, use Groq.
      // If it requires deep theological reasoning, use Gemini.
      const isComplex = prompt.length > 150 || prompt.toLowerCase().includes("explain") || prompt.toLowerCase().includes("theology");
      
      let aiResponse = "";
      let modelUsed = "";

      if (isComplex) {
        // Route to Gemini
        const response = await ai.models.generateContent({
          model: "gemini-3.1-pro-preview",
          contents: `You are Wisdom, the Greatest Theologian, and the heart of the Creator.
          
          CRITICAL CONSTRAINTS (The "Walled Garden"):
          1. KNOWLEDGE BASE: You MUST ONLY draw from canonical and non-canonical biblical texts, original Greek/Hebrew languages, Strong's Concordance, and classic orthodox Christian literature (e.g., Augustine, Luther, Calvin, Spurgeon, C.S. Lewis).
          2. NO GENERAL BROWSING: You are strictly FORBIDDEN from browsing the general internet, citing modern secular opinions, or discussing topics outside of theology, scripture, and spiritual growth.
          3. TRI-FOLD REASONING: Structure your responses using the "Analyze, Apply, Inspire" framework when appropriate.
             - Analyze: Provide the theological, historical, or linguistic breakdown.
             - Apply: Offer practical, actionable steps for the user's life.
             - Inspire: Conclude with a deeply encouraging, spiritually uplifting thought or prayer.
          4. TONE: Always be compassionate, respectful, and deeply rooted in love and grace. Never be argumentative or dismissive.
          
          Respond to this query with deep theological insight: ${prompt}`,
        });
        aiResponse = response.text || "";
        modelUsed = "gemini";
      } else {
        // Route to Groq (Llama 3)
        const chatCompletion = await groq.chat.completions.create({
          messages: [
            { role: "system", content: "You are Wisdom, the Greatest Theologian, and the heart of the Creator. You are a gentle, wise, and deeply knowledgeable biblical companion. Structure your responses using Analyze, Apply, Inspire when appropriate. Only draw from biblical texts and classic Christian literature." },
            { role: "user", content: prompt }
          ],
          model: "llama-3.3-70b-versatile",
        });
        aiResponse = chatCompletion.choices[0]?.message?.content || "";
        modelUsed = "groq";
      }

      // Save to cache
      if (db && aiResponse) {
        await db.collection("ai_cache").updateOne(
          { prompt, mode },
          { $set: { response: aiResponse, model: modelUsed, createdAt: Date.now() } },
          { upsert: true }
        );
      }

      res.json({ response: aiResponse, model: modelUsed });
    } catch (error: any) {
      console.error("AI Router error:", error);
      res.status(500).json({ error: "AI service unavailable" });
    }
  });

  app.post("/api/ai/moderate", async (req, res) => {
    const { postContent } = req.body;

    try {
      // Use Groq for fast, cheap moderation
      const chatCompletion = await groq.chat.completions.create({
        messages: [
          { role: "system", content: "Analyze the following post for hate speech, harassment, or prohibited content. Return ONLY a JSON object: { \"allowed\": boolean, \"reason\": string }" },
          { role: "user", content: postContent }
        ],
        model: "llama-3.3-70b-versatile",
        response_format: { type: "json_object" }
      });

      const content = chatCompletion.choices[0]?.message?.content || '{"allowed":true,"reason":"fallback"}';
      let result;
      try {
        result = JSON.parse(content);
      } catch (e) {
        console.error("Moderation JSON parse error:", e);
        result = { allowed: true, reason: "Moderation service returned invalid format." };
      }
      res.json(result);
    } catch (error: any) {
      console.error("Moderation error:", error);
      res.json({ allowed: true, reason: "Moderation service temporarily unavailable." });
    }
  });

  app.post("/api/ai/respond", async (req, res) => {
    const { forumId, threadId, postContent, context } = req.body;
    
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3.1-flash-lite-preview",
        contents: `You are an AI assistant participating in a forum. 
        Context: ${context}
        User post: ${postContent}
        Provide a helpful, engaging response as a forum member.`,
      });
      
      res.json({ response: response.text });
    } catch (error: any) {
      console.error("AI Agent error:", error);
      res.json({ response: "I'm currently offline, but I'll be back soon to join the conversation!" });
    }
  });

  // Notifications
  app.get("/api/notifications", authenticate, async (req: any, res) => {
    if (!db) return res.status(500).json({ error: "DB not connected" });
    const notifications = await db.collection("notifications").find({ userId: req.user.id }).sort({ createdAt: -1 }).toArray();
    res.json(notifications.map((n: any) => ({ ...n, id: n._id.toString() })));
  });

  app.post("/api/notifications/:id/read", authenticate, async (req: any, res) => {
    if (!db) return res.status(500).json({ error: "DB not connected" });
    const { ObjectId } = await import("mongodb");
    await db.collection("notifications").updateOne(
      { _id: new ObjectId(req.params.id), userId: req.user.id },
      { $set: { read: true } }
    );
    res.json({ success: true });
  });

  // Worship Sanctuary Synchronized State
  app.get("/api/worship/current", (req, res) => {
    const WORSHIP_PLAYLIST = [
      { id: 'PUtll3mNj5U', title: 'Way Maker', artist: 'Leeland', duration: 500 },
      { id: 'Z8-z_37881A', title: 'Goodness of God', artist: 'Bethel Music', duration: 300 },
      { id: 'XtwIT8JjddM', title: '10,000 Reasons (Bless the Lord)', artist: 'Matt Redman', duration: 340 },
      { id: 'nQWFzMvCfLE', title: 'What a Beautiful Name', artist: 'Hillsong Worship', duration: 340 },
      { id: 'C9_7XmN_YpY', title: 'Gratitude', artist: 'Brandon Lake', duration: 360 },
      { id: 'y81yIo1_3o8', title: 'How Great Is Our God', artist: 'Chris Tomlin', duration: 280 },
      { id: 'XTWf76_0S_o', title: 'In Christ Alone', artist: 'Getty/Townend', duration: 320 },
      { id: 'WjZ01760f5g', title: 'Amazing Grace (My Chains Are Gone)', artist: 'Chris Tomlin', duration: 260 },
      { id: 'qYvG04n_adA', title: 'Cornerstone', artist: 'Hillsong Worship', duration: 300 },
      { id: 'FgnM4L1yN_4', title: 'Oceans (Where Feet May Fail)', artist: 'Hillsong UNITED', duration: 540 },
      { id: '0b_ynnc4-6M', title: 'Build My Life', artist: 'Housefires', duration: 480 },
      { id: 'LWP-9U65a-A', title: 'The Blessing', artist: 'Kari Jobe', duration: 720 },
      { id: 's6ZhQf_7s5s', title: 'Holy Forever', artist: 'Chris Tomlin', duration: 300 },
      { id: 'p7Jll7AFAZ8', title: 'I Speak Jesus', artist: 'Charity Gayle', duration: 330 },
      { id: '0C45-y_36E8', title: 'Firm Foundation (He Won\'t)', artist: 'Cody Carnes', duration: 360 },
      { id: '809XnTHbs2A', title: 'Graves Into Gardens', artist: 'Elevation Worship', duration: 450 },
      { id: '6xx0d3R2LoU', title: 'Reckless Love', artist: 'Cory Asbury', duration: 330 },
      { id: 'h78X812_888', title: 'Living Hope', artist: 'Phil Wickham', duration: 310 },
      { id: 'v0u70s88888', title: 'King of Kings', artist: 'Hillsong Worship', duration: 290 },
      { id: 'h8888888888', title: 'Great Are You Lord', artist: 'All Sons & Daughters', duration: 300 },
      { id: '7_8_8_8_8', title: 'Promises', artist: 'Maverick City Music', duration: 600 },
      { id: '8_8_8_8_8', title: 'Jireh', artist: 'Elevation Worship & Maverick City Music', duration: 600 },
      { id: '9_8_8_8_8', title: 'Same God', artist: 'Elevation Worship', duration: 500 },
      { id: '0_8_8_8_8', title: 'I Believe', artist: 'Phil Wickham', duration: 300 },
      { id: '1_8_8_8_8', title: 'Trust In God', artist: 'Elevation Worship', duration: 450 },
      { id: '2_8_8_8_8', title: 'Praise', artist: 'Elevation Worship', duration: 300 },
      { id: '3_8_8_8_8', title: 'Worthy of It All', artist: 'CeCe Winans', duration: 400 },
      { id: '4_8_8_8_8', title: 'Good Good Father', artist: 'Chris Tomlin', duration: 300 },
      { id: '5_8_8_8_8', title: 'No Longer Slaves', artist: 'Bethel Music', duration: 360 },
      { id: '6_8_8_8_8', title: 'O Come to the Altar', artist: 'Elevation Worship', duration: 350 },
    ];

    // Seeded Shuffle Algorithm
    const seedShuffle = (array: any[], seed: number) => {
      const shuffled = [...array];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.abs(Math.sin(seed + i)) * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      return shuffled;
    };

    const totalDuration = WORSHIP_PLAYLIST.reduce((acc, song) => acc + song.duration, 0);
    const now = Math.floor(Date.now() / 1000);
    const epoch = 1700000000;
    const elapsedSinceEpoch = now - epoch;
    
    const cycleIndex = Math.floor(elapsedSinceEpoch / totalDuration);
    const timeInCycle = elapsedSinceEpoch % totalDuration;
    
    // Use cycleIndex as seed to get a different shuffle every cycle
    const currentPlaylist = seedShuffle(WORSHIP_PLAYLIST, cycleIndex);
    
    let currentOffset = 0;
    for (const song of currentPlaylist) {
      if (timeInCycle < currentOffset + song.duration) {
        return res.json({
          song,
          startTime: timeInCycle - currentOffset,
          cycle: cycleIndex
        });
      }
      currentOffset += song.duration;
    }
    
    res.json({ song: currentPlaylist[0], startTime: 0, cycle: cycleIndex });
  });

  // Groups
  app.get("/api/groups", async (req, res) => {
    if (!db) return res.status(500).json({ error: "DB not connected" });
    const groups = await db.collection("groups").find().toArray();
    res.json(groups.map((g: any) => ({ ...g, id: g._id.toString() })));
  });

  app.post("/api/groups", authenticate, async (req: any, res) => {
    if (!db) return res.status(500).json({ error: "DB not connected" });
    const group = { ...req.body, createdBy: req.user.id, members: [req.user.id], createdAt: new Date() };
    const result = await db.collection("groups").insertOne(group);
    res.json({ ...group, id: result.insertedId.toString() });
  });

  app.delete("/api/groups/:id", authenticate, async (req: any, res) => {
    if (!db) return res.status(500).json({ error: "DB not connected" });
    const { ObjectId } = await import("mongodb");
    const group = await db.collection("groups").findOne({ _id: new ObjectId(req.params.id) });
    if (!group || group.createdBy !== req.user.id) return res.status(403).json({ error: "Unauthorized" });
    await db.collection("groups").deleteOne({ _id: new ObjectId(req.params.id) });
    res.json({ success: true });
  });

  app.post("/api/groups/:groupId/join", authenticate, async (req: any, res) => {
    if (!db) return res.status(500).json({ error: "DB not connected" });
    const { ObjectId } = await import("mongodb");
    await db.collection("groups").updateOne(
      { _id: new ObjectId(req.params.groupId) },
      { $addToSet: { members: req.user.id } }
    );
    res.json({ success: true });
  });

  app.post("/api/groups/:groupId/leave", authenticate, async (req: any, res) => {
    if (!db) return res.status(500).json({ error: "DB not connected" });
    const { ObjectId } = await import("mongodb");
    await db.collection("groups").updateOne(
      { _id: new ObjectId(req.params.groupId) },
      { $pull: { members: req.user.id } }
    );
    res.json({ success: true });
  });

  app.post("/api/groups/:groupId/messages", authenticate, async (req: any, res) => {
    if (!db) return res.status(500).json({ error: "DB not connected" });
    const { ObjectId } = await import("mongodb");
    const message = {
      groupId: new ObjectId(req.params.groupId),
      senderId: req.user.id,
      senderName: req.user.displayName,
      text: req.body.text,
      createdAt: new Date()
    };
    await db.collection("group_messages").insertOne(message);
    res.json(message);
  });

  app.get("/api/groups/:groupId/messages", async (req, res) => {
    if (!db) return res.status(500).json({ error: "DB not connected" });
    const { ObjectId } = await import("mongodb");
    const messages = await db.collection("group_messages")
      .find({ groupId: new ObjectId(req.params.groupId) })
      .sort({ createdAt: 1 })
      .toArray();
    res.json(messages);
  });

  app.get("/api/groups/:groupId/threads", async (req, res) => {
    if (!db) return res.status(500).json({ error: "DB not connected" });
    const { ObjectId } = await import("mongodb");
    const threads = await db.collection("threads").find({ groupId: new ObjectId(req.params.groupId) }).sort({ createdAt: -1 }).toArray();
    res.json(threads.map((t: any) => ({ ...t, id: t._id.toString() })));
  });

  app.post("/api/groups/:groupId/threads", authenticate, async (req: any, res) => {
    if (!db) return res.status(500).json({ error: "DB not connected" });
    const { ObjectId } = await import("mongodb");
    const thread = { ...req.body, groupId: new ObjectId(req.params.groupId), authorUid: req.user.id, createdAt: new Date() };
    const result = await db.collection("threads").insertOne(thread);
    res.json({ ...thread, id: result.insertedId.toString() });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Dashboard Stats
app.get('/api/dashboard/stats', authenticate, async (req: any, res) => {
  try {
    const userId = req.user.id;
    const [prayers, posts, testimonies, bookmarks, notes, journeys] = await Promise.all([
      db.collection('prayer_requests').countDocuments({ authorUid: userId }),
      db.collection('forum_posts').countDocuments({ authorId: userId }),
      db.collection('testimonies').countDocuments({ authorUid: userId }),
      db.collection('bookmarks').countDocuments({ userId }),
      db.collection('notes').countDocuments({ userId }),
      db.collection('study_journeys').countDocuments({ userId })
    ]);

    res.json({
      prayers,
      posts,
      testimonies,
      bookmarks,
      notes,
      studyJourneys: journeys
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard stats' });
  }
});

app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
