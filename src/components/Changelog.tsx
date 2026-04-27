import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, History, Rocket, Shield, Layout } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Markdown from 'react-markdown';
import changelogRaw from '../../CHANGELOG.md?raw';

export default function Changelog() {
  const navigate = useNavigate();
  const [content, setContent] = useState('');

  useEffect(() => {
    setContent(changelogRaw);
  }, []);

  return (
    <div className="min-h-screen bg-black text-white selection:bg-white/10">
      <div className="mx-auto max-w-4xl px-6 py-20">
        <button 
          onClick={() => navigate('/admin')}
          className="mb-12 flex items-center gap-2 text-white/40 transition-colors hover:text-white"
        >
          <ArrowLeft size={16} />
          <span className="text-[10px] font-bold uppercase tracking-widest">Volver al Panel</span>
        </button>

        <div className="mb-16 space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 ring-1 ring-white/10">
              <History size={20} className="text-white/60" />
            </div>
            <h1 className="text-4xl font-bold tracking-tight">Registro de Cambios</h1>
          </div>
          <p className="text-lg text-white/40 font-light">
            Sigue la evolución de Aura Business y las nuevas funcionalidades integradas.
          </p>
        </div>

        <div className="grid gap-8">
          <div className="prose prose-invert max-w-none">
            <div className="rounded-[2.5rem] border border-white/5 bg-white/[0.02] p-10 backdrop-blur-3xl">
              <div className="markdown-body">
                <Markdown>{content}</Markdown>
              </div>
            </div>
          </div>
        </div>

        {/* Resumen Visual para el Equipo */}
        <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="rounded-3xl border border-white/5 bg-white/[0.02] p-8">
            <Rocket size={24} className="mb-4 text-yellow-400" />
            <h3 className="mb-2 text-sm font-bold uppercase tracking-widest">Nuevas Funciones</h3>
            <p className="text-xs leading-relaxed text-white/40">Implementamos herramientas que ayudan a vender más y mejor.</p>
          </div>
          <div className="rounded-3xl border border-white/5 bg-white/[0.02] p-8">
            <Shield size={24} className="mb-4 text-blue-400" />
            <h3 className="mb-2 text-sm font-bold uppercase tracking-widest">Seguridad y Roles</h3>
            <p className="text-xs leading-relaxed text-white/40">Control total sobre quién accede a qué información.</p>
          </div>
          <div className="rounded-3xl border border-white/5 bg-white/[0.02] p-8">
            <Layout size={24} className="mb-4 text-purple-400" />
            <h3 className="mb-2 text-sm font-bold uppercase tracking-widest">Diseño Unificado</h3>
            <p className="text-xs leading-relaxed text-white/40">Una experiencia visual coherente en todos los puntos de contacto.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
