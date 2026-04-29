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
  isNoDistractions?: boolean;
}

export const AuraContentLayer: React.FC<AuraContentLayerProps> = ({
  quote,
  theme,
  isZenMode,
  isNoDistractions = false
}) => {
  if (isZenMode) return null;
  if (!quote) return null;

  return (
    <div className={`relative z-10 w-full max-w-5xl mx-auto px-4 md:px-8 py-8 md:py-12 flex flex-col items-center justify-center min-h-[50vh] md:min-h-[60vh] text-center transition-all duration-1000 ${isNoDistractions ? 'scale-105' : 'scale-100'}`}>
      <AnimatePresence mode="wait">
        <motion.div
          key={quote.text}
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -30 }}
          transition={{ duration: 1.2, ease: "easeOut" }}
          className={`space-y-4 md:space-y-8 w-full ${isNoDistractions ? 'max-w-4xl' : ''}`}
        >
          {quote.category && (
            <motion.span 
              initial={{ opacity: 0, letterSpacing: "0.2em" }}
              animate={{ opacity: 0.6, letterSpacing: isNoDistractions ? "0.6em" : "0.4em" }}
              className={`block text-gold text-[10px] md:text-xs font-semibold uppercase transition-all duration-1000 ${isNoDistractions ? 'tracking-[0.6em] mb-4' : 'tracking-[0.4em]'}`}
            >
              {quote.category}
            </motion.span>
          )}
          
          <h1 className={`text-2xl sm:text-4xl md:text-6xl lg:text-8xl font-bold tracking-tighter leading-[1.1] px-4 md:px-0 transition-all duration-1000 ${theme === 'classic' ? 'serif italic' : 'font-sans'} ${isNoDistractions ? 'text-white' : 'text-white/90'}`}>
            {quote.text}
          </h1>

          {quote.price && (
            <div className={`flex items-center justify-center gap-2 md:gap-4 transition-opacity duration-1000 ${isNoDistractions ? 'opacity-100' : 'opacity-40'}`}>
              <div className={`h-[1px] w-8 md:w-16 bg-white/20 ${isNoDistractions ? 'bg-gold/30' : ''}`} />
              <span className={`text-lg md:text-3xl font-light tracking-widest uppercase transition-all duration-1000 ${isNoDistractions ? 'text-gold' : 'text-white'}`}>
                {quote.price}
              </span>
              <div className={`h-[1px] w-8 md:w-16 bg-white/20 ${isNoDistractions ? 'bg-gold/30' : ''}`} />
            </div>
          )}

          {quote.tag && !isNoDistractions && (
            <div className="inline-block px-4 py-1 rounded-full border border-gold/30 bg-gold/5 text-[10px] text-gold uppercase tracking-[0.2em]">
              {quote.tag}
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};
