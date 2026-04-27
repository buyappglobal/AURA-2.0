import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { doc, onSnapshot } from 'firebase/firestore';

interface Schedule {
  enabled: boolean;
  startTime: string;
  endTime: string;
  days: number[];
}

interface QuoteItem {
  text: string;
  subtext: string;
  schedule?: Schedule;
}

interface ContentItem {
  url: string;
  name: string;
  createdAt: any;
  schedule?: Schedule;
}

export default function DisplayRotativa() {
  const [searchParams] = useSearchParams();
  const clientId = searchParams.get('id');
  const [contents, setContents] = useState<ContentItem[]>([]);
  const [quotes, setQuotes] = useState<QuoteItem[]>([]);
  const [tickers, setTickers] = useState<any[]>([]);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [establishmentName, setEstablishmentName] = useState('Aura Business');
  const [location, setLocation] = useState('');
  const [theme, setTheme] = useState('classic');
  const [tickerTheme, setTickerTheme] = useState('classic');
  const [showTicker, setShowTicker] = useState(true);
  const [time, setTime] = useState(new Date());

  const [visibleContents, setVisibleContents] = useState<ContentItem[]>([]);
  const [visibleQuotes, setVisibleQuotes] = useState<QuoteItem[]>([]);
  const [visibleTickers, setVisibleTickers] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentQuoteIndex, setCurrentQuoteIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  const isScheduled = (schedule?: Schedule) => {
    if (!schedule || !schedule.enabled) return true;
    
    const now = new Date();
    const day = now.getDay();
    if (!schedule.days.includes(day)) return false;
    
    const currentTime = now.getHours() * 60 + now.getMinutes();
    const [startH, startM] = schedule.startTime.split(':').map(Number);
    const [endH, endM] = schedule.endTime.split(':').map(Number);
    
    const startTime = startH * 60 + startM;
    const endTime = endH * 60 + endM;
    
    return currentTime >= startTime && currentTime <= endTime;
  };

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const updateVisible = () => {
      setVisibleContents(contents.filter(c => isScheduled(c.schedule)));
      setVisibleQuotes(quotes.filter(q => isScheduled(q.schedule)));
      setVisibleTickers(tickers.filter(t => isScheduled(t.schedule)));
    };

    updateVisible();
    const interval = setInterval(updateVisible, 60000); // Re-check every minute
    return () => clearInterval(interval);
  }, [contents, quotes, tickers]);

  useEffect(() => {
    if (!clientId) return;

    // Fetch User Profile
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
          setContents(data.contents);
        }
        if (data.quotes && Array.isArray(data.quotes)) {
          setQuotes(data.quotes);
        }
        if (data.tickers && Array.isArray(data.tickers)) {
          setTickers(data.tickers);
        }
        if (data.establishmentName) setEstablishmentName(data.establishmentName);
        if (data.location) setLocation(data.location);
        if (data.theme) setTheme(data.theme);
        if (data.tickerTheme) setTickerTheme(data.tickerTheme);
        if (data.showTicker !== undefined) setShowTicker(data.showTicker);
      }
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, path);
      setLoading(false);
    });

    return () => {
      unsubProfile();
      unsub();
    };
  }, [clientId]);

  useEffect(() => {
    if (visibleContents.length <= 1) {
      setCurrentIndex(0);
      return;
    }

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % visibleContents.length);
    }, 10000);

    return () => clearInterval(interval);
  }, [visibleContents]);

  useEffect(() => {
    if (visibleQuotes.length <= 1) {
      setCurrentQuoteIndex(0);
      return;
    }

    const interval = setInterval(() => {
      setCurrentQuoteIndex((prev) => (prev + 1) % visibleQuotes.length);
    }, 15000);

    return () => clearInterval(interval);
  }, [visibleQuotes]);

  const tickerText = useMemo(() => {
    const defaultTicker = "AURA BUSINESS • ELEVA TU NEGOCIO CON NUESTRA CARTELERÍA DIGITAL INTELIGENTE • DISEÑO SONORO PARA ESPACIOS EXCLUSIVOS";
    
    const fromQuotes = visibleQuotes
      .map((q: any) => q.ticker)
      .filter(Boolean);
      
    const fromTickers = visibleTickers
      .map(t => t.text)
      .filter(Boolean);
      
    const combined = [...fromQuotes, ...fromTickers].join(" • ");
    
    // Si el usuario tiene el panel de publicidad activo, mostramos su contenido
    if (userProfile?.hasAdsPanel) {
      return combined || defaultTicker;
    }
    
    // Si NO tiene el panel de publicidad, solo mostramos su contenido propio si existe,
    // pero NO el default de Aura (porque paga por no tener publicidad de Aura)
    return combined || "";
  }, [visibleQuotes, visibleTickers, userProfile]);

  if (!clientId) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center bg-black text-white p-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-2xl"
        >
          <h1 className="mb-6 text-6xl font-thin tracking-[0.2em] uppercase">Aura Business</h1>
          <p className="text-xl text-white/40 font-light leading-relaxed">
            Gestión de contenidos visuales para pantallas profesionales.
            Conecta tu dispositivo usando tu ID de cliente.
          </p>
        </motion.div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-black">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white" />
      </div>
    );
  }

  if (visibleContents.length === 0) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-black text-white/40 italic">
        Sin contenidos programados para este momento.
      </div>
    );
  }

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-black">
      <AnimatePresence mode="wait">
        <motion.div
          key={currentIndex}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.5, ease: "easeInOut" }}
          className="absolute inset-0"
        >
          <img
            src={visibleContents[currentIndex].url}
            alt={visibleContents[currentIndex].name}
            className="h-full w-full object-cover"
            referrerPolicy="no-referrer"
          />
        </motion.div>
      </AnimatePresence>

      {/* Overlay de Textos Promocionales */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <AnimatePresence mode="wait">
          {visibleQuotes.length > 0 && (
            <motion.div
              key={currentQuoteIndex}
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 1.1, y: -20 }}
              transition={{ duration: 1, ease: "easeOut" }}
              className="max-w-4xl px-10 text-center"
            >
              <div className="relative">
                {/* Fondo sutil para legibilidad */}
                <div className="absolute inset-0 -inset-x-32 -inset-y-16 bg-black/60 blur-[60px] rounded-full" />
                
                <div className="relative space-y-4">
                  <h2 className="text-6xl md:text-9xl font-serif font-bold tracking-tight text-white drop-shadow-[0_10px_20px_rgba(0,0,0,1)] italic">
                    {visibleQuotes[currentQuoteIndex].text}
                  </h2>
                  {visibleQuotes[currentQuoteIndex].subtext && (
                    <p className="text-xl md:text-3xl font-sans font-light tracking-[0.5em] text-white/90 uppercase drop-shadow-[0_4px_8px_rgba(0,0,0,1)]">
                      {visibleQuotes[currentQuoteIndex].subtext}
                    </p>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Barra Inferior (Ticker y Branding) */}
      <div className="absolute bottom-0 left-0 right-0 z-20">
        {/* Ticker Bar */}
        {showTicker && tickerText && (
          <div className={`overflow-hidden border-t border-white/10 py-4 backdrop-blur-md ${
            tickerTheme === 'modern' ? 'bg-white text-black' : 'bg-black/60 text-white'
          }`}>
            <motion.div
              animate={{ x: [0, -2000] }}
              transition={{ 
                duration: 40, 
                repeat: Infinity, 
                ease: "linear" 
              }}
              className="whitespace-nowrap px-4 text-2xl font-bold uppercase tracking-[0.2em]"
            >
              {tickerText} • {tickerText} • {tickerText}
            </motion.div>
          </div>
        )}

        {/* Info Bar */}
        <div className="flex items-center justify-between bg-black/80 px-10 py-6 backdrop-blur-xl">
          <div className="flex items-center gap-8">
            <div className="flex flex-col">
              <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/40">Establecimiento</span>
              <span className="text-xl font-medium tracking-tight text-white">{establishmentName}</span>
            </div>
            <div className="h-8 w-px bg-white/10" />
            <div className="flex flex-col">
              <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/40">Ubicación</span>
              <span className="text-xl font-medium tracking-tight text-white">{location || 'Aura Business'}</span>
            </div>
          </div>

          <div className="flex items-center gap-8">
            <div className="flex flex-col items-end">
              <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/40">Hora Local</span>
              <span className="text-3xl font-light tracking-tighter text-white">
                {time.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/5 ring-1 ring-white/10">
              <img 
                src="https://solonet.es/wp-content/uploads/2026/03/LOGO-AURA-BUSINESS-512-x-512-px.png" 
                alt="Aura Logo" 
                className="h-8 w-8 object-contain opacity-50"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
