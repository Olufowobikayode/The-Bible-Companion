import { generateAIResponse } from './gemini';

// Layer 1: Static Shield (Basic Profanity/Spam Filter)
const FORBIDDEN_WORDS = [
  'spam', 'scam', 'click here', 'buy now', 'crypto', 'bitcoin',
  // Add more as needed, keeping it simple for now
];

export async function moderateContent(content: string): Promise<{ isApproved: boolean; reason?: string }> {
  // Layer 1 Check
  const lowerContent = content.toLowerCase();
  for (const word of FORBIDDEN_WORDS) {
    if (lowerContent.includes(word)) {
      return { isApproved: false, reason: 'Content contains forbidden words or spam.' };
    }
  }

  // Layer 2: AI Guardian (Groq via Server)
  try {
    const res = await fetch('/api/ai/moderate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ postContent: content })
    });
    
    const result = await res.json();
    return {
      isApproved: result.allowed,
      reason: result.reason
    };
  } catch (error) {
    console.error("Error in AI moderation:", error);
    // If AI fails, fallback to Layer 1 result (which passed)
    return { isApproved: true };
  }
}
