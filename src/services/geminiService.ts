import { GoogleGenAI, Type } from "@google/genai";
import { Paper } from "../types";

const ai = new GoogleGenAI({ 
  apiKey: process.env.GEMINI_API_KEY || "" 
});

const PAPER_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING },
    subject: { type: Type.STRING },
    chapter: { type: Type.STRING },
    totalMarks: { type: Type.NUMBER },
    time: { type: Type.STRING },
    sections: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          description: { type: Type.STRING },
          questions: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                type: { type: Type.STRING, enum: ['MCQ', 'VSA', 'SA', 'LA', 'CASE'] },
                text: { type: Type.STRING },
                marks: { type: Type.NUMBER },
                options: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING }
                }
              },
              required: ["id", "type", "text", "marks"]
            }
          }
        },
        required: ["title", "description", "questions"]
      }
    }
  },
  required: ["title", "subject", "chapter", "totalMarks", "time", "sections"]
};

/**
 * Resizes an image to a maximum dimension to optimize AI processing speed
 */
async function optimizeImage(imageUrl: string): Promise<{ inlineData: { mimeType: string, data: string } }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = imageUrl;
    
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const MAX_DIM = 1024;
        let width = img.width;
        let height = img.height;

        if (width > MAX_DIM || height > MAX_DIM) {
          if (width > height) {
            height = Math.round((height * MAX_DIM) / width);
            width = MAX_DIM;
          } else {
            width = Math.round((width * MAX_DIM) / height);
            height = MAX_DIM;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        const base64 = dataUrl.split(',')[1];
        
        resolve({
          inlineData: {
            mimeType: 'image/jpeg',
            data: base64
          }
        });
      } catch (err) {
        reject(new Error("Failed to process image canvas."));
      }
    };

    img.onerror = () => {
      reject(new Error(`Failed to load image from source. Your browser might be blocking the file access.`));
    };
  });
}

export async function generatePaperFromImages(
  images: { url: string }[], 
  targetMarks: number, 
  difficulty: string
): Promise<Paper> {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not configured in Secrets.");
  }

  // Optimize and convert images concurrently
  const imageParts = await Promise.all(images.map(img => optimizeImage(img.url)));

  const prompt = `
    Analyze the provided textbook images and generate a high-quality academic question paper.
    
    Target Specs:
    - Marks: ${targetMarks}
    - Difficulty: ${difficulty}
    - Flow: Professional, Board-style layout
    
    Instructions:
    1. Extract relevant concepts to form questions.
    2. Distribution should match exactly ${targetMarks} marks.
    3. Return strictly valid JSON.
  `;

  try {
    const result = await ai.models.generateContent({
      model: "gemini-flash-latest",
      contents: {
        parts: [
          ...imageParts,
          { text: prompt }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: PAPER_SCHEMA as any,
      }
    });

    if (!result.text) {
      throw new Error("The AI model returned an empty response. This can happen if the content is too complex or blocked.");
    }

    const paperData = JSON.parse(result.text);
    return {
      ...paperData,
      id: Date.now().toString(),
      generatedAt: new Date().toISOString()
    };
  } catch (error: any) {
    console.error("Gemini Generation Error Details:", error);
    if (error.message?.includes("Failed to fetch")) {
      throw new Error("Network error: Could not reach the AI service. This might be due to a strict network policy or an invalid API key.");
    }
    throw error;
  }
}

export async function extractTextFromImages(images: { url: string }[]): Promise<string> {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not configured in Secrets.");
  }

  const imageParts = await Promise.all(images.map(img => optimizeImage(img.url)));

  const result = await ai.models.generateContent({
    model: "gemini-flash-latest",
    contents: {
      parts: [
        ...imageParts,
        { text: "Extract all text from these images as cleanly as possible for academic use. Preserve the hierarchy if clear." }
      ]
    }
  });

  return result.text || "";
}
