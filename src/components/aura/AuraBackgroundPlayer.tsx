import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface AuraBackgroundPlayerProps {
  performanceMode: 'high' | 'eco';
  isZenMode: boolean;
  activeImages: any[];
  currentImageIndex: number;
}

export const AuraBackgroundPlayer: React.FC<AuraBackgroundPlayerProps> = ({
  performanceMode,
  isZenMode,
  activeImages,
  currentImageIndex
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isVideoVisible, setIsVideoVisible] = useState(performanceMode === 'high');

  useEffect(() => {
    setIsVideoVisible(performanceMode === 'high' && !isZenMode);
  }, [performanceMode, isZenMode]);

  return (
    <div className="absolute inset-0 z-0 overflow-hidden bg-black">
      {/* Background Images Overlay with Smooth Transistsions */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeImages[currentImageIndex]?.url}
          initial={{ opacity: 0, scale: 1.1 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 2, ease: "easeInOut" }}
          className="absolute inset-0"
        >
          <img
            src={activeImages[currentImageIndex]?.url}
            alt="Ambient"
            className="w-full h-full object-cover brightness-[0.4] saturate-[0.8]"
            loading="lazy"
            referrerPolicy="no-referrer"
          />
        </motion.div>
      </AnimatePresence>

      {/* Video Overlay disabled until dynamic rendering is available */}
      {/* 
      {isVideoVisible && (
        <video
          ref={videoRef}
          autoPlay
          muted
          loop
          playsInline
          className="absolute inset-0 w-full h-full object-cover mix-blend-overlay opacity-30"
          src="https://media.auradisplay.es/videos/ambient_cloud.mp4"
          {...{ referrerPolicy: "no-referrer" } as any}
        />
      )}
      */}

      {/* Aura Glow Effect */}
      <div className="aura-glow" />
    </div>
  );
};
