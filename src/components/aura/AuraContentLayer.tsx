import React from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface AuraContentLayerProps {
  quote: {
    text: string;
    category?: string;
    tag?: string;
    price?: string;
  } | null;
  theme: string;
  isZenMode: boolean;
}

export const AuraContentLayer: React.FC<AuraContentLayerProps> = ({
  quote,
  theme,
  isZenMode
}) => {
  if (isZenMode || !quote) return null;

  return (
    <div className="relative z-10 w-full max-w-5xl mx-auto px-8 py-12 flex flex-col items-center justify-center min-h-[60vh] text-center">
      <AnimatePresence mode="wait">
        <motion.div
          key={quote.text}
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -30 }}
          transition={{ duration: 1.2, ease: "easeOut" }}
          className="space-y-6"
        >
          {quote.category && (
            <motion.span 
              initial={{ opacity: 0, letterSpacing: "0.2em" }}
              animate={{ opacity: 1, letterSpacing: "0.4em" }}
              className="block text-gold/60 text-xs font-semibold uppercase tracking-[0.4em]"
            >
              {quote.category}
            </motion.span>
          )}
          
          <h1 className={`text-5xl md:text-7xl font-bold tracking-tighter leading-tight ${theme === 'classic' ? 'serif italic' : 'font-sans'}`}>
            {quote.text}
          </h1>

          {quote.price && (
            <div className="flex items-center justify-center gap-4">
              <div className="h-[1px] w-12 bg-white/20" />
              <span className="text-2xl text-white/40 font-light tracking-widest uppercase">
                {quote.price}
              </span>
              <div className="h-[1px] w-12 bg-white/20" />
            </div>
          )}

          {quote.tag && (
            <div className="inline-block px-4 py-1 rounded-full border border-gold/30 bg-gold/5 text-[10px] text-gold uppercase tracking-[0.2em]">
              {quote.tag}
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};
