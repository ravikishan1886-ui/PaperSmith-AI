
import { Paper } from "../types";

async function optimizeImage(dataUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const MAX_WIDTH = 1024;
      const MAX_HEIGHT = 1024;
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > MAX_WIDTH) {
          height *= MAX_WIDTH / width;
          width = MAX_WIDTH;
        }
      } else {
        if (height > MAX_HEIGHT) {
          width *= MAX_HEIGHT / height;
          height = MAX_HEIGHT;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', 0.7));
    };
    img.src = dataUrl;
  });
}

async function uploadToImgBB(base64Data: string): Promise<string> {
  const apiKey = process.env.IMGBB_API_KEY;

  // Remove the data:image/jpeg;base64, part if present
  const base64Image = base64Data.split(',')[1] || base64Data;

  const formData = new FormData();
  formData.append('image', base64Image);

  try {
    const response = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || `ImgBB Upload Error: ${response.status}`);
    }

    const data = await response.json();
    return data.data.url;
  } catch (error) {
    console.error("ImgBB Upload Failure:", error);
    throw error;
  }
}

export async function extractTextFromImages(images: { url: string }[]): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey || apiKey === "undefined") {
    throw new Error("GROQ_API_KEY is not configured in the Secrets menu.");
  }

  // Convert blob URLs to optimized data URLs and optionally upload to ImgBB
  const imageUrlPromises = images.map(async (img) => {
    const response = await fetch(img.url);
    const blob = await response.blob();
    const dataUrl = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
    
    const optimizedBase64 = await optimizeImage(dataUrl);
    
    const imgbbKey = process.env.IMGBB_API_KEY;
    if (imgbbKey && imgbbKey !== "undefined" && imgbbKey !== "") {
      try {
        return await uploadToImgBB(optimizedBase64);
      } catch (error) {
        console.warn("ImgBB upload failed, falling back to base64 payload:", error);
        return optimizedBase64;
      }
    }

    return optimizedBase64;
  });

  const remoteUrls = await Promise.all(imageUrlPromises);

  // Split into chunks of 5 as the model has a limit
  const chunkSize = 5;
  const chunks: string[][] = [];
  for (let i = 0; i < remoteUrls.length; i += chunkSize) {
    chunks.push(remoteUrls.slice(i, i + chunkSize));
  }

  let fullExtraction = "";

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const messages = [
      {
        role: "user",
        content: [
          { 
            type: "text", 
            text: `Extract all academic and textbook content from these images clearly. This is batch ${i + 1} of ${chunks.length}. Preserve headings and structure as text.` 
          },
          ...chunk.map(url => ({
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
          model: "meta-llama/llama-4-scout-17b-16e-instruct",
          temperature: 0.1,
          max_completion_tokens: 4096
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || `Groq Vision Error: ${response.status}`);
      }

      const data = await response.json();
      fullExtraction += (data.choices[0]?.message?.content || "") + "\n\n";
    } catch (error: any) {
      console.error(`Groq Batch ${i + 1} Error:`, error);
      throw error;
    }
  }

  return fullExtraction.trim();
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
        model: "openai/gpt-oss-120b",
        temperature: 1,
        max_completion_tokens: 8192,
        top_p: 1,
        reasoning_effort: "medium",
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
