// Stick Hero+ — app.js (music removed from UI; background music starts on Start)
// Replace your current app.js with this file.

(function () {
  // --------------------
  // Helpers & DOM
  // --------------------
  function last(arr) { return arr && arr.length ? arr[arr.length - 1] : undefined; }

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const scoreEl = document.getElementById('score');
  const highEl = document.getElementById('highscore');
  const startScreen = document.getElementById('startScreen');
  const startBtn = document.getElementById('startBtn');
  const endScreen = document.getElementById('endScreen');
  const finalScoreEl = document.getElementById('finalScore');
  const playAgain = document.getElementById('playAgain');
  const restartBtn = document.getElementById('restart');
  // audio element (keep <audio id="bgMusic"> in HTML); JS will start it on Start click
  const bgMusic = document.getElementById('bgMusic');

  // --------------------
  // Config / State
  // --------------------
  const BASE_W = 375;
  const BASE_H = 667;
  let uiScale = 1;
  let dpr = Math.max(window.devicePixelRatio || 1, 1);

  const PLATFORM_H = 100;
  const HERO_W = 17, HERO_H = 30;
  const PERFECT_SIZE = 12;
  const STRETCH_SPEED = 4, TURN_SPEED = 4, WALK_SPEED = 4;
  const TRANSITION_SPEED = 2, FALL_SPEED = 2;
  const PARTICLE_LIMIT = 400;
  const LAYER_SPEEDS = { clouds: 0.06, mountains: 0.2, farTrees: 0.38 };

  let phase = 'idle'; // idle | waiting | stretching | turning | walking | transitioning | falling
  let lastTS = 0;
  let loopRunning = false;

  let sceneOffset = 0;
  let heroX = 0, heroY = 0;

  let platforms = [], sticks = [], trees = [], clouds = [], mountains = [], farTrees = [], particles = [];

  let score = 0;
  const HIGH_KEY = 'stick-hero-high-v3';
  let highscore = parseInt(localStorage.getItem(HIGH_KEY) || '0', 10);
  highEl.textContent = 'High: ' + highscore;

  let timeOfDay = 0.15;
  const DAY_SPEED = 0.00006;

  // audio flags: music will play only after Start (user gesture)
  let audioStarted = false;
  let gameStarted = false;

  // --------------------
  // Resize & Hi-DPI
  // --------------------
  function resizeCanvas() {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    uiScale = Math.max(0.6, Math.min((vw / BASE_W), (vh / BASE_H) * 1.2));
    dpr = Math.max(window.devicePixelRatio || 1, 1);

    const cssW = Math.round(BASE_W * uiScale);
    const cssH = Math.round(BASE_H * uiScale);

    canvas.style.width = cssW + 'px';
    canvas.style.height = cssH + 'px';

    const physW = Math.floor(cssW * dpr);
    const physH = Math.floor(cssH * dpr);

    if (canvas.width !== physW || canvas.height !== physH) {
      canvas.width = physW;
      canvas.height = physH;
    }

    ctx.setTransform(dpr * uiScale, 0, 0, dpr * uiScale, 0, 0);
  }
  window.addEventListener('resize', () => { resizeCanvas(); draw(); });
  window.addEventListener('orientationchange', () => { setTimeout(() => { resizeCanvas(); draw(); }, 200); });

  // --------------------
  // Generators
  // --------------------
  function resetGame() {
    phase = 'waiting';
    lastTS = undefined;
    sceneOffset = 0;
    score = 0;
    scoreEl.textContent = 'Score: ' + score;
    restartBtn.style.display = 'none';
    endScreen.style.display = 'none';

    platforms = [{ x: 50, w: 80 }];
    for (let i = 0; i < 5; i++) generatePlatform();

    sticks = [{ x: platforms[0].x + platforms[0].w, length: 0, rotation: 0 }];

    trees = [];
    for (let i = 0; i < 12; i++) generateTree();

    clouds = []; for (let i = 0; i < 8; i++) generateCloud();
    mountains = []; for (let i = 0; i < 3; i++) generateMountain();
    farTrees = []; for (let i = 0; i < 6; i++) generateFarTree();

    particles = [];
    heroX = platforms[0].x + platforms[0].w - 12;
    heroY = 0;
    timeOfDay = 0.15;

    draw();
  }

  function generatePlatform() {
    const minGap = 40, maxGap = 200, minW = 30, maxW = 110;
    const lastPlat = platforms[platforms.length - 1];
    const fur = lastPlat.x + lastPlat.w;
    const x = fur + minGap + Math.floor(Math.random() * (maxGap - minGap));
    const w = minW + Math.floor(Math.random() * (maxW - minW));
    platforms.push({ x, w });
  }

  function generateTree() {
    const minGap = 30, maxGap = 150;
    const lastTree = trees[trees.length - 1];
    const fur = lastTree ? lastTree.x : 0;
    const x = fur + minGap + Math.floor(Math.random() * (maxGap - minGap));
    const colors = ['#6D8821', '#8FAC34', '#98B333'];
    trees.push({ x, color: colors[Math.floor(Math.random() * colors.length)] });
  }

  function generateCloud() { clouds.push({ x: Math.random() * BASE_W * 2, y: 30 + Math.random() * 140, scale: 0.6 + Math.random() * 0.9 }); }
  function generateMountain() { mountains.push({ x: Math.random() * BASE_W * 1.5, w: 200 + Math.random() * 300, h: 60 + Math.random() * 100 }); }
  function generateFarTree() { farTrees.push({ x: Math.random() * BASE_W * 1.5 }); }

  // --------------------
  // Particles
  // --------------------
  function emitParticles(x, y, count, opts = {}) {
    for (let i = 0; i < count; i++) {
      if (particles.length > PARTICLE_LIMIT) break;
      const angle = (opts.spread || Math.PI * 2) * Math.random();
      const speed = (opts.minSpeed || 0.5) + Math.random() * ((opts.maxSpeed || 3) - (opts.minSpeed || 0.5));
      const life = (opts.life || 700) + Math.random() * (opts.lifeVar || 300);
      const size = (opts.size || 4) * (0.4 + Math.random() * 1.2);
      const color = opts.color || '#FFD700';
      const type = opts.type || 'spark';
      particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, t: 0, life, size, color, type, gravity: opts.gravity || 0.002 });
    }
  }

  function emitShock(x, y, radius, color) {
    particles.push({ x, y, type: 'shock', r: 0, R: radius, color, t: 0, life: 600 });
  }

  function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.t += dt;
      if (p.type === 'shock') {
        p.r = (p.t / p.life) * p.R;
        if (p.t > p.life) particles.splice(i, 1);
        continue;
      }
      p.vy += (p.gravity || 0) * dt;
      p.x += p.vx * (dt / 16);
      p.y += p.vy * (dt / 16);
      if (p.t > p.life) particles.splice(i, 1);
    }
  }

  // --------------------
  // Input & Audio
  // --------------------
  // Pointer handlers must ignore UI clicks so music (if present) doesn't start the game.
  function onPointerDown(e) {
    // ignore pointer events coming from UI elements
    if (e.target.closest && e.target.closest('button, a, .ui-btn, #startBtn, #playAgain, #restart')) return;
    if (!gameStarted) return; // game not started yet
    if (phase !== 'waiting') return;
    lastTS = undefined;
    phase = 'stretching';
  }
  function onPointerUp(e) {
    if (!gameStarted) return;
    if (phase === 'stretching') phase = 'turning';
  }
  window.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointerup', onPointerUp);

  // Start / Play Again / Restart — start the music (if available) and the game loop only on Start click
  startBtn.addEventListener('click', (e) => {
    gameStarted = true;
    startScreen.style.display = 'none';
    phase = 'waiting';

    // start music here — safe user gesture
    try {
      if (bgMusic) {
        bgMusic.volume = 0.35;
        bgMusic.play().catch(()=>{/* ignore play rejection */});
        audioStarted = true;
      }
    } catch (err) { console.warn('bgMusic play error', err); }

    if (!loopRunning) { loopRunning = true; requestAnimationFrame(loop); }
  });

  playAgain.addEventListener('click', () => {
    gameStarted = true;
    resetGame();
    startScreen.style.display = 'none';
    phase = 'waiting';
    try { if (bgMusic) bgMusic.play().catch(()=>{}); audioStarted = true; } catch(e){ }
    if (!loopRunning) { loopRunning = true; requestAnimationFrame(loop); }
  });

  restartBtn.addEventListener('click', () => {
    gameStarted = true;
    resetGame();
    startScreen.style.display = 'none';
    phase = 'waiting';
    try { if (bgMusic) bgMusic.play().catch(()=>{}); audioStarted = true; } catch(e){ }
    if (!loopRunning) { loopRunning = true; requestAnimationFrame(loop); }
  });

  // Space to start
  window.addEventListener('keydown', (ev) => {
    if (ev.code === 'Space') {
      gameStarted = true;
      resetGame();
      startScreen.style.display = 'none';
      phase = 'waiting';
      try { if (bgMusic) bgMusic.play().catch(()=>{}); audioStarted = true; } catch(e){ }
      if (!loopRunning) { loopRunning = true; requestAnimationFrame(loop); }
    }
  });

  // --------------------
  // Gameplay helpers
  // --------------------
  function thePlatformTheStickHits() {
    const ls = last(sticks);
    if (!ls || ls.rotation !== 90) return [undefined, false];
    const stickFar = ls.x + ls.length;
    const hit = platforms.find(p => p.x < stickFar && stickFar < p.x + p.w);
    if (hit) {
      const center = hit.x + hit.w / 2;
      const perfect = center - PERFECT_SIZE / 2 < stickFar && stickFar < center + PERFECT_SIZE / 2;
      return [hit, perfect];
    }
    return [undefined, false];
  }

  // --------------------
  // Drawing
  // --------------------
  function draw() {
    resizeCanvas();
    const w = BASE_W, h = BASE_H;
    const sky = getSkyGradient(timeOfDay);
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, sky.top);
    g.addColorStop(1, sky.bottom);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    drawMountains();
    drawFarTrees();
    drawClouds();

    drawHill(100, 10, 1, '#95C629');
    drawHill(70, 20, 0.5, '#659F1C');
    trees.forEach(t => drawTree(t.x, t.color));

    drawParticles();

    ctx.save();
    ctx.translate(0 - sceneOffset, (h - 375) / 2);
    drawPlatforms();
    drawSticks();
    drawHero();
    ctx.restore();

    drawParticles();
  }

  function drawHill(base, amp, stretch, color) {
    ctx.beginPath(); ctx.moveTo(0, BASE_H); ctx.lineTo(0, getHillY(0, base, amp, stretch));
    for (let i = 0; i < BASE_W; i++) ctx.lineTo(i, getHillY(i, base, amp, stretch));
    ctx.lineTo(BASE_W, BASE_H); ctx.fillStyle = color; ctx.fill();
  }
  function getHillY(x, base, amp, stretch) { const baseY = BASE_H - base; return Math.sin((sceneOffset * 0.2 + x) * stretch) * amp + baseY; }

  function drawClouds() {
    ctx.save();
    clouds.forEach(c => {
      const x = (c.x - sceneOffset * LAYER_SPEEDS.clouds) % (BASE_W * 2);
      const y = c.y; const s = c.scale;
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      const cx = x - BASE_W * 0.5;
      ctx.beginPath();
      ctx.ellipse(cx, y, 40 * s, 20 * s, 0, 0, Math.PI * 2);
      ctx.ellipse(cx + 30 * s, y + 4 * s, 30 * s, 16 * s, 0, 0, Math.PI * 2);
      ctx.ellipse(cx - 30 * s, y + 4 * s, 28 * s, 14 * s, 0, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
  }
  function drawMountains() {
    ctx.save();
    mountains.forEach((m, i) => {
      const x = (m.x - sceneOffset * LAYER_SPEEDS.mountains) % (BASE_W * 1.5);
      const baseY = BASE_H - 80;
      ctx.beginPath();
      ctx.moveTo(x - 50, baseY);
      ctx.lineTo(x + m.w / 2, baseY - m.h);
      ctx.lineTo(x + m.w + 50, baseY);
      ctx.closePath();
      ctx.fillStyle = i % 2 === 0 ? '#7A8C3A' : '#6B7A2F';
      ctx.fill();
    });
    ctx.restore();
  }
  function drawFarTrees() {
    ctx.save();
    farTrees.forEach(t => {
      const x = (t.x - sceneOffset * LAYER_SPEEDS.farTrees) % (BASE_W * 1.5);
      const baseY = BASE_H - 40;
      ctx.fillStyle = '#556B2F';
      ctx.fillRect(x, baseY - 16, 6, 16);
      ctx.beginPath(); ctx.moveTo(x - 10, baseY - 12); ctx.lineTo(x + 3, baseY - 40); ctx.lineTo(x + 16, baseY - 12); ctx.fill();
    });
    ctx.restore();
  }
  function drawTree(x, color) {
    ctx.save();
    ctx.translate((-sceneOffset * 0.2 + x) * 1, getTreeY(x, 100, 10));
    ctx.fillStyle = '#7D833C'; ctx.fillRect(-1, -5, 2, 5);
    ctx.beginPath(); ctx.moveTo(-5, -5); ctx.lineTo(0, -30); ctx.lineTo(5, -5); ctx.fillStyle = color; ctx.fill();
    ctx.restore();
  }
  function getTreeY(x, base, amp) { const baseY = BASE_H - base; return Math.sin(x) * amp + baseY; }

  function drawPlatforms() {
    platforms.forEach(({ x, w }) => {
      ctx.fillStyle = '#000';
      ctx.fillRect(x, 375 - PLATFORM_H, w, PLATFORM_H + (BASE_H - 375) / 2);
      const ls = last(sticks);
      if (ls && ls.x < x) {
        ctx.fillStyle = 'red';
        ctx.fillRect(x + w / 2 - PERFECT_SIZE / 2, 375 - PLATFORM_H, PERFECT_SIZE, PERFECT_SIZE);
      }
    });
  }

  function drawSticks() {
    sticks.forEach(s => {
      ctx.save();
      ctx.translate(s.x, 375 - PLATFORM_H);
      ctx.rotate((Math.PI / 180) * s.rotation);
      ctx.beginPath(); ctx.lineWidth = 2; ctx.moveTo(0, 0); ctx.lineTo(0, -s.length); ctx.strokeStyle = '#000'; ctx.stroke();
      ctx.restore();
    });
  }

  function drawHero() {
    ctx.save();
    ctx.fillStyle = '#000';
    ctx.translate(heroX - HERO_W / 2, heroY + 375 - PLATFORM_H - HERO_H / 2);
    drawRoundedRect(-HERO_W / 2, -HERO_H / 2, HERO_W, HERO_H - 4, 5);
    const legDist = 5;
    ctx.beginPath(); ctx.arc(legDist, 11.5, 3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(-legDist, 11.5, 3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.fillStyle = 'white'; ctx.arc(5, -7, 3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'red'; ctx.fillRect(-HERO_W / 2 - 1, -12, HERO_W + 2, 4.5);
    ctx.restore();
  }
  function drawRoundedRect(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x, y + r); ctx.lineTo(x, y + h - r); ctx.arcTo(x, y + h, x + r, y + h, r); ctx.lineTo(x + w - r, y + h); ctx.arcTo(x + w, y + h, x + w, y + h - r, r); ctx.lineTo(x + w, y + r); ctx.arcTo(x + w, y, x + w - r, y, r); ctx.lineTo(x + r, y); ctx.arcTo(x, y, x, y + r, r); ctx.fill(); }

  function drawParticles() {
    ctx.save();
    particles.forEach(p => {
      if (p.type === 'shock') {
        const alpha = 1 - p.t / p.life;
        ctx.beginPath(); ctx.lineWidth = 3 * (1 - alpha); ctx.strokeStyle = `rgba(255,200,130,${alpha})`;
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.stroke();
        return;
      }
      const alpha = Math.max(0, 1 - p.t / p.life);
      if (p.type === 'glow') {
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 6);
        g.addColorStop(0, p.color); g.addColorStop(0.5, p.color); g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.globalAlpha = alpha * 0.9; ctx.fillStyle = g; ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 4 * (1 - p.t / p.life), 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
      }
      ctx.globalAlpha = alpha; ctx.beginPath(); ctx.fillStyle = p.color; ctx.arc(p.x, p.y, Math.max(0.5, p.size * (1 - p.t / p.life)), 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
    });
    ctx.restore();
  }

  // --------------------
  // Sky Helpers
  // --------------------
  function getSkyGradient(t) {
    const top = lerpColor('#BBD691', '#0B2545', t);
    const bottom = lerpColor('#FEF1E1', '#021024', t);
    return { top, bottom };
  }
  function lerpColor(a, b, t) {
    const pa = hexToRgb(a), pb = hexToRgb(b);
    const r = Math.round(pa.r + (pb.r - pa.r) * t);
    const g = Math.round(pa.g + (pb.g - pa.g) * t);
    const bl = Math.round(pa.b + (pb.b - pa.b) * t);
    return `rgb(${r},${g},${bl})`;
  }
  function hexToRgb(hex) { if (hex[0] === '#') hex = hex.slice(1); const num = parseInt(hex, 16); return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 }; }

  // --------------------
  // Main Loop
  // --------------------
  function loop(ts) {
    if (!lastTS) lastTS = ts;
    const dt = ts - lastTS;
    lastTS = ts;

    if (phase !== 'idle') timeOfDay = (timeOfDay + dt * DAY_SPEED) % 1;

    switch (phase) {
      case 'waiting': break;

      case 'stretching': {
        const ls = last(sticks);
        if (ls) ls.length += dt / STRETCH_SPEED;
        break;
      }

      case 'turning': {
        const ls = last(sticks);
        if (ls) ls.rotation += dt / TURN_SPEED;
        if (ls && ls.rotation >= 90) {
          ls.rotation = 90;
          const [next, perfect] = thePlatformTheStickHits();
          if (next) {
            score += perfect ? 2 : 1;
            scoreEl.textContent = 'Score: ' + score;
            if (perfect) {
              const stickFar = ls.x + ls.length - sceneOffset;
              emitParticles(stickFar, 375 - PLATFORM_H - 12, 28, { color: '#FFD700', minSpeed: 1, maxSpeed: 4, life: 900, size: 3, type: 'glow', gravity: 0.003, spread: Math.PI });
              emitShock(stickFar, 375 - PLATFORM_H - 12, 60, '#FFD700');
            } else {
              const stickFar = ls.x + ls.length - sceneOffset;
              emitParticles(stickFar, 375 - PLATFORM_H - 6, 8, { color: '#AAAAAA', minSpeed: 0.6, maxSpeed: 2, life: 500, size: 2 });
            }
            generatePlatform(); generateTree(); generateTree();
          }
          phase = 'walking';
        }
        break;
      }

      case 'walking': {
        heroX += dt / WALK_SPEED;
        const [np] = thePlatformTheStickHits();
        if (np) {
          const maxHero = np.x + np.w - 10;
          if (heroX > maxHero) { heroX = maxHero; phase = 'transitioning'; }
        } else {
          const ls = last(sticks);
          if (ls) {
            const maxHero = ls.x + ls.length + HERO_W;
            if (heroX > maxHero) {
              heroX = maxHero; phase = 'falling';
              const edgeX = ls.x + ls.length - sceneOffset;
              emitParticles(edgeX, 375 - PLATFORM_H + 4, 16, { color: '#C2B280', minSpeed: 0.6, maxSpeed: 2.4, life: 800, size: 2, gravity: 0.006 });
            }
          }
        }
        break;
      }

      case 'transitioning': {
        sceneOffset += dt / TRANSITION_SPEED;
        const [np2] = thePlatformTheStickHits();
        if (np2 && sceneOffset > np2.x + np2.w - 120) {
          sticks.push({ x: np2.x + np2.w, length: 0, rotation: 0 });
          while (platforms.length > 6) platforms.shift();
          while (trees.length > 20) trees.shift();
          clouds = clouds.map(c => ({ ...c, x: c.x - BASE_W * 0.3 }));
          mountains = mountains.map(m => ({ ...m, x: m.x - BASE_W * 0.2 }));
          while (clouds.length < 8) generateCloud();
          while (mountains.length < 3) generateMountain();
          while (farTrees.length < 6) generateFarTree();
          phase = 'waiting';
        }
        break;
      }

      case 'falling': {
        const ls2 = last(sticks);
        if (ls2 && ls2.rotation < 180) ls2.rotation += dt / TURN_SPEED;
        heroY += dt / FALL_SPEED;
        if (Math.random() < 0.3) emitParticles(heroX - sceneOffset, heroY + 375 - PLATFORM_H - HERO_H / 2, 1, { color: '#6B6B6B', minSpeed: 0.1, maxSpeed: 0.6, life: 500, size: 1, gravity: 0.006 });
        if (heroY > BASE_H + 200) {
          restartBtn.style.display = 'block';
          finalScoreEl.textContent = 'Score: ' + score;
          endScreen.style.display = 'block';
          if (score > highscore) { highscore = score; localStorage.setItem(HIGH_KEY, String(highscore)); highEl.textContent = 'High: ' + highscore; }
          loopRunning = false;
          return;
        }
        break;
      }
    } // switch

    updateParticles(dt);
    draw();

    if (loopRunning) requestAnimationFrame(loop);
  }

  // --------------------
  // helpers used in loop
  // --------------------
  function thePlatformTheStickHits() {
    const ls = last(sticks);
    if (!ls || ls.rotation !== 90) return [undefined, false];
    const stickFar = ls.x + ls.length;
    const hit = platforms.find(p => p.x < stickFar && stickFar < p.x + p.w);
    if (hit) {
      const center = hit.x + hit.w / 2;
      const perfect = center - PERFECT_SIZE / 2 < stickFar && stickFar < center + PERFECT_SIZE / 2;
      return [hit, perfect];
    }
    return [undefined, false];
  }

  // --------------------
  // Boot
  // --------------------
  resizeCanvas();
  resetGame();

  // Expose simple debug hook
  window.__stickHero = { reset: resetGame, state: () => ({ phase, score, highscore, sticks, platforms, gameStarted, audioStarted }) };

})();
