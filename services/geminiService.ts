
import { GoogleGenAI, Type, Schema } from "@google/genai";

// Lazily create the client so missing env vars don't crash render
const resolveApiKey = () => {
  const metaEnv = typeof import.meta !== 'undefined' ? (import.meta as any).env : undefined;
  return (
    metaEnv?.VITE_GEMINI_API_KEY ||
    metaEnv?.GEMINI_API_KEY ||
    metaEnv?.API_KEY ||
    (typeof process !== 'undefined' && process.env ? process.env.GEMINI_API_KEY || process.env.API_KEY : undefined)
  );
};

let ai: GoogleGenAI | null = null;
const getClient = () => {
  if (ai) return ai;

  const apiKey = resolveApiKey();
  if (!apiKey) {
    throw new Error("Missing Gemini API key. Set VITE_GEMINI_API_KEY or GEMINI_API_KEY in your environment.");
  }

  ai = new GoogleGenAI({ apiKey });
  return ai;
};

// --- Type Definitions ---

export type AspectRatio = '1:1' | '16:9' | '9:16' | '3:4' | '4:5';

export interface BannerRequest {
  userPrompt: string;
  aspectRatio: AspectRatio;
  hasBackgroundImage?: boolean;
  hasAssetImage?: boolean;
}

export interface BannerPlan {
  main_banner: {
    headline: string;
    subheadline: string;
    image_prompt: string;
    description: string;
    cta: string;
  };
  additional_banners: {
    title: string;
    subtitle: string;
    image_prompt: string;
    description: string;
    cta: string;
  }[];
  seo: {
    caption: string;
    hashtags: string[];
    keywords: string[];
  };
}

// --- Banner Plan Generation (Text) ---

const BANNER_SYSTEM_INSTRUCTION = `
You are an Elite AI Creative Director and Social Media Strategist.
Your goal is to design a high-quality, ready-to-render social media banner campaign based on the user's request.

**CRITICAL RULE: VISUAL PROMPTS**
- The 'image_prompt' MUST describe a **visual scene** for a background.
- Do NOT use words like "no text" or "text free" inside the 'image_prompt' itself—describe the image content only (e.g., "A wooden table with a coffee cup").
- Avoid using specific celebrity names or copyrighted characters. Use generic terms (e.g., "A superhero", "A business woman").
- If the user asks for "human feel", describe "Lifestyle photography of diverse people, candid, warm lighting, blurred background".
- If the style is not specified, default to a modern, high-quality aesthetic suitable for the topic.

**CORE CAPABILITIES & LOGIC:**
1. **Analyze User Prompt:** Extract the main topic, key message, and visual style from the 'User Prompt'.
2. **Layout Strategy:** Create punchy 3-6 word headlines that capture the essence of the user's request.
3. **Background Handling:** 
   - If 'hasBackgroundImage' is TRUE: The 'image_prompt' should be "User provided background".
   - If 'hasBackgroundImage' is FALSE: Generate a detailed 'image_prompt' for the background art. 
4. **Asset Handling:**
   - If 'hasAssetImage' is TRUE: Account for it in your description (e.g., "Space left in center for logo").
5. **Multi-Slide Logic:**
   - If the user prompt implies a list, carousel, steps, tips, or multiple items, generate 'additional_banners' for each item.
   - If the user prompt is for a single banner, return an empty array for 'additional_banners'.
6. **CTA Logic:**
   - Always provide a crisp Call-To-Action (e.g., "Learn More", "Swipe Left") in the 'cta' field.

**INPUTS:**
- User Prompt: The raw description from the user.
- Aspect Ratio: Target shape.

**OUTPUT FORMAT (Strict JSON):**
{
  "main_banner": { 
    "headline": "Short Bold Header",
    "subheadline": "Supporting subtext",
    "image_prompt": "Detailed description of background image. Visuals only.", 
    "description": "Visual summary", 
    "cta": "Get Started" 
  },
  "additional_banners": [ 
    { "title": "Slide Title", "subtitle": "Slide Content", "image_prompt": "Matching background. Visuals only.", "description": "...", "cta": "Try It" } 
  ],
  "seo": {
    "caption": "Full social media caption...",
    "hashtags": ["tag1", "tag2"],
    "keywords": ["kw1", "kw2"]
  }
}
`;

export const generateBannerPlan = async (request: BannerRequest): Promise<BannerPlan> => {
  const prompt = `
    User Prompt: ${request.userPrompt}
    Aspect Ratio: ${request.aspectRatio}
    Has Background Upload: ${request.hasBackgroundImage}
    Has Asset Upload: ${request.hasAssetImage}
  `;

  const client = getClient();
  const response = await client.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: {
      systemInstruction: BANNER_SYSTEM_INSTRUCTION,
      responseMimeType: "application/json",
      temperature: 0.5, 
      maxOutputTokens: 8192,
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          main_banner: {
            type: Type.OBJECT,
            properties: {
              headline: { type: Type.STRING },
              subheadline: { type: Type.STRING },
              image_prompt: { type: Type.STRING },
              description: { type: Type.STRING },
              cta: { type: Type.STRING },
            },
            required: ["headline", "subheadline", "image_prompt", "description", "cta"],
          },
          additional_banners: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                subtitle: { type: Type.STRING },
                image_prompt: { type: Type.STRING },
                description: { type: Type.STRING },
                cta: { type: Type.STRING },
              },
              required: ["title", "subtitle", "image_prompt", "description", "cta"],
            },
          },
          seo: {
            type: Type.OBJECT,
            properties: {
                caption: { type: Type.STRING },
                hashtags: { type: Type.ARRAY, items: { type: Type.STRING } },
                keywords: { type: Type.ARRAY, items: { type: Type.STRING } },
            },
            required: ["caption", "hashtags", "keywords"],
          }
        },
        required: ["main_banner", "additional_banners", "seo"],
      } as Schema,
    },
  });

  if (!response.text) {
    throw new Error("No text returned from Gemini");
  }

  try {
    const jsonText = response.text.replace(/```json\n?|\n?```/g, "").trim();
    return JSON.parse(jsonText) as BannerPlan;
  } catch (e) {
    console.error("Failed to parse JSON", response.text);
    throw new Error("Invalid JSON response from AI");
  }
};

// --- Image Generation (Backgrounds) ---

export const generateImage = async (prompt: string, aspectRatio: AspectRatio, referenceImages: string[] = []): Promise<string> => {
  if (!prompt) return "";

  // Safety check: If prompt implies no generation needed
  if (prompt.toLowerCase().includes("user provided background")) {
      return referenceImages[0] || "";
  }

  // Internal helper to execute generation
  const executeGen = async (promptText: string) => {
      const client = getClient();
      const parts: any[] = [{ text: promptText }];
      const response = await client.models.generateContent({
        model: 'gemini-2.5-flash-image', 
        contents: { parts },
        config: {
          imageConfig: {
              aspectRatio: aspectRatio === '4:5' ? '3:4' : aspectRatio // Map unsupported ratios to closest match
          }
        }
      });

      const outputParts = response.candidates?.[0]?.content?.parts;
      if (!outputParts) throw new Error("No content generated");

      for (const part of outputParts) {
        if (part.inlineData && part.inlineData.data) {
          return `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
        }
      }

      // If the model refuses, it often outputs text. We treat this as an error.
      const textPart = outputParts.find(p => p.text);
      if (textPart) {
          throw new Error(textPart.text);
      }
      throw new Error("No image data found");
  };

  try {
    // Attempt 1: High Quality Prompt
    const strictPrompt = `Professional photography, ${prompt}. Cinematic lighting, 8k resolution, high quality, highly detailed, text-free background.`;
    return await executeGen(strictPrompt);

  } catch (error: any) {
    console.warn("Primary image generation failed, retrying with fallback...", error.message);
    
    try {
        // Attempt 2: Simplified / Safer Prompt
        // If the first failed (often due to safety filters on complex prompts), try a minimalist/abstract approach
        const fallbackPrompt = `Artistic illustration style, ${prompt}. Soft colors, minimalist, abstract, high quality, no text.`;
        return await executeGen(fallbackPrompt);
    } catch (retryError) {
        console.error("Image generation completely failed:", retryError);
        throw new Error("Model refused to generate image. Try a simpler prompt.");
    }
  }
};

// --- Legacy Edit (Optional) ---
export const editImageWithGemini = async (base64Image: string, prompt: string): Promise<string> => {
    if (!prompt) throw new Error("Prompt is required");
  
    const cleanBase64 = base64Image.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, '');
    const mimeType = base64Image.match(/^data:image\/(png|jpeg|jpg|webp);base64,/)?.[1] || 'png';
  
    try {
      const client = getClient();
      const response = await client.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: `image/${mimeType}`,
                data: cleanBase64,
              },
            },
          ],
        },
      });
  
      const parts = response.candidates?.[0]?.content?.parts;
      if (!parts) throw new Error("No content generated");
  
      for (const part of parts) {
        if (part.inlineData && part.inlineData.data) {
          return `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
        }
      }
      throw new Error("No image data found in response");
    } catch (error) {
      console.error("Image editing error:", error);
      throw error;
    }
  };
