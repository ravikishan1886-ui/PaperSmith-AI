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

export async function generatePaperFromImages(
  images: { url: string }[], 
  targetMarks: number, 
  difficulty: string
): Promise<Paper> {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not configured in Secrets.");
  }

  // Convert blob URLs to base64
  const imageParts = await Promise.all(images.map(async (img) => {
    const response = await fetch(img.url);
    const blob = await response.blob();
    return new Promise<{ inlineData: { mimeType: string, data: string } }>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = (reader.result as string).split(',')[1];
        resolve({
          inlineData: {
            mimeType: blob.type,
            data: base64
          }
        });
      };
      reader.readAsDataURL(blob);
    });
  }));

  const prompt = `
    Analyze the provided textbook page images and generate a professional academic question paper.
    
    Target Specifications:
    - Total Marks: ${targetMarks}
    - Difficulty Level: ${difficulty}
    - Chapter: Extract from context (e.g. Science Class 10 Chapter 1)
    
    Guidelines:
    1. Extract core concepts from the images to form questions.
    2. Ensure a mix of MCQ (1m), VSA (2m), SA (3m), and LA (5m) questions to reach exactly ${targetMarks} marks.
    3. The tone should be formal and academic.
    4. Options for MCQs should be plausible.
    
    Return the result strictly as a valid JSON object matching the defined schema.
  `;

  try {
    const result = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
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

    const paperData = JSON.parse(result.text);
    return {
      ...paperData,
      id: Date.now().toString(),
      generatedAt: new Date().toISOString()
    };
  } catch (error) {
    console.error("Gemini Generation Error:", error);
    throw error;
  }
}
