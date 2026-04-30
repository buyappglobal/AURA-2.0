import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import cors from "cors";
import helmet from "helmet";
import * as admin from 'firebase-admin';

// Aura Engine V2.1 - Core Logic (Edge Cache Optimized)
const R2_BASE = "https://media.auradisplay.es/";

// Function to get current hour in Madrid
function getMadridHour() {
  const madridTime = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Madrid",
    hour: "numeric",
    hour12: false,
  }).format(new Date());
  return parseInt(madridTime);
}

// Lazy initialization of Firebase Admin
let db: admin.firestore.Firestore | null = null;
function getFirestore() {
  if (!db) {
    if (process.env.FIREBASE_CONFIG) {
      admin.initializeApp();
    } else {
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

// Global Cache for Worker Responses (5 minutes)
const workerCache: Record<string, { tracks: string[], expiry: number }> = {};

// Fallback tracks (only used if Worker is offline) - Expanded variety to reduce repeats
const FOLDER_TRACKS: Record<string, string[]> = {
  morning: ["aura_breakfast.mp3", "aura_morning.mp3", "morning_vibes_1.mp3", "morning_vibes_2.mp3"],
  aperitivo: ["aura_aperitivo.mp3", "aura_aperitivo_ready.mp3", "social_mix_1.mp3", "social_mix_2.mp3"],
  active: ["aura_active.mp3", "aura_chill-out_peak.mp3", "business_flow_1.mp3", "business_flow_2.mp3", "energy_boost_1.mp3"],
  sunset: ["aura_sunset.mp3", "aura_gold.mp3", "aura_relax.mp3", "aura_lounge.mp3", "chill_sunset_extra.mp3"],
  nocturno: ["aura_midnight.mp3", "aura_premium.mp3", "night_design_1.mp3", "night_design_2.mp3"],
  midnight: ["aura_at_midnight5.mp3", "cajón_seco_lavanda.mp3", "deep_sleep_1.mp3", "deep_sleep_2.mp3"],
  marbella: ["aura_marbella.mp3", "aura_beach.mp3", "marbella_luxury_1.mp3", "marbella_luxury_2.mp3"],
  aura_flamenca: ["aura_flamenca.mp3", "aura_guitar.mp3", "flamenco_fusion_1.mp3", "flamenco_fusion_2.mp3"]
};

async function getTracksFromWorker(folder: string): Promise<string[]> {
  const now = Date.now();
  if (workerCache[folder] && workerCache[folder].expiry > now) {
    return workerCache[folder].tracks;
  }

  try {
    console.log(`Cloud Engine: Syncing with Worker for folder [${folder}]...`);
    const response = await fetch(`${R2_BASE}${folder}`, {
      headers: { 'Accept': 'application/json' }
    });
    
    if (response.ok) {
      const data: any = await response.json();
      if (data.tracks && Array.isArray(data.tracks) && data.tracks.length > 0) {
        // Cache for 5 minutes
        workerCache[folder] = {
          tracks: data.tracks,
          expiry: now + 300000
        };
        return data.tracks;
      }
    }
  } catch (e) {
    console.error(`Cloud Engine: Worker Sync failed for ${folder}:`, e);
  }

  // Fallback
  return FOLDER_TRACKS[folder] || ["aura_active.mp3"];
}

const DEFAULT_SCHEDULE = [
  { start: 0, end: 8, folder: "midnight", quote: "SILENCIO DE MEDIANOCHE", category: "NIGHT" },
  { start: 8, end: 12, folder: "aperitivo", quote: "MOMENTO APERITIVO", category: "SOCIAL" },
  { start: 12, end: 17, folder: "active", quote: "MÁXIMA PRODUCTIVIDAD", category: "BUSINESS" },
  { start: 17, end: 20, folder: "sunset", quote: "ATMÓSFERA RELAX", category: "LOUNGE" },
  { start: 20, end: 24, folder: "nocturno", quote: "DISEÑO SONORO NOCTURNO", category: "PREMIUM" }
];

const TICKERS = [
  "AURA V2.1 // DYNAMIC SYNC ENABLED • SINCRONIZACIÓN R2 CLOUDFLARE ACTIVA",
  "OPTIMIZADO PARA SMART TVS • TECNOLOGÍA CLOUDFLARE EDGE • INTEGRACIÓN TOTAL",
  "GESTIÓN REMOTA DESDE GOOGLE CLOUD • SEGURIDAD EMPRESARIAL • ELEVA TU ESPACIO"
];

const BACKGROUNDS = [
  "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&q=80&w=1920",
  "https://images.unsplash.com/photo-1497366811353-6870744d04b2?auto=format&fit=crop&q=80&w=1920",
  "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&q=80&w=1920",
  "https://images.unsplash.com/photo-1434626881859-194d67b2b86f?auto=format&fit=crop&q=80&w=1920"
];

async function computeAuraManifest(clientId: string, skip: boolean = false, exclude?: string) {
  const isGlobal = clientId === 'global';
  const now = new Date();
  
  // Deterministic seed based on Madrid time for Global Sync
  const madridTimeStr = now.toLocaleString("en-GB", {timeZone: "Europe/Madrid", hour12: false});
  // madridTimeStr example: "30/04/2026, 08:15:22"
  const timeParts = madridTimeStr.split(', ')[1].split(':');
  const h = parseInt(timeParts[0]);
  const m = parseInt(timeParts[1]);
  const minutesSinceMidnight = (h * 60) + m;
  
  // Selection Logic: Rotate tracks every 4 minutes (closer to avg song length)
  const TRACK_INTERVAL_MINS = 4;
  const currentSlotIndex = Math.floor(minutesSinceMidnight / TRACK_INTERVAL_MINS);
  
  let currentSchedule = DEFAULT_SCHEDULE;
  let clientName = "Aura Hub";
  let forcedFolder: string | null = null;
  let forcedQuote: string | null = null;
  let forcedCategory: string | null = null;
  let clientIdForCompute = clientId;

  // Real Compute: Fetching from Google Cloud Firestore
  if (!isGlobal) {
    try {
      const firestore = getFirestore();
      const clientDoc = await firestore.collection('clientes').doc(clientId).get();
      if (clientDoc.exists) {
        const data = clientDoc.data() || {};
        clientName = data.nombre || clientName;

        if (data.modo_manual && data.modo_manual.activo && data.modo_manual.carpeta) {
          forcedFolder = data.modo_manual.carpeta;
          forcedQuote = "IMPULSO AURA ACTIVADO";
          forcedCategory = "ENERGY";
        }

        if (!forcedFolder && data.circadian_schedule) {
          currentSchedule = data.circadian_schedule;
        }
      }
    } catch (error) {
      console.error("Cloud Engine Error:", error);
    }
  }
  
  const hour = getMadridHour();
  const slot = currentSchedule.find(s => hour >= s.start && hour < s.end) || DEFAULT_SCHEDULE[3];
  const folder = forcedFolder || slot.folder;
  const quote = forcedQuote || (isGlobal ? "BIENVENIDO AL ECOSISTEMA AURA" : slot.quote);
  const category = forcedCategory || (isGlobal ? "MODO GLOBAL ACTIVO" : slot.category);

  // FETCH REAL TRACKS FROM BUCKET (via Worker)
  let availableTracks = await getTracksFromWorker(folder);
  
  // Final Track Selection
  let trackFile: string;
  if (skip) {
    // Logic: If skip requested and we have current track name, try to filter it out
    let tracksToPickFrom = availableTracks;
    if (exclude && availableTracks.length > 1) {
      tracksToPickFrom = availableTracks.filter(t => !exclude.includes(t));
      if (tracksToPickFrom.length === 0) tracksToPickFrom = availableTracks;
    }
    
    const randomOffset = Math.floor(Math.random() * tracksToPickFrom.length);
    trackFile = tracksToPickFrom[randomOffset];
    console.log(`Cloud Engine [${clientId}]: SKIP REQUESTED. Folder: ${folder}, Exclude: ${exclude || 'none'}, Picked: ${trackFile}`);
  } else {
    // Sync logic: slot index + folder name length (as salt) % count
    const finalIndex = (currentSlotIndex + folder.length) % availableTracks.length;
    trackFile = availableTracks[finalIndex];
    console.log(`Cloud Engine [${clientId}]: SYNC MODE. Folder: ${folder}, Slot: ${currentSlotIndex}, Track: ${trackFile}`);
  }

  const bgIndex = currentSlotIndex % BACKGROUNDS.length;
  const trackUrl = `${R2_BASE}${folder}/${trackFile}`;

  return {
    track: {
      url: trackUrl,
      title: trackFile.replace(/\.mp3$/, '').replace(/_/g, ' ').toUpperCase(),
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
    
    // Permitir acceso sin secreto si la petición es local o si no hay secreto configurado
    const isLocal = req.hostname === 'localhost' || req.hostname.includes('run.app');
    
    if (expectedSecret && !isLocal && authHeader !== `Bearer ${expectedSecret}`) {
      return res.status(401).json({ error: "Unauthorized", message: "Aura Secret Key is required" });
    }

    const { clientId } = req.params;
    const skip = req.query.skip === 'true';
    const exclude = req.query.exclude as string;
    const manifest = await computeAuraManifest(clientId, skip, exclude);
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
