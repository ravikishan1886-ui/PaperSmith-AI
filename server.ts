import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables with fallbacks
dotenv.config();
if (!process.env.GROQ_API_KEY) {
  for (const f of ['.env.local', '.env.example']) {
    const fullPath = path.resolve(__dirname, f);
    if (fs.existsSync(fullPath)) {
      dotenv.config({ path: fullPath, override: true });
      if (process.env.GROQ_API_KEY) break;
    }
  }
}

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

function getGroqApiKey(): string {
  if (process.env.GROQ_API_KEY && process.env.GROQ_API_KEY.trim() !== '') {
    return process.env.GROQ_API_KEY.trim();
  }
  for (const f of ['.env', '.env.local', '.env.example']) {
    try {
      const fullPath = path.resolve(__dirname, f);
      if (fs.existsSync(fullPath)) {
        const text = fs.readFileSync(fullPath, 'utf-8');
        const match = text.match(/^GROQ_API_KEY=(.+)$/m);
        if (match && match[1]?.trim()) {
          return match[1].trim();
        }
      }
    } catch {}
  }
  return '';
}

// API endpoints
app.post('/api/extract-text', async (req, res) => {
  try {
    const apiKey = getGroqApiKey();
    if (!apiKey) {
      return res.status(500).json({ error: "GROQ_API_KEY is not configured. Please add it to your environment or .env file." });
    }

    const { images } = req.body;
    if (!images || !Array.isArray(images) || images.length === 0) {
      return res.status(400).json({ error: "No images provided for extraction." });
    }

    // Split into chunks of 2 to stay well within Groq multimodal limits and payload constraints
    const chunkSize = 2;
    let fullText = "";

    for (let i = 0; i < images.length; i += chunkSize) {
      const chunk = images.slice(i, i + chunkSize);
      const messages = [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Extract all textbook and academic text completely from these images. Preserve question numbering, equations, options, subheadings, diagrams labels, and all exercise content accurately.`
            },
            ...chunk.map((url: string) => ({
              type: "image_url",
              image_url: { url }
            }))
          ]
        }
      ];

      const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
          "User-Agent": "PaperSmith/1.0"
        },
        body: JSON.stringify({
          model: "qwen/qwen3.8-27b",
          messages,
          temperature: 0.1,
          max_completion_tokens: 4096
        })
      });

      if (!groqRes.ok) {
        const errJson = await groqRes.json().catch(() => ({}));
        throw new Error(errJson.error?.message || `Groq Vision Error (${groqRes.status})`);
      }

      const groqData = await groqRes.json();
      const content = groqData.choices?.[0]?.message?.content || "";
      fullText += content + "\n\n";
    }

    res.json({ text: fullText.trim() });
  } catch (error: any) {
    console.error("API /api/extract-text error:", error);
    res.status(500).json({ error: error.message || "Failed to extract text from images." });
  }
});

app.post('/api/generate-paper', async (req, res) => {
  try {
    const apiKey = getGroqApiKey();
    if (!apiKey) {
      return res.status(500).json({ error: "GROQ_API_KEY is not configured. Please add it to your environment or .env file." });
    }

    const { text, targetMarks, difficulty } = req.body;
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: "Text content is required." });
    }

    const marks = Number(targetMarks) || 40;
    const diff = difficulty || 'Standard';

    const prompt = `
Analyze the following textbook content and generate a high-quality academic question paper.

Target Specs:
- Total Marks: ${marks}
- Difficulty: ${diff}
- Format: Professional examination paper structure

Content:
${text}

Return strictly a valid JSON object matching this schema (no extra commentary, only valid JSON):
{
  "title": "Unit Assessment: Academic Examination",
  "subject": "General Science / Subject Name",
  "chapter": "Curriculum Unit",
  "totalMarks": ${marks},
  "time": "2 Hours",
  "sections": [
    {
      "title": "Section A (Objective & MCQs)",
      "description": "Multiple Choice Questions (1 Mark Each)",
      "questions": [
        {
          "id": "q1",
          "type": "MCQ",
          "text": "Question text?",
          "marks": 1,
          "options": ["A", "B", "C", "D"]
        }
      ]
    },
    {
      "title": "Section B (Short Answer)",
      "description": "Short Answer Questions (2-3 Marks Each)",
      "questions": [
        {
          "id": "q2",
          "type": "Short Answer",
          "text": "Question text?",
          "marks": 2
        }
      ]
    },
    {
      "title": "Section C (Long Answer)",
      "description": "In-depth Analytical Questions (4-5 Marks Each)",
      "questions": [
        {
          "id": "q3",
          "type": "Long Answer",
          "text": "Question text?",
          "marks": 5
        }
      ]
    }
  ]
}
`;

    const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
        "User-Agent": "PaperSmith/1.0"
      },
      body: JSON.stringify({
        model: "openai/gpt-oss-120b",
        messages: [
          {
            role: "system",
            content: "You are an expert exam question paper designer. You must return strictly valid JSON matching the requested structure."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 1,
        max_completion_tokens: 8192,
        top_p: 1,
        reasoning_effort: "medium",
        response_format: { type: "json_object" }
      })
    });

    if (!groqRes.ok) {
      const errJson = await groqRes.json().catch(() => ({}));
      throw new Error(errJson.error?.message || `Groq Generation Error (${groqRes.status})`);
    }

    const groqData = await groqRes.json();
    const content = groqData.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("No response content from model.");
    }

    const paperData = JSON.parse(content);
    res.json({
      paper: {
        ...paperData,
        id: Date.now().toString(),
        generatedAt: new Date().toISOString().split('T')[0]
      }
    });
  } catch (error: any) {
    console.error("API /api/generate-paper error:", error);
    res.status(500).json({ error: error.message || "Failed to generate question paper." });
  }
});

async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
