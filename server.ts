import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import cors from "cors";
import helmet from "helmet";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // API Edge Aura V2.0 - Simulación de Cloudflare Worker / Google Cloud Logic
  app.get("/api/session/:clientId", async (req, res) => {
    const { clientId } = req.params;
    
    const isGlobal = clientId === 'global';

    // Mock del Manifest (En producción esto es dinámico y ultra-rápido)
    const mockManifest = {
      track: {
        url: "https://pub-4d6428c8907b4618a8047970b8a13cb8.r2.dev/active/sample_ambient.mp3",
        title: isGlobal ? "AURA GLOBAL - STREAMING V2.0" : "Aura Mood - Cloudflare Delivery",
        folder: "active"
      },
      visuals: {
        backgroundUrl: "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&q=80&w=1920",
        backgroundType: "image",
        quote: isGlobal ? "BIENVENIDO AL ECOSISTEMA AURA" : "TECNOLOGÍA AURA BUSINESS V2.0",
        category: isGlobal ? "MODO GLOBAL ACTIVO" : "EDGE-DRIVEN CONTENT",
        ticker: [
          "OPTIMIZADO PARA SMART TVS",
          "CONTENIDO SERVIDO DESDE CLOUDFLARE R2",
          "CONECTIVIDAD TOTAL CON GOOGLE CLOUD"
        ]
      }
    };

    res.json(mockManifest);
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Aura V2.0 Server running on http://localhost:${PORT}`);
  });
}

startServer();
