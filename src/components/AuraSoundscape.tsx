import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Play, Pause, Volume2, Moon, Sun, ShieldCheck, 
  Activity, Loader2, Tv, Maximize2 
} from 'lucide-react';
import { 
  doc, onSnapshot, updateDoc, serverTimestamp, increment, setDoc 
} from 'firebase/firestore';
import { 
  db, handleFirestoreError, OperationType 
} from '../firebase';
import { QRCodeSVG } from 'qrcode.react';
import { AuraBackgroundPlayer } from './aura/AuraBackgroundPlayer';
import { AuraContentLayer } from './aura/AuraContentLayer';
import AuraAgent from './AuraAgent';

// Configuración V2.1 (Aura Edge Network)
const CLOUDFLARE_EDGE_API = 'https://aura-worker-v2.holasolonet.workers.dev/api/session/';
const R2_BASE_URL = 'https://pub-4d6428c8907b4618a8047970b8a13cb8.r2.dev/';

interface EdgeManifest {
  track: {
    url: string;
    title: string;
    folder: string;
    clientName?: string;
  };
  visuals: {
    backgroundUrl: string;
    backgroundType: 'video' | 'image';
    quote: string;
    category: string;
    ticker: string[];
  };
}

export default function AuraSoundscape() {
  const [searchParams] = useSearchParams();
  const urlClientId = searchParams.get('id');
  const [clientId, setClientId] = useState<string | null>(urlClientId || localStorage.getItem('aura_last_client_id'));
  const [pairingCode, setPairingCode] = useState<string | null>(null);

  // --- States ---
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.5);
  const [currentTrackTitle, setCurrentTrackTitle] = useState('Sincronizando...');
  const [time, setTime] = useState(new Date());
  
  const [establishmentName, setEstablishmentName] = useState('Aura Business');
  const [location, setLocation] = useState('Madrid');
  const [weather] = useState({ temp: '22°', condition: 'Despejado' });
  const [performanceMode, setPerformanceMode] = useState<'high' | 'eco'>('high');
  // Aura UI V2.1 - Edge Integrated
  const [isZenMode, setIsZenMode] = useState(false);
  const [theme, setTheme] = useState('minimal');
  const [tickerTheme, setTickerTheme] = useState('dark');
  const [showTicker, setShowTicker] = useState(true);

  // States derived from Edge Manifest
  const [edgeManifest, setEdgeManifest] = useState<EdgeManifest | null>(null);
  const [bars, setBars] = useState<number[]>(Array(64).fill(2));

  // --- Refs ---
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioPlayerRef = useRef({
    instanceId: 0,
    currentSource: null as AudioBufferSourceNode | null,
    currentGain: null as GainNode | null,
    activeTimeout: null as any
  });

  // --- Sync Logic (The Heart of V2.0) ---
  const syncWithEdge = useCallback(async () => {
    if (!clientId) return;
    try {
      const response = await fetch(`${CLOUDFLARE_EDGE_API}${clientId}`);
      if (!response.ok) throw new Error("Edge Sync Failed");
      const manifest: EdgeManifest = await response.json();
      setEdgeManifest(manifest);
      return manifest;
    } catch (err) {
      console.error("Cloudflare Edge Error:", err);
      return null;
    }
  }, [clientId]);

  // --- Pairing Logic ---
  useEffect(() => {
    if (clientId) return;

    // Generar código de vinculación aleatorio (6 chars)
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    setPairingCode(code);

    const docRef = doc(db, 'pairingCodes', code);
    setDoc(docRef, {
      code: code,
      deviceId: 'DEVICE-' + Math.random().toString(36).substring(2, 10).toUpperCase(),
      status: 'waiting',
      createdAt: serverTimestamp(),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000) // 10 mins
    }).catch(err => console.error("Pairing Error:", err));

    const unsub = onSnapshot(docRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.linkedClientId) {
          localStorage.setItem('aura_last_client_id', data.linkedClientId);
          setClientId(data.linkedClientId);
        }
      }
    });

    return () => unsub();
  }, [clientId]);

  const playSequence = useCallback(async () => {
    if (!isPlaying) return;
    const myInstanceId = ++audioPlayerRef.current.instanceId;
    
    // 1. Asegurar que tenemos el manifest antes de intentar reproducir
    let manifest = edgeManifest;
    if (!manifest) {
      manifest = await syncWithEdge();
    }
    
    if (!manifest || audioPlayerRef.current.instanceId !== myInstanceId) return;

    if (!audioCtxRef.current) audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    if (audioCtxRef.current.state === 'suspended') await audioCtxRef.current.resume();

    try {
      const trackRes = await fetch(manifest.track.url);
      const buffer = await audioCtxRef.current.decodeAudioData(await trackRes.arrayBuffer());
      
      if (audioPlayerRef.current.instanceId !== myInstanceId) return;

      const oldGain = audioPlayerRef.current.currentGain;
      if (oldGain && audioCtxRef.current) {
        oldGain.gain.exponentialRampToValueAtTime(0.001, audioCtxRef.current.currentTime + 4);
      }

      const source = audioCtxRef.current.createBufferSource();
      source.buffer = buffer;
      const gainNode = audioCtxRef.current.createGain();
      gainNode.gain.setValueAtTime(0, audioCtxRef.current.currentTime);
      gainNode.gain.linearRampToValueAtTime(volume, audioCtxRef.current.currentTime + 3);

      source.connect(gainNode);
      if (analyserRef.current) gainNode.connect(analyserRef.current);
      else gainNode.connect(audioCtxRef.current.destination);

      audioPlayerRef.current.currentSource = source;
      audioPlayerRef.current.currentGain = gainNode;
      setCurrentTrackTitle(manifest.track.title);

      source.start(0);

      if (audioPlayerRef.current.activeTimeout) clearTimeout(audioPlayerRef.current.activeTimeout);
      audioPlayerRef.current.activeTimeout = setTimeout(() => {
        if (audioPlayerRef.current.instanceId === myInstanceId && isPlaying) playSequence();
      }, (buffer.duration - 4) * 1000);

    } catch (err) {
      setTimeout(() => isPlaying && playSequence(), 5000);
    }
  }, [isPlaying, volume, syncWithEdge]);

  // --- Firestore & Lifecycle ---
  useEffect(() => {
    if (!clientId) return;
    const unsub = onSnapshot(doc(db, 'displays', clientId), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setEstablishmentName(data.establishmentName || 'Aura Business');
        setLocation(data.location || 'Madrid');
        setPerformanceMode(data.performanceMode || 'high');
        setIsZenMode(data.isZenMode || false);
        setTheme(data.theme || 'minimal');
        setTickerTheme(data.tickerTheme || 'dark');
        setShowTicker(data.showTicker !== false);
        
        if (data.refreshRequestedAt) {
          const now = Date.now();
          if (now - data.refreshRequestedAt < 5000) window.location.reload();
        }
      }
    }, (err) => handleFirestoreError(err, OperationType.GET, `displays/${clientId}`));
    
    return () => unsub();
  }, [clientId]);

  useEffect(() => {
    if (clientId) {
      syncWithEdge();
      // Refrescar manifest cada 5 minutos por si cambia el hilo circadiano en el servidor
      const interval = setInterval(syncWithEdge, 300000);
      return () => clearInterval(interval);
    }
  }, [clientId, syncWithEdge]);

  useEffect(() => {
    if (isPlaying && edgeManifest) {
      playSequence();
    } else {
      if (audioPlayerRef.current.currentSource) {
        try { audioPlayerRef.current.currentSource.stop(); } catch(e) {}
        audioPlayerRef.current.currentSource = null;
      }
    }
  }, [isPlaying, playSequence]);

  // Aura Guard (Silence)
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      if (audioCtxRef.current?.state === 'running' && isPlaying && !audioPlayerRef.current.currentSource) {
        console.warn("Aura Guard: Forzando siguiente pista...");
        playSequence();
      }
    }, 20000);
    return () => clearInterval(interval);
  }, [isPlaying, playSequence]);

  // Visualizer Logic
  useEffect(() => {
    if (!isPlaying) return;
    if (!audioCtxRef.current) audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    if (!analyserRef.current) {
      analyserRef.current = audioCtxRef.current.createAnalyser();
      analyserRef.current.fftSize = 128;
      analyserRef.current.connect(audioCtxRef.current.destination);
    }

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    let animationId: number;
    
    const update = () => {
      if (!isPlaying || !analyserRef.current) return;
      analyserRef.current.getByteFrequencyData(dataArray);
      const newBars = Array.from(dataArray.slice(0, 64)).map(v => 2 + (v / 255) * 40);
      setBars(newBars);
      animationId = requestAnimationFrame(update);
    };
    update();
    return () => cancelAnimationFrame(animationId);
  }, [isPlaying]);

  // Clock
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  if (!clientId) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center p-8 text-center space-y-6 text-white selection:bg-gold/30 font-sans">
        <Tv className="w-16 h-16 text-gold animate-pulse" />
        <h1 className="text-2xl font-bold tracking-tighter uppercase">Vincular Pantalla V2.0</h1>
        <p className="text-white/40 text-[10px] uppercase tracking-widest max-w-xs leading-loose">Introduce tu Client ID en la URL o vincula este dispositivo desde el Panel Aura.</p>
        <div className="p-1 border border-white/10 rounded-3xl bg-white/5 backdrop-blur-xl shadow-2xl">
           <div className="bg-white p-4 rounded-2xl flex flex-col items-center gap-4">
             {pairingCode ? (
               <>
                <QRCodeSVG 
                  value={`${window.location.origin}/admin/pair?code=${pairingCode}`} 
                  size={200}
                  level="H"
                  includeMargin={true}
                />
                <div className="text-black font-black text-3xl tracking-[0.2em]">{pairingCode}</div>
               </>
             ) : (
               <div className="w-52 h-64 flex items-center justify-center">
                 <Loader2 className="w-8 h-8 text-black/10 animate-spin" />
               </div>
             )}
           </div>
        </div>
        <div className="flex flex-col gap-3 w-full max-w-xs">
          <button 
            onClick={() => {
              setClientId('global');
              setIsPlaying(true);
            }}
            className="px-8 py-3 bg-white text-black text-[10px] font-bold uppercase tracking-widest rounded-full hover:bg-gold transition-colors"
          >
            Visualizar Modo Global
          </button>
          <button 
            onClick={() => window.location.href='/admin/login'} 
            className="px-8 py-3 bg-white/5 border border-white/10 text-white/40 text-[10px] font-bold uppercase tracking-widest rounded-full hover:text-white transition-colors"
          >
            Ir al Panel de Control
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-black text-white selection:bg-gold/30 overflow-hidden font-sans">
      <AuraBackgroundPlayer 
        performanceMode={performanceMode}
        isZenMode={isZenMode}
        activeImages={edgeManifest?.visuals.backgroundType === 'image' ? [edgeManifest.visuals.backgroundUrl] : []}
        currentImageIndex={0}
      />

      <div className="relative z-10 flex flex-col min-h-screen">
        <header className="p-8 flex justify-between items-start transition-all duration-1000" style={{ opacity: isZenMode ? 0 : 1 }}>
          <div className="space-y-1">
            <h2 className="text-xl font-bold tracking-tighter uppercase leading-none">
              {edgeManifest?.track.clientName || establishmentName}
            </h2>
            <div className="flex items-center gap-2 text-[10px] text-gold font-bold tracking-widest uppercase">
              <Activity className="w-3 h-3" />
              <span>AURA EDGE NETWORK V2.1 // ONLINE</span>
            </div>
          </div>
          <div className="text-right space-y-1">
            <div className="text-2xl font-light tracking-tighter leading-none">{time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
            <div className="text-[9px] text-white/40 tracking-[0.2em] font-bold uppercase">{weather.condition} // {weather.temp}</div>
          </div>
        </header>

        <main className="flex-1 flex flex-col items-center justify-center pointer-events-none">
          <AuraContentLayer 
            quote={edgeManifest ? { text: edgeManifest.visuals.quote, category: edgeManifest.visuals.category } : null}
            theme={theme}
            isZenMode={isZenMode}
          />
        </main>

        <footer className="p-8 space-y-6 transition-all duration-1000" style={{ opacity: isZenMode ? 0 : 1, transform: isZenMode ? 'translateY(100px)' : 'none' }}>
          <div className="max-w-4xl mx-auto flex flex-col items-center gap-4">
            <div className="flex items-center gap-8 pointer-events-auto">
              <button 
                onClick={() => setIsPlaying(!isPlaying)} 
                className="p-5 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 transition-all hover:scale-110 active:scale-95 group shadow-2xl"
              >
                {isPlaying ? <Pause /> : <Play className="fill-current" />}
              </button>
              <div className="text-center w-64">
                <div className="text-[10px] text-gold font-bold uppercase tracking-widest mb-1 opacity-80">AuraPlayer V2.0 // {edgeManifest?.track.folder?.toUpperCase()}</div>
                <div className="text-sm font-medium tracking-tight h-5 overflow-hidden">
                  <AnimatePresence mode="wait">
                    <motion.div key={currentTrackTitle} initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -10, opacity: 0 }}>
                      {currentTrackTitle.toUpperCase()}
                    </motion.div>
                  </AnimatePresence>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <Volume2 className="w-4 h-4 text-white/20" />
                <input 
                  type="range" min="0" max="1" step="0.01" value={volume} 
                  onChange={e => setVolume(parseFloat(e.target.value))} 
                  className="w-24 accent-gold bg-white/10 rounded-full cursor-pointer" 
                />
              </div>
            </div>
            
            <div className={`flex items-end justify-center gap-[2px] h-10 w-full max-w-xs ${performanceMode === 'eco' ? 'opacity-20' : 'opacity-40'}`}>
              {bars.map((h, i) => (
                <div key={i} className="w-1 bg-gold/80 rounded-t-full transition-all duration-75" style={{ height: `${h}px` }} />
              ))}
            </div>
          </div>

          {showTicker && edgeManifest?.visuals.ticker && (
            <div className={`overflow-hidden border-t border-white/5 py-4 ${tickerTheme === 'gold' ? 'bg-gold/10' : 'bg-black/40'} backdrop-blur-md`}>
              <div className="flex gap-12 whitespace-nowrap text-[10px] font-bold tracking-[0.3em] uppercase text-white/40">
                <motion.div animate={{ x: "-50%" }} transition={{ duration: 45, repeat: Infinity, ease: "linear" }} className="flex gap-12">
                  {Array(4).fill(edgeManifest.visuals.ticker.join(" • ") || "AURA BUSINESS • ").map((msg, i) => (
                    <span key={i}>{msg}</span>
                  ))}
                </motion.div>
              </div>
            </div>
          )}
        </footer>
      </div>

      <AuraAgent />
    </div>
  );
}
