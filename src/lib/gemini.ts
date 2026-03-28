import { GoogleGenAI, ThinkingLevel, Modality, GenerateContentParameters, Type } from "@google/genai";
export { Type };
import { db_local } from "./db";

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error("[Gemini] GEMINI_API_KEY is missing. Please set it in the environment.");
}
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

export const safeParseJSON = (text: string, fallback: any = null) => {
  try {
    // Strip markdown code blocks if present
    const cleaned = text.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim();
    return JSON.parse(cleaned);
  } catch (e) {
    console.error("[Gemini] Failed to parse JSON:", e, "Raw text:", text);
    return fallback;
  }
};

const withRetry = async <T>(fn: () => Promise<T>, maxRetries = 5, initialDelay = 2000): Promise<T> => {
  let retries = 0;
  while (true) {
    try {
      return await fn();
    } catch (error: any) {
      const errorObj = error?.error || error;
      const isRateLimit = errorObj?.code === 429 || errorObj?.status === 429 || error?.status === 429;
      
      if (isRateLimit && retries < maxRetries) {
        const delay = initialDelay * Math.pow(2, retries);
        console.warn(`Rate limit hit (429). Retrying in ${delay}ms... (Attempt ${retries + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        retries++;
        continue;
      }
      throw error;
    }
  }
};

export const callGemini = async (params: GenerateContentParameters, useCache = true): Promise<string> => {
  if (!ai) {
    throw new Error("Gemini API key is not configured.");
  }
  const model = params.model || "gemini-3.1-flash-lite-preview";
  const cacheKey = `${model}:${JSON.stringify(params.contents)}`;

  if (useCache) {
    const cached = await db_local.gemini_cache.get(cacheKey);
    if (cached && Date.now() - cached.updatedAt < 1000 * 60 * 60 * 24) { // 24h cache
      console.log(`[Gemini] Cache hit for ${model}`);
      return cached.response;
    }
  }

  const start = Date.now();
  console.log(`[Gemini] Calling ${model}...`);
  
  try {
    const response = await withRetry(() => ai.models.generateContent({ ...params, model }));
    
    const duration = Date.now() - start;
    console.log(`[Gemini] Call to ${model} took ${duration}ms`);

    if (useCache && response.text) {
      await db_local.gemini_cache.put({ key: cacheKey, response: response.text, updatedAt: Date.now() });
    }

    return response.text || "";
  } catch (error: any) {
    const isApiKeyError = error?.message?.includes("API key not valid") || 
                         error?.message?.includes("API_KEY_INVALID") ||
                         error?.status === 400;
    if (isApiKeyError) {
      console.warn(`[Gemini] API Key is invalid or account suspended. Bypassing ${model}.`);
      // Return a helpful fallback message instead of empty string for text tasks
      const contentStr = JSON.stringify(params.contents).toLowerCase();
      if (contentStr.includes('insight')) {
        return "Theological insights are currently unavailable due to API configuration. Please check the settings.";
      }
      return ""; 
    }
    console.error(`[Gemini] Error calling ${model}:`, error);
    throw error;
  }
};
export const callGeminiStream = async function* (params: GenerateContentParameters): AsyncGenerator<string> {
  if (!ai) {
    throw new Error("Gemini API key is not configured.");
  }
  const model = params.model || "gemini-3.1-flash-lite-preview";
  console.log(`[Gemini] Streaming from ${model}...`);
  
  try {
    const responseStream = await withRetry(() => ai.models.generateContentStream({ ...params, model }));
    
    for await (const chunk of responseStream) {
      if (chunk.text) {
        yield chunk.text;
      }
    }
  } catch (error: any) {
    const isApiKeyError = error?.message?.includes("API key not valid") || 
                         error?.message?.includes("API_KEY_INVALID") ||
                         error?.status === 400;
    if (isApiKeyError) {
      console.warn(`[Gemini] API Key is invalid or account suspended. Bypassing ${model} stream.`);
      yield "I'm currently having some technical difficulties, but I'll be back soon!";
      return;
    }
    console.error(`[Gemini] Error streaming from ${model}:`, error);
    throw error;
  }
};
export const getGeminiFlash = () => new GoogleGenAI({ apiKey }).models.get({ model: "gemini-3.1-flash-lite-preview" });
export const getGeminiFlashLite = () => new GoogleGenAI({ apiKey }).models.get({ model: "gemini-3.1-flash-lite-preview" });

export const generateEmotionResponse = async (emotion: string): Promise<string> => {
  return await callGemini({
    model: "gemini-3.1-flash-lite-preview",
    contents: `User feels: "${emotion}". Provide: 3-5 Bible verses, a short reflection, and encouragement.`,
    config: { 
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          verses: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                reference: { type: Type.STRING },
                text: { type: Type.STRING }
              },
              required: ["reference", "text"]
            }
          },
          reflection: { type: Type.STRING },
          encouragement: { type: Type.STRING }
        },
        required: ["verses", "reflection", "encouragement"]
      }
    }
  });
};

export const askBibleQuestion = async (question: string, mode: 'devotional' | 'scholarly' = 'devotional'): Promise<string> => {
  return await callGemini({
    model: "gemini-3.1-pro-preview",
    contents: question,
    config: {
      systemInstruction: mode === 'scholarly' 
        ? "You are a wise and humble Rabbi, a teacher of the Word. Deep, rigorous, biblically grounded. You speak with deep reverence for Scripture, drawing from the richness of the Hebrew and Greek texts and historical context. Professional, objective, insightful. Use Search Grounding. ONLY draw from biblical texts and classic orthodox Christian literature."
        : "You are a wise and humble Rabbi, a teacher of the Word. Wise, compassionate, biblically grounded. You speak with the authority of the Word and a heart of service. Canonical and non-canonical (Enoch, Jasher, etc.). Distinguish between them. Gentle, encouraging tone. References required. ONLY draw from biblical texts and classic orthodox Christian literature.",
      thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
      tools: [{ googleSearch: {} }]
    }
  });
};

export const askBibleQuestionStream = async function* (question: string, mode: 'devotional' | 'scholarly' = 'devotional', userContext?: string): AsyncGenerator<string> {
  const prompt = userContext 
    ? `User Context (Saved Notes/Bookmarks):\n${userContext}\n\nQuestion: ${question}`
    : question;

  const stream = callGeminiStream({
    model: "gemini-3.1-pro-preview",
    contents: prompt,
    config: {
      systemInstruction: mode === 'scholarly' 
        ? "You are a wise and humble Rabbi, a teacher of the Word. Deep, rigorous, biblically grounded. You speak with deep reverence for Scripture, drawing from the richness of the Hebrew and Greek texts and historical context. Professional, objective, insightful. Use Search Grounding. ONLY draw from biblical texts and classic orthodox Christian literature. Reference the user's saved context where relevant."
        : "You are a wise and humble Rabbi, a teacher of the Word. Wise, compassionate, biblically grounded. You speak with the authority of the Word and a heart of service. Canonical and non-canonical (Enoch, Jasher, etc.). Distinguish between them. Gentle, encouraging tone. References required. ONLY draw from biblical texts and classic orthodox Christian literature. Reference the user's saved context where relevant.",
      thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
      tools: [{ googleSearch: {} }]
    }
  });

  for await (const chunk of stream) {
    yield chunk;
  }
};

export const getGuidedStudyJourney = async (theme: string): Promise<{ title: string, description: string, steps: string[] }> => {
  try {
    const response = await callGemini({
      model: "gemini-3.1-pro-preview",
      contents: `Create a guided study journey for the theme: "${theme}".`,
      config: {
        systemInstruction: "You are a wise and humble Rabbi, a teacher of the Word. Create a structured study journey with title, description, and actionable steps.",
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            description: { type: Type.STRING },
            steps: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          },
          required: ["title", "description", "steps"]
        }
      }
    });

    const parsed = safeParseJSON(response);
    if (!parsed) throw new Error("Invalid JSON response from AI");
    return parsed;
  } catch (error: any) {
    console.error("[Gemini] Error generating study journey:", error);
    return {
      title: "Study Journey Unavailable",
      description: "I'm currently having some technical difficulties, but I'll be back soon!",
      steps: ["Please check back later."]
    };
  }
};

export const getTopicVerses = async (topic: string): Promise<string[]> => {
  const response = await callGemini({
    model: "gemini-3-flash-preview",
    contents: `Provide 5 Bible verse references for the topic: "${topic}".`,
    config: { 
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: { type: Type.STRING }
      }
    },
  });
  return safeParseJSON(response, []);
};

export const getNewsTopic = async (latitude: number, longitude: number): Promise<{ name: string, description: string }> => {
  const response = await callGemini({
    model: "gemini-3-flash-preview",
    contents: `Get the top news headlines for location ${latitude}, ${longitude}. Based on these, suggest a theological topic. Return ONLY a JSON object with 'name' and 'description' fields.`,
    config: {
      tools: [{ googleSearch: {} }]
    },
  });
  
  // Extract JSON from markdown if present
  let jsonStr = response;
  if (jsonStr.includes('```json')) {
    jsonStr = jsonStr.split('```json')[1].split('```')[0].trim();
  } else if (jsonStr.includes('```')) {
    jsonStr = jsonStr.split('```')[1].split('```')[0].trim();
  }
  
  return safeParseJSON(jsonStr, { name: "Peace", description: "Finding calm in the midst of the storm." });
};

export const getConcordanceEntry = async (term: string): Promise<any> => {
  try {
    const res = await fetch(`/api/theology/search?q=${encodeURIComponent(term)}`);
    if (res.ok) {
      const data = await res.json();
      if (data && data.length > 0) {
        return data[0]; // Return the first matching entry
      }
    }
  } catch (error) {
    console.error("[Theology Search] Error:", error);
  }

  // Fallback to Gemini if API fails or no results
  const response = await callGemini({
    model: "gemini-3-flash-preview",
    contents: `Provide a detailed concordance entry for the biblical word or concept: "${term}".`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          word: { type: Type.STRING },
          original: { type: Type.STRING },
          transliteration: { type: Type.STRING },
          language: { type: Type.STRING, enum: ["Hebrew", "Greek"] },
          definition: { type: Type.STRING },
          usage: { type: Type.ARRAY, items: { type: Type.STRING } },
          etymology: { type: Type.STRING }
        },
        required: ["word", "original", "transliteration", "language", "definition", "usage", "etymology"]
      }
    },
  });
  return safeParseJSON(response);
};

export const getDetailedOriginalScript = async (term: string, original: string, language: string): Promise<any> => {
  const response = await callGemini({
    model: "gemini-3.1-pro-preview",
    contents: `Provide a deep, scholarly morphological and grammatical analysis of the biblical ${language} word "${original}" (translated as "${term}"). Include its root, tense/voice/mood (if applicable), historical context of its usage in antiquity, and theological nuances that are often lost in translation.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          morphology: { type: Type.STRING },
          rootAnalysis: { type: Type.STRING },
          historicalContext: { type: Type.STRING },
          theologicalNuance: { type: Type.STRING }
        },
        required: ["morphology", "rootAnalysis", "historicalContext", "theologicalNuance"]
      }
    },
  });
  return safeParseJSON(response);
};

export const getOriginalText = async (verseRef: string, detailed: boolean): Promise<any> => {
  if (!detailed) {
    const response = await callGemini({
      model: "gemini-3-flash-preview",
      contents: `Provide the original Hebrew (for OT) or Greek (for NT) text for ${verseRef}. Just the original script.`,
    });
    return { original: response.trim() };
  }

  const response = await callGemini({
    model: "gemini-3-flash-preview",
    contents: `Provide the original Hebrew (for OT) or Greek (for NT) text for ${verseRef}.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          original: { type: Type.STRING },
          transliteration: { type: Type.STRING },
          definition: { type: Type.STRING }
        },
        required: ["original", "transliteration", "definition"]
      }
    },
  });
  return safeParseJSON(response);
};

export const getCrossReferences = async (verseRef: string, verseText: string): Promise<any[]> => {
  const response = await callGemini({
    model: "gemini-3-flash-preview",
    contents: `Find 2-3 highly relevant cross-references for the Bible verse ${verseRef} ("${verseText}").`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            reference: { type: Type.STRING },
            reason: { type: Type.STRING }
          },
          required: ["reference", "reason"]
        }
      }
    },
  });
  return safeParseJSON(response, []);
};

export const getExtraBookChapter = async (book: string, chapter: number, translation: string): Promise<any> => {
  const response = await callGemini({
    model: "gemini-3-flash-preview",
    contents: `Provide the full text for ${book} chapter ${chapter} in the ${translation} translation.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          reference: { type: Type.STRING },
          verses: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                verse: { type: Type.INTEGER },
                text: { type: Type.STRING }
              },
              required: ["verse", "text"]
            }
          }
        },
        required: ["reference", "verses"]
      }
    },
  });
  return safeParseJSON(response);
};

export const generateSpeech = async (text: string) => {
  const ai = new GoogleGenAI({ apiKey });
  try {
    const response = await withRetry(() => ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' },
          },
        },
      },
    }));

    return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  } catch (error: any) {
    console.error("[Gemini] Error generating speech:", error);
    return null;
  }
};

export const transcribeAudio = async (base64Audio: string) => {
  const ai = new GoogleGenAI({ apiKey });
  try {
    const response = await withRetry(() => ai.models.generateContent({
      model: "gemini-3.1-flash-lite-preview",
      contents: {
        parts: [
          { inlineData: { data: base64Audio, mimeType: "audio/wav" } },
          { text: "Transcribe this audio exactly." }
        ]
      }
    }));
    return response.text;
  } catch (error: any) {
    console.error("[Gemini] Error transcribing audio:", error);
    return "Transcription unavailable due to configuration issue.";
  }
};

export const performSemanticSearch = async (query: string, context?: string): Promise<any> => {
  const ai = new GoogleGenAI({ apiKey });
  const prompt = context 
    ? `Given the following chapter text:
    "${context}"
    
    And the user's conceptual query:
    "${query}"
    
    Identify the verse numbers (1-indexed) that are most relevant to the conceptual query.
    Return ONLY a JSON array of numbers, e.g., [1, 5, 12].`
    : `Identify 10 Bible verses (Book Chapter:Verse) that most closely relate to the concept or topic: "${query}". 
    Also provide a brief theological insight (2-3 sentences) on why these verses are relevant and list 3-5 related themes.
    
    Return the response in the following JSON format:
    {
      "verses": ["John 3:16", "Romans 5:8", ...],
      "insight": "...",
      "themes": ["Love", "Sacrifice", ...]
    }`;

  const response = await withRetry(() => ai.models.generateContent({
    model: "gemini-3.1-pro-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      systemInstruction: "You are a wise and humble Rabbi, a teacher of the Word. You are a semantic search engine for the Bible. You excel at mapping conceptual queries to specific verses with divine precision."
    }
  }));
  
  try {
    return JSON.parse(response.text || (context ? '[]' : '{}'));
  } catch (e) {
    console.error("Failed to parse semantic search results", e);
    return context ? [] : { verses: [], insight: "", themes: [] };
  }
};

export const generateAIResponse = async (prompt: string): Promise<string> => {
  return await callGemini({
    model: "gemini-3-flash-preview",
    contents: prompt,
  });
};

export const getScriptureContext = async (verseRef: string, verseText: string): Promise<string> => {
  return await callGemini({
    model: "gemini-3.1-pro-preview",
    contents: `Provide deep historical, cultural, and theological context for the verse ${verseRef}: "${verseText}". 
    Explain the original audience, the author's intent, and how it fits into the broader biblical narrative.`,
    config: {
      systemInstruction: "You are a wise and humble Rabbi, a teacher of the Word. Provide deep, scholarly, and spiritually rich context that reflects the Creator's heart.",
      thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
      tools: [{ googleSearch: {} }]
    }
  });
};

export const generatePersonalDevotional = async (userInterests: string[], recentActivity: string): Promise<string> => {
  return await callGemini({
    model: "gemini-3.1-pro-preview",
    contents: `Create a deeply personal, structured daily devotional based on the following:
    User Interests: ${userInterests.join(', ')}
    Recent Activity: ${recentActivity}
    
    You MUST use the Tri-Fold framework (Analyze, Apply, Inspire) and format the devotional exactly like this:

    # [Catchy, Thematic Title]
    
    **Central Scripture:** [Full Bible Verse - Translation]
    
    ### Analyze (The Word)
    [2-3 paragraphs of deep, scholarly yet accessible theological reflection on the verse. Provide historical or cultural context. What does the text actually mean?]
    
    ### Apply (The Walk)
    [2 paragraphs connecting the ancient text to the user's modern life, interests, and recent activity. How does this change how they live today?]
    
    ### Inspire (The Worship)
    [A short, poetic, and uplifting thought that turns the user's heart toward God in awe and gratitude.]
    
    **Prayer:**
    [A heartfelt, 3-4 sentence prayer rooted in the scripture.]
    
    **Peace Challenge:**
    [One actionable, simple step the user can take today to live out this truth.]`,
    config: {
      systemInstruction: "You are a wise, humble, and deeply theological Christian teacher. Create a structured, profound, and encouraging devotional.",
      thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH }
    }
  });
};

export const analyzeNote = async (noteContent: string): Promise<any> => {
  const response = await callGemini({
    model: "gemini-3-flash-preview",
    contents: `Analyze the following spiritual note/journal entry and provide: 
    1. A concise summary.
    2. 3-5 related Bible verses with references and full text.
    3. Deep theological insights or practical applications.
    4. 3-5 thematic tags (e.g., "Faith", "Trial", "Grace").
    5. 2-3 practical action steps or reflections for the user.
    6. A brief assessment of the spiritual tone/mood (e.g., "Contemplative", "Seeking", "Joyful").
    
    Note: "${noteContent}"`,
    config: {
      systemInstruction: "You are a wise and humble Rabbi, a teacher of the Word. Analyze user notes with divine insight, mapping them to the Creator's heart and the Word.",
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          summary: { type: Type.STRING },
          verses: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                reference: { type: Type.STRING },
                text: { type: Type.STRING }
              },
              required: ["reference", "text"]
            }
          },
          insights: { type: Type.STRING },
          tags: { type: Type.ARRAY, items: { type: Type.STRING } },
          actionSteps: { type: Type.ARRAY, items: { type: Type.STRING } },
          tone: { type: Type.STRING }
        },
        required: ["summary", "verses", "insights", "tags", "actionSteps", "tone"]
      }
    },
  });
  return safeParseJSON(response);
};

export const generatePrayerCompanion = async (request: string): Promise<string> => {
  return await callGemini({
    model: "gemini-3.1-pro-preview",
    contents: `Draft a prayer rooted in Scripture for the following request: "${request}". 
    Include relevant Bible verses that support the prayer's themes.`,
    config: {
      systemInstruction: "You are a wise and humble Rabbi, a teacher of the Word. Draft prayers that are deeply scriptural, compassionate, and authoritative. Speak as one who knows the Father's heart.",
      thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH }
    }
  });
};

export const summarizeForumThread = async (posts: { author: string, content: string }[]): Promise<string> => {
  const threadText = posts.map(p => `${p.author}: ${p.content}`).join('\n\n');
  return await callGemini({
    model: "gemini-3-flash-preview",
    contents: `Summarize the following forum thread and identify common questions or themes:\n\n${threadText}`,
    config: {
      systemInstruction: "You are a wise and humble Rabbi, a teacher of the Word. Summarize community discussions with clarity, identifying the core spiritual needs and theological questions being raised."
    }
  });
};

export const chatWithNotesStream = async function* (query: string, notes: { title: string, content: string }[]): AsyncGenerator<string> {
  const notesContext = notes.map(n => `Note: ${n.title}\nContent: ${n.content}`).join('\n---\n');
  const stream = callGeminiStream({
    model: "gemini-3.1-pro-preview",
    contents: `Based on my spiritual notes below, let's have a theological dialogue about my growth.
    
    My Notes:
    ${notesContext}
    
    My Question/Thought:
    "${query}"`,
    config: {
      systemInstruction: "You are a wise and humble Rabbi, a teacher of the Word. Engage in a deep, actionable theological dialogue based on the user's personal spiritual reflections. Guide them toward the Creator's purpose.",
      thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH }
    }
  });

  for await (const chunk of stream) {
    yield chunk;
  }
};
