import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI } from "@google/genai";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // AI Agent Backend Logic
  if (!process.env.GEMINI_API_KEY) {
    console.error("GEMINI_API_KEY is not set!");
  } else {
    console.log("GEMINI_API_KEY is set, length:", process.env.GEMINI_API_KEY.length);
    console.log("GEMINI_API_KEY starts with:", process.env.GEMINI_API_KEY.substring(0, 5));
  }
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

  app.post("/api/ai/moderate", async (req, res) => {
    const { postContent } = req.body;

    try {
      // Content Moderation
      const response = await ai.models.generateContent({
        model: "gemini-3.1-flash-lite-preview",
        contents: `Analyze the following post for hate speech, harassment, or prohibited content.
        Post: ${postContent}
        Return ONLY a JSON object: { "allowed": boolean, "reason": string }`,
        config: { responseMimeType: "application/json" }
      });

      let result;
      try {
        const jsonStr = response.text!.replace(/```json|```/g, '').trim();
        result = JSON.parse(jsonStr);
      } catch (e) {
        console.error("Failed to parse moderation JSON:", e);
        result = { allowed: true, reason: "Moderation failed to parse response." };
      }
      res.json(result);
    } catch (error: any) {
      console.error("Moderation error:", error);
      // Default to allowed if moderation fails to ensure app functionality
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
