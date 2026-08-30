import React, { useState } from 'react';
import { motion, useMotionValue, useTransform, useAnimation, AnimatePresence } from 'framer-motion';
import { useTheme } from '../context/ThemeContext';

export default function LampToggle() {
  const { theme, toggleTheme, isDark } = useTheme();
  const [isPulling, setIsPulling] = useState(false);
  const controls = useAnimation();
  const y = useMotionValue(0);

  // Dynamic wire length: starts at 28px, stretches as dragged
  const wireLength = useTransform(y, [0, 60], [28, 75]);

  // Subtle web audio click effect
  const playClickSound = () => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(isDark ? 850 : 650, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(150, ctx.currentTime + 0.06);

      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.06);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.06);
    } catch {
      // Audio context might be restricted before user gesture
    }
  };

  const handlePullTrigger = () => {
    playClickSound();
    toggleTheme();
  };

  // Programmatic pull animation on click
  const handleClickPull = async () => {
    if (isPulling) return;
    setIsPulling(true);
    await controls.start({
      y: 26,
      transition: { duration: 0.12, ease: 'easeIn' }
    });
    handlePullTrigger();
    await controls.start({
      y: 0,
      transition: {
        type: 'spring',
        stiffness: 400,
        damping: 10,
        mass: 0.8
      }
    });
    setIsPulling(false);
  };

  // Drag release event
  const handleDragEnd = (event, info) => {
    setIsPulling(false);
    if (info.offset.y > 18) {
      handlePullTrigger();
    }
    controls.start({
      y: 0,
      transition: {
        type: 'spring',
        stiffness: 400,
        damping: 10,
        mass: 0.8
      }
    });
  };

  return (
    <div className="relative flex items-center select-none group" title="Pull the wire to toggle lights">
      {/* Top Ceiling Fixture & Hanging Lamp Shell */}
      <div className="relative flex flex-col items-center">
        {/* Ambient Light Cone radiating downwards when light is turned ON */}
        <AnimatePresence>
          {!isDark && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.25 }}
              className="absolute -top-1 left-1/2 -translate-x-1/2 w-36 h-28 pointer-events-none z-0 overflow-visible"
            >
              {/* Radial Light Glow Beam */}
              <div 
                className="w-full h-full opacity-60"
                style={{
                  background: 'radial-gradient(ellipse at 50% 20%, rgba(245, 158, 11, 0.45) 0%, rgba(245, 158, 11, 0.15) 45%, rgba(245, 158, 11, 0) 75%)',
                  filter: 'blur(4px)'
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Lamp Structure SVG */}
        <div className="relative z-10 flex flex-col items-center">
          {/* Ceiling Mount */}
          <div className={`w-3.5 h-1 rounded-b-sm transition-colors duration-300 ${
            !isDark ? 'bg-[#94A3B8]' : 'bg-[#343A4C]'
          }`} />

          {/* Top Hanging Cord */}
          <div className={`w-[1.5px] h-2 transition-colors duration-300 ${
            !isDark ? 'bg-[#64748B]' : 'bg-[#202430]'
          }`} />

          {/* Lamp Shade & Bulb */}
          <div className="relative -mt-0.5 cursor-pointer" onClick={handleClickPull}>
            <svg width="34" height="22" viewBox="0 0 34 22" fill="none" className="overflow-visible">
              {/* Upper Socket Cap */}
              <rect
                x="13.5"
                y="0.5"
                width="7"
                height="3.5"
                rx="1"
                fill={!isDark ? "#D97706" : "#202430"}
                stroke={!isDark ? "#B45309" : "#343A4C"}
                strokeWidth="0.8"
                className="transition-colors duration-300"
              />

              {/* Lampshade Cone */}
              <path
                d="M5 14L12 3H22L29 14H5Z"
                fill={!isDark ? "#F59E0B" : "#181C26"}
                fillOpacity={!isDark ? "0.9" : "0.95"}
                stroke={!isDark ? "#D97706" : "#343A4C"}
                strokeWidth="1.2"
                strokeLinejoin="round"
                className="transition-colors duration-300"
              />

              {/* Shade Lower Rim Accent */}
              <path
                d="M4 14C4 14 10 15.5 17 15.5C24 15.5 30 14 30 14"
                stroke={!isDark ? "#FDE68A" : "#545763"}
                strokeWidth="1.2"
                strokeLinecap="round"
                className="transition-colors duration-300"
              />

              {/* Light Bulb (Inside / Protruding) */}
              <circle
                cx="17"
                cy="16"
                r="3.5"
                fill={!isDark ? "#FEF08A" : "#202430"}
                stroke={!isDark ? "#F59E0B" : "#343A4C"}
                strokeWidth="1"
                className="transition-colors duration-300"
              />

              {/* Glowing Bulb Filament in Light Mode */}
              {!isDark && (
                <circle
                  cx="17"
                  cy="16"
                  r="1.8"
                  fill="#F59E0B"
                  className="animate-pulse"
                />
              )}
            </svg>
          </div>

          {/* Interactive Pull Wire (String & Bead) */}
          <div className="relative flex flex-col items-center -mt-1 z-20">
            {/* Draggable Pull Handle and Cord */}
            <motion.div
              drag="y"
              dragConstraints={{ top: 0, bottom: 40 }}
              dragElastic={0.4}
              dragSnapToOrigin
              animate={controls}
              style={{ y }}
              onDragStart={() => setIsPulling(true)}
              onDragEnd={handleDragEnd}
              onClick={handleClickPull}
              className="cursor-grab active:cursor-grabbing flex flex-col items-center group/cord"
            >
              {/* Dynamic Connecting Wire */}
              <motion.div 
                style={{ height: wireLength }} 
                className={`w-[1.5px] transition-colors duration-300 ${
                  !isDark 
                    ? 'bg-[#D97706] group-hover/cord:bg-[#B45309]' 
                    : 'bg-[#545763] group-hover/cord:bg-[#E8B84A]'
                }`}
              />

              {/* Pull Cord Bead Beads */}
              <div className="flex flex-col items-center -space-y-0.5">
                <div className={`w-1.5 h-1.5 rounded-full transition-colors ${
                  !isDark ? 'bg-[#F59E0B]' : 'bg-[#343A4C]'
                }`} />
                <div className={`w-2 h-2 rounded-full transition-colors ${
                  !isDark ? 'bg-[#D97706]' : 'bg-[#545763]'
                }`} />
              </div>

              {/* Wooden / Metallic Pull Handle Acorn at Bottom */}
              <motion.div
                whileHover={{ scale: 1.25 }}
                whileTap={{ scale: 0.9 }}
                className={`mt-0.5 px-1 py-1.5 rounded-full border shadow-md flex items-center justify-center transition-all ${
                  !isDark
                    ? 'bg-[#FEF3C7] border-[#D97706] text-[#B45309] shadow-[0_2px_8px_rgba(245,158,11,0.35)]'
                    : 'bg-[#181C26] border-[#343A4C] text-[#8B8D97] group-hover/cord:border-[#E8B84A] group-hover/cord:text-[#E8B84A]'
                }`}
              >
                <div className={`w-1.5 h-2 rounded-sm ${!isDark ? 'bg-[#D97706]' : 'bg-[#E8B84A]'}`} />
              </motion.div>

              {/* Tooltip hint on hover */}
              <div className="absolute top-full mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap px-2 py-0.5 rounded bg-[#0B0D12]/90 border border-[#202430] text-[10px] text-[#F2F1EC] font-sans shadow-lg z-50">
                {isDark ? 'Pull to switch ON' : 'Pull to switch OFF'}
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}
