import React, { useState, useRef, useEffect } from 'react';
import NeonBlobsCanvas from './components/NeonBlobsCanvas';
import ConfettiCanvas from './components/ConfettiCanvas';
import { AnimatePresence, motion } from 'motion/react';

export default function App() {
  const [isExploded, setIsExploded] = useState(false);
  const [clickCoords, setClickCoords] = useState<{ x: number; y: number } | null>(null);
  const [fadeProgress, setFadeProgress] = useState(0); // [0..1] fade to absolute black
  const [headlineHovered, setHeadlineHovered] = useState(false);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const fadeTimelineRef = useRef<number | null>(null);

  // Parse mouse coordinates to calculate dynamic lighting offset coordinates
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!containerRef.current || isExploded) return;
    
    // Normalize percentages around the center of the viewport
    const offsetPercentX = (e.clientX - window.innerWidth / 2) / (window.innerWidth / 2);
    const offsetPercentY = (e.clientY - window.innerHeight / 2) / (window.innerHeight / 2);

    containerRef.current.style.setProperty('--glow-offset-x', `${offsetPercentX * -15}px`);
    containerRef.current.style.setProperty('--glow-offset-y', `${offsetPercentY * -15}px`);
  };

  // Instant Confetti explosion and rapid Cinematic Fade to black on text click
  const handleCentralTextClick = (e: React.MouseEvent) => {
    if (isExploded) return;

    // Capture coordinates where the explosion will radiate from
    setClickCoords({ x: e.clientX, y: e.clientY });
    setIsExploded(true);

    const fadeDuration = 1400; // Elegant fade timing
    const startTime = Date.now();

    const animateFade = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / fadeDuration, 1);

      // Fast-exponential fade progression for luxury cinema blackout
      setFadeProgress(Math.pow(progress, 1.6));

      if (progress < 1) {
        fadeTimelineRef.current = requestAnimationFrame(animateFade);
      } else {
        handleExplosionComplete();
      }
    };

    fadeTimelineRef.current = requestAnimationFrame(animateFade);
  };

  useEffect(() => {
    return () => {
      if (fadeTimelineRef.current) {
        cancelAnimationFrame(fadeTimelineRef.current);
      }
    };
  }, []);

  const handleExplosionComplete = () => {
    // Seamless browser redirect to Noëlla Bible's main Adobe Portfolio domain
    window.location.href = 'https://noellabible.myportfolio.com/';
  };

  return (
    <div
      id="main-viewport-frame"
      ref={containerRef}
      onMouseMove={handleMouseMove}
      className="relative w-full h-full bg-[#000000] overflow-hidden select-none flex flex-col justify-between items-center cursor-default text-white"
      style={{
        ['--glow-offset-x' as any]: '0px',
        ['--glow-offset-y' as any]: '0px',
      }}
    >
      {/* 
        3D WebGL Canvas Layer
        Draws the SITE.jpg-inspired silk waves background and refracts/deforms the text 
        drawn offscreen beneath dynamic floating glass bubbles.
      */}
      <NeonBlobsCanvas
        isExploded={isExploded}
        clickCoords={clickCoords}
        onExplosionComplete={handleExplosionComplete}
        fadeProgress={fadeProgress}
      />

      {/* Photorealistic 3D floating & tumbling Confetti layer */}
      <ConfettiCanvas
        isExploded={isExploded}
        clickCoords={clickCoords}
      />

      {/* Luxury micro-film grain overlay texture layer */}
      <div 
        className="absolute inset-0 w-full h-full bg-grain-overlay pointer-events-none z-25 opacity-60"
        style={{
          opacity: 0.6 * (1 - fadeProgress),
        }}
      />

      {/* 
        ========================================================================
        INTERACTIVE TRANSPARENT OVERLAY (DOM)
        These elements align perfectly with the WebGL-rendered texts underneath,
        providing semantic structures for accessibility/SEO, mouse hover state tracking,
        and precise responsive pointer clicking.
        ========================================================================
      */}

      {/* 1. TOP BAR OVERLAY */}
      <div 
        className="w-full pt-8 md:pt-12 text-center z-30 pointer-events-none"
        style={{ opacity: isExploded ? 0 : 1, transition: 'opacity 0.4s ease-out' }}
      >
        {/* Invisible to avoid double-text rendering on screen, but accessible in DOM */}
        <div className="sr-only">San Francisco, CA</div>
      </div>

      {/* 2. CENTRAL BRANDING CLICK ACTION AREA */}
      <div className="relative w-full max-w-4xl px-6 flex items-center justify-center z-30 flex-grow">
        <AnimatePresence>
          {!isExploded && (
            <motion.div
              key="typography-hotspot-container"
              id="typography-hotspot-container"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ 
                opacity: 0, 
                scale: 1.35, 
                filter: 'blur(20px)',
                transition: { duration: 0.5, ease: 'easeOut' } 
              }}
              className="text-center w-full flex flex-col items-center justify-center relative cursor-pointer"
              onClick={handleCentralTextClick}
              onMouseEnter={() => setHeadlineHovered(true)}
              onMouseLeave={() => setHeadlineHovered(false)}
            >
              {/* Semantic hidden descriptors for screen readers */}
              <h1 className="sr-only">Noella BIble Creative Diirection</h1>

              {/* 
                An absolute, custom transparent overlay mimicking text proportions exactly.
                This receives standard mouse interactions, changing the cursor to a pointer,
                and updating visual cues dynamically.
              */}
              <div 
                className="py-12 px-20 select-none cursor-pointer"
                style={{
                  // Soft dark card glow tracing mouse movement
                  background: headlineHovered 
                    ? 'radial-gradient(circle, rgba(127, 255, 0, 0.05) 0%, rgba(0,0,0,0) 70%)'
                    : 'none',
                  transform: 'translate(calc(var(--glow-offset-x) * 0.4), calc(var(--glow-offset-y) * 0.4))',
                  transition: 'background 0.5s ease-out',
                }}
              >
                {/* 
                  Double dummy text drawn completely transparently in DOM so standard bounding box 
                  matches WebGL text size with pixel-perfect responsive precision.
                */}
                <div 
                  className="font-heading font-bold text-[2.95rem] sm:text-[3.54rem] md:text-[5.12rem] lg:text-[6.14rem] tracking-tight text-transparent leading-none select-none"
                >
                  NOËLLA BIBLE
                </div>
                
                <div 
                  className="mt-5 text-[11px] md:text-sm text-transparent tracking-[0.62em] font-medium"
                >
                  CREATIVE DIRECTION
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 3. BOTTOM FOOTER OVERLAY */}
      <div 
        className="w-full pb-8 md:pb-12 text-center z-30 pointer-events-auto"
        style={{
          opacity: isExploded ? 0 : 1,
          transition: 'all 0.4s ease-out',
          transform: `translateY(${isExploded ? '30px' : '0px'})`,
        }}
      >
        <a 
          href="mailto:noellabibledesign@gmail.com"
          className="inline-block font-sans text-[11px] md:text-[13px] tracking-[0.28em] font-medium text-white hover:text-[#DEF50C] transition-all duration-300 uppercase cursor-pointer pointer-events-auto"
        >
          noellabibledesign@gmail.com
        </a>
      </div>
    </div>
  );
}
