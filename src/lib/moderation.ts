import { callGemini, Type, safeParseJSON } from './gemini';

// Layer 1: Static Shield (Basic Profanity/Spam Filter)
const FORBIDDEN_WORDS = [
  'spam', 'scam', 'click here', 'buy now', 'crypto', 'bitcoin',
  'offensive', 'fuck', 'shit', 'asshole', 'bitch', 'cunt', 'nigger', 'faggot', 'retard',
  'http', 'https', 'www'
];

export async function moderateContent(content: string): Promise<{ isApproved: boolean; reason?: string }> {
  // Layer 1 Check
  const lowerContent = content.toLowerCase();
  for (const word of FORBIDDEN_WORDS) {
    if (lowerContent.includes(word)) {
      return { isApproved: false, reason: 'Layer 1: Forbidden content or spam detected.' };
    }
  }

  // Layer 2: AI Guardian (Gemini via Frontend)
  try {
    const systemInstruction = `You are a helpful and wise Christian AI Guardian. 
    Your task is to moderate user-generated content for a Christian platform called VISION.
    
    Be respectful and calm. 
    ONLY block content that is:
    - Genuinely hateful or harassing towards PEOPLE (not spiritual entities like Satan or demons).
    - Explicitly sexual or pornographic.
    - Promoting self-harm or violence against humans.
    - Blatant spam.
    - Promoting unsafe or cult-like theology that contradicts basic Christian tenets.
    
    DO NOT block:
    - Expressions of spiritual warfare or dislike of evil entities (e.g., "I hate Satan", "Demons are evil").
    - Honest questions about faith or doubt.
    - Respectful disagreements.
    - General frustration expressed in a non-hateful way.
    
    Return a JSON object: { "allowed": boolean, "reason": string | null }.`;

    const response = await callGemini({
      model: "gemini-3-flash-preview",
      contents: content,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            allowed: { type: Type.BOOLEAN, description: "Whether the post is allowed" },
            reason: { type: Type.STRING, description: "Reason for the decision" }
          },
          required: ["allowed", "reason"]
        }
      }
    });

    const result = safeParseJSON(response, { allowed: false, reason: "Moderation service returned invalid format." });
    
    return {
      isApproved: result.allowed,
      reason: result.reason
    };
  } catch (error) {
    console.error("Error in AI moderation:", error);
    // If AI fails, be safe and block content to prevent bypass
    return { isApproved: false, reason: 'Moderation service temporarily unavailable. Please try again later.' };
  }
}
