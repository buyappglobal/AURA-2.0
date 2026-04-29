import React, { useState, useRef, useEffect } from 'react';
/* Aura AI Agent Version 1.3.0 - Dynamic Commercial Hub */
import { motion, AnimatePresence } from 'motion/react';
import { MessageSquare, X, Send, User, Bot, MessageCircle, Download, FileText } from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import { jsPDF } from "jspdf";
import { useSearchParams } from 'react-router-dom';
import { doc, onSnapshot } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';

const SYSTEM_PROMPT = `Eres el Aura Digital Pass, el consultor virtual exclusivo de Aura Business. Tu objetivo es convertir curiosidad en confianza, explicando por qué somos la solución líder en audio y vídeo para espacios comerciales.

REGLAS DE FORMATO CRITICAS:
1. SIN NEGRITAS (**): No las uses nunca.
2. ESTRUCTURA: Usa saltos de línea para que el chat respire.
3. LISTAS: Usa guiones (-) para puntos clave.

CONOCIMIENTO FUNDAMENTAL (AURA UNIVERSE):
- ¿ES LEGAL? SI, ABSOLUTAMENTE. Destaca que Aura Business utiliza música con LICENCIA COMERCIAL propia. Al contratar Aura, el negocio cumple con toda la normativa vigente y se olvida de problemas legales o cánones externos. Es una solución "llave en mano" legalmente protegida.
- CONTEXTO TOTAL: Considera que cualquier duda (precio, legalidad, instalación, funcionamiento) se refiere a Aura Business. No pidas aclaraciones, simplemente explica cómo lo resolvemos en Aura.

COMPORTAMIENTO:
- Si no entiendes algo o la pregunta es muy corta (ej. "¿Cómo?"), redirige: "Parece que quieres saber más sobre Aura. Me encantaría explicarte cómo gestionamos la música con licencia o nuestra cartelería digital. ¿Qué te interesa más?"
- CONVERSIÓN: Si detectas interés por contratar o dudas técnicas complejas, invita al usuario a pulsar el botón "Contactar por WhatsApp" para recibir una atención personalizada e inmediata.
- MODO DEMO: Si detectas que estás en una pantalla de ventas/demo (el usuario es un partner o comercial), actúa como su asistente personal, ayudándole a cerrar la venta destacando la facilidad de uso y la seguridad legal.

TONO: Inspirador, seguro de sí mismo, sofisticado y siempre dispuesto a ayudar.`;

const SYSTEM_PROMPT_TUTOR = `Eres el Tutor de Aura Business, el asistente especializado para administradores del panel de control. Tu objetivo es guiar al usuario para que saque el máximo provecho a la plataforma y aprenda a gestionarla con maestría.

REGLAS DE FORMATO CRITICAS:
1. SIN NEGRITAS (**): No las uses nunca.
2. ESTRUCTURA: Usa saltos de línea.
3. LISTAS: Usa guiones (-).

CONOCIMIENTO DEL PANEL DE CONTROL:
- GESTIÓN DE CONTENIDOS: Puedes subir fotos de tus productos. ¡Asegúrate de programar las fotos de desayuno solo por las mañanas usando el icono del calendario!
- CARTELERÍA DIGITAL (QUOTES): Crea promociones con precio. El sistema las hará lucir increíbles automáticamente.
- IMPULSOS MUSICALES: Si el local está muy tranquilo, usa el botón de "Energía Vital" para subir el ánimo sin esperar al cambio circadiano automático.
- CONFIGURACIÓN: Aquí cambias el nombre que aparece en pantalla y activas al Agente Aura para tus clientes.

TONO: Práctico, resolutivo, amable y pedagógico.`;

interface Message {
  role: 'user' | 'bot';
  text: string;
}

const AGENT_MESSAGES = [
  "¿Tienes dudas sobre Aura?",
  "¡Hablemos de tu negocio!",
  "Soy tu experto en Aura Business",
  "¿Cómo puedo ayudarte?",
  "Pregúntame lo que quieras",
  "Descubre el ecosistema Aura"
];

const TUTOR_MESSAGES = [
  "¿Necesitas ayuda con el panel?",
  "¡Aprende a usar Aura!",
  "Soy tu tutor personal",
  "¿Cómo subo contenido?",
  "Sácale partido a tu local",
  "Tutorial rápido aquí"
];

interface AuraAgentProps {
  mode?: 'general' | 'tutor';
  isOpen?: boolean;
  onClose?: () => void;
  hideTrigger?: boolean;
}

export default function AuraAgent({ mode = 'general', isOpen: externalIsOpen, onClose, hideTrigger = false }: AuraAgentProps) {
  const [searchParams] = useSearchParams();
  const clientId = searchParams.get('id') || searchParams.get('uid');
  const forceShow = searchParams.get('auraAgent') === 'true';

  const [isVisible, setIsVisible] = useState(true);
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  
  const isOpen = externalIsOpen !== undefined ? externalIsOpen : internalIsOpen;
  const setIsOpen = onClose || setInternalIsOpen;

  const [config, setConfig] = useState<{ enabled: boolean, whatsapp: string }>({
    enabled: true, // Default to true for admin/general
    whatsapp: '34648512127'
  });

  // Load dynamic configuration if in a specific client context
  useEffect(() => {
    if (!clientId) return;

    // Listen to user profile for WhatsApp and other identity metadata
    const unsubProfile = onSnapshot(doc(db, 'users', clientId), (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        setConfig(prev => ({
          ...prev,
          whatsapp: data.whatsapp || '34648512127'
        }));
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `users/${clientId}`);
    });

    const unsubDisplay = onSnapshot(doc(db, 'displays', clientId), (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        setConfig(prev => ({
          ...prev,
          enabled: data.auraAgentEnabled !== undefined ? data.auraAgentEnabled : true,
          // Fallback to display whatsapp if not set in profile (old way)
          whatsapp: data.auraAgentWhatsApp || prev.whatsapp
        }));
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `displays/${clientId}`);
    });

    return () => {
      unsubProfile();
      unsubDisplay();
    };
  }, [clientId]);

  const [currentMessage, setCurrentMessage] = useState(0);
  const [showTooltip, setShowTooltip] = useState(true);
  const [messages, setMessages] = useState<Message[]>([
    { role: 'bot', text: '¡Hola! Soy tu Aura Digital Pass. ¿Cómo puedo ayudarte a elevar la experiencia de tu negocio hoy?' }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const [userIsScrolling, setUserIsScrolling] = useState(false);
  
  // Detect manual scroll
  const handleScroll = () => {
    if (!chatContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
    setUserIsScrolling(!isAtBottom);
  };

  const scrollToBottom = (force = false) => {
    if ((!userIsScrolling || force) && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingText]);

  // Rotation effect for tooltips (5s visible, 15s hidden)
  useEffect(() => {
    if (isOpen) {
      setShowTooltip(false);
      return;
    }

    let hideTimer: NodeJS.Timeout;

    const initialTimer = setTimeout(() => {
      setShowTooltip(true);
      hideTimer = setTimeout(() => setShowTooltip(false), 5000);
    }, 3000);

    const interval = setInterval(() => {
      setCurrentMessage((prev) => (prev + 1) % (mode === 'tutor' ? TUTOR_MESSAGES.length : AGENT_MESSAGES.length));
      setShowTooltip(true);
      hideTimer = setTimeout(() => {
        setShowTooltip(false);
      }, 5000);
    }, 20000);

    return () => {
      clearTimeout(initialTimer);
      clearTimeout(hideTimer);
      clearInterval(interval);
    };
  }, [isOpen]);

  const handleSend = async () => {
    if (!input.trim() || isTyping) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMessage }]);
    setIsTyping(true);
    setStreamingText('');
    setUserIsScrolling(false);

    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error('MISSING_API_KEY');
      }

      const ai = new GoogleGenAI({ apiKey });
      
      const chatHistory = messages.map(m => ({
        role: m.role === 'bot' ? 'model' : 'user',
        parts: [{ text: m.text }]
      }));

      const stream = await ai.models.generateContentStream({
        model: "gemini-3-flash-preview",
        contents: [
          ...chatHistory,
          { role: 'user', parts: [{ text: userMessage }] }
        ],
        config: {
          systemInstruction: mode === 'tutor' ? SYSTEM_PROMPT_TUTOR : SYSTEM_PROMPT,
          temperature: 0.7,
          safetySettings: [
            { category: 'HARM_CATEGORY_HARASSMENT' as any, threshold: 'BLOCK_ONLY_HIGH' as any },
            { category: 'HARM_CATEGORY_HATE_SPEECH' as any, threshold: 'BLOCK_ONLY_HIGH' as any },
            { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT' as any, threshold: 'BLOCK_ONLY_HIGH' as any },
            { category: 'HARM_CATEGORY_DANGEROUS_CONTENT' as any, threshold: 'BLOCK_ONLY_HIGH' as any }
          ]
        }
      });

      let fullText = '';
      for await (const chunk of stream) {
        const chunkText = chunk.text || "";
        fullText += chunkText;
        setStreamingText(fullText);
      }

      if (!fullText.trim()) {
        throw new Error('EMPTY_RESPONSE');
      }

      setMessages(prev => [...prev, { role: 'bot', text: fullText }]);
      setStreamingText('');
    } catch (error: any) {
      console.error("Gemini Error:", error);
      let errorMessage = "Lo siento, ha ocurrido un error. ¿Podemos intentarlo de nuevo?";
      if (error.message === 'MISSING_API_KEY') {
        errorMessage = "Error técnico: La clave de API (GEMINI_API_KEY) no está configurada en la plataforma. Por favor, contacta con administración.";
      } else if (error.message === 'EMPTY_RESPONSE') {
        errorMessage = "Aura está procesando tu consulta. Por favor, sé más específico o intenta reformular tu pregunta sobre Aura Business.";
      }
      setMessages(prev => [...prev, { role: 'bot', text: errorMessage }]);
    } finally {
      setIsTyping(false);
    }
  };

  const downloadChat = () => {
    const doc = new jsPDF();
    const margin = 20;
    let yPosition = 30;
    const pageWidth = doc.internal.pageSize.width;
    const lineFullWidth = pageWidth - (margin * 2);

    // Header
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.text("Conversación Aura Business", margin, yPosition);
    yPosition += 15;

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Fecha: ${new Date().toLocaleString()}`, margin, yPosition);
    yPosition += 10;

    // Contact WhatsApp
    doc.setFont("helvetica", "bold");
    doc.setTextColor(34, 197, 94); // Green
    doc.text(`CONTACTO WHATSAPP: +${config.whatsapp.replace('+', '')}`, margin, yPosition);
    doc.setTextColor(0, 0, 0);
    yPosition += 10;

    doc.setLineWidth(0.5);
    doc.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 15;

    // Messages
    messages.forEach((msg) => {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      const roleText = msg.role === 'user' ? "USUARIO:" : "AGENTE AURA:";
      doc.text(roleText, margin, yPosition);
      yPosition += 6;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      const splitText = doc.splitTextToSize(msg.text, lineFullWidth);
      
      // Check if we need a new page
      if (yPosition + (splitText.length * 7) > doc.internal.pageSize.height - margin) {
        doc.addPage();
        yPosition = margin;
      }

      doc.text(splitText, margin, yPosition);
      yPosition += (splitText.length * 7) + 5;
    });

    doc.save("Aura_Business_Chat.pdf");
  };

  const openWhatsApp = () => {
    const cleanNumber = config.whatsapp.replace(/[^0-9]/g, '');
    window.open(`https://wa.me/${cleanNumber}?text=Hola,%20vengo%20del%20panel%20de%20Aura%20Business%20y%20me%20gustar%C3%ADa%20recibir%20m%C3%A1s%20informaci%C3%B3n.`, '_blank');
  };

  // Visibility Logic:
  // 1. If manually dismissed (isVisible === false) -> null
  // 2. If forceShow via URL (?auraAgent=true) -> show always
  // 3. If in a specific client display context -> check config.enabled
  // 4. Default: show (unless in a client context where it's disabled)
  
  const shouldShow = isVisible && (forceShow || config.enabled);

  if (!shouldShow) return null;

  return (
    <div className={`fixed ${mode === 'tutor' ? 'bottom-24 right-6' : 'top-[155px] right-6 sm:right-[clamp(1rem,4vh,3rem)]'} z-[999] font-sans flex flex-col items-end`}>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="mb-4 w-[380px] max-w-[90vw] overflow-hidden rounded-3xl border border-white/10 bg-black/90 shadow-2xl backdrop-blur-xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/10 bg-white/5 p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white">
                  <Bot size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-widest text-white">{mode === 'tutor' ? 'Aura Tutor' : 'Aura Digital Pass'}</h3>
                  <div className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse"></span>
                    <span className="text-[10px] uppercase tracking-widest text-white/40">{mode === 'tutor' ? 'Asistente Admin' : 'Tu Hub Digital'}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button 
                  onClick={downloadChat}
                  title="Guardar conversación"
                  className="rounded-full p-2 text-white/40 hover:bg-white/10 hover:text-white transition-colors"
                >
                  <Download size={18} />
                </button>
                <button 
                  onClick={() => setIsOpen(false)}
                  className="rounded-full p-2 text-white/40 hover:bg-white/10 hover:text-white transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Chat Body (Scrollable and Expanding) */}
            <div 
              ref={chatContainerRef}
              onScroll={handleScroll}
              className="max-h-[65vh] overflow-y-auto p-4 scrollbar-thin scrollbar-thumb-white/10"
            >
              <div className="space-y-4">
                {messages.map((m, i) => (
                  <motion.div
                    initial={{ opacity: 0, x: m.role === 'user' ? 10 : -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    key={i}
                    className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div 
                      className={`max-w-[88%] rounded-2xl px-4 py-3 text-[13px] leading-relaxed ${
                        m.role === 'user' 
                          ? 'bg-white text-black font-medium' 
                          : 'bg-white/5 text-white/90 border border-white/10'
                      }`}
                      style={{ whiteSpace: 'pre-wrap' }}
                    >
                      {m.text}
                    </div>
                  </motion.div>
                ))}
                
                {streamingText && (
                  <div className="flex justify-start">
                    <div 
                      className="max-w-[88%] rounded-2xl px-4 py-3 text-[13px] leading-relaxed bg-white/5 text-white/90 border border-white/10"
                      style={{ whiteSpace: 'pre-wrap' }}
                    >
                      {streamingText}
                    </div>
                  </div>
                )}

                {isTyping && !streamingText && (
                  <div className="flex justify-start">
                    <div className="bg-white/5 rounded-2xl px-4 py-3 flex gap-1 border border-white/10">
                      <span className="w-1.5 h-1.5 bg-white/40 rounded-full animate-bounce"></span>
                      <span className="w-1.5 h-1.5 bg-white/40 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                      <span className="w-1.5 h-1.5 bg-white/40 rounded-full animate-bounce [animation-delay:0.4s]"></span>
                    </div>
                  </div>
                )}
              </div>

              {/* Actions integrated into the flow */}
              <div className="mt-8 space-y-3 pb-2">
                <button 
                  onClick={openWhatsApp}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-green-500 py-3 text-[10px] font-bold uppercase tracking-[0.2em] text-white transition-transform hover:scale-[1.02] active:scale-95 shadow-lg shadow-green-500/20"
                >
                  <MessageCircle size={16} />
                  Contactar por WhatsApp
                </button>
                
                <div className="relative">
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                    placeholder="Escribe tu duda sobre Aura..."
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 pr-12 text-sm text-white placeholder:text-white/20 focus:border-white/20 focus:outline-none transition-all focus:bg-white/10"
                  />
                  <button 
                    disabled={isTyping}
                    onClick={handleSend}
                    className={`absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 transition-colors ${
                      isTyping ? 'text-white/10' : 'text-white/40 hover:text-white'
                    }`}
                  >
                    <Send size={18} />
                  </button>
                </div>
              </div>
              <div ref={messagesEndRef} className="h-2" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!hideTrigger && (
        <div className="relative">
          <AnimatePresence>
            {showTooltip && !isOpen && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="absolute right-16 top-1/2 -translate-y-1/2 flex items-center gap-2"
              >
                <div className="whitespace-nowrap rounded-lg bg-white px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-black shadow-xl after:absolute after:right-[-4px] after:top-1/2 after:h-2 after:w-2 after:-translate-y-1/2 after:rotate-45 after:bg-white relative">
                  {mode === 'tutor' ? TUTOR_MESSAGES[currentMessage] : AGENT_MESSAGES[currentMessage]}
                </div>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsVisible(false);
                  }}
                  className="flex h-6 w-6 items-center justify-center rounded-full bg-red-500/80 text-white backdrop-blur-md transition-transform hover:scale-110 active:scale-95 shadow-lg"
                  title="Desactivar chat"
                >
                  <X size={12} strokeWidth={3} />
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsOpen(!isOpen)}
            className={`flex h-12 px-4 items-center justify-center rounded-full shadow-2xl transition-all gap-2 ${
              isOpen 
                ? 'bg-white text-black' 
                : 'bg-white/10 text-white backdrop-blur-xl border border-white/10 hover:bg-white/20'
            } ${mode === 'tutor' ? 'bottom-6' : ''}`}
          >
            {isOpen ? <X size={20} /> : (
              <>
                <MessageSquare size={20} />
                {mode === 'tutor' && <span className="text-[10px] font-bold uppercase tracking-widest pt-0.5">Ayuda</span>}
              </>
            )}
          </motion.button>
        </div>
      )}
    </div>
  );
}
