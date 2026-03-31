import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { MongoClient, ObjectId } from "mongodb";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import axios from "axios";
import xml2js from "xml2js";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const TOPICS_LIST = [
  { id: 'peace', name: 'Peace', description: 'Finding calm in the midst of the storm.' },
  { id: 'anxiety', name: 'Anxiety', description: 'Casting your cares upon Him.' },
  { id: 'healing', name: 'Healing', description: 'Restoration for body and soul.' },
  { id: 'forgiveness', name: 'Forgiveness', description: 'The power of letting go.' },
  { id: 'strength', name: 'Strength', description: 'Power when you are weak.' },
  { id: 'faith', name: 'Faith', description: 'Believing in the unseen.' },
  { id: 'hope', name: 'Hope', description: 'An anchor for the soul.' },
  { id: 'guidance', name: 'Guidance', description: 'Light for your path.' },
  { id: 'fear', name: 'Fear', description: 'Courage in the face of giants.' },
  { id: 'rest', name: 'Rest', description: 'Sabbath for the weary.' }
];

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());
  
  app.use((req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    next();
  });
  
  const supabaseAdmin = createClient(
    process.env.VITE_SUPABASE_URL || "https://dummy.supabase.co",
    process.env.SUPABASE_SERVICE_ROLE_KEY || "dummy"
  );

  let db: any = null;
  if (process.env.MONGODB_URI) {
    try {
      const mongoClient = await MongoClient.connect(process.env.MONGODB_URI);
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

  app.get("/api/admin/check", authenticate, async (req: any, res) => {
    const isAdmin = req.user.email === 'kayodeolufowobi709@gmail.com';
    res.json({ isAdmin });
  });

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", dbConnected: !!db, timestamp: new Date() });
  });

  // User Profiles
  app.get("/api/users/me", authenticate, async (req: any, res) => {
    if (!db) return res.status(500).json({ error: "DB not connected" });
    const profile = await db.collection("user_profiles").findOne({ uid: req.user.id });
    if (!profile) return res.status(404).json({ error: "Profile not found" });
    
    const following = await db.collection("followers").find({ followerId: req.user.id }).toArray();
    const followingIds = following.map(f => f.targetId);
    
    res.json({ ...profile, id: profile._id.toString(), following: followingIds });
  });

  app.delete("/api/users/me", authenticate, async (req: any, res) => {
    if (!db) return res.status(500).json({ error: "DB not connected" });
    const userId = req.user.id;

    // Delete user profile
    await db.collection("user_profiles").deleteOne({ uid: userId });
    // Delete user followers/following
    await db.collection("followers").deleteMany({ $or: [{ followerId: userId }, { targetId: userId }] });
    // Delete user posts, prayers, etc.
    await db.collection("forum_posts").deleteMany({ authorUid: userId });
    await db.collection("prayer_requests").deleteMany({ authorUid: userId });
    await db.collection("testimonies").deleteMany({ authorUid: userId });
    await db.collection("threads").deleteMany({ authorUid: userId });
    await db.collection("typed_prayers").deleteMany({ authorUid: userId });
    await db.collection("testimony_comments").deleteMany({ authorUid: userId });
    await db.collection("forum_messages").deleteMany({ senderId: userId });
    await db.collection("direct_messages").deleteMany({ $or: [{ senderId: userId }, { recipientId: userId }] });
    await db.collection("friend_requests").deleteMany({ $or: [{ senderId: userId }, { recipientId: userId }] });
    await db.collection("notes").deleteMany({ userId });
    await db.collection("bookmarks").deleteMany({ userId });
    await db.collection("reading_plans").deleteMany({ userId });
    await db.collection("study_journeys").deleteMany({ userId });
    await db.collection("custom_concordance").deleteMany({ userId });
    await db.collection("user_activity").deleteMany({ userId });
    await db.collection("user_stats").deleteMany({ userId });
    await db.collection("notifications").deleteMany({ userId });
    await db.collection("milestones").deleteMany({ userId });
    await db.collection("testimony_reactions").deleteMany({ userId });
    await db.collection("user_prayers").deleteMany({ uid: userId });
    
    // Delete from supabase auth
    await supabaseAdmin.auth.admin.deleteUser(userId);

    res.json({ success: true });
  });

  app.get("/api/profile/:uid", async (req, res) => {
    if (!db) return res.status(500).json({ error: "DB not connected" });
    const profile = await db.collection("user_profiles").findOne({ uid: req.params.uid });
    if (!profile) return res.status(404).json({ error: "Profile not found" });
    res.json({ ...profile, id: profile._id.toString() });
  });

  app.get("/api/users/search", async (req, res) => {
    if (!db) return res.status(500).json({ error: "DB not connected" });
    const { q } = req.query;
    if (!q) return res.json([]);
    const users = await db.collection("user_profiles").find({
      $or: [
        { username: { $regex: q, $options: "i" } },
        { displayName: { $regex: q, $options: "i" } }
      ]
    }).limit(10).toArray();
    res.json(users);
  });

  app.get("/api/users/:uid/brethren", async (req, res) => {
    if (!db) return res.status(500).json({ error: "DB not connected" });
    const userId = req.params.uid;
    
    // Find people I follow
    const following = await db.collection("followers").find({ followerId: userId }).toArray();
    const followingIds = following.map(f => f.targetId);
    
    // Find people who follow me
    const followers = await db.collection("followers").find({ targetId: userId }).toArray();
    const followerIds = followers.map(f => f.followerId);
    
    // Find mutual
    const brethrenIds = followingIds.filter(id => followerIds.includes(id));
    
    const brethren = await db.collection("user_profiles").find({ uid: { $in: brethrenIds } }).toArray();
    res.json(brethren.map((u: any) => ({
      uid: u.uid,
      username: u.username,
      displayName: u.displayName,
      photoURL: u.photoURL,
      bio: u.bio
    })));
  });

  app.get("/api/users/by-username/:username", async (req, res) => {
    if (!db) return res.status(500).json({ error: "DB not connected" });
    const profile = await db.collection("user_profiles").findOne({ username: { $regex: `^${req.params.username}$`, $options: 'i' } });
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

  app.put("/api/users/profile", authenticate, async (req: any, res) => {
    if (!db) return res.status(500).json({ error: "DB not connected" });
    const { displayName, bio, location, website, photoURL } = req.body;
    
    const updateData: any = {
      updatedAt: new Date()
    };
    
    if (displayName !== undefined) updateData.displayName = displayName;
    if (bio !== undefined) updateData.bio = bio;
    if (location !== undefined) updateData.location = location;
    if (website !== undefined) updateData.website = website;
    if (photoURL !== undefined) updateData.photoURL = photoURL;

    await db.collection("user_profiles").updateOne(
      { uid: req.user.id },
      { $set: updateData },
      { upsert: true }
    );

    const updatedProfile = await db.collection("user_profiles").findOne({ uid: req.user.id });
    res.json(updatedProfile);
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
    const requestId = req.params.id;
    
    try {
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
    } catch (error) {
      res.status(400).json({ error: "Invalid ID format" });
    }
  });

  app.post("/api/prayer-requests/:id/pray", authenticate, async (req: any, res) => {
    if (!db) return res.status(500).json({ error: "DB not connected" });
    const requestId = req.params.id;
    const userId = req.user.id;
    const prayerId = `${userId}_${requestId}`;

    try {
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
    } catch (error) {
      res.status(400).json({ error: "Invalid ID format" });
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

  app.delete("/api/prayer-requests/:id/typed-prayers/:prayerId", authenticate, async (req: any, res) => {
    if (!db) return res.status(500).json({ error: "DB not connected" });
    try {
      const prayer = await db.collection("typed_prayers").findOne({ _id: new ObjectId(req.params.prayerId) });
      if (!prayer) return res.status(404).json({ error: "Prayer not found" });
      
      // Check if user is author or admin
      const isAdmin = req.user.email === 'kayodeolufowobi709@gmail.com';
      if (prayer.authorUid !== req.user.id && !isAdmin) {
        return res.status(403).json({ error: "Unauthorized" });
      }

      await db.collection("typed_prayers").deleteOne({ _id: new ObjectId(req.params.prayerId) });
      res.json({ success: true });
    } catch (error) {
      res.status(400).json({ error: "Invalid prayer ID" });
    }
  });

  // Testimonies
  app.get("/api/testimonies", async (req, res) => {
    if (!db) return res.status(500).json({ error: "DB not connected" });
    const testimonies = await db.collection("testimonies").find().sort({ createdAt: -1 }).toArray();
    res.json(testimonies.map(t => ({ ...t, id: t._id.toString() })));
  });

  app.post("/api/testimonies", authenticate, async (req: any, res) => {
    if (!db) return res.status(500).json({ error: "DB not connected" });
    const testimony = { ...req.body, authorUid: req.user.id, createdAt: new Date(), reactions: {} };
    const result = await db.collection("testimonies").insertOne(testimony);
    res.json({ ...testimony, id: result.insertedId.toString() });
  });

  app.post("/api/testimonies/:id/reactions", authenticate, async (req: any, res) => {
    if (!db) return res.status(500).json({ error: "DB not connected" });
    const { emoji } = req.body;
    const testimonyId = req.params.id;
    const userId = req.user.id;

    try {
      const testimony = await db.collection("testimonies").findOne({ _id: new ObjectId(testimonyId) });
      if (!testimony) return res.status(404).json({ error: "Testimony not found" });

      // Check if user already reacted
      const existingReaction = await db.collection("testimony_reactions").findOne({ testimonyId, userId });
      
      if (existingReaction) {
        // Remove old reaction count
        const oldEmoji = existingReaction.emoji;
        await db.collection("testimonies").updateOne(
          { _id: new ObjectId(testimonyId) },
          { $inc: { [`reactions.${oldEmoji}`]: -1 } }
        );
        // Update to new reaction
        await db.collection("testimony_reactions").updateOne(
          { _id: existingReaction._id },
          { $set: { emoji, createdAt: new Date() } }
        );
      } else {
        // Add new reaction
        await db.collection("testimony_reactions").insertOne({ testimonyId, userId, emoji, createdAt: new Date() });
      }

      // Increment new reaction count
      await db.collection("testimonies").updateOne(
        { _id: new ObjectId(testimonyId) },
        { $inc: { [`reactions.${emoji}`]: 1 } }
      );

      // Notify author
      if (testimony.authorUid !== userId) {
        await db.collection("notifications").insertOne({
          userId: testimony.authorUid,
          type: "reaction",
          title: "New Reaction",
          message: `Someone reacted with ${emoji} to your testimony!`,
          link: "/testimonies",
          read: false,
          createdAt: new Date()
        });
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Error adding reaction:", error);
      res.status(400).json({ error: "Invalid testimony ID" });
    }
  });

  app.get("/api/testimonies/:id/comments", async (req, res) => {
    if (!db) return res.status(500).json({ error: "DB not connected" });
    try {
      const comments = await db.collection("testimony_comments")
        .find({ testimonyId: req.params.id })
        .sort({ createdAt: 1 })
        .toArray();
      res.json(comments.map(c => ({ ...c, id: c._id.toString() })));
    } catch (error) {
      console.error("Error fetching comments:", error);
      res.status(400).json({ error: "Invalid testimony ID" });
    }
  });

  app.post("/api/testimonies/:id/comments", authenticate, async (req: any, res) => {
    if (!db) return res.status(500).json({ error: "DB not connected" });
    try {
      const comment = {
        ...req.body,
        testimonyId: req.params.id,
        authorUid: req.user.id,
        createdAt: new Date()
      };
      const result = await db.collection("testimony_comments").insertOne(comment);

      // Notify author
      const testimony = await db.collection("testimonies").findOne({ _id: new ObjectId(req.params.id) });
      if (testimony && testimony.authorUid !== req.user.id) {
        await db.collection("notifications").insertOne({
          userId: testimony.authorUid,
          type: "comment",
          title: "New Comment",
          message: `${req.body.authorName || 'Someone'} commented on your testimony.`,
          link: "/testimonies",
          read: false,
          createdAt: new Date()
        });
      }

      res.json({ ...comment, id: result.insertedId.toString() });
    } catch (error) {
      console.error("Error adding comment:", error);
      res.status(400).json({ error: "Invalid testimony ID" });
    }
  });

  app.delete("/api/testimonies/:id/comments/:commentId", authenticate, async (req: any, res) => {
    if (!db) return res.status(500).json({ error: "DB not connected" });
    try {
      const comment = await db.collection("testimony_comments").findOne({ _id: new ObjectId(req.params.commentId) });
      if (!comment) return res.status(404).json({ error: "Comment not found" });

      const isAdmin = req.user.email === 'kayodeolufowobi709@gmail.com';
      if (comment.authorUid !== req.user.id && !isAdmin) {
        return res.status(403).json({ error: "Unauthorized" });
      }

      await db.collection("testimony_comments").deleteOne({ _id: new ObjectId(req.params.commentId) });
      res.json({ success: true });
    } catch (error) {
      res.status(400).json({ error: "Invalid comment ID" });
    }
  });

  app.delete("/api/testimonies/:id", authenticate, async (req: any, res) => {
    if (!db) return res.status(500).json({ error: "DB not connected" });
    try {
      await db.collection("testimonies").deleteOne({ _id: new ObjectId(req.params.id) });
      await db.collection("testimony_comments").deleteMany({ testimonyId: req.params.id });
      res.json({ success: true });
    } catch (error) {
      res.status(400).json({ error: "Invalid testimony ID" });
    }
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
    await db.collection("forums").deleteOne({ _id: new ObjectId(req.params.id) });
    res.json({ success: true });
  });

  // Prayer Rooms
  app.get("/api/prayer-rooms", async (req, res) => {
    if (!db) return res.status(500).json({ error: "DB not connected" });
    
    // Auto-delete expired rooms
    const now = new Date();
    await db.collection("prayer_rooms").deleteMany({
      expiryDate: { $exists: true, $lt: now.toISOString() }
    });

    const rooms = await db.collection("prayer_rooms").find().toArray();
    res.json(rooms.map((r: any) => ({ ...r, id: r._id.toString() })));
  });

  app.post("/api/prayer-rooms", authenticate, async (req: any, res) => {
    if (!db) return res.status(500).json({ error: "DB not connected" });
    const { name, description, startDate, expiryDate } = req.body;
    const room = { 
        name, 
        description, 
        startDate, 
        expiryDate, 
        createdBy: req.user.id, 
        creatorName: req.user.user_metadata?.full_name || req.user.email?.split('@')[0] || 'User',
        createdAt: new Date(),
        participantCount: 0 
    };
    const result = await db.collection("prayer_rooms").insertOne(room);
    res.json({ ...room, id: result.insertedId.toString() });
  });

  app.delete("/api/prayer-rooms/:id", authenticate, async (req: any, res) => {
    if (!db) return res.status(500).json({ error: "DB not connected" });
    const roomId = req.params.id;
    
    try {
      const room = await db.collection("prayer_rooms").findOne({ _id: new ObjectId(roomId) });
      if (!room) return res.status(404).json({ error: "Room not found" });

      const isAdmin = req.user.email === 'kayodeolufowobi709@gmail.com';
      if (room.createdBy !== req.user.id && !isAdmin) {
        return res.status(403).json({ error: "Unauthorized" });
      }

      await db.collection("prayer_rooms").deleteOne({ _id: new ObjectId(roomId) });
      res.json({ success: true });
    } catch (error) {
      res.status(400).json({ error: "Invalid ID format" });
    }
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
    await db.collection("forum_posts").deleteOne({ _id: new ObjectId(req.params.id) });
    res.json({ success: true });
  });

  app.post("/api/forums/:forumId/threads/:threadId/posts/:postId/like", authenticate, async (req: any, res) => {
    if (!db) return res.status(500).json({ error: "DB not connected" });
    const post = await db.collection("forum_posts").findOne({ _id: new ObjectId(req.params.postId) });
    if (!post) return res.status(404).json({ error: "Post not found" });
    
    const likedBy = post.likedBy || [];
    if (likedBy.includes(req.user.id)) {
      return res.status(400).json({ error: "Already liked" });
    }

    await db.collection("forum_posts").updateOne(
      { _id: new ObjectId(req.params.postId) },
      { 
        $inc: { likes: 1 },
        $push: { likedBy: req.user.id }
      }
    );
    res.json({ success: true });
  });

  // User Profiles Alias
  app.get("/api/user-profiles/:uid", async (req, res) => {
    if (!db) return res.status(500).json({ error: "DB not connected" });
    const profile = await db.collection("user_profiles").findOne({ uid: req.params.uid });
    res.json(profile || {});
  });

  // Friendships and Followers
  app.post("/api/friends/request", authenticate, async (req: any, res) => {
    if (!db) return res.status(500).json({ error: "DB not connected" });
    const { recipientId } = req.body;
    const senderId = req.user.id;

    if (senderId === recipientId) return res.status(400).json({ error: "Cannot add yourself" });

    const existing = await db.collection("friend_requests").findOne({
      senderId,
      recipientId
    });
    if (existing) return res.json({ message: "Request already sent" });

    await db.collection("friend_requests").insertOne({
      senderId,
      recipientId,
      status: "pending",
      createdAt: new Date()
    });

    // Notify recipient
    await db.collection("notifications").insertOne({
      userId: recipientId,
      type: "friend_request",
      title: "New Friend Request",
      message: `Someone wants to be your friend!`,
      read: false,
      createdAt: new Date()
    });

    res.json({ success: true });
  });

  app.get("/api/friends/requests", authenticate, async (req: any, res) => {
    if (!db) return res.status(500).json({ error: "DB not connected" });
    const requests = await db.collection("friend_requests").find({
      recipientId: req.user.id,
      status: "pending"
    }).toArray();
    res.json(requests);
  });

  app.post("/api/friends/accept", authenticate, async (req: any, res) => {
    if (!db) return res.status(500).json({ error: "DB not connected" });
    const { requestId } = req.body;
    const request = await db.collection("friend_requests").findOne({ _id: new ObjectId(requestId) });
    if (!request) return res.status(404).json({ error: "Request not found" });

    await db.collection("friendships").insertOne({
      users: [request.senderId, request.recipientId],
      createdAt: new Date()
    });

    await db.collection("friend_requests").deleteOne({ _id: new ObjectId(requestId) });
    res.json({ success: true });
  });

  app.post("/api/follow", authenticate, async (req: any, res) => {
    if (!db) return res.status(500).json({ error: "DB not connected" });
    const { targetId } = req.body;
    const followerId = req.user.id;
    console.log(`Follow request: followerId=${followerId}, targetId=${targetId}`);

    const existing = await db.collection("followers").findOne({ followerId, targetId });
    if (!existing) {
      await db.collection("followers").insertOne({ followerId, targetId, createdAt: new Date() });
      await db.collection("user_profiles").updateOne({ uid: targetId }, { $inc: { followersCount: 1 } });
      await db.collection("user_profiles").updateOne({ uid: followerId }, { $inc: { followingCount: 1 } });

      // Notify target
      const followerProfile = await db.collection("user_profiles").findOne({ uid: followerId });
      await db.collection("notifications").insertOne({
        userId: targetId,
        type: "follow",
        title: "New Follower",
        message: `${followerProfile?.displayName || 'Someone'} started following you!`,
        link: `/profile/${followerProfile?.username || ''}`,
        read: false,
        createdAt: new Date()
      });
    }

    res.json({ success: true });
  });

  app.post("/api/unfollow", authenticate, async (req: any, res) => {
    if (!db) return res.status(500).json({ error: "DB not connected" });
    const { targetId } = req.body;
    const followerId = req.user.id;
    console.log(`Unfollow request: followerId=${followerId}, targetId=${targetId}`);

    const result = await db.collection("followers").deleteOne({ followerId, targetId });
    if (result.deletedCount > 0) {
      await db.collection("user_profiles").updateOne({ uid: targetId }, { $inc: { followersCount: -1 } });
      await db.collection("user_profiles").updateOne({ uid: followerId }, { $inc: { followingCount: -1 } });
    }

    res.json({ success: true });
  });

  app.get("/api/users/:uid/followers", async (req, res) => {
    if (!db) return res.status(500).json({ error: "DB not connected" });
    try {
      const followers = await db.collection("followers").find({ targetId: req.params.uid }).toArray();
      const followerUids = followers.map(f => f.followerId);
      const users = await db.collection("user_profiles").find({ uid: { $in: followerUids } }).toArray();
      res.json(users.map((u: any) => ({
        uid: u.uid,
        username: u.username,
        displayName: u.displayName,
        photoURL: u.photoURL,
        bio: u.bio
      })));
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch followers" });
    }
  });

  app.get("/api/users/:uid/following", async (req, res) => {
    if (!db) return res.status(500).json({ error: "DB not connected" });
    try {
      const following = await db.collection("followers").find({ followerId: req.params.uid }).toArray();
      const followingUids = following.map(f => f.targetId);
      const users = await db.collection("user_profiles").find({ uid: { $in: followingUids } }).toArray();
      res.json(users.map((u: any) => ({
        uid: u.uid,
        username: u.username,
        displayName: u.displayName,
        photoURL: u.photoURL,
        bio: u.bio
      })));
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch following" });
    }
  });

  app.get("/api/users/:uid/is-following", authenticate, async (req: any, res) => {
    if (!db) return res.status(500).json({ error: "DB not connected" });
    const targetId = req.params.uid;
    const followerId = req.user.id;

    const follow = await db.collection("followers").findOne({ followerId, targetId });
    res.json({ isFollowing: !!follow });
  });

  // Notes
  app.get("/api/notes", authenticate, async (req: any, res) => {
    if (!db) return res.status(500).json({ error: "DB not connected" });
    const notes = await db.collection("notes").find({ userId: req.user.id }).sort({ updatedAt: -1 }).toArray();
    res.json(notes.map((n: any) => ({ ...n, id: n._id.toString() })));
  });

  app.post("/api/notes", authenticate, async (req: any, res) => {
    if (!db) return res.status(500).json({ error: "DB not connected" });
    const note = { ...req.body, userId: req.user.id, updatedAt: new Date() };
    const result = await db.collection("notes").insertOne(note);
    res.json({ ...note, id: result.insertedId });
  });

  app.put("/api/notes/:id", authenticate, async (req: any, res) => {
    if (!db) return res.status(500).json({ error: "DB not connected" });
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
    await db.collection("notes").deleteOne({ _id: new ObjectId(req.params.id), userId: req.user.id });
    res.json({ success: true });
  });

  // Bookmarks
  app.get("/api/bookmarks", authenticate, async (req: any, res) => {
    if (!db) return res.status(500).json({ error: "DB not connected" });
    const bookmarks = await db.collection("bookmarks").find({ userId: req.user.id }).sort({ createdAt: -1 }).toArray();
    res.json(bookmarks.map((b: any) => ({ ...b, id: b._id.toString() })));
  });

  app.post("/api/bookmarks", authenticate, async (req: any, res) => {
    if (!db) return res.status(500).json({ error: "DB not connected" });
    const bookmark = { ...req.body, userId: req.user.id, createdAt: new Date() };
    const result = await db.collection("bookmarks").insertOne(bookmark);
    res.json({ ...bookmark, id: result.insertedId.toString() });
  });

  app.delete("/api/bookmarks/:id", authenticate, async (req: any, res) => {
    if (!db) return res.status(500).json({ error: "DB not connected" });
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
    const { recipientId, text } = req.body;
    const message = { ...req.body, senderId: req.user.id, createdAt: new Date(), read: false };
    const result = await db.collection("messages").insertOne(message);

    // Notify recipient
    if (recipientId !== 'global') {
      const senderProfile = await db.collection("user_profiles").findOne({ uid: req.user.id });
      await db.collection("notifications").insertOne({
        userId: recipientId,
        type: "message",
        title: "New Message",
        message: `You received a new word from ${senderProfile?.displayName || 'someone'}.`,
        link: `/messages?userId=${req.user.id}`,
        read: false,
        createdAt: new Date()
      });
    }

    res.json({ ...message, id: result.insertedId });
  });

  app.delete("/api/messages/:id", authenticate, async (req: any, res) => {
    if (!db) return res.status(500).json({ error: "DB not connected" });
    try {
      const message = await db.collection("messages").findOne({ _id: new ObjectId(req.params.id) });
      if (!message) return res.status(404).json({ error: "Message not found" });
      
      if (message.senderId !== req.user.id && message.recipientId !== req.user.id && req.user.email !== 'kayodeolufowobi709@gmail.com') {
        return res.status(403).json({ error: "Unauthorized" });
      }

      await db.collection("messages").deleteOne({ _id: new ObjectId(req.params.id) });
      res.json({ success: true });
    } catch (error) {
      res.status(400).json({ error: "Invalid ID format" });
    }
  });

  app.put("/api/messages/read/:senderId", authenticate, async (req: any, res) => {
    if (!db) return res.status(500).json({ error: "DB not connected" });
    const { senderId } = req.params;
    try {
      await db.collection("messages").updateMany(
        { senderId, recipientId: req.user.id, read: false },
        { $set: { read: true } }
      );
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to mark messages as read" });
    }
  });

  // Reading Plans
  app.get("/api/reading-plans", authenticate, async (req: any, res) => {
    if (!db) return res.status(500).json({ error: "DB not connected" });
    const plans = await db.collection("reading_plans").find({ userId: req.user.id }).toArray();
    res.json(plans.map((p: any) => ({ ...p, id: p._id.toString() })));
  });

  app.post("/api/reading-plans", authenticate, async (req: any, res) => {
    if (!db) return res.status(500).json({ error: "DB not connected" });
    const plan = { ...req.body, userId: req.user.id, createdAt: new Date() };
    const result = await db.collection("reading_plans").insertOne(plan);
    res.json({ ...plan, id: result.insertedId.toString() });
  });

  app.put("/api/reading-plans/:id", authenticate, async (req: any, res) => {
    if (!db) return res.status(500).json({ error: "DB not connected" });
    const plan = { ...req.body, updatedAt: new Date() };
    delete plan._id;
    await db.collection("reading_plans").updateOne(
      { _id: new ObjectId(req.params.id), userId: req.user.id },
      { $set: plan }
    );
    res.json(plan);
  });

  // Prayer Rooms
  app.get("/api/prayer-rooms", async (req, res) => {
    try {
      if (!db) return res.status(500).json({ error: "DB not connected" });
      const now = new Date();
      const rooms = await db.collection("prayer_rooms").find({
        $or: [
          { expiryDate: { $exists: false } },
          { expiryDate: null },
          { expiryDate: { $gt: now.toISOString() } }
        ]
      }).toArray();
      res.json(rooms.map((r: any) => ({ ...r, id: r._id.toString() })));
    } catch (error) {
      console.error("Error fetching prayer rooms:", error);
      res.status(500).json({ error: "Internal server error while fetching rooms" });
    }
  });

  app.post("/api/prayer-rooms", authenticate, async (req: any, res) => {
    if (!db) return res.status(500).json({ error: "DB not connected" });
    const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    const { name, description, creatorName, startDate, expiryDate } = req.body;
    const room = { 
      name, 
      description, 
      creatorName, 
      startDate: startDate || null, 
      expiryDate: expiryDate || null,
      inviteCode, 
      createdBy: req.user.id, 
      createdAt: new Date() 
    };
    const result = await db.collection("prayer_rooms").insertOne(room);
    res.json({ ...room, id: result.insertedId.toString() });
  });

  app.delete("/api/prayer-rooms/:id", authenticate, async (req: any, res) => {
    if (!db) return res.status(500).json({ error: "DB not connected" });
    try {
      const room = await db.collection("prayer_rooms").findOne({ _id: new ObjectId(req.params.id) });
      
      if (room && (room.createdBy === req.user.id || req.user.email === 'kayodeolufowobi709@gmail.com')) {
        await db.collection("prayer_rooms").deleteOne({ _id: new ObjectId(req.params.id) });
        res.json({ success: true });
      } else {
        res.status(403).json({ error: "Unauthorized" });
      }
    } catch (error) {
      res.status(400).json({ error: "Invalid ID format" });
    }
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

  // Concordance Custom Entries
  app.get("/api/custom-concordance", authenticate, async (req: any, res) => {
    if (!db) return res.status(500).json({ error: "DB not connected" });
    const userId = req.user.id;
    try {
      const entries = await db.collection("custom_concordance").find({ userId }).toArray();
      res.json(entries.map((e: any) => ({ ...e, id: e._id.toString() })));
    } catch (error) {
      console.error("Error fetching custom concordance:", error);
      res.status(500).json({ error: "Failed to fetch custom entries" });
    }
  });

  app.post("/api/custom-concordance", authenticate, async (req: any, res) => {
    if (!db) return res.status(500).json({ error: "DB not connected" });
    const userId = req.user.id;
    try {
      const entry = { ...req.body, userId, createdAt: new Date() };
      const result = await db.collection("custom_concordance").insertOne(entry);
      res.json({ ...entry, id: result.insertedId.toString() });
    } catch (error) {
      console.error("Error saving custom concordance:", error);
      res.status(500).json({ error: "Failed to save custom entry" });
    }
  });

  // Theological Library
  app.get("/api/theology/search", async (req, res) => {
    if (!db) return res.status(500).json({ error: "DB not connected" });
    const { q } = req.query;
    if (!q) return res.json([]);
    const results = await db.collection("theological_library").find({
      $or: [
        { title: { $regex: q, $options: "i" } },
        { author: { $regex: q, $options: "i" } },
        { content: { $regex: q, $options: "i" } }
      ]
    }).limit(20).toArray();
    res.json(results);
  });


  app.get("/api/media/podcasts", async (req, res) => {
    const { url } = req.query;
    if (!url) return res.json([]);
    try {
      const Parser = (await import("rss-parser")).default;
      const parser = new Parser();
      const feed = await parser.parseURL(url as string);
      res.json(feed);
    } catch (error) {
      console.error("Podcast error:", error);
      res.status(500).json({ error: "Failed to fetch podcast feed" });
    }
  });

  // Daily Scripture
  app.get("/api/scripture/daily", async (req, res) => {
    if (!db) return res.status(500).json({ error: "DB not connected" });
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    
    const cached = await db.collection("daily_scripture").findOne({ date: dateStr });
    if (cached) return res.json(cached.scripture);

    // Fetch new one using Gemini - REMOVED from backend to follow "NEVER call Gemini API from the backend" rule
    // The frontend will now handle generation if the backend returns null
    res.json(null);
  });

  app.post("/api/scripture/daily", async (req, res) => {
    if (!db) return res.status(500).json({ error: "DB not connected" });
    const { scripture } = req.body;
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    
    if (scripture && scripture.reference) {
      await db.collection("daily_scripture").updateOne(
        { date: dateStr },
        { $set: { date: dateStr, scripture } },
        { upsert: true }
      );
      return res.json({ success: true });
    }
    res.status(400).json({ error: "Invalid scripture data" });
  });


  // Global Search
  app.get("/api/search/global", authenticate, async (req: any, res) => {
    if (!db) return res.status(500).json({ error: "DB not connected" });
    const { q } = req.query;
    const userId = req.user.id;

    if (!q || typeof q !== 'string') {
      return res.status(400).json({ error: "Query parameter 'q' is required" });
    }

    try {
      const searchRegex = new RegExp(q, 'i');

      // Search Users
      const users = await db.collection("user_profiles").find({
        $or: [
          { username: searchRegex },
          { full_name: searchRegex }
        ]
      }).limit(5).toArray();

      // Search Notes
      const notes = await db.collection("notes").find({
        userId,
        $or: [
          { title: searchRegex },
          { content: searchRegex }
        ]
      }).limit(5).toArray();

      // Search Bookmarks
      const bookmarks = await db.collection("bookmarks").find({
        userId,
        $or: [
          { verseRef: searchRegex },
          { text: searchRegex }
        ]
      }).limit(5).toArray();

      // Search Topics (from our static list)
      const topics = TOPICS_LIST.filter(t => 
        t.name.toLowerCase().includes(q.toLowerCase()) || 
        t.description.toLowerCase().includes(q.toLowerCase())
      ).slice(0, 5);

      res.json({
        users: users.map(u => ({ id: u.uid, name: u.full_name || u.username, type: 'user', username: u.username })),
        notes: notes.map(n => ({ id: n._id, name: n.title || 'Untitled Note', type: 'note' })),
        bookmarks: bookmarks.map(b => ({ id: b._id, name: b.verseRef, type: 'bookmark', text: b.text })),
        topics: topics.map(t => ({ id: t.id, name: t.name, type: 'topic' }))
      });
    } catch (error) {
      console.error("Error performing global search:", error);
      res.status(500).json({ error: "Failed to perform search" });
    }
  });

  // User Activity Tracking
  app.post("/api/user/activity", authenticate, async (req: any, res) => {
    if (!db) return res.status(500).json({ error: "DB not connected" });
    const { type, metadata } = req.body;
    const userId = req.user.id;

    try {
      await db.collection("user_activity").insertOne({
        userId,
        type, // 'bible_read', 'topic_explore', 'prayer_post', 'prayer_react', 'testimony_share', 'note_create'
        metadata,
        createdAt: new Date()
      });

      // Update user stats
      const update: any = { $inc: {} };
      if (type === 'bible_read') update.$inc.bibleReadCount = 1;
      if (type === 'topic_explore') update.$inc.topicExploreCount = 1;
      if (type === 'prayer_post') update.$inc.prayerPostCount = 1;
      if (type === 'prayer_react') update.$inc.prayerReactCount = 1;
      if (type === 'testimony_share') update.$inc.testimonyShareCount = 1;
      if (type === 'note_create') update.$inc.noteCreateCount = 1;

      await db.collection("user_stats").updateOne(
        { userId },
        { 
          ...update,
          $set: { lastActivityAt: new Date() },
          $setOnInsert: { createdAt: new Date() }
        },
        { upsert: true }
      );

      res.json({ success: true });
    } catch (error) {
      console.error("Error tracking activity:", error);
      res.status(500).json({ error: "Failed to track activity" });
    }
  });

  app.get("/api/user/activity", authenticate, async (req: any, res) => {
    if (!db) return res.status(500).json({ error: "DB not connected" });
    const userId = req.user.id;

    try {
      const activities = await db.collection("user_activity")
        .find({ userId })
        .sort({ createdAt: -1 })
        .limit(20)
        .toArray();
      res.json(activities);
    } catch (error) {
      console.error("Error fetching activity:", error);
      res.status(500).json({ error: "Failed to fetch activity" });
    }
  });

  app.get("/api/dashboard/stats", authenticate, async (req: any, res) => {
    if (!db) return res.status(500).json({ error: "DB not connected" });
    const userId = req.user.id;

    try {
      const stats = await db.collection("user_stats").findOne({ userId });
      const prayers = await db.collection("prayer_requests").countDocuments({ userId });
      const posts = await db.collection("forum_posts").countDocuments({ authorUid: userId });
      const testimonies = await db.collection("testimonies").countDocuments({ authorUid: userId });
      const bookmarks = await db.collection("bookmarks").countDocuments({ userId });
      const notes = await db.collection("notes").countDocuments({ userId });
      const studyJourneys = await db.collection("study_journeys").countDocuments({ userId });

      res.json({
        prayers,
        posts,
        testimonies,
        bookmarks,
        notes,
        studyJourneys,
        bibleReadCount: stats?.bibleReadCount || 0,
        topicExploreCount: stats?.topicExploreCount || 0,
        streak: 7, // Mock streak for now
      });
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
      res.status(500).json({ error: "Failed to fetch stats" });
    }
  });

  app.get("/api/milestones", authenticate, async (req: any, res) => {
    if (!db) return res.status(500).json({ error: "DB not connected" });
    const userId = req.user.id;

    try {
      const stats = await db.collection("user_stats").findOne({ userId });
      const bookmarks = await db.collection("bookmarks").countDocuments({ userId });
      const prayers = await db.collection("prayer_requests").countDocuments({ userId });

      const milestones = [
        { 
          id: 'seeker_of_wisdom',
          title: "Seeker of Wisdom", 
          desc: "Read the Bible 7 times.", 
          icon: "Award", 
          achieved: (stats?.bibleReadCount || 0) >= 7 
        },
        { 
          id: 'heart_of_worship',
          title: "Heart of Worship", 
          desc: "Explored 5 different topics.", 
          icon: "Activity", 
          achieved: (stats?.topicExploreCount || 0) >= 5 
        },
        { 
          id: 'gospel_explorer',
          title: "Gospel Explorer", 
          desc: "Bookmarked 10 verses.", 
          icon: "TrendingUp", 
          achieved: bookmarks >= 10 
        },
        { 
          id: 'intercessor',
          title: "Intercessor", 
          desc: "Posted 5 prayer requests.", 
          icon: "Heart", 
          achieved: prayers >= 5 
        },
      ];

      res.json(milestones);
    } catch (error) {
      console.error("Error fetching milestones:", error);
      res.status(500).json({ error: "Failed to fetch milestones" });
    }
  });

  // Notifications
  app.get("/api/notifications", authenticate, async (req: any, res) => {
    if (!db) return res.status(500).json({ error: "DB not connected" });
    try {
      const notifications = await db.collection("notifications").find({ userId: req.user.id }).sort({ createdAt: -1 }).toArray();
      res.json(notifications.map((n: any) => ({ ...n, id: n._id.toString() })));
    } catch (error) {
      console.error("Error fetching notifications:", error);
      res.status(500).json({ error: "Failed to fetch notifications" });
    }
  });

  app.post("/api/notifications/:id/read", authenticate, async (req: any, res) => {
    if (!db) return res.status(500).json({ error: "DB not connected" });
    try {
      await db.collection("notifications").updateOne(
        { _id: new ObjectId(req.params.id), userId: req.user.id },
        { $set: { read: true } }
      );
      res.json({ success: true });
    } catch (error) {
      res.status(400).json({ error: "Invalid ID format" });
    }
  });

  // Forum Messages
app.get("/api/forum/messages", async (req, res) => {
  if (!db) return res.status(500).json({ error: "DB not connected" });
  try {
    const messages = await db.collection("forum_messages").find().sort({ createdAt: 1 }).limit(100).toArray();
    res.json(messages.map((m: any) => ({
      id: m._id.toString(),
      text: m.text,
      senderId: m.senderId,
      senderName: m.senderName,
      createdAt: m.createdAt
    })));
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch forum messages" });
  }
});

app.post("/api/forum/messages", authenticate, async (req: any, res) => {
  if (!db) return res.status(500).json({ error: "DB not connected" });
  try {
    const { text, senderName } = req.body;
    const senderId = req.user.id;
    
    if (!text || !senderId) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const message = {
      text,
      senderId,
      senderName: senderName || req.user.user_metadata?.full_name || req.user.email?.split('@')[0] || 'User',
      createdAt: new Date()
    };

    const result = await db.collection("forum_messages").insertOne(message);
    res.status(201).json({
      id: result.insertedId.toString(),
      ...message
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to send forum message" });
  }
});

app.delete("/api/forum/messages/:id", authenticate, async (req: any, res) => {
  if (!db) return res.status(500).json({ error: "DB not connected" });
  try {
    const message = await db.collection("forum_messages").findOne({ _id: new ObjectId(req.params.id) });
    if (!message) return res.status(404).json({ error: "Message not found" });

    const isAdmin = req.user.email === 'kayodeolufowobi709@gmail.com';
    if (message.senderId !== req.user.id && !isAdmin) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    await db.collection("forum_messages").deleteOne({ _id: new ObjectId(req.params.id) });
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: "Invalid message ID" });
  }
});


  // User Specific Content for Profile
  app.get("/api/forum-posts/user/:uid", async (req, res) => {
    if (!db) return res.status(500).json({ error: "DB not connected" });
    const posts = await db.collection("forum_posts").find({ authorUid: req.params.uid }).sort({ createdAt: -1 }).toArray();
    res.json(posts.map((p: any) => ({ ...p, id: p._id.toString() })));
  });

  app.get("/api/prayer-requests/user/:uid", async (req, res) => {
    if (!db) return res.status(500).json({ error: "DB not connected" });
    const prayers = await db.collection("prayer_requests").find({ authorUid: req.params.uid }).sort({ createdAt: -1 }).toArray();
    res.json(prayers.map((p: any) => ({ ...p, id: p._id.toString() })));
  });

  app.get("/api/testimonies/user/:uid", async (req, res) => {
    if (!db) return res.status(500).json({ error: "DB not connected" });
    const testimonies = await db.collection("testimonies").find({ authorUid: req.params.uid }).sort({ createdAt: -1 }).toArray();
    res.json(testimonies.map((t: any) => ({ ...t, id: t._id.toString() })));
  });

  // Theological Library
  app.get("/api/library", async (req, res) => {
    if (!db) return res.status(500).json({ error: "DB not connected" });
    const works = await db.collection("theological_library").find().toArray();
    res.json(works);
  });

  app.get("/api/library/:id", async (req, res) => {
    if (!db) return res.status(500).json({ error: "DB not connected" });
    try {
      const work = await db.collection("theological_library").findOne({ _id: new ObjectId(req.params.id) });
      res.json(work);
    } catch (error) {
      res.status(400).json({ error: "Invalid ID format" });
    }
  });

  app.post("/api/milestones", authenticate, async (req: any, res) => {
    if (!db) return res.status(500).json({ error: "DB not connected" });
    const milestone = { ...req.body, userId: req.user.id, createdAt: new Date() };
    await db.collection("milestones").insertOne(milestone);
    res.json(milestone);
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

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
