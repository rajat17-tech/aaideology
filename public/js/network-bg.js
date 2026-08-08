/* ============================================================
   AAIDEOLOGY — Live Network Background
   Fixed, full-screen canvas behind every section. Soft glowing
   nodes drift slowly, curved/straight connection lines form and
   dissolve between nearby nodes, and small pulses travel along
   the lines like data packets. Reacts subtly to mouse + scroll.
   Runs continuously (rAF), pausing only when the tab is hidden.
   ============================================================ */
(function () {
  const canvas = document.getElementById('networkBg');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;

  // ---------------- Theme palette ----------------
  // Darkened vs. the original palette so the dots/lines read as clearly
  // visible marks against the light canvas background, rather than a
  // faint glow.
  const palette = isDark
    ? {
        node: 'rgba(110, 130, 235, OPA)',
        nodeCore: 'rgba(190, 198, 245, OPA)',
        line: 'rgba(90, 100, 220, OPA)',
        pulse: 'rgba(160, 140, 235, OPA)'
      }
    : {
        node: 'rgba(35, 28, 120, OPA)',
        nodeCore: 'rgba(12, 8, 56, OPA)',
        line: 'rgba(40, 32, 150, OPA)',
        pulse: 'rgba(80, 22, 170, OPA)'
      };

  function withOpacity(tpl, opacity) {
    return tpl.replace('OPA', opacity.toFixed(3));
  }

  // ---------------- State ----------------
  let width = 0, height = 0, dpr = 1;
  let nodes = [];
  let pulses = [];
  let clusters = [];
  let mouseX = 0, mouseY = 0; // normalized -1..1
  let targetParallaxX = 0, targetParallaxY = 0;
  let parallaxX = 0, parallaxY = 0;
  let scrollParallax = 0;
  let lastScrollY = window.scrollY || 0;
  let running = true;
  let lastTime = 0;

  const MAX_DIST = 170;          // connection distance threshold (scaled below)
  const PULSE_SPAWN_CHANCE = 0.03; // per-frame chance to spawn a new pulse

  function nodeCountFor(w, h) {
    const area = w * h;
    const density = window.innerWidth < 700 ? 16000 : 11000;
    let count = Math.round(area / density);
    const min = window.innerWidth < 700 ? 45 : 90;
    const max = window.innerWidth < 700 ? 90 : 220;
    return Math.max(min, Math.min(max, count));
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    createNodes();
  }

  function createNodes() {
    const count = nodeCountFor(width, height);
    nodes = new Array(count).fill(0).map(() => {
      const speed = 0.22 + Math.random() * 0.34; // clearly drifting, still unhurried
      const angle = Math.random() * Math.PI * 2;
      return {
        x: Math.random() * width,
        y: Math.random() * height,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        r: 1.1 + Math.random() * 1.6,
        pulse: Math.random() * Math.PI * 2, // for gentle size/opacity breathing
        pulseSpeed: 0.4 + Math.random() * 0.5
      };
    });
    pulses = [];
    clusters = [];
  }

  // Occasionally form a soft "cluster" — an invisible attractor that
  // gently pulls a few nearby nodes together, then releases them.
  function maybeSpawnCluster() {
    if (clusters.length >= 2 || Math.random() > 0.004) return;
    clusters.push({
      x: Math.random() * width,
      y: Math.random() * height,
      life: 0,
      maxLife: 260 + Math.random() * 200,
      strength: 0.004 + Math.random() * 0.004
    });
  }

  function updateClusters() {
    clusters.forEach(c => { c.life++; });
    clusters = clusters.filter(c => c.life < c.maxLife);
  }

  function spawnPulse(a, b) {
    pulses.push({ a, b, t: 0, speed: 0.012 + Math.random() * 0.016, curve: (Math.random() - 0.5) * 0.35 });
  }

  function update(dt) {
    maybeSpawnCluster();
    updateClusters();

    for (const n of nodes) {
      n.x += n.vx * dt;
      n.y += n.vy * dt;
      n.pulse += n.pulseSpeed * 0.02 * dt;

      // gentle attraction toward any active cluster
      for (const c of clusters) {
        const dx = c.x - n.x, dy = c.y - n.y;
        const dist = Math.hypot(dx, dy) || 1;
        if (dist < 260) {
          const fade = 1 - c.life / c.maxLife;
          n.x += (dx / dist) * c.strength * fade * dt;
          n.y += (dy / dist) * c.strength * fade * dt;
        }
      }

      // wrap around edges seamlessly — motion never stops or resets
      if (n.x < -20) n.x = width + 20;
      if (n.x > width + 20) n.x = -20;
      if (n.y < -20) n.y = height + 20;
      if (n.y > height + 20) n.y = -20;
    }

    // advance pulses, drop finished ones
    pulses.forEach(p => { p.t += p.speed * dt; });
    pulses = pulses.filter(p => p.t < 1);

    // parallax easing (mouse + scroll)
    parallaxX += (targetParallaxX - parallaxX) * 0.04;
    parallaxY += (targetParallaxY - parallaxY) * 0.04;
  }

  function curvedPoint(ax, ay, bx, by, curve, t) {
    const mx = (ax + bx) / 2 - (by - ay) * curve;
    const my = (ay + by) / 2 + (bx - ax) * curve;
    const u = 1 - t;
    const x = u * u * ax + 2 * u * t * mx + t * t * bx;
    const y = u * u * ay + 2 * u * t * my + t * t * by;
    return [x, y];
  }

  function draw() {
    ctx.clearRect(0, 0, width, height);
    ctx.save();
    ctx.translate(parallaxX + scrollParallax * 0.4, parallaxY + scrollParallax * 0.15);

    const maxDist = window.innerWidth < 700 ? MAX_DIST * 0.8 : MAX_DIST;
    const cx = width / 2, cy = height / 2;
    const depthRadius = Math.max(width, height) * 0.55;

    // ---- connections ----
    for (let i = 0; i < nodes.length; i++) {
      const a = nodes[i];
      for (let j = i + 1; j < nodes.length; j++) {
        const b = nodes[j];
        const dx = a.x - b.x, dy = a.y - b.y;
        const dist = Math.hypot(dx, dy);
        if (dist > maxDist) continue;

        // subtle extra density/brightness near the viewport center for depth
        const midX = (a.x + b.x) / 2, midY = (a.y + b.y) / 2;
        const distFromCenter = Math.hypot(midX - cx, midY - cy);
        const depthBoost = 1 - Math.min(1, distFromCenter / depthRadius) * 0.35;

        const opacity = (1 - dist / maxDist) * 0.5 * depthBoost;
        if (opacity < 0.008) continue;

        ctx.strokeStyle = withOpacity(palette.line, opacity);
        ctx.lineWidth = 1.3;

        // mix of straight and gently curved connections
        const useCurve = (i + j) % 5 === 0;
        ctx.beginPath();
        if (useCurve) {
          const curve = 0.06 * (((i * 7 + j) % 5) - 2);
          const [mx, my] = curvedPoint(a.x, a.y, b.x, b.y, curve, 0.5);
          ctx.moveTo(a.x, a.y);
          ctx.quadraticCurveTo(mx, my, b.x, b.y);
        } else {
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
        }
        ctx.stroke();

        // occasionally seed a data-packet pulse on a currently-drawn edge
        if (opacity > 0.06 && Math.random() < PULSE_SPAWN_CHANCE / nodes.length) {
          spawnPulse(a, b);
        }
      }
    }

    // ---- traveling pulses (data packets) ----
    for (const p of pulses) {
      const dx = p.a.x - p.b.x, dy = p.a.y - p.b.y;
      const dist = Math.hypot(dx, dy);
      if (dist > maxDist * 1.4) continue; // nodes drifted apart, let it fade out naturally
      const [x, y] = curvedPoint(p.a.x, p.a.y, p.b.x, p.b.y, p.curve, p.t);
      const fade = Math.sin(Math.PI * p.t); // fade in/out along the path
      ctx.beginPath();
      ctx.fillStyle = withOpacity(palette.pulse, 0.85 * fade);
      ctx.arc(x, y, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }

    // ---- nodes ----
    for (const n of nodes) {
      const breathe = 0.75 + Math.sin(n.pulse) * 0.25;
      const midX = n.x, midY = n.y;
      const distFromCenter = Math.hypot(midX - cx, midY - cy);
      const depthBoost = 1 - Math.min(1, distFromCenter / depthRadius) * 0.3;

      const glowR = n.r * 5.2 * breathe;
      const grad = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, glowR);
      grad.addColorStop(0, withOpacity(palette.node, 0.65 * breathe * depthBoost));
      grad.addColorStop(1, withOpacity(palette.node, 0));
      ctx.beginPath();
      ctx.fillStyle = grad;
      ctx.arc(n.x, n.y, glowR, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.fillStyle = withOpacity(palette.nodeCore, 1 * breathe * depthBoost);
      ctx.arc(n.x, n.y, n.r * breathe, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  function loop(ts) {
    if (!running) return;
    if (!lastTime) lastTime = ts;
    let dt = (ts - lastTime) / 16.67; // normalize to ~60fps steps
    dt = Math.min(dt, 3); // clamp so a slow/backgrounded tab doesn't jump
    lastTime = ts;

    if (!prefersReducedMotion) update(dt);
    draw();
    requestAnimationFrame(loop);
  }

  // ---------------- Parallax input ----------------
  window.addEventListener('mousemove', (e) => {
    targetParallaxX = ((e.clientX / width) - 0.5) * 18;
    targetParallaxY = ((e.clientY / height) - 0.5) * 18;
  }, { passive: true });

  window.addEventListener('scroll', () => {
    const y = window.scrollY || 0;
    scrollParallax += (y - lastScrollY) * 0.02;
    scrollParallax = Math.max(-40, Math.min(40, scrollParallax));
    lastScrollY = y;
  }, { passive: true });

  window.addEventListener('resize', resize);

  document.addEventListener('visibilitychange', () => {
    running = !document.hidden;
    if (running) { lastTime = 0; requestAnimationFrame(loop); }
  });

  resize();
  requestAnimationFrame(loop);
})();
