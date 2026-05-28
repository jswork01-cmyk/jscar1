import React, { useEffect, useState } from 'react';
import { Wifi, Battery, Signal } from 'lucide-react';

interface PhoneFrameProps {
  children: React.ReactNode;
}

export default function PhoneFrame({ children }: PhoneFrameProps) {
  const [time, setTime] = useState('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      let hours = now.getHours();
      const minutes = now.getMinutes().toString().padStart(2, '0');
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12 || 12;
      setTime(`${hours}:${minutes} ${ampm}`);
    };

    updateTime();
    const interval = setInterval(updateTime, 60000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-[#1c2712] flex items-center justify-center p-0 md:p-6 select-none overflow-x-hidden md:bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] md:from-[#2e3e1e] md:via-[#1c2712] md:to-[#0f1609]">
      {/* Background decoration in desktop view */}
      <div className="hidden md:block absolute top-10 left-10 w-96 h-96 bg-[#516931]/10 rounded-full blur-3xl pointers-events-none" />
      <div className="hidden md:block absolute bottom-10 right-10 w-[40rem] h-[40rem] bg-amber-500/5 rounded-full blur-3xl pointers-events-none" />

      {/* Main Container: Adapts to phone/tablet shape on desktop, full screen on mobile */}
      <div className="relative w-full h-screen md:w-[412px] md:h-[840px] md:rounded-[3rem] md:border-[12px] md:border-[#2f3d23] md:shadow-[0_25px_50px_-12px_rgba(0,0,0,0.8)] md:bg-[#1a2411] flex flex-col overflow-hidden transition-all duration-300">
        
        {/* Notch / Speaker on Desktop */}
        <div className="hidden md:block absolute top-0 left-1/2 -translate-x-1/2 w-44 h-8 bg-[#2f3d23] rounded-b-2xl z-50">
          {/* Speaker grill */}
          <div className="absolute top-1.5 left-1/2 -translate-x-1/2 w-14 h-1 bg-[#151c10] rounded-full" />
          {/* Front camera lens */}
          <div className="absolute top-1 right-10 w-2.5 h-2.5 bg-slate-950 rounded-full border border-[#2f3d23] flex items-center justify-center">
            <div className="w-1 h-1 bg-blue-900/50 rounded-full" />
          </div>
        </div>

        {/* Smartphone Screen Area */}
        <div className="flex-1 flex flex-col bg-[#f4f6f0] text-[#1e2815] overflow-hidden relative">
          
          {/* Smartphone Top Status Bar */}
          <div className="h-12 bg-[#516931] px-6 pt-2 flex items-center justify-between text-xs font-medium z-40 select-none text-white border-b border-[#435728]/50">
            {/* Time */}
            <span className="font-mono tracking-wide">{time}</span>
            
            {/* Status Icons */}
            <div className="flex items-center gap-2">
              <Signal className="w-4 h-4 text-white" strokeWidth={2.5} />
              <Wifi className="w-4 h-4 text-white" strokeWidth={2.5} />
              <div className="flex items-center gap-0.5">
                <span className="font-mono text-[9px] mr-0.5 font-bold text-white/90">100%</span>
                <Battery className="w-5 h-5 text-white fill-white/80" strokeWidth={1.5} />
              </div>
            </div>
          </div>

          {/* Interactive Screen Content container */}
          <div id="phone-screen-content" className="flex-1 overflow-y-auto flex flex-col relative pb-6 bg-[#f4f6f0]">
            {children}
          </div>

          {/* Phone Navigation Bar Line (Bottom Gesture Bar) */}
          <div className="h-4 bg-[#516931] flex items-center justify-center pb-1 border-t border-[#435728]/30">
            <div className="w-28 h-1 bg-white/40 rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );
}
