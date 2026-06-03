import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

interface NeonBlobsCanvasProps {
  isExploded: boolean;
  clickCoords: { x: number; y: number } | null;
  onExplosionComplete: () => void;
  fadeProgress: number; // Transition black-out amount [0..1]
}

interface PhysicalBubble {
  id: number;
  x: number; // Viewport pixel space
  y: number; // Viewport pixel space
  radius: number; // Current physical size
  targetRadius: number; // Intended scale size
  vx: number;
  vy: number;
  life: number; // Time elapsed
  growthSpeed: number;
  hueOffset: number; // Dynamic iridescence shader phase [0..1]
  isExplosion?: boolean; // Marks rapid particle blast on click
}

/**
 * High-End Custom WebGL Shader Suite for Noëlla Bible Portfolio
 * 
 * Renders:
 * 1. Procedural luxury black satin folds inspired by SITE.jpg (glistening silk drapes)
 * 2. Offscreen typography input as a real-time reactive distortion channel
 * 3. Physical glass bubbles with thin-film iridescence (pink, orange/gold, cyan, violet) and 3D specular highlight dots 
 * 4. Realistic lens distortion/refraction on text elements passing underneath
 */
const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position, 1.0);
  }
`;

const fragmentShader = `
  uniform float uTime;
  uniform vec2 uMouse;
  uniform vec2 uResolution;
  uniform float uTransitionProgress;
  uniform sampler2D uTextTexture;
  
  // Pack up to 72 active bubbles inside uniform arrays for fast parallel GPU calculation
  uniform vec4 uBubbles[72]; // xy = center (0..1 UV), z = radius (normalized), w = hue/life tracker
  uniform int uBubbleCount;

  varying vec2 vUv;

  void main() {
    // Normalise viewport coordinates accounting for aspect ratio
    vec2 aspectVec = vec2(uResolution.x / uResolution.y, 1.0);
    vec2 p = vUv * aspectVec;
    vec2 m = uMouse * aspectVec;

    // --- Part 1: Procedural Glossy Black Silk Cloth Background (SITE.jpg tribute) ---
    // Multi-frequency wave calculation produces rich, complex diagonal folds
    float diag1 = (vUv.x * 0.7 + vUv.y * 0.7);
    float diag2 = (vUv.x * -0.4 + vUv.y * 0.9);
    
    // Slow fluid wave deformation over time
    float clothWave = sin(diag1 * 4.2 - uTime * 0.28) * 0.08
                    + cos(diag2 * 6.0 + uTime * 0.18) * 0.04
                    + sin(vUv.x * 12.0 - vUv.y * 8.0) * 0.005;

    float foldCoord = diag1 * 2.8 + clothWave;
    float foldDensity = sin(foldCoord * 3.14159) * 0.5 + 0.5;
    foldDensity = pow(foldDensity, 2.8); // Sharpen the fold creases

    // Deep luxury dark tones
    vec3 deepShadow = vec3(0.005, 0.005, 0.006);
    vec3 midTone = vec3(0.05, 0.052, 0.06);
    vec3 lightTone = vec3(0.24, 0.25, 0.28); // Glossy satin specular shine
    
    // Smooth interpolation for physical draping look
    vec3 backgroundSatin = mix(deepShadow, midTone, foldDensity);
    
    // Highlights mapping along high-gradient crease peaks
    float creaseSpecular = cos(foldCoord * 3.14159) * 0.5 + 0.5;
    backgroundSatin += lightTone * pow(creaseSpecular, 18.0) * 0.35;

    // Add soft luxury vignette framing
    float vign = vUv.x * (1.0 - vUv.x) * vUv.y * (1.0 - vUv.y) * 16.0;
    vign = mix(0.12, 1.0, pow(vign, 0.25));
    backgroundSatin *= vign;

    // --- Part 2: Glass Bubble Physical Refraction & Lens Distortion ---
    vec2 distortedUv = vUv;
    vec3 bubbleReflections = vec3(0.0);
    float accumulatedMask = 0.0;

    // Multi-pass bubble refraction loop on GPU
    for (int i = 0; i < 72; i++) {
      if (i >= uBubbleCount) break;

      vec4 b = uBubbles[i];
      vec2 bCenter = b.xy * aspectVec;
      float bRadius = b.z;
      float bPhase = b.w; // Unique hue phase & life progress

      float dist = distance(p, bCenter);

      if (dist < bRadius) {
        // Pixel is inside the physical bubble boundary. Calculate 3D sphere normals
        vec2 delta = (p - bCenter) / bRadius;
        float zSquare = 1.0 - dot(delta, delta);

        if (zSquare > 0.0) {
          float z = sqrt(zSquare);
          vec3 sphereNormal = normalize(vec3(delta, z));

          // Physical light refraction coordinates displacement (Lens magnification)
          // Refraction index warping pushes texture pixels towards the lens boundary
          float refractionDepth = 0.14 * (1.0 - z); // Higher refraction at outer bubble edge
          distortedUv -= sphereNormal.xy * refractionDepth;

          // Compute thin-film interference glaze (Iridescence glow)
          // Standard Fresnel calculation is high near outer rims and zero at direct normal center
          float fresnelRim = pow(1.0 - z, 2.2);

          // Highly stylized neon color spectrum from Screenshot reference:
          // Combines high-octane pink, electric cyan, vibrant orange/gold and violet 
          float rainbowAngle = atan(delta.y, delta.x) + bPhase * 3.14;
          
          vec3 neonPink = vec3(1.0, 0.05, 0.56);
          vec3 neonCyan = vec3(0.01, 0.88, 1.0);
          vec3 neonGold = vec3(1.0, 0.73, 0.01);
          vec3 neonPurple = vec3(0.68, 0.08, 1.0);

          vec3 baseRainbow = mix(neonPink, neonCyan, sin(rainbowAngle)*0.5+0.5);
          baseRainbow = mix(baseRainbow, neonGold, cos(rainbowAngle + 1.5)*0.5+0.5);
          baseRainbow = mix(baseRainbow, neonPurple, sin(rainbowAngle * 2.0)*0.5+0.5);

          // Specular high-gloss sheen highlights (Sun glare dots mimicking real photograph)
          // Light specular source situated top-left
          vec3 specularSrc = normalize(vec3(-0.4, 0.5, 0.8));
          float physicalGloss = pow(max(dot(sphereNormal, specularSrc), 0.0), 40.0);
          vec3 glossDot = vec3(1.0) * physicalGloss * 1.5;

          // Second ambient light highlight for organic glisten
          float ambientGloss = pow(max(dot(sphereNormal, vec3(0.3, -0.4, 0.5)), 0.0), 12.0);
          vec3 secondaryReflect = vec3(0.85, 0.95, 1.0) * ambientGloss * 0.35;

          // Apply gorgeous rim styling and shadows to simulate soap-film thickness
          vec3 bubbleBodyGlow = baseRainbow * fresnelRim * 1.7;
          float boundaryShadow = smoothstep(bRadius, bRadius - 0.025, dist);

          // Superimpose glossy glare
          vec3 finalBubblePlate = (bubbleBodyGlow + glossDot + secondaryReflect) * boundaryShadow;

          bubbleReflections += finalBubblePlate;
          accumulatedMask = max(accumulatedMask, (0.08 + fresnelRim * 0.78) * boundaryShadow);
        }
      }
    }

    // --- Part 3: Render Composited Scene ---
    // Capture background satin drape at (potentially) distorted refractive coordinates
    // If a bubble floats on top, the draping background also distorts! Highly photorealistic!
    float bgDiag1 = (distortedUv.x * 0.7 + distortedUv.y * 0.7);
    float bgDiag2 = (distortedUv.x * -0.4 + distortedUv.y * 0.9);
    float bgClothWave = sin(bgDiag1 * 4.2 - uTime * 0.28) * 0.08
                      + cos(bgDiag2 * 6.0 + uTime * 0.18) * 0.04
                      + sin(distortedUv.x * 12.0 - distortedUv.y * 8.0) * 0.005;
    float bgFoldCoord = bgDiag1 * 2.8 + bgClothWave;
    float bgFoldDensity = sin(bgFoldCoord * 3.14159) * 0.5 + 0.5;
    bgFoldDensity = pow(bgFoldDensity, 2.8);
    vec3 compositedBg = mix(deepShadow, midTone, bgFoldDensity);
    compositedBg += lightTone * pow(cos(bgFoldCoord * 3.14159) * 0.5 + 0.5, 18.0) * 0.35;
    
    // Apply vignette
    float bgVign = distortedUv.x * (1.0 - distortedUv.x) * distortedUv.y * (1.0 - distortedUv.y) * 16.0;
    bgVign = mix(0.12, 1.0, pow(bgVign, 0.25));
    compositedBg *= bgVign;

    // Fetch the offscreen typed layout using distorted text UV coords to make real lens warping!
    vec4 typographySample = texture2D(uTextTexture, distortedUv);
    
    // Core composite blend
    vec3 compositeColor = mix(compositedBg, vec3(1.0), typographySample.a * typographySample.rgb);
    
    // Lay bubble gloss plate on top
    compositeColor = mix(compositeColor, compositeColor + bubbleReflections, accumulatedMask);

    // Fade entire landscape to complete solid black on trigger
    vec3 solidBlack = vec3(0.0);
    vec3 finalDisplay = mix(compositeColor, solidBlack, uTransitionProgress);

    gl_FragColor = vec4(finalDisplay, 1.0);
  }
`;

export default function NeonBlobsCanvas({
  isExploded,
  clickCoords,
  onExplosionComplete,
  fadeProgress,
}: NeonBlobsCanvasProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const offscreenTextCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Maintain active physics bubble array ref
  const bubblesRef = useRef<PhysicalBubble[]>([]);
  const bubbleIdCounterRef = useRef<number>(0);

  const sceneRef = useRef<{
    renderer: THREE.WebGLRenderer;
    material: THREE.ShaderMaterial;
    textTexture: THREE.CanvasTexture;
    animationFrameId: number;
  } | null>(null);

  // Track page loaded timestamp for bubble counts incrementation over time
  const pageLoadedTimeRef = useRef<number>(Date.now());

  // Mouse trajectory and cursor speed tracker
  const mouseRef = useRef({
    x: 0.5 * window.innerWidth,
    y: 0.5 * window.innerHeight,
    prevX: 0.5 * window.innerWidth,
    prevY: 0.5 * window.innerHeight,
    glX: 0,
    glY: 0,
    trailTimer: 0,
    lastSpawnTime: 0,
    isActive: false,
  });

  // Track resizing so that we resize the offscreen text canvas instantly
  useEffect(() => {
    const textCanvas = document.createElement('canvas');
    textCanvas.width = window.innerWidth;
    textCanvas.height = window.innerHeight;
    offscreenTextCanvasRef.current = textCanvas;

    const handleResize = () => {
      if (offscreenTextCanvasRef.current) {
        offscreenTextCanvasRef.current.width = window.innerWidth;
        offscreenTextCanvasRef.current.height = window.innerHeight;
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Set up mouse events to trace trail bubbles
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const m = mouseRef.current;
      m.prevX = m.x;
      m.prevY = m.y;
      m.x = e.clientX;
      m.y = e.clientY;
      m.isActive = true;

      // Normalise relative cursor coordinates for standard WebGL uniform vector
      m.glX = (e.clientX / window.innerWidth);
      m.glY = 1.0 - (e.clientY / window.innerHeight);

      // Trailing bubble emission calculation based on speed and distance traversed
      const dx = m.x - m.prevX;
      const dy = m.y - m.prevY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const now = Date.now();

      // Emit trail bubble only if cursor moves sufficiently far or at discrete intervals
      if (dist > 4 && now - m.lastSpawnTime > 40 && !isExploded) {
        // Spawn glossy bubble centered on cursor
        const headingAngle = Math.atan2(dy, dx);
        
        // Eject trail bubble in slightly opposing direction for organic trailing feel
        const scatterSpeed = 0.3 + Math.random() * 0.8;
        const scatterAngle = headingAngle + Math.PI + (Math.random() - 0.5) * 1.2;

        const baseRadius = 25 + Math.random() * 32;

        bubblesRef.current.push({
          id: bubbleIdCounterRef.current++,
          x: m.x,
          y: m.y,
          radius: 3.0, // Instantly start tiny and scale up smoothly
          targetRadius: baseRadius,
          vx: Math.cos(scatterAngle) * scatterSpeed + (Math.random() - 0.5) * 0.2,
          vy: Math.sin(scatterAngle) * scatterSpeed - (0.15 + Math.random() * 0.45), // Soft buoyant rise
          life: 0,
          growthSpeed: 0.12 + Math.random() * 0.12,
          hueOffset: Math.random(),
        });

        m.lastSpawnTime = now;
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [isExploded]);

  // Explosive text evaporation burst handler
  useEffect(() => {
    if (isExploded && clickCoords) {
      // Rapid-fire spawn a dense cloud of 180 bubble units around the text arena
      const count = window.innerWidth < 768 ? 90 : 160;
      const w = window.innerWidth;
      const h = window.innerHeight;

      // Create a burst radiating from the exact click coords and middle of screen
      for (let i = 0; i < count; i++) {
        const theta = Math.random() * Math.PI * 2;
        // Moderate blast speed velocity
        const velocityMagnitude = 3 + Math.random() * 10;

        bubblesRef.current.push({
          id: bubbleIdCounterRef.current++,
          // Disperse scatter coordinates around text cluster area
          x: clickCoords.x + (Math.random() - 0.5) * 450,
          y: clickCoords.y + (Math.random() - 0.5) * 120,
          radius: 4.0,
          targetRadius: 40 + Math.random() * 70, // Massive sizes to completely obscure screen
          vx: Math.cos(theta) * velocityMagnitude,
          vy: Math.sin(theta) * velocityMagnitude - 1, // buoyant updraft
          life: 0,
          growthSpeed: 0.15 + Math.random() * 0.15,
          hueOffset: Math.random(),
          isExplosion: true,
        });
      }
    }
  }, [isExploded, clickCoords]);

  // Main Loop, Physics Engine and WebGL binding
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    // Set up offscreen typography texture rendering pipeline
    const textCanvas = offscreenTextCanvasRef.current!;
    const textTexture = new THREE.CanvasTexture(textCanvas);
    textTexture.minFilter = THREE.LinearFilter;
    textTexture.magFilter = THREE.LinearFilter;

    // Full screen clip quad
    const geometry = new THREE.PlaneGeometry(2, 2);

    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uMouse: { value: new THREE.Vector2(0.5, 0.5) },
        uResolution: { value: new THREE.Vector2(width, height) },
        uTransitionProgress: { value: 0 },
        uTextTexture: { value: textTexture },
        uBubbles: { value: new Array(72).fill(new THREE.Vector4(0, 0, 0, 0)) },
        uBubbleCount: { value: 0 },
      },
      depthWrite: false,
    });

    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    // Initial typography render
    drawOffscreenTypography(textCanvas, isExploded ? 0 : 1);
    textTexture.needsUpdate = true;

    const handleWindowResize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      renderer.setSize(w, h);
      material.uniforms.uResolution.value.set(w, h);
      
      if (offscreenTextCanvasRef.current) {
        drawOffscreenTypography(offscreenTextCanvasRef.current, isExploded ? 0 : 1);
        textTexture.needsUpdate = true;
      }
    };

    window.addEventListener('resize', handleWindowResize);

    let lastTime = Date.now();
    let timeAccumulator = 0;
    let frameCount = 0;

    // Tick Renderer and Physics Engine at 60 FPS
    const tick = () => {
      const now = Date.now();
      const deltaSec = Math.min((now - lastTime) / 1000, 0.1); // Guard against giant frame skips
      lastTime = now;
      timeAccumulator += deltaSec;
      frameCount++;

      const w = window.innerWidth;
      const h = window.innerHeight;

      // --- Part B: Bubble Physics calculations (Damping, Friction, Walls bouncing & Clustering) ---
      const activeBubbles = bubblesRef.current;
      
      // Perform O(N^2) pairwise cohesive clustering and soft repulsion
      for (let i = 0; i < activeBubbles.length; i++) {
        const b1 = activeBubbles[i];
        
        // Gentle organic wind / float fluctuation
        b1.life += deltaSec;
        b1.vy += Math.sin(b1.life * 1.3 + b1.id) * 0.01 - 0.008; // Sluggish hover buoyancy
        b1.vx += Math.cos(b1.life * 0.8 + b1.id) * 0.006; // Calm sideways breeze

        // Inter-bubble collisions & organic attraction
        for (let j = i + 1; j < activeBubbles.length; j++) {
          const b2 = activeBubbles[j];
          const dx = b2.x - b1.x;
          const dy = b2.y - b1.y;
          const distanceVal = Math.sqrt(dx * dx + dy * dy);
          const minSeparation = b1.radius + b2.radius;

          if (distanceVal < minSeparation) {
            // Calculate overlap and push apart slightly (soft collision elasticity)
            const overlap = minSeparation - distanceVal;
            const overlapRatio = overlap / minSeparation;
            
            // Push vector
            const normX = dx / (distanceVal || 1);
            const normY = dy / (distanceVal || 1);

            // Apply soft repulsive tension to clustering groups
            const complianceForce = isExploded ? 0.35 : 0.08;
            b1.vx -= normX * overlap * complianceForce;
            b1.vy -= normY * overlap * complianceForce;
            b2.vx += normX * overlap * complianceForce;
            b2.vy += normY * overlap * complianceForce;

            // Surface tension cohesion - make them slide/nest alongside each other
            const slideForce = 0.02;
            b1.vx += normY * slideForce;
            b1.vy -= normX * slideForce;
          }
        }

        // Apply physical integration
        b1.x += b1.vx;
        b1.y += b1.vy;

        // Apply visual scale growth interpolation
        if (b1.radius < b1.targetRadius) {
          b1.radius += (b1.targetRadius - b1.radius) * b1.growthSpeed;
        }

        // Apply high fluid air drag
        b1.vx *= isExploded ? 0.94 : 0.975;
        b1.vy *= isExploded ? 0.94 : 0.975;

        // Viewport boundaries bounce with energy loss (prevents leaking out of landscape)
        const bounceFriction = 0.72;
        if (b1.x - b1.radius < 0) {
          b1.x = b1.radius;
          b1.vx = -b1.vx * bounceFriction;
        } else if (b1.x + b1.radius > w) {
          b1.x = w - b1.radius;
          b1.vx = -b1.vx * bounceFriction;
        }

        if (b1.y - b1.radius < -100) {
          // Remove if floated too far out above the viewport, but keep if not exploded
          if (b1.isExplosion) {
            activeBubbles.splice(i, 1);
            i--;
            continue;
          }
        } else if (b1.y + b1.radius > h + 100) {
          // Keep floating inside screen
          if (b1.vy > 0) b1.vy = -b1.vy * bounceFriction;
        }
      }

      // Keep maximum particle count caps to preserve smooth 60fps WebGL execution
      const maxBubbleCap = isExploded ? 180 : 70;
      if (activeBubbles.length > maxBubbleCap) {
        // Discard oldest normal bubble
        const discardIdx = activeBubbles.findIndex(b => !b.isExplosion);
        if (discardIdx !== -1) {
          activeBubbles.splice(discardIdx, 1);
        }
      }

      // --- Part C: Pack the top active bubbles to pass down to GPU Fragment Shader ---
      // Take up to 72 largest bubbles for high-end rendering
      const sortedRenderingBubbles = [...activeBubbles]
        .slice(0, 72);

      const packedUniformArray = new Array(72).fill(null).map((_, i) => {
        if (i < sortedRenderingBubbles.length) {
          const b = sortedRenderingBubbles[i];
          // Normalise coordinates to UV spacing [0..1]
          const normX = b.x / w;
          const normY = 1.0 - (b.y / h); // Flip Y to map to WebGL system
          
          // Calculate aspect ratio corrected radius scale
          const aspectH = h;
          const normRadius = b.radius / aspectH;

          return new THREE.Vector4(normX, normY, normRadius, b.hueOffset + b.life * 0.1);
        }
        return new THREE.Vector4(0, 0, 0, 0);
      });

      // Bind data to uniform arrays
      material.uniforms.uBubbles.value = packedUniformArray;
      material.uniforms.uBubbleCount.value = sortedRenderingBubbles.length;

      // Map dynamic mouse uniform coordinates
      const m = mouseRef.current;
      material.uniforms.uMouse.value.set(m.glX, m.glY);
      material.uniforms.uTime.value = timeAccumulator;
      
      // Update fadeout transition slider
      material.uniforms.uTransitionProgress.value = fadeProgress;

      // Every frame update offscreen canvas if state requires
      if (offscreenTextCanvasRef.current) {
        // Linearly fade typography alpha down as explosion reaches blackout state
        const calculatedAlpha = Math.max(0.0, 1.0 - fadeProgress * 2.8);
        drawOffscreenTypography(offscreenTextCanvasRef.current, calculatedAlpha);
        textTexture.needsUpdate = true;
      }

      // Trigger actual shader compilation pass
      renderer.render(scene, camera);

      // Trigger next animation frame
      sceneRef.current!.animationFrameId = requestAnimationFrame(tick);
    };

    sceneRef.current = {
      renderer,
      material,
      textTexture,
      animationFrameId: requestAnimationFrame(tick),
    };

    return () => {
      window.removeEventListener('resize', handleWindowResize);
      if (sceneRef.current) {
        cancelAnimationFrame(sceneRef.current.animationFrameId);
        sceneRef.current.renderer.dispose();
      }
      geometry.dispose();
      material.dispose();
      textTexture.dispose();
      
      if (container && renderer.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [fadeProgress, isExploded]);

  return (
    <div className="absolute inset-0 w-full h-full pointer-events-none overflow-hidden z-10">
      {/* Absolute 3D GPU Raymarched Satin Glass Lens Refractor Canvas */}
      <div ref={mountRef} className="absolute inset-0 w-full h-full block bg-black pointer-events-auto" />
    </div>
  );
}

/**
 * Offscreen Typography Renderer
 * Renders all page-level texts to canvas, so the shader can warp them instantly using GPU normals.
 */
function drawOffscreenTypography(canvas: HTMLCanvasElement, textAlpha: number) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const w = canvas.width;
  const h = canvas.height;

  // Visual background clear representation
  ctx.clearRect(0, 0, w, h);
  
  if (textAlpha <= 0) return;

  ctx.globalAlpha = textAlpha;

  // Compute responsive dimensions in scale
  const scale = Math.min(w / 1440, 1.25);

  // 1. Minor Typography - TOP: "SAN FRANCISCO I CALIFORNIA" or "San Francisco, CA"
  // Request spec: "In small white Proxima Nova font, placed at the very top center of the page, display 'San Francisco, CA'"
  ctx.fillStyle = '#ffffff';
  ctx.font = `500 ${Math.max(11, Math.round(13 * scale))}px "Montserrat", "Inter", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';

  const topText = "SAN FRANCISCO, CA";
  drawCustomLetterSpacedText(ctx, topText, w / 2, Math.max(25, 45 * scale), 4 * scale, false);

  // 2. Main Title - CENTER: "NOËLLA BIBLE" (white, Bebas Kai/Bebas Neue)
  // Request spec: "Centered on the screen, large text must display 'NOËLLA BIBLE' in a white Bebas Kai font... strong capitalization"
  ctx.fillStyle = '#ffffff';
  const mainFontSize = Math.round(91 * scale);
  ctx.font = `700 ${mainFontSize}px "Bebas Neue", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const mainText = "NOËLLA BIBLE";
  const centerY = h / 2 - 25 * scale;
  ctx.fillText(mainText, w / 2, centerY);

  // 3. Subheading - Directly below: "Creative Direction" in expanded letters and Chartreuse color
  // Request spec: "Directly below the main title, the text 'Creative Direction' must be rendered in expanded (increased letter-spacing) Proxima Nova font, colored chartreuse (#DEF50C)."
  ctx.fillStyle = '#DEF50C';
  ctx.font = `600 ${Math.max(12, Math.round(15 * scale))}px "Montserrat", "Inter", sans-serif`;
  const subText = "CREATIVE DIRECTION";
  // Anchor to bottom boundary of the title
  const subY = centerY + mainFontSize * 0.52 + 10 * scale;
  drawCustomLetterSpacedText(ctx, subText, w / 2, subY, 12 * scale, true);
}

/**
 * Utility function to manually render wide tracking / letter-spaced text on 2D canvas
 */
function drawCustomLetterSpacedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  centerX: number,
  y: number,
  spacing: number,
  forcesUpperCase = false
) {
  const chars = forcesUpperCase ? text.toUpperCase().split('') : text.split('');
  
  // Prerender to establish total metrics
  let totalTextWidth = 0;
  const letterMetrics = chars.map(c => {
    const w = ctx.measureText(c).width;
    totalTextWidth += w;
    return w;
  });

  // Add character spacing gaps
  totalTextWidth += (chars.length - 1) * spacing;

  // Draw characters sequentially
  let startX = centerX - totalTextWidth / 2;
  for (let i = 0; i < chars.length; i++) {
    ctx.fillText(chars[i], startX + letterMetrics[i] / 2, y);
    startX += letterMetrics[i] + spacing;
  }
}
