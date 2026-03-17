// ════════════════════════════════════════════════════════════════════
//  NANO·BIRD — Cyber Flight  |  God Mode  v4 (bug-fixed)
//  © 2026 Abhishek Shah · linkedin.com/in/theabhishekshah
//  abhishekshah.vercel.app
// ════════════════════════════════════════════════════════════════════
'use strict';

window.addEventListener('DOMContentLoaded', function () {

  // ─── Canvas ────────────────────────────────────────────────────
  const canvas = document.getElementById('gc');
  if (!canvas) { console.error('Canvas #gc not found'); return; }
  const ctx = canvas.getContext('2d', { alpha: false });
  const W = 400, H = 600;

  // ─── Reduced-motion ────────────────────────────────────────────
  const prefersReducedMotion =
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ─── Palette ───────────────────────────────────────────────────
  const PAL = {
    bg:      '#060612',
    cyan:    '#22d3ee',
    pink:    '#f472b6',
    amber:   '#fbbf24',
    violet:  '#a78bfa',
    white:   '#f1f5f9',
  };

  // ─── Physics ───────────────────────────────────────────────────
  const GRAVITY    = 0.40;
  const TERM_VEL   = 9.8;
  const FLAP_FORCE = -8.8;
  const PIPE_W     = 52;
  const B_VIS_R    = 11;
  const B_HIT_R    = 7.2;
  const TRAIL_LEN  = 30;

  // ─── Difficulty ────────────────────────────────────────────────
  const DIFF = {
    easy:   { gap: 165, spd: 2.2, rate: 195 },
    hard:   { gap: 128, spd: 3.3, rate: 148 },
    insane: { gap:  95, spd: 5.2, rate: 106 },
  };

  // ─── Loop timing ───────────────────────────────────────────────
  let lastTs = 0;
  let frame  = 0;

  // ─── Screen-shake (spring-damper) ──────────────────────────────
  const SHAKE = { vel: 0, pos: 0, K: 0.18, D: 0.72 };
  function addShake(impulse) {
    if (prefersReducedMotion) return;
    SHAKE.vel += impulse;
  }
  function stepShake() {
    SHAKE.vel += -SHAKE.K * SHAKE.pos;
    SHAKE.vel *= SHAKE.D;
    SHAKE.pos += SHAKE.vel;
    if (Math.abs(SHAKE.pos) < 0.05 && Math.abs(SHAKE.vel) < 0.05)
      SHAKE.pos = SHAKE.vel = 0;
  }

  // ─── Background scroll offsets ─────────────────────────────────
  let gridOX = 0, gridOY = 0;
  let flashAlpha = 0;

  // ─── DOM refs ──────────────────────────────────────────────────
  const elWrap       = document.getElementById('wrap');
  const elWrapOuter  = document.getElementById('wrap-outer');
  const elScoreNum   = document.getElementById('score-num');
  const elBestNum    = document.getElementById('best-num');
  const elComboBadge = document.getElementById('combo-badge');
  const elComboText  = document.getElementById('combo-text');
  const elVelFill    = document.getElementById('vel-fill');
  const elShieldBar  = document.getElementById('shield-bar');
  const elShieldText = document.getElementById('shield-text');
  const elMenu       = document.getElementById('menu-screen');
  const elOver       = document.getElementById('gameover-screen');
  const elFinal      = document.getElementById('final-score');
  const elBestFin    = document.getElementById('best-score');
  const elNewBest    = document.getElementById('new-best-tag');
  const elCursor     = document.getElementById('cursor');
  const elCursorRing = document.getElementById('cursor-ring');

  // ─── Game state ────────────────────────────────────────────────
  let gs      = 'MENU';   // MENU | PLAYING | DEAD | GAMEOVER
  let curDiff = 'easy';
  let score   = 0;
  let best    = parseInt(localStorage.getItem('nb_best4') || '0', 10);
  let combo   = 0;
  let mult    = 1;
  let shielded = false;
  let dynHue  = 185;

  // ─── Entity arrays ─────────────────────────────────────────────
  let bird, pipes, particles, floatTexts, powerups;

  // ══════════════════════════════════════════════════════════════
  //  CLASSES  (all defined before any instantiation)
  // ══════════════════════════════════════════════════════════════

  // ── Parallax star ──────────────────────────────────────────────
  class PxStar {
    constructor(seedX) {
      this.layer = Math.floor(Math.random() * 3);
      this._reset(seedX);
    }
    _reset(seedX) {
      const L = [[0.10, 0.28, 0.16], [0.32, 0.72, 0.38], [0.76, 1.30, 0.65]];
      const [spd, sz, op] = L[this.layer];
      this.x   = seedX ? Math.random() * W : W + 2;
      this.y   = Math.random() * H;
      this.spd = spd + Math.random() * 0.06;
      this.sz  = sz  + Math.random() * 0.14;
      this.op  = op  + Math.random() * 0.12;
      this.tw  = Math.random() * Math.PI * 2;
    }
    update(dt) {
      this.x  -= this.spd * dt;
      this.tw += 0.030 * dt;
      if (this.x < -2) this._reset(false);
    }
    draw() {
      ctx.globalAlpha = this.op * (0.72 + 0.28 * Math.sin(this.tw));
      ctx.fillStyle   = PAL.white;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.sz, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  // ── Bird ───────────────────────────────────────────────────────
  class Bird {
    constructor() {
      this.x     = 88;
      this.y     = H * 0.47;
      this.vy    = 0;
      this.rot   = 0;
      this.phase = 0;
      this.orbPh = 0;
      this.trail = [];
      this.alive = true;
    }

    flap() {
      this.vy = FLAP_FORCE;
      spawnBurst(this.x, this.y, 'flap', prefersReducedMotion ? 4 : 12);
    }

    update(dt) {
      if (!this.alive) return;
      this.vy     = Math.min(this.vy + GRAVITY * dt, TERM_VEL);
      this.y     += this.vy * dt;
      this.phase += 0.09 * dt;
      this.orbPh += 0.075 * dt;

      this.trail.unshift({ x: this.x, y: this.y, sh: shielded });
      if (this.trail.length > TRAIL_LEN) this.trail.pop();

      const tRot = this.vy < 0 ? -0.44 : Math.min(1.35, this.vy * 0.13);
      this.rot  += (tRot - this.rot) * 0.13;

      // Velocity HUD
      const vn = Math.max(0, Math.min(1,
        (this.vy + Math.abs(FLAP_FORCE)) / (TERM_VEL + Math.abs(FLAP_FORCE))
      ));
      elVelFill.style.height = (vn * 100) + '%';

      if (this.y + B_HIT_R >= H) { this.y = H - B_HIT_R; triggerDeath(); }
      if (this.y - B_HIT_R <= 0) { this.y = B_HIT_R; this.vy = 0; }
    }

    draw() {
      const coreCol = shielded ? PAL.violet : `hsl(${dynHue},92%,62%)`;

      // Trail
      for (let i = this.trail.length - 1; i >= 0; i--) {
        const tp = this.trail[i];
        const t  = 1 - i / TRAIL_LEN;
        const tc = tp.sh ? PAL.violet : coreCol;
        const r  = B_VIS_R * t * 0.78;
        if (r < 0.2) continue;
        ctx.globalAlpha = t * t * 0.18;
        ctx.shadowBlur  = 10;
        ctx.shadowColor = tc;
        ctx.fillStyle   = tc;
        ctx.beginPath();
        ctx.arc(tp.x, tp.y, r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1; ctx.shadowBlur = 0;

      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.rot);

      const p = 1 + Math.sin(this.phase) * 0.08;

      // Glow halos (outside-in)
      [{ r: B_VIS_R * 4.5 * p, a: 0.030 },
       { r: B_VIS_R * 2.5 * p, a: 0.085 },
       { r: B_VIS_R * 1.6 * p, a: 0.19  }]
        .forEach(({ r, a }) => {
          ctx.globalAlpha = a;
          ctx.shadowBlur  = 36;
          ctx.shadowColor = coreCol;
          ctx.fillStyle   = coreCol;
          ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
        });

      // Solid core
      ctx.globalAlpha = 1;
      ctx.shadowBlur  = 26;
      ctx.shadowColor = coreCol;
      ctx.fillStyle   = coreCol;
      ctx.beginPath(); ctx.arc(0, 0, B_VIS_R, 0, Math.PI * 2); ctx.fill();

      // Radial specular
      const ig = ctx.createRadialGradient(-3.5, -3.5, 0, 0, 0, B_VIS_R);
      ig.addColorStop(0,    'rgba(255,255,255,0.94)');
      ig.addColorStop(0.38, 'rgba(255,255,255,0.12)');
      ig.addColorStop(1,    'rgba(255,255,255,0)');
      ctx.shadowBlur = 0;
      ctx.fillStyle  = ig;
      ctx.beginPath(); ctx.arc(0, 0, B_VIS_R, 0, Math.PI * 2); ctx.fill();

      // Shield ring + 3 orbiting dots
      if (shielded) {
        const rr = B_VIS_R * 2.2 + Math.sin(this.phase * 3.5) * 2;
        ctx.globalAlpha = 0.60 + 0.20 * Math.sin(this.phase * 5);
        ctx.shadowBlur  = 22;
        ctx.shadowColor = PAL.violet;
        ctx.strokeStyle = PAL.violet;
        ctx.lineWidth   = 1.5;
        ctx.beginPath(); ctx.arc(0, 0, rr, 0, Math.PI * 2); ctx.stroke();
        for (let i = 0; i < 3; i++) {
          const a = this.orbPh + i * (Math.PI * 2 / 3);
          ctx.globalAlpha = 0.92;
          ctx.shadowBlur  = 12;
          ctx.fillStyle   = PAL.violet;
          ctx.beginPath();
          ctx.arc(Math.cos(a) * rr, Math.sin(a) * rr, 2.8, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      ctx.globalAlpha = 1; ctx.shadowBlur = 0;
      ctx.restore();
    }
  }

  // ── Pipe ───────────────────────────────────────────────────────
  class Pipe {
    constructor() {
      this.x   = W + 10;
      this.w   = PIPE_W;
      const d  = DIFF[curDiff];
      this.gap = d.gap;
      this.spd = d.spd;

      const mn = 52, mx = H - this.gap - mn;
      this.topH   = Math.round(Math.random() * (mx - mn)) + mn;
      this.botY   = this.topH + this.gap;
      this.passed = false;
      this.pph    = Math.random() * Math.PI * 2;
      this.arcOff = newArcOffsets();
      this.arcAge = 0;
    }

    get curSpd() {
      return this.spd + Math.min(score * 0.020, 2.2);
    }

    update(dt) {
      this.x      -= this.curSpd * dt;
      this.pph    += 0.040 * dt;
      this.arcAge += dt;
      if (this.arcAge > 7) { this.arcOff = newArcOffsets(); this.arcAge = 0; }

      // Collision
      if (bird.x + B_HIT_R > this.x && bird.x - B_HIT_R < this.x + this.w) {
        if (bird.y - B_HIT_R < this.topH || bird.y + B_HIT_R > this.botY) {
          if (shielded) {
            shielded = false;
            setShield(false);
            addShake(16);
            bird.vy = FLAP_FORCE * 0.55;
            spawnBurst(bird.x, bird.y, 'shield_break', prefersReducedMotion ? 12 : 35);
          } else {
            triggerDeath();
          }
        }
      }

      // Score
      if (!this.passed && this.x + this.w < bird.x) {
        this.passed = true;
        combo++;
        mult  = combo >= 10 ? 3 : combo >= 5 ? 2 : 1;
        score += mult;
        updateScore();
        floatTexts.push(new FloatText(
          this.x + this.w / 2,
          this.topH + this.gap / 2,
          '+' + mult,
          mult > 1 ? PAL.pink : PAL.cyan
        ));
      }
    }

    draw() {
      const gp = 0.68 + 0.32 * Math.sin(this.pph);
      this._seg(this.x, 0,          this.w, this.topH,       true,  gp);
      this._seg(this.x, this.botY,  this.w, H - this.botY,   false, gp);
      this._arc(gp);
    }

    _seg(x, y, w, h, isTop, gp) {
      ctx.globalAlpha = 0.055;
      ctx.fillStyle   = PAL.pink;
      ctx.fillRect(x, y, w, h);

      ctx.globalAlpha = 1;
      ctx.shadowBlur  = 8 * gp;
      ctx.shadowColor = PAL.pink;
      ctx.strokeStyle = `rgba(244,114,182,${0.45 * gp})`;
      ctx.lineWidth   = 1;
      ctx.strokeRect(x, y, w, h);

      const capH = 16, capX = x - 7, capW = w + 14;
      const capY = isTop ? y + h - capH : y;

      const cg = ctx.createLinearGradient(capX, 0, capX + capW, 0);
      cg.addColorStop(0,   `rgba(244,114,182,${0.14 * gp})`);
      cg.addColorStop(0.5, `rgba(244,114,182,${0.62 * gp})`);
      cg.addColorStop(1,   `rgba(244,114,182,${0.14 * gp})`);
      ctx.shadowBlur  = 26 * gp;
      ctx.fillStyle   = cg;
      ctx.fillRect(capX, capY, capW, capH);

      ctx.strokeStyle = `rgba(244,114,182,${0.95 * gp})`;
      ctx.lineWidth   = 1.8;
      ctx.strokeRect(capX, capY, capW, capH);

      ctx.globalAlpha = 0.26 * gp;
      ctx.fillStyle   = PAL.white;
      ctx.fillRect(capX + 2, capY + 4, capW - 4, 1.5);

      ctx.globalAlpha = 0.70 * gp;
      ctx.fillStyle   = PAL.pink;
      const cs = 3;
      [[capX, capY], [capX + capW - cs, capY],
       [capX, capY + capH - cs], [capX + capW - cs, capY + capH - cs]]
        .forEach(([bx, by]) => ctx.fillRect(bx, by, cs, cs));

      ctx.globalAlpha = 1; ctx.shadowBlur = 0;
    }

    _arc(gp) {
      const n   = this.arcOff.length - 1;
      const cx  = this.x + this.w / 2;
      const flk = 0.5 + 0.5 * Math.sin(frame * 0.17 + this.pph * 2);

      ctx.save();
      ctx.globalAlpha = 0.22 * gp * flk;
      ctx.shadowBlur  = 14;
      ctx.shadowColor = PAL.cyan;
      ctx.strokeStyle = PAL.cyan;
      ctx.lineWidth   = 1.1;
      ctx.beginPath();
      ctx.moveTo(cx + this.arcOff[0], this.topH + 4);
      for (let i = 1; i <= n; i++) {
        const t = i / n;
        ctx.lineTo(cx + this.arcOff[i], this.topH + 4 + t * (this.gap - 8));
      }
      ctx.stroke();
      ctx.restore();
    }
  }

  // ── PowerUp ────────────────────────────────────────────────────
  class PowerUp {
    constructor(x, y, pipeSpd) {
      this.x    = x;
      this.y    = y;
      this.spd  = pipeSpd;
      this.r    = 13;
      this.done = false;
      this.ph   = Math.random() * Math.PI * 2;
      this.hp   = Math.random() * Math.PI * 2;
      this.sp   = 0;
    }

    update(dt) {
      this.x  -= (this.spd + Math.min(score * 0.020, 2.2)) * dt;
      this.ph += 0.070 * dt;
      this.hp += 0.050 * dt;
      this.sp  = Math.min(1, this.sp + dt * 0.08);

      if (Math.hypot(this.x - bird.x, this.y - bird.y) < this.r + B_HIT_R + 6) {
        this.done = true;
        setShield(true);
        spawnBurst(this.x, this.y, 'collect', prefersReducedMotion ? 12 : 32);
      }
    }

    draw() {
      const s  = this.sp;
      const hy = Math.sin(this.hp) * 5;
      const r  = this.r * (1 + Math.sin(this.ph * 2.2) * 0.10) * s;
      const dist  = Math.hypot(this.x - bird.x, this.y - bird.y);
      const prox  = Math.max(0, 1 - dist / 130);

      ctx.save();
      ctx.translate(this.x, this.y + hy);

      if (prox > 0.03 && !prefersReducedMotion) {
        ctx.globalAlpha = prox * 0.28;
        ctx.strokeStyle = PAL.violet;
        ctx.lineWidth   = 1;
        ctx.beginPath();
        ctx.arc(0, 0, r + 14 + prox * 12, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.rotate(this.ph * 0.85);

      ctx.globalAlpha = 0.50 * s;
      ctx.shadowBlur  = 22;
      ctx.shadowColor = PAL.violet;
      ctx.strokeStyle = PAL.violet;
      ctx.lineWidth   = 1.3;
      ctx.beginPath(); ctx.arc(0, 0, r + 8, 0, Math.PI * 2); ctx.stroke();

      ctx.globalAlpha = 1 * s;
      ctx.shadowBlur  = 20;
      ctx.fillStyle   = 'rgba(167,139,250,0.16)';
      ctx.strokeStyle = PAL.violet;
      ctx.lineWidth   = 1.8;
      ctx.beginPath();
      ctx.moveTo(0, -r); ctx.lineTo(r, 0);
      ctx.lineTo(0,  r); ctx.lineTo(-r, 0);
      ctx.closePath();
      ctx.fill(); ctx.stroke();

      ctx.rotate(-this.ph * 1.8);
      const si = r * 0.44;
      ctx.shadowBlur  = 8;
      ctx.strokeStyle = 'rgba(196,181,253,0.70)';
      ctx.lineWidth   = 1.1;
      ctx.beginPath();
      ctx.moveTo(0, -si); ctx.lineTo(si, 0);
      ctx.lineTo(0,  si); ctx.lineTo(-si, 0);
      ctx.closePath(); ctx.stroke();

      ctx.globalAlpha = 1; ctx.shadowBlur = 0;
      ctx.restore();
    }
  }

  // ── Particle ───────────────────────────────────────────────────
  class Particle {
    constructor(x, y, type) {
      this.x = x; this.y = y;
      const a = Math.random() * Math.PI * 2;
      const s = Math.random();

      switch (type) {
        case 'flap':
          this.vx = (Math.random() - 0.68) * 4.5;
          this.vy = (Math.random() - 0.50) * 3.2;
          this.life = 22; this.col = PAL.cyan;
          this.sz = Math.random() * 2.8 + 0.8;
          this.drag = 0.86; this.grav = 0; break;

        case 'death':
          this.vx = Math.cos(a) * (s * 7 + 2.5);
          this.vy = Math.sin(a) * (s * 7 + 2.5);
          this.life = 85;
          this.col = [PAL.cyan, PAL.pink, PAL.white, PAL.amber][Math.floor(Math.random() * 4)];
          this.sz = Math.random() * 6 + 2;
          this.drag = 0.97; this.grav = 0.16; break;

        case 'collect':
          this.vx = Math.cos(a) * (s * 5 + 1.2);
          this.vy = Math.sin(a) * (s * 5 + 1.2);
          this.life = 50; this.col = PAL.violet;
          this.sz = Math.random() * 4 + 1;
          this.drag = 0.96; this.grav = -0.02; break;

        case 'shield_break':
          this.vx = Math.cos(a) * (s * 8 + 2.5);
          this.vy = Math.sin(a) * (s * 8 + 2.5);
          this.life = 60; this.col = PAL.violet;
          this.sz = Math.random() * 5.5 + 2;
          this.drag = 0.96; this.grav = 0.14; break;

        default:
          this.vx = 0; this.vy = 0; this.life = 1;
          this.col = PAL.white; this.sz = 1; this.drag = 1; this.grav = 0;
      }
      this.maxLife = this.life;
    }

    update(dt) {
      this.vx  *= Math.pow(this.drag, dt);
      this.vy   = this.vy * Math.pow(this.drag, dt) + this.grav * dt;
      this.x   += this.vx * dt;
      this.y   += this.vy * dt;
      this.sz  *= Math.pow(0.965, dt);
      this.life -= dt;
    }

    draw() {
      const t = Math.max(0, this.life / this.maxLife);
      ctx.globalAlpha = t * 0.85;
      ctx.shadowBlur  = 10;
      ctx.shadowColor = this.col;
      ctx.fillStyle   = this.col;
      ctx.beginPath();
      ctx.arc(this.x, this.y, Math.max(0.1, this.sz), 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1; ctx.shadowBlur = 0;
    }
  }

  // ── FloatText ──────────────────────────────────────────────────
  class FloatText {
    constructor(x, y, txt, col) {
      this.x = x; this.y = y; this.txt = txt; this.col = col;
      this.life = 52; this.maxLife = 52; this.vy = -1.2;
    }
    update(dt) { this.y += this.vy * dt; this.life -= dt; }
    draw() {
      const t = Math.max(0, this.life / this.maxLife);
      ctx.save();
      ctx.globalAlpha  = Math.min(1, t * 2.5);
      ctx.font         = `800 ${Math.round(11 + (1 - t) * 4)}px Poppins, sans-serif`;
      ctx.textAlign    = 'center';
      ctx.fillStyle    = this.col;
      ctx.shadowBlur   = 14;
      ctx.shadowColor  = this.col;
      ctx.fillText(this.txt, this.x, this.y);
      ctx.restore();
    }
  }

  // ══════════════════════════════════════════════════════════════
  //  HELPERS
  // ══════════════════════════════════════════════════════════════

  function newArcOffsets() {
    return Array.from({ length: 8 }, (_, i) =>
      (i === 0 || i === 7) ? 0 : (Math.random() - 0.5) * 22
    );
  }

  function spawnBurst(x, y, type, n) {
    for (let i = 0; i < n; i++) particles.push(new Particle(x, y, type));
  }

  function setShield(on) {
    shielded = on;
    elShieldBar.classList.toggle('visible', on);
    elShieldText.classList.toggle('visible', on);
    syncCorners();
  }

  function syncCorners() {
    const col = shielded ? PAL.violet : `hsl(${dynHue},92%,62%)`;
    elWrap.style.setProperty('--dyn-accent', col);
  }

  function updateScore() {
    elScoreNum.textContent = score;

    // Dynamic hue shift (185 cyan → 340 pink as score rises)
    dynHue = Math.min(185 + score * 3.1, 340);
    elWrap.style.setProperty('--dyn-hue', dynHue);
    syncCorners();

    // Web Animations API pop
    if (!prefersReducedMotion && elScoreNum.animate) {
      elScoreNum.animate(
        [{ transform: 'scale(1.32)', filter: 'brightness(2)' },
         { transform: 'scale(1)',    filter: 'brightness(1)' }],
        { duration: 230, easing: 'cubic-bezier(0.22,1,0.36,1)' }
      );
    }

    // Combo badge
    if (mult > 1) {
      elComboText.textContent = '×' + mult + ' COMBO';
      elComboBadge.classList.add('visible');
    } else {
      elComboBadge.classList.remove('visible');
    }
  }

  // ══════════════════════════════════════════════════════════════
  //  DRAW ROUTINES
  // ══════════════════════════════════════════════════════════════

  function drawBG(dt) {
    ctx.fillStyle = PAL.bg;
    ctx.fillRect(0, 0, W, H);

    const gspd = gs === 'PLAYING'
      ? DIFF[curDiff].spd + Math.min(score * 0.020, 2.2)
      : 1.5;
    const CELL = 60;
    gridOX = (gridOX + gspd * 0.42 * dt) % CELL;
    gridOY = (gridOY + gspd * 0.14 * dt) % CELL;

    ctx.strokeStyle = 'rgba(34,211,238,0.034)';
    ctx.lineWidth   = 1;
    for (let x = W - (gridOX % CELL); x > -CELL; x -= CELL) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (let y = -(gridOY % CELL); y < H + CELL; y += CELL) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }

    // Ambient glow
    const ag = ctx.createRadialGradient(W * .5, H * .5, 0, W * .5, H * .5, W * .72);
    ag.addColorStop(0, 'rgba(34,211,238,0.014)');
    ag.addColorStop(1, 'transparent');
    ctx.fillStyle = ag;
    ctx.fillRect(0, 0, W, H);

    // Vignette
    const vig = ctx.createRadialGradient(W * .5, H * .5, W * .15, W * .5, H * .5, W * .88);
    vig.addColorStop(0, 'transparent');
    vig.addColorStop(1, 'rgba(6,6,18,0.58)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, W, H);
  }

  function drawFloor() {
    ctx.shadowBlur  = 10;
    ctx.shadowColor = PAL.pink;
    ctx.strokeStyle = 'rgba(244,114,182,0.55)';
    ctx.lineWidth   = 1.2;
    ctx.beginPath();
    ctx.moveTo(0, H - 0.5); ctx.lineTo(W, H - 0.5);
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  function drawFlash(dt) {
    if (flashAlpha > 0.006) {
      ctx.fillStyle = `rgba(244,114,182,${flashAlpha * 0.40})`;
      ctx.fillRect(0, 0, W, H);
      flashAlpha *= Math.pow(0.86, dt);
    }
  }

  function drawMenuOrb() {
    const t   = frame * 0.015;
    const ox  = W * 0.5;
    const oy  = H * 0.38 + Math.sin(t) * 12;
    const p   = 1 + Math.sin(t * 2.5) * 0.09;
    const col = `hsl(${dynHue},92%,62%)`;

    ctx.fillStyle   = col;
    ctx.shadowColor = col;
    [[B_VIS_R * 5 * p, 0.028], [B_VIS_R * 2.5, 0.12], [B_VIS_R, 1.0]]
      .forEach(([r, a]) => {
        ctx.shadowBlur  = 40;
        ctx.globalAlpha = a;
        ctx.beginPath(); ctx.arc(ox, oy, r, 0, Math.PI * 2); ctx.fill();
      });

    ctx.shadowBlur  = 14; ctx.shadowColor = PAL.white;
    ctx.fillStyle   = PAL.white; ctx.globalAlpha = 1;
    ctx.beginPath(); ctx.arc(ox - 3.5, oy - 3.5, B_VIS_R * 0.28, 0, Math.PI * 2); ctx.fill();

    ctx.globalAlpha = 1; ctx.shadowBlur = 0;
  }

  // ══════════════════════════════════════════════════════════════
  //  GAME FLOW
  // ══════════════════════════════════════════════════════════════

  function initSession() {
    bird       = new Bird();
    pipes      = [];
    particles  = [];
    floatTexts = [];
    powerups   = [];
    frame      = 0;
    gridOX     = gridOY = 0;
    flashAlpha = 0;
    score      = 0;
    combo      = 0;
    mult       = 1;
    shielded   = false;
    dynHue     = 185;
    SHAKE.pos  = SHAKE.vel = 0;

    elScoreNum.textContent = '0';
    elBestNum.textContent  = best > 0 ? best : '—';
    elComboBadge.classList.remove('visible');
    elShieldBar.classList.remove('visible');
    elShieldText.classList.remove('visible');
    elVelFill.style.height = '0%';
    elWrap.style.setProperty('--dyn-hue', '185');
    syncCorners();
  }

  function triggerDeath() {
    if (gs !== 'PLAYING') return;
    gs         = 'DEAD';
    bird.alive = false;

    addShake(24);
    flashAlpha = 1;
    spawnBurst(bird.x, bird.y, 'death', prefersReducedMotion ? 18 : 60);

    const isNew = score > best;
    if (isNew) {
      best = score;
      localStorage.setItem('nb_best4', best);
    }

    setTimeout(function () {
      if (gs !== 'DEAD') return;
      gs = 'GAMEOVER';
      elFinal.textContent           = score;
      elBestFin.textContent         = best;
      elNewBest.style.display       = isNew ? 'block' : 'none';
      elOver.classList.remove('hidden');
    }, 960);
  }

  // ══════════════════════════════════════════════════════════════
  //  MAIN LOOP
  // ══════════════════════════════════════════════════════════════

  const bgStars = Array.from({ length: 110 }, function () { return new PxStar(true); });

  function loop(now) {
    const dt = Math.min((now - lastTs) / 16.667, 2.5) || 1;
    lastTs = now;

    // Update
    bgStars.forEach(function (s) { s.update(dt); });
    stepShake();

    if (gs === 'PLAYING') {
      bird.update(dt);

      if (frame % DIFF[curDiff].rate === 0) {
        const p = new Pipe();
        pipes.push(p);
        if (score > 2 && !shielded && Math.random() < 0.26) {
          powerups.push(new PowerUp(p.x + p.w * 0.5, p.topH + p.gap * 0.5, p.curSpd));
        }
      }

      pipes.forEach(function (p) { p.update(dt); });
      pipes = pipes.filter(function (p) { return p.x + p.w > -40; });

      powerups.forEach(function (p) { p.update(dt); });
      powerups = powerups.filter(function (p) { return !p.done && p.x > -40; });
    }

    particles.forEach(function (p) { p.update(dt); });
    particles = particles.filter(function (p) { return p.life > 0; });

    floatTexts.forEach(function (t) { t.update(dt); });
    floatTexts = floatTexts.filter(function (t) { return t.life > 0; });

    // Render
    ctx.save();
    if (!prefersReducedMotion && Math.abs(SHAKE.pos) > 0.05) {
      ctx.translate(SHAKE.pos * 1.0, SHAKE.pos * 0.55);
    }

    drawBG(dt);
    bgStars.forEach(function (s) { s.draw(); });
    pipes.forEach(function (p) { p.draw(); });

    if (gs === 'PLAYING' || gs === 'DEAD') {
      powerups.forEach(function (p) { p.draw(); });
    }

    particles.forEach(function (p) { p.draw(); });
    floatTexts.forEach(function (t) { t.draw(); });

    if (gs === 'MENU') { drawMenuOrb(); }
    else               { bird.draw(); }

    drawFloor();
    drawFlash(dt);
    ctx.restore();

    frame++;
    requestAnimationFrame(loop);
  }

  // ══════════════════════════════════════════════════════════════
  //  INPUT
  // ══════════════════════════════════════════════════════════════

  function handleAction() {
    if      (gs === 'PLAYING')  bird.flap();
    else if (gs === 'MENU')     window.startGame();
    else if (gs === 'GAMEOVER') window.restartGame();
  }

  canvas.addEventListener('pointerdown', function (e) {
    e.preventDefault();
    handleAction();
  }, { passive: false });

  document.addEventListener('keydown', function (e) {
    if (e.code === 'Space' || e.code === 'ArrowUp') {
      e.preventDefault();
      handleAction();
    }
  });

  // ══════════════════════════════════════════════════════════════
  //  RESPONSIVE SCALING  (ResizeObserver)
  // ══════════════════════════════════════════════════════════════

  function fitStage() {
    const s = Math.min(window.innerWidth / W, window.innerHeight / H) * 0.965;
    elWrap.style.transform = 'scale(' + s + ')';
    elWrapOuter.style.width  = W + 'px';
    elWrapOuter.style.height = H + 'px';
  }
  const ro = new ResizeObserver(fitStage);
  ro.observe(document.documentElement);
  fitStage();

  // ══════════════════════════════════════════════════════════════
  //  CUSTOM CURSOR
  // ══════════════════════════════════════════════════════════════

  if (elCursor && elCursorRing) {
    let cx = 200, cy = 300, rx = 200, ry = 300;
    document.addEventListener('pointermove', function (e) {
      cx = e.clientX; cy = e.clientY;
      elCursor.style.left = cx + 'px';
      elCursor.style.top  = cy + 'px';
    });
    (function animRing() {
      rx += (cx - rx) * 0.14;
      ry += (cy - ry) * 0.14;
      elCursorRing.style.left = rx + 'px';
      elCursorRing.style.top  = ry + 'px';
      requestAnimationFrame(animRing);
    })();
  }

  // ══════════════════════════════════════════════════════════════
  //  GLOBAL FUNCTIONS  (exposed for HTML onclick)
  // ══════════════════════════════════════════════════════════════

  window.selectDifficulty = function (d) {
    curDiff = d;
    document.querySelectorAll('.diff-btn').forEach(function (b) {
      b.classList.remove('selected');
    });
    var btn = document.getElementById('btn-' + d);
    if (btn) btn.classList.add('selected');
  };

  window.startGame = function () {
    initSession();
    gs = 'PLAYING';
    elMenu.classList.add('hidden');
    elOver.classList.add('hidden');
  };

  window.restartGame = function () {
    initSession();
    gs = 'PLAYING';
    elOver.classList.add('hidden');
  };

  window.showMenu = function () {
    gs = 'MENU';
    elMenu.classList.remove('hidden');
    elOver.classList.add('hidden');
  };

  // ══════════════════════════════════════════════════════════════
  //  BOOT
  // ══════════════════════════════════════════════════════════════

  initSession();
  requestAnimationFrame(loop);

}); // end DOMContentLoaded
