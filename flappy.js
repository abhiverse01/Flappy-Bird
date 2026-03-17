// ════════════════════════════════════════════════════════════════════
//  NANO·BIRD — Cyber Flight  |  God Mode  |  Full Rewrite v3
//  © 2026 Abhishek Shah · linkedin.com/in/theabhishekshah
//  abhishekshah.vercel.app
//
//  Features:
//    · Delta-time physics (frame-rate independent)
//    · Proxy-based reactive state → auto DOM sync
//    · ResizeObserver responsive canvas scaling
//    · CSS custom property injection from JS (dynamic theme)
//    · Web Animations API for score pop
//    · Pointer Events API for unified input
//    · matchMedia reduced-motion support
//    · Spring-eased screen shake
//    · 3-layer parallax star field
//    · Velocity bar HUD
//    · Combo multiplier (×2, ×3) with badge animation
//    · Shield power-up with orbiting particles
//    · Dynamic hue theming as score rises
//    · Death burst + screen flash
// ════════════════════════════════════════════════════════════════════

'use strict';

// ── Canvas & context ─────────────────────────────────────────────
const canvas = document.getElementById('gc');
const ctx    = canvas.getContext('2d', { alpha: false });
const W = 400, H = 600;

// ── Reduced-motion preference ────────────────────────────────────
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ── Palette ──────────────────────────────────────────────────────
const PAL = {
  bg:       '#060612',
  cyan:     '#22d3ee',
  pink:     '#f472b6',
  amber:    '#fbbf24',
  violet:   '#a78bfa',
  white:    '#f1f5f9',
};

// ── Physics (units = pixels @ 60 fps; normalised by dt) ─────────
const GRAVITY    = 0.40;
const TERM_VEL   = 9.8;
const FLAP_FORCE = -8.8;
const PIPE_W     = 52;
const B_VIS_R    = 11;
const B_HIT_R    = 7.2;   // forgiving hitbox
const TRAIL_LEN  = 30;

// ── Difficulty ───────────────────────────────────────────────────
const DIFF = {
  easy:   { gap: 165, spd: 2.2, rate: 195 },
  hard:   { gap: 128, spd: 3.3, rate: 148 },
  insane: { gap:  95, spd: 5.2, rate: 106 },
};

// ── Game loop timing ─────────────────────────────────────────────
let lastTs  = 0;
let frame   = 0;

// ── Screen shake (spring) ────────────────────────────────────────
const SHAKE = { vel: 0, pos: 0, SPRING: 0.18, DAMP: 0.72 };
function triggerShake(impulse) {
  if (reducedMotion) return;
  SHAKE.vel += impulse;
}
function stepShake() {
  SHAKE.vel += -SHAKE.spring * SHAKE.pos;
  SHAKE.vel *= SHAKE.DAMP;
  SHAKE.pos += SHAKE.vel;
  if (Math.abs(SHAKE.pos) < 0.05 && Math.abs(SHAKE.vel) < 0.05) {
    SHAKE.pos = SHAKE.vel = 0;
  }
}
SHAKE.spring = SHAKE.SPRING; // alias fix

// ── DOM ──────────────────────────────────────────────────────────
const DOM = {
  wrap:        document.getElementById('wrap'),
  wrapOuter:   document.getElementById('wrap-outer'),
  scoreNum:    document.getElementById('score-num'),
  bestNum:     document.getElementById('best-num'),
  comboBadge:  document.getElementById('combo-badge'),
  comboText:   document.getElementById('combo-text'),
  velFill:     document.getElementById('vel-fill'),
  shieldBar:   document.getElementById('shield-bar'),
  shieldText:  document.getElementById('shield-text'),
  menuScreen:  document.getElementById('menu-screen'),
  gameOver:    document.getElementById('gameover-screen'),
  finalScore:  document.getElementById('final-score'),
  bestScore:   document.getElementById('best-score'),
  newBestTag:  document.getElementById('new-best-tag'),
  cursor:      document.getElementById('cursor'),
  cursorRing:  document.getElementById('cursor-ring'),
};

// ── Reactive state via Proxy ─────────────────────────────────────
const _state = {
  score:   0,
  best:    parseInt(localStorage.getItem('nb_best3') || '0', 10),
  combo:   0,
  mult:    1,
  shield:  false,
  gs:      'MENU',   // MENU | PLAYING | DEAD | GAMEOVER
  diff:    'easy',
};

const State = new Proxy(_state, {
  set(target, key, val) {
    const prev = target[key];
    target[key] = val;

    if (key === 'score' && val !== prev) {
      DOM.scoreNum.textContent = val;
      if (!reducedMotion) {
        DOM.scoreNum.animate(
          [{ transform:'scale(1.3)', filter:'brightness(2)' },
           { transform:'scale(1)',   filter:'brightness(1)' }],
          { duration: 230, easing: 'cubic-bezier(0.22,1,0.36,1)' }
        );
      }
      _updateHue(val);
    }

    if (key === 'best') {
      DOM.bestNum.textContent = val;
      localStorage.setItem('nb_best3', val);
    }

    if (key === 'mult' && val !== prev) {
      if (val > 1) {
        DOM.comboText.textContent = '×' + val + ' COMBO';
        DOM.comboBadge.classList.add('visible');
      } else {
        DOM.comboBadge.classList.remove('visible');
      }
    }

    if (key === 'shield') {
      DOM.shieldBar.classList.toggle('visible', val);
      DOM.shieldText.classList.toggle('visible', val);
      // Shift orb color hint via corner brackets
      _syncCorners(val ? PAL.violet : null);
    }

    return true;
  }
});

// ── Dynamic hue theming ───────────────────────────────────────────
function _updateHue(score) {
  // 185 (cyan) → 340 (pink-red) as score climbs 0→50
  const hue = Math.min(185 + score * 3.1, 340);
  DOM.wrap.style.setProperty('--dyn-hue', hue);
  // update corner bracket colour accent
  _syncCorners(null);
}

function _syncCorners(override) {
  const val = override || `hsl(${DOM.wrap.style.getPropertyValue('--dyn-hue') || 185}, 92%, 62%)`;
  DOM.wrap.style.setProperty('--dyn-accent', val);
}

// ── Responsive scaling via ResizeObserver ────────────────────────
(function setupResize() {
  function fit() {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const s  = Math.min(vw / W, vh / H) * 0.965;
    DOM.wrap.style.transform = `scale(${s})`;
    // Outer shadow container matches visual footprint
    DOM.wrapOuter.style.width  = W + 'px';
    DOM.wrapOuter.style.height = H + 'px';
  }
  const ro = new ResizeObserver(fit);
  ro.observe(document.documentElement);
  fit();
})();

// ── Custom cursor ─────────────────────────────────────────────────
(function setupCursor() {
  let cx = W / 2, cy = H / 2;
  let rx = cx,    ry = cy;
  document.addEventListener('pointermove', e => {
    cx = e.clientX; cy = e.clientY;
    DOM.cursor.style.left = cx + 'px';
    DOM.cursor.style.top  = cy + 'px';
  });
  // Lag ring for premium feel
  (function animRing() {
    rx += (cx - rx) * 0.14;
    ry += (cy - ry) * 0.14;
    DOM.cursorRing.style.left = rx + 'px';
    DOM.cursorRing.style.top  = ry + 'px';
    requestAnimationFrame(animRing);
  })();
  // Hide native cursor on canvas
  canvas.style.cursor = 'none';
})();

// ═══════════════════════════════════════════════════════════════════
//  PARALLAX STARS
// ═══════════════════════════════════════════════════════════════════
class PxStar {
  constructor(seedX) {
    this.layer = Math.floor(Math.random() * 3);
    this._reset(seedX);
  }
  _reset(seedX) {
    const LAYERS = [[0.10, 0.28, 0.16], [0.32, 0.70, 0.38], [0.75, 1.30, 0.66]];
    const [spd, sz, op] = LAYERS[this.layer];
    this.x   = seedX ? Math.random() * W : W + 2;
    this.y   = Math.random() * H;
    this.spd = spd + Math.random() * 0.06;
    this.sz  = sz  + Math.random() * 0.15;
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

// ═══════════════════════════════════════════════════════════════════
//  BIRD
// ═══════════════════════════════════════════════════════════════════
class Bird {
  constructor() {
    this.x     = 88;
    this.y     = H * 0.47;
    this.vy    = 0;
    this.rot   = 0;
    this.phase = 0;
    this.orbPh = 0;
    this.trail = [];   // {x, y, shielded}
    this.alive = true;
  }

  flap() {
    this.vy = FLAP_FORCE;
    _spawnBurst(this.x, this.y, 'flap', reducedMotion ? 4 : 12);
  }

  update(dt) {
    if (!this.alive) return;

    this.vy    = Math.min(this.vy + GRAVITY * dt, TERM_VEL);
    this.y    += this.vy * dt;
    this.phase += 0.09 * dt;
    this.orbPh += 0.075 * dt;

    // Trail
    this.trail.unshift({ x: this.x, y: this.y, sh: State.shield });
    if (this.trail.length > TRAIL_LEN) this.trail.pop();

    // Rotation (smooth lerp)
    const tRot = this.vy < 0 ? -0.44 : Math.min(1.35, this.vy * 0.13);
    this.rot  += (tRot - this.rot) * 0.13;

    // Update velocity HUD bar (0 = up, 1 = max down)
    const velNorm = Math.max(0, Math.min(1, (this.vy + Math.abs(FLAP_FORCE)) / (TERM_VEL + Math.abs(FLAP_FORCE))));
    DOM.velFill.style.setProperty('--vel-norm', velNorm);
    DOM.wrap.style.setProperty('--vel-norm', velNorm);

    // Bounds
    if (this.y + B_HIT_R >= H) { this.y = H - B_HIT_R; _die(); }
    if (this.y - B_HIT_R <= 0) { this.y = B_HIT_R; this.vy = 0; }
  }

  draw() {
    const shHue = DOM.wrap.style.getPropertyValue('--dyn-hue') || '185';
    const coreColor = State.shield
      ? PAL.violet
      : `hsl(${shHue}, 92%, 62%)`;

    // ── Trail ──
    for (let i = this.trail.length - 1; i >= 0; i--) {
      const tp  = this.trail[i];
      const t   = 1 - i / TRAIL_LEN;
      const tc  = tp.sh ? PAL.violet : coreColor;
      const r   = B_VIS_R * t * 0.78;
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

    // Glow halos
    const layers = [
      { r: B_VIS_R * 4.5 * p, a: 0.035 },
      { r: B_VIS_R * 2.6 * p, a: 0.09  },
      { r: B_VIS_R * 1.6 * p, a: 0.20  },
    ];
    layers.forEach(({ r, a }) => {
      ctx.globalAlpha = a;
      ctx.shadowBlur  = 36;
      ctx.shadowColor = coreColor;
      ctx.fillStyle   = coreColor;
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
    });

    // Solid core
    ctx.globalAlpha = 1;
    ctx.shadowBlur  = 26;
    ctx.shadowColor = coreColor;
    ctx.fillStyle   = coreColor;
    ctx.beginPath(); ctx.arc(0, 0, B_VIS_R, 0, Math.PI * 2); ctx.fill();

    // Radial inner highlight
    const ig = ctx.createRadialGradient(-3.5, -3.5, 0, 0, 0, B_VIS_R);
    ig.addColorStop(0,    'rgba(255,255,255,0.94)');
    ig.addColorStop(0.38, 'rgba(255,255,255,0.12)');
    ig.addColorStop(1,    'rgba(255,255,255,0)');
    ctx.shadowBlur = 0;
    ctx.fillStyle  = ig;
    ctx.beginPath(); ctx.arc(0, 0, B_VIS_R, 0, Math.PI * 2); ctx.fill();

    // ── Shield ring + orbiting dots ──
    if (State.shield) {
      const ringR = B_VIS_R * 2.2 + Math.sin(this.phase * 3.5) * 2.0;
      ctx.globalAlpha = 0.60 + 0.20 * Math.sin(this.phase * 5);
      ctx.shadowBlur  = 22;
      ctx.shadowColor = PAL.violet;
      ctx.strokeStyle = PAL.violet;
      ctx.lineWidth   = 1.5;
      ctx.beginPath(); ctx.arc(0, 0, ringR, 0, Math.PI * 2); ctx.stroke();

      for (let i = 0; i < 3; i++) {
        const a = this.orbPh + i * (Math.PI * 2 / 3);
        ctx.globalAlpha = 0.92;
        ctx.shadowBlur  = 12;
        ctx.fillStyle   = PAL.violet;
        ctx.beginPath();
        ctx.arc(Math.cos(a) * ringR, Math.sin(a) * ringR, 2.8, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.globalAlpha = 1; ctx.shadowBlur = 0;
    ctx.restore();
  }
}

// ═══════════════════════════════════════════════════════════════════
//  PIPE
// ═══════════════════════════════════════════════════════════════════
class Pipe {
  constructor() {
    this.x   = W + 10;
    this.w   = PIPE_W;
    const d  = DIFF[State.diff];
    this.gap = d.gap;
    this.spd = d.spd;

    const mn = 52, mx = H - this.gap - mn;
    this.topH   = Math.round(Math.random() * (mx - mn)) + mn;
    this.botY   = this.topH + this.gap;
    this.passed = false;
    this.pph    = Math.random() * Math.PI * 2; // pulse phase
    this.arcOff = _newArcOffsets();
    this.arcAge = 0;
  }

  get curSpd() {
    return this.spd + Math.min(State.score * 0.020, 2.2);
  }

  update(dt) {
    this.x    -= this.curSpd * dt;
    this.pph  += 0.040 * dt;
    this.arcAge += dt;
    if (this.arcAge > 7) { this.arcOff = _newArcOffsets(); this.arcAge = 0; }

    // ── AABB Collision ──
    if (bird.x + B_HIT_R > this.x && bird.x - B_HIT_R < this.x + this.w) {
      if (bird.y - B_HIT_R < this.topH || bird.y + B_HIT_R > this.botY) {
        if (State.shield) {
          State.shield = false;
          triggerShake(16);
          bird.vy = FLAP_FORCE * 0.55;
          _spawnBurst(bird.x, bird.y, 'shield_break', reducedMotion ? 12 : 35);
        } else {
          _die();
        }
      }
    }

    // ── Score ──
    if (!this.passed && this.x + this.w < bird.x) {
      this.passed  = true;
      State.combo += 1;
      const newMult = State.combo >= 10 ? 3 : State.combo >= 5 ? 2 : 1;
      State.mult    = newMult;
      State.score  += newMult;
      floatTexts.push(new FloatText(
        this.x + this.w / 2,
        this.topH + this.gap / 2,
        '+' + newMult,
        newMult > 1 ? PAL.pink : PAL.cyan
      ));
    }
  }

  draw() {
    const gp = 0.68 + 0.32 * Math.sin(this.pph);
    this._seg(this.x, 0,         this.w, this.topH,      true,  gp);
    this._seg(this.x, this.botY, this.w, H - this.botY,  false, gp);
    this._arc(gp);
  }

  _seg(x, y, w, h, isTop, gp) {
    // Body fill
    ctx.globalAlpha = 0.055;
    ctx.fillStyle   = PAL.pink;
    ctx.fillRect(x, y, w, h);

    // Side border
    ctx.globalAlpha = 1;
    ctx.shadowBlur  = 8 * gp;
    ctx.shadowColor = PAL.pink;
    ctx.strokeStyle = `rgba(244,114,182,${0.45 * gp})`;
    ctx.lineWidth   = 1;
    ctx.strokeRect(x, y, w, h);

    // Cap
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

    // Highlight stripe
    ctx.globalAlpha = 0.26 * gp;
    ctx.fillStyle   = PAL.white;
    ctx.fillRect(capX + 2, capY + 4, capW - 4, 1.5);

    // Corner pixel squares (tech detail)
    ctx.globalAlpha = 0.70 * gp;
    ctx.fillStyle   = PAL.pink;
    const cs = 3;
    [[capX, capY],[capX+capW-cs, capY],[capX, capY+capH-cs],[capX+capW-cs, capY+capH-cs]]
      .forEach(([bx, by]) => ctx.fillRect(bx, by, cs, cs));

    ctx.globalAlpha = 1; ctx.shadowBlur = 0;
  }

  _arc(gp) {
    const n  = this.arcOff.length - 1;
    const cx = this.x + this.w / 2;
    const flicker = 0.5 + 0.5 * Math.sin(frame * 0.17 + this.pph * 2);

    ctx.save();
    ctx.globalAlpha = 0.22 * gp * flicker;
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

function _newArcOffsets() {
  return Array.from({ length: 8 }, (_, i) =>
    (i === 0 || i === 7) ? 0 : (Math.random() - 0.5) * 22
  );
}

// ═══════════════════════════════════════════════════════════════════
//  POWER-UP (shield gem)
// ═══════════════════════════════════════════════════════════════════
class PowerUp {
  constructor(x, y, pipeSpd) {
    this.x    = x;
    this.y    = y;
    this.spd  = pipeSpd;
    this.r    = 13;
    this.done = false;
    this.ph   = Math.random() * Math.PI * 2;
    this.hp   = Math.random() * Math.PI * 2;
    this.sp   = 0; // spawn scale-in
  }

  update(dt) {
    this.x  -= (this.spd + Math.min(State.score * 0.020, 2.2)) * dt;
    this.ph += 0.070 * dt;
    this.hp += 0.050 * dt;
    this.sp  = Math.min(1, this.sp + dt * 0.08);

    const dist = Math.hypot(this.x - bird.x, this.y - bird.y);
    if (dist < this.r + B_HIT_R + 6) {
      this.done   = true;
      State.shield = true;
      _spawnBurst(this.x, this.y, 'collect', reducedMotion ? 12 : 32);
    }
  }

  draw() {
    const s   = this.sp;  // scale-in factor 0→1
    const hy  = Math.sin(this.hp) * 5;
    const pul = 1 + Math.sin(this.ph * 2.2) * 0.10;
    const r   = this.r * pul * s;

    // Proximity pulse ring
    const dist  = Math.hypot(this.x - bird.x, this.y - bird.y);
    const prox  = Math.max(0, 1 - dist / 130);

    ctx.save();
    ctx.translate(this.x, this.y + hy);

    if (prox > 0.03 && !reducedMotion) {
      ctx.globalAlpha = prox * 0.28;
      ctx.strokeStyle = PAL.violet;
      ctx.lineWidth   = 1;
      ctx.beginPath();
      ctx.arc(0, 0, r + 14 + prox * 12, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.rotate(this.ph * 0.85);

    // Outer glow ring
    ctx.globalAlpha = 0.50 * s;
    ctx.shadowBlur  = 22;
    ctx.shadowColor = PAL.violet;
    ctx.strokeStyle = PAL.violet;
    ctx.lineWidth   = 1.3;
    ctx.beginPath();
    ctx.arc(0, 0, r + 8, 0, Math.PI * 2);
    ctx.stroke();

    // Diamond body
    ctx.globalAlpha = 1 * s;
    ctx.shadowBlur  = 20;
    ctx.fillStyle   = 'rgba(167,139,250,0.16)';
    ctx.strokeStyle = PAL.violet;
    ctx.lineWidth   = 1.8;
    ctx.beginPath();
    ctx.moveTo(0,-r); ctx.lineTo(r,0); ctx.lineTo(0,r); ctx.lineTo(-r,0);
    ctx.closePath();
    ctx.fill(); ctx.stroke();

    // Inner counter-spin
    ctx.rotate(-this.ph * 1.8);
    const si = r * 0.44;
    ctx.shadowBlur  = 8;
    ctx.strokeStyle = 'rgba(196,181,253,0.7)';
    ctx.lineWidth   = 1.1;
    ctx.beginPath();
    ctx.moveTo(0,-si); ctx.lineTo(si,0); ctx.lineTo(0,si); ctx.lineTo(-si,0);
    ctx.closePath(); ctx.stroke();

    ctx.globalAlpha = 1; ctx.shadowBlur = 0;
    ctx.restore();
  }
}

// ═══════════════════════════════════════════════════════════════════
//  PARTICLE
// ═══════════════════════════════════════════════════════════════════
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
        this.vx = Math.cos(a) * (s * 7.0 + 2.5);
        this.vy = Math.sin(a) * (s * 7.0 + 2.5);
        this.life = 85;
        this.col = [PAL.cyan, PAL.pink, PAL.white, PAL.amber][Math.floor(Math.random() * 4)];
        this.sz = Math.random() * 6 + 2;
        this.drag = 0.97; this.grav = 0.16; break;

      case 'collect':
        this.vx = Math.cos(a) * (s * 5.0 + 1.2);
        this.vy = Math.sin(a) * (s * 5.0 + 1.2);
        this.life = 50; this.col = PAL.violet;
        this.sz = Math.random() * 4 + 1;
        this.drag = 0.96; this.grav = -0.02; break; // slight float

      case 'shield_break':
        this.vx = Math.cos(a) * (s * 8.0 + 2.5);
        this.vy = Math.sin(a) * (s * 8.0 + 2.5);
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

// ═══════════════════════════════════════════════════════════════════
//  FLOAT TEXT
// ═══════════════════════════════════════════════════════════════════
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
    ctx.font         = `800 ${11 + (1 - t) * 4}px Poppins, sans-serif`;
    ctx.textAlign    = 'center';
    ctx.fillStyle    = this.col;
    ctx.shadowBlur   = 14;
    ctx.shadowColor  = this.col;
    ctx.fillText(this.txt, this.x, this.y);
    ctx.restore();
  }
}

// ═══════════════════════════════════════════════════════════════════
//  BACKGROUND
// ═══════════════════════════════════════════════════════════════════
let gridOX = 0, gridOY = 0;
let flashAlpha = 0;

function drawBG(dt) {
  // Solid base
  ctx.fillStyle = PAL.bg;
  ctx.fillRect(0, 0, W, H);

  // Grid scroll speed matches current pipe speed
  const gspd  = State.gs === 'PLAYING'
    ? DIFF[State.diff].spd + Math.min(State.score * 0.020, 2.2)
    : 1.5;
  const CELL  = 60;
  gridOX = (gridOX + gspd * 0.42 * dt) % CELL;
  gridOY = (gridOY + gspd * 0.14 * dt) % CELL;

  // Vertical lines
  ctx.strokeStyle = 'rgba(34,211,238,0.036)';
  ctx.lineWidth   = 1;
  for (let x = W - (gridOX % CELL); x > -CELL; x -= CELL) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
  }
  // Horizontal lines
  for (let y = -(gridOY % CELL); y < H + CELL; y += CELL) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }

  // Subtle ambient glow at center
  const ag = ctx.createRadialGradient(W*.5, H*.5, 0, W*.5, H*.5, W*.7);
  ag.addColorStop(0, 'rgba(34,211,238,0.016)');
  ag.addColorStop(1, 'transparent');
  ctx.fillStyle = ag;
  ctx.fillRect(0, 0, W, H);

  // Vignette
  const vig = ctx.createRadialGradient(W*.5, H*.5, W*.15, W*.5, H*.5, W*.85);
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
  ctx.shadowBlur  = 0;
}

function drawFlash(dt) {
  if (flashAlpha > 0.005) {
    ctx.fillStyle = `rgba(244,114,182,${flashAlpha * 0.42})`;
    ctx.fillRect(0, 0, W, H);
    flashAlpha *= Math.pow(0.86, dt);
  }
}

function drawMenuOrb() {
  const t   = frame * 0.015;
  const ox  = W * 0.5;
  const oy  = H * 0.38 + Math.sin(t) * 12;
  const p   = 1 + Math.sin(t * 2.5) * 0.09;
  const hue = DOM.wrap.style.getPropertyValue('--dyn-hue') || '185';
  const col = `hsl(${hue}, 92%, 62%)`;

  ctx.fillStyle   = col;
  ctx.shadowColor = col;
  [[B_VIS_R * 5.0 * p, 0.028], [B_VIS_R * 2.5, 0.12], [B_VIS_R, 1.0]]
    .forEach(([r, a]) => {
      ctx.shadowBlur  = 40;
      ctx.globalAlpha = a;
      ctx.beginPath(); ctx.arc(ox, oy, r, 0, Math.PI * 2); ctx.fill();
    });

  // Specular
  ctx.shadowBlur  = 14; ctx.shadowColor = PAL.white;
  ctx.fillStyle   = PAL.white; ctx.globalAlpha = 1;
  ctx.beginPath(); ctx.arc(ox - 3.5, oy - 3.5, B_VIS_R * 0.28, 0, Math.PI * 2); ctx.fill();

  ctx.globalAlpha = 1; ctx.shadowBlur = 0;
}

// ═══════════════════════════════════════════════════════════════════
//  ENTITY COLLECTIONS
// ═══════════════════════════════════════════════════════════════════
let bird, pipes, particles, floatTexts, powerups;
let bgStars = Array.from({ length: 110 }, () => new PxStar(true));

// ═══════════════════════════════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════════════════════════════
function _spawnBurst(x, y, type, n) {
  for (let i = 0; i < n; i++) particles.push(new Particle(x, y, type));
}

// ═══════════════════════════════════════════════════════════════════
//  GAME FLOW
// ═══════════════════════════════════════════════════════════════════
function _initSession() {
  bird       = new Bird();
  pipes      = [];
  particles  = [];
  floatTexts = [];
  powerups   = [];
  frame      = 0;
  gridOX     = gridOY = 0;
  flashAlpha = 0;
  SHAKE.pos  = SHAKE.vel = 0;

  State.score  = 0;
  State.combo  = 0;
  State.mult   = 1;
  State.shield = false;

  DOM.wrap.style.setProperty('--dyn-hue', '185');
  _syncCorners(null);
  DOM.velFill.style.setProperty('--vel-norm', '0');
  DOM.wrap.style.setProperty('--vel-norm', '0');
}

// Global functions (called from HTML onclick)
function selectDifficulty(d) {
  _state.diff = d;
  document.querySelectorAll('.diff-btn').forEach(b => b.classList.remove('selected'));
  document.getElementById('btn-' + d).classList.add('selected');
}

function startGame() {
  _initSession();
  _state.gs = 'PLAYING';
  DOM.menuScreen.classList.add('hidden');
  DOM.gameOver.classList.add('hidden');
}

function restartGame() {
  _initSession();
  _state.gs = 'PLAYING';
  DOM.gameOver.classList.add('hidden');
}

function showMenu() {
  _state.gs = 'MENU';
  DOM.menuScreen.classList.remove('hidden');
  DOM.gameOver.classList.add('hidden');
}

function _die() {
  if (_state.gs !== 'PLAYING') return;
  _state.gs    = 'DEAD';
  bird.alive   = false;

  triggerShake(24);
  flashAlpha = 1;
  _spawnBurst(bird.x, bird.y, 'death', reducedMotion ? 18 : 60);

  const isNew = State.score > State.best;
  if (isNew) State.best = State.score;

  setTimeout(() => {
    if (_state.gs !== 'DEAD') return;
    _state.gs = 'GAMEOVER';
    DOM.finalScore.textContent       = State.score;
    DOM.bestScore.textContent        = State.best;
    DOM.newBestTag.style.display     = isNew ? 'block' : 'none';
    DOM.gameOver.classList.remove('hidden');
  }, 960);
}

// ═══════════════════════════════════════════════════════════════════
//  MAIN LOOP
// ═══════════════════════════════════════════════════════════════════
function loop(now) {
  const dt = Math.min((now - lastTs) / 16.667, 2.5) || 1;
  lastTs = now;

  // ── Update ──────────────────────────────────────────────────────
  bgStars.forEach(s => s.update(dt));
  stepShake();

  if (_state.gs === 'PLAYING') {
    bird.update(dt);

    // Pipe + powerup spawn
    if (frame % DIFF[_state.diff].rate === 0) {
      const p = new Pipe();
      pipes.push(p);
      if (State.score > 2 && !State.shield && Math.random() < 0.26) {
        powerups.push(new PowerUp(
          p.x + p.w * 0.5,
          p.topH + p.gap * 0.5,
          p.curSpd
        ));
      }
    }

    pipes.forEach(p => p.update(dt));
    pipes = pipes.filter(p => p.x + p.w > -40);

    powerups.forEach(p => p.update(dt));
    powerups = powerups.filter(p => !p.done && p.x > -40);
  }

  particles.forEach(p => p.update(dt));
  particles = particles.filter(p => p.life > 0);

  floatTexts.forEach(t => t.update(dt));
  floatTexts = floatTexts.filter(t => t.life > 0);

  // ── Render ──────────────────────────────────────────────────────
  ctx.save();
  if (!reducedMotion && (Math.abs(SHAKE.pos) > 0.05)) {
    ctx.translate(SHAKE.pos * 1.0, SHAKE.pos * 0.55);
  }

  drawBG(dt);
  bgStars.forEach(s => s.draw());

  pipes.forEach(p => p.draw());

  if (_state.gs === 'PLAYING' || _state.gs === 'DEAD') {
    powerups.forEach(p => p.draw());
  }

  particles.forEach(p => p.draw());
  floatTexts.forEach(t => t.draw());

  if (_state.gs === 'MENU') {
    drawMenuOrb();
  } else {
    bird.draw();
  }

  drawFloor();
  drawFlash(dt);

  ctx.restore();
  frame++;
  requestAnimationFrame(loop);
}

// ═══════════════════════════════════════════════════════════════════
//  INPUT  (Pointer Events API — handles mouse + touch + stylus)
// ═══════════════════════════════════════════════════════════════════
function _handleAction() {
  if      (_state.gs === 'PLAYING')  bird.flap();
  else if (_state.gs === 'MENU')     startGame();
  else if (_state.gs === 'GAMEOVER') restartGame();
}

// Unified pointer
canvas.addEventListener('pointerdown', e => {
  e.preventDefault();
  _handleAction();
}, { passive: false });

// Keyboard
document.addEventListener('keydown', e => {
  if (e.code === 'Space' || e.code === 'ArrowUp') {
    e.preventDefault();
    _handleAction();
  }
});

// ── Cursor scale on hover ──────────────────────────────────────────
canvas.addEventListener('pointerenter', () => {
  DOM.cursor.style.transform = 'translate(-50%,-50%) scale(1.5)';
});
canvas.addEventListener('pointerleave', () => {
  DOM.cursor.style.transform = 'translate(-50%,-50%) scale(1)';
});

// ═══════════════════════════════════════════════════════════════════
//  BOOT
// ═══════════════════════════════════════════════════════════════════
_initSession();
DOM.bestNum.textContent = State.best > 0 ? State.best : '—';
requestAnimationFrame(loop);
