import { useEffect, useRef } from 'react';

const DESKTOP_SETTINGS = {
  density: 0.000085,
  minPoints: 22,
  maxPoints: 58,
  linkDistance: 136,
  speedScale: 1,
  pixelRatioCap: 1.5,
  frameInterval: 32,
};

const MOBILE_SETTINGS = {
  density: 0.00005,
  minPoints: 12,
  maxPoints: 34,
  linkDistance: 108,
  speedScale: 0.75,
  pixelRatioCap: 1.2,
  frameInterval: 42,
};

const LOW_END_SETTINGS = {
  density: 0.000032,
  minPoints: 9,
  maxPoints: 20,
  linkDistance: 94,
  speedScale: 0.55,
  pixelRatioCap: 1,
  frameInterval: 55,
};

function supportsReducedMotion() {
  return typeof window !== 'undefined'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;
}

function getSettings() {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return { enabled: false, ...MOBILE_SETTINGS };
  }

  const prefersReducedMotion = supportsReducedMotion();
  const isMobileViewport = window.matchMedia('(max-width: 768px)').matches;
  const isCoarsePointer = window.matchMedia('(pointer: coarse)').matches;

  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  const saveData = Boolean(connection?.saveData);
  const memory = navigator.deviceMemory ?? 4;
  const cores = navigator.hardwareConcurrency ?? 4;
  const veryLowEnd = memory <= 1 || cores <= 2;

  if (prefersReducedMotion) {
    return { enabled: false, ...MOBILE_SETTINGS };
  }

  if (saveData || veryLowEnd) {
    return { enabled: true, ...LOW_END_SETTINGS };
  }

  const constrained = isMobileViewport || isCoarsePointer || memory <= 2 || cores <= 4;
  return {
    enabled: true,
    ...(constrained ? MOBILE_SETTINGS : DESKTOP_SETTINGS),
  };
}

function createPoint(width, height, speedScale) {
  const angle = Math.random() * Math.PI * 2;
  const velocity = (Math.random() * 0.05 + 0.025) * speedScale;

  return {
    x: Math.random() * width,
    y: Math.random() * height,
    vx: Math.cos(angle) * velocity,
    vy: Math.sin(angle) * velocity,
    radius: Math.random() * 1.2 + 0.6,
    opacity: Math.random() * 0.1 + 0.1,
  };
}

function CommunityHeroConstellation() {
  const canvasRef = useRef(null);
  const animationFrameRef = useRef(null);
  const pointsRef = useRef([]);
  const settingsRef = useRef(getSettings());
  const lastTimestampRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return undefined;

    const motionMediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const viewportMediaQuery = window.matchMedia('(max-width: 768px)');
    const pointerMediaQuery = window.matchMedia('(pointer: coarse)');
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;

    const stopAnimation = () => {
      if (animationFrameRef.current) {
        window.cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      lastTimestampRef.current = 0;
    };

    const seedPoints = (width, height) => {
      const settings = settingsRef.current;
      const area = width * height;
      const pointCount = settings.enabled
        ? Math.min(settings.maxPoints, Math.max(settings.minPoints, Math.floor(area * settings.density)))
        : 0;

      pointsRef.current = Array.from({ length: pointCount }, () =>
        createPoint(width, height, settings.speedScale)
      );
    };

    const resizeCanvas = () => {
      const settings = settingsRef.current;
      const rect = canvas.getBoundingClientRect();
      const width = Math.max(rect.width, 1);
      const height = Math.max(rect.height, 1);
      const dpr = Math.min(window.devicePixelRatio || 1, settings.pixelRatioCap);

      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      seedPoints(width, height);
    };

    const drawFrame = (timestamp) => {
      const settings = settingsRef.current;
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      const points = pointsRef.current;

      if (!settings.enabled || width <= 0 || height <= 0 || points.length === 0) {
        ctx.clearRect(0, 0, width, height);
        stopAnimation();
        return;
      }

      if (lastTimestampRef.current === 0) {
        lastTimestampRef.current = timestamp;
        animationFrameRef.current = window.requestAnimationFrame(drawFrame);
        return;
      }

      const delta = timestamp - lastTimestampRef.current;
      if (delta < settings.frameInterval) {
        animationFrameRef.current = window.requestAnimationFrame(drawFrame);
        return;
      }

      const clampedDelta = Math.min(80, delta);
      lastTimestampRef.current = timestamp;

      ctx.clearRect(0, 0, width, height);

      for (let i = 0; i < points.length; i += 1) {
        const point = points[i];

        point.x += point.vx * (clampedDelta / 16.67);
        point.y += point.vy * (clampedDelta / 16.67);

        if (point.x < 0 || point.x > width) point.vx *= -1;
        if (point.y < 0 || point.y > height) point.vy *= -1;
      }

      const maxDistance = settings.linkDistance;
      const maxDistanceSq = maxDistance * maxDistance;

      for (let i = 0; i < points.length; i += 1) {
        const from = points[i];
        for (let j = i + 1; j < points.length; j += 1) {
          const to = points[j];
          const dx = from.x - to.x;
          const dy = from.y - to.y;
          const distanceSq = dx * dx + dy * dy;

          if (distanceSq > maxDistanceSq) continue;

          const distance = Math.sqrt(distanceSq);
          const alpha = (1 - distance / maxDistance) * 0.18;

          ctx.beginPath();
          ctx.moveTo(from.x, from.y);
          ctx.lineTo(to.x, to.y);
          ctx.lineWidth = 0.7;
          ctx.strokeStyle = `rgba(107, 114, 128, ${alpha.toFixed(3)})`;
          ctx.stroke();
        }
      }

      for (let i = 0; i < points.length; i += 1) {
        const point = points[i];
        ctx.beginPath();
        ctx.arc(point.x, point.y, point.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(115, 115, 115, ${point.opacity.toFixed(3)})`;
        ctx.fill();
      }

      animationFrameRef.current = window.requestAnimationFrame(drawFrame);
    };

    const startAnimationIfNeeded = () => {
      if (!settingsRef.current.enabled || animationFrameRef.current) return;
      animationFrameRef.current = window.requestAnimationFrame(drawFrame);
    };

    const updateEnvironment = () => {
      settingsRef.current = getSettings();
      resizeCanvas();

      if (settingsRef.current.enabled) {
        startAnimationIfNeeded();
      } else {
        const width = canvas.clientWidth;
        const height = canvas.clientHeight;
        ctx.clearRect(0, 0, width, height);
        stopAnimation();
      }
    };

    const resizeObserver =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => {
            resizeCanvas();
          })
        : null;

    resizeObserver?.observe(canvas);

    const onChange = () => {
      updateEnvironment();
    };

    const mediaQueries = [motionMediaQuery, viewportMediaQuery, pointerMediaQuery];
    mediaQueries.forEach((query) => {
      if (typeof query.addEventListener === 'function') {
        query.addEventListener('change', onChange);
      } else {
        query.addListener(onChange);
      }
    });

    connection?.addEventListener?.('change', onChange);
    window.addEventListener('resize', onChange);

    updateEnvironment();

    return () => {
      stopAnimation();
      resizeObserver?.disconnect();
      window.removeEventListener('resize', onChange);
      connection?.removeEventListener?.('change', onChange);

      mediaQueries.forEach((query) => {
        if (typeof query.removeEventListener === 'function') {
          query.removeEventListener('change', onChange);
        } else {
          query.removeListener(onChange);
        }
      });
    };
  }, []);

  return <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true" />;
}

export default CommunityHeroConstellation;
