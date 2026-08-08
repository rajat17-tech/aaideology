/* ============================================================
   BackgroundNetwork.js
   ------------------------------------------------------------
   Live telecommunications-backbone visualization. Not a particle
   field, not connect-the-dots: a hierarchical topology —

     background layer  (faint, decorative, drifting)
     middle layer       (regional node clusters)
     hub layer           (backbone exchange stations)

   Hubs form a backbone mesh. Regional nodes cluster loosely
   around a "home" hub and spoke into it. Glowing packets travel
   continuously across regional links, spokes, and the backbone,
   at different speeds, occasionally branching or vanishing —
   read as live network traffic, not decoration.

   Modern Three.js (r160+), no deprecated APIs, no external
   dependencies beyond Three.js itself. THREE.BufferGeometry for
   every dynamic buffer, THREE.InstancedMesh for hubs, spatial
   hashing for neighbor queries (no O(n^2) per-frame cost).

   USAGE
   ------------------------------------------------------------
   <link rel="stylesheet" href="css/background-network.css">
   <script src="js/BackgroundNetwork.js"></script>
   <div id="bg-network"></div>

   Auto-initializes on DOMContentLoaded against #bg-network
   (creating one and prepending it to <body> if none exists).
   No HTML changes required.

   Manual use:
     const net = new BackgroundNetwork({ container: el });
     net.init();
     // later
     net.destroy();

   NOTE ON THREE.JS LOADING
   ------------------------------------------------------------
   Since r161, three.js ships ES Modules only (no global/UMD
   build). This file loads three.js itself via a dynamic
   import() — which works from a plain, non-module <script> tag
   in every modern browser — so no HTML changes are required. If
   a global `THREE` (r150+) is already present, that is reused.
   ============================================================ */

(function (global) {
  'use strict';

  const THREE_CDN_URL = 'https://unpkg.com/three@0.160.0/build/three.module.js';

  /* ============================================================
     Self-contained 3D Simplex Noise (organic drift — no random
     velocity, no bouncing; nodes wander like drifting galaxies).
     ============================================================ */
  function SimplexNoise(seed) {
    this.perm = new Uint8Array(512);
    this.permMod12 = new Uint8Array(512);
    const p = new Uint8Array(256);

    let s = seed || 1;
    function rand() {
      s |= 0; s = (s + 0x6D2B79F5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }

    for (let i = 0; i < 256; i++) p[i] = i;
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      const tmp = p[i]; p[i] = p[j]; p[j] = tmp;
    }
    for (let i = 0; i < 512; i++) {
      this.perm[i] = p[i & 255];
      this.permMod12[i] = this.perm[i] % 12;
    }

    this.grad3 = new Float32Array([
      1, 1, 0, -1, 1, 0, 1, -1, 0, -1, -1, 0,
      1, 0, 1, -1, 0, 1, 1, 0, -1, -1, 0, -1,
      0, 1, 1, 0, -1, 1, 0, 1, -1, 0, -1, -1
    ]);
  }

  SimplexNoise.prototype.noise3D = function (xin, yin, zin) {
    const grad3 = this.grad3, perm = this.perm, permMod12 = this.permMod12;
    const F3 = 1 / 3, G3 = 1 / 6;
    let n0, n1, n2, n3;

    const s = (xin + yin + zin) * F3;
    const i = Math.floor(xin + s), j = Math.floor(yin + s), k = Math.floor(zin + s);
    const t = (i + j + k) * G3;
    const X0 = i - t, Y0 = j - t, Z0 = k - t;
    const x0 = xin - X0, y0 = yin - Y0, z0 = zin - Z0;

    let i1, j1, k1, i2, j2, k2;
    if (x0 >= y0) {
      if (y0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 1; k2 = 0; }
      else if (x0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 0; k2 = 1; }
      else { i1 = 0; j1 = 0; k1 = 1; i2 = 1; j2 = 0; k2 = 1; }
    } else {
      if (y0 < z0) { i1 = 0; j1 = 0; k1 = 1; i2 = 0; j2 = 1; k2 = 1; }
      else if (x0 < z0) { i1 = 0; j1 = 1; k1 = 0; i2 = 0; j2 = 1; k2 = 1; }
      else { i1 = 0; j1 = 1; k1 = 0; i2 = 1; j2 = 1; k2 = 0; }
    }

    const x1 = x0 - i1 + G3, y1 = y0 - j1 + G3, z1 = z0 - k1 + G3;
    const x2 = x0 - i2 + 2 * G3, y2 = y0 - j2 + 2 * G3, z2 = z0 - k2 + 2 * G3;
    const x3 = x0 - 1 + 3 * G3, y3 = y0 - 1 + 3 * G3, z3 = z0 - 1 + 3 * G3;

    const ii = i & 255, jj = j & 255, kk = k & 255;

    let t0 = 0.6 - x0 * x0 - y0 * y0 - z0 * z0;
    if (t0 < 0) n0 = 0;
    else {
      const gi0 = permMod12[ii + perm[jj + perm[kk]]] * 3;
      t0 *= t0;
      n0 = t0 * t0 * (grad3[gi0] * x0 + grad3[gi0 + 1] * y0 + grad3[gi0 + 2] * z0);
    }

    let t1 = 0.6 - x1 * x1 - y1 * y1 - z1 * z1;
    if (t1 < 0) n1 = 0;
    else {
      const gi1 = permMod12[ii + i1 + perm[jj + j1 + perm[kk + k1]]] * 3;
      t1 *= t1;
      n1 = t1 * t1 * (grad3[gi1] * x1 + grad3[gi1 + 1] * y1 + grad3[gi1 + 2] * z1);
    }

    let t2 = 0.6 - x2 * x2 - y2 * y2 - z2 * z2;
    if (t2 < 0) n2 = 0;
    else {
      const gi2 = permMod12[ii + i2 + perm[jj + j2 + perm[kk + k2]]] * 3;
      t2 *= t2;
      n2 = t2 * t2 * (grad3[gi2] * x2 + grad3[gi2 + 1] * y2 + grad3[gi2 + 2] * z2);
    }

    let t3 = 0.6 - x3 * x3 - y3 * y3 - z3 * z3;
    if (t3 < 0) n3 = 0;
    else {
      const gi3 = permMod12[ii + 1 + perm[jj + 1 + perm[kk + 1]]] * 3;
      t3 *= t3;
      n3 = t3 * t3 * (grad3[gi3] * x3 + grad3[gi3 + 1] * y3 + grad3[gi3 + 2] * z3);
    }

    return 32 * (n0 + n1 + n2 + n3); // ~[-1, 1]
  };

  /* ============================================================
     BackgroundNetwork
     ============================================================ */
  class BackgroundNetwork {
    constructor(options = {}) {
      this.container = options.container || null;

      // Blue-violet backbone palette.
      this.bgColor = options.bgColorTint || 0x9DA8F0;      // faint background nodes
      this.midColors = options.midColors || [0x4F46E5, 0x6366F1, 0x7C3AED, 0x3B82F6];
      this.hubColors = options.hubColors || [0x4F46E5, 0x6D28D9, 0x3B82F6];
      this.backboneColor = options.backboneColor || 0x5B21B6;
      this.backgroundColor = options.backgroundColor !== undefined ? options.backgroundColor : 0xEFEFF4;

      this.maxConnectDist = options.maxConnectDist || 170;  // regional mesh
      this.spokeRadius = options.spokeRadius || 460;        // node -> home hub
      this.mouseRadius = options.mouseRadius || 150;
      this.mouseStrength = options.mouseStrength || 6;
      this.packetSlots = options.packetSlots || 140;

      this._explicitCounts = options.counts || null;

      this._running = false;
      this._destroyed = false;
      this._raf = null;
      this._resizeTimer = null;
      this._clock = null;
      this._mouse = { x: -99999, y: -99999, nx: 0, ny: 0, active: false };
      this._scrollY = global.scrollY || 0;
      this._parallax = { x: 0, y: 0 };
      this._activeEdges = []; // [aIdx, bIdx, tier] sampled each frame for packet spawning

      this._onResize = this._onResize.bind(this);
      this._onMouseMove = this._onMouseMove.bind(this);
      this._onMouseLeave = this._onMouseLeave.bind(this);
      this._onScroll = this._onScroll.bind(this);
      this._onVisibility = this._onVisibility.bind(this);
      this._tick = this._tick.bind(this);
    }

    /* ---------------- responsive node budget ---------------- */
    _computeCounts(w) {
      if (this._explicitCounts) return this._explicitCounts;
      if (w < 560) return { bg: 100, mid: 160, hubs: 12 };   // mobile: 272 total
      if (w < 900) return { bg: 150, mid: 260, hubs: 14 };
      if (w < 1300) return { bg: 220, mid: 380, hubs: 16 };
      if (w < 1800) return { bg: 300, mid: 460, hubs: 18 };  // desktop: 778 total
      return { bg: 340, mid: 520, hubs: 20 };
    }

    /* ============================================================
       Init — synchronous public API, async internal build
       ============================================================ */
    init() {
      if (!this.container) {
        console.error('[BackgroundNetwork] No container element provided.');
        return this;
      }
      if (this.container.__bgNetworkInstance && this.container.__bgNetworkInstance !== this) {
        this.container.__bgNetworkInstance.destroy();
      }
      this.container.__bgNetworkInstance = this;

      this._prepareContainer();

      this._loadThree()
        .then((THREE) => {
          if (this._destroyed) return;
          this.THREE = THREE;
          this._build();
        })
        .catch((err) => console.error('[BackgroundNetwork] Failed to load three.js:', err));

      return this;
    }

    async _loadThree() {
      if (global.THREE && global.THREE.WebGLRenderer) return global.THREE;
      return await import(THREE_CDN_URL);
    }

    _prepareContainer() {
      if (!this.container.classList.contains('bg-network-container')) {
        this.container.classList.add('bg-network-container');
      }
      const cs = global.getComputedStyle(this.container);
      if (cs.position === 'static') this.container.style.position = 'fixed';
      if (cs.top === 'auto') this.container.style.top = '0';
      if (cs.left === 'auto') this.container.style.left = '0';
      if (parseFloat(cs.width) === 0) this.container.style.width = '100vw';
      if (parseFloat(cs.height) === 0) this.container.style.height = '100vh';
    }

    /* ============================================================
       Build
       ============================================================ */
    _build() {
      const THREE = this.THREE;

      this.width = Math.max(1, this.container.clientWidth || global.innerWidth);
      this.height = Math.max(1, this.container.clientHeight || global.innerHeight);
      this.dpr = Math.min(global.devicePixelRatio || 1, 2);
      this.noise = new SimplexNoise(Math.floor(Math.random() * 65536));

      this._setupRenderer(THREE);
      if (!this.renderer) return;

      this._setupScene(THREE);

      const counts = this._computeCounts(this.width);
      this.counts = counts;

      this._createHubs(THREE, counts.hubs);
      this._computeBackbone();
      this._createBackgroundLayer(THREE, counts.bg);
      this._createMiddleLayer(THREE, counts.mid);
      this._assignHomeHubs();
      this._createConnections(THREE);
      this._createPackets(THREE);

      this._bindEvents();

      this._running = true;
      this._clock = new THREE.Clock();
      this._raf = requestAnimationFrame(this._tick);
    }

    _setupRenderer(THREE) {
      try {
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
      } catch (err) {
        console.error('[BackgroundNetwork] WebGL context creation failed:', err);
        this.renderer = null;
        return;
      }
      this.renderer.setPixelRatio(this.dpr);
      this.renderer.setSize(this.width, this.height);
      this.renderer.setClearColor(this.backgroundColor, 1);

      const canvas = this.renderer.domElement;
      canvas.style.display = 'block';
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      canvas.style.outline = 'none';
      this.container.appendChild(canvas);
    }

    _setupScene(THREE) {
      this.scene = new THREE.Scene();
      this.camera = new THREE.OrthographicCamera(0, this.width, 0, this.height, -2000, 2000);
      this.camera.position.z = 1000;

      // Two depth groups for parallax: background drifts less than
      // everything else, so the two layers read as separate depths
      // without connection lines ever detaching from their nodes.
      this.bgGroup = new THREE.Group();
      this.mainGroup = new THREE.Group();
      this.scene.add(this.bgGroup);
      this.scene.add(this.mainGroup);
    }

    /* ============================================================
       Hubs — backbone exchange stations (InstancedMesh halo + core)
       ============================================================ */
    _createHubs(THREE, count) {
      const palette = this.hubColors.map((c) => new THREE.Color(c));
      this.hubs = new Array(count);

      const margin = 80;
      for (let i = 0; i < count; i++) {
        this.hubs[i] = {
          x: margin + Math.random() * (this.width - margin * 2),
          y: margin + Math.random() * (this.height - margin * 2),
          nOffX: Math.random() * 1000,
          nOffY: Math.random() * 1000,
          driftSpeed: 0.000018 + Math.random() * 0.000018, // near-static backbone
          driftScale: 6 + Math.random() * 6,
          phase: Math.random() * Math.PI * 2,
          breatheSpeed: 0.5 + Math.random() * 0.4,
          baseScale: 12 + Math.random() * 8,
          activeUntil: 0,
          activeBoost: 1,
          color: palette[Math.floor(Math.random() * palette.length)]
        };
      }

      const haloGeo = new THREE.CircleGeometry(1, 24);
      const coreGeo = new THREE.CircleGeometry(1, 24);
      const haloMat = new THREE.MeshBasicMaterial({
        vertexColors: true, transparent: true, opacity: 0.22,
        depthWrite: false, side: THREE.DoubleSide
      });
      const coreMat = new THREE.MeshBasicMaterial({
        vertexColors: true, transparent: true, opacity: 1,
        depthWrite: false, side: THREE.DoubleSide
      });

      this.hubHalo = new THREE.InstancedMesh(haloGeo, haloMat, count);
      this.hubCore = new THREE.InstancedMesh(coreGeo, coreMat, count);

      const dummy = new THREE.Object3D();
      for (let i = 0; i < count; i++) {
        const h = this.hubs[i];
        dummy.position.set(h.x, h.y, 5);
        dummy.scale.setScalar(h.baseScale);
        dummy.updateMatrix();
        this.hubCore.setMatrixAt(i, dummy.matrix);
        dummy.scale.setScalar(h.baseScale * 2.4);
        dummy.updateMatrix();
        this.hubHalo.setMatrixAt(i, dummy.matrix);
        this.hubCore.setColorAt(i, h.color);
        this.hubHalo.setColorAt(i, h.color);
      }

      this.mainGroup.add(this.hubHalo);
      this.mainGroup.add(this.hubCore);
    }

    // Static backbone topology: each hub links to its 2 nearest hubs.
    _computeBackbone() {
      const hubs = this.hubs;
      const edgeSet = new Set();
      this.backboneEdges = [];

      for (let i = 0; i < hubs.length; i++) {
        const dists = [];
        for (let j = 0; j < hubs.length; j++) {
          if (i === j) continue;
          const dx = hubs[i].x - hubs[j].x, dy = hubs[i].y - hubs[j].y;
          dists.push([j, dx * dx + dy * dy]);
        }
        dists.sort((a, b) => a[1] - b[1]);
        const k = Math.min(2, dists.length);
        for (let n = 0; n < k; n++) {
          const j = dists[n][0];
          const key = i < j ? i + '_' + j : j + '_' + i;
          if (!edgeSet.has(key)) {
            edgeSet.add(key);
            this.backboneEdges.push([Math.min(i, j), Math.max(i, j)]);
          }
        }
      }
    }

    /* ============================================================
       Background layer — faint, slow, decorative, no connections
       ============================================================ */
    _createBackgroundLayer(THREE, count) {
      this.bgNodes = new Array(count);
      const positions = new Float32Array(count * 3);
      const color = new THREE.Color(this.bgColor);
      const colors = new Float32Array(count * 3);

      for (let i = 0; i < count; i++) {
        const x = Math.random() * this.width;
        const y = Math.random() * this.height;
        this.bgNodes[i] = {
          x, y,
          nOffX: Math.random() * 1000,
          nOffY: Math.random() * 1000,
          driftSpeed: 0.00004 + Math.random() * 0.00004,
          driftScale: 1.6 + Math.random() * 1.6
        };
        positions[i * 3] = x; positions[i * 3 + 1] = y; positions[i * 3 + 2] = -200;
        colors[i * 3] = color.r; colors[i * 3 + 1] = color.g; colors[i * 3 + 2] = color.b;
      }

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

      const material = new THREE.PointsMaterial({
        size: 2.6 * this.dpr, vertexColors: true, transparent: true,
        opacity: 0.55, sizeAttenuation: false, depthWrite: false
      });

      this.bgPoints = new THREE.Points(geometry, material);
      this.bgGroup.add(this.bgPoints);
      this._bgGeometry = geometry;
    }

    /* ============================================================
       Middle layer — the regional mesh
       ============================================================ */
    _createMiddleLayer(THREE, count) {
      const palette = this.midColors.map((c) => new THREE.Color(c));
      this.midNodes = new Array(count);
      const positions = new Float32Array(count * 3);
      const colors = new Float32Array(count * 3);

      for (let i = 0; i < count; i++) {
        const x = Math.random() * this.width;
        const y = Math.random() * this.height;
        const c = palette[Math.floor(Math.random() * palette.length)];
        this.midNodes[i] = {
          x, y,
          nOffX: Math.random() * 1000,
          nOffY: Math.random() * 1000,
          driftSpeed: 0.00007 + Math.random() * 0.00007,
          driftScale: 0.35 + Math.random() * 0.4,
          homeHub: -1
        };
        positions[i * 3] = x; positions[i * 3 + 1] = y; positions[i * 3 + 2] = 0;
        colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
      }

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

      const material = new THREE.PointsMaterial({
        size: 5 * this.dpr, vertexColors: true, transparent: true,
        opacity: 0.95, sizeAttenuation: false, depthWrite: false
      });

      this.midPoints = new THREE.Points(geometry, material);
      this.mainGroup.add(this.midPoints);
      this._midGeometry = geometry;
    }

    // Every middle-layer node gets a fixed "home" hub — its regional
    // cluster anchor — so the topology reads as internet-like hierarchy
    // instead of a uniform random mesh.
    _assignHomeHubs() {
      const hubs = this.hubs;
      for (let i = 0; i < this.midNodes.length; i++) {
        const n = this.midNodes[i];
        let best = -1, bestD = Infinity;
        for (let h = 0; h < hubs.length; h++) {
          const dx = n.x - hubs[h].x, dy = n.y - hubs[h].y;
          const d = dx * dx + dy * dy;
          if (d < bestD) { bestD = d; best = h; }
        }
        n.homeHub = best;
      }
    }

    /* ============================================================
       Connections — one combined LineSegments buffer:
       regional mesh + hub spokes + backbone
       ============================================================ */
    _createConnections(THREE) {
      this._maxRegionalSeg = this.midNodes.length * 5;
      this._maxSpokeSeg = this.midNodes.length;
      this._maxBackboneSeg = this.backboneEdges.length;
      this._maxSeg = this._maxRegionalSeg + this._maxSpokeSeg + this._maxBackboneSeg;

      const positions = new Float32Array(this._maxSeg * 2 * 3);
      const colors = new Float32Array(this._maxSeg * 2 * 3);

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3).setUsage(THREE.DynamicDrawUsage));
      geometry.setDrawRange(0, 0);

      const material = new THREE.LineBasicMaterial({
        vertexColors: true, transparent: true, opacity: 0.75, depthWrite: false
      });

      this.lineSegments = new THREE.LineSegments(geometry, material);
      this.mainGroup.add(this.lineSegments);
      this._lineGeometry = geometry;
    }

    /* ============================================================
       Packets — glowing traffic traveling along active edges
       ============================================================ */
    _createPackets(THREE) {
      const n = this.packetSlots;
      const positions = new Float32Array(n * 3);
      const colors = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) positions[i * 3] = -999999;

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3).setUsage(THREE.DynamicDrawUsage));

      const material = new THREE.PointsMaterial({
        size: 6.5 * this.dpr, vertexColors: true, transparent: true,
        opacity: 1, sizeAttenuation: false, depthWrite: false
      });

      this.packetPoints = new THREE.Points(geometry, material);
      this.mainGroup.add(this.packetPoints);
      this._packetGeometry = geometry;
      this._packetSlots = new Array(n).fill(null);
    }

    /* ============================================================
       Events
       ============================================================ */
    _bindEvents() {
      global.addEventListener('resize', this._onResize, { passive: true });
      global.addEventListener('mousemove', this._onMouseMove, { passive: true });
      global.addEventListener('mouseleave', this._onMouseLeave, { passive: true });
      global.addEventListener('scroll', this._onScroll, { passive: true });
      document.addEventListener('visibilitychange', this._onVisibility);
    }

    _unbindEvents() {
      global.removeEventListener('resize', this._onResize);
      global.removeEventListener('mousemove', this._onMouseMove);
      global.removeEventListener('mouseleave', this._onMouseLeave);
      global.removeEventListener('scroll', this._onScroll);
      document.removeEventListener('visibilitychange', this._onVisibility);
    }

    _onMouseMove(e) {
      this._mouse.x = e.clientX;
      this._mouse.y = e.clientY;
      this._mouse.nx = (e.clientX / this.width) * 2 - 1;
      this._mouse.ny = (e.clientY / this.height) * 2 - 1;
      this._mouse.active = true;
    }

    _onMouseLeave() { this._mouse.active = false; }

    _onScroll() { this._scrollY = global.scrollY || 0; }

    _onVisibility() {
      if (document.hidden) {
        this._running = false;
      } else if (!this._destroyed && this.renderer) {
        this._running = true;
        this._clock.getDelta();
        this._raf = requestAnimationFrame(this._tick);
      }
    }

    _onResize() {
      if (this._resizeTimer) clearTimeout(this._resizeTimer);
      this._resizeTimer = setTimeout(() => this._applyResize(), 120);
    }

    _applyResize() {
      if (!this.renderer) return;
      const w = this.container.clientWidth || global.innerWidth;
      const h = this.container.clientHeight || global.innerHeight;
      if (w === this.width && h === this.height) return;

      const sx = w / this.width, sy = h / this.height;
      this.hubs.forEach((n) => { n.x *= sx; n.y *= sy; });
      this.bgNodes.forEach((n) => { n.x *= sx; n.y *= sy; });
      this.midNodes.forEach((n) => { n.x *= sx; n.y *= sy; });

      this.width = w; this.height = h;
      this.dpr = Math.min(global.devicePixelRatio || 1, 2);

      this.camera.right = w;
      this.camera.bottom = h;
      this.camera.updateProjectionMatrix();

      this.renderer.setPixelRatio(this.dpr);
      this.renderer.setSize(w, h);
    }

    /* ============================================================
       Spatial hash grid (middle layer only — avoids O(n^2))
       ============================================================ */
    _buildGrid(nodes, cellSize) {
      const grid = new Map();
      const cols = Math.max(1, Math.ceil(this.width / cellSize));
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        const key = Math.floor(n.x / cellSize) + Math.floor(n.y / cellSize) * (cols + 2);
        let bucket = grid.get(key);
        if (!bucket) { bucket = []; grid.set(key, bucket); }
        bucket.push(i);
      }
      return { grid, cols, cellSize };
    }

    _forEachNearby(spatial, nodes, i, cb) {
      const n = nodes[i];
      const cx = Math.floor(n.x / spatial.cellSize), cy = Math.floor(n.y / spatial.cellSize);
      for (let ox = -1; ox <= 1; ox++) {
        for (let oy = -1; oy <= 1; oy++) {
          const bucket = spatial.grid.get((cx + ox) + (cy + oy) * (spatial.cols + 2));
          if (!bucket) continue;
          for (let b = 0; b < bucket.length; b++) {
            const j = bucket[b];
            if (j > i) cb(j);
          }
        }
      }
    }

    /* ============================================================
       Per-frame updates
       ============================================================ */
    _updateParallax(dt) {
      const targetX = this._mouse.active ? this._mouse.nx * 14 : 0;
      const targetY = (this._mouse.active ? this._mouse.ny * 10 : 0) + Math.min(this._scrollY * 0.02, 24);
      const lerp = Math.min(1, dt * 2.5);
      this._parallax.x += (targetX - this._parallax.x) * lerp;
      this._parallax.y += (targetY - this._parallax.y) * lerp;

      this.mainGroup.position.set(this._parallax.x, this._parallax.y, 0);
      this.bgGroup.position.set(this._parallax.x * 0.3, this._parallax.y * 0.3, 0);
    }

    _updateHubs(t) {
      const THREE = this.THREE;
      const dummy = new THREE.Object3D();
      const hubs = this.hubs;

      for (let i = 0; i < hubs.length; i++) {
        const h = hubs[i];

        const nx = this.noise.noise3D(h.nOffX, 0, t * h.driftSpeed * 60);
        const ny = this.noise.noise3D(0, h.nOffY, t * h.driftSpeed * 60);
        h.x += nx * h.driftScale * 0.016;
        h.y += ny * h.driftScale * 0.016;

        // occasional activity burst: temporarily brighter + larger
        if (t > h.activeUntil && Math.random() < 0.0006) {
          h.activeUntil = t + 1500 + Math.random() * 1500;
        }
        h.activeBoost += ((t < h.activeUntil ? 1.6 : 1) - h.activeBoost) * 0.05;

        h.phase += h.breatheSpeed * 0.02;
        const breathe = (0.85 + Math.sin(h.phase) * 0.15) * h.activeBoost;

        dummy.position.set(h.x, h.y, 5);
        dummy.scale.setScalar(h.baseScale * breathe);
        dummy.updateMatrix();
        this.hubCore.setMatrixAt(i, dummy.matrix);

        dummy.scale.setScalar(h.baseScale * breathe * 2.4);
        dummy.updateMatrix();
        this.hubHalo.setMatrixAt(i, dummy.matrix);
      }
      this.hubCore.instanceMatrix.needsUpdate = true;
      this.hubHalo.instanceMatrix.needsUpdate = true;
    }

    _updateBackgroundLayer(t) {
      const posAttr = this._bgGeometry.attributes.position;
      const w = this.width, h = this.height, pad = 40;
      for (let i = 0; i < this.bgNodes.length; i++) {
        const n = this.bgNodes[i];
        const nx = this.noise.noise3D(n.nOffX, 0, t * n.driftSpeed * 60);
        const ny = this.noise.noise3D(0, n.nOffY, t * n.driftSpeed * 60);
        n.x += nx * n.driftScale * 0.016;
        n.y += ny * n.driftScale * 0.016;
        if (n.x < -pad) n.x = w + pad; if (n.x > w + pad) n.x = -pad;
        if (n.y < -pad) n.y = h + pad; if (n.y > h + pad) n.y = -pad;
        posAttr.array[i * 3] = n.x; posAttr.array[i * 3 + 1] = n.y;
      }
      posAttr.needsUpdate = true;
    }

    _updateMiddleLayer(t) {
      const posAttr = this._midGeometry.attributes.position;
      const nodes = this.midNodes;
      const hubs = this.hubs;
      const mouse = this._mouse;
      const w = this.width, h = this.height, pad = 30;

      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];

        const nx = this.noise.noise3D(n.nOffX, 0, t * n.driftSpeed * 60);
        const ny = this.noise.noise3D(0, n.nOffY, t * n.driftSpeed * 60);
        n.x += nx * n.driftScale * 0.016;
        n.y += ny * n.driftScale * 0.016;

        // soft leash back toward home hub — keeps regional clusters
        // coherent while nodes still drift organically within them.
        const home = hubs[n.homeHub];
        if (home) {
          const dx = home.x - n.x, dy = home.y - n.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const leash = this.spokeRadius * 0.9;
          if (dist > leash) {
            const f = (dist - leash) * 0.004;
            n.x += (dx / dist) * f;
            n.y += (dy / dist) * f;
          }
        }

        if (mouse.active) {
          const dx = mouse.x - n.x, dy = mouse.y - n.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < this.mouseRadius && dist > 0.001) {
            const f = (1 - dist / this.mouseRadius) * this.mouseStrength * 0.02;
            n.x += (dx / dist) * f;
            n.y += (dy / dist) * f;
          }
        }

        if (n.x < -pad) n.x = w + pad; if (n.x > w + pad) n.x = -pad;
        if (n.y < -pad) n.y = h + pad; if (n.y > h + pad) n.y = -pad;

        posAttr.array[i * 3] = n.x; posAttr.array[i * 3 + 1] = n.y;
      }
      posAttr.needsUpdate = true;
    }

    _updateConnectionsAndPackets(dt) {
      const nodes = this.midNodes, hubs = this.hubs;
      const posArr = this._lineGeometry.attributes.position.array;
      const colorArr = this._lineGeometry.attributes.color.array;
      const midColorArr = this._midGeometry.attributes.color.array;

      const activeEdges = this._activeEdges;
      activeEdges.length = 0;

      // Single contiguous segment counter — every drawn segment (regional,
      // spoke, or backbone) is appended back-to-back, so setDrawRange only
      // ever exposes cells that were actually written this frame. No
      // reserved per-block offsets, so there's no stale-data gap.
      let seg = 0;
      const maxSeg = this._maxSeg;

      // 1) regional mesh (spatial-hashed, so this stays O(n))
      const spatial = this._buildGrid(nodes, this.maxConnectDist);
      const maxDist2 = this.maxConnectDist * this.maxConnectDist;
      for (let i = 0; i < nodes.length && seg < maxSeg; i++) {
        const a = nodes[i];
        this._forEachNearby(spatial, nodes, i, (j) => {
          if (seg >= maxSeg) return;
          const b = nodes[j];
          const dx = a.x - b.x, dy = a.y - b.y;
          const d2 = dx * dx + dy * dy;
          if (d2 >= maxDist2) return;
          const t = 1 - Math.sqrt(d2) / this.maxConnectDist;
          if (t <= 0.03) return;

          const vi = seg * 2;
          posArr[vi * 3] = a.x; posArr[vi * 3 + 1] = a.y; posArr[vi * 3 + 2] = 0;
          posArr[(vi + 1) * 3] = b.x; posArr[(vi + 1) * 3 + 1] = b.y; posArr[(vi + 1) * 3 + 2] = 0;
          this._writeFadedColor(colorArr, vi, midColorArr, i, t);
          this._writeFadedColor(colorArr, vi + 1, midColorArr, j, t);
          seg++;
          if (t > 0.4) activeEdges.push([i, j, 0]);
        });
      }

      // 2) spokes: node -> home hub
      const spokeMax2 = this.spokeRadius * this.spokeRadius;
      for (let i = 0; i < nodes.length && seg < maxSeg; i++) {
        const n = nodes[i];
        const home = hubs[n.homeHub];
        if (!home) continue;
        const dx = home.x - n.x, dy = home.y - n.y;
        const d2 = dx * dx + dy * dy;
        if (d2 >= spokeMax2) continue;
        const t = 1 - Math.sqrt(d2) / this.spokeRadius;
        if (t <= 0.05) continue;

        const vi = seg * 2;
        posArr[vi * 3] = n.x; posArr[vi * 3 + 1] = n.y; posArr[vi * 3 + 2] = 0;
        posArr[(vi + 1) * 3] = home.x; posArr[(vi + 1) * 3 + 1] = home.y; posArr[(vi + 1) * 3 + 2] = 2;
        this._writeFadedColor(colorArr, vi, midColorArr, i, t);
        const hc = home.color;
        colorArr[(vi + 1) * 3] = hc.r; colorArr[(vi + 1) * 3 + 1] = hc.g; colorArr[(vi + 1) * 3 + 2] = hc.b;
        seg++;
        if (t > 0.5) activeEdges.push([i, -1 - n.homeHub, 1]); // negative encodes "hub target"
      }

      // 3) backbone: hub <-> hub, always visible, brighter/constant
      const bbColor = this._backboneColorObj || (this._backboneColorObj = new this.THREE.Color(this.backboneColor));
      for (let e = 0; e < this.backboneEdges.length && seg < maxSeg; e++) {
        const [hi, hj] = this.backboneEdges[e];
        const a = hubs[hi], b = hubs[hj];
        const vi = seg * 2;
        posArr[vi * 3] = a.x; posArr[vi * 3 + 1] = a.y; posArr[vi * 3 + 2] = 3;
        posArr[(vi + 1) * 3] = b.x; posArr[(vi + 1) * 3 + 1] = b.y; posArr[(vi + 1) * 3 + 2] = 3;
        colorArr[vi * 3] = bbColor.r; colorArr[vi * 3 + 1] = bbColor.g; colorArr[vi * 3 + 2] = bbColor.b;
        colorArr[(vi + 1) * 3] = bbColor.r; colorArr[(vi + 1) * 3 + 1] = bbColor.g; colorArr[(vi + 1) * 3 + 2] = bbColor.b;
        seg++;
        activeEdges.push([-1 - hi, -1 - hj, 2]);
      }

      this._lineGeometry.setDrawRange(0, seg * 2);
      this._lineGeometry.attributes.position.needsUpdate = true;
      this._lineGeometry.attributes.color.needsUpdate = true;

      this._updatePackets(dt, activeEdges);
    }

    _writeFadedColor(colorArr, vertIndex, sourceColorArr, nodeIndex, t) {
      // Floor keeps even the faintest drawn segment legible (0.03 cutoff
      // already discards true noise) instead of every line washing out
      // to near-white a few pixels past minimum distance.
      const tv = 0.4 + 0.6 * t;
      const r = sourceColorArr[nodeIndex * 3], g = sourceColorArr[nodeIndex * 3 + 1], b = sourceColorArr[nodeIndex * 3 + 2];
      colorArr[vertIndex * 3] = 1 - (1 - r) * tv;
      colorArr[vertIndex * 3 + 1] = 1 - (1 - g) * tv;
      colorArr[vertIndex * 3 + 2] = 1 - (1 - b) * tv;
    }

    _edgePoint(ref) {
      // ref >= 0  -> mid node index
      // ref < 0   -> hub index, encoded as -1 - hubIndex
      if (ref >= 0) return this.midNodes[ref];
      return this.hubs[-1 - ref];
    }

    _edgeColor(ref) {
      if (ref >= 0) {
        const c = this._midGeometry.attributes.color.array;
        return [c[ref * 3], c[ref * 3 + 1], c[ref * 3 + 2]];
      }
      const h = this.hubs[-1 - ref];
      return [h.color.r, h.color.g, h.color.b];
    }

    _updatePackets(dt, activeEdges) {
      const slots = this._packetSlots;
      const posArr = this._packetGeometry.attributes.position.array;
      const colorArr = this._packetGeometry.attributes.color.array;

      // Weighted spawn: backbone traffic is denser/faster than regional.
      if (activeEdges.length) {
        for (let s = 0; s < slots.length; s++) {
          if (slots[s]) continue;
          const roll = Math.random();
          const spawnChance = 0.02;
          if (roll > spawnChance) continue;
          const [a, b, tier] = activeEdges[Math.floor(Math.random() * activeEdges.length)];
          const speed = tier === 2 ? 0.4 + Math.random() * 0.3 : tier === 1 ? 0.28 + Math.random() * 0.2 : 0.18 + Math.random() * 0.18;
          slots[s] = { a, b, t: 0, speed, tier };
        }
      }

      for (let s = 0; s < slots.length; s++) {
        const p = slots[s];
        if (!p) { posArr[s * 3] = -999999; continue; }

        p.t += p.speed * dt;
        if (p.t >= 1) {
          // branch: continue from node b along a fresh edge, or despawn
          const candidates = activeEdges.filter((e) => e[0] === p.b || e[1] === p.b);
          if (candidates.length && Math.random() < 0.4) {
            const next = candidates[Math.floor(Math.random() * candidates.length)];
            const newA = p.b;
            const newB = next[0] === p.b ? next[1] : next[0];
            slots[s] = { a: newA, b: newB, t: 0, speed: p.speed, tier: next[2] };
          } else {
            slots[s] = null;
            posArr[s * 3] = -999999;
          }
          continue;
        }

        const a = this._edgePoint(p.a), b = this._edgePoint(p.b);
        if (!a || !b) { slots[s] = null; posArr[s * 3] = -999999; continue; }

        posArr[s * 3] = a.x + (b.x - a.x) * p.t;
        posArr[s * 3 + 1] = a.y + (b.y - a.y) * p.t;
        posArr[s * 3 + 2] = 6;

        const [r, g, bl] = this._edgeColor(p.a);
        colorArr[s * 3] = r; colorArr[s * 3 + 1] = g; colorArr[s * 3 + 2] = bl;
      }

      this._packetGeometry.attributes.position.needsUpdate = true;
      this._packetGeometry.attributes.color.needsUpdate = true;
    }

    /* ============================================================
       Render loop
       ============================================================ */
    _tick() {
      if (!this._running || this._destroyed) return;

      const dt = Math.min(this._clock.getDelta(), 0.05);
      const t = this._clock.elapsedTime * 1000;

      this._updateParallax(dt);
      this._updateHubs(t);
      this._updateBackgroundLayer(t);
      this._updateMiddleLayer(t);
      this._updateConnectionsAndPackets(dt);

      this.renderer.render(this.scene, this.camera);
      this._raf = requestAnimationFrame(this._tick);
    }

    /* ============================================================
       Cleanup
       ============================================================ */
    destroy() {
      this._destroyed = true;
      this._running = false;
      if (this._raf) cancelAnimationFrame(this._raf);
      if (this._resizeTimer) clearTimeout(this._resizeTimer);
      this._unbindEvents();

      [this._bgGeometry, this._midGeometry, this._lineGeometry, this._packetGeometry]
        .forEach((g) => g && g.dispose());
      [this.bgPoints, this.midPoints, this.lineSegments, this.packetPoints, this.hubHalo, this.hubCore]
        .forEach((obj) => { if (obj && obj.material) obj.material.dispose(); if (obj && obj.geometry) obj.geometry.dispose(); });

      if (this.renderer) {
        this.renderer.dispose();
        if (this.renderer.domElement && this.renderer.domElement.parentNode) {
          this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
        }
      }
      if (this.container && this.container.__bgNetworkInstance === this) {
        delete this.container.__bgNetworkInstance;
      }
    }
  }

  /* ============================================================
     Auto-init
     ============================================================ */
  function autoInit() {
    let container = document.getElementById('bg-network');
    if (!container) {
      container = document.createElement('div');
      container.id = 'bg-network';
      container.className = 'bg-network-container';
      container.setAttribute('aria-hidden', 'true');
      document.body.insertBefore(container, document.body.firstChild);
    }
    global.backgroundNetworkInstance = new BackgroundNetwork({ container }).init();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoInit);
  } else {
    autoInit();
  }

  global.BackgroundNetwork = BackgroundNetwork;
})(window);