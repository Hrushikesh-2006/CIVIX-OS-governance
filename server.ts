import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { readFileSync } from "fs";
import Groq from "groq-sdk";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let groqClient: Groq | null = null;

function getGroq() {
  if (!groqClient) {
    const key = process.env.GROQ_API_KEY;
    if (!key) {
      throw new Error('GROQ_API_KEY environment variable is required');
    }
    groqClient = new Groq({ apiKey: key });
  }
  return groqClient;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unexpected server error";
}

function parseJsonObject(text: string) {
  try {
    const cleaned = (text || "{}")
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();
    return JSON.parse(cleaned);
  } catch {
    throw new Error("AI returned invalid JSON. Please try again.");
  }
}
async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3001;

  app.use(express.json());

  // API routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  app.post("/api/ai/analyze", async (req, res) => {
    try {
      const { prompt } = req.body;
      if (typeof prompt !== "string" || !prompt.trim()) {
        return res.status(400).json({ error: "A non-empty prompt is required" });
      }
      const groq = getGroq();
      const completion = await groq.chat.completions.create({
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
        model: "llama-3.3-70b-versatile",
        response_format: { type: "json_object" },
      });
      res.json(parseJsonObject(completion.choices[0]?.message?.content || "{}"));
    } catch (error: unknown) {
      console.error("Groq Analyze Error:", error);
      res.status(500).json({ error: getErrorMessage(error) });
    }
  });

  app.post("/api/ai/intelligence", async (req, res) => {
    try {
      const { prompt } = req.body;
      if (typeof prompt !== "string" || !prompt.trim()) {
        return res.status(400).json({ error: "A non-empty prompt is required" });
      }
      const groq = getGroq();
      const completion = await groq.chat.completions.create({
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
        model: "llama-3.3-70b-versatile",
      });
      res.json({ text: completion.choices[0]?.message?.content || "" });
    } catch (error: unknown) {
      console.error("Groq Intelligence Error:", error);
      res.status(500).json({ error: getErrorMessage(error) });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== "true",
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
    
    // Fallback to index.html for SPA routing
    let cachedIndexHtml: string | null = null;
    app.use((req, res, next) => {
      if (!req.path.startsWith('/api/')) {
        if (!cachedIndexHtml) {
          const indexPath = path.join(__dirname, 'index.html');
          cachedIndexHtml = readFileSync(indexPath, 'utf-8');
        }
        return vite.transformIndexHtml(req.originalUrl, cachedIndexHtml)
          .then(html => res.end(html));
      }
      next();
    });
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();


