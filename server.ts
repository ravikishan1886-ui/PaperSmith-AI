import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import dotenv from 'dotenv';
import Groq from 'groq-sdk';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 1. Load environment variables (supports .env.local for local development, and .env)
const envLocalPath = path.resolve(__dirname, '.env.local');
if (fs.existsSync(envLocalPath)) {
  dotenv.config({ path: envLocalPath, override: true });
}
const envPath = path.resolve(__dirname, '.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}
// Standard dotenv fallback
dotenv.config();

// Supported Models
const VISION_MODEL = "qwen/qwen3.8-27b";
const GENERATION_MODEL = "openai/gpt-oss-120b";

/**
 * Safely extracts and cleans the GROQ_API_KEY from environment.
 * Strips surrounding whitespace, accidental quotes, or trailing newlines.
 * Never exposes or logs the actual key.
 */
function getCleanGroqApiKey(): string {
  let key = process.env.GROQ_API_KEY || '';

  // Fallback check if process.env wasn't populated by process manager
  if (!key) {
    for (const f of ['.env.local', '.env']) {
      try {
        const fullPath = path.resolve(__dirname, f);
        if (fs.existsSync(fullPath)) {
          const content = fs.readFileSync(fullPath, 'utf-8');
          const match = content.match(/^GROQ_API_KEY=(.+)$/m);
          if (match && match[1]?.trim()) {
            key = match[1].trim();
            break;
          }
        }
      } catch {}
    }
  }

  // Clean accidental quotes or whitespace
  return key.trim().replace(/^["']|["']$/g, '').trim();
}

/**
 * Validates environment variables on server startup and outputs safe diagnostic logs.
 */
function validateEnvironment(): boolean {
  const key = getCleanGroqApiKey();
  console.log("-------------------------------------------------------");
  console.log("PaperSmith AI Server Configuration Status:");
  if (!key) {
    console.error("⚠️  GROQ_API_KEY is not configured.");
    console.error("   Add your Groq API key to the server environment (.env or .env.local).");
    console.log("-------------------------------------------------------");
    return false;
  }

  console.log(`✅ GROQ_API_KEY detected (Length: ${key.length}, Prefix: ${key.substring(0, 6)}...)`);
  console.log(`✅ Vision Model: ${VISION_MODEL}`);
  console.log(`✅ Paper Architect Model: ${GENERATION_MODEL}`);
  console.log("-------------------------------------------------------");
  return true;
}

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

/**
 * Maps error codes & responses into clear, diagnostic user messages.
 */
function mapGroqError(err: any, modelName: string) {
  const status = err.status || err.statusCode || 500;
  const rawMsg = err.error?.message || err.message || '';
  let errorType = 'server_error';
  let message = rawMsg || 'An unexpected error occurred during processing.';

  if (status === 401 || rawMsg.toLowerCase().includes('invalid api key')) {
    errorType = 'invalid_api_key';
    message = 'The configured Groq API key is invalid or has been revoked. Please check your GROQ_API_KEY in the server environment.';
  } else if (status === 403 || rawMsg.toLowerCase().includes('permission')) {
    errorType = 'permission_error';
    message = `Access denied. Your Groq API key lacks permissions for model: ${modelName}.`;
  } else if (status === 404 || rawMsg.toLowerCase().includes('model') || rawMsg.toLowerCase().includes('not exist')) {
    errorType = 'invalid_model';
    message = `The requested Groq model (${modelName}) does not exist or is currently unavailable.`;
  } else if (status === 429 || rawMsg.toLowerCase().includes('rate limit') || rawMsg.toLowerCase().includes('quota')) {
    errorType = 'rate_limit';
    message = 'Groq rate limit or quota exceeded. Please wait a brief moment before generating again.';
  } else if (!rawMsg && status >= 500) {
    errorType = 'network_error';
    message = 'Unable to connect to the Groq AI service. Please check network connectivity.';
  }

  // Safe diagnostic log (NEVER logs full key)
  console.error(`[Groq Error] Status: ${status} | ErrorType: ${errorType} | Model: ${modelName} | Message: ${rawMsg}`);

  return { status, errorType, message };
}

// Diagnostic status endpoint for UI or health-checks
app.get('/api/config-status', (_req, res) => {
  const key = getCleanGroqApiKey();
  res.json({
    configured: !!key,
    keyLength: key ? key.length : 0,
    keyPrefix: key ? `${key.substring(0, 6)}...` : null,
    visionModel: VISION_MODEL,
    generationModel: GENERATION_MODEL,
    environment: process.env.NODE_ENV || 'development'
  });
});

// Endpoint: Extract text from scanned textbook images
app.post('/api/extract-text', async (req, res) => {
  try {
    const apiKey = getCleanGroqApiKey();
    if (!apiKey) {
      console.warn("[Groq Request Failed] GROQ_API_KEY is missing from environment.");
      return res.status(500).json({
        error: "GROQ_API_KEY is not configured. Add your Groq API key to the server environment.",
        errorType: "missing_api_key"
      });
    }

    const { images } = req.body;
    if (!images || !Array.isArray(images) || images.length === 0) {
      return res.status(400).json({ 
        error: "No images provided for extraction.", 
        errorType: "invalid_input" 
      });
    }

    // Safe diagnostic log
    console.log(`[Groq Request] /api/extract-text | Model: ${VISION_MODEL} | Key exists: true (length: ${apiKey.length}) | Images: ${images.length}`);

    const groq = new Groq({ apiKey });
    const chunkSize = 2; // Chunking protects against payload limits and multimodal token ceilings
    let fullText = "";

    for (let i = 0; i < images.length; i += chunkSize) {
      const chunk = images.slice(i, i + chunkSize);
      const messages: any[] = [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Extract all textbook and academic text completely from these images. Preserve question numbering, equations, options, subheadings, diagram labels, and all exercise content accurately."
            },
            ...chunk.map((url: string) => ({
              type: "image_url",
              image_url: { url }
            }))
          ]
        }
      ];

      const groqResponse = await groq.chat.completions.create({
        model: VISION_MODEL,
        messages,
        temperature: 0.1,
        max_completion_tokens: 4096
      });

      const content = groqResponse.choices?.[0]?.message?.content || "";
      fullText += content + "\n\n";
    }

    res.json({ text: fullText.trim() });
  } catch (err: any) {
    const { status, errorType, message } = mapGroqError(err, VISION_MODEL);
    res.status(status).json({ error: message, errorType, statusCode: status });
  }
});

// Endpoint: Generate structured academic question paper
app.post('/api/generate-paper', async (req, res) => {
  try {
    const apiKey = getCleanGroqApiKey();
    if (!apiKey) {
      console.warn("[Groq Request Failed] GROQ_API_KEY is missing from environment.");
      return res.status(500).json({
        error: "GROQ_API_KEY is not configured. Add your Groq API key to the server environment.",
        errorType: "missing_api_key"
      });
    }

    const { text, targetMarks, difficulty } = req.body;
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ 
        error: "Text content is required for question paper generation.", 
        errorType: "invalid_input" 
      });
    }

    const marks = Number(targetMarks) || 40;
    const diff = difficulty || 'Standard';

    // Safe diagnostic log
    console.log(`[Groq Request] /api/generate-paper | Model: ${GENERATION_MODEL} | Key exists: true (length: ${apiKey.length}) | Marks: ${marks} | Difficulty: ${diff}`);

    const prompt = `
Analyze the following textbook content and generate a high-quality academic question paper.

Target Specs:
- Total Marks: ${marks}
- Difficulty: ${diff}
- Format: Professional examination paper structure

Content:
${text}

Return strictly a valid JSON object matching this schema (no markdown fences, no outside commentary, strictly valid JSON):
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
          "options": ["Option A", "Option B", "Option C", "Option D"]
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

    const groq = new Groq({ apiKey });
    const groqResponse = await groq.chat.completions.create({
      model: GENERATION_MODEL,
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
      temperature: 0.7,
      max_completion_tokens: 8192,
      top_p: 1,
      response_format: { type: "json_object" }
    });

    const content = groqResponse.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("No response received from the generation model.");
    }

    const paperData = JSON.parse(content);
    res.json({
      paper: {
        ...paperData,
        id: Date.now().toString(),
        generatedAt: new Date().toISOString().split('T')[0]
      }
    });
  } catch (err: any) {
    const { status, errorType, message } = mapGroqError(err, GENERATION_MODEL);
    res.status(status).json({ error: message, errorType, statusCode: status });
  }
});

async function startServer() {
  validateEnvironment();

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
