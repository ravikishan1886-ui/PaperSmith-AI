
import { Paper } from "../types";

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
