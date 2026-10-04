import { Paper } from "../types";

export interface GroqServiceError extends Error {
  errorType?: string;
  statusCode?: number;
}

/**
 * Optimizes scanned images on a hidden canvas before sending to server.
 * Restricts maximum dimension to 1024px to keep payloads lightweight and responsive.
 */
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

/**
 * Optional image hosting via ImgBB if key is configured in build.
 */
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
    return data.data?.url || base64Data;
  } catch (error) {
    console.warn("ImgBB upload failed, proceeding with direct image data:", error);
    return base64Data;
  }
}

/**
 * Extracts academic text from scanned textbook images via server-side Groq Vision proxy.
 * Groq API key is never exposed to the client.
 */
export async function extractTextFromImages(images: { url: string }[]): Promise<string> {
  if (!images || images.length === 0) {
    throw new Error("No images provided for text extraction.");
  }

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

  // Send request securely to server proxy
  const apiRes = await fetch("/api/extract-text", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ images: remoteUrls })
  });

  if (!apiRes.ok) {
    const errorPayload = await apiRes.json().catch(() => ({}));
    const err: GroqServiceError = new Error(
      errorPayload.error || `Server extraction failed with status ${apiRes.status}`
    );
    err.errorType = errorPayload.errorType || "server_error";
    err.statusCode = apiRes.status;
    throw err;
  }

  const apiData = await apiRes.json();
  if (!apiData.text || apiData.text.trim().length === 0) {
    throw new Error("No readable text was detected from the uploaded images. Please ensure clear page scans.");
  }

  return apiData.text;
}

/**
 * Generates an academic question paper via server-side Groq Reasoning proxy.
 * Groq API key is never exposed to the client.
 */
export async function generatePaperFromText(
  text: string, 
  targetMarks: number, 
  difficulty: string
): Promise<Paper> {
  if (!text || text.trim().length === 0) {
    throw new Error("Text content is required to generate a question paper.");
  }

  const apiRes = await fetch("/api/generate-paper", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, targetMarks, difficulty })
  });

  if (!apiRes.ok) {
    const errorPayload = await apiRes.json().catch(() => ({}));
    const err: GroqServiceError = new Error(
      errorPayload.error || `Question paper generation failed with status ${apiRes.status}`
    );
    err.errorType = errorPayload.errorType || "server_error";
    err.statusCode = apiRes.status;
    throw err;
  }

  const apiData = await apiRes.json();
  if (!apiData.paper) {
    throw new Error("Invalid response format received from generation server.");
  }

  return apiData.paper;
}
