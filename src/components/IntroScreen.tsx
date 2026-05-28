import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { CheckCircle2, ShieldAlert } from 'lucide-react';

interface IntroScreenProps {
  onComplete: () => void;
}

export default function IntroScreen({ onComplete }: IntroScreenProps) {
  const [showText, setShowText] = useState(false);

  useEffect(() => {
    // Show "안전운행" text 0.8s after car glides in
    const timer1 = setTimeout(() => {
      setShowText(true);
    }, 1000);

    // Complete the intro after 3.8s
    const timer2 = setTimeout(() => {
      onComplete();
    }, 3800);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, [onComplete]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-900 text-white select-none overflow-hidden">
      {/* Background soft glowing lights */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 bg-emerald-500/10 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl" />

      {/* Decorative center grid lines for structural design */}
      <div className="absolute inset-x-0 h-[1px] bg-slate-800/40 top-1/2 -translate-y-12" />
      <div className="absolute inset-y-0 w-[1px] bg-slate-800/40 left-1/2" />

      <div className="relative flex flex-col items-center justify-center max-w-md w-full px-8 text-center z-10">
        <div className="text-xs font-mono tracking-widest text-slate-400 uppercase mb-2">
          Jeongsim Workshop
        </div>
        <h2 className="text-sm font-medium text-emerald-400 tracking-wider mb-12">
          정심작업장
        </h2>

        {/* Welfare Shuttle Car SVG Animation */}
        <div className="relative w-full h-32 flex items-center justify-center overflow-visible mb-8">
          <motion.div
            initial={{ x: '-150vw', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 45, damping: 15 }}
            className="relative flex flex-col items-center justify-center"
          >
            {/* The Car Body */}
            <svg
              width="140"
              height="60"
              viewBox="0 0 140 60"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="drop-shadow-[0_10px_20px_rgba(16,185,129,0.3)]"
            >
              {/* Back Wheel Arch */}
              <circle cx="35" cy="50" r="13" fill="#1e293b" />
              {/* Front Wheel Arch */}
              <circle cx="105" cy="50" r="13" fill="#1e293b" />
              
              {/* Main Bus/Vans Chassis */}
              <rect x="10" y="10" width="115" height="38" rx="8" fill="#10b981" />
              
              {/* Front bumper curves */}
              <path d="M120 25C125 25 130 30 130 38C130 44 125 48 120 48H10V22H120V25Z" fill="#10b981" />
              
              {/* Roof highlight */}
              <path d="M18 10H110V14H18V10Z" fill="#34d399" />

              {/* Windows (Welfare vehicle structure) */}
              <rect x="20" y="16" width="22" height="15" rx="3" fill="#1e293b" />
              <rect x="47" y="16" width="22" height="15" rx="3" fill="#1e293b" />
              <rect x="74" y="16" width="22" height="15" rx="3" fill="#1e293b" />
              {/* Front angled wind shield window */}
              <path d="M101 16H115L120 31H101V16Z" fill="#1e293b" />

              {/* Red Cross/Green Heart symbol on the vehicle body to denote care/disabled support */}
              <rect x="53" y="36" width="10" height="3" fill="#ffffff" rx="1" />
              <rect x="56.5" y="32.5" width="3" height="10" fill="#ffffff" rx="1" />

              {/* Headlights */}
              <path d="M128 35H131C132 35 133 36 133 37V40C133 41 132 42 131 42H128V35Z" fill="#fbbf24" />
              {/* Light glow */}
              <path d="M133 36L150 28V48L133 42V36Z" fill="url(#lightGlow)" opacity="0.3" />

              <defs>
                <linearGradient id="lightGlow" x1="133" y1="39" x2="150" y2="39" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#fbbf24" />
                  <stop offset="1" stopColor="#fbbf24" stopOpacity="0" />
                </linearGradient>
              </defs>
            </svg>

            {/* Moving Wheels - Left */}
            <motion.div
              animate={{ rotate: 360 * 3 }}
              transition={{ repeat: Infinity, duration: 1.2, ease: 'linear' }}
              className="absolute left-[24px] bottom-[-2px] w-6 h-6 rounded-full bg-slate-900 border-4 border-slate-700 flex items-center justify-center shadow-inner"
            >
              <div className="w-1.5 h-1.5 rounded-full bg-white" />
              <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-0.5 bg-slate-600" />
              <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-0.5 bg-slate-600" />
            </motion.div>

            {/* Moving Wheels - Right */}
            <motion.div
              animate={{ rotate: 360 * 3 }}
              transition={{ repeat: Infinity, duration: 1.2, ease: 'linear' }}
              className="absolute left-[94px] bottom-[-2px] w-6 h-6 rounded-full bg-slate-900 border-4 border-slate-700 flex items-center justify-center shadow-inner"
            >
              <div className="w-1.5 h-1.5 rounded-full bg-white" />
              <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-0.5 bg-slate-600" />
              <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-0.5 bg-slate-600" />
            </motion.div>
          </motion.div>
        </div>

        {/* Text Area */}
        <div className="min-h-[100px] flex flex-col items-center">
          {showText && (
            <>
              <motion.h1
                initial={{ opacity: 0, scale: 0.9, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="text-4xl font-extrabold text-white tracking-[0.25em] text-center"
              >
                안전운행
              </motion.h1>
              
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.8 }}
                transition={{ delay: 0.4 }}
                className="flex items-center gap-1 text-xs text-emerald-400 font-mono tracking-wider mt-4"
              >
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                SYSTEM INITIALIZING
              </motion.div>
            </>
          )}
        </div>

        {/* Footer skip helper */}
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.4 }}
          transition={{ delay: 1.5 }}
          onClick={onComplete}
          className="absolute bottom-12 text-xs font-mono text-slate-500 hover:text-white uppercase cursor-pointer border-b border-transparent hover:border-slate-500 transition-colors pb-0.5"
        >
          클릭하여 스킵 (Skip)
        </motion.button>
      </div>
    </div>
  );
}
