import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Loader2, AlertCircle } from 'lucide-react';

export default function HubResolver() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function resolveSlug() {
      if (!slug) return;
      
      try {
        const q = query(
          collection(db, 'users'), 
          where('slug', '==', slug.toLowerCase()),
          limit(1)
        );
        
        const querySnapshot = await getDocs(q).catch(err => {
          handleFirestoreError(err, OperationType.GET, 'users');
          throw err;
        });
        
        if (!querySnapshot.empty) {
          const userDoc = querySnapshot.docs[0];
          const uid = userDoc.id;
          // Redirect to /view with the ID and force the AuraAgent
          navigate(`/view?id=${uid}&auraAgent=true`, { replace: true });
        } else {
          setError('El canal que buscas no existe o ha cambiado de nombre.');
        }
      } catch (err) {
        console.error("Error resolving slug:", err);
        setError('Error al conectar con Aura Business.');
      }
    }

    resolveSlug();
  }, [slug, navigate]);

  if (error) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center bg-[#0a0a0a] text-white p-6">
        <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-red-500/10 ring-1 ring-red-500/20">
          <AlertCircle className="h-8 w-8 text-red-500" />
        </div>
        <h1 className="text-xl font-bold uppercase tracking-widest text-white/90">Canal no encontrado</h1>
        <p className="mt-4 text-center text-sm text-white/40 max-w-md">{error}</p>
        <button 
          onClick={() => navigate('/')}
          className="mt-8 rounded-xl bg-white/5 border border-white/10 px-6 py-3 text-[10px] font-bold uppercase tracking-widest hover:bg-white/10 transition-all"
        >
          Volver al Inicio
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center bg-[#0a0a0a] text-white">
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
        className="mb-6"
      >
        <Loader2 className="h-8 w-8 text-white/20" />
      </motion.div>
      <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/20 animate-pulse">
        Conectando con Aura Hub...
      </p>
    </div>
  );
}

import { motion } from 'motion/react';
