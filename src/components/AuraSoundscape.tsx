import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Play, Pause, Volume2, Moon, Sun, ShieldCheck, 
  Activity, Loader2, Tv, Maximize2, Settings, RefreshCw, LogOut, MessageSquare
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
const MEDIA_BASE_URL = 'https://media.auradisplay.es/';

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
  const [isPlaying, setIsPlaying] = useState(true);
  const [volume, setVolume] = useState(0.8);
  const volumeRef = useRef(volume);
  const lastVolumeUpdateRef = useRef<number>(0);
  
  useEffect(() => {
    volumeRef.current = volume;
  }, [volume]);

  const [currentTrackTitle, setCurrentTrackTitle] = useState('Sincronizando...');
  const [time, setTime] = useState(new Date());
  
  const [establishmentName, setEstablishmentName] = useState('Aura Business');
  const [location, setLocation] = useState('Madrid');
  const [weather] = useState({ temp: '22°', condition: 'Despejado' });
  const [performanceMode, setPerformanceMode] = useState<'high' | 'eco'>('high');
  // Aura UI V2.1 - Edge Integrated
  const [isZenMode, setIsZenMode] = useState(false);
  const [isNoDistractionsMode, setIsNoDistractionsMode] = useState(false);
  const [isRemoteControl, setIsRemoteControl] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isUIActive, setIsUIActive] = useState(true);
  const uiTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const resetUITimer = useCallback(() => {
    setIsUIActive(true);
    if (uiTimeoutRef.current) clearTimeout(uiTimeoutRef.current);
    uiTimeoutRef.current = setTimeout(() => {
      if (!showSettings && !isChatOpen) {
        setIsUIActive(false);
      }
    }, 5000);
  }, [showSettings, isChatOpen]);

  useEffect(() => {
    const events = ['mousemove', 'touchstart', 'mousedown', 'keydown'];
    const handleActivity = () => resetUITimer();
    events.forEach(e => window.addEventListener(e, handleActivity));
    resetUITimer();
    return () => {
      events.forEach(e => window.removeEventListener(e, handleActivity));
      if (uiTimeoutRef.current) clearTimeout(uiTimeoutRef.current);
    };
  }, [resetUITimer]);
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
  const lastSkipTriggerRef = useRef<number | null>(null);

  // Desbloqueo global de audio (Necesario para navegadores modernos)
  const resumeContext = useCallback(async () => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioCtxRef.current.state === 'suspended') {
      try {
        await audioCtxRef.current.resume();
        console.log("Aura: AudioContext desbloqueado por el usuario.");
      } catch (e) {
        console.warn("Aura: Fallo al intentar desbloquear AudioContext", e);
      }
    }
  }, []);

  // --- Sync Logic (The Heart of V2.0) ---
  const syncWithEdge = useCallback(async (skip = false) => {
    if (!clientId) return;
    try {
      const url = new URL(`${CLOUDFLARE_EDGE_API}${clientId}`);
      if (skip) url.searchParams.append('skip', 'true');
      url.searchParams.append('t', Date.now().toString());

      const response = await fetch(url.toString(), {
        cache: 'no-cache',
        headers: {
          'Accept': 'application/json'
        }
      });
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

  const playSequence = useCallback(async (forceSkip = false) => {
    if (!isPlaying) return;
    const myInstanceId = ++audioPlayerRef.current.instanceId;
    
    // 1. Asegurar que tenemos el manifest antes de intentar reproducir
    let manifest = edgeManifest;
    if (!manifest || forceSkip) {
      manifest = await syncWithEdge(forceSkip);
    }
    
    if (!manifest || audioPlayerRef.current.instanceId !== myInstanceId) return;

    if (!audioCtxRef.current) audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    if (audioCtxRef.current.state === 'suspended') await audioCtxRef.current.resume();

    try {
      // 1. Usar directamente la URL del track proporcionada por el motor de Cloud (Edge)
      let readyUrl = manifest.track.url;
      
      // Normalización de respaldo en caso de recibir URLs internas de R2
      if (readyUrl.includes('r2.dev')) {
        readyUrl = readyUrl.replace(/https:\/\/[^/]+\//, 'https://media.auradisplay.es/');
      }
      
      console.log("AuraPlayer: Reproduciendo track orquestado por Cloud...", {
        title: manifest.track.title,
        url: readyUrl
      });

      const trackRes = await fetch(`${readyUrl}${readyUrl.includes('?') ? '&' : '?'}v=${clientId || "anonymous"}`, {
        mode: 'cors',
        credentials: 'omit'
      });
      
      if (!trackRes.ok) {
        throw new Error(`HTTP Error ${trackRes.status}: ${trackRes.statusText}`);
      }
      
      const arrayBuffer = await trackRes.arrayBuffer();
      console.log(`AuraPlayer: Buffer recibido (${arrayBuffer.byteLength} bytes).`);
      
      const buffer = await audioCtxRef.current.decodeAudioData(arrayBuffer);
      console.log("AuraPlayer: Audio decodificado con éxito. Iniciando reproducción.");
      
      if (audioPlayerRef.current.instanceId !== myInstanceId) return;

      const oldGain = audioPlayerRef.current.currentGain;
      if (oldGain && audioCtxRef.current) {
        oldGain.gain.exponentialRampToValueAtTime(0.001, audioCtxRef.current.currentTime + 4);
      }

      const source = audioCtxRef.current.createBufferSource();
      source.buffer = buffer;
      const gainNode = audioCtxRef.current.createGain();
      gainNode.gain.setValueAtTime(0, audioCtxRef.current.currentTime);
      gainNode.gain.linearRampToValueAtTime(volumeRef.current, audioCtxRef.current.currentTime + 3);

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
      console.error("AuraPlayer: Error crítico en secuencia de audio:", err);
      setTimeout(() => isPlaying && playSequence(), 5000);
    }
  }, [isPlaying, syncWithEdge]);

  // --- Firestore & Lifecycle ---
  // Listen to Firestore for manual mode changes (Impuestos)
  const lastManualUpdateRef = useRef<number>(-1);
  useEffect(() => {
    if (!clientId || clientId === 'global') return;
    
    console.log("AuraPlayer: Monitoring manual overrides...");
    const unsub = onSnapshot(doc(db, 'clientes', clientId), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        const manualUpdate = data.manualUpdateAt?.seconds || 0;
        
        // If technical timestamp changed, it means an admin forced a skip or changed folder
        if (manualUpdate > lastManualUpdateRef.current && lastManualUpdateRef.current !== -1) {
           console.log("AuraPlayer: Manual impulse detected. Skipping...");
           playSequence(true); 
        }
        lastManualUpdateRef.current = manualUpdate;
      }
    });

    return () => unsub();
  }, [clientId, playSequence]);

  useEffect(() => {
    if (!clientId || clientId === 'global') return;

    // Heartbeat & Ensure Document
    const heartbeatInterval = setInterval(async () => {
      try {
        await setDoc(doc(db, 'displays', clientId), {
          lastSeen: serverTimestamp(),
          status: 'online',
          clientId: clientId
        }, { merge: true });
      } catch (err) {
        console.error("Heartbeat Error:", err);
      }
    }, 60000);

    const unsub = onSnapshot(doc(db, 'displays', clientId), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setEstablishmentName(data.establishmentName || 'Aura Business');
        setLocation(data.location || 'Madrid');
        setPerformanceMode(data.performanceMode || 'high');
        setIsZenMode(data.isZenMode || false);
        
        // Solo actualizar si el volumen viene definido en el documento y ha pasado tiempo desde nuestra última actualización local
        const now = Date.now();
        if (data.volume !== undefined && Math.abs(data.volume - volume) > 0.01 && (now - lastVolumeUpdateRef.current > 3000)) {
          setVolume(data.volume);
        }
        
        setIsNoDistractionsMode(data.isNoDistractionsMode !== undefined ? data.isNoDistractionsMode : true);
        setIsRemoteControl(data.isRemoteControl || false);
        
        if (data.skipTrigger !== undefined) {
          if (lastSkipTriggerRef.current !== null && data.skipTrigger > lastSkipTriggerRef.current) {
            console.log("Aura: Salto de pista solicitado remotamente.");
            playSequence();
          }
          lastSkipTriggerRef.current = data.skipTrigger;
        }

        setTheme(data.theme || 'minimal');
        setTickerTheme(data.tickerTheme || 'dark');
        setShowTicker(data.showTicker !== false);
        
        if (data.refreshRequestedAt) {
          const now = Date.now();
          if (now - data.refreshRequestedAt < 5000) window.location.reload();
        }
      }
    }, (err) => {
      if (err.message.includes('permission-denied')) return;
      handleFirestoreError(err, OperationType.GET, `displays/${clientId}`)
    });
    
    return () => unsub();
  }, [clientId, volume, playSequence]);

  useEffect(() => {
    if (clientId) {
      syncWithEdge();
      // Refrescar manifest cada 5 minutos por si cambia el hilo circadiano en el servidor
      const interval = setInterval(syncWithEdge, 300000);
      return () => clearInterval(interval);
    }
  }, [clientId, syncWithEdge]);

  const togglePlay = async () => {
    await resumeContext();
    setIsPlaying(!isPlaying);
  };

  // --- Interaction & Lifecycle ---
  const [isAudioBlocked, setIsAudioBlocked] = useState(false);

  useEffect(() => {
    const checkAudioState = () => {
      if (audioCtxRef.current?.state === 'suspended') {
        setIsAudioBlocked(true);
      } else {
        setIsAudioBlocked(false);
      }
    };

    const handleFirstInteraction = () => {
      console.log("Aura: Interacción detectada, desbloqueando audio...");
      resumeContext().then(() => {
        setIsAudioBlocked(false);
        if (isPlaying && !audioPlayerRef.current.currentSource) {
          playSequence();
        }
      });
      window.removeEventListener('click', handleFirstInteraction);
      window.removeEventListener('touchstart', handleFirstInteraction);
      window.removeEventListener('keydown', handleFirstInteraction);
    };

    window.addEventListener('click', handleFirstInteraction);
    window.addEventListener('touchstart', handleFirstInteraction);
    window.addEventListener('keydown', handleFirstInteraction);

    const interval = setInterval(checkAudioState, 500);
    return () => {
      clearInterval(interval);
      window.removeEventListener('click', handleFirstInteraction);
      window.removeEventListener('touchstart', handleFirstInteraction);
      window.removeEventListener('keydown', handleFirstInteraction);
    };
  }, [isPlaying, playSequence, resumeContext]);

  // Update volume in real-time (Unified Controller)
  useEffect(() => {
    // Solo aplicar si no estamos en medio de un cambio de pista (instancia activa)
    // Pero en realidad queremos que el control manual siempre funcione.
    if (audioPlayerRef.current.currentGain && audioCtxRef.current) {
      const now = audioCtxRef.current.currentTime;
      // No cancelar valores agendados si estamos muy al principio de la pista (fade-in)
      // para no romper la rampa de entrada de 3 segundos
      // audioPlayerRef.current.currentGain.gain.cancelScheduledValues(now); 
      
      // Usar setTargetAtTime permite que el valor se mueva hacia el objetivo sin borrar la rampa actual
      // de forma tan brusca, aunque cancelScheduledValues suele ser necesario para cambios inmediatos.
      // Mejor: Solo cancelar si el cambio es manual (no disparado por inicio de pista)
      audioPlayerRef.current.currentGain.gain.setTargetAtTime(
        volume, 
        now, 
        0.1
      );
    }
  }, [volume]);

  // Play/Stop management
  useEffect(() => {
    if (isPlaying) {
      if (!audioPlayerRef.current.currentSource) {
        playSequence();
      }
    } else {
      if (audioPlayerRef.current.currentSource) {
        try {
          // Fade out antes de parar
          if (audioPlayerRef.current.currentGain && audioCtxRef.current) {
            audioPlayerRef.current.currentGain.gain.setTargetAtTime(0, audioCtxRef.current.currentTime, 0.2);
          }
          setTimeout(() => {
            if (audioPlayerRef.current.currentSource) {
              audioPlayerRef.current.currentSource.stop();
              audioPlayerRef.current.currentSource = null;
            }
          }, 300);
        } catch (e) {
          console.warn("Aura: Error al detener audio:", e);
        }
      }
      if (audioPlayerRef.current.activeTimeout) {
        clearTimeout(audioPlayerRef.current.activeTimeout);
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
      <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6 md:p-12 text-center space-y-8 md:space-y-12 text-white selection:bg-gold/30 font-sans overflow-y-auto">
        <div className="space-y-3">
          <Tv className="w-12 h-12 md:w-16 md:h-16 text-gold animate-pulse mx-auto" />
          <h1 className="text-xl md:text-3xl font-bold tracking-tighter uppercase">Vincular Pantalla V2.1</h1>
          <p className="text-white/40 text-[9px] md:text-xs uppercase tracking-widest max-w-xs mx-auto leading-loose px-4">
            Escanea el código o vincula este dispositivo en tiempo real desde el Panel de Control Aura.
          </p>
        </div>

        <div className="relative group p-1 border border-white/5 md:border-white/10 rounded-[2.5rem] bg-white/5 backdrop-blur-xl shadow-2xl transition-all hover:border-gold/30">
           <div className="bg-white p-4 md:p-8 rounded-[2rem] flex flex-col items-center gap-4 md:gap-6">
             {pairingCode ? (
               <>
                <QRCodeSVG 
                  value={`${window.location.origin}/admin?pair=${pairingCode}`} 
                  size={window.innerWidth < 768 ? 160 : 220}
                  level="H"
                  className="rounded-lg"
                />
                <div className="text-black font-black text-2xl md:text-4xl tracking-[0.2em]">{pairingCode}</div>
               </>
             ) : (
               <div className="w-40 h-52 md:w-52 md:h-64 flex items-center justify-center">
                 <Loader2 className="w-8 h-8 text-black/10 animate-spin" />
               </div>
             )}
           </div>
        </div>

        <div className="flex flex-col gap-3 w-full max-w-xs px-4">
          <button 
            onClick={() => {
              setClientId('global');
              setIsPlaying(true);
            }}
            className="w-full px-8 py-3.5 md:py-4 bg-white text-black text-[10px] md:text-xs font-bold uppercase tracking-widest rounded-full hover:bg-gold hover:text-white transition-all transform hover:scale-105 active:scale-95 shadow-xl"
          >
            Visualizar Modo Global
          </button>
          <button 
            onClick={() => window.location.href='/admin/login'} 
            className="w-full px-8 py-3.5 md:py-4 bg-white/5 border border-white/10 text-white/40 text-[10px] md:text-xs font-bold uppercase tracking-widest rounded-full hover:text-white hover:bg-white/10 transition-all"
          >
            Ir al Panel de Control
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-screen w-screen bg-black text-white selection:bg-gold/30 overflow-hidden font-sans flex flex-col">
      <AnimatePresence>
        {isAudioBlocked && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => {
              resumeContext();
            }}
            className="fixed inset-0 z-[200] bg-black/95 backdrop-blur-2xl flex flex-col items-center justify-center cursor-pointer group"
          >
            <div className="flex flex-col items-center gap-10">
              <div className="relative">
                <motion.div 
                  animate={{ 
                    scale: [1, 1.2, 1],
                    opacity: [0.2, 0.4, 0.2]
                  }}
                  transition={{ duration: 3, repeat: Infinity }}
                  className="absolute inset-0 -m-8 rounded-full bg-gold/20 blur-2xl"
                />
                <div className="w-28 h-28 md:w-32 md:h-32 rounded-full bg-gold/10 flex items-center justify-center border border-gold/30 group-hover:scale-110 transition-transform duration-500 shadow-[0_0_80px_rgba(212,175,55,0.3)]">
                  <Play size={48} className="text-gold fill-gold ml-1.5" />
                </div>
              </div>
              <div className="text-center space-y-4 px-8">
                <h2 className="text-2xl md:text-4xl font-bold uppercase tracking-[0.4em] text-white">Activar Aura Business</h2>
                <p className="text-[10px] md:text-xs uppercase tracking-[0.2em] text-white/50 max-w-sm mx-auto leading-relaxed">
                  Por motivos de seguridad de su televisor / navegador, <br/>pulse cualquier botón del mando para iniciar el audio.
                </p>
                <div className="pt-4">
                  <div className="inline-flex items-center gap-2 px-6 py-2 rounded-full bg-white/5 border border-white/10 text-[10px] font-bold uppercase tracking-widest text-gold animate-bounce">
                    <Tv size={14} />
                    <span>Pulsa OK en tu mando</span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!isNoDistractionsMode && (
        <AuraBackgroundPlayer 
          performanceMode={performanceMode}
          isZenMode={isZenMode}
          activeImages={edgeManifest?.visuals.backgroundType === 'image' ? [edgeManifest.visuals.backgroundUrl] : []}
          currentImageIndex={0}
        />
      )}

      {/* --- Left Branding Sidebar --- */}
      <div className={`absolute left-4 top-1/2 -translate-y-1/2 z-30 flex flex-col items-center gap-4 py-8 hidden md:flex pointer-events-none transition-opacity duration-1000 ${isNoDistractionsMode ? 'opacity-0' : 'opacity-100'}`}>
        <div className="flex flex-col items-center gap-2">
          <div className={`w-1.5 h-1.5 rounded-full ${isPlaying ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.6)]' : 'bg-red-500'} animate-pulse`} />
          <div className="[writing-mode:vertical-lr] rotate-180 text-[8px] font-black tracking-[0.5em] text-white/30 uppercase">
            Aura Broadcast System
          </div>
        </div>
      </div>

      {/* --- Global Mode Exit (Discreet) --- */}
      {clientId === 'global' && (
        <button 
          onClick={() => {
            localStorage.removeItem('aura_last_client_id');
            window.location.reload();
          }}
          className="absolute left-4 top-4 z-50 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-[8px] font-black uppercase tracking-widest text-white/40 hover:text-white hover:bg-white/10 transition-all pointer-events-auto"
        >
          Cerrar Demo Global
        </button>
      )}

      {/* --- Right Actions Sidebar --- */}
      {!isRemoteControl && (
        <motion.div 
          initial={false}
          animate={{ 
            opacity: isUIActive || showSettings ? 1 : 0,
            x: isUIActive || showSettings ? 0 : 20,
            pointerEvents: isUIActive || showSettings ? 'auto' : 'none'
          }}
          className="absolute right-4 top-1/2 -translate-y-1/2 z-40 flex flex-col gap-3"
        >
          <button 
            onClick={() => {
              if (clientId !== 'global') {
                setShowSettings(!showSettings);
                setIsUIActive(true);
              }
            }}
            className={`w-10 h-10 md:w-12 md:h-12 rounded-full bg-black/40 backdrop-blur-xl border border-white/10 flex items-center justify-center transition-all group lg:scale-100 scale-90 ${clientId !== 'global' ? 'hover:bg-gold hover:text-black cursor-pointer' : 'cursor-default opacity-40'}`}
          >
            <Settings size={20} className={clientId !== 'global' ? "group-hover:rotate-90 transition-transform duration-500" : ""} />
          </button>
          
          <AnimatePresence>
            {showSettings && clientId !== 'global' && (
              <motion.div 
                initial={{ x: 20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: 20, opacity: 0 }}
                className="flex flex-col gap-3"
              >
                <div className="bg-black/60 backdrop-blur-xl border border-white/10 rounded-2xl p-2 flex flex-col gap-2">
                  <button 
                    onClick={() => {
                      if (document.fullscreenElement) document.exitFullscreen();
                      else document.documentElement.requestFullscreen();
                    }}
                    className="w-10 h-10 md:w-11 md:h-11 rounded-xl bg-white/5 flex items-center justify-center hover:bg-white hover:text-black transition-all"
                    title="Pantalla Completa"
                  >
                    <Maximize2 size={18} />
                  </button>
                  <button 
                    onClick={() => window.location.href = '/admin/slides'}
                    className="w-10 h-10 md:w-11 md:h-11 rounded-xl bg-white/5 flex items-center justify-center hover:bg-gold hover:text-black transition-all"
                    title="Gestionar Slides"
                  >
                    <Activity size={18} />
                  </button>
                  <button 
                    onClick={() => window.location.href = '/admin'}
                    className="w-10 h-10 md:w-11 md:h-11 rounded-xl bg-white/5 flex items-center justify-center hover:bg-gold hover:text-black transition-all"
                    title="Configuración"
                  >
                    <Settings size={18} />
                  </button>
                  <button 
                    onClick={() => window.location.reload()}
                    className="w-10 h-10 md:w-11 md:h-11 rounded-xl bg-white/5 flex items-center justify-center hover:bg-white hover:text-black transition-all"
                    title="Sincronizar"
                  >
                    <RefreshCw size={18} />
                  </button>
                  <div className="h-px bg-white/10 mx-2" />
                  <button 
                    onClick={() => {
                      localStorage.removeItem('aura_last_client_id');
                      window.location.reload();
                    }}
                    className="w-10 h-10 md:w-11 md:h-11 rounded-xl bg-red-500/10 text-red-500 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all"
                    title="Vincular otro dispositivo"
                  >
                    <LogOut size={18} />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}

      {/* --- Main UI Layer --- */}
      <div className="relative z-20 flex flex-col h-screen w-screen">
        {/* Header: Dynamic Grid */}
        <header className="p-4 md:p-8 grid grid-cols-3 items-start transition-all duration-1000 w-full" style={{ opacity: isZenMode ? 0 : 1 }}>
          {/* Left: Time & Location */}
          <div className="flex flex-col items-start gap-1">
             <div className="flex items-center gap-2">
                <RefreshCw size={14} className="text-gold animate-spin-slow opacity-40" />
                <span className="text-lg md:text-2xl font-light tracking-tighter">{time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
             </div>
             <span className="text-[7px] md:text-[9px] text-white/40 uppercase font-black tracking-[0.2em] ml-5">{location}</span>
          </div>

          {/* Center: Branding */}
          <div className="flex flex-col items-center text-center space-y-1">
            <h1 className="text-lg md:text-2xl font-light tracking-[0.4em] uppercase">Aura Display</h1>
            <div className="text-[7px] md:text-[8px] text-white/30 tracking-[0.5em] font-bold uppercase">Multimedia Hub</div>
            <div className="flex items-center gap-1.5 opacity-20 hidden md:flex">
              <ShieldCheck size={8} className="text-gold" />
              <span className="text-[6px] uppercase tracking-widest">Licencia B2B</span>
            </div>
          </div>

          {/* Right: Weather */}
          <div className="flex flex-col items-end gap-1">
             <div className="flex items-center gap-2">
                <span className="text-lg md:text-2xl font-light tracking-tighter">{weather.temp}</span>
                <Sun size={18} className="text-gold opacity-40" />
             </div>
             <span className="text-[7px] md:text-[9px] text-white/40 uppercase font-black tracking-[0.2em] mr-5">{weather.condition}</span>
          </div>
        </header>

        {/* Content Area */}
        <main className="flex-1 flex flex-col items-center justify-center p-4 relative overflow-hidden">
          <AuraContentLayer 
            quote={edgeManifest ? { 
              text: edgeManifest.visuals.quote, 
              category: edgeManifest.visuals.category.toUpperCase(),
              price: edgeManifest.track.clientName // Usamos el nombre del cliente como subtexto si no hay precio
            } : {
              text: [
                "Bienvenido al Ecosistema Aura: La nueva era del Digital Signage.",
                "Gestión de espacios híbridos: Audio, Contenido y Analítica en un solo lugar.",
                "Sonido Circadiano: Música que evoluciona con el ritmo de tu negocio.",
                "Interactividad Total: Convierte cualquier pantalla en un punto de contacto inteligente.",
                "Diseño Minimalista: El contenido es el protagonista absoluto.",
                "Aura Digital Pass: Fidelización y ventas impulsadas por IA."
              ][Math.floor((Date.now() / 10000) % 6)],
              category: "DISCOVER AURA",
              price: "Multimedia Hub"
            }}
            theme={theme}
            isZenMode={isZenMode}
            isNoDistractions={isNoDistractionsMode}
          />
        </main>

        {/* Footer Area */}
        <footer className="z-50 relative">
          <div className="max-w-5xl mx-auto px-6 pb-6 flex flex-col items-center gap-6">
            {/* Controls Container: Auto-hides on inactivity */}
            <div 
              className="flex w-full items-center justify-between transition-all duration-1000"
              style={{ 
                opacity: (isZenMode || (!isUIActive && !showSettings && !isChatOpen)) ? 0 : 1, 
                transform: (isZenMode || (!isUIActive && !showSettings && !isChatOpen)) ? 'translateY(20px)' : 'none',
                pointerEvents: (isUIActive || showSettings || isChatOpen) ? 'auto' : 'none'
              }}
            >
              {/* Left: Playback */}
              <div className="flex items-center gap-4">
                <div className="relative group">
                  {/* Aura Rings Visualizer */}
                  {isPlaying && (
                    <>
                      <motion.div 
                        animate={{ 
                          scale: 1 + (bars[0] / 100),
                          opacity: 0.1 + (bars[0] / 200)
                        }}
                        transition={{ type: "spring", stiffness: 300, damping: 20 }}
                        className="absolute inset-0 -m-3 md:-m-4 rounded-full border border-gold/40 pointer-events-none"
                      />
                      <motion.div 
                        animate={{ 
                          scale: 1 + (bars[4] / 80),
                          opacity: 0.05 + (bars[4] / 250)
                        }}
                        transition={{ type: "spring", stiffness: 200, damping: 25 }}
                        className="absolute inset-0 -m-6 md:-m-8 rounded-full border border-gold/20 pointer-events-none"
                      />
                      <motion.div 
                        animate={{ 
                          scale: 1 + (bars[8] / 60),
                          opacity: 0.02 + (bars[8] / 300)
                        }}
                        transition={{ type: "spring", stiffness: 150, damping: 30 }}
                        className="absolute inset-0 -m-10 md:-m-12 rounded-full border border-gold/10 pointer-events-none"
                      />
                    </>
                  )}
                  <button 
                    onClick={togglePlay} 
                    className="relative z-10 w-12 h-12 md:w-16 md:h-16 rounded-full bg-white text-black flex items-center justify-center hover:scale-110 active:scale-95 transition-all shadow-2xl"
                  >
                    {isPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" className="ml-1" />}
                  </button>
                </div>
                <div className="hidden sm:block">
                   <div className="px-3 py-1 bg-gold/20 rounded-full border border-gold/30 text-gold text-[8px] font-black uppercase tracking-[0.2em] mb-1 w-fit flex items-center gap-2">
                    <span>Estás escuchando</span>
                    {clientId !== 'global' && (
                      <button 
                        onClick={() => {
                          playSequence(true);
                          setIsUIActive(true);
                        }}
                        className="p-1 hover:text-white transition-colors"
                        title="Saltar pista"
                      >
                        <RefreshCw size={10} className="rotate-90" />
                      </button>
                    )}
                   </div>
                   <div className="text-sm md:text-base font-bold tracking-tight text-white line-clamp-1 w-48 md:w-64">
                    {currentTrackTitle.toUpperCase()}
                   </div>
                </div>
              </div>

              {/* Center: Visualizer / Chat */}
              <div className="flex-1 flex items-center justify-center">
                {(!isRemoteControl && clientId !== 'global') ? (
                  <button 
                    onClick={() => setIsChatOpen(!isChatOpen)}
                    className={`flex items-center gap-2 px-6 py-2.5 rounded-full border transition-all ${isChatOpen ? 'bg-gold text-black border-gold shadow-[0_0_20px_rgba(212,175,55,0.4)]' : 'bg-white/5 border-white/10 hover:bg-white/10 text-white/60 hover:text-white'}`}
                  >
                    <MessageSquare size={16} />
                    <span className="text-[10px] font-bold uppercase tracking-widest">Aura Assistant</span>
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-gold opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-gold"></span>
                    </span>
                  </button>
                ) : (
                  <div className="hidden lg:flex items-end justify-center gap-1 h-12 max-w-md px-12 overflow-hidden opacity-20">
                    {bars.slice(0, 16).map((h, i) => (
                      <div key={i} className="w-1 bg-gold/50 rounded-t-sm transition-all duration-75" style={{ height: `${h * 0.5}px` }} />
                    ))}
                  </div>
                )}
              </div>

              {/* Right: Interaction */}
              {!isRemoteControl && (
                <div className="hidden md:flex items-center gap-4">
                   <div className="flex items-center gap-3 bg-white/5 px-4 py-2 rounded-full border border-white/10">
                    <Volume2 size={16} className="text-gold" />
                    <input 
                      type="range" min="0" max="1" step="0.01" value={volume} 
                      onChange={e => {
                        const v = parseFloat(e.target.value);
                        setVolume(v);
                        lastVolumeUpdateRef.current = Date.now();
                        if (clientId && clientId !== 'global') {
                          updateDoc(doc(db, 'displays', clientId), { volume: v }).catch(() => {});
                        }
                      }} 
                      className="w-24 accent-gold bg-transparent cursor-pointer h-1" 
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Persistent News Ticker - Ignores inactivity, only respects isZenMode */}
          <div 
            className="w-full transition-all duration-1000"
            style={{ 
              opacity: isZenMode ? 0 : 1,
              transform: isZenMode ? 'translateY(50px)' : 'none'
            }}
          >
            {showTicker && edgeManifest?.visuals.ticker && (
              <div className={`w-full overflow-hidden border-t border-white/10 py-3 md:py-4 ${tickerTheme === 'gold' ? 'bg-gold' : 'bg-black/60'} backdrop-blur-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.5)]`}>
                <div className={`flex gap-12 whitespace-nowrap text-[10px] md:text-xs font-black tracking-[0.3em] uppercase ${tickerTheme === 'gold' ? 'text-black' : 'text-gold'}`}>
                  <motion.div animate={{ x: "-50%" }} transition={{ duration: 45, repeat: Infinity, ease: "linear" }} className="flex gap-12">
                    {Array(4).fill(edgeManifest.visuals.ticker.join(" • ") || "AURA BUSINESS • ").map((msg, i) => (
                      <span key={i}>{msg}</span>
                    ))}
                  </motion.div>
                </div>
              </div>
            )}
          </div>
        </footer>
      </div>

      {(!isRemoteControl || showSettings) && clientId !== 'global' && (
        <AuraAgent 
          isOpen={isChatOpen} 
          onClose={() => setIsChatOpen(false)} 
          hideTrigger={true}
        />
      )}
    </div>
  );
}
