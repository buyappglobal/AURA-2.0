import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Play, Pause, RotateCcw, Volume2, Moon, Sun, MessageSquare, ShieldCheck, Download, Settings, Activity, Maximize2, Minimize2, RefreshCw, Cast, Tv, LogOut, Mail, Lock, ArrowRight, Loader2, Key, ExternalLink, Chrome, X, Layout, Maximize } from 'lucide-react';
import Hls from 'hls.js';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import AuraAgent from './AuraAgent';
import { doc, onSnapshot, setDoc, serverTimestamp, deleteDoc, getDoc, updateDoc, increment } from 'firebase/firestore';
import { signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { QRCodeSVG } from 'qrcode.react';

const DEFAULT_IMAGES = [
  "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&q=80&w=1920", // Tech Office
  "https://images.unsplash.com/photo-1556740734-754f467b2410?auto=format&fit=crop&q=80&w=1920", // Retail Interaction
  "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&q=80&w=1920", // Fashion Store
  "https://images.unsplash.com/photo-1600566752355-35792bedcfea?auto=format&fit=crop&q=80&w=1920"  // Modern Reception
];

const DEFAULT_QUOTES = [
  { 
    category: "AURA ECOSYSTEM", 
    text: "REVOLUCIONA TU ESPACIO", 
    price: "SISTEMA INTEGRAL", 
    tag: "CONECTA TU MARCA",
    ticker: "DESCUBRE EL PODER DEL AUDIO Y CONTENIDO VISUAL UNIFICADO • AURA BUSINESS: LA SOLUCIÓN DEFINITIVA PARA TU NEGOCIO • SOLICITA TU DEMO HOY MISMO",
    imageUrl: "https://images.unsplash.com/photo-1497366811353-6870744d04b2?auto=format&fit=crop&q=80&w=1920"
  },
  { 
    category: "DISEÑO SONORO", 
    text: "MÚSICA QUE VENDE", 
    price: "STREAMING PROFESIONAL", 
    tag: "LICENCIA INCLUIDA",
    ticker: "CURACIÓN MUSICAL INTELIGENTE ADAPTADA A TU CLIENTE • ELIMINA EL SILENCIO Y CREA CONEXIONES EMOCIONALES • ELEVA LA PERCEPCIÓN DE CALIDAD EN TU ESTABLECIMIENTO",
    imageUrl: "https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?auto=format&fit=crop&q=80&w=1920"
  },
  { 
    category: "MARKETING VISUAL", 
    text: "TUS PANTALLAS VIVAS", 
    price: "CARTELERÍA DINÁMICA", 
    tag: "CONTROL TOTAL",
    ticker: "TRANSFORMA CUALQUIER SMART TV EN UN CANAL DE COMUNICACIÓN PROPIO • ACTUALIZA TUS OFERTAS EN TIEMPO REAL DESDE TU MÓVIL • EL FUTURO DEL RETAIL ES DIGITAL",
    imageUrl: "https://images.unsplash.com/photo-1542744173-8e7e53415bb0?auto=format&fit=crop&q=80&w=1920"
  },
  { 
    category: "IMPULSOS COMERCIALES", 
    text: "DOMINA LA ATMÓSFERA", 
    price: "CAMBIOS AL INSTANTE", 
    tag: "MAGIA SONORA",
    ticker: "ACTIVA MOMENTOS ESPECIALES CON UN SOLO CLICK • DE RELAX A ENERGÍA EN SEGUNDOS • LA HERRAMIENTA PERFECTA PARA TUS EQUIPOS DE VENTA Y EVENTOS",
    imageUrl: "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&q=80&w=1920"
  },
  { 
    category: "GESTIÓN REMOTA", 
    text: "TODO BAJO TU CONTROL", 
    price: "FÁCIL Y SEGURO", 
    tag: "SMART ADMIN",
    ticker: "GESTIONA TU ESTABLECIMIENTO DESDE NUESTRO PANEL DE CONTROL INTUITIVO • SEGURIDAD, FIABILIDAD Y DISEÑO PREMIUM • TECNOLOGÍA AURA BUSINESS AL SERVICIO DE TU MARCA",
    imageUrl: "https://images.unsplash.com/photo-1512428559083-a401a83c957b?auto=format&fit=crop&q=80&w=1920"
  },
  { 
    category: "ÚNETE A AURA", 
    text: "¿QUIERES ESTE PANEL?", 
    price: "CONTÁCTANOS", 
    tag: "EMPIEZA AHORA",
    ticker: "VISITA WWW.AURADISPLAY.ES PARA MÁS INFORMACIÓN • IMPULSA TU NEGOCIO CON EL ECOSISTEMA AURA • ATENCIÓN PERSONALIZADA Y SOPORTE 24/7",
    imageUrl: "https://images.unsplash.com/photo-1556745753-b2904692b3cd?auto=format&fit=crop&q=80&w=1920"
  }
];

export default function AuraSoundscape() {
  const [searchParams] = useSearchParams();
  const urlClientId = searchParams.get('id');
  const [clientId, setClientId] = useState<string | null>(urlClientId || localStorage.getItem('aura_last_client_id'));

  useEffect(() => {
    console.log("DEBUG: clientId initialized:", clientId);
    if (urlClientId) {
      setClientId(urlClientId);
      localStorage.setItem('aura_last_client_id', urlClientId);
    }
  }, [urlClientId]);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [isAutoPlayAttempted, setIsAutoPlayAttempted] = useState(false);
  const [time, setTime] = useState(new Date());
  const [volume, setVolume] = useState(0.5);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [currentQuoteIndex, setCurrentQuoteIndex] = useState(0);
  const [currentTrackTitle, setCurrentTrackTitle] = useState<string>('');
  
  const [activeImages, setActiveImages] = useState<any[]>(DEFAULT_IMAGES.map(url => ({ url })));
  const [activeQuotes, setActiveQuotes] = useState<any[]>(DEFAULT_QUOTES);
  const [activeTickers, setActiveTickers] = useState<any[]>([]);
  const [establishmentName, setEstablishmentName] = useState<string>("Aura Business");
  const [location, setLocation] = useState<string>("Huelva, ES");
  const [theme, setTheme] = useState<string>("classic");
  const [tickerTheme, setTickerTheme] = useState<string>("classic");
  const [showTicker, setShowTicker] = useState<boolean>(true);
  const [performanceMode, setPerformanceMode] = useState<'high' | 'eco'>('high');
  const [isZenMode, setIsZenMode] = useState<boolean>(false);
  const [isFullscreenRequested, setIsFullscreenRequested] = useState<boolean>(false);
  const [lastRefreshAt, setLastRefreshAt] = useState<number | null>(null);
  const [currentTickerIndex, setCurrentTickerIndex] = useState(0);
  const [weather, setWeather] = useState<{temp: string, condition: string}>({ temp: "--", condition: "CARGANDO" });
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const [bars, setBars] = useState<number[]>(new Array(64).fill(2));
  const frameCountRef = useRef(0);

  const [images, setImages] = useState<any[]>(DEFAULT_IMAGES.map(url => ({ url })));
  const [quotes, setQuotes] = useState<any[]>(DEFAULT_QUOTES);
  const [tickers, setTickers] = useState<any[]>([]);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [manualConfig, setManualConfig] = useState<any>(null);
  const [customSchedule, setCustomSchedule] = useState<any[] | null>(null);
  const [activeFolder, setActiveFolder] = useState<string>('');
  const [isImpulseActive, setIsImpulseActive] = useState(false);
  const [lastImpulseId, setLastImpulseId] = useState<string | null>(null);

  // Sales Gateway States
  const [showDemoGateway, setShowDemoGateway] = useState(false);
  const [gatewayStep, setGatewayStep] = useState<'confirm' | 'login' | 'success'>('confirm');
  const [gatewayEmail, setGatewayEmail] = useState('');
  const [gatewayPassword, setGatewayPassword] = useState('');
  const [gatewayLoading, setGatewayLoading] = useState(false);
  const [gatewayError, setGatewayError] = useState<string | null>(null);

  const musicGainNodeRef = useRef<GainNode | null>(null);
  const audioPlayerRef = useRef<{
    currentSource: AudioBufferSourceNode | null;
    currentGain: GainNode | null;
    nextSource: AudioBufferSourceNode | null;
    nextBuffer: AudioBuffer | null;
    nextTrackUrl: string | null;
    nextTrackTitle: string | null;
    isAborted: boolean;
    currentFolder: string | null;
    instanceId: number;
    isLoading: boolean;
    activeTimeout: any;
  }>({
    currentSource: null,
    currentGain: null,
    nextSource: null,
    nextBuffer: null,
    nextTrackUrl: null,
    nextTrackTitle: null,
    isAborted: false,
    currentFolder: null,
    instanceId: 0,
    isLoading: false,
    activeTimeout: null
  });

  const silenceCounterRef = useRef(0);

  const isScheduled = (schedule?: any) => {
    if (!schedule || !schedule.enabled) return true;
    
    const now = new Date();
    const day = now.getDay(); // 0-6
    const time = now.getHours() * 60 + now.getMinutes();
    
    const [startH, startM] = schedule.startTime.split(':').map(Number);
    const [endH, endM] = schedule.endTime.split(':').map(Number);
    const startTime = startH * 60 + startM;
    const endTime = endH * 60 + endM;
    
    const isDayValid = schedule.days.includes(day);
    const isTimeValid = time >= startTime && time <= endTime;
    
    return isDayValid && isTimeValid;
  };

  useEffect(() => {
    const filteredImgs = images.filter(img => isScheduled(img.schedule));
    let finalImgs = filteredImgs;
    
    // Fallback to default images if no images are active
    if (finalImgs.length === 0) {
      finalImgs = DEFAULT_IMAGES.map(url => ({ url }));
    }
    
    if (JSON.stringify(finalImgs) !== JSON.stringify(activeImages)) {
      setActiveImages(finalImgs);
    }

    const filteredQuotes = quotes.filter(q => isScheduled(q.schedule));
    const finalQuotes = filteredQuotes.length > 0 ? filteredQuotes : (quotes.length === 0 ? DEFAULT_QUOTES : []);
    if (JSON.stringify(finalQuotes) !== JSON.stringify(activeQuotes)) {
      setActiveQuotes(finalQuotes);
    }

    const filteredTickers = tickers.filter(t => isScheduled(t.schedule));
    if (JSON.stringify(filteredTickers) !== JSON.stringify(activeTickers)) {
      setActiveTickers(filteredTickers);
    }
  }, [images, quotes, tickers, time]);

  const tickerMessages = useMemo(() => {
    const fromQuotes = activeQuotes
      .map(q => q.ticker)
      .filter(Boolean);
      
    const fromTickers = activeTickers
      .map(t => t.text)
      .filter(Boolean);
      
    const combined = [...fromQuotes, ...fromTickers];

    if (clientId) {
      if (userProfile?.hasAdsPanel) {
        return combined.length > 0 ? combined : [
          "BIENVENIDO AL ECOSISTEMA AURA BUSINESS",
          "SOLUCIONES INTEGRALES DE AUDIO Y CARTELERÍA DIGITAL",
          "DISEÑO SONORO Y AMBIENTACIÓN VISUAL PREMIUM",
          "INFÓRMATE EN WWW.AURADISPLAY.ES"
        ];
      }
      return combined;
    }
      
    return combined.length > 0 ? combined : [
      "BIENVENIDO AL ECOSISTEMA AURA BUSINESS",
      "SOLUCIONES INTEGRALES DE AUDIO Y CARTELERÍA DIGITAL",
      "DISEÑO SONORO Y AMBIENTACIÓN VISUAL PREMIUM",
      "INFÓRMATE EN WWW.AURADISPLAY.ES"
    ];
  }, [activeQuotes, activeTickers, clientId, userProfile]);

  const allTickers = useMemo(() => {
    return tickerMessages.join(" • ");
  }, [tickerMessages]);

  useEffect(() => {
    if (performanceMode === 'eco' && tickerMessages.length > 1) {
      const interval = setInterval(() => {
        setCurrentTickerIndex(prev => (prev + 1) % tickerMessages.length);
      }, 7000);
      return () => clearInterval(interval);
    }
  }, [performanceMode, tickerMessages.length]);

  const R2_BASE_URL = 'https://media.auradisplay.es/';
  const CIRCADIAN_API = 'https://api.auradisplay.es/';
  const AURA_LIVE_URL = 'https://a5.asurahosting.com:8730/radio.mp3';

  const CIRCADIAN_SCHEDULE = [
    { start: 0, end: 1, folder: 'meditation' },
    { start: 1, end: 2, folder: 'midnight' },
    { start: 2, end: 3, folder: 'meditation' },
    { start: 3, end: 4, folder: 'midnight' },
    { start: 4, end: 5, folder: 'meditation' },
    { start: 5, end: 6, folder: 'midnight' },
    { start: 6, end: 7, folder: 'meditation' },
    { start: 7, end: 8, folder: 'midnight' },
    { start: 8, end: 11, folder: 'morning' },
    { start: 11, end: 12, folder: 'aperitivo' },
    { start: 12, end: 17, folder: 'active' },
    { start: 17, end: 20, folder: 'after-lunch' }, // O 'sunset' si existe
    { start: 20, end: 24, folder: 'nocturno' }
  ];

  const getCircadianFolder = () => {
    const hour = new Date().getHours();
    // Prioritize custom schedule from Firestore, then fallback to code default
    const scheduleToUse = customSchedule && customSchedule.length > 0 ? customSchedule : CIRCADIAN_SCHEDULE;
    const range = scheduleToUse.find(s => hour >= s.start && hour < s.end);
    return range ? range.folder : 'active';
  };

  // Fetch dynamic content from Firestore
  useEffect(() => {
    if (!clientId) return;

    // Listener for manual mode (impulses) and custom schedules
    const unsubManual = onSnapshot(doc(db, 'clientes', clientId), (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        setManualConfig(data.modo_manual);
        setCustomSchedule(data.circadian_schedule || null);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `clientes/${clientId}`);
    });

    // Fetch User Profile for permissions
    const unsubProfile = onSnapshot(doc(db, 'users', clientId), (doc) => {
      if (doc.exists()) {
        setUserProfile(doc.data());
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `users/${clientId}`);
    });

    const path = `displays/${clientId}`;
    const unsub = onSnapshot(doc(db, 'displays', clientId), (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        if (data.contents && Array.isArray(data.contents)) {
          setImages(data.contents);
        }
        if (data.quotes && Array.isArray(data.quotes)) {
          setQuotes(data.quotes.length > 0 ? data.quotes : DEFAULT_QUOTES);
        }
        if (data.tickers && Array.isArray(data.tickers)) {
          setTickers(data.tickers);
        }
        if (data.establishmentName) setEstablishmentName(data.establishmentName);
        if (data.location) setLocation(data.location);
        if (data.theme) setTheme(data.theme);
        if (data.tickerTheme) setTickerTheme(data.tickerTheme);
        if (data.performanceMode) setPerformanceMode(data.performanceMode);
        if (data.isZenMode !== undefined) setIsZenMode(data.isZenMode);
        if (data.isFullscreenRequested !== undefined) setIsFullscreenRequested(data.isFullscreenRequested);
        
        // Handle Remote Refresh
        if (data.refreshRequestedAt) {
          setLastRefreshAt(prev => {
            if (prev !== null && prev !== data.refreshRequestedAt) {
              console.log("REMOTERELOAD: Reiniciando aplicación por solicitud remota...");
              window.location.reload();
            }
            return data.refreshRequestedAt;
          });
        }

        if (data.showTicker !== undefined) setShowTicker(data.showTicker);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    });

    return () => {
      unsub();
      unsubProfile();
      unsubManual();
    };
  }, [clientId]);

  // Activity Heartbeat (Real Activity Tracking)
  useEffect(() => {
    if (!clientId) return;

    const sendHeartbeat = async () => {
      try {
        await updateDoc(doc(db, 'displays', clientId), {
          lastSeen: serverTimestamp()
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `displays/${clientId}`);
      }
    };

    // Initial heartbeat
    sendHeartbeat();

    // Periodic heartbeat (every 60 seconds)
    const interval = setInterval(sendHeartbeat, 60000);
    return () => clearInterval(interval);
  }, [clientId]);

  // Unified Audio Orchestrator
  useEffect(() => {
    const isManual = !!(manualConfig && manualConfig.activo);
    const folder = isManual ? (manualConfig.carpeta || 'impulses') : getCircadianFolder();
    
    if (folder !== activeFolder) {
      console.log("DEBUG: Controller switching folder from", activeFolder, "to", folder);
      setActiveFolder(folder);
      // BUG FIX: Clear pre-buffer when folder changes
      audioPlayerRef.current.nextBuffer = null;
      audioPlayerRef.current.nextTrackUrl = null;
      audioPlayerRef.current.nextTrackTitle = null;
    }

    if (isManual !== isImpulseActive) {
      setIsImpulseActive(isManual);
    }

    // Capture manual impulse changes even if same folder
    const impulseId = manualConfig?.id || (manualConfig?.carpeta + manualConfig?.fin?.toString());
    if (isManual && impulseId && impulseId !== lastImpulseId) {
      setLastImpulseId(impulseId);
      // Logic for stats
      if (clientId) {
        updateDoc(doc(db, 'displays', clientId), {
          totalImpulses: increment(1)
        }).catch((err) => {
          handleFirestoreError(err, OperationType.UPDATE, `displays/${clientId}`);
        });
      }
    }
  }, [manualConfig, customSchedule, time, activeFolder, isImpulseActive]);

  useEffect(() => {
    if (audioPlayerRef.current?.currentGain && audioCtxRef.current) {
      audioPlayerRef.current.currentGain.gain.setTargetAtTime(volume, audioCtxRef.current.currentTime, 0.1);
    }
    if (musicGainNodeRef.current && audioCtxRef.current) {
      musicGainNodeRef.current.gain.setTargetAtTime(volume, audioCtxRef.current.currentTime, 0.1);
    }
    if (videoRef.current) {
      videoRef.current.volume = volume;
    }
  }, [volume]);

  const fetchAndBufferTrack = async (folder: string, myInstanceId: number): Promise<{buffer: AudioBuffer, url: string, title: string} | null> => {
    try {
      console.log(`DEBUG: Preloading folder: ${folder}`);
      const url = `${CIRCADIAN_API}${folder}`;
      const response = await fetch(url);
      if (audioPlayerRef.current.instanceId !== myInstanceId) return null;
      if (!response.ok) throw new Error(`API Error: ${response.status}`);
      
      const data = await response.json();
      console.log(`DEBUG: Data received for ${folder}:`, data);
      const rawTracks = Array.isArray(data) ? data : (data.tracks || []);
      const audioTracks = rawTracks.filter(t => typeof t === 'string' && t.toLowerCase().endsWith('.mp3'));
      if (audioTracks.length === 0) throw new Error(`No tracks in ${folder}`);

      const randomTrack = audioTracks[Math.floor(Math.random() * audioTracks.length)];
      let cleanTitle = randomTrack.replace(/\.mp3$/i, '').split(' - ').slice(1).join(' - ').trim();
      
      const baseUrl = data.base_url || `${R2_BASE_URL}${folder}/`;
      const trackUrl = baseUrl.endsWith('/') ? `${baseUrl}${randomTrack}` : `${baseUrl}/${randomTrack}`;

      console.log(`DEBUG: Fetching track URL: ${trackUrl}`);
      const trackRes = await fetch(trackUrl);
      if (audioPlayerRef.current.instanceId !== myInstanceId) return null;
      
      const buffer = await audioCtxRef.current!.decodeAudioData(await trackRes.arrayBuffer());
      console.log(`DEBUG: Buffer created for ${randomTrack}`);
      return { buffer, url: trackUrl, title: cleanTitle || randomTrack };
    } catch (err) {
      console.error(`Error preloading track for ${folder}:`, err);
      return null;
    }
  };

  const playNextTrack = async () => {
    if (!audioPlayerRef.current) return;
    const myInstanceId = ++audioPlayerRef.current.instanceId;
    if (audioPlayerRef.current.isAborted) return;
    
    const fadePrevious = () => {
      // Logic for fading out... (existing logic refined if needed)
      if (audioPlayerRef.current.activeTimeout) {
        clearTimeout(audioPlayerRef.current.activeTimeout);
        audioPlayerRef.current.activeTimeout = null;
      }
      const oldGain = audioPlayerRef.current.currentGain;
      const oldSource = audioPlayerRef.current.currentSource;
      if (oldGain && oldSource && audioCtxRef.current) {
        const fadeTime = 4;
        try {
          oldGain.gain.cancelScheduledValues(audioCtxRef.current.currentTime);
          oldGain.gain.linearRampToValueAtTime(0, audioCtxRef.current.currentTime + fadeTime);
          setTimeout(() => { try { oldSource.stop(); } catch(e) {} }, fadeTime * 1000 + 500);
        } catch (e) {
          try { oldSource.stop(); } catch(e2) {}
        }
      }
    };

    if (!isPlaying) { fadePrevious(); return; }
    if (!audioCtxRef.current) audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    await audioCtxRef.current.resume().catch(() => {});

    const folder = activeFolder;
    if (!folder) return;

    // Handle Aura Live (Direct MP3 Stream)
    if (folder === 'live') {
      console.log("AuraSoundscape: Starting Aura Live MP3 Stream");
      fadePrevious();
      setCurrentTrackTitle('AURA RADIO LIVE');
      
      if (videoRef.current) {
        const streamUrl = `${AURA_LIVE_URL}?t=${Date.now()}`;
        videoRef.current.src = streamUrl;
        videoRef.current.muted = false;
        
        // Initial volume management
        videoRef.current.volume = volume;
        
        // Fade in the stream if AudioContext gain node is ready
        if (musicGainNodeRef.current && audioCtxRef.current) {
          const ctx = audioCtxRef.current;
          const g = musicGainNodeRef.current.gain;
          try {
            g.cancelScheduledValues(ctx.currentTime);
            g.setValueAtTime(0, ctx.currentTime);
            g.linearRampToValueAtTime(volume, ctx.currentTime + 3);
          } catch (e) {
            console.error("AuraSoundscape: Error fading in stream", e);
            g.setValueAtTime(volume, ctx.currentTime);
          }
        }

        const playPromise = videoRef.current.play();
        if (playPromise !== undefined) {
          playPromise.catch(e => {
            console.warn("AuraSoundscape: Stream play blocked, retrying...", e);
            setTimeout(() => {
              if (activeFolder === 'live' && videoRef.current) {
                videoRef.current.play().catch(() => {});
              }
            }, 1500);
          });
        }
      }
      return;
    } else {
      // If not live, make sure any stream is faded out and stopped
      if (videoRef.current) {
        console.log("AuraSoundscape: Stopping Live MP3 stream");
        
        // Fade out before stopping if context is active
        if (musicGainNodeRef.current && audioCtxRef.current && !videoRef.current.paused) {
          const ctx = audioCtxRef.current;
          const g = musicGainNodeRef.current.gain;
          try {
            g.cancelScheduledValues(ctx.currentTime);
            g.linearRampToValueAtTime(0, ctx.currentTime + 2);
            setTimeout(() => {
              if (videoRef.current && activeFolder !== 'live') {
                videoRef.current.pause();
                videoRef.current.src = "";
                videoRef.current.load();
              }
            }, 2100);
          } catch (e) {
            videoRef.current.pause();
            videoRef.current.src = "";
          }
        } else {
          videoRef.current.pause();
          videoRef.current.src = "";
          videoRef.current.load();
        }
      }
    }

    try {
      // 1. Get next track (either from pre-buffer or fetch if empty)
      let nextTrack = audioPlayerRef.current.nextBuffer ? 
        { 
          buffer: audioPlayerRef.current.nextBuffer, 
          url: audioPlayerRef.current.nextTrackUrl!, 
          title: audioPlayerRef.current.nextTrackTitle || 'Siguiente' 
        } :
        await fetchAndBufferTrack(folder, myInstanceId);

      if (!nextTrack) throw new Error("Failed to get track");

      // 2. Play
      fadePrevious();
      setCurrentTrackTitle(nextTrack.title);

      const source = audioCtxRef.current.createBufferSource();
      source.buffer = nextTrack.buffer;
      const gainNode = audioCtxRef.current.createGain();
      gainNode.gain.setValueAtTime(0, audioCtxRef.current.currentTime);
      gainNode.gain.linearRampToValueAtTime(volume, audioCtxRef.current.currentTime + 3); // Faster fade in
      
      const compressor = audioCtxRef.current.createDynamicsCompressor();
      source.connect(compressor);
      compressor.connect(gainNode);
      if (analyserRef.current) gainNode.connect(analyserRef.current);
      else gainNode.connect(audioCtxRef.current.destination);

      audioPlayerRef.current.currentSource = source;
      audioPlayerRef.current.currentGain = gainNode;
      
      // Clear pre-buffer as it is now playing
      audioPlayerRef.current.nextBuffer = null;
      audioPlayerRef.current.nextTrackUrl = null;
      audioPlayerRef.current.nextTrackTitle = null;

      source.start(0);

      // 3. Schedule next play BASED ON THE TRACK THAT JUST STARTED
      const nextTriggerDelay = nextTrack.buffer.duration - 5; // Crossfade at 5s before end
      audioPlayerRef.current.activeTimeout = setTimeout(() => {
        if (audioPlayerRef.current.instanceId === myInstanceId && isPlaying) playNextTrack();
      }, Math.max(0, nextTriggerDelay * 1000));

      // 4. Proactive Pre-buffer FOLLOWING track
      fetchAndBufferTrack(folder, myInstanceId).then(track => {
        if (track && audioPlayerRef.current.instanceId === myInstanceId) {
          audioPlayerRef.current.nextBuffer = track.buffer;
          audioPlayerRef.current.nextTrackUrl = track.url;
          audioPlayerRef.current.nextTrackTitle = track.title;
        }
      });

    } catch (err) {
      setTimeout(() => { if (isPlaying) playNextTrack(); }, 5000);
    }
  };

  useEffect(() => {
    if (isPlaying && activeFolder) {
      audioPlayerRef.current.isAborted = false;
      playNextTrack();
    } else if (!isPlaying) {
      if (audioPlayerRef.current) {
        audioPlayerRef.current.isAborted = true;
        if (audioPlayerRef.current.currentSource) {
          try { audioPlayerRef.current.currentSource.stop(); } catch(e) {}
          audioPlayerRef.current.currentSource = null;
        }
      }
    }
    
    return () => {
      if (audioPlayerRef.current) audioPlayerRef.current.isAborted = true;
    };
  }, [isPlaying, activeFolder, lastImpulseId]);

  useEffect(() => {
    const fetchWeather = async () => {
      try {
        if (!location) return;
        const cityName = location.split(',')[0].trim();
        
        // Step 1: Geocode city name to lat/lon using Open-Meteo Geocoding API
        const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cityName)}&count=1&language=es&format=json`);
        const geoData = await geoRes.json();
        
        if (!geoData.results || geoData.results.length === 0) {
          console.warn("Could not find coordinates for city:", cityName);
          return;
        }
        
        const { latitude, longitude } = geoData.results[0];
        
        // Step 2: Fetch weather using coordinates
        const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true&timezone=auto`);
        const weatherData = await weatherRes.json();
        
        if (weatherData.current_weather) {
          const { temperature, weathercode } = weatherData.current_weather;
          
          // Map WMO codes to Spanish descriptions
          const weatherMap: { [key: number]: string } = {
            0: 'Despejado',
            1: 'Principalmente despejado',
            2: 'Nubosidad parcial',
            3: 'Cubierto',
            45: 'Niebla', 48: 'Niebla de escarcha',
            51: 'Llovizna ligera', 53: 'Llovizna moderada', 55: 'Llovizna densa',
            61: 'Lluvia ligera', 63: 'Lluvia moderada', 65: 'Lluvia fuerte',
            71: 'Nieve ligera', 73: 'Nieve moderada', 75: 'Nieve fuerte',
            80: 'Chubascos ligeros', 81: 'Chubascos moderados', 82: 'Chubascos violentos',
            95: 'Tormenta', 96: 'Tormenta con granizo', 99: 'Tormenta fuerte'
          };
          
          setWeather({ 
            temp: `${Math.round(temperature)}°`, 
            condition: (weatherMap[weathercode] || 'Despejado').toUpperCase()
          });
        }
      } catch (error) {
        console.error("Error fetching weather from Open-Meteo:", error);
      }
    };

    fetchWeather();
    const interval = setInterval(fetchWeather, 1800000); // 30 min
    return () => clearInterval(interval);
  }, [location]);

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const imageTimer = setInterval(() => {
      if (activeImages.length > 0) {
        setCurrentImageIndex((prev) => (prev + 1) % activeImages.length);
      }
    }, 15000);
    const quoteTimer = setInterval(() => {
      if (activeQuotes.length > 0) {
        setCurrentQuoteIndex((prev) => (prev + 1) % activeQuotes.length);
      }
    }, 10000);
    
    return () => {
      clearInterval(imageTimer);
      clearInterval(quoteTimer);
    };
  }, [activeImages, activeQuotes]);

  // Auto-play attempt on mount
  useEffect(() => {
    const attemptAutoplay = async () => {
      if (!isAutoPlayAttempted) {
        setIsAutoPlayAttempted(true);
        
        // Initialize context silently
        if (!audioCtxRef.current) {
          audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({
            latencyHint: 'playback'
          });
        }
        
        const ctx = audioCtxRef.current;
        
        try {
          // Attempt to resume - will likely fail/not-run without gesture in standard browsers
          await ctx.resume();
          
          if (ctx.state === 'running') {
            console.log("DEBUG: Autoplay successful");
            setIsPlaying(true);
          } else {
            console.warn("DEBUG: Autoplay blocked by browser. Waiting for user interaction.");
            setIsPlaying(false);
          }
        } catch (error) {
          console.error("DEBUG: Autoplay attempt error:", error);
          setIsPlaying(false);
        }
      }
    };
    
    attemptAutoplay();
  }, [isAutoPlayAttempted]);

  // Audio Visualizer logic
  useEffect(() => {
    if (isPlaying) {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      
      if (!analyserRef.current && audioCtxRef.current) {
        analyserRef.current = audioCtxRef.current.createAnalyser();
        analyserRef.current.fftSize = 128;
        analyserRef.current.smoothingTimeConstant = 0.8;
        analyserRef.current.minDecibels = -90;
        analyserRef.current.maxDecibels = -10;
        
        // Connect to destination
        analyserRef.current.connect(audioCtxRef.current.destination);
      }

      const ctx = audioCtxRef.current;
      const analyser = analyserRef.current;

      if (!ctx || !analyser) return;

      // Connect video element if it exists and hasn't been connected
      if (videoRef.current) {
        try {
          const source = ctx.createMediaElementSource(videoRef.current);
          
          // Create a compressor to stabilize the audio and reduce noise peaks
          const compressor = ctx.createDynamicsCompressor();
          compressor.threshold.setValueAtTime(-24, ctx.currentTime);
          compressor.knee.setValueAtTime(30, ctx.currentTime);
          compressor.ratio.setValueAtTime(4, ctx.currentTime);
          compressor.attack.setValueAtTime(0.003, ctx.currentTime);
          compressor.release.setValueAtTime(0.25, ctx.currentTime);

          // Create a gain node to normalize towards -14 LUFS target
          const normalizationGain = ctx.createGain();
          normalizationGain.gain.setValueAtTime(1.2, ctx.currentTime);

          const musicGain = ctx.createGain();
          musicGain.gain.setValueAtTime(volume, ctx.currentTime);
          musicGainNodeRef.current = musicGain;

          source.connect(compressor);
          compressor.connect(normalizationGain);
          normalizationGain.connect(musicGain);
          musicGain.connect(analyser);
        } catch (e) {
          // MediaElementSource can only be created once
        }
      }

      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const updateVisualizer = () => {
        if (!analyserRef.current || !isPlaying) return;
        
        // Throttle updates on mobile to save CPU
        if (isMobile) {
          frameCountRef.current++;
          if (frameCountRef.current % 2 !== 0) {
            requestAnimationFrame(updateVisualizer);
            return;
          }
        }

      analyserRef.current.getByteFrequencyData(dataArray);
        
        // --- AURA SILENCE GUARD ---
        const average = dataArray.reduce((acc, v) => acc + v, 0) / dataArray.length;
        const isCurrentlyLoading = audioPlayerRef.current.isLoading;
        const isContextBlocked = audioCtxRef.current?.state === 'suspended';

        if (isPlaying && average < 1.0 && !isCurrentlyLoading && !isContextBlocked) {
          silenceCounterRef.current++;
          // Trigger skip if silent for ~20 seconds (more lenient for crossfades)
          if (silenceCounterRef.current > 1200) {
            console.warn("Aura Guard: Silence detected, skipping track...");
            silenceCounterRef.current = 0;
            playNextTrack();
          }
        } else {
          silenceCounterRef.current = 0;
        }
        // --------------------------

        // Get fewer points on mobile for better performance
        const barCount = isMobile ? 16 : 64;
        const newBars = Array.from(dataArray.slice(0, barCount)).map(val => Math.max(0.5, (val / 255) * 100));
        setBars(newBars);
        requestAnimationFrame(updateVisualizer);
      };

      updateVisualizer();
    }
  }, [isPlaying]);

  useEffect(() => {
    if (!videoRef.current) return;
    videoRef.current.volume = volume;
    
    // Update music gain node if it exists (for background video)
    if (musicGainNodeRef.current) {
      const targetVolume = isImpulseActive ? 0 : volume;
      musicGainNodeRef.current.gain.cancelScheduledValues(audioCtxRef.current?.currentTime || 0);
      musicGainNodeRef.current.gain.linearRampToValueAtTime(targetVolume, (audioCtxRef.current?.currentTime || 0) + 1.5);
    }
    
    // Also update Aura player volume if active
    if (audioPlayerRef.current && audioPlayerRef.current.currentGain) {
      audioPlayerRef.current.currentGain.gain.setValueAtTime(volume, audioCtxRef.current?.currentTime || 0);
    }
  }, [volume, isImpulseActive]);

  const [showInfo, setShowInfo] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showIOSInstall, setShowIOSInstall] = useState(false);
  const [showTVGuide, setShowTVGuide] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showQuickActions, setShowQuickActions] = useState(false);
  const [showToast, setShowToast] = useState<{show: boolean, message: string}>({ show: false, message: '' });
  const [showPairing, setShowPairing] = useState(false);
  const [showImpulses, setShowImpulses] = useState(false);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [deviceId] = useState(() => {
    let id = localStorage.getItem('aura_device_id');
    if (!id) {
      id = 'dev_' + Math.random().toString(36).substring(2, 15);
      localStorage.setItem('aura_device_id', id);
    }
    return id;
  });

  // Detect if we are on a Smart TV
  const isSmartTV = useMemo(() => {
    const ua = navigator.userAgent.toLowerCase();
    return ua.includes('smart-tv') || ua.includes('tizen') || ua.includes('webos') || ua.includes('netcast') || ua.includes('opera tv') || ua.includes('appletv');
  }, []);
  const [isPlayerHovered, setIsPlayerHovered] = useState(false);
  const [showVolumePresets, setShowVolumePresets] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isMobile, setIsMobile] = useState(false);

  // Auto-hide player controls on mobile/TV
  useEffect(() => {
    if ((isMobile || isSmartTV) && isPlayerHovered && isPlaying) {
      const timer = setTimeout(() => {
        setIsPlayerHovered(false);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [isPlayerHovered, isPlaying, isMobile, isSmartTV]);

  useEffect(() => {
    const checkMobile = () => {
      const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      // Consider mobile if width is small OR if it's a touch device with small height (landscape mobile)
      setIsMobile(window.innerWidth < 768 || (isTouch && window.innerHeight < 600));
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: any) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later.
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }).toUpperCase();
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setVolume(parseFloat(e.target.value));
  };

  const handleInstallApp = async () => {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    
    if (isIOS) {
      setShowIOSInstall(true);
      return;
    }

    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      console.log(`User response to the install prompt: ${outcome}`);
      setDeferredPrompt(null);
    } else {
      setShowToast({ show: true, message: "Esta aplicación se puede instalar desde el menú de tu navegador (Instalar aplicación o Añadir a pantalla de inicio)." });
      setTimeout(() => setShowToast({ show: false, message: '' }), 5000);
    }
  };

  const handleRefresh = () => {
    window.location.reload();
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((e) => {
        console.error(`Error attempting to enable full-screen mode: ${e.message} (${e.name})`);
        // Fallback for iOS/Browsers that don't support Fullscreen API on the document
        setShowToast({ show: true, message: "Para pantalla completa en este dispositivo, por favor instala la App (Añadir a pantalla de inicio)." });
        setTimeout(() => setShowToast({ show: false, message: '' }), 5000);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  const handleFullscreenRequestClick = () => {
    toggleFullscreen();
    setIsFullscreenRequested(false);
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const handleShare = async () => {
    const shareData = {
      title: 'Aura Business | Multimedia Hub',
      text: `Mira mi pantalla de Aura Business: ${establishmentName}`,
      url: window.location.href
    };

    try {
      if (navigator.share && !isSmartTV) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(window.location.href);
        setShowToast({ show: true, message: "¡Enlace copiado! Envíalo a tu TV por WhatsApp." });
        setTimeout(() => setShowToast({ show: false, message: '' }), 3000);
      }
    } catch (err) {
      console.log('Error sharing:', err);
      // Fallback to copy if share fails or is cancelled
      await navigator.clipboard.writeText(window.location.href);
      setShowToast({ show: true, message: "Enlace copiado al portapapeles." });
      setTimeout(() => setShowToast({ show: false, message: '' }), 3000);
    }
  };

  const generatePairingCode = async () => {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    const path = `pairingCodes/${code}`;
    try {
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + 10); // 10 minutes expiry

      await setDoc(doc(db, 'pairingCodes', code), {
        code,
        deviceId,
        linkedClientId: null,
        createdAt: serverTimestamp(),
        expiresAt: expiresAt // Send as Date object for Firestore Timestamp
      });

      setPairingCode(code);
      setShowPairing(true);
    } catch (error) {
      console.error("Error generating pairing code:", error);
      handleFirestoreError(error, OperationType.WRITE, path);
      setShowToast({ show: true, message: "Error al generar código. Reintenta." });
      setTimeout(() => setShowToast({ show: false, message: '' }), 3000);
    }
  };

  // Listen for pairing completion
  useEffect(() => {
    if (!pairingCode || !showPairing) return;

    const unsub = onSnapshot(doc(db, 'pairingCodes', pairingCode), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.linkedClientId) {
          // Success! Link the client
          setClientId(data.linkedClientId);
          localStorage.setItem('aura_last_client_id', data.linkedClientId);
          setShowPairing(false);
          setPairingCode(null);
          setShowToast({ show: true, message: "¡Pantalla vinculada con éxito!" });
          setTimeout(() => setShowToast({ show: false, message: '' }), 3000);
          
          // Cleanup the code
          deleteDoc(doc(db, 'pairingCodes', pairingCode)).catch(console.error);
        }
      }
    });

    return () => unsub();
  }, [pairingCode, showPairing]);

  // Calculate average intensity for pulsing effects
  const averageIntensity = bars.length > 0 
    ? bars.reduce((acc, val) => acc + val, 0) / bars.length 
    : 0;

  const VOLUME_PRESETS = [
    { label: '15%', value: 0.15, angle: -90 },
    { label: '25%', value: 0.25, angle: -45 },
    { label: '50%', value: 0.50, angle: 0 },
    { label: '75%', value: 0.75, angle: 45 },
    { label: '100%', value: 1.0, angle: 90 },
  ];

  const COMMERCIAL_IMPULSES = [
    { id: 'auto', label: 'Modo Automático', icon: '📡', description: 'Sistema Circadiano Aura (Sigue el ritmo del día).' },
    { id: 'morning', label: 'Mañanas Aura', icon: '☀️', description: 'Luz y armonía para empezar el día con brillo.' },
    { id: 'active', label: 'Energía Vital Aura', icon: '⚡', description: 'Ritmos vibrantes para activar el ambiente.' },
    { id: 'aperitivo', label: 'Hora del Vermut', icon: '🍹', description: 'Ambiente fresco y alegre para el mediodía.' },
    { id: 'after-lunch', label: 'Sobremesa Premium', icon: '☕', description: 'El acompañamiento ideal para café y copas.' },
    { id: 'aura_flamenca', label: 'Esencia Flamenca', icon: '💃', description: 'Elegancia y raíz para momentos con duende.' },
    { id: 'marbella', label: 'Beach Club Vibes', icon: '🏖️', description: 'Sonido elegante, sofisticado y veraniego.' },
    { id: 'midnight', label: 'Noche Lounge', icon: '🌙', description: 'Atmósfera íntima para las últimas copas.' },
    { id: 'sunset', label: 'Atardecer Aura', icon: '🌅', description: 'Transición perfecta del día a la noche.' },
    { id: 'musicas_del_mundo', label: 'Expedición Global', icon: '🌍', description: 'Un viaje sonoro exótico y sofisticado.' },
    { id: 'night_lounge', label: 'Terrazas Lounge', icon: '🍸', description: 'Chill-out envolvente para el relax total.' },
    { id: 'nocturno', label: 'Gala Nocturna', icon: '✨', description: 'Máxima sofisticación para el servicio de cena.' },
    { id: 'urban-tribal', label: 'Ritmo Urbano', icon: '🏙️', description: 'Sonido contemporáneo y cosmopolita.' },
    { id: 'meditation', label: 'Aura Meditation', icon: '🧘', description: 'Paz profunda, frecuencias curativas y calma absoluta.' },
    { id: 'live', label: 'Aura Live', icon: '🔴', description: 'Emisión en directo desde el servidor central de Aura.' },
  ];

  const triggerImpulse = async (folder: string) => {
    if (!clientId) return;
    const clientDocId = clientId;
    
    // IF AUTO: Disable manual mode
    if (folder === 'auto') {
      try {
        await setDoc(doc(db, 'clientes', clientDocId), {
          modo_manual: { activo: false }
        }, { merge: true });
        setShowToast({ show: true, message: 'Modo Automático activado' });
        setTimeout(() => setShowToast({ show: false, message: '' }), 3000);

        // Auto-start playback when switching to auto mode
        setIsPlaying(true);
        if (audioCtxRef.current?.state === 'suspended') {
          audioCtxRef.current.resume().catch(() => {});
        }
      } catch (error) {
        console.error("Error setting auto mode:", error);
      }
      return;
    }

    try {
      await setDoc(doc(db, 'clientes', clientDocId), {
        modo_manual: {
          activo: true,
          carpeta: folder,
          id: Math.random().toString(36).substring(7),
          fin: new Date(Date.now() + 3600000) // 1 hour duration for playlist
        }
      }, { merge: true });
      setShowToast({ show: true, message: `Impulso ${folder} activado` });
      setTimeout(() => setShowToast({ show: false, message: '' }), 3000);
      
      // Auto-start playback when selecting an impulse
      setIsPlaying(true);
      if (audioCtxRef.current?.state === 'suspended') {
        audioCtxRef.current.resume().catch(() => {});
      }
    } catch (error) {
      console.error("Error triggering impulse:", error);
    }
  };

  const handleGatewayLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setGatewayLoading(true);
    setGatewayError(null);
    try {
      await signInWithEmailAndPassword(auth, gatewayEmail, gatewayPassword);
      setGatewayStep('success');
    } catch (err: any) {
      console.error("Gateway Login Error:", err);
      setGatewayError("Credenciales incorrectas. Verifica tu acceso de partner.");
    } finally {
      setGatewayLoading(false);
    }
  };

  const handleGoogleGatewayLogin = async () => {
    setGatewayLoading(true);
    setGatewayError(null);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      setGatewayStep('success');
    } catch (err: any) {
      console.error("Google Gateway Login Error:", err);
      setGatewayError("Error de autenticación con Google.");
    } finally {
      setGatewayLoading(false);
    }
  };

  return (
    <div className="relative h-[100dvh] w-screen overflow-hidden bg-black font-sans text-white selection:bg-white/10">
      {/* Salir de Modo Zen - Botón flotante superior */}
      <AnimatePresence>
        {isZenMode && (
          <motion.button
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            onClick={() => setIsZenMode(false)}
            className="fixed top-6 right-6 z-[150] flex items-center gap-3 rounded-full bg-black/40 backdrop-blur-md px-5 py-2.5 border border-white/10 text-white/50 hover:text-white hover:bg-black/60 transition-all hover:scale-105 active:scale-95 group shadow-2xl"
          >
            <Maximize2 size={18} className="group-hover:rotate-12 transition-transform" />
            <span className="text-[10px] font-black uppercase tracking-widest leading-none">Salir Modo Zen</span>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Demo Mode Watermark */}
      <AnimatePresence>
        {userProfile?.isDemoAccount && (userProfile?.role === 'sales' || userProfile?.role === 'admin') && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="fixed top-8 left-1/2 -translate-x-1/2 z-[100] pointer-events-none"
          >
            <div className="rounded-full bg-purple-600/20 px-4 py-1.5 backdrop-blur-md border border-purple-500/30 flex items-center gap-2">
              <Activity className="h-3 w-3 text-purple-400" />
              <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-purple-400">Canal de Ventas - Aura Ecosystem</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Global Background Glow - Always present for depth */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div className="aura-glow opacity-20" />
      </div>

      {/* Hidden Audio Element for Live Stream - Using scale/opacity instead of display:none for better browser support */}
      <audio 
        ref={videoRef} 
        style={{ position: 'absolute', width: '1px', height: '1px', opacity: 0, pointerEvents: 'none' }}
        crossOrigin="anonymous" 
      />

      {/* iOS Install Modal */}
      <AnimatePresence>
        {showIOSInstall && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[120] flex items-center justify-center bg-black/90 p-6 backdrop-blur-xl"
            onClick={() => setShowIOSInstall(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="w-full max-w-sm rounded-[2.5rem] border border-white/10 bg-black/60 p-8 text-center shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-6 flex justify-center">
                <div className="relative h-20 w-20 rounded-2xl bg-white p-4 shadow-xl">
                  <img 
                    src="https://solonet.es/wp-content/uploads/2026/03/LOGO-AURA-BUSINESS-512-x-512-px.png" 
                    alt="Aura Logo" 
                    className="h-full w-full object-contain"
                  />
                </div>
              </div>
              
              <h3 className="mb-2 font-serif text-2xl italic tracking-tight text-white">Instalar Aura Business en iOS</h3>
              <p className="mb-8 text-sm leading-relaxed text-white/60">
                Sigue estos pasos para añadir Aura Business a tu pantalla de inicio y disfrutar de la experiencia completa:
              </p>

              <div className="space-y-6 text-left">
                <div className="flex items-center gap-4">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-bold text-white">1</div>
                  <p className="text-xs text-white/80">
                    Pulsa el botón <span className="font-bold text-blue-400">Compartir</span> en la barra inferior del navegador.
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-bold text-white">2</div>
                  <p className="text-xs text-white/80">
                    Desliza hacia abajo y selecciona <span className="font-bold text-white">"Añadir a la pantalla de inicio"</span>.
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-bold text-white">3</div>
                  <p className="text-xs text-white/80">
                    Pulsa <span className="font-bold text-blue-400">Añadir</span> en la esquina superior derecha.
                  </p>
                </div>
              </div>

              <button 
                onClick={() => setShowIOSInstall(false)}
                className="mt-10 w-full rounded-full bg-white py-4 text-[10px] font-bold uppercase tracking-[0.2em] text-black transition-transform hover:scale-105 active:scale-95"
              >
                Entendido
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Settings Modal */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 p-6 backdrop-blur-md"
            onClick={() => setShowSettings(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-xs rounded-3xl border border-white/10 bg-black/60 p-6 text-center shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="mb-6 font-serif text-2xl italic tracking-tight">Opciones de Aura Business</h3>
              
              <div className="grid grid-cols-2 gap-3 mb-3">
                <button 
                  onClick={() => { handleRefresh(); setShowSettings(false); }}
                  className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-white/5 bg-white/5 p-4 transition-all hover:bg-white/10 group"
                >
                  <RefreshCw size={18} className="text-white/40 group-hover:text-white transition-colors" />
                  <span className="text-[8px] font-bold uppercase tracking-widest text-white/60">Refrescar</span>
                </button>
                <button 
                  onClick={() => { toggleFullscreen(); setShowSettings(false); }}
                  className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-white/5 bg-white/5 p-4 transition-all hover:bg-white/10 group"
                >
                  {isFullscreen ? <Minimize2 size={18} className="text-white/40 group-hover:text-white transition-colors" /> : <Maximize2 size={18} className="text-white/40 group-hover:text-white transition-colors" />}
                  <span className="text-[8px] font-bold uppercase tracking-widest text-white/60">Pantalla</span>
                </button>
                <button 
                  onClick={() => { window.open(`/admin${clientId ? `?id=${clientId}` : ''}`, '_blank'); setShowSettings(false); }}
                  className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-white/5 bg-white/5 p-4 transition-all hover:bg-white/10 group"
                >
                  <Settings size={18} className="text-white/40 group-hover:text-white transition-colors" />
                  <span className="text-[8px] font-bold uppercase tracking-widest text-white/60">Admin</span>
                </button>
                <button 
                  onClick={() => { generatePairingCode(); setShowSettings(false); }}
                  className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-white/5 bg-white/5 p-4 transition-all hover:bg-white/10 group"
                >
                  <RefreshCw size={18} className="text-white/40 group-hover:text-white transition-colors" />
                  <span className="text-[8px] font-bold uppercase tracking-widest text-white/60">Vincular</span>
                </button>
              </div>

              <div className="flex flex-col gap-3">
                <button 
                  onClick={() => { setIsZenMode(!isZenMode); setShowSettings(false); }}
                  className={`flex items-center justify-between rounded-2xl border border-white/5 px-6 py-4 transition-all hover:bg-white/10 group ${isZenMode ? 'bg-white/10 ring-1 ring-white/20' : 'bg-white/5'}`}
                >
                  <div className="flex flex-col items-start">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-white/80">Modo Zen</span>
                    <span className="text-[8px] text-white/40 uppercase tracking-widest">{isZenMode ? 'Activado' : 'Desactivado'}</span>
                  </div>
                  <div className={`h-4 w-8 rounded-full transition-colors duration-300 relative ${isZenMode ? 'bg-yellow-400' : 'bg-white/10'}`}>
                    <div className={`absolute top-1 h-2 w-2 rounded-full bg-black transition-all duration-300 ${isZenMode ? 'left-5' : 'left-1'}`} />
                  </div>
                </button>

                <div className="grid grid-cols-2 gap-3">
                  <button 
                    onClick={() => { handleInstallApp(); setShowSettings(false); }}
                    className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-white/5 bg-white/5 p-4 transition-all hover:bg-white/10 group"
                  >
                    <Download size={18} className="text-white/40 group-hover:text-white transition-colors" />
                    <span className="text-[8px] font-bold uppercase tracking-widest text-white/60">App</span>
                  </button>
                  <button 
                    onClick={() => { setShowTVGuide(true); setShowSettings(false); }}
                    className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-white/5 bg-white/5 p-4 transition-all hover:bg-white/10 group"
                  >
                    <Tv size={18} className="text-white/40 group-hover:text-white transition-colors" />
                    <span className="text-[8px] font-bold uppercase tracking-widest text-white/60">Guía</span>
                  </button>
                  <button 
                    onClick={() => { setShowInfo(true); setShowSettings(false); }}
                    className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-white/5 bg-white/5 p-4 transition-all hover:bg-white/10 group"
                  >
                    <MessageSquare size={18} className="text-white/40 group-hover:text-white transition-colors" />
                    <span className="text-[8px] font-bold uppercase tracking-widest text-white/60">Info</span>
                  </button>
                  <button 
                    onClick={() => { window.open(`https://wa.me/34648512127?text=Sugerencia%20Aura%20Business%3A%20`, '_blank'); setShowSettings(false); }}
                    className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-white/5 bg-white/5 p-4 transition-all hover:bg-white/10 group"
                  >
                    <Activity size={18} className="text-white/40 group-hover:text-white transition-colors" />
                    <span className="text-[8px] font-bold uppercase tracking-widest text-white/60">Sugerir</span>
                  </button>
                </div>
              </div>
              
              <button 
                onClick={() => setShowSettings(false)}
                className="mt-6 w-full rounded-full bg-white/10 py-3 text-[10px] font-bold uppercase tracking-widest text-white/60 transition-all hover:bg-white/20"
              >
                Cerrar
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sales Gateway Modal */}
      <AnimatePresence>
        {showDemoGateway && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 p-6 backdrop-blur-2xl"
            onClick={() => {
              if (!gatewayLoading) setShowDemoGateway(false);
            }}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="w-full max-w-sm overflow-hidden rounded-[2.5rem] border border-white/10 bg-black/40 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-8">
                <AnimatePresence mode="wait">
                  {gatewayStep === 'confirm' && (
                    <motion.div
                      key="confirm"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="text-center"
                    >
                      <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-purple-500/10 ring-1 ring-purple-500/20">
                        <Activity className="h-8 w-8 text-purple-400" />
                      </div>
                      <h3 className="mb-2 font-serif text-2xl italic text-white text-center">Modo Presentación</h3>
                      <p className="mb-8 text-xs leading-relaxed text-white/60 text-center">
                        Estás visualizando el Canal de Ventas de Aura. ¿Realmente quieres acceder al panel de administración?
                      </p>
                      <div className="flex flex-col gap-3">
                        <button
                          onClick={() => setGatewayStep('login')}
                          className="flex w-full items-center justify-center gap-2 rounded-xl bg-white py-4 text-[10px] font-bold uppercase tracking-widest text-black transition-all hover:bg-neutral-200"
                        >
                          Si, entrar al Admin <ArrowRight size={14} />
                        </button>
                        <button
                          onClick={() => setShowDemoGateway(false)}
                          className="w-full rounded-xl bg-white/5 py-4 text-[10px] font-bold uppercase tracking-widest text-white/40 transition-all hover:bg-white/10"
                        >
                          Volver a la Demo
                        </button>
                      </div>
                    </motion.div>
                  )}

                  {gatewayStep === 'login' && (
                    <motion.div
                      key="login"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                    >
                      <div className="mb-6 flex flex-col items-center text-center">
                        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-white/5 ring-1 ring-white/10">
                          <Key className="h-6 w-6 text-white/60" />
                        </div>
                        <h3 className="font-serif text-xl italic text-white text-center">Acceso Partner</h3>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-white/20 mt-1">Valida tus credenciales comercial</p>
                      </div>

                      <form onSubmit={handleGatewayLogin} className="space-y-4">
                        <div className="space-y-2">
                          <div className="relative">
                            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" size={16} />
                            <input
                              type="email"
                              required
                              value={gatewayEmail}
                              onChange={(e) => setGatewayEmail(e.target.value)}
                              className="w-full rounded-xl border border-white/10 bg-white/5 pl-12 pr-4 py-3 text-xs transition-all focus:border-white/20 focus:bg-white/10 focus:outline-none"
                              placeholder="Email de Comercial"
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div className="relative">
                            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" size={16} />
                            <input
                              type="password"
                              required
                              value={gatewayPassword}
                              onChange={(e) => setGatewayPassword(e.target.value)}
                              className="w-full rounded-xl border border-white/10 bg-white/5 pl-12 pr-4 py-3 text-xs transition-all focus:border-white/20 focus:bg-white/10 focus:outline-none"
                              placeholder="Contraseña"
                            />
                          </div>
                        </div>

                        {gatewayError && (
                          <p className="text-center text-[10px] font-bold uppercase tracking-widest text-red-400">{gatewayError}</p>
                        )}

                        <button
                          type="submit"
                          disabled={gatewayLoading}
                          className="flex w-full items-center justify-center gap-2 rounded-xl bg-purple-600 py-4 text-[10px] font-bold uppercase tracking-widest text-white transition-all hover:bg-purple-500 disabled:opacity-50"
                        >
                          {gatewayLoading ? <Loader2 size={16} className="animate-spin" /> : "Validar Acceso"}
                        </button>
                        
                        <div className="relative flex items-center justify-center py-2">
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-full border-t border-white/10"></div>
                          </div>
                          <div className="relative bg-black/40 px-4 text-[10px] font-bold uppercase tracking-widest text-white/40">O</div>
                        </div>

                        <button
                          type="button"
                          onClick={handleGoogleGatewayLogin}
                          disabled={gatewayLoading}
                          className="flex w-full items-center justify-center gap-2 rounded-xl bg-white/5 py-4 text-[10px] font-bold uppercase tracking-widest text-white transition-all hover:bg-white/10 disabled:opacity-50"
                        >
                          {gatewayLoading ? <Loader2 size={16} className="animate-spin" /> : <><Chrome size={16} /> Entrar con Google</>}
                        </button>
                        
                        <button
                          type="button"
                          onClick={() => setGatewayStep('confirm')}
                          className="w-full mt-2 text-[9px] font-bold uppercase tracking-widest text-white/20 hover:text-white/40 transition-colors"
                        >
                          Atrás
                        </button>
                      </form>
                    </motion.div>
                  )}

                  {gatewayStep === 'success' && (
                    <motion.div
                      key="success"
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="text-center"
                    >
                      <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-green-500/20 text-green-400">
                        <ShieldCheck className="h-8 w-8" />
                      </div>
                      <h3 className="mb-2 font-serif text-2xl italic text-white text-center">Acceso Autorizado</h3>
                      <p className="mb-8 text-xs leading-relaxed text-white/60 text-center">
                        Se ha validado tu sesión correctamente. Ya puedes gestionar los contenidos desde tu panel.
                      </p>
                      <button
                        onClick={() => {
                          window.open('/admin', '_blank');
                          setShowDemoGateway(false);
                        }}
                        className="flex w-full items-center justify-center gap-2 rounded-xl bg-white py-4 text-[10px] font-bold uppercase tracking-widest text-black transition-all hover:bg-green-500 hover:text-white"
                      >
                        Abrir mi Panel de Control <ExternalLink size={14} />
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {isFullscreenRequested && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[130] flex items-center justify-center bg-black/80 backdrop-blur-xl"
          >
            <div className="flex flex-col items-center gap-8 max-w-lg text-center p-12">
              <div className="w-24 h-24 rounded-full bg-yellow-500 flex items-center justify-center">
                <Maximize className="w-12 h-12 text-black" />
              </div>
              <div>
                <h2 className="text-4xl font-black uppercase tracking-tighter text-white mb-4">ENTRAR EN MODO TV</h2>
                <p className="text-white/60 uppercase tracking-widest text-xs leading-loose">
                  Se ha solicitado el cambio a pantalla completa desde el dispositivo de control.
                </p>
              </div>
              <button 
                onClick={handleFullscreenRequestClick}
                className="px-12 py-6 bg-white text-black text-xl font-bold uppercase tracking-[0.2em] rounded-full hover:scale-105 transition-transform"
              >
                ACEPTAR Y AMPLIAR
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showTVGuide && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[120] flex items-center justify-center bg-black/90 p-6 backdrop-blur-xl"
            onClick={() => setShowTVGuide(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="w-full max-w-md rounded-[2.5rem] border border-white/10 bg-black/60 p-8 text-center shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="mb-2 font-serif text-2xl italic tracking-tight text-white">Guía de Conexión</h3>
              <p className="mb-8 text-xs leading-relaxed text-white/60">
                Disfruta de Aura Business en cualquier dispositivo siguiendo estos pasos:
              </p>

              <div className="space-y-6 text-left">
                <div className="flex items-start gap-4">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-yellow-400 text-[10px] font-bold text-black">1</div>
                  <div>
                    <p className="text-[11px] font-bold text-white uppercase tracking-wider">Smart TV / Navegador</p>
                    <p className="text-[10px] text-white/50 leading-relaxed">Abre tu URL en el navegador de la TV y guárdala en favoritos para acceso rápido.</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/20 text-[10px] font-bold text-white">2</div>
                  <div>
                    <p className="text-[11px] font-bold text-white uppercase tracking-wider">Google Cast / Chromecast</p>
                    <p className="text-[10px] text-white/50 leading-relaxed">En Chrome, pulsa en los 3 puntos ⋮ &gt; <b>"Enviar..."</b> (Cast) para proyectar esta pestaña directamente a tu TV.</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/20 text-[10px] font-bold text-white">3</div>
                  <div>
                    <p className="text-[11px] font-bold text-white uppercase tracking-wider">Opción Pro: HDMI Stick</p>
                    <p className="text-[10px] text-white/50 leading-relaxed">Usa un Fire Stick o Chromecast para instalar Aura Business como una App nativa (PWA).</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/20 text-[10px] font-bold text-white">4</div>
                  <div>
                    <p className="text-[11px] font-bold text-white uppercase tracking-wider">Bluetooth (Coche / Altavoces)</p>
                    <p className="text-[10px] text-white/50 leading-relaxed">Vincula tu móvil por Bluetooth y dale al Play. El sonido saldrá automáticamente.</p>
                  </div>
                </div>
              </div>

              <button 
                onClick={() => setShowTVGuide(false)}
                className="mt-10 w-full rounded-full bg-white/10 py-4 text-[10px] font-bold uppercase tracking-[0.2em] text-white transition-all hover:bg-white hover:text-black"
              >
                Cerrar Guía
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showInfo && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-6 backdrop-blur-md"
            onClick={() => setShowInfo(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="max-w-md rounded-3xl border border-white/10 bg-black/60 p-8 text-center shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="mb-4 font-serif text-3xl italic tracking-tight">Aura Business</h3>
              <p className="mb-6 text-sm leading-relaxed text-white/60">
                Plataforma de hilo musical profesional y cartelería digital dinámica para establecimientos exclusivos.
              </p>
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-white/5 pb-2 text-[10px] font-bold uppercase tracking-widest text-white/40">
                  <span>Soporte</span>
                  <span className="text-white/80">studio@aurabusiness.com</span>
                </div>
                <div className="flex items-center justify-between border-b border-white/5 pb-2 text-[10px] font-bold uppercase tracking-widest text-white/40">
                  <span>WhatsApp</span>
                  <a 
                    href="https://wa.me/34648512127?text=Soporte%20Aura%20Business" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-green-400 transition-colors hover:text-green-300"
                  >
                    648 512 127
                  </a>
                </div>
                <div className="flex items-center justify-between border-b border-white/5 pb-2 text-[10px] font-bold uppercase tracking-widest text-white/40">
                  <span>Licencia</span>
                  <span className="text-white/80">B2B Directa (Art. 157 LPI)</span>
                </div>
              </div>
              <button 
                onClick={() => setShowInfo(false)}
                className="mt-8 w-full rounded-full bg-white py-3 text-[10px] font-bold uppercase tracking-widest text-black transition-transform hover:scale-105 active:scale-95"
              >
                Cerrar
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Full Screen Background Slide synced with current promotional content */}
      <AnimatePresence>
        {!isZenMode && (
          <motion.div
            key={activeQuotes.length > 0 
              ? (activeQuotes[currentQuoteIndex % activeQuotes.length]?.imageUrl || activeQuotes[currentQuoteIndex % activeQuotes.length]?.text || currentQuoteIndex)
              : (activeImages[currentImageIndex % (activeImages.length || 1)]?.url || currentImageIndex)
            }
            initial={performanceMode === 'eco' 
              ? { opacity: 0 }
              : { 
                opacity: 0, 
                scale: isMobile ? 1.05 : 1.15, 
                x: isMobile ? '0%' : '-1%', 
                y: isMobile ? '0%' : '-1%', 
                filter: isMobile ? 'blur(0px)' : 'blur(15px)' 
              }
            }
            animate={performanceMode === 'eco'
              ? { opacity: 1 }
              : { 
                opacity: 1, 
                scale: 1, 
                x: isMobile ? '0%' : '1%', 
                y: isMobile ? '0%' : '1%', 
                filter: 'blur(0px)' 
              }
            }
            exit={performanceMode === 'eco'
              ? { opacity: 0 }
              : { 
                opacity: 0, 
                scale: isMobile ? 1 : 1.1, 
                filter: isMobile ? 'blur(0px)' : 'blur(15px)' 
              }
            }
            transition={performanceMode === 'eco'
              ? { duration: 1.5, ease: "easeInOut" }
              : { 
                opacity: { duration: isMobile ? 1.5 : 3, ease: "easeInOut" },
                filter: { duration: isMobile ? 0.5 : 3, ease: "easeInOut" },
                scale: { duration: isMobile ? 10 : 20, ease: "linear" },
                x: { duration: 20, ease: "linear" },
                y: { duration: 20, ease: "linear" }
              }
            }
            className={`absolute inset-0 bg-cover bg-center bg-no-repeat ${performanceMode === 'eco' ? 'will-change-opacity' : 'will-change-transform'}`}
            style={{ 
              backgroundImage: (activeQuotes.length > 0 && activeQuotes[currentQuoteIndex % activeQuotes.length]?.imageUrl)
                ? `url("${activeQuotes[currentQuoteIndex % activeQuotes.length].imageUrl}")`
                : (activeImages.length > 0 && activeImages[currentImageIndex % activeImages.length]?.url)
                ? `url("${activeImages[currentImageIndex % activeImages.length].url}")`
                : 'none',
            }}
          >
            {/* Subtle Vignette for legibility */}
            <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/60" />
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Responsive Layout Container */}
      <div className="relative h-full w-full flex flex-col">
        
        {/* Top Section: Branding & Info */}
        <motion.div 
          animate={{ opacity: isZenMode ? 0 : 1, y: isZenMode ? -20 : 0 }}
          className="flex flex-col sm:flex-row justify-between items-center sm:items-start text-center sm:text-left p-[clamp(1rem,4vh,3rem)] gap-4 sm:gap-0 z-20"
        >
          {/* Branding */}
          <div className="relative space-y-0">
            <div className="aura-glow opacity-60" />
            <h1 className={`font-serif tracking-tight text-white drop-shadow-[0_4px_12px_rgba(0,0,0,0.8)] ${
              theme === 'minimal' ? 'text-[clamp(1rem,3vw,2.5rem)] font-light' : 
              theme === 'tech' ? 'text-[clamp(1.2rem,4vw,4rem)] font-sans font-bold uppercase' :
              'text-[clamp(1.2rem,4vw,4.5rem)]'
            }`}>
              {establishmentName.split("").map((char, i) => (
                <span 
                  key={i} 
                  className="letter-glow" 
                  style={{ 
                    animationDelay: `${i * 0.3}s`,
                    marginRight: char === " " ? "0.3em" : "0",
                    textShadow: '0 0 20px rgba(0,0,0,0.5)'
                  }}
                >
                  {char}
                </span>
              ))}
            </h1>
            <p className="font-serif text-[clamp(8px,1vw,14px)] italic text-white/80 drop-shadow-md uppercase tracking-[0.3em]">
              Multimedia Hub
            </p>
            <div className="flex items-center justify-center sm:justify-start gap-1.5 mt-1 text-white/20">
              <ShieldCheck size={10} className="opacity-50" />
              <span className="text-[clamp(6px,0.8vw,10px)] font-bold uppercase tracking-[0.2em]">LICENCIA B2B • LIBRE DE SGAE</span>
            </div>
          </div>

          {/* Time & Weather */}
          <div className="flex items-center gap-[clamp(1rem,3vw,3rem)]">
            <div className="flex items-center gap-2 sm:gap-3 text-[clamp(1.2rem,3vw,3.5rem)] font-medium tracking-tighter text-white drop-shadow-[0_4px_8px_rgba(0,0,0,0.8)]">
              <RotateCcw size={18} className="text-white/40 rotate-45 sm:w-[clamp(18px,2vw,24px)]" />
              <div className="flex flex-col items-center sm:items-end">
                <span>{formatTime(time)}</span>
                <span className="text-[clamp(8px,1vw,12px)] font-bold uppercase tracking-[0.2em] text-white/60">{location.toUpperCase()}</span>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-3 text-[clamp(1.2rem,3vw,3.5rem)] font-medium tracking-tighter text-white drop-shadow-[0_4px_8px_rgba(0,0,0,0.8)]">
              <Sun size={20} className="text-yellow-400 drop-shadow-lg sm:w-[clamp(20px,2.5vw,32px)]" />
              <div className="flex flex-col items-center sm:items-end">
                <span>{weather.temp}</span>
                <span className="text-[clamp(8px,1vw,12px)] font-bold uppercase tracking-[0.2em] text-white/60">{weather.condition}</span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Center: Integrated Promotional Content (Directly on background) */}
        <div className={`flex-1 flex flex-col items-center justify-center text-center px-4 sm:px-8 pointer-events-none z-10 transition-all duration-500 ${
          (showTicker && allTickers && !isZenMode) 
            ? 'pb-[clamp(4rem,12vh,14rem)]' 
            : 'pb-[clamp(1.5rem,6vh,6rem)]'
        }`}>
          <AnimatePresence mode="wait">
            {!isZenMode && activeQuotes.length > 0 && (
              <motion.div
                key={activeQuotes[currentQuoteIndex % activeQuotes.length]?.text || activeQuotes[currentQuoteIndex % activeQuotes.length]?.imageUrl || currentQuoteIndex}
                initial={{ opacity: 0, y: performanceMode === 'eco' ? 0 : (isMobile ? 10 : 30) }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: performanceMode === 'eco' ? 0 : (isMobile ? -10 : -30) }}
                transition={{ duration: performanceMode === 'eco' ? 0.4 : (isMobile ? 0.6 : 1.5), ease: [0.22, 1, 0.36, 1] }}
                className={`max-w-[95vw] sm:max-w-[90vw] md:max-w-7xl space-y-[clamp(0.5rem,2vh,4rem)] sm:space-y-[clamp(1rem,4vh,4rem)] flex flex-col items-center ${performanceMode === 'eco' ? '' : 'will-change-transform'}`}
              >
                {/* 1. CLOCK OVERLAY (Integrated in slide) */}
                {activeQuotes[currentQuoteIndex % activeQuotes.length]?.showClock && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.2 }}
                    className="flex flex-col items-center gap-4 mb-8"
                  >
                    <div className="flex items-center gap-3 text-[clamp(4rem,20vw,16rem)] font-bold tracking-tighter text-white drop-shadow-[0_10px_30px_rgba(0,0,0,1)] leading-none italic font-serif">
                      {formatTime(time)}
                    </div>
                    <div className="text-[clamp(12px,3vw,32px)] font-bold uppercase tracking-[0.5em] text-white/60 drop-shadow-lg">
                      {formatDate(time)}
                    </div>
                  </motion.div>
                )}

                {/* 2. TEXT OVERLAY (Category, Title, Price, Tag) */}
                {(() => {
                  const q = activeQuotes[currentQuoteIndex % activeQuotes.length];
                  const hasAnyText = q?.text || q?.category || q?.price || q?.tag;
                  if (!hasAnyText) return null;

                  return (
                    <>
                      {/* Category */}
                      {q?.category && (
                        <motion.span 
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.3 }}
                          className="inline-block text-[clamp(10px,3vw,24px)] sm:text-[clamp(10px,2.5vh,24px)] font-bold uppercase tracking-[0.4em] sm:tracking-[0.6em] text-yellow-400 drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)]"
                        >
                          {q.category}
                        </motion.span>
                      )}

                      {/* Main Title */}
                      {q?.text && (
                        <h2 className="font-serif leading-[0.95] text-white drop-shadow-[0_10px_30px_rgba(0,0,0,1)] text-[clamp(2rem,10vw,12rem)] sm:text-[clamp(2rem,15vh,12rem)] break-words">
                          {q.text}
                        </h2>
                      )}

                      {/* Price / Subtitle */}
                      {q?.price && (
                        <motion.div 
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: 0.6 }}
                          className="font-serif italic text-white drop-shadow-[0_5px_20px_rgba(0,0,0,0.8)] uppercase tracking-widest text-[clamp(1.5rem,8vw,7rem)] sm:text-[clamp(1.2rem,10vh,7rem)]"
                        >
                          {q.price}
                        </motion.div>
                      )}

                      {/* Tag */}
                      {q?.tag && (
                        <motion.div 
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: 0.8 }}
                          className="inline-block rounded-full bg-black/40 backdrop-blur-md px-[clamp(1rem,4vw,4rem)] py-[clamp(0.4rem,1.5vw,1.2rem)] sm:px-[clamp(1.5rem,4vh,4rem)] sm:py-[clamp(0.5rem,1.5vh,1.2rem)] border border-white/10 shadow-2xl"
                        >
                          <span className="text-[clamp(10px,2.5vw,22px)] sm:text-[clamp(10px,2.5vh,22px)] font-bold uppercase tracking-[0.4em] text-white/60">
                            {q.tag}
                          </span>
                        </motion.div>
                      )}
                    </>
                  );
                })()}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Ticker - Full Width & Narrower & Continuous */}
        <AnimatePresence>
          {showTicker && tickerMessages.length > 0 && !isZenMode && (
            <motion.div 
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 50 }}
              className={`absolute bottom-0 left-0 right-0 z-[60] h-10 sm:h-12 md:h-14 flex items-center overflow-hidden shadow-[0_-10px_30px_rgba(0,0,0,0.3)] ${
                tickerTheme === 'dark' ? 'bg-black' : 
                tickerTheme === 'modern' ? 'bg-white' : 
                tickerTheme === 'gold' ? 'bg-gold' : 'bg-yellow-400'
              }`}
            >
              {performanceMode === 'eco' ? (
                <div className="flex w-full items-center justify-center px-4">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={currentTickerIndex}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 1.05 }}
                      transition={{ duration: 0.5 }}
                      className="flex items-center gap-4"
                    >
                      <span className={`px-4 py-1 rounded-full text-[8px] sm:text-[10px] md:text-[12px] font-black uppercase tracking-widest ${
                        tickerTheme === 'dark' ? 'bg-white/10 text-white/60' : 'bg-black/10 text-black/60'
                      }`}>
                        PATROCINADO
                      </span>
                      <span className={`text-[10px] sm:text-[14px] md:text-[20px] font-black uppercase tracking-[0.1em] text-center ${
                        tickerTheme === 'dark' ? 'text-white' : 'text-black'
                      }`}>
                        {tickerMessages[currentTickerIndex % tickerMessages.length]}
                      </span>
                    </motion.div>
                  </AnimatePresence>
                </div>
              ) : (
                <div 
                  className="flex items-center whitespace-nowrap w-max"
                  style={{
                    animation: `marquee ${Math.max(12, allTickers.split(' ').length * 0.8)}s linear infinite`,
                    willChange: 'transform'
                  }}
                >
                  <div className="flex items-center gap-12 pr-12">
                    <div className="flex items-center gap-4">
                      <span className={`px-4 py-1 rounded-full text-[8px] sm:text-[10px] md:text-[12px] font-black uppercase tracking-widest ${
                        tickerTheme === 'dark' ? 'bg-white/10 text-white/60' : 'bg-black/10 text-black/60'
                      }`}>
                        PATROCINADO
                      </span>
                      <span className={`text-[10px] sm:text-[14px] md:text-[20px] font-black uppercase tracking-[0.1em] ${
                        tickerTheme === 'dark' ? 'text-white' : 'text-black'
                      }`}>
                        {allTickers}
                      </span>
                    </div>
                  </div>
                  {/* Duplicated for continuous loop */}
                  <div className="flex items-center gap-12 pr-12">
                    <div className="flex items-center gap-4">
                      <span className={`px-4 py-1 rounded-full text-[8px] sm:text-[10px] md:text-[12px] font-black uppercase tracking-widest ${
                        tickerTheme === 'dark' ? 'bg-white/10 text-white/60' : 'bg-black/10 text-black/60'
                      }`}>
                        PATROCINADO
                      </span>
                      <span className={`text-[10px] sm:text-[14px] md:text-[20px] font-black uppercase tracking-[0.1em] ${
                        tickerTheme === 'dark' ? 'text-white' : 'text-black'
                      }`}>
                        {allTickers}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom Section: Player & Actions - Positioned above the ticker */}
      <motion.div 
        animate={{ 
          bottom: isZenMode ? '50%' : ((showTicker && allTickers && !isZenMode) ? (isMobile ? '3.5rem' : '5rem') : (isMobile ? '1.5rem' : '2.5rem')),
          left: isZenMode ? '50%' : (isMobile ? '1rem' : '3rem'),
          right: isZenMode ? 'auto' : (isMobile ? '1rem' : '3rem'),
          x: isZenMode ? '-50%' : '0%',
          y: isZenMode ? '50%' : '0%',
        }}
        transition={{ type: 'spring', stiffness: 100, damping: 20 }}
        className="absolute inset-x-0 px-4 sm:px-6 md:px-12 flex flex-row justify-between items-end gap-4 z-50"
      >
        
        {/* Player Controls - Independent Minimalist Layout */}
        <div 
          className="flex flex-col items-center gap-4 cursor-pointer relative p-16 -m-16 group/player"
          onMouseEnter={() => !isMobile && !isSmartTV && setIsPlayerHovered(true)}
          onMouseLeave={() => !isMobile && !isSmartTV && setIsPlayerHovered(false)}
          onClick={(e) => {
            // Only toggle if clicking the container or the button (not volume presets)
            const target = e.target as HTMLElement;
            if (!target.closest('.volume-preset-btn')) {
              setShowVolumePresets(!showVolumePresets);
            }
          }}
        >
          {/* Info Rail - Floating without background */}
          <AnimatePresence>
            {(!isPlaying || isPlayerHovered || isZenMode) && (
              <motion.div 
                initial={{ opacity: 0, y: 20, scale: 0.8 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20, scale: 0.8 }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                className="flex flex-col items-center gap-4 mb-2"
              >
                <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse shadow-[0_0_12px_rgba(34,197,94,1)]" />
                <span className="[writing-mode:vertical-rl] text-[10px] font-black uppercase tracking-[0.6em] text-white/50 rotate-180 drop-shadow-lg">
                  {isZenMode ? 'ZEN MODE' : (activeFolder === 'live' ? 'AURA RADIO LIVE' : 'AURA BROADCAST')}
                </span>
                
                {/* Sonando Ahora - Sutil y Elegante */}
                <AnimatePresence>
                  {isPlaying && currentTrackTitle && !isZenMode && (
                    <motion.div 
                      key={currentTrackTitle}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 10 }}
                      className="absolute left-full ml-12 whitespace-nowrap flex flex-col"
                    >
                      <span className="text-[8px] font-black uppercase tracking-[0.3em] text-white/20 mb-0.5">Sonando ahora</span>
                      <span className="text-[12px] font-medium tracking-wide text-white/70 italic font-serif truncate max-w-[200px]">
                        {currentTrackTitle}
                      </span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Independent Play Button */}
          <motion.div 
            animate={{ scale: isZenMode ? 1.5 : 1 }}
            className="relative flex items-center justify-center h-12 w-12 sm:h-16 sm:w-16"
          >
            {/* Visualizer Rings - Now around the independent button */}
            {(isPlaying || isZenMode) && (
              <>
                {/* Inner Ring - Bass (Red) */}
                <motion.div 
                  animate={{ 
                    scale: isPlaying 
                      ? [1, 1 + (bars[0] / 100) * 0.8, 1] 
                      : [1, 1.1, 1],
                    opacity: isPlaying 
                      ? [0.4, 0.9, 0.4] 
                      : [0.2, 0.4, 0.2],
                  }}
                  transition={{ 
                    duration: isPlaying ? 0.2 : 3, 
                    repeat: Infinity,
                    ease: isPlaying ? "linear" : "easeInOut"
                  }}
                  className="absolute inset-0 rounded-full border-[3px] border-red-500/60 blur-[4px]"
                />
                {/* Middle Ring - Mids (Blue) */}
                <motion.div 
                  animate={{ 
                    scale: isPlaying 
                      ? [1, 1 + (bars[16] / 100) * 0.6, 1] 
                      : [1, 1.2, 1],
                    opacity: isPlaying 
                      ? [0.3, 0.8, 0.3] 
                      : [0.15, 0.3, 0.15],
                  }}
                  transition={{ 
                    duration: isPlaying ? 0.3 : 4, 
                    repeat: Infinity,
                    ease: isPlaying ? "linear" : "easeInOut"
                  }}
                  className="absolute inset-[-10px] rounded-full border-[3px] border-blue-500/50 blur-[3px]"
                />
                {/* Outer Ring - Highs (Yellow) */}
                <motion.div 
                  animate={{ 
                    scale: isPlaying 
                      ? [1, 1 + (bars[32] / 100) * 0.4, 1] 
                      : [1, 1.3, 1],
                    opacity: isPlaying 
                      ? [0.2, 0.7, 0.2] 
                      : [0.1, 0.2, 0.1],
                  }}
                  transition={{ 
                    duration: isPlaying ? 0.25 : 5, 
                    repeat: Infinity,
                    ease: isPlaying ? "linear" : "easeInOut"
                  }}
                  className="absolute inset-[-20px] rounded-full border-2 border-yellow-500/40 blur-[2px]"
                />
              </>
            )}
            <button 
              onClick={(e) => {
                e.stopPropagation();
                if (audioCtxRef.current?.state === 'suspended') {
                  audioCtxRef.current.resume().catch(() => {});
                }
                const nextPlaying = !isPlaying;
                setIsPlaying(nextPlaying);
                // Keep volume presets visible when starting playback until a selection is made
                if (nextPlaying) {
                  setShowVolumePresets(true);
                }
              }}
              className="relative flex h-full w-full items-center justify-center rounded-full bg-white text-black transition-all hover:scale-110 active:scale-90 z-10 shadow-[0_10px_40px_rgba(0,0,0,0.5)] tv-focus"
            >
              {isPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" className="ml-1" />}
            </button>

            {/* Volume Presets (Media Luna / Half-Moon) */}
            <AnimatePresence>
              {(isPlayerHovered || showVolumePresets) && (
                <div className="absolute left-full inset-y-0 flex items-center pointer-events-none">
                  {/* Outer container expanded to ensure interaction zone */}
                  <div className="relative ml-2 w-48 h-32 flex items-center pointer-events-none">
                    {/* Botón de cierre en el centro de la medialuna */}
                    <motion.button
                      initial={{ opacity: 0, scale: 0.5 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.5 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowVolumePresets(false);
                        setIsPlayerHovered(false);
                      }}
                      className="absolute left-0 volume-preset-btn pointer-events-auto flex items-center justify-center rounded-full bg-red-500/80 text-white shadow-xl h-7 w-7 z-20 hover:scale-110 active:scale-95 transition-transform"
                      title="Cerrar volumen"
                    >
                      <X size={14} strokeWidth={3} />
                    </motion.button>
                    {VOLUME_PRESETS.map((preset) => {
                      const rad = (preset.angle * Math.PI) / 180;
                      // Super tight radius for better ergonomics
                      const radius = isMobile ? 36 : 42;
                      const x = Math.cos(rad) * radius;
                      const y = Math.sin(rad) * radius;
                      
                      return (
                        <motion.button
                          key={preset.value}
                          initial={{ opacity: 0, scale: 0.5, x: 0, y: 0 }}
                          animate={{ opacity: 1, scale: 1, x, y }}
                          exit={{ opacity: 0, scale: 0.5, x: 0, y: 0 }}
                          transition={{ 
                            type: 'spring', 
                            stiffness: 400, 
                            damping: 25,
                            delay: (VOLUME_PRESETS.indexOf(preset) * 0.05)
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setVolume(preset.value);
                            setShowVolumePresets(false);
                            // Also disable hover temporarily to force hide it
                            setIsPlayerHovered(false);
                          }}
                          className={`absolute volume-preset-btn pointer-events-auto flex items-center justify-center rounded-full border transition-all hover:scale-110 active:scale-90 shadow-2xl h-9 w-9 sm:h-11 sm:w-11 group ${
                            volume === preset.value 
                              ? 'bg-yellow-400 text-black border-yellow-400 font-extrabold' 
                              : 'bg-black/90 text-white/90 border-white/20 hover:bg-white/10 hover:border-white/40'
                          }`}
                        >
                          <span className="text-[9px] sm:text-[10px] font-bold tracking-tighter">
                            {preset.label}
                          </span>
                        </motion.button>
                      );
                    })}
                  </div>
                </div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>

        {/* Bottom Right: Actions */}
        <motion.div 
          animate={{ 
            opacity: (isZenMode && !showQuickActions) ? 0.2 : 1, 
            scale: (isZenMode && !showQuickActions) ? 0.8 : 1 
          }}
          className="flex flex-col items-end gap-4"
        >
            {/* Bottom Buttons - Vertical Expansion */}
          <div className="flex flex-col-reverse items-end gap-3">
            <button 
              onClick={() => {
                if (userProfile?.isDemoAccount) {
                  setGatewayStep('confirm');
                  setShowDemoGateway(true);
                } else {
                  setShowQuickActions(!showQuickActions);
                }
              }}
              className={`flex h-10 w-10 sm:h-16 sm:w-16 items-center justify-center rounded-full border border-white/20 bg-black/80 backdrop-blur-xl transition-all hover:bg-black/90 hover:scale-110 active:scale-95 ring-1 ring-white/10 group shadow-2xl tv-focus ${showQuickActions ? 'bg-white/30 ring-white/30' : ''} ${userProfile?.isDemoAccount ? 'opacity-40 cursor-help' : ''}`}
            >
              <Settings size={18} className={`text-white/90 group-hover:text-white transition-all sm:w-5 sm:h-5 ${showQuickActions ? 'rotate-90 text-white' : 'animate-spin-slow'}`} />
            </button>

            <AnimatePresence>
              {showQuickActions && (
                <motion.div 
                  initial={{ opacity: 0, y: 10, scale: 0.8 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.8 }}
                  className="flex flex-col gap-3 items-center"
                >
                  {isZenMode && (
                    <button 
                      onClick={() => {
                        setIsZenMode(false);
                        setShowQuickActions(false);
                      }}
                      className="flex h-10 w-10 sm:h-14 sm:w-14 items-center justify-center rounded-full border border-yellow-500/20 bg-yellow-500/10 backdrop-blur-xl transition-all hover:bg-yellow-500/20 hover:scale-110 active:scale-95 ring-1 ring-yellow-500/10 group shadow-xl tv-focus"
                      title="Desactivar Modo Zen"
                    >
                      <div className="flex flex-col items-center">
                        <Layout size={16} className="text-yellow-400 group-hover:text-yellow-300" />
                        <span className="text-[5px] font-bold text-yellow-500/60 uppercase">Normal</span>
                      </div>
                    </button>
                  )}
                  <button 
                    onClick={() => {
                      if (userProfile?.isDemoAccount) {
                        setGatewayStep('confirm');
                        setShowDemoGateway(true);
                      } else {
                        setShowSettings(true);
                        setShowQuickActions(false);
                      }
                    }}
                    className={`flex h-10 w-10 sm:h-14 sm:w-14 items-center justify-center rounded-full border border-white/20 bg-black/80 backdrop-blur-xl transition-all hover:bg-white/20 hover:scale-110 active:scale-95 ring-1 ring-white/10 group shadow-xl tv-focus ${userProfile?.isDemoAccount ? 'opacity-30' : ''}`}
                    title="Opciones avanzadas"
                  >
                    <Settings size={16} className="text-white/90 group-hover:text-white" />
                  </button>
                  {clientId === 'pruebacloud_auradisplay_es' && (
                    <button 
                      onClick={() => {
                        setShowImpulses(true);
                        setShowQuickActions(false);
                      }}
                      className="flex h-10 w-10 sm:h-14 sm:w-14 items-center justify-center rounded-full border border-yellow-500/20 bg-yellow-500/10 backdrop-blur-xl transition-all hover:bg-yellow-500/20 hover:scale-110 active:scale-95 ring-1 ring-yellow-500/10 group shadow-xl tv-focus"
                      title="Impulsos Comerciales"
                    >
                      <Activity size={16} className="text-yellow-400 group-hover:text-yellow-300" />
                    </button>
                  )}
                  <button 
                    onClick={() => {
                      toggleFullscreen();
                      setShowQuickActions(false);
                    }}
                    className="flex h-10 w-10 sm:h-14 sm:w-14 items-center justify-center rounded-full border border-white/20 bg-black/80 backdrop-blur-xl transition-all hover:bg-white/20 hover:scale-110 active:scale-95 ring-1 ring-white/10 group shadow-xl tv-focus"
                    title={isFullscreen ? "Salir de pantalla completa" : "Pantalla completa"}
                  >
                    {isFullscreen ? (
                      <Minimize2 size={16} className="text-white/90 group-hover:text-white" />
                    ) : (
                      <Maximize2 size={16} className="text-white/90 group-hover:text-white" />
                    )}
                  </button>
                  <button 
                    onClick={() => {
                      handleRefresh();
                      setShowQuickActions(false);
                    }}
                    className="flex h-10 w-10 sm:h-14 sm:w-14 items-center justify-center rounded-full border border-white/20 bg-black/80 backdrop-blur-xl transition-all hover:bg-white/20 hover:scale-110 active:scale-95 ring-1 ring-white/10 group shadow-xl tv-focus"
                    title="Refrescar contenido"
                  >
                    <RefreshCw size={16} className="text-white/90 group-hover:text-white" />
                  </button>
                  <button 
                    onClick={() => {
                      localStorage.removeItem('aura_last_client_id');
                      setClientId(null);
                      setShowQuickActions(false);
                      setShowToast({ show: true, message: 'Pantalla desvinculada' });
                      setTimeout(() => setShowToast({ show: false, message: '' }), 3000);
                    }}
                    className="flex h-10 w-10 sm:h-14 sm:w-14 items-center justify-center rounded-full border border-red-500/20 bg-red-500/10 backdrop-blur-xl transition-all hover:bg-red-500/20 hover:scale-110 active:scale-95 ring-1 ring-red-500/10 group shadow-xl tv-focus"
                    title="Desvincular pantalla"
                  >
                    <LogOut size={16} className="text-red-400 group-hover:text-red-300" />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </motion.div>

      {/* Impulses Modal */}
      <AnimatePresence>
        {showImpulses && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[140] flex items-center justify-center bg-black/90 p-6 backdrop-blur-xl"
            onClick={() => setShowImpulses(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="w-full max-w-2xl rounded-[3rem] border border-white/10 bg-black/40 p-10 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="font-serif text-3xl italic tracking-tight text-white">Impulsos Aura</h3>
                  <p className="text-xs text-white/40 uppercase tracking-widest mt-1">Panel de Control Comercial</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                {COMMERCIAL_IMPULSES.map((impulse) => {
                  const isActive = (impulse.id === 'auto' && !isImpulseActive) || 
                                 (manualConfig?.carpeta === impulse.id && isImpulseActive);
                  return (
                    <button
                      key={impulse.id}
                      onClick={() => triggerImpulse(impulse.id)}
                      className={`flex items-start gap-4 p-4 rounded-2xl border transition-all text-left group tv-focus ${
                        isActive
                          ? 'bg-yellow-500/10 border-yellow-500/50 ring-1 ring-yellow-500/20'
                          : 'bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/10'
                      }`}
                    >
                      <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-2xl group-hover:scale-110 transition-transform ${isActive ? 'bg-yellow-500/20 shadow-[0_0_15px_rgba(234,179,8,0.2)]' : 'bg-white/5'}`}>
                        {impulse.icon}
                      </div>
                      <div className="space-y-1">
                        <p className={`text-sm font-bold group-hover:text-yellow-400 transition-colors ${isActive ? 'text-yellow-400' : 'text-white'}`}>{impulse.label}</p>
                        <p className="text-[10px] text-white/40 leading-relaxed font-serif italic">{impulse.description}</p>
                      </div>
                    </button>
                  );
                })}
              </div>

              <button 
                onClick={() => setShowImpulses(false)}
                className="mt-10 w-full rounded-full bg-white/10 py-4 text-[10px] font-bold uppercase tracking-[0.2em] text-white transition-all hover:bg-white hover:text-black tv-focus"
              >
                Cerrar Panel
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pairing Modal */}
      <AnimatePresence>
        {showPairing && pairingCode && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[130] flex items-center justify-center bg-black/95 p-6 backdrop-blur-2xl"
            onClick={() => setShowPairing(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="w-full max-w-sm rounded-[3rem] border border-white/10 bg-black/40 p-10 text-center shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="mb-2 font-serif text-3xl italic tracking-tight text-white">Vincular Pantalla</h3>
              <p className="mb-8 text-xs leading-relaxed text-white/50">
                Escanea el QR con tu móvil o introduce el código en tu panel de control para activar esta pantalla.
              </p>

              <div className="mb-10 flex flex-col items-center gap-8">
                {/* QR Code */}
                <div className="rounded-3xl bg-white p-6 shadow-2xl ring-4 ring-white/10">
                  <QRCodeSVG 
                    value={`${window.location.origin}/admin?pair=${pairingCode}`}
                    size={180}
                    level="H"
                    includeMargin={false}
                  />
                </div>

                {/* Numeric Code */}
                <div className="flex flex-col items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-[0.4em] text-white/30">Código de Acceso</span>
                  <div className="text-5xl font-black tracking-[0.2em] text-white font-mono bg-white/5 px-8 py-4 rounded-2xl border border-white/10">
                    {pairingCode}
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-3 text-left bg-white/5 p-4 rounded-2xl border border-white/5">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-yellow-400 text-[10px] font-bold text-black">!</div>
                  <p className="text-[10px] text-white/40 leading-tight">
                    Esta pantalla se actualizará automáticamente una vez confirmes la vinculación desde tu dispositivo.
                  </p>
                </div>

                <button 
                  onClick={() => setShowPairing(false)}
                  className="w-full rounded-full bg-white/10 py-4 text-[10px] font-bold uppercase tracking-[0.2em] text-white transition-all hover:bg-white/20 tv-focus"
                >
                  Cancelar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toast Notification */}
      <AnimatePresence>
        {showToast.show && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[200] bg-white text-black px-6 py-3 rounded-full font-bold text-[10px] uppercase tracking-widest shadow-2xl flex items-center gap-3"
          >
            <ShieldCheck size={16} className="text-green-600" />
            {showToast.message}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Smart TV Autoplay Overlay */}
      <AnimatePresence>
        {!isPlaying && isSmartTV && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[150] bg-black/40 backdrop-blur-sm flex items-center justify-center"
            onClick={() => {
              setIsPlaying(true);
              if (!audioCtxRef.current) {
                audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
              }
              // "Warm up" video element for future HLS play during user interaction
              if (videoRef.current) {
                videoRef.current.play().then(() => videoRef.current?.pause()).catch(() => {});
              }
            }}
          >
            <motion.button
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              whileHover={{ scale: 1.1 }}
              className="group flex flex-col items-center gap-6 tv-focus"
            >
              <div className="h-24 w-24 rounded-full bg-white flex items-center justify-center text-black shadow-2xl group-hover:bg-yellow-400 transition-colors">
                <Play size={40} fill="currentColor" className="ml-2" />
              </div>
              <div className="text-center space-y-2">
                <p className="text-white font-bold uppercase tracking-[0.4em] text-sm">Pulsa para Iniciar</p>
                <p className="text-white/40 text-[10px] uppercase tracking-widest">Optimizado para Smart TV</p>
              </div>
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="fixed bottom-4 right-4 z-[100] flex gap-2 opacity-0 hover:opacity-100 transition-opacity">
        {(['classic', 'minimal', 'tech', 'zen'] as const).map((t) => (
          <button
            key={t}
            onClick={() => {
              setTheme(t);
              if (t === 'minimal') setEstablishmentName("L'Atelier Spa");
              else if (t === 'tech') setEstablishmentName("Cyber Hub");
              else if (t === 'zen') setEstablishmentName("Natura Retreat");
              else setEstablishmentName("Aura Business");
            }}
            className={`rounded-full px-3 py-1 text-[8px] font-bold uppercase tracking-widest border border-white/20 bg-black/40 text-white/60 hover:bg-white/20 tv-focus ${theme === t ? 'bg-white/20 text-white' : ''}`}
          >
            {t}
          </button>
        ))}
      </div>

      <AuraAgent mode="general" />
    </div>
  );
}
