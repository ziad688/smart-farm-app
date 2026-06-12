import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { WebSocketServer, WebSocket } from "ws";
import { createServer } from "http";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("/app/data/farm.db");

// Initialize database
db.exec(`
  CREATE TABLE IF NOT EXISTS controls (
    id TEXT PRIMARY KEY,
    status INTEGER DEFAULT 0,
    mode TEXT DEFAULT 'manual',
    value INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS gallery (
    id TEXT PRIMARY KEY,
    url TEXT,
    category TEXT,
    disease TEXT,
    confidence TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  INSERT OR IGNORE INTO controls (id, status, mode, value) VALUES ('light', 0, 'manual', 0);
  INSERT OR IGNORE INTO controls (id, status, mode, value) VALUES ('pump', 0, 'manual', 0);
  INSERT OR IGNORE INTO controls (id, status, mode, value) VALUES ('fertilizer', 0, 'manual', 65);
  INSERT OR IGNORE INTO controls (id, status, mode, value) VALUES ('heating', 0, 'manual', 0);
  INSERT OR IGNORE INTO controls (id, status, mode, value) VALUES ('cooling', 0, 'manual', 0);
  
  INSERT OR IGNORE INTO gallery (id, url, category) VALUES ('1', 'https://picsum.photos/seed/farm1/800/800', 'Crops');
  INSERT OR IGNORE INTO gallery (id, url, category) VALUES ('2', 'https://picsum.photos/seed/farm2/800/800', 'Harvest');
  INSERT OR IGNORE INTO gallery (id, url, category) VALUES ('3', 'https://picsum.photos/seed/farm3/800/800', 'Equipment');
`);

// Ensure existing controls are in manual mode for demo
db.prepare("UPDATE controls SET mode = 'manual'").run();

// Migration: Add disease and confidence columns if they don't exist
try {
  db.prepare("ALTER TABLE gallery ADD COLUMN disease TEXT").run();
} catch (e) {
  // Column likely already exists
}
try {
  db.prepare("ALTER TABLE gallery ADD COLUMN confidence TEXT").run();
} catch (e) {
  // Column likely already exists
}

// Mock Telemetry Generator
function startMockTelemetry(broadcast) {
  console.log("Starting mock telemetry generator...");
  broadcast({ type: "connection_status", status: "connected", source: "mock" });
  setInterval(() => {
    const mockData = {
      device: "Mock Simulator",
      source: "mock",
      temperature: 22 + Math.random() * 5,
      humidity: 45 + Math.random() * 15,
      moisture: 35 + Math.random() * 20,
      nitrogen: Math.floor(40 + Math.random() * 40),
      phosphorus: Math.floor(30 + Math.random() * 30),
      potassium: Math.floor(50 + Math.random() * 30),
      lightIntensity: 600 + Math.random() * 400,
      plantHealth: 90 + Math.random() * 10
    };
    broadcast({ type: "telemetry", data: mockData });
  }, 5000);
}

async function startServer() {
  console.log("Starting server initialization...");
  const app = express();
  const server = createServer(app);
  const wss = new WebSocketServer({ server });
  const PORT = 3000;

  const broadcast = (data) => {
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(data));
      }
    });
  };

  app.use(express.json({ limit: '100mb' }));
  app.use(express.urlencoded({ limit: '100mb', extended: true }));

  // Initialize Mock Telemetry
  startMockTelemetry(broadcast);

  // API Routes
  app.get("/api/dashboard", (req, res) => {
    // Return last known state or mock data
    res.json({
      stats: {
        temp: 24.5,
        humidity: 65.0,
        soilMoisture: 45.0,
        lightIntensity: 850,
        plantHealth: 85.0
      },
      nutrients: [
        { name: 'Nitrogen', value: 68, color: '#10b981' },
        { name: 'Phosphorus', value: 45, color: '#f59e0b' },
        { name: 'Potassium', value: 82, color: '#8b5cf6' }
      ],
      history: Array.from({ length: 24 }, (_, i) => ({
        time: `${i}:00`,
        temp: 20 + Math.random() * 10,
        humidity: 50 + Math.random() * 20
      }))
    });
  });

  app.get("/api/controls", (req, res) => {
    const controls = db.prepare("SELECT * FROM controls").all();
    res.json(controls);
  });

  app.post("/api/controls/:id", async (req, res) => {
    const { id } = req.params;
    const { status, mode, value } = req.body;
    
    if (status !== undefined) {
      db.prepare("UPDATE controls SET status = ? WHERE id = ?").run(status ? 1 : 0, id);
      console.log(`Control ${id} set to ${status ? 'ON' : 'OFF'}`);
    }
    if (mode !== undefined) {
      db.prepare("UPDATE controls SET mode = ? WHERE id = ?").run(mode, id);
    }
    if (value !== undefined) {
      db.prepare("UPDATE controls SET value = ? WHERE id = ?").run(value, id);
    }

    res.json({ success: true });
  });

  app.get("/api/gallery", (req, res) => {
    const images = db.prepare("SELECT * FROM gallery ORDER BY timestamp DESC").all();
    res.json(images);
  });

  app.post("/api/gallery", (req, res) => {
    const { url, category, disease, confidence } = req.body;
    const id = Math.random().toString(36).substr(2, 9);
    db.prepare("INSERT INTO gallery (id, url, category, disease, confidence) VALUES (?, ?, ?, ?, ?)").run(id, url, category, disease || null, confidence || null);
    res.json({ success: true, id });
  });

  app.post("/api/proxy-image", async (req, res) => {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: "No URL provided" });

    try {
      const imgRes = await fetch(url);
      if (!imgRes.ok) throw new Error("Failed to fetch image from URL");
      const buffer = await imgRes.arrayBuffer();
      const base64 = Buffer.from(buffer).toString('base64');
      const contentType = imgRes.headers.get('content-type') || 'image/jpeg';
      res.json({ base64, contentType });
    } catch (error) {
      console.error("Proxy Error:", error);
      res.status(500).json({ error: "Failed to fetch image" });
    }
  });

  app.post("/api/proxy-drive", async (req, res) => {
    const { fileId, oauthToken } = req.body;
    if (!fileId || !oauthToken) {
      return res.status(400).json({ error: "Missing fileId or oauthToken" });
    }

    try {
      console.log(`Proxying Google Drive file ${fileId} from backend...`);
      const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
        headers: {
          Authorization: `Bearer ${oauthToken}`
        }
      });

      if (!response.ok) {
        let errText = "";
        try {
          errText = await response.text();
        } catch (_) {}
        console.error(`Google Drive API error details: Status ${response.status}, Body: ${errText}`);
        throw new Error(`Google Drive API responded with status ${response.status}: ${errText}`);
      }

      const buffer = await response.arrayBuffer();
      const base64 = Buffer.from(buffer).toString('base64');
      const contentType = response.headers.get('content-type') || 'image/jpeg';
      res.json({ base64, contentType });
    } catch (error) {
      console.error("Proxy Drive Error:", error);
      res.status(500).json({ error: error.message || "Failed to fetch file from Google Drive" });
    }
  });

  app.post("/api/analyze", async (req, res) => {
    const { image, mimeType } = req.body;
    if (!image) return res.status(400).json({ error: "No image provided" });

    const ROBOFLOW_API_KEY = process.env.ROBOFLOW_API_KEY || "J0bn4BnNYHwpiVS6RlKV";
    const model_id = "strawberry-disease-detection-dataset/1";
    const api_url = `https://serverless.roboflow.com/${model_id}?api_key=${ROBOFLOW_API_KEY}`;

    try {
      const roboflowRes = await fetch(api_url, {
        method: "POST",
        body: image,
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        }
      });

      if (!roboflowRes.ok) {
        const errText = await roboflowRes.text();
        throw new Error(`Roboflow analysis failed: ${errText}`);
      }

      const data = await roboflowRes.json();
      res.json(data);
    } catch (error) {
      console.error("Analysis Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    console.log("Initializing Vite middleware...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    console.log("Vite middleware initialized.");
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  console.log(`Attempting to listen on port ${PORT}...`);
  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server successfully running on http://localhost:${PORT}`);
  });
}

startServer();
