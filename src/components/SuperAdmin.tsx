import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, setDoc, serverTimestamp, collection, getDocs, updateDoc, query, orderBy, getDoc } from 'firebase/firestore';
import { ShieldCheck, UserPlus, Loader2, ArrowLeft, CheckCircle2, AlertCircle, Mail, Lock, Users, ExternalLink, Settings2, Trash2, History, Search, Filter, Activity, Zap, TrendingUp, Monitor } from 'lucide-react';
import firebaseConfig from '../../firebase-applet-config.json';
import { sendWelcomeEmail } from '../services/emailService';

const SUPER_ADMIN_EMAIL = 'holasolonet@gmail.com';

export default function SuperAdmin() {
  const [currentUserProfile, setCurrentUserProfile] = useState<any>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'client' | 'sales' | 'admin'>('client');
  const [hasAdsPanel, setHasAdsPanel] = useState(false);
  const [hasImpulses, setHasImpulses] = useState(false);
  const [isDemoAccount, setIsDemoAccount] = useState(false);
  const [slug, setSlug] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [city, setCity] = useState('');
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [status, setStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState<'all' | 'admin' | 'sales' | 'client'>('all');
  const [filterCity, setFilterCity] = useState('all');
  const navigate = useNavigate();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setIsAuthorized(false);
        setTimeout(() => navigate('/admin/login'), 2000);
        return;
      }

      const isSuperAdmin = user.email === SUPER_ADMIN_EMAIL;
      if (isSuperAdmin) {
        setIsAuthorized(true);
        setCurrentUserProfile({ role: 'admin', email: user.email });
        fetchUsers();
        return;
      }

      // Check role in Firestore
      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          setCurrentUserProfile(userData);
          if (userData.role === 'admin' || userData.role === 'sales') {
            setIsAuthorized(true);
            fetchUsers();
          } else {
            setIsAuthorized(false);
            setTimeout(() => navigate('/admin'), 2000);
          }
        } else {
          setIsAuthorized(false);
          setTimeout(() => navigate('/admin/login'), 2000);
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, `users/${user.uid}`);
      }
    });
    return () => unsub();
  }, [navigate]);

  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      // Fetch Users
      const usersSnap = await getDocs(collection(db, 'users'));
      const usersData = usersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // Fetch Displays (for activity and impulses)
      const displaysSnap = await getDocs(collection(db, 'displays'));
      const displaysData = displaysSnap.docs.reduce((acc: any, doc) => {
        acc[doc.id] = doc.data();
        return acc;
      }, {});
      
      // Merge data
      const merged = usersData.map((user: any) => ({
        ...user,
        displayMetrics: displaysData[user.id] || {}
      }));

      // Sort manually
      merged.sort((a: any, b: any) => {
        const dateA = a.createdAt?.seconds || 0;
        const dateB = b.createdAt?.seconds || 0;
        return dateB - dateA;
      });

      setUsers(merged);
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, 'users/displays');
    } finally {
      setLoadingUsers(false);
    }
  };

  const filteredUsers = React.useMemo(() => {
    return users.filter(u => {
      const emailMatch = u.email?.toLowerCase().includes(searchTerm.toLowerCase());
      const slugMatch = u.slug?.toLowerCase().includes(searchTerm.toLowerCase());
      const cityMatchSearch = u.city?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesSearch = emailMatch || slugMatch || cityMatchSearch;
      
      const matchesRole = filterRole === 'all' || u.role === filterRole;
      const matchesCity = filterCity === 'all' || u.city === filterCity;
      
      return matchesSearch && matchesRole && matchesCity;
    });
  }, [users, searchTerm, filterRole, filterCity]);

  const cities = React.useMemo(() => {
    const list = users.map(u => u.city).filter(Boolean);
    const unique = Array.from(new Set(list)).sort() as string[];
    return unique;
  }, [users]);

  const kpis = React.useMemo(() => {
    const now = Date.now();
    const onlineThreshold = 3 * 60 * 1000; // 3 minutes

    const online = users.filter(u => {
      const lastSeen = u.displayMetrics?.lastSeen?.toMillis?.() || 
                       (u.displayMetrics?.lastSeen?.seconds ? u.displayMetrics.lastSeen.seconds * 1000 : null);
      return lastSeen && (now - lastSeen < onlineThreshold);
    }).length;

    const totalImpulses = users.reduce((acc, u) => acc + (u.displayMetrics?.totalImpulses || 0), 0);

    return {
      total: users.length,
      online,
      impulses: totalImpulses
    };
  }, [users]);

  const getRelativeTime = (timestamp: any) => {
    if (!timestamp) return 'Nunca';
    const date = timestamp.toMillis?.() || (timestamp.seconds ? timestamp.seconds * 1000 : timestamp);
    const now = Date.now();
    const diff = now - date;

    if (diff < 60000) return 'Hace un momento';
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `Hace ${mins} min`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `Hace ${hours} h`;
    return new Date(date).toLocaleDateString();
  };

  const isOnline = (timestamp: any) => {
    if (!timestamp) return false;
    const date = timestamp.toMillis?.() || (timestamp.seconds ? timestamp.seconds * 1000 : timestamp);
    return (Date.now() - date) < (3 * 60 * 1000);
  };

  const handleUpdatePermission = async (userId: string, field: string, value: any) => {
    const docPath = `users/${userId}`;
    try {
      await updateDoc(doc(db, 'users', userId), {
        [field]: value
      });
      setUsers(users.map(u => u.id === userId ? { ...u, [field]: value } : u));
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, docPath);
      alert("Error al actualizar permisos.");
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!window.confirm("¿Estás seguro de que quieres eliminar este usuario?")) return;
    const docPath = `users/${userId}`;
    try {
      await updateDoc(doc(db, 'users', userId), {
        email: `deleted_${Date.now()}_${userId}@deleted.com`,
        deleted: true
      });
      setUsers(users.filter(u => u.id !== userId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, docPath);
      alert("Error al eliminar usuario.");
    }
  };

  const handleCreateJamonDemo = async () => {
    if (!window.confirm("¿Crear cuenta demo para Supermercados El Jamón?")) return;
    setLoading(true);
    setStatus(null);

    const jamonEmail = 'eljamon@auradisplay.es';
    const jamonPass = 'jamon2024';
    
    let secondaryApp;
    try {
      secondaryApp = initializeApp(firebaseConfig, 'SecondaryAppJamon');
      const secondaryAuth = getAuth(secondaryApp);

      let uid = "";
      try {
        const userCredential = await createUserWithEmailAndPassword(secondaryAuth, jamonEmail, jamonPass);
        uid = userCredential.user.uid;
      } catch (authErr: any) {
        if (authErr.code === 'auth/email-already-in-use') {
          // If user exists, we need to find their UID. 
          // Since we can't easily get UID from email in client SDK without being admin, 
          // we'll assume the user exists in our 'users' collection and we can find them there or just use a query.
          const usersRef = collection(db, 'users');
          const q = query(usersRef, orderBy('createdAt', 'desc'));
          const querySnapshot = await getDocs(usersRef);
          const existingUser = querySnapshot.docs.find(doc => doc.data().email === jamonEmail);
          if (existingUser) {
            uid = existingUser.id;
          } else {
            throw new Error("El usuario ya existe en Auth pero no se encontró en Firestore.");
          }
        } else {
          throw authErr;
        }
      }

      const jamonQuotes = [
        { 
          category: "CHARCUTERÍA ARTESANA", 
          text: "EL SABOR DE LA SIERRA", 
          price: "JABUGO SELECCIÓN", 
          tag: "CORTE TRADICIONAL",
          ticker: "DISFRUTA DEL AUTÉNTICO JAMÓN DE HUELVA • SELECCIONAMOS CADA PIEZA EN LA SIERRA PARA TU MESA • EL JAMÓN: TRADICIÓN IBÉRICA",
          imageUrl: "https://images.unsplash.com/photo-1593504049359-74330189a345?auto=format&fit=crop&q=80&w=1920"
        },
        { 
          category: "FRUTERÍA DE CALIDAD", 
          text: "ORO DE NUESTRA TIERRA", 
          price: "FRESCURA KM 0", 
          tag: "HUERTA ONUBENSE",
          ticker: "FRUTAS Y VERDURAS SELECCIONADAS DIARIAMENTE EN NUESTROS CAMPOS • MÁXIMA CALIDAD Y VITAMINAS PARA TU FAMILIA • EL JAMÓN CON EL AGRICULTOR LOCAL",
          imageUrl: "https://images.unsplash.com/photo-1610348725531-843dff563e2c?auto=format&fit=crop&q=80&w=1920"
        },
        { 
          category: "PESCADERÍA DE LONJA", 
          text: "DIRECTO DE NUESTRAS COSTAS", 
          price: "CALIDAD MARINA", 
          tag: "PUERTO DE HUELVA",
          ticker: "RECIBIMOS CADA MAÑANA LO MEJOR DE NUESTROS PUERTOS • DEL MAR A TU CESTA EN TIEMPO RÉCORD • DISFRUTA DEL SABOR AUTÉNTICO DE HUELVA",
          imageUrl: "https://images.unsplash.com/photo-1534043464124-3be32fe000c9?auto=format&fit=crop&q=80&w=1920"
        },
        { 
          category: "AURA × EL JAMÓN", 
          text: "EL FUTURO DEL RETAIL", 
          price: "SISTEMA INTELIGENTE", 
          tag: "DEMO EXCLUSIVA",
          ticker: "ESTÁS ESCUCHANDO AURA BUSINESS: LA BANDA SONORA DISEÑADA PARA OPTIMIZAR TU EXPERIENCIA EN SUPERMERCADOS EL JAMÓN • TECNOLOGÍA AL SERVICIO DEL CLIENTE",
          imageUrl: "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=1920"
        }
      ];

      await setDoc(doc(db, 'displays', uid), {
        contents: [],
        quotes: jamonQuotes,
        tickers: ["BIENVENIDOS A SUPERMERCADOS EL JAMÓN • CALIDAD Y TRADICIÓN EN CADA PASILLO", "DISFRUTA DE TU COMPRA CON LA MEJOR MÚSICA DE AURA BUSINESS"],
        establishmentName: 'Supermercados El Jamón',
        location: 'Huelva, ES',
        theme: 'classic',
        createdAt: serverTimestamp()
      }, { merge: true });

      await setDoc(doc(db, 'users', uid), {
        email: jamonEmail,
        role: 'client',
        hasAdsPanel: true,
        hasImpulses: true,
        isDemoAccount: true,
        slug: 'el-jamon-demo',
        city: 'Huelva',
        createdAt: serverTimestamp()
      }, { merge: true });

      if (secondaryApp) {
        await signOut(secondaryAuth);
        await deleteApp(secondaryApp);
      }
      
      setStatus({ type: 'success', message: "Demo de 'El Jamón' actualizada con éxito." });
      fetchUsers();
    } catch (err: any) {
      console.error(err);
      setStatus({ type: 'error', message: err.message || "Error al crear la demo." });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setStatus(null);

    let secondaryApp;
    try {
      // 1. Create a secondary Firebase app to avoid logging out the current admin
      secondaryApp = initializeApp(firebaseConfig, 'SecondaryApp');
      const secondaryAuth = getAuth(secondaryApp);

      // 2. Create the user in Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
      const newUser = userCredential.user;

      // 3. Initialize their Firestore document
      await setDoc(doc(db, 'displays', newUser.uid), {
        contents: [],
        quotes: [],
        tickers: [],
        establishmentName: 'Aura Business',
        location: 'Huelva, ES',
        theme: 'classic',
        createdAt: serverTimestamp()
      });

      // 4. Initialize their user profile
      await setDoc(doc(db, 'users', newUser.uid), {
        email: newUser.email,
        role: role,
        hasAdsPanel: hasAdsPanel,
        hasImpulses: hasImpulses,
        isDemoAccount: isDemoAccount,
        slug: slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, ''),
        whatsapp: whatsapp.trim().replace(/[^0-9+]/g, ''),
        city: city.trim(),
        createdAt: serverTimestamp()
      });

      // 4. Sign out from the secondary app and cleanup
      await signOut(secondaryAuth);
      await deleteApp(secondaryApp);

      // 5. Send welcome email via Resend
      const emailResult = await sendWelcomeEmail(email, password);
      
      if (emailResult.success) {
        setStatus({ type: 'success', message: `Usuario ${email} creado y email enviado correctamente.` });
      } else {
        setStatus({ type: 'success', message: `Usuario ${email} creado, pero hubo un error al enviar el email.` });
      }
      
      setEmail('');
      setPassword('');
      setRole('client');
      setHasAdsPanel(false);
      setHasImpulses(false);
      setIsDemoAccount(false);
      setSlug('');
      setWhatsapp('');
      setCity('');
      fetchUsers();
    } catch (err: any) {
      console.error("Error creating user:", err);
      if (secondaryApp) await deleteApp(secondaryApp);
      
      let msg = `Error: ${err.message || 'Error desconocido'}`;
      if (err.code) msg = `Error (${err.code}): ${err.message}`;
      if (err.code === 'auth/email-already-in-use') msg = 'Este email ya está registrado.';
      if (err.code === 'auth/weak-password') msg = 'La contraseña es demasiado débil (mínimo 6 caracteres).';
      if (err.code === 'auth/operation-not-allowed') msg = 'El registro con email/contraseña no está habilitado en Firebase.';
      
      setStatus({ type: 'error', message: msg });
    } finally {
      setLoading(false);
    }
  };

  if (isAuthorized === null) return null;

  if (isAuthorized === false) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-black text-white">
        <div className="text-center">
          <AlertCircle className="mx-auto mb-4 h-12 w-12 text-red-500" />
          <h1 className="text-xl font-bold uppercase tracking-widest">Acceso Denegado</h1>
          <p className="mt-2 text-sm text-white/40">Redirigiendo...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-screen bg-[#0a0a0a] p-6 text-white selection:bg-white/10">
      <div className="mx-auto w-full max-w-6xl grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        
        {/* Left: Create User Form */}
        {currentUserProfile?.role === 'admin' && (
          <div className="relative">
            <div className="absolute -inset-1 rounded-3xl bg-gradient-to-r from-white/10 to-white/5 opacity-50 blur-xl" />
            
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="relative rounded-3xl border border-white/10 bg-black p-10 shadow-2xl"
            >
              <button 
                onClick={() => navigate('/admin')}
                className="mb-8 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-white/40 transition-colors hover:text-white"
              >
                <ArrowLeft size={12} /> Volver al Panel
              </button>

              <div className="mb-10 flex flex-col items-center text-center">
                <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/5 ring-1 ring-white/10">
                  <ShieldCheck className="h-8 w-8 text-white" />
                </div>
                <h1 className="text-2xl font-semibold tracking-tight">Super Admin Aura Business</h1>
                <p className="mt-2 text-sm text-white/40">Creación de nuevos usuarios y gestión de permisos.</p>
              </div>

              <div className="mt-8 space-y-4">
                <div className="flex items-center gap-2 px-2">
                  <Zap className="text-yellow-500" size={14} />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-white/50">Demos de Éxito Rápidas</span>
                </div>
                <div className="grid grid-cols-1 gap-3">
                  <button
                    type="button"
                    onClick={handleCreateJamonDemo}
                    disabled={loading}
                    className="group relative overflow-hidden rounded-2xl border border-yellow-500/20 bg-yellow-500/5 p-4 text-left transition-all hover:bg-yellow-500/10 hover:border-yellow-500/40"
                  >
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-yellow-400">Supermercados El Jamón</span>
                        </div>
                        <p className="max-w-[180px] text-[10px] text-white/40">Crea el perfil con slides de frescos, jamonería y mensajes personalizados.</p>
                      </div>
                      <ExternalLink size={14} className="text-yellow-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </button>
                </div>
              </div>

              <div className="my-8 flex items-center gap-4 px-2">
                <div className="h-px flex-1 bg-white/5" />
                <span className="text-[8px] font-bold uppercase tracking-widest text-white/20">O registro manual</span>
                <div className="h-px flex-1 bg-white/5" />
              </div>

              <form onSubmit={handleCreateUser} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Email del Usuario</label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" size={16} />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-white/5 pl-12 pr-4 py-3 text-sm transition-all focus:border-white/20 focus:bg-white/10 focus:outline-none"
                      placeholder="usuario@aurabusiness.com"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Contraseña Temporal</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" size={16} />
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-white/5 pl-12 pr-4 py-3 text-sm transition-all focus:border-white/20 focus:bg-white/10 focus:outline-none"
                      placeholder="••••••••"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Rol del Usuario</label>
                    <select
                      value={role}
                      onChange={(e) => setRole(e.target.value as any)}
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm focus:border-white/20 focus:outline-none"
                    >
                      <option value="client">Cliente</option>
                      <option value="sales">Comercial</option>
                      <option value="admin">Administrador</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Panel Publicidad</label>
                    <div 
                      onClick={() => setHasAdsPanel(!hasAdsPanel)}
                      className={`flex h-[46px] cursor-pointer items-center justify-between rounded-xl border border-white/10 px-4 transition-all ${hasAdsPanel ? 'bg-white/10' : 'bg-white/5'}`}
                    >
                      <span className="text-xs font-medium">{hasAdsPanel ? 'Activado' : 'Desactivado'}</span>
                      <div className={`h-4 w-4 rounded-full border-2 border-white/20 ${hasAdsPanel ? 'bg-white' : ''}`} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Impulsos Aura</label>
                    <div 
                      onClick={() => setHasImpulses(!hasImpulses)}
                      className={`flex h-[46px] cursor-pointer items-center justify-between rounded-xl border border-white/10 px-4 transition-all ${hasImpulses ? 'bg-yellow-500/20 border-yellow-500/30' : 'bg-white/5'}`}
                    >
                      <span className={`text-xs font-medium ${hasImpulses ? 'text-yellow-400' : ''}`}>{hasImpulses ? 'Activado' : 'Desactivado'}</span>
                      <div className={`h-4 w-4 rounded-full border-2 border-white/20 ${hasImpulses ? 'bg-yellow-500 border-yellow-500' : ''}`} />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Modo Demo / Ventas</label>
                    <div 
                      onClick={() => setIsDemoAccount(!isDemoAccount)}
                      className={`flex h-[46px] cursor-pointer items-center justify-between rounded-xl border border-white/10 px-4 transition-all ${isDemoAccount ? 'bg-purple-500/20 border-purple-500/30' : 'bg-white/5'}`}
                    >
                      <span className={`text-xs font-medium ${isDemoAccount ? 'text-purple-400' : ''}`}>{isDemoAccount ? 'Activado' : 'Desactivado'}</span>
                      <div className={`h-4 w-4 rounded-full border-2 border-white/20 ${isDemoAccount ? 'bg-purple-500 border-purple-500' : ''}`} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">URL Amigable (Slug)</label>
                    <input
                      type="text"
                      value={slug}
                      onChange={(e) => setSlug(e.target.value)}
                      className="w-full h-[46px] rounded-xl border border-white/10 bg-white/5 px-4 text-xs focus:border-white/20 focus:bg-white/10 focus:outline-none"
                      placeholder="ej: sierra-servicios"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Ciudad / Delegación</label>
                    <input
                      type="text"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="w-full h-[46px] rounded-xl border border-white/10 bg-white/5 px-4 text-xs focus:border-white/20 focus:bg-white/10 focus:outline-none"
                      placeholder="ej: Sevilla"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">WhatsApp de Contacto (con prefijo)</label>
                    <input
                      type="text"
                      value={whatsapp}
                      onChange={(e) => setWhatsapp(e.target.value)}
                      className="w-full h-[46px] rounded-xl border border-white/10 bg-white/5 px-4 text-xs focus:border-white/20 focus:bg-white/10 focus:outline-none"
                      placeholder="ej: 34600000000"
                    />
                  </div>
                </div>

                {status && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className={`flex items-center gap-2 rounded-xl p-4 text-[10px] font-bold uppercase tracking-widest ${
                      status.type === 'success' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
                    }`}
                  >
                    {status.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                    {status.message}
                  </motion.div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="group flex w-full items-center justify-center gap-2 rounded-xl bg-white py-4 text-sm font-bold text-black transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
                >
                  {loading ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <UserPlus size={18} />
                  )}
                  Crear Usuario Aura Business
                </button>
              </form>
            </motion.div>
          </div>
        )}

        {/* Right: User List */}
        <div className={`space-y-6 ${currentUserProfile?.role !== 'admin' ? 'lg:col-span-2 max-w-4xl mx-auto w-full' : ''}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Users className="text-white/40" />
              <h2 className="text-xl font-semibold tracking-tight">Usuarios Registrados</h2>
            </div>
            <div className="flex items-center gap-4">
              <button 
                onClick={() => navigate('/admin/changelog')}
                className="group flex items-center gap-2 rounded-full bg-white/5 px-4 py-2 text-xs font-bold uppercase tracking-widest text-white/60 transition-all hover:bg-white/10 hover:text-white"
              >
                <History size={14} />
                Novedades
              </button>
              {currentUserProfile?.role !== 'admin' && (
                <button 
                  onClick={() => navigate('/admin')}
                  className="text-[10px] font-bold uppercase tracking-widest text-white/40 hover:text-white"
                >
                  Volver al Panel
                </button>
              )}
              <button 
                onClick={fetchUsers}
                className="text-[10px] font-bold uppercase tracking-widest text-white/40 hover:text-white"
              >
                Actualizar
              </button>
            </div>
          </div>

          {!loadingUsers && (
            <>
              {/* Dashboard KPIs */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="relative overflow-hidden rounded-2xl border border-white/5 bg-white/[0.02] p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500">
                      <Monitor size={18} />
                    </div>
                    <div>
                      <div className="text-[9px] font-bold uppercase tracking-widest text-white/30">Total Cuentas</div>
                      <div className="text-xl font-bold">{kpis.total}</div>
                    </div>
                  </div>
                  <TrendingUp size={48} className="absolute -bottom-2 -right-2 opacity-5" />
                </div>
                <div className="relative overflow-hidden rounded-2xl border border-white/5 bg-white/[0.02] p-4 shadow-[0_0_20px_rgba(34,197,94,0.05)]">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-green-500/10 text-green-500">
                      <Activity size={18} />
                    </div>
                    <div>
                      <div className="text-[9px] font-bold uppercase tracking-widest text-white/30">Online Ahora</div>
                      <div className="text-xl font-bold">{kpis.online}</div>
                    </div>
                  </div>
                  <Zap size={48} className="absolute -bottom-2 -right-2 opacity-5 text-green-500" />
                </div>
                <div className="relative overflow-hidden rounded-2xl border border-white/5 bg-white/[0.02] p-4 shadow-[0_0_20px_rgba(234,179,8,0.05)]">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-yellow-500/10 text-yellow-500">
                      <Zap size={18} />
                    </div>
                    <div>
                      <div className="text-[9px] font-bold uppercase tracking-widest text-white/30">Impulsos Totales</div>
                      <div className="text-xl font-bold">{kpis.impulses}</div>
                    </div>
                  </div>
                  <TrendingUp size={48} className="absolute -bottom-2 -right-2 opacity-5 text-yellow-500" />
                </div>
              </div>

              {/* Search and Filters */}
              <div className="flex flex-wrap items-center gap-4 bg-white/[0.02] border border-white/5 p-4 rounded-2xl">
                <div className="flex-1 min-w-[200px] relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20" size={12} />
                  <input 
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Buscar por Email, Slug o Ciudad..."
                    className="w-full bg-transparent border-b border-white/5 pl-9 py-2 text-[10px] font-bold uppercase tracking-widest text-white/60 placeholder:text-white/20 focus:outline-none focus:border-white/20"
                  />
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/5">
                    <Filter size={12} className="text-white/20" />
                    <select 
                      value={filterRole}
                      onChange={(e: any) => setFilterRole(e.target.value)}
                      className="bg-transparent text-[9px] font-bold uppercase tracking-widest text-white/60 focus:outline-none cursor-pointer outline-none"
                    >
                      <option value="all" className="bg-[#0a0a0a]">Roles</option>
                      <option value="client" className="bg-[#0a0a0a]">Clientes</option>
                      <option value="sales" className="bg-[#0a0a0a]">Comerciales</option>
                      <option value="admin" className="bg-[#0a0a0a]">Admins</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/5">
                    <Filter size={12} className="text-white/20" />
                    <select 
                      value={filterCity}
                      onChange={(e: any) => setFilterCity(e.target.value)}
                      className="bg-transparent text-[9px] font-bold uppercase tracking-widest text-white/60 focus:outline-none cursor-pointer outline-none"
                    >
                      <option value="all" className="bg-[#0a0a0a]">Todas las Ciudades</option>
                      {cities.map(c => (
                        <option key={c} value={c} className="bg-[#0a0a0a]">{c}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </>
          )}

          <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
            {loadingUsers ? (
              <div className="flex h-40 items-center justify-center rounded-3xl border border-white/5 bg-white/[0.02]">
                <Loader2 className="animate-spin text-white/20" />
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="flex h-40 flex-col items-center justify-center rounded-3xl border border-white/5 bg-white/[0.02]">
                <p className="text-xs text-white/20">No se encontraron usuarios con esos criterios.</p>
              </div>
            ) : (
              filteredUsers.map((u) => (
                <motion.div
                  key={u.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="group relative rounded-2xl border border-white/5 bg-white/[0.02] p-6 transition-all hover:bg-white/[0.05]"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <div className={`h-2.5 w-2.5 rounded-full ${isOnline(u.displayMetrics?.lastSeen) ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]' : 'bg-white/10'}`} />
                          {isOnline(u.displayMetrics?.lastSeen) && (
                            <div className="absolute -inset-1 h-full w-full animate-ping rounded-full bg-green-500/20" />
                          )}
                        </div>
                        <p className="truncate text-sm font-medium text-white/90">{u.email}</p>
                        <span className={`rounded-full px-2 py-0.5 text-[8px] font-black uppercase tracking-widest ${
                          u.role === 'admin' ? 'bg-red-500/20 text-red-400' : 
                          u.role === 'sales' ? 'bg-blue-500/20 text-blue-400' : 
                          'bg-white/10 text-white/40'
                        }`}>
                          {u.role}
                        </span>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-4">
                        <p className="text-[9px] text-white/20 uppercase tracking-widest flex items-center gap-1.5">
                          <Monitor size={10} className="opacity-50" /> ID: {u.id.substring(0, 8)}...
                        </p>
                        <p className={`text-[9px] uppercase tracking-widest flex items-center gap-1.5 ${isOnline(u.displayMetrics?.lastSeen) ? 'text-green-500/60 font-bold' : 'text-white/20'}`}>
                          <Activity size={10} className="opacity-50" /> {getRelativeTime(u.displayMetrics?.lastSeen)}
                        </p>
                        {u.city && (
                          <p className="text-[9px] text-white/40 uppercase tracking-widest flex items-center gap-1.5">
                            <ShieldCheck size={10} className="opacity-50" /> {u.city}
                          </p>
                        )}
                        <p className="text-[9px] text-yellow-500/60 uppercase tracking-widest flex items-center gap-1.5 font-bold">
                          <Zap size={10} className="opacity-50" /> {u.displayMetrics?.totalImpulses || 0} Impulsos
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => window.open(`/admin?uid=${u.id}`, '_blank')}
                        title="Entrar en su Pantalla"
                        className="rounded-lg bg-white/5 p-2 text-white/40 transition-all hover:bg-white hover:text-black"
                      >
                        <ExternalLink size={14} />
                      </button>
                      <button 
                        onClick={() => navigate(`/view?id=${u.id}`)}
                        title="Ver Pantalla Pública"
                        className="rounded-lg bg-white/5 p-2 text-white/40 transition-all hover:bg-white/10 hover:text-white"
                      >
                        <Settings2 size={14} />
                      </button>
                      <button 
                        onClick={() => handleDeleteUser(u.id)}
                        title="Eliminar Usuario"
                        className="rounded-lg bg-white/5 p-2 text-red-500/40 transition-all hover:bg-red-500 hover:text-white"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  {currentUserProfile?.role === 'admin' && (
                    <div className="mt-6 flex flex-wrap items-center gap-x-8 gap-y-4 border-t border-white/5 pt-4">
                      {/* Toggles Group */}
                      <div className="flex items-center gap-6">
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] font-bold uppercase tracking-widest text-white/20">Publicidad:</span>
                          <button 
                            onClick={() => handleUpdatePermission(u.id, 'hasAdsPanel', !u.hasAdsPanel)}
                            className={`h-4 w-8 rounded-full transition-all relative ${u.hasAdsPanel ? 'bg-green-500' : 'bg-white/10'}`}
                          >
                            <div className={`absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all ${u.hasAdsPanel ? 'right-0.5' : 'left-0.5'}`} />
                          </button>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] font-bold uppercase tracking-widest text-white/20">Impulsos:</span>
                          <button 
                            onClick={() => handleUpdatePermission(u.id, 'hasImpulses', !u.hasImpulses)}
                            className={`h-4 w-8 rounded-full transition-all relative ${u.hasImpulses ? 'bg-yellow-500' : 'bg-white/10'}`}
                          >
                            <div className={`absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all ${u.hasImpulses ? 'right-0.5' : 'left-0.5'}`} />
                          </button>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] font-bold uppercase tracking-widest text-white/20">Modo Demo:</span>
                          <button 
                            onClick={() => handleUpdatePermission(u.id, 'isDemoAccount', !u.isDemoAccount)}
                            className={`h-4 w-8 rounded-full transition-all relative ${u.isDemoAccount ? 'bg-purple-500' : 'bg-white/10'}`}
                          >
                            <div className={`absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all ${u.isDemoAccount ? 'right-0.5' : 'left-0.5'}`} />
                          </button>
                        </div>
                      </div>

                      {/* Inputs Group */}
                      <div className="flex flex-wrap items-center gap-6 flex-1">
                        <div className="flex items-center gap-2 flex-1 min-w-[120px]">
                          <span className="text-[9px] font-bold uppercase tracking-widest text-white/20">Slug:</span>
                          <input 
                            type="text"
                            defaultValue={u.slug || ''}
                            onBlur={(e) => {
                              const newSlug = e.target.value.trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
                              if (newSlug !== (u.slug || '')) {
                                handleUpdatePermission(u.id, 'slug', newSlug);
                              }
                            }}
                            className="flex-1 bg-transparent border-b border-white/10 text-[10px] font-bold uppercase tracking-widest text-white/60 focus:outline-none focus:border-white/30 p-1"
                            placeholder="sin-slug"
                          />
                        </div>
                        <div className="flex items-center gap-2 flex-1 min-w-[120px]">
                          <span className="text-[9px] font-bold uppercase tracking-widest text-white/20">WhatsApp:</span>
                          <input 
                            type="text"
                            defaultValue={u.whatsapp || ''}
                            onBlur={(e) => {
                              const newWap = e.target.value.trim().replace(/[^0-9+]/g, '');
                              if (newWap !== (u.whatsapp || '')) {
                                handleUpdatePermission(u.id, 'whatsapp', newWap);
                              }
                            }}
                            className="flex-1 bg-transparent border-b border-white/10 text-[10px] font-bold uppercase tracking-widest text-white/60 focus:outline-none focus:border-white/30 p-1"
                            placeholder="34..."
                          />
                        </div>
                        <div className="flex items-center gap-2 flex-1 min-w-[120px]">
                          <span className="text-[9px] font-bold uppercase tracking-widest text-white/20">Ciudad:</span>
                          <input 
                            type="text"
                            defaultValue={u.city || ''}
                            onBlur={(e) => {
                              const newCity = e.target.value.trim();
                              if (newCity !== (u.city || '')) {
                                handleUpdatePermission(u.id, 'city', newCity);
                              }
                            }}
                            className="flex-1 bg-transparent border-b border-white/10 text-[10px] font-bold uppercase tracking-widest text-white/60 focus:outline-none focus:border-white/30 p-1"
                            placeholder="Sevilla..."
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] font-bold uppercase tracking-widest text-white/20">Rol:</span>
                          <select 
                            value={u.role}
                            onChange={(e) => handleUpdatePermission(u.id, 'role', e.target.value)}
                            className="bg-transparent text-[10px] font-bold uppercase tracking-widest text-white/60 focus:outline-none cursor-pointer"
                          >
                            <option value="client">Cliente</option>
                            <option value="sales">Comercial</option>
                            <option value="admin">Admin</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  )}
                </motion.div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
