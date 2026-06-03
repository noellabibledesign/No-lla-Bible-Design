import React, { useEffect, useRef } from 'react';

interface ConfettiCanvasProps {
  isExploded: boolean;
  clickCoords: { x: number; y: number } | null;
}

interface ConfettiParticle {
  id: number;
  x: number;
  y: number;
  sizeX: number;
  sizeY: number;
  baseColor: { r: number; g: number; b: number };
  isSilver: boolean;
  opacity: number;
  
  // 3D physics vectors
  vx: number;
  vy: number;
  vz: number;
  
  // Physical constants
  gravity: number;
  drag: number;
  
  // 3D Rotations and angular velocities for organic flutter
  rotX: number;
  rotY: number;
  rotZ: number;
  vRotX: number;
  vRotY: number;
  vRotZ: number;
  
  // Soft wind oscillation
  wobbleOffset: number;
  wobbleSpeed: number;
}

export default function ConfettiCanvas({ isExploded, clickCoords }: ConfettiCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const particlesRef = useRef<ConfettiParticle[]>([]);
  const animationFrameIdRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    handleResize();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
      }
    };
  }, []);

  // Trigger burst when isExploded turns true
  useEffect(() => {
    if (!isExploded) {
      particlesRef.current = [];
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    const startX = clickCoords?.x ?? window.innerWidth / 2;
    const startY = clickCoords?.y ?? window.innerHeight / 2;

    const count = window.innerWidth < 768 ? 90 : 160;
    const newParticles: ConfettiParticle[] = [];

    // Deluxe color definitions matching #DEF50C and authentic silver sheet specular metallics
    const chartreuseColor = { r: 222, g: 245, b: 12 }; // #DEF50C
    const silverColor = { r: 220, g: 224, b: 230 }; // Silver white metallic sheet

    for (let i = 0; i < count; i++) {
      const isSilver = Math.random() > 0.45;
      const angle = Math.random() * Math.PI * 2;
      const speed = 4 + Math.random() * 24; // powerful initial burst

      // Size of paper slips
      const sizeX = 8 + Math.random() * 12;
      const sizeY = 4 + Math.random() * 8;

      newParticles.push({
        id: i,
        x: startX,
        y: startY,
        sizeX,
        sizeY,
        baseColor: isSilver ? silverColor : chartreuseColor,
        isSilver,
        opacity: 1.0,
        
        // 3D velocity vectors
        vx: Math.cos(angle) * speed + (Math.random() - 0.5) * 5,
        vy: Math.sin(angle) * speed - (2 + Math.random() * 12), // upward burst bias
        vz: (Math.random() - 0.5) * 20, // simulated depth velocity
        
        // Slightly reduced gravity and heavy atmospheric drag for elegant float
        gravity: 0.16 + Math.random() * 0.15,
        drag: 0.96 + Math.random() * 0.02,
        
        // 3D orientations for realistic light flickering
        rotX: Math.random() * Math.PI,
        rotY: Math.random() * Math.PI,
        rotZ: Math.random() * Math.PI,
        
        vRotX: (Math.random() - 0.5) * 0.3,
        vRotY: (Math.random() - 0.5) * 0.35,
        vRotZ: (Math.random() - 0.5) * 0.15,
        
        wobbleOffset: Math.random() * 100,
        wobbleSpeed: 0.04 + Math.random() * 0.04,
      });
    }

    particlesRef.current = newParticles;

    // Start rendering frame tick
    let lastTime = Date.now();

    const tick = () => {
      const now = Date.now();
      const dt = Math.min((now - lastTime) / 16.666, 2.0); // normalize around 60fps delta
      lastTime = now;

      const currentCanvas = canvasRef.current;
      if (!currentCanvas) return;

      const currentCtx = currentCanvas.getContext('2d');
      if (!currentCtx) return;

      currentCtx.clearRect(0, 0, currentCanvas.width, currentCanvas.height);

      const particles = particlesRef.current;

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        // Apply physical model
        p.vy += p.gravity * dt;
        p.vx *= Math.pow(p.drag, dt);
        p.vy *= Math.pow(p.drag, dt);
        p.vz *= Math.pow(p.drag, dt);

        // Add soft air drift based on individual sine wobble
        p.wobbleOffset += p.wobbleSpeed * dt;
        const drift = Math.sin(p.wobbleOffset) * 0.4;
        p.x += (p.vx + drift) * dt;
        p.y += p.vy * dt;

        // Apply angular rotations
        p.rotX += p.vRotX * dt;
        p.rotY += p.vRotY * dt;
        p.rotZ += p.vRotZ * dt;

        // Softly fade opacity as they drift downwards
        p.opacity -= 0.006 * dt;

        if (p.y > currentCanvas.height + 50 || p.opacity <= 0) {
          particles.splice(i, 1);
          i--;
          continue;
        }

        // --- Render projected 3D polygon slip ---
        currentCtx.save();
        currentCtx.translate(p.x, p.y);
        currentCtx.rotate(p.rotZ);

        // Compute simulated thickness scaling based on x/y tumble angles
        const scaleX = Math.cos(p.rotY);
        const scaleY = Math.cos(p.rotX);

        // Establish specular light glare reflection (highly realistic foil look!)
        // Foil shines brightly when its normal points directly at our light source
        const lightAngle = Math.sin(p.rotX + p.rotY);
        const shineFactor = Math.max(0, (lightAngle + 1) / 2); // [0..1] range
        
        let r = p.baseColor.r;
        let g = p.baseColor.g;
        let b = p.baseColor.b;

        if (p.isSilver) {
          // Silver shimmers with strong white reflect
          const highlight = Math.pow(shineFactor, 3.5) * 110;
          r = Math.min(255, r + highlight);
          g = Math.min(255, g + highlight);
          b = Math.min(255, b + highlight);
        } else {
          // Chartreuse glows neon gold-green with light reflection
          const highlight = Math.pow(shineFactor, 2.5) * 60;
          r = Math.min(255, r + highlight);
          g = Math.min(255, g + highlight);
        }

        // Generate dynamic specular satin paper gradients on the canvas overlay
        const grad = currentCtx.createLinearGradient(
          -p.sizeX / 2, 
          -p.sizeY / 2, 
          p.sizeX / 2, 
          p.sizeY / 2
        );
        grad.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${p.opacity})`);
        
        // Edge gloss reflection for foil illusion
        const edgeGleam = p.isSilver 
          ? `rgba(255, 255, 255, ${p.opacity * 0.95})` 
          : `rgba(245, 255, 120, ${p.opacity * 0.95})`;
          
        grad.addColorStop(0.5, shineFactor > 0.65 ? edgeGleam : `rgba(${Math.round(r * 0.85)}, ${Math.round(g * 0.85)}, ${Math.round(b * 0.85)}, ${p.opacity})`);
        grad.addColorStop(1, `rgba(${Math.round(r * 0.6)}, ${Math.round(g * 0.6)}, ${Math.round(b * 0.6)}, ${p.opacity})`);

        currentCtx.fillStyle = grad;
        currentCtx.beginPath();
        
        // Draw the transformed polygon slip
        const halfW = (p.sizeX / 2) * scaleX;
        const halfH = (p.sizeY / 2) * scaleY;
        
        currentCtx.moveTo(-halfW, -halfH);
        currentCtx.lineTo(halfW, -halfH);
        currentCtx.lineTo(halfW, halfH);
        currentCtx.lineTo(-halfW, halfH);
        currentCtx.closePath();
        currentCtx.fill();
        currentCtx.restore();
      }

      if (particles.length > 0) {
        animationFrameIdRef.current = requestAnimationFrame(tick);
      }
    };

    animationFrameIdRef.current = requestAnimationFrame(tick);

    return () => {
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
      }
    };
  }, [isExploded, clickCoords]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none z-40 overflow-hidden"
    />
  );
}
