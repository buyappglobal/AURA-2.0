import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { auth, handleFirestoreError, OperationType } from '../firebase';
import { signInWithEmailAndPassword, onAuthStateChanged, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { LogIn, Loader2, ShieldCheck, ArrowRight, Chrome, Eye, EyeOff, User, Building, Mail, Phone } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');
  const [isUnauthorized, setIsUnauthorized] = useState(false);
  const [showResetForm, setShowResetForm] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetEstablishment, setResetEstablishment] = useState('');
  const [resetPhone, setResetPhone] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const navigate = useNavigate();

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetLoading(true);
    setError('');
    
    try {
      const { db } = await import('../firebase');
      await addDoc(collection(db, 'passwordResetRequests'), {
        email: resetEmail,
        establishment: resetEstablishment,
        phone: resetPhone,
        createdAt: serverTimestamp(),
        status: 'pending'
      });
      setResetSuccess(true);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'passwordResetRequests');
      setError('Error al enviar la solicitud. Inténtalo de nuevo.');
    } finally {
      setResetLoading(false);
    }
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setLoading(true);
        try {
          const isSuperAdmin = user.email === 'holasolonet@gmail.com';
          
          // Si es SuperAdmin, aseguramos que tenga documento con rol admin
          if (isSuperAdmin) {
            const { getDoc, setDoc, doc, serverTimestamp } = await import('firebase/firestore');
            const { db } = await import('../firebase');
            const superAdminDoc = await getDoc(doc(db, 'users', user.uid));
            if (!superAdminDoc.exists()) {
              await setDoc(doc(db, 'users', user.uid), {
                email: user.email,
                role: 'admin',
                createdAt: serverTimestamp(),
                uid: user.uid
              });
            }
            navigate('/admin');
            return;
          }

          // Para el resto de usuarios, lógica normal
          const { getDoc, doc } = await import('firebase/firestore');
          const { db } = await import('../firebase');
          let userDoc = await getDoc(doc(db, 'users', user.uid));
          
          let authorized = userDoc.exists();
          
          // Si no existe por UID y no es SuperAdmin, buscar por email
          if (!authorized && user.email) {
            const { query, collection, where, getDocs } = await import('firebase/firestore');
            const q = query(collection(db, 'users'), where('email', '==', user.email));
            
            let querySnapshot;
            try {
              querySnapshot = await getDocs(q);
            } catch (err) {
              handleFirestoreError(err, OperationType.GET, 'users');
              throw err;
            }
            
            authorized = !querySnapshot.empty;
            
            // Si lo encontramos por email pero no por UID, vinculamos el UID para futuras entradas rápidas
            if (authorized) {
              const { setDoc } = await import('firebase/firestore');
              const existingDoc = querySnapshot.docs[0];
              try {
                await setDoc(doc(db, 'users', user.uid), {
                  ...existingDoc.data(),
                  uid: user.uid // Aseguramos que el UID esté guardado
                }, { merge: true });
              } catch (err) {
                handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}`);
              }
            }
          }
          
          if (authorized) {
            navigate('/admin');
          } else {
            // Si no está autorizado, cerrar sesión y mostrar error
            await auth.signOut();
            setIsUnauthorized(true);
            setError('Tu cuenta no está autorizada. Contacta con el administrador.');
          }
        } catch (err) {
          console.error("Error verificando autorización:", err);
          setError('Error al verificar autorización.');
        } finally {
          setLoading(false);
        }
      }
    });
    return () => unsub();
  }, [navigate]);

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    setError('');
    setIsUnauthorized(false);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      
      // Verificar autorización inmediatamente después del login con Google
      const { getDoc, doc } = await import('firebase/firestore');
      const { db } = await import('../firebase');
      let userDoc;
      try {
        userDoc = await getDoc(doc(db, 'users', result.user.uid));
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, `users/${result.user.uid}`);
        throw err;
      }
      
      const isSuperAdmin = result.user.email === 'holasolonet@gmail.com';
      let authorized = userDoc.exists() || isSuperAdmin;
      
      if (isSuperAdmin && !userDoc.exists()) {
        const { setDoc, serverTimestamp } = await import('firebase/firestore');
        try {
          await setDoc(doc(db, 'users', result.user.uid), {
            email: result.user.email,
            role: 'admin',
            createdAt: serverTimestamp()
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, `users/${result.user.uid}`);
        }
      }
      
      if (!authorized && result.user.email) {
        const { query, collection, where, getDocs, setDoc } = await import('firebase/firestore');
        const q = query(collection(db, 'users'), where('email', '==', result.user.email));
        
        let querySnapshot;
        try {
          querySnapshot = await getDocs(q);
        } catch (err) {
          handleFirestoreError(err, OperationType.GET, 'users');
          throw err;
        }
        
        authorized = !querySnapshot.empty;
        
        if (authorized) {
          const existingDoc = querySnapshot.docs[0];
          try {
            await setDoc(doc(db, 'users', result.user.uid), {
              ...existingDoc.data(),
              uid: result.user.uid
            }, { merge: true });
          } catch (err) {
            handleFirestoreError(err, OperationType.WRITE, `users/${result.user.uid}`);
          }
        }
      }
      
      if (authorized) {
        navigate('/admin');
      } else {
        await auth.signOut();
        setIsUnauthorized(true);
        setError('Tu cuenta de Google no está autorizada en este sistema.');
      }
    } catch (err: any) {
      console.error("Google Auth error:", err);
      setError('Error al acceder con Google.');
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setIsUnauthorized(false);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigate('/admin');
    } catch (err: any) {
      console.error("Auth error:", err);
      if (err.code === 'auth/email-already-in-use') {
        setError('Este email ya está registrado.');
      } else if (err.code === 'auth/weak-password') {
        setError('La contraseña debe tener al menos 6 caracteres.');
      } else {
        setError('Error de autenticación. Verifica tus datos.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen w-screen items-center justify-center bg-[#0a0a0a] p-6 text-white selection:bg-white/10">
      <div className="relative w-full max-w-md">
        {/* Glow effect */}
        <div className="absolute -inset-1 rounded-3xl bg-gradient-to-r from-white/10 to-white/5 opacity-50 blur-xl" />
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative rounded-3xl border border-white/10 bg-black p-10 shadow-2xl"
        >
          <div className="mb-10 flex flex-col items-center text-center">
            <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/5 ring-1 ring-white/10">
              <ShieldCheck className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {showResetForm ? 'Recuperar Acceso' : 'Aura Business Admin'}
            </h1>
            <p className="mt-2 text-sm text-white/40">
              {showResetForm ? 'Solicita acceso vía soporte' : 'Acceso exclusivo para clientes autorizados.'}
            </p>
          </div>

          {!showResetForm ? (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Email de Cliente</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm transition-all focus:border-white/20 focus:bg-white/10 focus:outline-none"
                  placeholder="cliente@aurabusiness.com"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Contraseña</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm transition-all focus:border-white/20 focus:bg-white/10 focus:outline-none pr-12"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {error && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-4"
                >
                  <p className="text-[10px] font-medium text-red-400 text-center">
                    {error}
                  </p>
                  
                  {isUnauthorized && (
                    <div className="flex flex-col gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => window.location.href = 'https://wa.me/34648512127'}
                        className="flex w-full items-center justify-center gap-2 rounded-xl bg-green-500/10 py-3 text-[10px] font-bold uppercase tracking-widest text-green-400 ring-1 ring-green-500/20 transition-all hover:bg-green-500/20"
                      >
                        Contratar Aura Business (WhatsApp)
                      </button>
                    </div>
                  )}
                </motion.div>
              )}

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => {setShowResetForm(true); setError('');}}
                  className="text-[10px] font-bold uppercase tracking-widest text-white/40 hover:text-white transition-colors"
                >
                  ¿Has olvidado tu contraseña?
                </button>
              </div>

              <button
                type="submit"
                disabled={loading || googleLoading}
                className="group flex w-full items-center justify-center gap-2 rounded-xl bg-white py-4 text-sm font-bold text-black transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <LogIn size={18} />
                )}
                Acceder al Panel
                <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
              </button>

              <div className="relative py-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-white/10"></div>
                </div>
                <div className="relative flex justify-center text-[10px] uppercase tracking-widest">
                  <span className="bg-black px-4 text-white/20">O accede con</span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={loading || googleLoading}
                className="flex w-full items-center justify-center gap-3 rounded-xl border border-white/10 bg-white/5 py-4 text-sm font-medium text-white transition-all hover:bg-white/10 active:scale-[0.98] disabled:opacity-50"
              >
                {googleLoading ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <Chrome size={18} />
                )}
                Google Account
              </button>
            </form>
          ) : (
            <form onSubmit={handlePasswordReset} className="space-y-6">
              {resetSuccess ? (
                <div className="space-y-4 py-8 text-center">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-500/10 text-green-400">
                    <ShieldCheck size={32} />
                  </div>
                  <h3 className="text-lg font-medium text-white">Solicitud enviada</h3>
                  <p className="text-sm text-white/60">El equipo de soporte procesará tu solicitud y contactará contigo vía WhatsApp en breve.</p>
                  <button
                    type="button"
                    onClick={() => {setShowResetForm(false); setResetSuccess(false);}}
                    className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-white/5 py-4 text-sm font-bold text-white transition-all hover:bg-white/10"
                  >
                    Volver al Login
                  </button>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Email de acceso</label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/20" />
                      <input
                        type="email"
                        required
                        value={resetEmail}
                        onChange={(e) => setResetEmail(e.target.value)}
                        className="w-full rounded-xl border border-white/10 bg-white/5 pl-12 pr-4 py-3 text-sm transition-all focus:border-white/20 focus:bg-white/10 focus:outline-none"
                        placeholder="tu@email.com"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Teléfono WhatsApp</label>
                    <div className="relative">
                      <Phone className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/20" />
                      <input
                        type="tel"
                        required
                        value={resetPhone}
                        onChange={(e) => setResetPhone(e.target.value)}
                        className="w-full rounded-xl border border-white/10 bg-white/5 pl-12 pr-4 py-3 text-sm transition-all focus:border-white/20 focus:bg-white/10 focus:outline-none"
                        placeholder="+34 600 000 000"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Nombre del establecimiento</label>
                    <div className="relative">
                      <Building className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/20" />
                      <input
                        type="text"
                        required
                        value={resetEstablishment}
                        onChange={(e) => setResetEstablishment(e.target.value)}
                        className="w-full rounded-xl border border-white/10 bg-white/5 pl-12 pr-4 py-3 text-sm transition-all focus:border-white/20 focus:bg-white/10 focus:outline-none"
                        placeholder="Nombre de tu negocio"
                      />
                    </div>
                  </div>

                  {error && (
                    <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-[10px] font-medium text-red-400 text-center">
                      {error}
                    </motion.p>
                  )}

                  <button
                    type="submit"
                    disabled={resetLoading}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-white py-4 text-sm font-bold text-black transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
                  >
                    {resetLoading ? (
                      <Loader2 size={18} className="animate-spin" />
                    ) : (
                      'Enviar solicitud de recuperación'
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowResetForm(false)}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-white/5 py-4 text-sm font-bold text-white transition-all hover:bg-white/10"
                  >
                    Volver
                  </button>
                </>
              )}
            </form>
          )}

          <div className="mt-8 flex flex-col items-center gap-4">
            <div className="text-center">
              <p className="text-[10px] text-white/20 uppercase tracking-widest">Aura Business Platform &copy; 2026</p>
              <p className="mt-2 text-[8px] text-white/10 uppercase tracking-tight">Si no tienes credenciales, contacta con soporte.</p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
