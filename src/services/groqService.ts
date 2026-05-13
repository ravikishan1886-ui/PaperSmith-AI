
import { Paper } from "../types";

export async function extractTextFromImages(images: { url: string }[]): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey || apiKey === "undefined") {
    throw new Error("GROQ_API_KEY is not configured in the Secrets menu.");
  }

  // Convert blob URLs to data URLs
  const imagePromises = images.map(async (img) => {
    const response = await fetch(img.url);
    const blob = await response.blob();
    return new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
  });

  const base64Images = await Promise.all(imagePromises);

  // We use the vision model to extract text
  // Groq supports multiple images in a single call or sequential
  // For simplicity and robustness, we'll process them in one prompt if count is low, 
  // but better to join them.
  
  const messages = [
    {
      role: "user",
      content: [
        { type: "text", text: "Extract all academic and textbook content from these images clearly. Preserve headings and structure as text." },
        ...base64Images.map(url => ({
          type: "image_url",
          image_url: { url }
        }))
      ]
    }
  ];

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        messages,
        model: "llama-3.2-11b-vision-preview",
        temperature: 0.1,
        max_completion_tokens: 4096
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || `Groq Vision Error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || "";
  } catch (error: any) {
    console.error("Groq Text Extraction Error:", error);
    throw error;
  }
}

export async function generatePaperFromText(
  text: string, 
  targetMarks: number, 
  difficulty: string
): Promise<Paper> {
  const apiKey = process.env.GROQ_API_KEY;
  
  if (!apiKey || apiKey === "undefined") {
    throw new Error("GROQ_API_KEY is not configured in the Secrets menu. Please add it to continue.");
  }

  const prompt = `
    Analyze the following textbook content and generate a high-quality academic question paper.
    
    Target Specs:
    - Marks: ${targetMarks}
    - Difficulty: ${difficulty}
    - Format: Professional, Board-style layout
    
    Content:
    ${text}
    
    Return the response as a valid JSON object matching this schema:
    {
      "title": "Exam Title",
      "subject": "Subject Name",
      "chapter": "Chapter Name",
      "totalMarks": number,
      "time": "e.g. 2 Hours",
      "sections": [
        {
          "title": "Section A",
          "description": "MCQs",
          "questions": [
            { "id": "q1", "type": "MCQ", "text": "Question text?", "marks": 1, "options": ["A", "B", "C", "D"] }
          ]
        }
      ]
    }
  `;

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        messages: [
          {
            role: "system",
            content: "You are a professional examiner. Always return strictly valid JSON."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        model: "llama-3.3-70b-versatile",
        temperature: 0.7,
        max_completion_tokens: 4096,
        response_format: { type: "json_object" }
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || `Groq API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;
    
    if (!content) {
      throw new Error("Empty response from Groq.");
    }

    const paperData = JSON.parse(content);
    return {
      ...paperData,
      id: Date.now().toString(),
      generatedAt: new Date().toISOString()
    };
  } catch (error: any) {
    console.error("Groq Generation Error:", error);
    throw error;
  }
}
