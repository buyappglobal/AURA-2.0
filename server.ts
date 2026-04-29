import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import cors from "cors";
import helmet from "helmet";
import * as admin from 'firebase-admin';

// Aura Engine V2.1 - Core Logic (Edge Cache Optimized)
const R2_BASE = "https://media.auradisplay.es/";

// Lazy initialization of Firebase Admin
let db: admin.firestore.Firestore | null = null;
function getFirestore() {
  if (!db) {
    if (process.env.FIREBASE_CONFIG) {
      admin.initializeApp();
    } else {
      // Intenta usar las credenciales del entorno o fallback local si existe
      try {
        admin.initializeApp({
          projectId: "gen-lang-client-0720259025",
        });
      } catch (e) {
        console.warn("Firebase Admin fallback mode");
      }
    }
    db = admin.firestore();
  }
  return db;
}

const DEFAULT_SCHEDULE = [
  { start: 0, end: 8, folder: "midnight", quote: "SILENCIO DE MEDIANOCHE", category: "NIGHT" },
  { start: 8, end: 11, folder: "morning", quote: "ENERGÍA MATINAL", category: "WELLNESS" },
  { start: 11, end: 13, folder: "aperitivo", quote: "MOMENTO APERITIVO", category: "SOCIAL" },
  { start: 13, end: 17, folder: "active", quote: "MÁXIMA PRODUCTIVIDAD", category: "BUSINESS" },
  { start: 17, end: 20, folder: "after-lunch", quote: "ATMÓSFERA RELAX", category: "LOUNGE" },
  { start: 20, end: 24, folder: "nocturno", quote: "DISEÑO SONORO NOCTURNO", category: "PREMIUM" }
];

const TICKERS = [
  "AURA V2.1 // EDGE CACHE ENABLED • SISTEMA CIRCADIANO ACTIVO",
  "OPTIMIZADO PARA SMART TVS • TECNOLOGÍA CLOUDFLARE EDGE • INTEGRACIÓN TOTAL",
  "GESTIÓN REMOTA DESDE GOOGLE CLOUD • SEGURIDAD EMPRESARIAL • ELEVA TU ESPACIO"
];

const BACKGROUNDS = [
  "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&q=80&w=1920",
  "https://images.unsplash.com/photo-1497366811353-6870744d04b2?auto=format&fit=crop&q=80&w=1920",
  "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&q=80&w=1920",
  "https://images.unsplash.com/photo-1434626881859-194d67b2b86f?auto=format&fit=crop&q=80&w=1920"
];

// Core Track Mapping (Aura Music Library V2)
const FOLDER_TRACKS: Record<string, string[]> = {
  morning: [
    "Aura Breakfast", "Aura Breakfast2", "Aura Active", "Aura Active2", "Aura Active3", 
    "Aura Active4", "Aura Active5", "Aura Active6", "Aura Wellness", "Aura Wellness2"
  ],
  aperitivo: [
    "Aura Aperitivo", "Aura Aperitivo2", "Aura Aperitivo3", "Aura Aperitivo4", 
    "Aura Aperitivo Ready", "Aura Aperitivo Ready2"
  ],
  active: [
    "Aura Activa", "Aura Activa2", "Aura Active", "Aura Active2", "Aura Active3", 
    "Aura Active4", "Aura Active5", "Aura Active6"
  ],
  "after-lunch": [
    "Aura Active", "Aura Active2", "Aura Relax", "Aura Lounge", "Aura Soft"
  ],
  nocturno: [
    "Aura Midnight", "Aura Midnight2", "Aura Deep", "Aura Premium"
  ],
  midnight: [
    "aura_midnight", "aura_midnight2", "aura_midnight3", "aura_midnight4", 
    "aura_at_midnight5", "aura_at_midnight6", "aura_at_midnight7", "aura_at_midnight8", 
    "aura_before_midnight", "aura_before_midnight2", "cajón_seco_lavanda"
  ]
};

async function computeAuraManifest(clientId: string) {
  const isGlobal = clientId === 'global';
  const now = new Date();
  const hour = now.getHours();
  
  let currentSchedule = DEFAULT_SCHEDULE;
  let clientName = "Aura Hub";

  // Real Compute: Fetching from Google Cloud Firestore
  if (!isGlobal) {
    try {
      const db = getFirestore();
      const clientDoc = await db.collection('clientes').doc(clientId).get();
      if (clientDoc.exists) {
        const data = clientDoc.data() || {};
        clientName = data.nombre || clientName;
        // Override circadiano si el cliente tiene uno propio
        if (data.circadian_schedule) {
          currentSchedule = data.circadian_schedule;
        }
      }
    } catch (error) {
      console.error("Cloud Engine Error:", error);
    }
  }
  
  // Slot detection
  const slot = currentSchedule.find(s => hour >= s.start && hour < s.end) || DEFAULT_SCHEDULE[3];
  
  // Selection Logic
  const folder = slot.folder;
  const quote = isGlobal ? "BIENVENIDO AL ECOSISTEMA AURA" : slot.quote;
  const category = isGlobal ? "MODO GLOBAL ACTIVO" : slot.category;

  // Asset Rotation Logic (Cloud Side)
  const seed = Math.floor(now.getTime() / (300000)); // Cambia cada 5 minutos
  
  // Deterministic track selection based on folder availability
  const availableTracks = FOLDER_TRACKS[folder] || ["track_1"];
  const trackName = availableTracks[seed % availableTracks.length];
  const bgIndex = seed % BACKGROUNDS.length;
  
  // URL Encoding is vital for spaces in filenames (e.g., "Aura Active5")
  const encodedTrackName = encodeURIComponent(trackName);
  const trackUrl = `${R2_BASE}${folder}/${encodedTrackName}.mp3`;

  return {
    track: {
      url: trackUrl,
      title: `${trackName.replace(/_/g, ' ').toUpperCase()}`,
      folder: folder,
      clientName: clientName
    },
    visuals: {
      backgroundUrl: BACKGROUNDS[bgIndex],
      backgroundType: "image",
      quote: quote,
      category: category,
      ticker: TICKERS
    },
    timestamp: now.toISOString()
  };
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());
  app.use(helmet({
    contentSecurityPolicy: false // Para permitir media externa en el SPA
  }));

  app.get("/api/session/:clientId", async (req, res) => {
    // Validación de Seguridad V2.0
    const authHeader = req.headers.authorization;
    const expectedSecret = process.env.AURA_SECRET_KEY;
    
    // Si hay un secreto configurado, validamos. Si no (desarrollo), permitimos.
    if (expectedSecret && authHeader !== `Bearer ${expectedSecret}`) {
      return res.status(401).json({ error: "Unauthorized", message: "Aura Secret Key is required" });
    }

    const { clientId } = req.params;
    const manifest = await computeAuraManifest(clientId);
    res.json(manifest);
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
    console.log(`Aura V2.0 Cloud Engine running on http://localhost:${PORT}`);
  });
}

startServer();
