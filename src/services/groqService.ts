import { Paper } from "../types";

function getApiKey(): string {
  const envKey = process.env.GROQ_API_KEY;
  if (envKey && envKey !== "undefined" && envKey.trim() !== "") {
    return envKey;
  }
  return "";
}

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

      canvas.width = Math.max(32, Math.round(width));
      canvas.height = Math.max(32, Math.round(height));
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.8));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

async function uploadToImgBB(base64Data: string): Promise<string> {
  const apiKey = process.env.IMGBB_API_KEY;
  if (!apiKey || apiKey === "undefined" || apiKey.trim() === "") {
    return base64Data;
  }

  const base64Image = base64Data.split(',')[1] || base64Data;
  const formData = new FormData();
  formData.append('image', base64Image);

  try {
    const response = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      return base64Data;
    }

    const data = await response.json();
    return data.data.url;
  } catch (error) {
    console.warn("ImgBB upload failed, using direct image data:", error);
    return base64Data;
  }
}

export async function extractTextFromImages(images: { url: string }[]): Promise<string> {
  // Convert blob URLs to optimized data URLs
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
    if (imgbbKey && imgbbKey !== "undefined" && imgbbKey.trim() !== "") {
      try {
        return await uploadToImgBB(optimizedBase64);
      } catch {
        return optimizedBase64;
      }
    }

    return optimizedBase64;
  });

  const remoteUrls = await Promise.all(imageUrlPromises);

  // Strategy 1: Attempt server proxy route /api/extract-text
  try {
    const apiRes = await fetch("/api/extract-text", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ images: remoteUrls })
    });

    if (apiRes.ok) {
      const apiData = await apiRes.json();
      if (apiData.text && apiData.text.trim().length > 0) {
        return apiData.text;
      }
    }
  } catch (serverErr) {
    console.warn("Server proxy text extraction unavailable, using direct Groq client:", serverErr);
  }

  // Strategy 2: Direct Groq Vision API call with qwen/qwen3.8-27b
  const apiKey = getApiKey();
  const chunkSize = 2; // Chunk size 2 prevents payload overflow and image count errors
  let fullExtraction = "";

  for (let i = 0; i < remoteUrls.length; i += chunkSize) {
    const chunk = remoteUrls.slice(i, i + chunkSize);
    const messages = [
      {
        role: "user",
        content: [
          { 
            type: "text", 
            text: `Extract all textbook and academic text completely from these images. Preserve question numbering, equations, options, subheadings, diagrams labels, and all exercise content accurately.` 
          },
          ...chunk.map(url => ({
            type: "image_url",
            image_url: { url }
          }))
        ]
      }
    ];

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        messages,
        model: "qwen/qwen3.8-27b",
        temperature: 0.1,
        max_completion_tokens: 4096
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `Groq Vision Error: ${response.status}`);
    }

    const data = await response.json();
    fullExtraction += (data.choices?.[0]?.message?.content || "") + "\n\n";
  }

  return fullExtraction.trim();
}

export async function generatePaperFromText(
  text: string, 
  targetMarks: number, 
  difficulty: string
): Promise<Paper> {
  // Strategy 1: Attempt server proxy route /api/generate-paper
  try {
    const apiRes = await fetch("/api/generate-paper", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, targetMarks, difficulty })
    });

    if (apiRes.ok) {
      const apiData = await apiRes.json();
      if (apiData.paper) {
        return apiData.paper;
      }
    }
  } catch (serverErr) {
    console.warn("Server proxy paper generation unavailable, using direct Groq client:", serverErr);
  }

  // Strategy 2: Direct Groq API call with openai/gpt-oss-120b
  const apiKey = getApiKey();

  const prompt = `
    Analyze the following textbook content and generate a complete, high-quality academic question paper.
    
    Target Specs:
    - Marks: ${targetMarks}
    - Difficulty: ${difficulty}
    - Format: Professional examination layout
    
    Content:
    ${text}
    
    Return the response strictly as a valid JSON object matching this schema:
    {
      "title": "Unit Examination",
      "subject": "Academic Subject",
      "chapter": "Curriculum Unit",
      "totalMarks": ${targetMarks},
      "time": "2 Hours",
      "sections": [
        {
          "title": "Section A",
          "description": "Multiple Choice Questions (1 Mark Each)",
          "questions": [
            { "id": "q1", "type": "MCQ", "text": "Question text?", "marks": 1, "options": ["A", "B", "C", "D"] }
          ]
        },
        {
          "title": "Section B",
          "description": "Short Answer Questions (2 Marks Each)",
          "questions": [
            { "id": "q2", "type": "Short Answer", "text": "Question text?", "marks": 2 }
          ]
        },
        {
          "title": "Section C",
          "description": "Long Answer Questions (5 Marks Each)",
          "questions": [
            { "id": "q3", "type": "Long Answer", "text": "Question text?", "marks": 5 }
          ]
        }
      ]
    }
  `;

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
          content: "You are a professional examiner. Always return strictly valid JSON matching the requested structure."
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
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `Groq API error: ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  
  if (!content) {
    throw new Error("Empty response received from Groq generation model.");
  }

  const paperData = JSON.parse(content);
  return {
    ...paperData,
    id: Date.now().toString(),
    generatedAt: new Date().toISOString().split('T')[0]
  };
}
