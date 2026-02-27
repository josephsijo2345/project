import express from "express";
import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { createServer as createViteServer } from "vite";
import { createClient } from "@supabase/supabase-js";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Supabase
const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function startServer() {
  const app = express();
  const server = createServer(app);
  const wss = new WebSocketServer({ server });
  const PORT = 3000;

  app.use(express.json());

  // Broadcast to all clients
  const broadcast = (data: any) => {
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(data));
      }
    });
  };

  // API Routes
  app.get("/api/confessions", async (req, res) => {
    try {
      const { data, error } = await supabase
        .from('user')
        .select('*')
        .limit(50);

      if (error) throw error;

      const COLORS = [
        'bg-purple-500', 'bg-blue-500', 'bg-pink-500', 
        'bg-emerald-500', 'bg-amber-500', 'bg-indigo-500',
        'bg-rose-500', 'bg-cyan-500'
      ];

      // Map Supabase columns to app structure
      const confessions = (data || []).map(item => {
        // Derive a consistent color and initial from the ID or text if ID is missing
        const seed = item.id ? String(item.id) : item.confessions;
        const hash = seed.split('').reduce((acc: number, char: string) => acc + char.charCodeAt(0), 0);
        const color = COLORS[hash % COLORS.length];
        const initial = String.fromCharCode(65 + (hash % 26));

        return {
          id: item.id || Math.random().toString(36),
          text: item.confessions,
          author_color: color,
          author_initial: initial,
          timestamp: item.created_at || new Date().toISOString(),
          echoes: item.like || 0,
          whispers: 0
        };
      });

      res.json(confessions);
    } catch (error: any) {
      console.error("Supabase fetch error:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/confessions", async (req, res) => {
    const { text } = req.body;
    if (!text || text.length > 500) {
      return res.status(400).json({ error: "Invalid confession" });
    }

    try {
      const { data, error } = await supabase
        .from('user')
        .insert([
          { 
            confessions: text, 
            like: 0 
          }
        ])
        .select()
        .single();

      if (error) throw error;
      if (!data) throw new Error("No data returned from Supabase");

      const COLORS = [
        'bg-purple-500', 'bg-blue-500', 'bg-pink-500', 
        'bg-emerald-500', 'bg-amber-500', 'bg-indigo-500',
        'bg-rose-500', 'bg-cyan-500'
      ];
      
      const seed = data.id ? String(data.id) : data.confessions || "anonymous";
      const hash = seed.split('').reduce((acc: number, char: string) => acc + char.charCodeAt(0), 0);
      const color = COLORS[hash % COLORS.length];
      const initial = String.fromCharCode(65 + (hash % 26));

      const newConfession = {
        id: data.id || Math.random().toString(36),
        text: data.confessions,
        author_color: color,
        author_initial: initial,
        timestamp: data.created_at || new Date().toISOString(),
        echoes: data.like || 0,
        whispers: 0,
      };

      broadcast({ type: "NEW_CONFESSION", payload: newConfession });
      res.status(201).json(newConfession);
    } catch (error: any) {
      console.error("Supabase insert error:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/confessions/:id/echo", async (req, res) => {
    const { id } = req.params;
    try {
      // Get current likes first to increment
      const { data: current, error: fetchError } = await supabase
        .from('user')
        .select('like')
        .eq('id', id)
        .single();
      
      if (fetchError) throw fetchError;

      const newCount = (current.like || 0) + 1;

      const { error: updateError } = await supabase
        .from('user')
        .update({ like: newCount })
        .eq('id', id);

      if (updateError) throw updateError;

      broadcast({ type: "UPDATE_ECHOES", payload: { id, echoes: newCount } });
      res.json({ success: true, echoes: newCount });
    } catch (error: any) {
      console.error("Supabase update error:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist/index.html"));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`The Void is open at http://localhost:${PORT}`);
  });
}

startServer();
