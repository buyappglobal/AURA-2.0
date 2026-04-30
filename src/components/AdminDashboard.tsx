import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { auth, db, storage, handleFirestoreError, OperationType } from '../firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, onSnapshot, setDoc, updateDoc, arrayUnion, arrayRemove, getDoc, increment, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { LogOut, Upload, Trash2, ExternalLink, Image as ImageIcon, Loader2, Copy, Check, ShieldCheck, Clock, X, Calendar, Plus, Edit2, FileText, Download, ArrowLeft, History, Tv, Camera, Scan, Activity, AlertTriangle, AlertCircle, CheckCircle2, Share2, Monitor, Maximize, RefreshCw, Volume2 } from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import { jsPDF } from 'jspdf';
import AuraAgent from './AuraAgent';
import { QRCodeCanvas } from 'qrcode.react';

interface Schedule {
  enabled: boolean;
  startTime: string; // "HH:mm"
  endTime: string;   // "HH:mm"
  days: number[];    // [0, 1, 2, 3, 4, 5, 6]
}

interface ContentItem {
  url: string;
  name: string;
  createdAt: number;
  storagePath: string;
  schedule?: Schedule;
}

interface QuoteItem {
  category?: string;
  text: string;
  price?: string;
  tag?: string;
  ticker?: string;
  imageUrl?: string;
  schedule?: Schedule;
  showClock?: boolean;
}

interface TickerItem {
  text: string;
  schedule?: Schedule;
}

export default function AdminDashboard() {
  const [user, setUser] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [targetUserProfile, setTargetUserProfile] = useState<any>(null);
  const [searchParams] = useSearchParams();
  const impersonatedUid = searchParams.get('uid');
  const targetUid = impersonatedUid || user?.uid;

  const [contents, setContents] = useState<ContentItem[]>([]);
  const [quotes, setQuotes] = useState<QuoteItem[]>([]);
  const [tickers, setTickers] = useState<TickerItem[]>([]);
  const [establishmentName, setEstablishmentName] = useState('');
  const [slug, setSlug] = useState('');
  const [adminTitle, setAdminTitle] = useState('');
  const [location, setLocation] = useState('');
  const [theme, setTheme] = useState('classic');
  const [tickerTheme, setTickerTheme] = useState('classic');
  const [showTicker, setShowTicker] = useState(true);
  const [performanceMode, setPerformanceMode] = useState<'high' | 'eco'>('high');
  const [isZenMode, setIsZenMode] = useState(false);
  const [isNoDistractionsMode, setIsNoDistractionsMode] = useState(false);
  const [isRemoteControl, setIsRemoteControl] = useState(false);
  const [volume, setVolume] = useState(0.7);
  const [isFullscreenRequested, setIsFullscreenRequested] = useState(false);
  const [refreshRequestedAt, setRefreshRequestedAt] = useState<number | null>(null);
  const [auraAgentEnabled, setAuraAgentEnabled] = useState(false);
  const [auraAgentWhatsApp, setAuraAgentWhatsApp] = useState('');
  const [newQuote, setNewQuote] = useState<QuoteItem>({ category: '', text: '', price: '', tag: '', ticker: '', imageUrl: '', showClock: false });
  const [newTicker, setNewTicker] = useState('');
  const [uploading, setUploading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [editingQuoteIndex, setEditingQuoteIndex] = useState<number | null>(null);
  const [editingTickerIndex, setEditingTickerIndex] = useState<number | null>(null);
  const [editingSchedule, setEditingSchedule] = useState<{ type: 'content' | 'quote' | 'ticker', index: number } | null>(null);
  const [pairingInfo, setPairingInfo] = useState<{ code: string, deviceId: string } | null>(null);
  const [isPairing, setIsPairing] = useState(false);
  const [showManualPairing, setShowManualPairing] = useState(false);
  const [showImpulses, setShowImpulses] = useState(false);
  const [showCircadianModal, setShowCircadianModal] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [activeTab, setActiveTab] = useState<'visual' | 'slides' | 'config'>('visual');
  const isSuperAdmin = user?.email === 'holasolonet@gmail.com';
  const isTestClient = user?.email === 'pruebacloud@auradisplay.es' || targetUserProfile?.email === 'pruebacloud@auradisplay.es';
  const canShowImpulses = targetUserProfile?.hasImpulses || isTestClient || isSuperAdmin;

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (u) => {
      if (u) {
        setUser(u);
        const isSuperAdmin = u.email === 'holasolonet@gmail.com';
        
        // Fetch current user profile to check role
        try {
          const userDoc = await getDoc(doc(db, 'users', u.uid));
          if (userDoc.exists()) {
            setUserProfile(userDoc.data());
          } else if (isSuperAdmin) {
            // Provide a synthetic profile for SuperAdmin if doc doesn't exist yet
            setUserProfile({ email: u.email, role: 'admin' });
          }
        } catch (error) {
          if (isSuperAdmin) {
             setUserProfile({ email: u.email, role: 'admin' });
          } else {
             handleFirestoreError(error, OperationType.GET, `users/${u.uid}`);
          }
        }
      } else {
        navigate(`/admin/login${window.location.search}`);
      }
    });

    return () => unsubAuth();
  }, [navigate]);

  useEffect(() => {
    if (!targetUid) return;

    // Fetch target user profile to check permissions (like hasAdsPanel)
    const unsubProfile = onSnapshot(doc(db, 'users', targetUid), (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        setTargetUserProfile(data);
        if (data.slug) setSlug(data.slug);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `users/${targetUid}`);
    });

    const path = `displays/${targetUid}`;
    const unsub = onSnapshot(doc(db, 'displays', targetUid), (doc) => {
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
        if (data.adminTitle) setAdminTitle(data.adminTitle);
        if (data.location) setLocation(data.location);
        if (data.theme) setTheme(data.theme);
        if (data.tickerTheme) setTickerTheme(data.tickerTheme);
        if (data.performanceMode) setPerformanceMode(data.performanceMode);
        if (data.isZenMode !== undefined) setIsZenMode(data.isZenMode);
        if (data.isNoDistractionsMode !== undefined) setIsNoDistractionsMode(data.isNoDistractionsMode);
        if (data.isRemoteControl !== undefined) setIsRemoteControl(data.isRemoteControl);
        if (data.volume !== undefined) setVolume(data.volume);
        if (data.isFullscreenRequested !== undefined) setIsFullscreenRequested(data.isFullscreenRequested);
        if (data.refreshRequestedAt) setRefreshRequestedAt(data.refreshRequestedAt);
        if (data.showTicker !== undefined) setShowTicker(data.showTicker);
        if (data.auraAgentEnabled !== undefined) setAuraAgentEnabled(data.auraAgentEnabled);
        if (data.auraAgentWhatsApp !== undefined) setAuraAgentWhatsApp(data.auraAgentWhatsApp);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    });

    return () => {
      unsub();
      unsubProfile();
    };
  }, [targetUid]);

  // Handle Pairing Logic
  useEffect(() => {
    const pairCode = searchParams.get('pair');
    if (pairCode && user) {
      const checkPairing = async () => {
        const docPath = `pairingCodes/${pairCode.toUpperCase()}`;
        try {
          const docRef = doc(db, 'pairingCodes', pairCode.toUpperCase());
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const data = docSnap.data();
            const expiresAt = data.expiresAt?.toMillis ? data.expiresAt.toMillis() : data.expiresAt;
            if (expiresAt > Date.now() && !data.linkedClientId) {
              setPairingInfo({ code: pairCode.toUpperCase(), deviceId: data.deviceId });
            } else {
              toast("El código de vinculación ha expirado o ya ha sido usado.", "error");
              // Remove param from URL
              searchParams.delete('pair');
              navigate(`/admin?${searchParams.toString()}`, { replace: true });
            }
          }
        } catch (error) {
          handleFirestoreError(error, OperationType.GET, docPath);
        }
      };
      checkPairing();
    }
  }, [searchParams, user, navigate]);

  const handleConfirmPairing = async () => {
    if (!pairingInfo || !user) return;
    setIsPairing(true);
    const docPath = `pairingCodes/${pairingInfo.code}`;
    try {
      const docRef = doc(db, 'pairingCodes', pairingInfo.code);
      await updateDoc(docRef, {
        linkedClientId: user.uid
      });
      alert("¡Pantalla vinculada con éxito!");
      setPairingInfo(null);
      // Remove param from URL
      searchParams.delete('pair');
      navigate(`/admin?${searchParams.toString()}`, { replace: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, docPath);
      alert("Error al vincular la pantalla.");
    } finally {
      setIsPairing(false);
    }
  };

  const handleManualPairing = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode || !user) return;
    
    setIsPairing(true);
    const code = manualCode.toUpperCase().trim();
    const docPath = `pairingCodes/${code}`;
    try {
      const docRef = doc(db, 'pairingCodes', code);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.expiresAt.toDate() > new Date() && !data.linkedClientId) {
          await updateDoc(docRef, {
            linkedClientId: user.uid
          });
          alert("¡Pantalla vinculada con éxito!");
          setShowManualPairing(false);
          setManualCode('');
        } else {
          alert("El código ha expirado o ya ha sido usado.");
        }
      } else {
        alert("Código no válido. Verifica el código en tu TV.");
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, docPath);
      alert("Error al vincular. Reintenta.");
    } finally {
      setIsPairing(false);
    }
  };

  const startScanner = async () => {
    setIsScanning(true);
    setTimeout(async () => {
      try {
        const html5QrCode = new Html5Qrcode("reader");
        scannerRef.current = html5QrCode;
        
        await html5QrCode.start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
          },
          (decodedText) => {
            // Handle decoded text
            try {
              const url = new URL(decodedText);
              const pairParam = url.searchParams.get('pair');
              if (pairParam) {
                setManualCode(pairParam.toUpperCase());
                stopScanner();
              }
            } catch (e) {
              // If not a URL, maybe it's just the code
              if (decodedText.length === 6) {
                setManualCode(decodedText.toUpperCase());
                stopScanner();
              }
            }
          },
          () => {} // Error callback (silent)
        );
      } catch (err) {
        console.error("Error starting scanner:", err);
        setIsScanning(false);
        alert("No se pudo acceder a la cámara. Asegúrate de dar permisos.");
      }
    }, 100);
  };

  const stopScanner = async () => {
    if (scannerRef.current && scannerRef.current.isScanning) {
      try {
        await scannerRef.current.stop();
        scannerRef.current = null;
      } catch (err) {
        console.error("Error stopping scanner:", err);
      }
    }
    setIsScanning(false);
  };

  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        stopScanner();
      }
    };
  }, []);

  const COMMERCIAL_IMPULSES = [
    { id: 'auto', label: 'Modo Automático', icon: '📡', description: 'Sistema Circadiano Aura (Sigue el ritmo del día).', hasPlaylist: true },
    { id: 'morning', label: 'Mañanas Aura', icon: '☀️', description: 'Luz y armonía para empezar el día con brillo.', hasPlaylist: true },
    { id: 'active', label: 'Energía Vital Aura', icon: '⚡', description: 'Ritmos vibrantes para activar el ambiente.', hasPlaylist: true },
    { id: 'aperitivo', label: 'Hora del Vermut', icon: '🍹', description: 'Ambiente fresco y alegre para el mediodía.', hasPlaylist: true },
    { id: 'sunset', label: 'Sobremesa & Atardecer', icon: '🌅', description: 'El acompañamiento ideal para café, copas y sunset.', hasPlaylist: true },
    { id: 'aura_flamenca', label: 'Esencia Flamenca', icon: '💃', description: 'Elegancia y raíz para momentos con duende.', hasPlaylist: true },
    { id: 'marbella', label: 'Beach Club Vibes', icon: '🏖️', description: 'Sonido elegante, sofisticado y veraniego.', hasPlaylist: true },
    { id: 'midnight', label: 'Noche Lounge', icon: '🌙', description: 'Atmósfera íntima para las últimas copas.', hasPlaylist: true },
    { id: 'musicas_del_mundo', label: 'Expedición Global', icon: '🌍', description: 'Un viaje sonoro exótico y sofisticado.', hasPlaylist: true },
    { id: 'night_lounge', label: 'Terrazas Lounge', icon: '🍸', description: 'Chill-out envolvente para el relax total.', hasPlaylist: true },
    { id: 'nocturno', label: 'Gala Nocturna', icon: '✨', description: 'Máxima sofisticación para el servicio de cena.', hasPlaylist: true },
    { id: 'urban-tribal', label: 'Ritmo Urbano', icon: '🏙️', description: 'Sonido contemporáneo y cosmopolita.', hasPlaylist: true },
    { id: 'meditation', label: 'Aura Meditation', icon: '🧘', description: 'Paz profunda, frecuencias curativas y calma absoluta.', hasPlaylist: true },
    { id: 'live', label: 'Aura Live', icon: '🔴', description: 'Emisión en directo desde el servidor central de Aura.', hasPlaylist: true },
  ];

  const [showConfirmModal, setShowConfirmModal] = useState<{show: boolean, impulse: any}>({ show: false, impulse: null });
  const [showWarningModal, setShowWarningModal] = useState<{show: boolean, message: string}>({ show: false, message: '' });
  const [clientConfig, setClientConfig] = useState<any>(null);
  const [showToast, setShowToast] = useState<{show: boolean, message: string, type: 'success' | 'error' | 'info'}>({ show: false, message: '', type: 'info' });

  const DEFAULT_CIRCADIAN = [
    { start: 0, end: 8, folder: 'midnight' },
    { start: 8, end: 12, folder: 'aperitivo' },
    { start: 12, end: 17, folder: 'active' },
    { start: 17, end: 20, folder: 'sunset' },
    { start: 20, end: 24, folder: 'nocturno' }
  ];

  // Toast helper
  const toast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setShowToast({ show: true, message, type });
    setTimeout(() => setShowToast(prev => ({ ...prev, show: false })), 3000);
  };

  // Listener for client config (impulses status)
  useEffect(() => {
    if (!targetUid) return;
    const unsub = onSnapshot(doc(db, 'clientes', targetUid), (doc) => {
      if (doc.exists()) {
        setClientConfig(doc.data());
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `clientes/${targetUid}`);
    });
    return () => unsub();
  }, [targetUid]);

  const triggerImpulse = async (impulse: any) => {
    if (impulse.id === 'auto') {
      return stopImpulse();
    }

    if (!impulse.hasPlaylist) {
      toast("Próximamente: Esta playlist aún no está disponible.", "info");
      return;
    }

    if (!targetUid) return;

    // Direct trigger now allowed - no need to stop current one first
    setShowConfirmModal({ show: true, impulse });
  };

  const confirmTriggerImpulse = async () => {
    const impulse = showConfirmModal.impulse;
    if (!impulse || !targetUid) return;

    const docPath = `clientes/${targetUid}`;
    try {
      await setDoc(doc(db, 'clientes', targetUid), {
        modo_manual: {
          activo: true,
          carpeta: impulse.id,
          id: Math.random().toString(36).substring(7),
          fin: new Date(Date.now() + 3600000) // 1 hour duration
        },
        manualUpdateAt: serverTimestamp()
      }, { merge: true });
      setShowConfirmModal({ show: false, impulse: null });
      toast(`Impulso ${impulse.label} activado`);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, docPath);
      setShowConfirmModal({ show: false, impulse: null });
      toast("Error al activar el impulso", "error");
    }
  };

  const stopImpulse = async () => {
    if (!targetUid) return;
    const docPath = `clientes/${targetUid}`;
    try {
      await setDoc(doc(db, 'clientes', targetUid), {
        modo_manual: { activo: false },
        manualUpdateAt: serverTimestamp()
      }, { merge: true });
      toast('Modo automático restaurado', "success");
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, docPath);
      toast("Error al detener el impulso", "error");
    }
  };

  const handleUpdateCircadianSchedule = async (newSchedule: any[]) => {
    if (!targetUid) return;
    const docPath = `clientes/${targetUid}`;
    try {
      await updateDoc(doc(db, 'clientes', targetUid), {
        circadian_schedule: newSchedule
      });
      toast("Horario circadiano actualizado");
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, docPath);
      toast("Error al actualizar horario", "error");
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/admin/login');
    } catch (err) {
      console.error("Error logging out:", err);
    }
  };

  const processImage = (file: File): Promise<Blob> => {
    console.log("DEBUG: Iniciando procesamiento de imagen:", file.name, "Tamaño:", (file.size / 1024 / 1024).toFixed(2), "MB");
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('El procesamiento de la imagen ha tardado demasiado (Timeout 15s)'));
      }, 15000);

      const img = new Image();
      img.onload = () => {
        clearTimeout(timeout);
        console.log("DEBUG: Imagen cargada. Dimensiones originales:", img.width, "x", img.height);
        
        try {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            throw new Error('No se pudo obtener el contexto del canvas');
          }

          const targetWidth = 1920;
          const targetHeight = 1080;
          canvas.width = targetWidth;
          canvas.height = targetHeight;

          ctx.fillStyle = 'black';
          ctx.fillRect(0, 0, targetWidth, targetHeight);

          const scale = Math.min(targetWidth / img.width, targetHeight / img.height);
          const x = (targetWidth / 2) - (img.width / 2) * scale;
          const y = (targetHeight / 2) - (img.height / 2) * scale;

          ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
          console.log("DEBUG: Imagen dibujada en canvas 16:9");

          canvas.toBlob((blob) => {
            if (blob) {
              console.log("DEBUG: Blob generado con éxito. Tamaño final:", (blob.size / 1024).toFixed(2), "KB");
              resolve(blob);
            } else {
              reject(new Error('Error al generar el blob (resultado nulo)'));
            }
          }, 'image/jpeg', 0.8);
        } catch (e: any) {
          console.error("DEBUG: Error interno en canvas:", e);
          reject(e);
        } finally {
          URL.revokeObjectURL(img.src);
        }
      };
      
      img.onerror = (e) => {
        clearTimeout(timeout);
        console.error("DEBUG: Error al cargar objeto Image:", e);
        URL.revokeObjectURL(img.src);
        reject(new Error('Error al cargar la imagen. Asegúrate de que es un archivo de imagen válido.'));
      };
      
      img.src = URL.createObjectURL(file);
    });
  };

  const performUpload = async (file: File) => {
    if (!file || !user) return;

    if (contents.length >= 20) {
      alert("Límite de 20 imágenes alcanzado.");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      alert("La imagen supera el límite de 2MB recomendado para un rendimiento óptimo y ahorro de espacio.");
      return;
    }

    setUploading(true);
    try {
      console.log("DEBUG: Iniciando upload para:", file.name);
      const processedBlob = await processImage(file);
      
      const fileName = `${Date.now()}_${file.name.replace(/\.[^/.]+$/, "")}.jpg`;
      const storagePath = `contenidos/${user.uid}/${fileName}`;
      const storageRef = ref(storage, storagePath);
      
      console.log("DEBUG: Subiendo a Storage:", storagePath);
      await uploadBytes(storageRef, processedBlob, { contentType: 'image/jpeg' });
      
      console.log("DEBUG: Obteniendo URL de descarga...");
      const url = await getDownloadURL(storageRef);

      const newItem: ContentItem = {
        url,
        name: fileName,
        createdAt: Date.now(),
        storagePath
      };

      console.log("DEBUG: Guardando en Firestore...");
      const displayRef = doc(db, 'displays', user.uid);
      const docPath = `displays/${user.uid}`;
      try {
        await setDoc(displayRef, {
          contents: arrayUnion(newItem)
        }, { merge: true });
      } catch (dbErr) {
        handleFirestoreError(dbErr, OperationType.WRITE, docPath);
      }

      console.log("DEBUG: ¡Éxito total!");
      
      // Auto-populate slide form if image URL is empty
      if (!newQuote.imageUrl) {
        setNewQuote(prev => ({ ...prev, imageUrl: url }));
      }
    } catch (err: any) {
      console.error("DEBUG: Error en upload:", err);
      let errorMsg = "Error al subir la imagen.";
      
      if (err.message?.includes('Timeout')) errorMsg = "El procesamiento tardó demasiado. Prueba con una imagen más pequeña.";
      if (err.code === 'storage/unauthorized') errorMsg = "No tienes permisos para subir archivos (Error de Storage).";
      if (err.code === 'storage/retry-limit-exceeded') errorMsg = "Error de red al subir. Reintenta.";
      
      alert(`${errorMsg}\n\nDetalle: ${err.message || err.code || 'Error desconocido'}`);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) performUpload(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      await performUpload(file);
    }
  };

  const handleDelete = async (item: ContentItem) => {
    if (!user || !confirm(`¿Estás seguro de eliminar "${item.name}"?`)) return;

    try {
      // Delete from Storage
      const storageRef = ref(storage, item.storagePath);
      await deleteObject(storageRef);

      // Delete from Firestore
      const displayRef = doc(db, 'displays', user.uid);
      await updateDoc(displayRef, {
        contents: arrayRemove(item)
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `displays/${user.uid}`);
      alert("Error al eliminar el contenido.");
    }
  };

  const handleAddQuote = async (e: React.FormEvent) => {
    e.preventDefault();
    const hasContent = newQuote.text || newQuote.imageUrl || newQuote.category || newQuote.price || newQuote.tag;
    if (!user || !hasContent) return;

    console.log("DEBUG: handleAddQuote - newQuote:", newQuote);
    console.log("DEBUG: handleAddQuote - editingQuoteIndex:", editingQuoteIndex);

    try {
      const displayRef = doc(db, 'displays', user.uid);
      const docPath = `displays/${user.uid}`;
      if (editingQuoteIndex !== null) {
        const updatedQuotes = [...quotes];
        updatedQuotes[editingQuoteIndex] = newQuote;
        console.log("DEBUG: handleAddQuote - Updating Firestore with:", updatedQuotes);
        await updateDoc(displayRef, { quotes: updatedQuotes });
        setEditingQuoteIndex(null);
        alert("Slide actualizado.");
      } else {
        await setDoc(displayRef, {
          quotes: arrayUnion(newQuote)
        }, { merge: true });
        alert("¡Slide añadido con éxito!");
      }
      setNewQuote({ category: '', text: '', price: '', tag: '', ticker: '', imageUrl: '', showClock: false });
    } catch (err) {
      console.error("DEBUG: handleAddQuote - Error:", err);
      handleFirestoreError(err, OperationType.UPDATE, `displays/${user.uid}`);
    }
  };

  const handleAddTicker = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newTicker) return;

    try {
      const displayRef = doc(db, 'displays', user.uid);
      const docPath = `displays/${user.uid}`;
      if (editingTickerIndex !== null) {
        const updatedTickers = [...tickers];
        updatedTickers[editingTickerIndex] = { ...updatedTickers[editingTickerIndex], text: newTicker };
        await updateDoc(displayRef, { tickers: updatedTickers });
        setEditingTickerIndex(null);
      } else {
        await setDoc(displayRef, {
          tickers: arrayUnion({ text: newTicker })
        }, { merge: true });
      }
      setNewTicker('');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `displays/${user.uid}`);
    }
  };

  const startEditingQuote = (index: number) => {
    setNewQuote(quotes[index]);
    setEditingQuoteIndex(index);
    document.getElementById('quote-form')?.scrollIntoView({ behavior: 'smooth' });
  };

  const startEditingTicker = (index: number) => {
    setNewTicker(tickers[index].text);
    setEditingTickerIndex(index);
    document.getElementById('ticker-form')?.scrollIntoView({ behavior: 'smooth' });
  };

  const downloadSalesKit = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    // Background - Dark Anthracite
    doc.setFillColor(20, 20, 20);
    doc.rect(0, 0, pageWidth, pageHeight, 'F');

    // Header Glow / Accent
    doc.setDrawColor(212, 175, 55);
    doc.setLineWidth(0.5);
    doc.line(10, 10, pageWidth - 10, 10);
    doc.line(10, pageHeight - 10, pageWidth - 10, pageHeight - 10);

    // Title
    doc.setFontSize(28);
    doc.setTextColor(212, 175, 55); // Gold
    doc.setFont("helvetica", "bold");
    doc.text("AURA BUSINESS", pageWidth / 2, 30, { align: 'center' });
    
    doc.setFontSize(14);
    doc.setTextColor(150, 150, 150);
    doc.setFont("helvetica", "normal");
    doc.text("Dossier de Rentabilidad y Ecosistema Digital", pageWidth / 2, 40, { align: 'center' });

    let y = 60;

    // Pillar I: El Cerebro (Visual)
    doc.setFontSize(16);
    doc.setTextColor(212, 175, 55);
    doc.setFont("helvetica", "bold");
    doc.text("I. EL CEREBRO: Gestión de Contenidos (Visual)", 20, y);
    y += 12;
    doc.setFontSize(11);
    doc.setTextColor(200, 200, 200);
    const visualPoints = [
      { t: "Smart Signage:", d: "Convierte cualquier TV en un canal corporativo de alta definición." },
      { t: "Venta Cruzada Dinámica:", d: "Usa el Ticker para promocionar productos mientras suena la música." },
      { t: "Actualización Instantánea:", d: "Cambia precios o mensajes desde tu móvil y se reflejan al segundo." }
    ];
    visualPoints.forEach(p => {
      doc.setFont("helvetica", "bold");
      doc.text(p.t, 25, y);
      const titleWidth = doc.getTextWidth(p.t);
      doc.setFont("helvetica", "normal");
      const descLines = doc.splitTextToSize(p.d, pageWidth - 40 - titleWidth - 5);
      doc.text(descLines, 25 + titleWidth + 3, y);
      y += Math.max(8, descLines.length * 5 + 3);
    });

    y += 5;

    // Pillar II: El Alma (Audio)
    doc.setFontSize(16);
    doc.setTextColor(212, 175, 55);
    doc.setFont("helvetica", "bold");
    doc.text("II. EL ALMA: Inteligencia Acústica (Audio)", 20, y);
    y += 12;
    
    // SGAE Highlight Box
    doc.setDrawColor(212, 175, 55);
    doc.setFillColor(30, 30, 30);
    doc.rect(20, y, pageWidth - 40, 15, 'FD');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(12);
    doc.text("EXENCIÓN LEGAL SGAE/AGEDI (Art. 157 LPI)", pageWidth / 2, y + 10, { align: 'center' });
    y += 25;

    doc.setFontSize(11);
    doc.setTextColor(200, 200, 200);
    const audioPoints = [
      { t: "Curación por IA:", d: "Música que se adapta al flujo de clientes (BPM variable según horario)." },
      { t: "Audio Branding:", d: "Identidad sonora profesional diseñada para tu tipo de negocio." }
    ];
    audioPoints.forEach(p => {
      doc.setFont("helvetica", "bold");
      doc.text(p.t, 25, y);
      const titleWidth = doc.getTextWidth(p.t);
      doc.setFont("helvetica", "normal");
      const descLines = doc.splitTextToSize(p.d, pageWidth - 40 - titleWidth - 5);
      doc.text(descLines, 25 + titleWidth + 3, y);
      y += Math.max(8, descLines.length * 5 + 3);
    });

    y += 5;

    // Pillar III: El Control (Hardware)
    doc.setFontSize(16);
    doc.setTextColor(212, 175, 55);
    doc.setFont("helvetica", "bold");
    doc.text("III. EL CONTROL: Despliegue Cloud (Hardware)", 20, y);
    y += 12;
    doc.setFontSize(11);
    doc.setTextColor(200, 200, 200);
    const hardwarePoints = [
      { t: "Cero Inversión:", d: "Sin reproductores costosos. Tu Smart TV es el hardware." },
      { t: "Gestión Multi-Sede:", d: "Controla todos tus locales desde un único panel centralizado." }
    ];
    hardwarePoints.forEach(p => {
      doc.setFont("helvetica", "bold");
      doc.text(p.t, 25, y);
      const titleWidth = doc.getTextWidth(p.t);
      doc.setFont("helvetica", "normal");
      const descLines = doc.splitTextToSize(p.d, pageWidth - 40 - titleWidth - 5);
      doc.text(descLines, 25 + titleWidth + 3, y);
      y += Math.max(8, descLines.length * 5 + 3);
    });

    y += 10;

    // Sector Application Table
    doc.setFontSize(14);
    doc.setTextColor(212, 175, 55);
    doc.text("Aplicación por Sector", 20, y);
    y += 8;
    
    // Table Header
    doc.setFillColor(40, 40, 40);
    doc.rect(20, y, pageWidth - 40, 10, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.text("Sector", 25, y + 7);
    doc.text("Uso del Ticker (Info Dinámica)", 55, y + 7);
    doc.text("Estilo Musical IA", 145, y + 7);
    y += 10;

    const sectors = [
      { s: "Gimnasios", t: "Próxima clase de Zumba en 10 min", m: "High Energy / Tech-House" },
      { s: "Hoteles", t: "Check-out hasta las 12:00h - Feliz estancia", m: "Deep House / Lounge" },
      { s: "Retail", t: "2x1 en zona de probadores solo hoy", m: "Pop Curado / Trendy" },
      { s: "Clínicas", t: "Turno para el paciente 45 en sala 2", m: "Zen Ambient / Relax" }
    ];

    sectors.forEach(s => {
      doc.setDrawColor(50, 50, 50);
      doc.line(20, y + 12, pageWidth - 20, y + 12);
      doc.setTextColor(180, 180, 180);
      doc.setFont("helvetica", "bold");
      doc.text(s.s, 25, y + 7);
      doc.setFont("helvetica", "normal");
      const tickerLines = doc.splitTextToSize(s.t, 85);
      doc.text(tickerLines, 55, y + 7);
      doc.text(s.m, 145, y + 7);
      y += Math.max(12, tickerLines.length * 5 + 2);
    });

    // Elevator Pitch
    y = 260;
    doc.setDrawColor(212, 175, 55);
    doc.setLineWidth(1);
    doc.line(20, y, pageWidth - 20, y);
    y += 10;
    doc.setFontSize(11);
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "italic");
    const pitch = "Aura Business: La única plataforma que paga su propia suscripción eliminando multas legales y aumentando tu ticket medio mediante señalética inteligente.";
    doc.text(pitch, pageWidth / 2, y, { align: 'center', maxWidth: 160 });

    // Footer
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.setFont("helvetica", "normal");
    doc.text("© 2026 Aura Business - Dossier de Rentabilidad y Prestaciones", pageWidth / 2, 285, { align: 'center' });
    
    doc.save("Aura_Business_Dossier_Rentabilidad.pdf");
  };

  const handleDeleteAllContents = async () => {
    if (!targetUid || !confirm("¿Estás seguro de eliminar TODAS las imágenes? Esta acción no se puede deshacer.")) return;
    
    setUploading(true);
    try {
      // Delete all from Storage
      for (const item of contents) {
        try {
          const storageRef = ref(storage, item.storagePath);
          await deleteObject(storageRef);
        } catch (e) {
          console.error("Error deleting from storage:", item.storagePath, e);
        }
      }

      // Clear Firestore
      const displayRef = doc(db, 'displays', targetUid);
      await updateDoc(displayRef, {
        contents: []
      });
      console.log("DEBUG: Todas las imágenes eliminadas.");
    } catch (err) {
      console.error("Error deleting all contents:", err);
      alert("Error al eliminar todas las imágenes.");
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteAllQuotes = async () => {
    if (!targetUid || !confirm("¿Estás seguro de eliminar TODOS los textos?")) return;
    
    try {
      const displayRef = doc(db, 'displays', targetUid);
      await updateDoc(displayRef, {
        quotes: []
      });
    } catch (err) {
      console.error("Error deleting all quotes:", err);
      alert("Error al eliminar todos los textos.");
    }
  };

  const handleDeleteQuote = async (quote: QuoteItem) => {
    if (!targetUid) return;
    try {
      const displayRef = doc(db, 'displays', targetUid);
      await updateDoc(displayRef, {
        quotes: arrayRemove(quote)
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `displays/${targetUid}`);
    }
  };

  const handleDeleteTicker = async (ticker: TickerItem) => {
    if (!targetUid) return;
    try {
      const displayRef = doc(db, 'displays', targetUid);
      await updateDoc(displayRef, {
        tickers: arrayRemove(ticker)
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `displays/${targetUid}`);
    }
  };

  const handleUpdateSchedule = async (schedule: Schedule) => {
    if (!targetUid || !editingSchedule) return;

    try {
      const displayRef = doc(db, 'displays', targetUid);
      let newItems;
      let field;

      if (editingSchedule.type === 'content') {
        newItems = [...contents];
        field = 'contents';
      } else if (editingSchedule.type === 'quote') {
        newItems = [...quotes];
        field = 'quotes';
      } else {
        newItems = [...tickers];
        field = 'tickers';
      }
      
      // @ts-ignore
      newItems[editingSchedule.index].schedule = schedule;

      await updateDoc(displayRef, {
        [field]: newItems
      });
      
      setEditingSchedule(null);
    } catch (err) {
      console.error("Error updating schedule:", err);
      alert("Error al guardar el horario.");
    }
  };

  const ScheduleModal = ({ item, onSave, onClose }: { item: ContentItem | QuoteItem | TickerItem, onSave: (s: Schedule) => void, onClose: () => void }) => {
    const [schedule, setSchedule] = useState<Schedule>(item.schedule || {
      enabled: false,
      startTime: '00:00',
      endTime: '23:59',
      days: [0, 1, 2, 3, 4, 5, 6]
    });

    const toggleDay = (day: number) => {
      setSchedule(prev => ({
        ...prev,
        days: prev.days.includes(day) 
          ? prev.days.filter(d => d !== day)
          : [...prev.days, day].sort()
      }));
    };

    const daysOfWeek = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];

    return (
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-6"
      >
        <motion.div 
          initial={{ scale: 0.9, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          className="w-full max-w-md rounded-3xl border border-white/10 bg-[#111] p-8 shadow-2xl"
        >
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Clock className="text-white/60" size={20} />
              <h3 className="text-xl font-semibold">Configurar Horario</h3>
            </div>
            <button onClick={onClose} className="rounded-full bg-white/5 p-2 hover:bg-white/10">
              <X size={20} />
            </button>
          </div>

          <div className="space-y-6">
            <div className="flex items-center justify-between rounded-2xl bg-white/5 p-4">
              <span className="text-sm font-medium">Activar Horario</span>
              <button 
                onClick={() => setSchedule(prev => ({ ...prev, enabled: !prev.enabled }))}
                className={`h-6 w-12 rounded-full transition-colors ${schedule.enabled ? 'bg-green-500' : 'bg-white/10'}`}
              >
                <div className={`h-4 w-4 rounded-full bg-white transition-transform ${schedule.enabled ? 'translate-x-7' : 'translate-x-1'}`} />
              </button>
            </div>

            <div className={`space-y-4 transition-opacity ${schedule.enabled ? 'opacity-100' : 'opacity-30 pointer-events-none'}`}>
              {!schedule.enabled && (
                <p className="text-[10px] text-white/40 italic text-center">
                  Si el horario está desactivado, el contenido se mostrará siempre.
                </p>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Desde</label>
                  <input 
                    type="time" 
                    value={schedule.startTime}
                    onChange={(e) => setSchedule(prev => ({ ...prev, startTime: e.target.value }))}
                    className="w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-sm focus:border-white/20 focus:outline-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Hasta</label>
                  <input 
                    type="time" 
                    value={schedule.endTime}
                    onChange={(e) => setSchedule(prev => ({ ...prev, endTime: e.target.value }))}
                    className="w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-sm focus:border-white/20 focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Días de la semana</label>
                <div className="flex justify-between gap-2">
                  {daysOfWeek.map((day, idx) => (
                    <button
                      key={idx}
                      onClick={() => toggleDay(idx)}
                      className={`h-10 w-10 rounded-xl text-xs font-bold transition-all ${
                        schedule.days.includes(idx) ? 'bg-white text-black' : 'bg-white/5 text-white/40 hover:bg-white/10'
                      }`}
                    >
                      {day}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <button 
              onClick={() => onSave(schedule)}
              className="w-full rounded-2xl bg-white py-4 text-sm font-bold text-black transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              Guardar Configuración
            </button>
          </div>
        </motion.div>
      </motion.div>
    );
  };

  const displayUrl = slug 
    ? `${window.location.origin}/${slug}`
    : `${window.location.origin}/view?id=${targetUid}`;

  const qrRef = useRef<HTMLDivElement>(null);

  const handleDownloadQR = () => {
    const canvas = qrRef.current?.querySelector('canvas');
    if (canvas) {
      const url = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = 'auradisplay-qr.png';
      link.href = url;
      link.click();
    }
  };

  const handleShareQR = async () => {
    const canvas = qrRef.current?.querySelector('canvas');
    if (canvas) {
      canvas.toBlob(async (blob) => {
        if (blob && navigator.share) {
          const file = new File([blob], 'auradisplay-qr.png', { type: 'image/png' });
          await navigator.share({
            files: [file],
            title: 'Aura Digital Pass',
            text: `Accede a mi display Aura: ${displayUrl}`
          }).catch(console.error);
        } else {
          alert("Tu navegador no soporta compartir imágenes directamente.");
        }
      });
    }
  };

  const copyUrl = () => {
    navigator.clipboard.writeText(displayUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleUpdateConfig = async () => {
    if (!user || !targetUid) return;
    try {
      const displayRef = doc(db, 'displays', targetUid);
      const userRef = doc(db, 'users', targetUid);
      
      const cleanSlug = slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '');

      await Promise.all([
        updateDoc(displayRef, {
          establishmentName,
          adminTitle,
          location,
          theme,
          tickerTheme,
          performanceMode,
          isZenMode,
          isNoDistractionsMode,
          isRemoteControl,
          volume,
          isFullscreenRequested,
          refreshRequestedAt,
          showTicker,
          auraAgentEnabled,
          auraAgentWhatsApp,
          updatedAt: Date.now()
        }),
        updateDoc(userRef, {
          slug: cleanSlug
        })
      ]);
      setSlug(cleanSlug);
      toast("Configuración actualizada", "success");
    } catch (err) {
      console.error("Error updating config:", err);
      toast("Error al actualizar configuración", "error");
    }
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans selection:bg-white/10">
      {/* Pairing Overlay */}
      <AnimatePresence>
        {pairingInfo && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 backdrop-blur-xl p-6"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="w-full max-w-md rounded-[2.5rem] border border-white/10 bg-[#111] p-10 text-center shadow-2xl"
            >
              <div className="mb-6 flex justify-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/5 ring-1 ring-white/10">
                  <Tv className="text-white" size={32} />
                </div>
              </div>
              
              <h2 className="mb-2 text-2xl font-bold tracking-tight">Vincular Nueva Pantalla</h2>
              <p className="mb-8 text-sm text-white/50">
                ¿Deseas vincular esta Smart TV a tu cuenta de <b>{establishmentName || userProfile?.email}</b>?
              </p>

              <div className="mb-10 rounded-2xl bg-white/5 p-6 border border-white/5">
                <span className="text-[10px] font-bold uppercase tracking-widest text-white/30 block mb-2">Código de Dispositivo</span>
                <span className="text-3xl font-mono font-black tracking-widest text-white">{pairingInfo.code}</span>
              </div>

              <div className="flex flex-col gap-3">
                <button 
                  onClick={handleConfirmPairing}
                  disabled={isPairing}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white py-4 text-sm font-bold text-black transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
                >
                  {isPairing ? <Loader2 className="animate-spin" size={18} /> : <Check size={18} />}
                  Confirmar Vinculación
                </button>
                <button 
                  onClick={() => {
                    setPairingInfo(null);
                    searchParams.delete('pair');
                    navigate(`/admin?${searchParams.toString()}`, { replace: true });
                  }}
                  disabled={isPairing}
                  className="w-full rounded-2xl bg-white/5 py-4 text-sm font-bold text-white/60 transition-all hover:bg-white/10"
                >
                  Cancelar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Manual Pairing Modal */}
      <AnimatePresence>
        {showManualPairing && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 backdrop-blur-xl p-6"
            onClick={() => setShowManualPairing(false)}
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="w-full max-w-md rounded-[2.5rem] border border-white/10 bg-[#111] p-10 text-center shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-6 flex justify-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/5 ring-1 ring-white/10">
                  <Tv className="text-white" size={32} />
                </div>
              </div>
              
              <h2 className="mb-2 text-2xl font-bold tracking-tight">Vincular Smart TV</h2>
              <p className="mb-8 text-sm text-white/50">
                Escanea el código QR de tu TV o introduce el código de 6 dígitos manualmente.
              </p>

              <div className="space-y-6">
                {isScanning ? (
                  <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black">
                    <div id="reader" className="w-full aspect-square"></div>
                    <button 
                      onClick={stopScanner}
                      className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-red-500 px-6 py-2 text-[10px] font-bold uppercase tracking-widest text-white shadow-xl tv-focus"
                    >
                      Detener Cámara
                    </button>
                  </div>
                ) : (
                  <button 
                    onClick={startScanner}
                    className="flex w-full items-center justify-center gap-3 rounded-2xl border border-white/10 bg-white/5 py-6 transition-all hover:bg-white/10 group tv-focus"
                  >
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/10 group-hover:bg-white group-hover:text-black transition-all">
                      <Scan size={24} />
                    </div>
                    <div className="text-left">
                      <span className="block text-sm font-bold text-white">Escanear Código QR</span>
                      <span className="block text-[10px] text-white/40 uppercase tracking-widest">Usar cámara del móvil</span>
                    </div>
                  </button>
                )}

                <div className="relative flex items-center py-4">
                  <div className="flex-grow border-t border-white/5"></div>
                  <span className="mx-4 flex-shrink text-[10px] font-bold uppercase tracking-widest text-white/20">O introduce el código</span>
                  <div className="flex-grow border-t border-white/5"></div>
                </div>

                <form onSubmit={handleManualPairing} className="space-y-6">
                  <div className="relative">
                    <input 
                      type="text"
                      value={manualCode}
                      onChange={(e) => setManualCode(e.target.value.toUpperCase())}
                      placeholder="ABCDEF"
                      maxLength={6}
                      className="w-full rounded-2xl border border-white/10 bg-white/5 px-6 py-5 text-center text-4xl font-mono font-black tracking-[0.3em] text-white placeholder:text-white/10 focus:border-white/20 focus:outline-none tv-focus"
                    />
                  </div>

                  <div className="flex flex-col gap-3">
                    <button 
                      type="submit"
                      disabled={isPairing || manualCode.length < 6}
                      className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white py-4 text-sm font-bold text-black transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 tv-focus"
                    >
                      {isPairing ? <Loader2 className="animate-spin" size={18} /> : <Check size={18} />}
                      Vincular Dispositivo
                    </button>
                    <button 
                      type="button"
                      onClick={() => {
                        stopScanner();
                        setShowManualPairing(false);
                      }}
                      className="w-full rounded-2xl bg-white/5 py-4 text-sm font-bold text-white/60 transition-all hover:bg-white/10 tv-focus"
                    >
                      Cancelar
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Warning Modal (Stop first) */}
      <AnimatePresence>
        {showWarningModal.show && (
          <div className="fixed inset-0 z-[210] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md overflow-hidden rounded-3xl border border-white/10 bg-zinc-900 shadow-2xl"
            >
              <div className="p-8 text-center">
                <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-red-500/10 text-red-500">
                  <AlertTriangle size={40} />
                </div>
                <h3 className="mb-2 text-2xl font-bold text-white">Impulso en Curso</h3>
                <p className="text-zinc-400">
                  {showWarningModal.message}
                </p>
              </div>
              <div className="p-4 border-t border-white/5">
                <button
                  onClick={() => setShowWarningModal({ show: false, message: '' })}
                  className="w-full rounded-2xl bg-white/10 py-4 text-sm font-bold text-white transition-colors hover:bg-white/20"
                >
                  ENTENDIDO
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Toast Notification */}
      <AnimatePresence>
        {showToast.show && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className={`fixed bottom-8 left-1/2 -translate-x-1/2 z-[250] px-6 py-3 rounded-full font-bold text-xs uppercase tracking-widest shadow-2xl flex items-center gap-3 ${
              showToast.type === 'error' ? 'bg-red-500 text-white' : 
              showToast.type === 'info' ? 'bg-blue-500 text-white' : 
              'bg-yellow-500 text-black'
            }`}
          >
            {showToast.type === 'error' ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
            {showToast.message}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {showConfirmModal.show && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md overflow-hidden rounded-3xl border border-white/10 bg-zinc-900 shadow-2xl"
            >
              <div className="p-8 text-center">
                <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-yellow-500/10 text-yellow-500">
                  <Activity size={40} />
                </div>
                <h3 className="mb-2 text-2xl font-bold text-white">Confirmar Impulso</h3>
                <p className="text-zinc-400">
                  ¿Vas a activar el modo <span className="font-bold text-white">{showConfirmModal.impulse?.label}</span>?
                </p>
                <p className="mt-2 text-sm text-zinc-500">
                  Esto detendrá la música actual para reproducir la playlist seleccionada.
                </p>
              </div>
              <div className="flex border-t border-white/5">
                <button
                  onClick={() => setShowConfirmModal({ show: false, impulse: null })}
                  className="flex-1 px-6 py-4 text-sm font-bold text-zinc-400 transition-colors hover:bg-white/5"
                >
                  CANCELAR
                </button>
                <button
                  onClick={confirmTriggerImpulse}
                  className="flex-1 bg-yellow-500 px-6 py-4 text-sm font-bold text-black transition-colors hover:bg-yellow-400"
                >
                  ACTIVAR AHORA
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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
              className="w-full max-w-2xl rounded-[3rem] border border-white/10 bg-black/60 p-10 shadow-2xl"
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
                  const isActive = (impulse.id === 'auto' && !clientConfig?.modo_manual?.activo) || 
                                 (clientConfig?.modo_manual?.activo && clientConfig?.modo_manual?.carpeta === impulse.id);
                  const isOtherActive = clientConfig?.modo_manual?.activo && clientConfig?.modo_manual?.carpeta !== impulse.id;
                  
                  return (
                    <button
                      key={impulse.id}
                      onClick={() => triggerImpulse(impulse)}
                      className={`flex items-start gap-4 p-4 rounded-2xl border transition-all text-left group tv-focus cursor-pointer ${
                        isActive 
                          ? 'border-yellow-500 bg-yellow-500/10 !cursor-default' 
                          : 'border-white/5 bg-white/5 hover:bg-white/10 hover:border-white/10'
                      }`}
                    >
                      <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-2xl group-hover:scale-110 transition-transform ${
                        isActive ? 'bg-yellow-500 text-black' : 'bg-white/5'
                      }`}>
                        {impulse.icon}
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <p className={`text-sm font-bold transition-colors ${
                            isActive ? 'text-yellow-500' : 'text-white group-hover:text-yellow-400'
                          }`}>
                            {impulse.label}
                            {isActive && " (ACTIVO)"}
                          </p>
                        </div>
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

      {/* Circadian Schedule Modal */}
      <AnimatePresence>
        {showCircadianModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[150] flex items-center justify-center bg-black/95 p-6 backdrop-blur-2xl"
            onClick={() => setShowCircadianModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="w-full max-w-3xl rounded-[2rem] sm:rounded-[3rem] border border-white/10 bg-zinc-900 p-6 sm:p-10 shadow-2xl relative overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <button 
                onClick={() => setShowCircadianModal(false)}
                className="absolute top-6 right-6 p-2 rounded-full bg-white/5 text-white/40 hover:bg-white/10 hover:text-white transition-all sm:hidden"
              >
                <X size={20} />
              </button>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                <div>
                  <h3 className="font-serif text-2xl sm:text-3xl italic tracking-tight text-white">Configurar Horario Circadiano</h3>
                  <p className="text-[10px] text-white/40 uppercase tracking-widest mt-1">Personalización de Franjas Horarias</p>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => {
                      if (window.confirm("¿Restablecer al horario estándar de Aura?")) {
                        handleUpdateCircadianSchedule(DEFAULT_CIRCADIAN);
                      }
                    }}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-white/60 transition-all hover:bg-white hover:text-black"
                  >
                    Restablecer
                  </button>
                </div>
              </div>

              <div className="grid gap-4 max-h-[60vh] sm:max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
                {(clientConfig?.circadian_schedule || DEFAULT_CIRCADIAN).map((slot: any, idx: number) => (
                  <div key={idx} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 rounded-2xl bg-white/5 p-4 border border-white/5">
                    <div className="grid grid-cols-2 sm:flex sm:items-center gap-4 flex-1">
                      <div className="space-y-1">
                        <label className="text-[8px] font-bold uppercase tracking-widest text-white/30 block">Inicio (H)</label>
                        <select 
                          value={slot.start}
                          onChange={(e) => {
                            const newSched = [...(clientConfig?.circadian_schedule || DEFAULT_CIRCADIAN)];
                            newSched[idx] = { ...slot, start: parseInt(e.target.value) };
                            handleUpdateCircadianSchedule(newSched);
                          }}
                          className="w-full rounded-lg bg-black/40 border border-white/10 p-2.5 text-xs focus:outline-none appearance-none"
                        >
                          {Array.from({length: 24}).map((_, h) => <option key={h} value={h}>{h}:00</option>)}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[8px] font-bold uppercase tracking-widest text-white/30 block">Fin (H)</label>
                        <select 
                          value={slot.end}
                          onChange={(e) => {
                            const newSched = [...(clientConfig?.circadian_schedule || DEFAULT_CIRCADIAN)];
                            newSched[idx] = { ...slot, end: parseInt(e.target.value) };
                            handleUpdateCircadianSchedule(newSched);
                          }}
                          className="w-full rounded-lg bg-black/40 border border-white/10 p-2.5 text-xs focus:outline-none appearance-none"
                        >
                          {Array.from({length: 25}, (_, i) => i).filter(h => h > 0).map((h) => <option key={h} value={h}>{h}:00</option>)}
                        </select>
                      </div>
                      <div className="col-span-2 sm:flex-[2] space-y-1">
                        <label className="text-[8px] font-bold uppercase tracking-widest text-white/30 block">Carpeta de Playlist</label>
                        <select 
                          value={slot.folder}
                          onChange={(e) => {
                            const newSched = [...(clientConfig?.circadian_schedule || DEFAULT_CIRCADIAN)];
                            newSched[idx] = { ...slot, folder: e.target.value };
                            handleUpdateCircadianSchedule(newSched);
                          }}
                          className="w-full rounded-lg bg-black/40 border border-white/10 p-2.5 text-xs focus:outline-none appearance-none"
                        >
                          {COMMERCIAL_IMPULSES.filter(i => i.id !== 'auto').map(imp => (
                            <option key={imp.id} value={imp.id}>{imp.label}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="flex sm:block justify-end">
                      <button 
                        onClick={() => {
                          const newSched = (clientConfig?.circadian_schedule || DEFAULT_CIRCADIAN).filter((_: any, i: number) => i !== idx);
                          handleUpdateCircadianSchedule(newSched);
                        }}
                        className="w-full sm:w-auto p-3 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all flex-shrink-0 flex items-center justify-center"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-8 flex flex-col sm:flex-row gap-4">
                <button 
                  onClick={() => {
                    const current = clientConfig?.circadian_schedule || DEFAULT_CIRCADIAN;
                    const lastEnd = current.length > 0 ? current[current.length - 1].end : 0;
                    handleUpdateCircadianSchedule([...current, { start: lastEnd, end: Math.min(24, lastEnd + 2), folder: 'active' }]);
                  }}
                  className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-white/20 bg-white/5 py-4 text-[10px] font-bold uppercase tracking-widest text-white/60 transition-all hover:bg-white/10 hover:text-white"
                >
                  <Plus size={16} />
                  Añadir Tramo
                </button>
                <button 
                  onClick={() => setShowCircadianModal(false)}
                  className="rounded-2xl bg-white py-4 text-[10px] font-bold uppercase tracking-widest text-black transition-all hover:scale-[1.02] shadow-xl shadow-white/5"
                >
                  Guardar y Cerrar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header - Refined for Mobile */}
      <header className="sticky top-0 z-50 border-b border-white/5 bg-black/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex h-8 w-8 rounded-lg bg-gradient-to-br from-white/20 to-white/5 p-1.5 ring-1 ring-white/10">
              <ImageIcon className="h-full w-full text-white" />
            </div>
            <h1 className="text-base sm:text-lg font-medium tracking-tight truncate max-w-[150px] sm:max-w-none">
              {impersonatedUid 
                ? `Gestionando: ${targetUserProfile?.email || '...'}` 
                : (isSuperAdmin ? 'Super Admin Aura' : (adminTitle || establishmentName || 'Aura Admin'))}
            </h1>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            {isSuperAdmin && (
              <button 
                onClick={() => navigate('/admin/super')}
                className="flex items-center gap-2 rounded-full bg-red-500/10 px-3 py-2 sm:px-4 sm:py-2 text-[10px] font-bold uppercase tracking-widest text-red-500 transition-all hover:bg-red-500 hover:text-white tv-focus"
              >
                <ShieldCheck size={14} />
                <span className="hidden sm:inline">Panel SuperAdmin</span>
              </button>
            )}
            <button 
              onClick={() => setShowManualPairing(true)}
              className="group flex h-9 w-9 sm:h-auto sm:w-auto items-center justify-center sm:gap-2 rounded-full bg-white/10 sm:px-4 sm:py-2 text-[10px] sm:text-xs font-bold uppercase tracking-widest text-white transition-all hover:bg-white hover:text-black tv-focus"
              title="Vincular TV"
            >
              <Plus size={16} />
              <span className="hidden sm:inline">Vincular TV</span>
            </button>
            <button 
              onClick={handleLogout}
              className="group flex h-9 w-9 sm:h-auto sm:w-auto items-center justify-center sm:gap-2 rounded-full bg-white/5 sm:px-4 sm:py-2 text-[10px] sm:text-xs font-medium text-white/60 transition-all hover:bg-white/10 hover:text-white tv-focus"
              title="Cerrar Sesión"
            >
              <LogOut size={16} className="transition-transform group-hover:-translate-x-0.5" />
              <span className="hidden sm:inline">Cerrar</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-4 md:p-10 pb-32 md:pb-10 overflow-x-hidden">
        {/* Mobile Tab Switcher */}
        <div className="flex md:hidden mb-6 p-1 bg-black/60 rounded-2xl border border-white/10 backdrop-blur-xl sticky top-[75px] z-40 shadow-2xl">
          <button 
            onClick={() => setActiveTab('visual')}
            className={`flex-1 py-3 text-[10px] font-bold uppercase tracking-widest rounded-xl transition-all ${activeTab === 'visual' ? 'bg-white text-black shadow-lg shadow-white/5' : 'text-white/40'}`}
          >
            Visual
          </button>
          <button 
            onClick={() => setActiveTab('slides')}
            className={`flex-1 py-3 text-[10px] font-bold uppercase tracking-widest rounded-xl transition-all ${activeTab === 'slides' ? 'bg-white text-black shadow-lg shadow-white/5' : 'text-white/40'}`}
          >
            Slides
          </button>
          <button 
            onClick={() => setActiveTab('config')}
            className={`flex-1 py-3 text-[10px] font-bold uppercase tracking-widest rounded-xl transition-all ${activeTab === 'config' ? 'bg-white text-black shadow-lg shadow-white/5' : 'text-white/40'}`}
          >
            Ajustes
          </button>
        </div>

        <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
          {/* Left: Content Management */}
          <div className="space-y-12">
            {/* Gallery Section */}
            <div className={`${activeTab !== 'visual' ? 'hidden md:block' : 'block'} space-y-6 group/visual active:scale-[0.998] transition-transform duration-500`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-3xl bg-white/[0.02] border border-white/5 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-blue-500/50" />
                <div className="relative z-10">
                  <h2 className="text-2xl font-semibold tracking-tight">Galería de Imágenes</h2>
                  <p className="text-sm text-white/40">Gestiona las imágenes de tu rotativa en tiempo real.</p>
                </div>
              <div className="flex flex-wrap items-center gap-2">
                {contents.length > 0 && (
                  <button 
                    onClick={handleDeleteAllContents}
                    className="flex items-center gap-2 rounded-xl bg-red-500/10 px-3 py-2 text-xs font-bold text-red-500 transition-all hover:bg-red-500 hover:text-white tv-focus"
                  >
                    <Trash2 size={16} />
                    <span className="hidden sm:inline">Borrar Todo</span>
                  </button>
                )}
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="flex items-center justify-center gap-2 rounded-xl bg-white px-3 py-2 text-xs font-bold text-black transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 tv-focus"
                >
                  {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                  {uploading ? '...' : 'Subir'}
                </button>
                <button 
                  onClick={() => setShowCircadianModal(true)}
                  className="flex items-center gap-2 rounded-xl bg-blue-500/10 px-3 py-2 text-xs font-bold text-blue-500 border border-blue-500/20 transition-all hover:bg-blue-500 hover:text-white tv-focus"
                >
                  <Clock size={16} />
                  <span className="hidden sm:inline">Configurar Horario</span>
                </button>
                {canShowImpulses && (
                  <button 
                    onClick={() => setShowImpulses(true)}
                    className="flex items-center gap-2 rounded-xl bg-yellow-500/10 px-3 py-2 text-xs font-bold text-yellow-500 border border-yellow-500/20 transition-all hover:bg-yellow-500 hover:text-black tv-focus"
                  >
                    <Activity size={16} />
                    <span className="hidden sm:inline">Impulsos Aura</span>
                  </button>
                )}
              </div>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleUpload} 
                className="hidden" 
                accept="image/*"
              />
            </div>

            <div 
              className={`grid gap-4 sm:grid-cols-2 xl:grid-cols-3 transition-all duration-300 rounded-3xl p-4 ${isDragging ? 'bg-white/5 ring-2 ring-dashed ring-white/20' : ''}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <AnimatePresence mode="popLayout">
                {contents.map((item) => (
                  <motion.div
                    key={item.createdAt}
                    layout
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="group relative aspect-video overflow-hidden rounded-2xl border border-white/5 bg-white/5"
                  >
                    <img 
                      src={item.url} 
                      alt={item.name} 
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                    <div className="absolute bottom-0 left-0 right-0 p-4 translate-y-2 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 overflow-hidden">
                          <span className="truncate text-[10px] font-medium text-white/80">{item.name}</span>
                          {item.schedule?.enabled && <Clock size={10} className="text-green-400 flex-shrink-0" />}
                        </div>
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={() => {
                              setNewQuote({ ...newQuote, imageUrl: item.url });
                              document.getElementById('quote-form')?.scrollIntoView({ behavior: 'smooth' });
                            }}
                            className="rounded-lg bg-white/20 p-2 text-white backdrop-blur-md transition-colors hover:bg-yellow-500 hover:text-black tv-focus"
                            title="Añadir a Slides"
                          >
                            <Monitor size={14} />
                          </button>
                          <button 
                            onClick={() => setEditingSchedule({ type: 'content', index: contents.indexOf(item) })}
                            className="rounded-lg bg-white/20 p-2 text-white backdrop-blur-md transition-colors hover:bg-white hover:text-black tv-focus"
                          >
                            <Clock size={14} />
                          </button>
                          <button 
                            onClick={() => handleDelete(item)}
                            className="rounded-lg bg-red-500/20 p-2 text-red-400 backdrop-blur-md transition-colors hover:bg-red-500 hover:text-white tv-focus"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
              
              {contents.length === 0 && !uploading && (
                <div className="col-span-full flex h-60 flex-col items-center justify-center rounded-3xl border border-dashed border-white/10 bg-white/[0.02]">
                  <div className="mb-4 rounded-full bg-white/5 p-4">
                    <ImageIcon className="h-6 w-6 text-white/20" />
                  </div>
                  <p className="text-sm text-white/30 text-center px-4">No hay contenidos todavía. Empezar subiendo una imagen.</p>
                </div>
              )}
            </div>
          </div>

            {/* Quotes & Tickers Section - Grouped for Mobile */}
            <div className={`${activeTab !== 'slides' ? 'hidden md:block' : 'block'} space-y-12 pt-10 border-t border-white/5`}>
              <div className="space-y-6 group/slides">
                <div className="flex items-center justify-between p-6 rounded-3xl bg-white/[0.02] border border-white/5 relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-1 h-full bg-yellow-500/50" />
                  <div className="relative z-10">
                    <h2 className="text-2xl font-semibold tracking-tight text-white">Slides de Contenido</h2>
                    <p className="text-sm text-white/40">Contenidos que rotarán a pantalla completa.</p>
                  </div>
                  {quotes.length > 0 && (
                    <button 
                      onClick={handleDeleteAllQuotes}
                      className="flex items-center gap-2 rounded-xl bg-red-500/10 px-4 py-2 text-xs font-bold text-red-500 transition-all hover:bg-red-500 hover:text-white tv-focus"
                    >
                      <Trash2 size={14} />
                      Borrar Todo
                    </button>
                  )}
                </div>

              <form id="quote-form" onSubmit={handleAddQuote} className="grid gap-4 rounded-3xl border border-white/5 bg-white/[0.02] p-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Categoría (ej: DESAYUNOS)</label>
                    <input 
                      type="text" 
                      value={newQuote.category}
                      onChange={(e) => setNewQuote({ ...newQuote, category: e.target.value })}
                      placeholder="Ej: DESAYUNOS"
                      className="w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-sm focus:border-white/20 focus:outline-none tv-focus"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Título Principal</label>
                    <input 
                      type="text" 
                      value={newQuote.text}
                      onChange={(e) => setNewQuote({ ...newQuote, text: e.target.value })}
                      placeholder="Ej: Desayuno Completo"
                      className="w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-sm focus:border-white/20 focus:outline-none"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Precio / Subtítulo</label>
                    <input 
                      type="text" 
                      value={newQuote.price}
                      onChange={(e) => setNewQuote({ ...newQuote, price: e.target.value })}
                      placeholder="Ej: 3,50€"
                      className="w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-sm focus:border-white/20 focus:outline-none"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Etiqueta Inferior (ej: SEVILLA)</label>
                    <input 
                      type="text" 
                      value={newQuote.tag}
                      onChange={(e) => setNewQuote({ ...newQuote, tag: e.target.value })}
                      placeholder="Ej: SEVILLA (NERVIÓN)"
                      className="w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-sm focus:border-white/20 focus:outline-none"
                    />
                  </div>
                  <div className="col-span-full space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">URL Imagen de Fondo</label>
                    <input 
                      type="text" 
                      value={newQuote.imageUrl}
                      onChange={(e) => setNewQuote({ ...newQuote, imageUrl: e.target.value })}
                      placeholder="Ej: https://images.unsplash.com/..."
                      className="w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-sm focus:border-white/20 focus:outline-none"
                    />
                  </div>
                  <div className="col-span-full space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Mensaje Ticker (Fluye abajo)</label>
                    <input 
                      type="text" 
                      value={newQuote.ticker}
                      onChange={(e) => setNewQuote({ ...newQuote, ticker: e.target.value })}
                      placeholder="Ej: A 5 MIN. MATRÍCULA GRATIS CON TU TICKET DE HOY."
                      className="w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-sm focus:border-white/20 focus:outline-none"
                    />
                  </div>
                  <div className="col-span-full space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Opciones Visuales</label>
                    <div className="flex items-center gap-4">
                      <button
                        type="button"
                        onClick={() => setNewQuote({ ...newQuote, showClock: !newQuote.showClock })}
                        className={`flex items-center gap-2 rounded-xl border px-4 py-3 transition-all ${newQuote.showClock ? 'border-yellow-500/50 bg-yellow-500/10 text-yellow-500' : 'border-white/10 bg-white/5 text-white/40 hover:bg-white/10'}`}
                      >
                        <Clock size={14} />
                        <span className="text-[10px] font-bold uppercase tracking-widest">Capas Visuales: Reloj</span>
                      </button>
                      <p className="text-[9px] text-white/20 uppercase tracking-widest italic leading-tight">
                        * Puedes configurar el horario (horas y días) de cada slide pulsando el icono del reloj en la lista inferior una vez creada.
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex gap-3">
                  <button 
                    type="submit"
                    disabled={!(newQuote.text || newQuote.imageUrl || newQuote.category || newQuote.price || newQuote.tag)}
                    className={`flex-1 rounded-xl py-3 text-sm font-bold uppercase tracking-widest transition-all disabled:opacity-30 ${editingQuoteIndex !== null ? 'bg-green-500 text-white hover:bg-green-600' : 'bg-white/10 hover:bg-white hover:text-black'}`}
                  >
                    {editingQuoteIndex !== null ? 'Actualizar Slide' : 'Añadir Slide'}
                  </button>
                  <button 
                    type="button"
                    onClick={() => {
                      setEditingQuoteIndex(null);
                      setNewQuote({ category: '', text: '', price: '', tag: '', ticker: '', imageUrl: '', showClock: false });
                    }}
                    className="rounded-xl bg-white/5 px-6 py-3 text-sm font-bold uppercase tracking-widest text-white/60 transition-all hover:bg-white/10 hover:text-white"
                  >
                    {editingQuoteIndex !== null ? 'Cancelar' : 'Limpiar'}
                  </button>
                </div>
              </form>

              <div className="space-y-3">
                <AnimatePresence mode="popLayout">
                  {quotes.map((quote, idx) => (
                    <motion.div
                      key={idx}
                      layout
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      className="flex items-center justify-between gap-4 rounded-2xl border border-white/5 bg-white/[0.02] p-4 group"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-white/90 truncate">
                            {quote.text ? `"${quote.text}"` : "(Slide solo imagen)"}
                          </p>
                          {quote.schedule?.enabled && <Clock size={10} className="text-green-400" />}
                        </div>
                        <p className="text-[10px] text-white/30 uppercase tracking-widest truncate">
                          {quote.category && `${quote.category} • `} {quote.price} {quote.tag && ` • ${quote.tag}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => startEditingQuote(idx)}
                          className="rounded-lg bg-white/5 p-2 text-white/40 transition-all hover:bg-white/10 hover:text-white"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button 
                          onClick={() => setEditingSchedule({ type: 'quote', index: idx })}
                          className="rounded-lg bg-white/5 p-2 text-white/40 transition-all hover:bg-white/10 hover:text-white"
                        >
                          <Clock size={14} />
                        </button>
                        <button 
                          onClick={() => handleDeleteQuote(quote)}
                          className="rounded-lg bg-white/5 p-2 text-white/20 transition-all hover:bg-red-500/20 hover:text-red-400"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
                
                {quotes.length === 0 && (
                  <div className="flex h-32 flex-col items-center justify-center rounded-3xl border border-dashed border-white/10 bg-white/[0.02]">
                    <p className="text-xs text-white/20">No hay textos configurados.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Tickers Management */}
            {(targetUserProfile?.hasAdsPanel || isSuperAdmin) && (
              <div className="space-y-6 pt-10 border-t border-white/5">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-semibold tracking-tight">Mensajes del Ticker</h2>
                    <p className="text-sm text-white/40">Gestiona los mensajes que fluyen en la barra inferior (Independientes).</p>
                  </div>
                </div>

                <form id="ticker-form" onSubmit={handleAddTicker} className="grid gap-4 rounded-3xl border border-white/5 bg-white/[0.02] p-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Mensaje del Ticker</label>
                    <div className="flex gap-3">
                      <input 
                        type="text" 
                        value={newTicker}
                        onChange={(e) => setNewTicker(e.target.value)}
                        placeholder="Ej: PRÓXIMA JUNTA DE VECINOS EL LUNES A LAS 19:00"
                        className="flex-1 rounded-xl border border-white/10 bg-black px-4 py-3 text-sm focus:border-white/20 focus:outline-none"
                      />
                      <button 
                        type="submit"
                        disabled={!newTicker}
                        className={`rounded-xl px-8 py-3 text-sm font-bold uppercase tracking-widest transition-all disabled:opacity-30 ${editingTickerIndex !== null ? 'bg-green-500 text-white hover:bg-green-600' : 'bg-white/10 hover:bg-white hover:text-black'}`}
                      >
                        {editingTickerIndex !== null ? <Check size={18} /> : <Plus size={18} />}
                      </button>
                      {editingTickerIndex !== null && (
                        <button 
                          type="button"
                          onClick={() => {
                            setEditingTickerIndex(null);
                            setNewTicker('');
                          }}
                          className="rounded-xl bg-white/5 px-4 py-3 text-white/60 transition-all hover:bg-white/10 hover:text-white"
                        >
                          <X size={18} />
                        </button>
                      )}
                    </div>
                  </div>
                </form>

                <div className="space-y-3">
                  <AnimatePresence mode="popLayout">
                    {tickers.map((ticker, idx) => (
                      <motion.div
                        key={idx}
                        layout
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        className="flex items-center justify-between gap-4 rounded-2xl border border-white/5 bg-white/[0.02] p-4 group"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-medium text-white/90 break-words line-clamp-2">{ticker.text}</p>
                            {ticker.schedule?.enabled && <Clock size={10} className="text-green-400 flex-shrink-0 mt-1" />}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => startEditingTicker(idx)}
                            className="rounded-lg bg-white/5 p-2 text-white/40 transition-all hover:bg-white/10 hover:text-white"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button 
                            onClick={() => setEditingSchedule({ type: 'ticker', index: idx })}
                            className="rounded-lg bg-white/5 p-2 text-white/40 transition-all hover:bg-white/10 hover:text-white"
                          >
                            <Clock size={14} />
                          </button>
                          <button 
                            onClick={() => handleDeleteTicker(ticker)}
                            className="rounded-lg bg-white/5 p-2 text-white/20 transition-all hover:bg-red-500/20 hover:text-red-400"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                  
                  {tickers.length === 0 && (
                    <div className="flex h-24 flex-col items-center justify-center rounded-3xl border border-dashed border-white/10 bg-white/[0.02]">
                      <p className="text-xs text-white/20">No hay mensajes de ticker configurados.</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

          {/* Right Column: Config & QR */}
          <div className={`${activeTab !== 'config' ? 'hidden md:block' : 'block'} space-y-8`}>
            <div className="group/config rounded-[2rem] border border-white/5 bg-white/[0.03] p-8 backdrop-blur-sm relative overflow-hidden transition-all hover:bg-white/[0.04]">
              <div className="absolute top-0 left-0 w-1.5 h-full bg-green-500/50" />
              <h3 className="mb-6 text-[10px] font-bold uppercase tracking-[0.3em] text-white/40">Configuración de Pantalla</h3>
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Nombre Establecimiento</label>
                  <input 
                    type="text" 
                    value={establishmentName}
                    onChange={(e) => setEstablishmentName(e.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-black px-5 py-4 text-sm focus:border-white/20 focus:outline-none transition-all focus:ring-1 focus:ring-white/10"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Título Panel de Control</label>
                  <input 
                    type="text" 
                    value={adminTitle}
                    onChange={(e) => setAdminTitle(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-sm focus:border-white/20 focus:outline-none"
                    placeholder="Ej: Mi Negocio Admin"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Ubicación (Ciudad, País)</label>
                  <input 
                    type="text" 
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-sm focus:border-white/20 focus:outline-none"
                    placeholder="Huelva, ES"
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">URL Personalizada (Slug)</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[10px] font-mono text-white/20">auradisplay.es/</span>
                    <input 
                      type="text" 
                      value={slug}
                      onChange={(e) => setSlug(e.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-black pl-[85px] pr-4 py-3 text-sm focus:border-white/20 focus:outline-none font-mono"
                      placeholder="mi-negocio"
                    />
                  </div>
                  <p className="text-[8px] text-white/20 uppercase">Esta será tu dirección pública: {window.location.origin}/{slug || '...'}</p>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Tema Visual</label>
                  <select 
                    value={theme}
                    onChange={(e) => setTheme(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-sm focus:border-white/20 focus:outline-none"
                  >
                    <option value="classic">Clásico</option>
                    <option value="minimal">Minimalista</option>
                    <option value="tech">Tecnológico</option>
                    <option value="zen">Zen</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Estilo del Ticker (Inferior)</label>
                  <select 
                    value={tickerTheme}
                    onChange={(e) => setTickerTheme(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-sm focus:border-white/20 focus:outline-none"
                  >
                    <option value="classic">Clásico (Amarillo/Negro)</option>
                    <option value="dark">Oscuro (Negro/Blanco)</option>
                    <option value="modern">Moderno (Blanco/Negro)</option>
                    <option value="gold">Premium (Dorado/Negro)</option>
                  </select>
                </div>

                <div className="flex flex-col gap-2 rounded-xl border border-gold/20 bg-gold/5 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Monitor className="w-4 h-4 text-gold" />
                    <h3 className="text-sm font-black uppercase tracking-[0.2em] text-gold">Aura Remote Control</h3>
                  </div>

                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-2 rounded-lg border border-white/5 bg-black/40 p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex flex-col">
                          <span className="text-[10px] font-bold uppercase tracking-widest text-white/80">Volumen Pantalla</span>
                          <span className="text-[8px] uppercase tracking-widest text-white/40">Ajuste de audio remoto</span>
                        </div>
                        <span className="text-xs font-mono text-gold">{Math.round(volume * 100)}%</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <Volume2 size={14} className="text-white/20" />
                        <input 
                          type="range" min="0" max="1" step="0.01" value={volume} 
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            setVolume(val);
                            // Auto-update volume in firestore for immediate effect
                            if (targetUid) {
                              setDoc(doc(db, 'displays', targetUid), { volume: val }, { merge: true });
                            }
                          }}
                          className="flex-1 accent-gold bg-white/10 h-1.5 rounded-full cursor-pointer"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="flex items-center justify-between rounded-lg border border-white/5 bg-black/40 px-3 py-2">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-white/80">Modo Mando (TV)</span>
                        <button 
                          onClick={() => {
                            const newVal = !isRemoteControl;
                            setIsRemoteControl(newVal);
                            if (targetUid) {
                              setDoc(doc(db, 'displays', targetUid), { isRemoteControl: newVal }, { merge: true });
                            }
                          }}
                          className={`h-5 w-10 rounded-full transition-colors relative ${isRemoteControl ? 'bg-gold' : 'bg-white/10'}`}
                        >
                          <div className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${isRemoteControl ? 'left-5.5' : 'left-0.5'}`} />
                        </button>
                      </div>

                      <div className="flex items-center justify-between rounded-lg border border-white/5 bg-black/40 px-3 py-2">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-white/80">Modo Zen (TV)</span>
                        <button 
                          onClick={() => {
                            const newVal = !isZenMode;
                            setIsZenMode(newVal);
                            if (targetUid) {
                              setDoc(doc(db, 'displays', targetUid), { isZenMode: newVal }, { merge: true });
                            }
                          }}
                          className={`h-5 w-10 rounded-full transition-colors relative ${isZenMode ? 'bg-yellow-500' : 'bg-white/10'}`}
                        >
                          <div className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${isZenMode ? 'left-5.5' : 'left-0.5'}`} />
                        </button>
                      </div>

                      <div className="flex items-center justify-between rounded-lg border border-white/5 bg-black/40 px-3 py-2">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-white/80">Sin Distracciones (TV)</span>
                        <button 
                          onClick={() => {
                            const newVal = !isNoDistractionsMode;
                            setIsNoDistractionsMode(newVal);
                            if (targetUid) {
                              setDoc(doc(db, 'displays', targetUid), { isNoDistractionsMode: newVal }, { merge: true });
                            }
                          }}
                          className={`h-5 w-10 rounded-full transition-colors relative ${isNoDistractionsMode ? 'bg-gold shadow-[0_0_10px_rgba(212,175,55,0.3)]' : 'bg-white/10'}`}
                        >
                          <div className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${isNoDistractionsMode ? 'left-5.5' : 'left-0.5'}`} />
                        </button>
                      </div>

                      <button 
                        onClick={async () => {
                          if (!targetUid) return;
                          const displayRef = doc(db, 'displays', targetUid);
                          try {
                            await setDoc(displayRef, { skipTrigger: increment(1) }, { merge: true });
                            toast("Salto de canción enviado", "success");
                          } catch (err) {
                            console.error("Error al saltar canción:", err);
                            toast("Error al saltar canción", "error");
                          }
                        }}
                        className="flex items-center justify-center gap-2 py-2 text-[10px] font-bold uppercase tracking-widest rounded-lg bg-gold/10 text-gold border border-gold/20 hover:bg-gold hover:text-black transition-all"
                      >
                        <RefreshCw size={12} className="rotate-90" />
                        Saltar Canción
                      </button>

                      <button 
                        onClick={() => {
                          setIsFullscreenRequested(true);
                          handleUpdateConfig(); 
                        }}
                        disabled={isFullscreenRequested}
                        className={`flex items-center justify-center gap-2 py-2 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all ${isFullscreenRequested ? 'bg-white/5 text-white/20' : 'bg-white text-black hover:bg-gold hover:text-black'}`}
                      >
                        <Maximize size={12} />
                        {isFullscreenRequested ? 'Fullscreen OK' : 'Solicitar Fullscreen'}
                      </button>
                    </div>

                    <button 
                      onClick={() => {
                        if (!targetUid) return;
                        setDoc(doc(db, 'displays', targetUid), { refreshRequestedAt: Date.now() }, { merge: true });
                        toast("Reinicio remoto enviado", "success");
                      }}
                      className="w-full flex items-center justify-center gap-2 py-2 text-[10px] font-bold uppercase tracking-widest rounded-lg bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500 hover:text-white transition-all"
                    >
                      <RefreshCw size={12} />
                      Forzar Reinicio Remoto
                    </button>
                  </div>
                </div>

                <div className="flex flex-col gap-2 rounded-xl border border-white/10 bg-black p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="text-xs font-bold uppercase tracking-widest text-white/80">Rendimiento</span>
                      <span className="text-[8px] uppercase tracking-widest text-white/40">Optimización para Smart TVs</span>
                    </div>
                    <div className="flex gap-1 bg-white/5 p-1 rounded-lg">
                      <button 
                        onClick={() => setPerformanceMode('high')}
                        className={`px-3 py-1 text-[8px] font-bold uppercase tracking-widest rounded-md transition-all ${performanceMode === 'high' ? 'bg-white text-black' : 'text-white/40 hover:text-white'}`}
                      >
                        Aura Premium
                      </button>
                      <button 
                        onClick={() => setPerformanceMode('eco')}
                        className={`px-3 py-1 text-[8px] font-bold uppercase tracking-widest rounded-md transition-all ${performanceMode === 'eco' ? 'bg-green-500 text-white' : 'text-white/40 hover:text-white'}`}
                      >
                        Modo ECO
                      </button>
                    </div>
                  </div>
                  <p className="text-[9px] leading-relaxed text-white/30 uppercase tracking-tight">
                    {performanceMode === 'eco' 
                      ? "MODO ECO ACTIVO: Se han desactivado movimientos Ken Burns y desplazamientos continuos para reducir el consumo drásticamente."
                      : "AURA PREMIUM: Experiencia visual completa con transiciones cinematográficas y movimientos suaves."}
                  </p>
                </div>

                <div className="flex items-center justify-between rounded-xl border border-white/10 bg-black px-4 py-3">
                  <div className="flex flex-col">
                    <span className="text-xs font-bold uppercase tracking-widest text-white/80">Mostrar Ticker</span>
                    <span className="text-[8px] uppercase tracking-widest text-white/40">Barra de texto inferior</span>
                  </div>
                  <button 
                    onClick={() => setShowTicker(!showTicker)}
                    className={`h-6 w-12 rounded-full transition-colors ${showTicker ? 'bg-green-500' : 'bg-white/10'}`}
                  >
                    <div className={`h-4 w-4 rounded-full bg-white transition-transform ${showTicker ? 'translate-x-7' : 'translate-x-1'}`} />
                  </button>
                </div>

                {/* Aura Agent Settings */}
                <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="text-xs font-bold uppercase tracking-widest text-white/80">Aura Digital Pass</span>
                      <span className="text-[8px] uppercase tracking-widest text-white/40">Chat inteligente de ventas</span>
                    </div>
                    <button 
                      onClick={() => setAuraAgentEnabled(!auraAgentEnabled)}
                      className={`h-6 w-12 rounded-full transition-colors ${auraAgentEnabled ? 'bg-green-500' : 'bg-white/10'}`}
                    >
                      <div className={`h-4 w-4 rounded-full bg-white transition-transform ${auraAgentEnabled ? 'translate-x-7' : 'translate-x-1'}`} />
                    </button>
                  </div>
                  
                  {auraAgentEnabled && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="space-y-2 pt-2 border-t border-white/10"
                    >
                      <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">WhatsApp del Comercial (sin +)</label>
                      <input 
                        type="text" 
                        value={auraAgentWhatsApp}
                        onChange={(e) => setAuraAgentWhatsApp(e.target.value)}
                        className="w-full rounded-lg border border-white/10 bg-black px-3 py-2 text-sm focus:border-white/20 focus:outline-none"
                        placeholder="34600000000"
                      />
                      <p className="text-[8px] text-white/20 uppercase">Ejemplo: 34664246898</p>
                    </motion.div>
                  )}
                </div>

                <button 
                  onClick={handleUpdateConfig}
                  className="w-full rounded-xl bg-white py-3 text-[10px] font-bold uppercase tracking-widest text-black transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                  Guardar Configuración
                </button>
              </div>
            </div>

                <div className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-8 backdrop-blur-sm relative overflow-hidden group/qr">
                  <div className="absolute top-0 left-0 w-1.5 h-full bg-white/20" />
                  <h3 className="mb-6 text-[10px] font-bold uppercase tracking-[0.3em] text-white/40">
                    {targetUserProfile?.role === 'sales' ? 'Tu Hub de Ventas' : 'Acceso Público'}
                  </h3>
              <div className="space-y-4">
                <div className="flex flex-col items-center justify-center space-y-4 rounded-2xl border border-white/10 bg-black p-4" ref={qrRef}>
                  <QRCodeCanvas 
                    value={displayUrl} 
                    size={160} 
                    level="H" 
                    includeMargin={true}
                    className="rounded-xl"
                  />
                  <p className="text-[10px] text-white/50 text-center">Escanea para abrir en cualquier dispositivo</p>
                  <div className="flex items-center gap-2 w-full">
                    <button 
                      onClick={handleDownloadQR}
                      className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-white/5 py-2 text-[10px] uppercase font-bold tracking-widest hover:bg-white hover:text-black transition-all"
                    >
                      <Download size={12} /> Descargar
                    </button>
                    <button 
                      onClick={handleShareQR}
                      className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-green-500/10 py-2 text-[10px] uppercase font-bold tracking-widest text-green-500 hover:bg-green-500 hover:text-white transition-all"
                    >
                      <Share2 size={12} /> Compartir
                    </button>
                  </div>
                </div>
                <div className="group relative rounded-2xl border border-white/10 bg-black p-4 transition-colors hover:border-white/20">
                  <p className="break-all text-xs font-mono text-white/60">{displayUrl}</p>
                  <div className="mt-4 flex items-center gap-2">
                    <button 
                      onClick={copyUrl}
                      className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-white/5 py-2.5 text-[10px] font-bold uppercase tracking-widest transition-all hover:bg-white/10"
                    >
                      {copied ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
                      {copied ? 'Copiado' : 'Copiar URL'}
                    </button>
                    <a 
                      href={displayUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 transition-all hover:bg-white/10"
                    >
                      <ExternalLink size={14} />
                    </a>
                  </div>
                </div>
                <div className="rounded-2xl bg-white/5 p-4 text-[10px] leading-relaxed text-white/40">
                  <p>Copia esta URL y ábrela en el navegador de tu Smart TV o pantalla profesional para empezar la rotación.</p>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-white/5 bg-white/[0.03] p-8">
              <h3 className="mb-4 text-sm font-bold uppercase tracking-[0.2em] text-white/40">Documentación Aura Business</h3>
              <button 
                onClick={downloadSalesKit}
                className="flex w-full items-center justify-center gap-3 rounded-2xl border border-white/10 bg-white/5 py-4 text-[10px] font-bold uppercase tracking-[0.2em] transition-all hover:bg-white hover:text-black group"
              >
                <Download size={16} className="text-white/40 group-hover:text-black/40" />
                Descargar Dossier de Rentabilidad y Prestaciones (PDF)
                <Download size={14} className="ml-auto text-white/20 group-hover:text-black/20" />
              </button>
              <p className="mt-4 text-[9px] leading-relaxed text-white/30 uppercase tracking-widest">
                Documento oficial con las características técnicas y posibilidades del ecosistema.
              </p>
            </div>

            <div className="rounded-3xl border border-white/5 bg-white/[0.03] p-8">
              <h3 className="mb-4 text-sm font-bold uppercase tracking-[0.2em] text-white/40">Estado del Sistema</h3>
              <div className="flex items-center gap-3">
                <div className="h-2 w-2 animate-pulse rounded-full bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]" />
                <span className="text-[10px] font-medium tracking-widest uppercase text-white/60">Sincronizado en Tiempo Real</span>
              </div>
            </div>
          </div>
        </div>
      </main>

      <AnimatePresence>
        {editingSchedule && (
          <ScheduleModal 
            item={
              editingSchedule.type === 'content' ? contents[editingSchedule.index] : 
              editingSchedule.type === 'quote' ? quotes[editingSchedule.index] :
              tickers[editingSchedule.index]
            }
            onSave={handleUpdateSchedule}
            onClose={() => setEditingSchedule(null)}
          />
        )}
      </AnimatePresence>
      <AuraAgent mode="tutor" />
    </div>
  );
}
