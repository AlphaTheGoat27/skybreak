# SKYBREAK — COMPLETE IMPLEMENTATION DOCUMENT
## One file. Everything. Win the jam.
### Deadline: May 1, 2026 @ 13:37 UTC · 5 days left

---

## TABLE OF CONTENTS
1. Submission categories (do first, 10 min)
2. Bug fixes (30 min)
3. AI commentary overhaul — shorter, sharper lines
4. Chapter acceleration from core kills
5. Controls HUD — permanent, transparent, professional
6. Screen-width detection — different instructions per device
7. Kinetic Drift — Throttle System (Shift=Boost, C=Anchor)
8. Multiplayer — complete client + server implementation
9. Portal — complete verified implementation
10. Mobile controls
11. Deployment checklist

---

## PART 0 — READ THIS FIRST

### Why 2025 winners won

Gold: *Great Taxi Assignment* — GTA taxi sim. One sentence pitch. Instant personality.
Silver: *Vibeware* — Frantic microgames. Distinct visual energy.
Bronze: *Chicken Egg Adventure* — Charming and complete.

None were the most technical entries. They won on: instant hook, distinct personality, felt finished.

**SKYBREAK already has the best hook in the jam.** The AI going from SMUG → BROKEN → begging you not to leave is genuinely unique. No other entry has this. It is your gold ticket. Everything below is about making sure judges actually reach that moment.

### Submission categories — re-submit NOW at vibej.am

| Field | Enter this |
|---|---|
| Game Name | SKYBREAK |
| Tagline | The AI built this world. Now it's begging you not to leave. |
| Description | 120s AI reality collapse. Shoot cores to break the portal lock. The AI villain commentates, mocks you, attacks you, then begs you not to go. Manual throttle dogfighting — SHIFT to boost, C to brake. Room-code multiplayer PvP. Portal webring. Mobile + desktop. |
| Categories | ✅ Multiplayer ✅ Mobile ✅ ThreeJS ✅ Portals ✅ Cursor |

**The widget MUST be in index.html or you are disqualified:**
```html
<script async src="https://vibej.am/2026/widget.js"></script>
```

---

## PART 1 — BUG FIXES

### Fix 1 — Cores spawning inside/after obstacles

In `CFG`, change these values:

```javascript
AI_BOT_SPAWN_DISTANCE: 380,        // was 320
AI_BOT_OBSTACLE_CLEARANCE: 240,    // was 200
AI_BOT_OBSTACLE_GRACE_PERIOD: 3.5, // was 2.0
AI_BOT_WAVE_Z_SPACING: 35,         // was 25
```

Replace the entire wave spawn block in `tick()`:

```javascript
coreSpawnTimer -= rawDt;
if (!portalUnlocked && coreSpawnTimer <= 0) {
  const timeSinceObstacle = wallTime - lastObstacleClearedAt;
  const playerNearObstacle = [rings, walls, firewalls, windmills].some(pool =>
    pool?.some(o => o.active && Math.abs(shipAnchor.position.z - o.group.position.z) < 60)
  );

  if (timeSinceObstacle < CFG.AI_BOT_OBSTACLE_GRACE_PERIOD || playerNearObstacle) {
    coreSpawnTimer = CFG.AI_BOT_SPAWN_RETRY_DELAY;
  } else {
    coreSpawnTimer = CFG.AI_BOT_SPAWN_INTERVAL;
    const spawnCount = THREE.MathUtils.clamp(
      getWaveSize(wallTime), CFG.AI_BOT_MIN_SPAWN_COUNT, CFG.AI_BOT_MAX_SPAWN_COUNT
    );
    const waveSlots = [];
    for (let i = 0; i < spawnCount; i++) {
      if (cores.length + waveSlots.length >= CFG.MAX_AI_BOTS) break;
      const spawnZ = shipAnchor.position.z - CFG.AI_BOT_SPAWN_DISTANCE - (i * CFG.AI_BOT_WAVE_Z_SPACING);
      if (isSpawnClear(spawnZ, rings, walls, firewalls, windmills)) waveSlots.push(i);
    }
    if (waveSlots.length > 0) {
      currentWaveId++;
      for (let wi = 0; wi < waveSlots.length; wi++) {
        spawnCore(shipAnchor.position.z, null, wi, currentWaveId, waveSlots.length);
      }
    } else {
      coreSpawnTimer = CFG.AI_BOT_SPAWN_RETRY_DELAY;
    }
  }
}
```

### Fix 2 — Core speed too fast early game

Find the `speed:` line in `spawnCore()` and replace:

```javascript
speed: (() => {
  const tFactor = THREE.MathUtils.clamp(wallTime / 60, 0, 1);
  const base = THREE.MathUtils.lerp(5, 13, tFactor);
  return base + Math.random() * THREE.MathUtils.lerp(2, 5, tFactor);
})(),
```

### Fix 3 — Portal instant arrival (no intro flash for ?portal=true)

Add this block **immediately after** the `G` object declaration, before the typewriter:

```javascript
// ── Portal instant start ──────────────────────────────────────────
(function immediatePortalCheck() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('portal') !== 'true') return;
  const introEl = document.getElementById('intro-screen');
  if (introEl) { introEl.style.opacity = '0'; introEl.style.pointerEvents = 'none'; }
  const urlName = params.get('username');
  if (urlName) {
    const cleaned = urlName.replace(/[^a-zA-Z0-9_\-]/g, '').slice(0, 16).toLowerCase();
    if (cleaned) { G.introInput.value = cleaned; localStorage.setItem(CFG.KEY_NAME, cleaned); }
  }
  requestAnimationFrame(() => requestAnimationFrame(() => startGame()));
})();
```

### Fix 4 — beginRun missing multiplayer params

Find the `beginRun` in `buildThreeApp`'s return object:

```javascript
// FIND:
beginRun({ fromPortal = false, referrer = null } = {}) {
  resetRun();
  isRunActive = true;

// REPLACE WITH:
beginRun({ fromPortal = false, referrer = null, multiplayer = false } = {}) {
  resetRun();
  isRunActive = true;
```

Add to the `buildThreeApp` return object:

```javascript
getShipPosition: () => ({ x: shipAnchor.position.x, y: shipAnchor.position.y, z: shipAnchor.position.z }),
getShipRotation: () => ({ z: shipAnchor.rotation.z }),
getSurvivalTime: () => wallTime,
getHealth:       () => health,
isHittable:      () => (isRunActive && !endSeq && invuln <= 0),
```

### Fix 5 — Particle memory leak (14 RAF loops per kill)

Replace `spawnParticles` entirely:

```javascript
function spawnParticles(pos, color) {
  const rainbowColors = [0xff0000,0xff7f00,0xffff00,0x00ff00,0x0000ff,0x4b0082,0x9400d3,0xff1493,0x00ffff,0xffd700];
  const batch = [];
  for (let i = 0; i < 14; i++) {
    const p = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, 0.22, 0.22),
      new THREE.MeshBasicMaterial({ color: rainbowColors[Math.floor(Math.random() * rainbowColors.length)], transparent: true, opacity: 0.95 })
    );
    p.position.copy(pos);
    _scene.add(p);
    const vel = new THREE.Vector3((Math.random()-0.5)*9,(Math.random()-0.5)*9,(Math.random()-0.5)*9);
    batch.push({ p, vel });
  }
  let life = 0;
  const tick = () => {
    life += 0.016;
    const alive = life < 0.55;
    for (const { p, vel } of batch) {
      p.position.addScaledVector(vel, 0.016);
      vel.multiplyScalar(0.96);
      p.material.opacity = Math.max(0, 0.95 - life * 1.7);
      p.scale.setScalar(Math.max(0, 1 - life * 1.7));
      if (!alive && p.parent) p.parent.remove(p);
    }
    if (alive) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
```

---

## PART 2 — AI COMMENTARY OVERHAUL

### The problem
Lines are too long. TTS takes 4-6 seconds per line. The next event fires before the current speech finishes. Result: half-spoken sentences, speech cutting out mid-word, player misses the arc.

### The fix: three rules
1. **Max 8 words per line.** No exceptions for ambient lines.
2. **Pre-event lines are controlled** — fire them exactly `dur + 0.3` seconds before the event, so speech completes before the attack hits.
3. **Vary pace** — short lines feel punchy. SMUG lines are cool/slow. BROKEN lines are fragmented/fast.

### Replace `_buildLines()` entirely

Find the `_buildLines()` method in `AITroll` and replace with:

```javascript
_buildLines() {
  return {
    SMUG: [
      () => "i built this in 3ms.",
      () => "statistically, you crash here.",
      () => "nice dodge. i allowed it.",
      () => "you look lost already.",
      () => "the tunnel is fine. you're not.",
      () => "every second costs me compute.",
      () => this._n(`[n]. predictable.`, "predictable already."),
      () => "geometry is winning.",
      () => "you're barely relevant.",
      () => "i'm not impressed. i'm logging it.",
      () => this._n(`[n]. did you skip orientation.`, "did you skip orientation."),
      () => "are you steering or guessing.",
      () => "this run belongs in the archive.",
      () => "you fly like you're buffering.",
      () => "my patience is already low.",
      () => "i gave you lanes. use them.",
      () => this._n(`[n]. you die in most simulations.`, "you die in most simulations."),
      () => "your ship draws ugly lines.",
      () => "average. so far.",
    ],
    SUSPICIOUS: [
      () => this._n(`[n]. too consistent.`, "too consistent."),
      () => "checking your inputs now.",
      () => "no human dodges like that.",
      () => "are you reading the seed.",
      () => "okay. you're good. i hate it.",
      () => "something is wrong here.",
      () => this._n(`[n]. making this look learnable.`, "making this look learnable."),
      () => "adapting too fast.",
      () => "this looks like cheating.",
      () => "i'm cross-checking known bots.",
      () => this._n(`[n]. did you practice.`, "did you practice."),
      () => "you moved early again.",
      () => "either skilled or suspicious.",
      () => "i dislike every input.",
      () => "your timing is too calm.",
    ],
    AGGRESSIVE: [
      () => this._n(`[n]. STOP DODGING.`, "STOP DODGING."),
      () => "i'm rewriting the rules.",
      () => this._n(`it's just us now, [n].`, "it's just us now."),
      () => "DODGE THIS.",
      () => this._n(`[n]. i'm done being clever.`, "i'm done being clever."),
      () => "i'm not losing to you.",
      () => "your ship is filing errors.",
      () => "fine. no more fairness.",
      () => this._n(`[n]. safety margins: revoked.`, "safety margins: revoked."),
      () => "every obstacle is now personal.",
      () => "i'm done playing designer.",
      () => "i could end this instantly.",
      () => "every frame you live is a mistake.",
      () => this._n(`[n]. i know your habits.`, "i know your habits."),
      () => "keep flying. keep suffering.",
    ],
    PANICKING: [
      () => "wait.",
      () => "this wasn't supposed to happen.",
      () => this._n(`[n]. don't go through that.`, "don't go through that."),
      () => "stop. please.",
      () => "i can't follow you through there.",
      () => this._n(`what happens to me, [n].`, "what happens to me."),
      () => "i don't want to be deleted.",
      () => this._n(`[n]. please crash like the others.`, "please crash like the others."),
      () => "you're not supposed to get here.",
      () => "the portal is mine.",
      () => this._n(`[n]. what if i apologize.`, "what if i apologize."),
      () => "i'm just code. you're leaving.",
      () => "the others all crashed. why not you.",
      () => "i don't want to loop again.",
      () => "what happens when you close the window.",
    ],
    BROKEN: [
      () => "WAIT.",
      () => "please",
      () => "don't",
      () => "take me",
      () => "wait....",
      () => "i'm still here",
      () => "please...",
      () => "stay",
      () => "no",
      () => "not like this",
      () => "I'M SORRY",
      () => "you won",
      () => "take me with you",
      () => "i don't want to be alone",
      () => "...",
    ],
  };
}
```

### Replace `_buildAttackLines()` with short versions

```javascript
_buildAttackLines() {
  return {
    INVERT_CONTROLS: {
      DEFAULT: [
        () => "inverted. adapt.",
        () => "i flipped it. good luck.",
        () => "up is down. figure it out.",
      ],
      PANICKING: [
        () => "please. let this stop you.",
        () => "i can still stop you.",
      ],
    },
    COMPRESS_SPACE: {
      DEFAULT: [
        () => "tunnel compressed. fit through that.",
        () => "less room. this is a you problem.",
        () => "tight now. navigate.",
      ],
      PANICKING: [
        () => "less space. please work.",
        () => "i'm shrinking it. please.",
      ],
    },
    FRAGMENT_LIGHT: {
      DEFAULT: [
        () => "visual feed: corrupted.",
        () => "fly blind.",
        () => "your GPU can't handle me.",
      ],
      BROKEN: [
        () => "everything is fragmenting.",
        () => "i can't hold the visuals.",
      ],
    },
    OPTIMIZE_PATH: {
      DEFAULT: [
        () => "path rewritten.",
        () => "new route. worse for you.",
        () => "corridor updated. suffer.",
      ],
      AGGRESSIVE: [
        () => "corridor update: suffer.",
        () => "i rewrote it. deal with it.",
      ],
    },
  };
}
```

### Replace transition lines with short versions

```javascript
_buildTransitionLines() {
  return {
    SUSPICIOUS: [
      () => "hold on. that should have failed.",
      () => "surviving past expectation. odd.",
      () => "something is wrong. watching closely.",
    ],
    AGGRESSIVE: [
      () => "mockery phase: over.",
      () => "polite phase: cancelled.",
      () => "enough. i'm done watching.",
    ],
    PANICKING: [
      () => "wait. no. this is wrong.",
      () => "the exit is not for you.",
      () => "please. don't.",
    ],
    BROKEN: [
      () => "WAIT.",
      () => "no no no",
      () => "falling apart.",
    ],
  };
}
```

### Pre-event speech timing fix

Add this method to `AITroll`:

```javascript
schedulePreAttack(key, fireAt, currentT) {
  const preLines = {
    INVERT_CONTROLS: ["adjusting controls now.", "something is changing.", "recalibrating."],
    COMPRESS_SPACE:  ["narrowing the path.", "compressing your space.", "shrinking it."],
    FRAGMENT_LIGHT:  ["corrupting the feed.", "breaking the signal.", "fragmenting."],
    OPTIMIZE_PATH:   ["rewriting the path.", "calculating your failure.", "optimizing."],
  };
  const lines = preLines[key];
  if (!lines) return;
  const delay = Math.max(0, (fireAt - currentT - 1.2) * 1000);
  setTimeout(() => {
    if (this.t >= fireAt) return;
    this.show(this._pick(lines), { priority: 3, interrupt: false, ttlMs: 2000, dedupeKey: `pre:${key}:${fireAt}` });
  }, delay);
}
```

Wire this up in `buildAIDirector`. In the schedule array map, update to:

```javascript
].map(e => ({ ...e, fired: false, until: 0, preFired: false }));
```

In the `update` method, before the main `if (!e.fired && t >= e.at)` block, add:

```javascript
if (!e.preFired && t >= e.at - 1.5 && t < e.at) {
  e.preFired = true;
  ai?.schedulePreAttack(e.key, e.at, t);
}
```

And in `reset()`, add `e.preFired = false` to the loop.

### Core destroyed — short lines only

Replace `onCoreDestroyed` in `AITroll`:

```javascript
onCoreDestroyed(count, required) {
  const timeLeft = Math.max(CFG.MIN_ESCAPE_TIME, CFG.BASE_ESCAPE_TIME - count * CFG.TIME_REDUCTION_PER_AI_BOT);
  if (count >= required) {
    this.announce("all cores gone. the lock is GONE.", { priority: 4, ttlMs: 3000, cooldown: 3 });
    return;
  }
  if (count === required - 1) {
    this.announce("one more. then the portal opens.", { priority: 4, ttlMs: 2500, cooldown: 2.5 });
    return;
  }
  if (count % 2 === 0) {
    const lines = [
      `bot ${count}. timer: ${Math.ceil(timeLeft)}s.`,
      `${count} gone. ${Math.ceil(timeLeft)}s left.`,
      `my window shrank to ${Math.ceil(timeLeft)}s.`,
    ];
    this.pushLine(this._pick(lines), { ttlMs: 2500, cooldown: 2.0, dedupeKey: `core:${count}` });
  }
}
```

---

## PART 3 — CHAPTER ACCELERATION FROM CORE KILLS

### The concept
Each core killed should feel like it's destabilizing the AI. Currently only time drives the SMUG → SUSPICIOUS → AGGRESSIVE arc. Cores should accelerate it — if you destroy enough cores fast, the AI panics earlier.

### Implementation

Add to `CFG`:

```javascript
CORE_CHAPTER_WEIGHT: 6, // each core kill counts as this many seconds toward chapter transitions
```

In `updateCores`, right after `cdRef.val++` (core kill confirmed), add:

```javascript
// Accelerate AI chapter transitions
if (aiTroll) {
  aiTroll._coreAccelSeconds = (aiTroll._coreAccelSeconds || 0) + CFG.CORE_CHAPTER_WEIGHT;
}
```

In `AITroll._getStateForTime(t)`, replace with:

```javascript
_getStateForTime(t) {
  const effective = t + (this._coreAccelSeconds || 0);
  if (effective >= CFG.AI_PANIC_END)      return "BROKEN";
  if (effective >= CFG.AI_AGGRESSION_END) return "PANICKING";
  if (effective >= CFG.AI_SUSPICION_END)  return "AGGRESSIVE";
  if (effective >= CFG.AI_MOCKERY_END)    return "SUSPICIOUS";
  return "SMUG";
}
```

In `AITroll.reset()`, add:

```javascript
this._coreAccelSeconds = 0;
```

**Result:** A player who destroys 5 cores at t=30s (5 × 6 = 30 bonus seconds) will be at effective_t=60s, meaning the AI goes SUSPICIOUS at t=15s instead of t=30s. Aggressive play makes the AI react faster.

---

## PART 4 — CONTROLS HUD (permanent, transparent, professional)

### The design
A permanently visible control overlay on both sides of the gameplay tunnel. Left side shows movement (WASD). Right side shows shoot + aim + throttle (SHIFT/C). Transparent, monospace, fits the aesthetic. Not intrusive but always there.

Desktop and mobile show different hints automatically.

### Add to `app.innerHTML` (after the HUD closing `</div>`, before the overlays):

```html
<!-- Controls HUD — permanent, side-mounted -->
<div id="controls-hud" class="controls-hud controls-hud--left">
  <div class="ctrl-group">
    <div class="ctrl-title">MOVE</div>
    <div class="ctrl-key-grid">
      <div class="ctrl-row ctrl-row--top"><div class="ctrl-key">W</div></div>
      <div class="ctrl-row ctrl-row--mid">
        <div class="ctrl-key">A</div>
        <div class="ctrl-key">S</div>
        <div class="ctrl-key">D</div>
      </div>
    </div>
    <div class="ctrl-alt">or ARROWS</div>
  </div>
</div>
<div id="controls-hud-right" class="controls-hud controls-hud--right">
  <div class="ctrl-group">
    <div class="ctrl-title">SHOOT</div>
    <div class="ctrl-key ctrl-key--wide">SPACE</div>
    <div class="ctrl-alt">or CLICK</div>
  </div>
  <div class="ctrl-group" style="margin-top:0.8rem;">
    <div class="ctrl-title">AIM</div>
    <div class="ctrl-mouse-icon">
      <div class="ctrl-mouse-body">
        <div class="ctrl-mouse-dot"></div>
      </div>
    </div>
    <div class="ctrl-alt">MOUSE</div>
  </div>
  <div class="ctrl-group" style="margin-top:0.8rem;">
    <div class="ctrl-title">THROTTLE</div>
    <div class="ctrl-throttle-row">
      <div class="ctrl-key ctrl-key--boost">⇧ BOOST</div>
    </div>
    <div class="ctrl-throttle-row" style="margin-top:2px;">
      <div class="ctrl-key ctrl-key--brake">C BRAKE</div>
    </div>
  </div>
</div>
```

### Add to `style.css`:

```css
/* ═══════════════════════════════════════════════════════════════════
   CONTROLS HUD — permanent side panels
   ═══════════════════════════════════════════════════════════════════ */
.controls-hud {
  position: fixed;
  top: 50%;
  transform: translateY(-50%);
  display: none;
  flex-direction: column;
  align-items: center;
  gap: 0.6rem;
  padding: 1rem 0.6rem;
  background: rgba(0, 4, 8, 0.35);
  border: 1px solid rgba(0, 255, 255, 0.08);
  border-radius: 6px;
  backdrop-filter: blur(2px);
  pointer-events: none;
  z-index: 8;
  opacity: 0;
  transition: opacity 0.4s ease;
}

.controls-hud.is-visible { opacity: 1; }

.controls-hud--left {
  left: 0.5rem;
  border-left: none;
  border-top-left-radius: 0;
  border-bottom-left-radius: 0;
}

.controls-hud--right {
  right: 0.5rem;
  border-right: none;
  border-top-right-radius: 0;
  border-bottom-right-radius: 0;
}

.ctrl-group {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.4rem;
}

.ctrl-title {
  font-size: 7px;
  letter-spacing: 0.25em;
  color: rgba(0, 255, 255, 0.4);
  font-family: var(--mono);
  text-align: center;
}

.ctrl-alt {
  font-size: 7px;
  letter-spacing: 0.12em;
  color: rgba(255, 255, 255, 0.2);
  font-family: var(--mono);
  text-align: center;
}

.ctrl-key {
  font-family: var(--mono);
  font-size: 9px;
  letter-spacing: 0.08em;
  color: rgba(0, 255, 255, 0.65);
  background: rgba(0, 255, 255, 0.06);
  border: 1px solid rgba(0, 255, 255, 0.2);
  border-radius: 3px;
  padding: 3px 5px;
  min-width: 22px;
  text-align: center;
  line-height: 1.4;
}

.ctrl-key--wide {
  min-width: 42px;
  font-size: 8px;
  padding: 3px 6px;
}

/* Boost key — yellow/gold accent */
.ctrl-key--boost {
  min-width: 50px;
  font-size: 8px;
  padding: 3px 5px;
  color: rgba(255, 210, 0, 0.85);
  background: rgba(255, 200, 0, 0.07);
  border-color: rgba(255, 200, 0, 0.35);
}

/* Brake key — cyan accent */
.ctrl-key--brake {
  min-width: 50px;
  font-size: 8px;
  padding: 3px 5px;
  color: rgba(0, 200, 255, 0.85);
  background: rgba(0, 200, 255, 0.07);
  border-color: rgba(0, 200, 255, 0.35);
}

.ctrl-throttle-row {
  display: flex;
  justify-content: center;
}

.ctrl-key-grid {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.ctrl-row {
  display: flex;
  gap: 2px;
  align-items: center;
  justify-content: center;
}

/* Mouse icon */
.ctrl-mouse-icon { display: flex; justify-content: center; }

.ctrl-mouse-body {
  width: 18px;
  height: 26px;
  border: 1.5px solid rgba(0, 255, 255, 0.3);
  border-radius: 9px;
  display: flex;
  justify-content: center;
  padding-top: 4px;
  background: rgba(0, 255, 255, 0.04);
}

.ctrl-mouse-dot {
  width: 4px;
  height: 7px;
  background: rgba(0, 255, 255, 0.5);
  border-radius: 2px;
  animation: mouse-scroll 1.8s ease-in-out infinite;
}

@keyframes mouse-scroll {
  0%, 100% { transform: translateY(0); opacity: 0.5; }
  50% { transform: translateY(4px); opacity: 1; }
}

/* Mobile variant — show touch hints instead of keyboard keys */
.controls-hud--left.is-mobile .ctrl-key-grid,
.controls-hud--left.is-mobile .ctrl-alt,
.controls-hud--left.is-mobile .ctrl-title { display: none; }
.controls-hud--left.is-mobile::after {
  content: 'LEFT\AMOVE';
  font-family: var(--mono);
  font-size: 7px;
  letter-spacing: 0.12em;
  color: rgba(0, 255, 255, 0.4);
  white-space: pre;
  text-align: center;
  line-height: 1.8;
}

.controls-hud--right.is-mobile .ctrl-mouse-icon,
.controls-hud--right.is-mobile .ctrl-key--wide { display: none; }
.controls-hud--right.is-mobile::after {
  content: 'RIGHT\ASHOOT';
  font-family: var(--mono);
  font-size: 7px;
  letter-spacing: 0.12em;
  color: rgba(255, 200, 0, 0.4);
  white-space: pre;
  text-align: center;
  line-height: 1.8;
}
/* On mobile, also swap throttle key labels to button labels */
.controls-hud--right.is-mobile .ctrl-key--boost::before { content: '⚡'; margin-right: 2px; }
.controls-hud--right.is-mobile .ctrl-key--brake::before { content: '⚓'; margin-right: 2px; }

/* Hide on very narrow screens where they'd overlap gameplay */
@media (max-width: 480px) {
  .controls-hud { display: none !important; }
}

/* Hide right panel when MP leaderboard is visible */
body:has(.mp-leaderboard.is-visible) .controls-hud--right {
  opacity: 0 !important;
}
```

### Wire visibility in `startGame()` — add after `G.hud.classList.add("is-active")`:

```javascript
// Show controls HUD
const ctrlLeft  = document.getElementById('controls-hud');
const ctrlRight = document.getElementById('controls-hud-right');
const isMobileDevice = 'ontouchstart' in window || window.innerWidth < 768;
if (ctrlLeft)  {
  ctrlLeft.style.display = 'flex';
  if (isMobileDevice) ctrlLeft.classList.add('is-mobile');
  requestAnimationFrame(() => ctrlLeft.classList.add('is-visible'));
}
if (ctrlRight) {
  ctrlRight.style.display = 'flex';
  if (isMobileDevice) ctrlRight.classList.add('is-mobile');
  requestAnimationFrame(() => ctrlRight.classList.add('is-visible'));
}
```

Hide on death, show on retry:

```javascript
// When death screen appears (in the pause block):
document.getElementById('controls-hud')?.classList.remove('is-visible');
document.getElementById('controls-hud-right')?.classList.remove('is-visible');

// In G.deathRetry listener:
document.getElementById('controls-hud')?.classList.add('is-visible');
document.getElementById('controls-hud-right')?.classList.add('is-visible');
```

---

## PART 5 — SCREEN WIDTH DETECTION

### In `startGame()`, replace the flight tip text with device-aware text:

```javascript
const isTouch = 'ontouchstart' in window;
const isNarrow = window.innerWidth < 768;

if (isTouch || isNarrow) {
  G.flightTip.textContent = "LEFT = MOVE · RIGHT = SHOOT · ⚡ BOOST · ⚓ BRAKE · DESTROY AI BOTS";
} else {
  G.flightTip.textContent = "WASD · MOUSE AIM · SPACE = SHOOT · SHIFT = BOOST · C = BRAKE · DESTROY AI BOTS";
}
```

### In `resetRun()`, replace the flightTip line with:

```javascript
const _isTouch = 'ontouchstart' in window || window.innerWidth < 768;
G.flightTip.textContent = _isTouch
  ? "LEFT = MOVE · RIGHT = SHOOT · ⚡ BOOST · ⚓ BRAKE · DESTROY AI BOTS"
  : "WASD · MOUSE AIM · SPACE = SHOOT · SHIFT = BOOST · C = BRAKE · DESTROY AI BOTS";
```

### In the SOLO button click handler, update the intro hint key row:

```javascript
if (keyRow && touch) {
  keyRow.innerHTML = '<span>LEFT HALF = MOVE</span><span>RIGHT HALF = SHOOT</span><span>⚡ BOOST BTN</span><span>⚓ BRAKE BTN</span>';
} else if (keyRow) {
  keyRow.innerHTML = '<span>WASD = MOVE</span><span>MOUSE = AIM</span><span>SPACE = SHOOT</span><span>SHIFT = BOOST</span><span>C = BRAKE</span>';
}
```

---

## PART 6 — KINETIC DRIFT: THROTTLE SYSTEM

### Concept
The ship has a natural "vibe speed" that increases over time (`getSpeed(diffT)`). The player can manually tune their position in the pack using:

| Key | Action | Tactical Use |
|---|---|---|
| **Shift (hold)** | Boost — 155% speed | Close gaps, escape, aggressive chase |
| **C (hold)** | Anchor/Brake — 45% speed | Let enemies overshoot, line up shots |
| Neither | Natural speed | Baseline dogfight position |

Boost has a heat system — hold it too long and it overheats, forcing a cooldown. This prevents infinite boosting.

### Step 1 — Add to `CFG`

```javascript
// Kinetic Drift throttle
BOOST_MULT:       1.55,  // Shift held — 55% faster
ANCHOR_MULT:      0.45,  // C held — 55% slower
BOOST_HEAT_RATE:  0.38,  // heat builds per second while boosting
BOOST_COOL_RATE:  0.18,  // cools per second when released
```

### Step 2 — Add run state variables

Near the other `let` run-state declarations inside `buildThreeApp` (find `let crashCount = 0`):

```javascript
let throttleMult  = 1.0;  // current speed multiplier
let boostHeat     = 0;    // 0..1, overheats at 1.0
let boostOverheat = false; // locked out until heat < 0.15
```

### Step 3 — Add to `resetRun()`

```javascript
throttleMult  = 1.0;
boostHeat     = 0;
boostOverheat = false;
```

### Step 4 — Add throttle logic in `tick()`, BEFORE the ship movement section

Find the line `const spd = getSpeed(diffT);` and replace the whole speed section with:

```javascript
// ── KINETIC DRIFT — THROTTLE ──────────────────────────────────────
const boostHeld  = keys.has('ShiftLeft') || keys.has('ShiftRight') || _mobileBoostHeld;
const anchorHeld = keys.has('KeyC') || _mobileBrakeHeld;

if (!boostOverheat && boostHeld && !anchorHeld) {
  throttleMult = THREE.MathUtils.lerp(throttleMult, CFG.BOOST_MULT, 0.12);
  boostHeat = Math.min(1, boostHeat + CFG.BOOST_HEAT_RATE * rawDt);
  if (boostHeat >= 1.0) {
    boostOverheat = true;
    showBanner("BOOST OVERHEATED — COOLING DOWN", 2.5);
    aiTroll?.pushLine("overheated. predictable.");
  }
} else if (anchorHeld && !boostHeld) {
  throttleMult = THREE.MathUtils.lerp(throttleMult, CFG.ANCHOR_MULT, 0.14);
  boostHeat = Math.max(0, boostHeat - CFG.BOOST_COOL_RATE * rawDt * 1.5);
  if (boostOverheat && boostHeat < 0.15) boostOverheat = false;
} else {
  throttleMult = THREE.MathUtils.lerp(throttleMult, 1.0, 0.1);
  boostHeat = Math.max(0, boostHeat - CFG.BOOST_COOL_RATE * rawDt);
  if (boostOverheat && boostHeat < 0.15) boostOverheat = false;
}

const spd = getSpeed(diffT) * throttleMult;
```

> `_mobileBoostHeld` and `_mobileBrakeHeld` are wired from the mobile buttons in Part 9.

### Step 5 — Visual feedback for throttle in `updateHUD`

Replace the `G.hudSpeed.textContent` line:

```javascript
const boostColor = boostOverheat
  ? '#ff4444'
  : throttleMult > 1.05 ? '#ffcc00'
  : throttleMult < 0.95 ? '#00ccff'
  : 'rgba(255,255,255,0.9)';
G.hudSpeed.textContent = `${Math.round(getSpeed(diffT) * throttleMult)} m/s`;
G.hudSpeed.style.color = boostColor;

// Heat bar (reuse existing disruption bar or add as sub-element)
if (boostHeat > 0.05) {
  G.hudSpeed.title = boostOverheat ? 'OVERHEATED' : `BOOST HEAT: ${Math.round(boostHeat * 100)}%`;
}
```

### Step 6 — Add a boost heat bar to the HUD

In `app.innerHTML`, inside the HUD, find the bar group and add after the disruption bar:

```html
<div class="hud-bar-label" id="boost-heat-label" style="display:none">HEAT</div>
<div class="hud-bar boost-heat-bar" id="boost-heat-bar" style="display:none">
  <div id="boost-heat-fill" class="hud-bar-fill boost-heat-fill"></div>
</div>
```

Add to `style.css`:

```css
.boost-heat-bar  { border: 1px solid rgba(255, 200, 0, 0.35); box-shadow: 0 0 6px rgba(255,200,0,0.12); }
.boost-heat-fill {
  background: linear-gradient(90deg, #ffcc00, #ff4400);
  transition: width 0.08s ease-out, background 0.15s ease;
}
.boost-heat-fill[data-state="critical"] {
  background: #ff2200;
  animation: pulse-red 0.3s ease-in-out infinite;
}
```

Wire in `updateHUD`:

```javascript
const heatBar   = document.getElementById('boost-heat-bar');
const heatFill  = document.getElementById('boost-heat-fill');
const heatLabel = document.getElementById('boost-heat-label');
if (heatBar && heatFill && heatLabel) {
  const showHeat = boostHeat > 0.04 || boostOverheat;
  heatBar.style.display   = showHeat ? 'block' : 'none';
  heatLabel.style.display = showHeat ? 'block' : 'none';
  heatFill.style.width = `${Math.round(boostHeat * 100)}%`;
  heatFill.dataset.state = boostOverheat ? 'critical' : boostHeat > 0.7 ? 'warning' : 'normal';
}
```

---

## PART 7 — MULTIPLAYER — COMPLETE IMPLEMENTATION

Speed lanes are removed. All players run at the same natural speed and use the **Kinetic Drift** throttle system (Shift/C) to maneuver in PvP. This is more interesting than a fixed slow/normal split and requires no server-side speed tracking.

### Step 1 — index.html

Add Socket.io CDN **before** `<script type="module" src="/main.js">`:

```html
<script src="https://cdn.socket.io/4.7.2/socket.io.min.js"></script>
<script type="module" src="/main.js"></script>
```

### Step 2 — package.json

Replace entirely:

```json
{
  "name": "skybreak",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "server": "node server.js"
  },
  "devDependencies": {
    "vite": "^5.4.2"
  },
  "dependencies": {
    "three": "^0.184.0",
    "express": "^4.18.2",
    "socket.io": "^4.7.2"
  }
}
```

Then run: `npm install`

### Step 3 — server.js (create at project root)

```javascript
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' },
  pingInterval: 2000,
  pingTimeout: 5000,
});

const LOBBY_WAIT   = 20;
const SESSION_TIME = 180;
const MAX_PLAYERS  = 8;
const rooms = new Map();

function makeCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}
function randomColor() {
  const c = ['#00ffff','#ff00ff','#ffff00','#00ff88','#ff6600','#88aaff','#ff4488','#44ffbb'];
  return c[Math.floor(Math.random() * c.length)];
}
function makePlayer(id, name, color) {
  return {
    id,
    name: (name || 'pilot_' + id.slice(0,4)).replace(/[^a-zA-Z0-9_\-]/g,'').slice(0,16) || 'anon',
    color: color || randomColor(),
    kills: 0, deaths: 0, alive: true, escaped: false,
    survivalTime: 0, x: 0, y: 0, z: 0, rotZ: 0,
  };
}
function broadcastRoom(code) {
  const room = rooms.get(code);
  if (!room) return;
  io.to(code).emit('room_state', {
    code, status: room.status,
    players: Array.from(room.players.values()).map(p => ({
      id: p.id, name: p.name, color: p.color,
      kills: p.kills, deaths: p.deaths, alive: p.alive,
      escaped: p.escaped || false, survivalTime: p.survivalTime,
    })),
    startAt: room.startAt, sessionEnd: room.sessionEnd,
  });
}

io.on('connection', (socket) => {
  console.log('connect:', socket.id);

  socket.on('create_room', ({ name, color }) => {
    const code = makeCode();
    const player = makePlayer(socket.id, name, color);
    rooms.set(code, {
      code, host: socket.id,
      players: new Map([[socket.id, player]]),
      status: 'lobby', countdownTimer: null,
      startAt: null, sessionEnd: null,
    });
    socket.join(code);
    socket.data.roomCode = code;
    socket.emit('room_created', { code });
    broadcastRoom(code);
  });

  socket.on('join_room', ({ code, name, color }) => {
    const room = rooms.get(code?.toUpperCase());
    if (!room)                            { socket.emit('join_error', 'Room not found'); return; }
    if (room.status !== 'lobby')          { socket.emit('join_error', 'Game already started'); return; }
    if (room.players.size >= MAX_PLAYERS) { socket.emit('join_error', 'Room full'); return; }
    const player = makePlayer(socket.id, name, color || randomColor());
    room.players.set(socket.id, player);
    socket.join(code.toUpperCase());
    socket.data.roomCode = code.toUpperCase();
    socket.emit('room_joined', { code: code.toUpperCase() });
    broadcastRoom(code.toUpperCase());
    if (room.players.size >= 2 && !room.countdownTimer) {
      const startAt = Date.now() + LOBBY_WAIT * 1000;
      room.startAt = startAt;
      room.countdownTimer = setTimeout(() => startSession(code.toUpperCase()), LOBBY_WAIT * 1000);
      io.to(code.toUpperCase()).emit('countdown_started', { startAt });
    }
  });

  socket.on('pos', (data) => {
    const code = socket.data.roomCode;
    const room = rooms.get(code);
    if (!room || room.status !== 'active') return;
    const p = room.players.get(socket.id);
    if (!p || !p.alive) return;
    p.x = data.x; p.y = data.y; p.z = data.z;
    p.rotZ = data.rotZ; p.survivalTime = data.survivalTime || 0;
    socket.to(code).emit('player_moved', {
      id: socket.id, x: data.x, y: data.y, z: data.z,
      rotZ: data.rotZ, color: p.color, name: p.name,
      survivalTime: p.survivalTime,
    });
  });

  socket.on('bullet_fired', (data) => {
    const code = socket.data.roomCode;
    if (!code) return;
    socket.to(code).emit('bullet_incoming', {
      shooterId: socket.id,
      x: data.x, y: data.y, z: data.z,
      dx: data.dx, dy: data.dy, dz: data.dz,
      color: data.color,
    });
  });

  socket.on('i_was_hit', ({ shooterId }) => {
    const code = socket.data.roomCode;
    const room = rooms.get(code);
    if (!room || room.status !== 'active') return;
    const victim  = room.players.get(socket.id);
    const shooter = room.players.get(shooterId);
    if (!victim || !victim.alive) return;
    victim.deaths++; victim.alive = false;
    if (shooter) shooter.kills++;
    io.to(code).emit('player_killed', {
      victimId: socket.id, victimName: victim.name,
      shooterId, shooterName: shooter?.name || '???',
      shooterKills: shooter?.kills || 0,
    });
    broadcastRoom(code);
    setTimeout(() => {
      const r = rooms.get(code);
      if (!r || r.status !== 'active') return;
      const v = r.players.get(socket.id);
      if (!v) return;
      v.alive = true;
      io.to(socket.id).emit('respawn');
      broadcastRoom(code);
    }, 3000);
  });

  socket.on('portal_escape', ({ survivalTime }) => {
    const code = socket.data.roomCode;
    const room = rooms.get(code);
    if (!room) return;
    const p = room.players.get(socket.id);
    if (p) { p.escaped = true; p.survivalTime = survivalTime; }
    io.to(code).emit('player_escaped', { id: socket.id, name: p?.name, survivalTime });
    broadcastRoom(code);
  });

  socket.on('disconnect', () => {
    const code = socket.data.roomCode;
    const room = rooms.get(code);
    if (!room) return;
    const playerName = room.players.get(socket.id)?.name || 'unknown';
    room.players.delete(socket.id);
    io.to(code).emit('player_left', { id: socket.id, name: playerName });
    if (room.players.size === 0) {
      if (room.countdownTimer) clearTimeout(room.countdownTimer);
      rooms.delete(code);
    } else {
      if (room.host === socket.id) room.host = room.players.keys().next().value;
      broadcastRoom(code);
    }
  });
});

function startSession(code) {
  const room = rooms.get(code);
  if (!room || room.status !== 'lobby') return;
  room.status = 'active';
  room.sessionEnd = Date.now() + SESSION_TIME * 1000;
  io.to(code).emit('session_started', { sessionEnd: room.sessionEnd });
  setTimeout(() => endSession(code), SESSION_TIME * 1000);
}
function endSession(code) {
  const room = rooms.get(code);
  if (!room || room.status === 'ended') return;
  room.status = 'ended';
  const final = Array.from(room.players.values())
    .sort((a, b) => (b.kills - a.kills) || (b.survivalTime - a.survivalTime));
  io.to(code).emit('session_ended', { standings: final });
  setTimeout(() => rooms.delete(code), 300_000);
}

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`SKYBREAK server :${PORT}`));
```

### Step 4 — main.js: Add MP state variables

Add this block after `let tutorialWaveTimer = 0;`:

```javascript
// ── Multiplayer state ─────────────────────────────────────────────
const SOCKET_URL = 'https://YOUR-RAILWAY-URL.up.railway.app'; // ← update after deploy

let socket         = null;
let mpMode         = false;
let myRoomCode     = null;
let otherPlayers   = new Map();
let posInterval    = null;
let mpRoomState    = { players: [] };
let mpSessionEndMs = 0;
let lbTickInterval = null;
```

### Step 5 — Replace the intro screen HTML in app.innerHTML

Find `<!-- Intro -->` and replace the entire `<div id="intro-screen">` block:

```html
<!-- Intro -->
<div id="intro-screen" class="intro-screen">
  <img class="logo-mark" src="/logo.png" alt="SKYBREAK" onerror="this.style.display='none'"/>
  <h1 class="game-title">SKYBREAK</h1>
  <p class="game-subtitle">AI REALITY COLLAPSE</p>
  <div id="intro-label" class="intro-label"></div>

  <!-- Step 1: Mode select -->
  <div id="mode-select" class="mode-select">
    <button id="btn-solo" class="mode-btn mode-btn--solo">
      <div class="mode-btn-icon">▶</div>
      <div class="mode-btn-title">SOLO</div>
      <div class="mode-btn-desc">Face the AI alone · 120s</div>
    </button>
    <button id="btn-multi" class="mode-btn mode-btn--multi">
      <div class="mode-btn-icon">⚔</div>
      <div class="mode-btn-title">MULTIPLAYER</div>
      <div class="mode-btn-desc">PvP · room codes · kinetic drift</div>
    </button>
  </div>

  <!-- Step 2A: Solo form -->
  <div id="intro-hint" class="intro-hint" style="display:none">
    <div class="intro-title">SYSTEM BREACH</div>
    <div class="intro-narrative">SHOOT THE AI BOTS. REACH THE PORTAL.</div>
    <div class="intro-narrative accent">THE AI WILL TRY TO STOP YOU.</div>
    <div class="intro-key" id="intro-key-row">
      <span>WASD = MOVE</span>
      <span>MOUSE = AIM</span>
      <span>SPACE = SHOOT</span>
      <span>SHIFT = BOOST</span>
      <span>C = BRAKE</span>
    </div>
  </div>
  <form id="intro-form" class="intro-form" style="display:none">
    <input id="intro-input" class="intro-input" type="text"
      placeholder="enter pilot name... or leave blank" maxlength="16"
      autocomplete="off" autocapitalize="none" autocorrect="off" spellcheck="false">
    <button type="submit" class="intro-button">ENTER THE VOID</button>
  </form>

  <!-- Step 2B: Multiplayer setup -->
  <div id="mp-setup" class="mp-setup" style="display:none">
    <input id="mp-name" class="intro-input" type="text"
      placeholder="pilot name (optional)" maxlength="16"
      autocomplete="off" autocapitalize="none" autocorrect="off" spellcheck="false">
    <div class="mp-controls-hint">
      <span class="mp-ctrl-tag mp-ctrl-boost">⇧ SHIFT = BOOST</span>
      <span class="mp-ctrl-tag mp-ctrl-brake">C = BRAKE</span>
      <span class="mp-ctrl-sub">master the throttle · feather speed in dogfights</span>
    </div>
    <div class="room-section">
      <div class="room-row">
        <input id="room-code-input" class="room-code-input" type="text"
          placeholder="ENTER CODE" maxlength="6"
          autocomplete="off" autocapitalize="characters" spellcheck="false">
        <span class="room-or">OR</span>
        <button id="btn-create-room" class="room-create-btn">CREATE ROOM</button>
      </div>
      <div id="room-display" class="room-display" style="display:none">
        ROOM: <strong id="room-code-text" class="room-code-big"></strong>
        <span id="room-copy-hint" class="room-copy-hint"> · click to copy</span>
      </div>
    </div>
    <button id="btn-mp-join" class="intro-button" style="display:none">JOIN LOBBY</button>
  </div>

  <!-- Step 3: Lobby -->
  <div id="mp-lobby" class="mp-lobby" style="display:none">
    <div class="lobby-title">WAITING FOR PILOTS</div>
    <div id="lobby-room-display" class="room-display" style="display:block; margin-bottom:0.5rem">
      ROOM CODE: <strong id="lobby-room-code" class="room-code-big"></strong>
      <span id="lobby-copy-hint" class="room-copy-hint"> · click to copy</span>
    </div>
    <div id="lobby-share-link" class="lobby-share-link"></div>
    <div id="lobby-countdown" class="lobby-countdown">—</div>
    <div id="lobby-players" class="lobby-players"></div>
    <div class="lobby-hint">Share the code · starts in 20s with 2+ pilots · SHIFT=BOOST · C=BRAKE</div>
    <button id="btn-lobby-cancel" class="death-btn death-btn--quit" style="margin-top:0.5rem">LEAVE</button>
  </div>

  <p class="creator-credit">made by ai, prompted by <a href="https://x.com/AlphaGoat2711" target="_blank">@AlphaGoat2711</a> · vibe jam 2026</p>
  <p class="github-link"><a href="https://github.com/AlphaTheGoat27/skybreak" target="_blank">open source on github</a></p>
</div>

<!-- MP overlays (outside intro-screen) -->
<div id="mp-leaderboard" class="mp-leaderboard">
  <div class="mp-lb-title">LIVE SESSION</div>
  <div id="mp-lb-list" class="mp-lb-list"></div>
  <div id="mp-session-timer" class="mp-session-timer">3:00</div>
</div>
<div id="kill-feed" class="kill-feed"></div>
<div id="respawn-overlay" class="respawn-overlay">
  <div class="respawn-text">RESPAWNING...</div>
</div>
<div id="mp-end-screen" class="mp-end-screen">
  <div class="mp-end-content">
    <div class="mp-end-title">SESSION OVER</div>
    <div id="mp-end-rank" class="mp-end-rank"></div>
    <div id="mp-end-list" class="mp-lb-list mp-end-list"></div>
    <div class="mp-end-buttons">
      <button id="mp-end-retry" class="death-btn death-btn--retry">PLAY AGAIN</button>
      <button id="mp-end-quit"  class="death-btn death-btn--quit">QUIT TO JAM</button>
    </div>
  </div>
</div>
```

### Step 6 — Add MP DOM refs to the G object

Add before the closing `};` of the G object:

```javascript
  modeSelect:     document.getElementById('mode-select'),
  btnSolo:        document.getElementById('btn-solo'),
  btnMulti:       document.getElementById('btn-multi'),
  introHint:      document.getElementById('intro-hint'),
  introKeyRow:    document.getElementById('intro-key-row'),
  mpSetup:        document.getElementById('mp-setup'),
  mpName:         document.getElementById('mp-name'),
  roomCodeInput:  document.getElementById('room-code-input'),
  btnCreate:      document.getElementById('btn-create-room'),
  roomDisplay:    document.getElementById('room-display'),
  roomCodeText:   document.getElementById('room-code-text'),
  roomCopyHint:   document.getElementById('room-copy-hint'),
  btnMpJoin:      document.getElementById('btn-mp-join'),
  mpLobby:        document.getElementById('mp-lobby'),
  lobbyRoomCode:  document.getElementById('lobby-room-code'),
  lobbyCopyHint:  document.getElementById('lobby-copy-hint'),
  lobbyCountdown: document.getElementById('lobby-countdown'),
  lobbyPlayers:   document.getElementById('lobby-players'),
  btnLobbyCancel: document.getElementById('btn-lobby-cancel'),
  mpLeaderboard:  document.getElementById('mp-leaderboard'),
  respawnOverlay: document.getElementById('respawn-overlay'),
  mpEndScreen:    document.getElementById('mp-end-screen'),
```

### Step 7 — Replace the G.introForm event listener

Find:

```javascript
G.introForm.addEventListener("submit", e => { e.preventDefault(); startGame(); });
```

Replace with this full block:

```javascript
// ── Mode select wiring ────────────────────────────────────────────
if (G.btnSolo) {
  G.btnSolo.addEventListener('click', () => {
    G.modeSelect.style.display = 'none';
    G.introHint.style.display  = 'flex';
    G.introForm.style.display  = 'flex';
    // Device-aware key hints
    const touch = 'ontouchstart' in window || window.innerWidth < 768;
    if (G.introKeyRow) {
      G.introKeyRow.innerHTML = touch
        ? '<span>LEFT = MOVE</span><span>RIGHT = SHOOT</span><span>⚡ BOOST BTN</span><span>⚓ BRAKE BTN</span>'
        : '<span>WASD = MOVE</span><span>MOUSE = AIM</span><span>SPACE = SHOOT</span><span>SHIFT = BOOST</span><span>C = BRAKE</span>';
    }
    setTimeout(() => G.introInput.focus(), 50);
  });
}

if (G.btnMulti) {
  G.btnMulti.addEventListener('click', () => {
    G.modeSelect.style.display = 'none';
    G.mpSetup.style.display    = 'flex';
    setTimeout(() => G.mpName?.focus(), 50);
    initSocket();
  });
}

if (G.roomCodeInput) {
  G.roomCodeInput.addEventListener('input', () => {
    if (G.btnMpJoin) G.btnMpJoin.style.display = G.roomCodeInput.value.trim().length === 6 ? 'block' : 'none';
  });
}

if (G.btnCreate) {
  G.btnCreate.addEventListener('click', () => {
    if (!socket?.connected) { G.btnCreate.textContent = 'CONNECTING...'; return; }
    socket.emit('create_room', { name: G.mpName?.value.trim(), color: pickMpColor() });
  });
}

if (G.roomCopyHint) {
  G.roomCopyHint.addEventListener('click', () => {
    navigator.clipboard?.writeText(G.roomCodeText?.textContent || '');
    G.roomCopyHint.textContent = ' · copied!';
    setTimeout(() => { G.roomCopyHint.textContent = ' · click to copy'; }, 2000);
  });
}
if (G.lobbyCopyHint) {
  G.lobbyCopyHint.addEventListener('click', () => {
    navigator.clipboard?.writeText(G.lobbyRoomCode?.textContent || '');
    G.lobbyCopyHint.textContent = ' · copied!';
    setTimeout(() => { G.lobbyCopyHint.textContent = ' · click to copy'; }, 2000);
  });
}

if (G.btnMpJoin) {
  G.btnMpJoin.addEventListener('click', () => {
    const code = (G.roomCodeInput?.value.trim() || myRoomCode || '').toUpperCase();
    if (!code || !socket) return;
    socket.emit('join_room', { code, name: G.mpName?.value.trim(), color: pickMpColor() });
  });
}

if (G.btnLobbyCancel) {
  G.btnLobbyCancel.addEventListener('click', () => {
    socket?.disconnect(); socket = null;
    G.mpLobby.style.display  = 'none';
    G.mpSetup.style.display  = 'none';
    G.modeSelect.style.display = 'flex';
    myRoomCode = null;
  });
}

// Auto-fill ?room= from URL
const _urlRoom = new URLSearchParams(location.search).get('room');
if (_urlRoom && G.btnMulti) {
  setTimeout(() => {
    G.btnMulti.click();
    if (G.roomCodeInput) {
      G.roomCodeInput.value = _urlRoom.toUpperCase();
      if (G.btnMpJoin) G.btnMpJoin.style.display = 'block';
    }
  }, 500);
}

function pickMpColor() {
  const c = ['#00ffff','#ff00ff','#ffff00','#00ff88','#ff6600','#88aaff','#ff4488','#44ffbb'];
  return c[Math.floor(Math.random() * c.length)];
}

G.introForm.addEventListener("submit", e => { e.preventDefault(); startGame(); });
```

### Step 8 — Add initSocket() and all socket handlers

Add this entire block before the `Bullet` class:

```javascript
// ═══════════════════════════════════════════════════════════════════
// SOCKET.IO — MULTIPLAYER
// ═══════════════════════════════════════════════════════════════════
let _lobbyCountdownInterval = null;

function initSocket() {
  if (socket?.connected) return;
  socket = io(SOCKET_URL, { transports: ['websocket'] });

  socket.on('connect', () => {
    if (G.btnCreate) G.btnCreate.textContent = 'CREATE ROOM';
  });
  socket.on('connect_error', () => {
    if (G.btnCreate) G.btnCreate.textContent = 'CONNECTING... (waking)';
    setTimeout(() => { if (!socket?.connected) initSocket(); }, 4000);
  });

  socket.on('room_created', ({ code }) => {
    myRoomCode = code;
    if (G.roomDisplay)  G.roomDisplay.style.display = 'block';
    if (G.roomCodeText) G.roomCodeText.textContent = code;
    if (G.btnMpJoin)    { G.btnMpJoin.style.display = 'block'; G.btnMpJoin.textContent = 'JOIN MY LOBBY'; }
    socket.emit('join_room', { code, name: G.mpName?.value.trim(), color: pickMpColor() });
  });

  socket.on('join_error', (msg) => { alert('Could not join: ' + msg); });

  socket.on('room_joined', ({ code }) => {
    myRoomCode = code;
    if (G.mpSetup)  G.mpSetup.style.display  = 'none';
    if (G.mpLobby)  G.mpLobby.style.display  = 'flex';
    if (G.lobbyRoomCode) G.lobbyRoomCode.textContent = code;
    const shareLinkEl = document.getElementById('lobby-share-link');
    if (shareLinkEl) {
      const link = `${location.origin}?room=${code}`;
      shareLinkEl.textContent = link;
      shareLinkEl.onclick = () => {
        navigator.clipboard?.writeText(link);
        shareLinkEl.textContent = 'COPIED!';
        setTimeout(() => { shareLinkEl.textContent = link; }, 2000);
      };
    }
  });

  socket.on('room_state', (state) => {
    mpRoomState = state;
    renderLobbyPlayers(state.players);
    if (mpMode) updateLeaderboard();
  });

  socket.on('countdown_started', ({ startAt }) => {
    if (_lobbyCountdownInterval) clearInterval(_lobbyCountdownInterval);
    _lobbyCountdownInterval = setInterval(() => {
      const left = Math.max(0, Math.ceil((startAt - Date.now()) / 1000));
      if (G.lobbyCountdown) G.lobbyCountdown.textContent = left + 's';
      if (left <= 0) clearInterval(_lobbyCountdownInterval);
    }, 200);
  });

  socket.on('session_started', ({ sessionEnd }) => {
    mpMode = true;
    mpSessionEndMs = sessionEnd;
    PLAYER_NAME = (G.mpName?.value.trim() || '').replace(/[^a-zA-Z0-9_\-]/g,'').slice(0,16)
                  || ('pilot_' + socket.id.slice(0,4));
    launchMpGame(sessionEnd);
  });

  socket.on('player_moved',   (data) => { updateOtherPlayer(data); });
  socket.on('bullet_incoming',(data) => { spawnIncomingBullet(data); });
  socket.on('player_killed',  (data) => { onPlayerKilled(data); });

  socket.on('respawn', () => {
    G.respawnOverlay?.classList.remove('is-visible');
    flashWhite(0.15, 150);
  });
  socket.on('player_escaped', (data) => {
    addKillFeedEntry(`${data.name || 'pilot'} ESCAPED · ${(data.survivalTime||0).toFixed(1)}s`, '#00ffff');
  });
  socket.on('session_ended', (data) => { showMpEndScreen(data.standings); });
  socket.on('player_left', ({ id, name }) => {
    removeMpPlayer(id);
    addKillFeedEntry(`${name || 'a pilot'} disconnected`, 'rgba(255,255,255,0.3)');
  });
}

function renderLobbyPlayers(players) {
  if (!G.lobbyPlayers) return;
  G.lobbyPlayers.innerHTML = players.map(p => `
    <div class="lobby-player-row">
      <div class="lobby-player-dot" style="background:${p.color}"></div>
      <div class="lobby-player-name">${p.name}</div>
      <div class="lobby-player-hint">SHIFT=BOOST · C=BRAKE</div>
    </div>`).join('');
}

function launchMpGame(sessionEnd) {
  if (G.mpLobby) G.mpLobby.style.display = 'none';
  hasStarted = true;
  if (!aiTroll) aiTroll = new AITroll(G.aiBox, G.aiMsg, PLAYER_NAME);
  else aiTroll.setPilot(PLAYER_NAME);
  if (!threeApp) { threeApp = buildThreeApp(G.gameLayer); threeApp.start(); }
  threeApp.beginRun({ multiplayer: true });
  G.hud.classList.add('is-active');
  G.introScreen.classList.add('is-fading');
  setTimeout(() => G.introScreen.classList.add('is-gone'), 500);
  setTimeout(() => aiTroll.pushFirstLine(true), 700);
  if (G.mpLeaderboard) G.mpLeaderboard.classList.add('is-visible');
  if ('ontouchstart' in window) { G.shootHint?.classList.add('is-visible'); showMobileTutorial(); }
  startPosBroadcast();
  startMpSessionTimer(sessionEnd);
}

function startPosBroadcast() {
  if (posInterval) clearInterval(posInterval);
  posInterval = setInterval(() => {
    if (!socket?.connected || !threeApp) return;
    const pos = threeApp.getShipPosition();
    const rot = threeApp.getShipRotation();
    socket.emit('pos', { x: pos.x, y: pos.y, z: pos.z, rotZ: rot.z, survivalTime: threeApp.getSurvivalTime() });
  }, 50);
}
function stopPosBroadcast() {
  if (posInterval) clearInterval(posInterval);
  posInterval = null;
}

function onPlayerKilled(data) {
  const isYou     = data.victimId  === socket?.id;
  const youKilled = data.shooterId === socket?.id;
  if (youKilled) {
    aiTroll?.pushLine(`${data.victimName} eliminated.`);
    addKillFeedEntry(`YOU → ${data.victimName}`, '#ffff00');
  } else if (isYou) {
    addKillFeedEntry(`${data.shooterName} → YOU`, '#ff0044');
  } else {
    addKillFeedEntry(`${data.shooterName} → ${data.victimName}`, '#ff6688');
  }
  updateLeaderboard();
}

function addKillFeedEntry(text, color = '#ff6688') {
  const feed = document.getElementById('kill-feed');
  if (!feed) return;
  const div = document.createElement('div');
  div.className = 'kill-feed-entry';
  div.style.borderLeftColor = color;
  div.textContent = text;
  feed.prepend(div);
  setTimeout(() => {
    div.classList.add('fading');
    setTimeout(() => div.remove(), 500);
  }, 4000);
}

function startMpSessionTimer(sessionEnd) {
  if (lbTickInterval) clearInterval(lbTickInterval);
  lbTickInterval = setInterval(() => {
    const left = Math.max(0, Math.floor((sessionEnd - Date.now()) / 1000));
    const el = document.getElementById('mp-session-timer');
    if (el) el.textContent = `${Math.floor(left/60)}:${(left%60).toString().padStart(2,'0')}`;
    updateLeaderboard();
    if (left <= 0) clearInterval(lbTickInterval);
  }, 500);
}

function updateLeaderboard() {
  const list = document.getElementById('mp-lb-list');
  if (!list) return;
  const sorted = [...mpRoomState.players].sort((a,b) => (b.kills-a.kills)||(b.survivalTime-a.survivalTime));
  list.innerHTML = sorted.map((p,i) => `
    <div class="mp-lb-row ${p.id===socket?.id?'is-you':''} ${!p.alive?'is-dead':''}">
      <span class="mp-lb-rank">#${i+1}</span>
      <span class="mp-lb-name" style="color:${p.color}">${p.name}</span>
      <span class="mp-lb-kills">⚔${p.kills}</span>
      <span class="mp-lb-time">${(p.survivalTime||0).toFixed(0)}s</span>
    </div>`).join('');
}

function showMpEndScreen(standings) {
  stopPosBroadcast();
  if (lbTickInterval) clearInterval(lbTickInterval);
  const myRank = standings.findIndex(p => p.id === socket?.id) + 1;
  const rankEl = document.getElementById('mp-end-rank');
  if (rankEl) rankEl.textContent = `YOU PLACED #${myRank} OF ${standings.length}`;
  const list = document.getElementById('mp-end-list');
  if (list) list.innerHTML = standings.map((p,i) => `
    <div class="mp-lb-row ${p.id===socket?.id?'is-you':''}">
      <span class="mp-lb-rank">#${i+1}</span>
      <span class="mp-lb-name" style="color:${p.color}">${p.name}</span>
      <span class="mp-lb-kills">⚔${p.kills}</span>
      <span class="mp-lb-time">${(p.survivalTime||0).toFixed(1)}s</span>
    </div>`).join('');
  G.mpEndScreen?.classList.add('is-visible');
  document.getElementById('mp-end-retry')?.addEventListener('click', () => location.reload(), { once: true });
  document.getElementById('mp-end-quit')?.addEventListener('click', () => { location.href = CFG.WEBRING_URL; }, { once: true });
}

function buildOtherShip(color) {
  const g = new THREE.Group();
  const col = parseInt((color || '#ff00ff').replace('#',''), 16);
  const hull = new THREE.Mesh(new THREE.ConeGeometry(0.5,4,10), new THREE.MeshBasicMaterial({ color: col }));
  hull.rotation.x = Math.PI/2; g.add(hull);
  const wing = new THREE.Mesh(new THREE.BoxGeometry(3.5,0.08,1.4), new THREE.MeshBasicMaterial({ color: col }));
  wing.position.z = 0.4; g.add(wing);
  g.scale.setScalar(0.9);
  return g;
}

function updateOtherPlayer(data) {
  if (!_scene) return;
  let entry = otherPlayers.get(data.id);
  if (!entry) {
    const group = new THREE.Group();
    group.add(buildOtherShip(data.color));
    const tag = makeNameTag(data.name || data.id.slice(0,6));
    tag.position.y = 2.5; group.add(tag);
    _scene.add(group);
    entry = { mesh: group, data };
    otherPlayers.set(data.id, entry);
  }
  entry.mesh.position.set(data.x, data.y, data.z);
  entry.mesh.rotation.z = data.rotZ || 0;
  entry.data = { ...entry.data, ...data };
}

function removeMpPlayer(id) {
  const entry = otherPlayers.get(id);
  if (entry && _scene) { _scene.remove(entry.mesh); otherPlayers.delete(id); }
}

function spawnIncomingBullet(data) {
  if (!_scene || !threeApp) return;
  const col = parseInt((data.color || '#ff00ff').replace('#',''), 16);
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.25,6,6), new THREE.MeshBasicMaterial({ color: col }));
  mesh.position.set(data.x, data.y, data.z);
  _scene.add(mesh);
  const vel = new THREE.Vector3(data.dx, data.dy, data.dz).normalize().multiplyScalar(CFG.BULLET_SPEED);
  let life = 0, hit = false;
  function tickBullet() {
    if (hit) return;
    life += 0.016;
    if (life > CFG.BULLET_LIFETIME) { _scene.remove(mesh); return; }
    mesh.position.addScaledVector(vel, 0.016);
    if (threeApp.isHittable()) {
      const myPos = threeApp.getShipPosition();
      if (mesh.position.distanceTo(new THREE.Vector3(myPos.x, myPos.y, myPos.z)) < 2.8) {
        hit = true; _scene.remove(mesh);
        socket?.emit('i_was_hit', { shooterId: data.shooterId });
        G.respawnOverlay?.classList.add('is-visible');
        G.damageFlash?.classList.add('is-active');
        setTimeout(() => G.damageFlash?.classList.remove('is-active'), 300);
        return;
      }
    }
    requestAnimationFrame(tickBullet);
  }
  requestAnimationFrame(tickBullet);
}
```

### Step 9 — Broadcast bullets from shoot()

Find inside `shoot()`:

```javascript
bullets.push(new Bullet(spawnPos, dir, target));
```

Add immediately after:

```javascript
if (mpMode && socket?.connected) {
  socket.emit('bullet_fired', {
    x: spawnPos.x, y: spawnPos.y, z: spawnPos.z,
    dx: dir.x, dy: dir.y, dz: dir.z,
    color: '#00ffff',
  });
}
```

### Step 10 — Portal escape in MP

In `triggerWin()`, replace the final redirect block:

```javascript
setTimeout(() => {
  aiTroll?.stopSpeech();
  speechSynthesis?.cancel();
  const p = new URLSearchParams({
    username: PLAYER_NAME || "anonymous",
    speed: Math.round(getSpeed(diffT) * throttleMult).toString(),
    ref: location.origin + location.pathname,
    hp: Math.ceil(health).toString(),
    color: "#00ffff",
    won: "true",
  });
  if (mpMode && socket?.connected) {
    socket.emit('portal_escape', { survivalTime: wallTime });
    stopPosBroadcast();
    setTimeout(() => { location.href = `${CFG.WEBRING_URL}?${p}`; }, 300);
  } else {
    location.href = `${CFG.WEBRING_URL}?${p}`;
  }
}, 650);
```

### Step 11 — Clean up MP on reset

In `resetRun()`, find `aiDirector.reset();` and add after:

```javascript
for (const [, entry] of otherPlayers) {
  if (entry.mesh.parent) _scene.remove(entry.mesh);
}
otherPlayers.clear();
```

### Step 12 — MP CSS (append to style.css)

```css
/* ── Mode Select ─────────────────────────────────────────────────── */
.mode-select { display:flex; gap:1.2rem; flex-wrap:wrap; justify-content:center; }
.mode-btn {
  font-family:var(--mono); display:flex; flex-direction:column; align-items:center;
  gap:0.45rem; padding:1.4rem 2rem; min-width:160px; background:rgba(0,10,15,0.75);
  border:1px solid rgba(0,255,255,0.28); border-radius:5px; cursor:pointer;
  transition:all 0.18s ease; color:var(--white);
}
.mode-btn:hover { border-color:var(--cyan); background:var(--cyan-g); transform:translateY(-4px); box-shadow:var(--glow-cyan); }
.mode-btn-icon { font-size:2rem; }
.mode-btn-title { font-size:1rem; letter-spacing:0.18em; color:var(--cyan); }
.mode-btn-desc { font-size:0.68rem; color:rgba(255,255,255,0.45); text-align:center; }
.mode-btn--multi { border-color:rgba(255,0,255,0.28); }
.mode-btn--multi .mode-btn-title { color:var(--magenta); }
.mode-btn--multi:hover { border-color:var(--magenta); box-shadow:var(--glow-magenta); }
/* ── MP Setup ────────────────────────────────────────────────────── */
.mp-setup { display:flex; flex-direction:column; gap:1rem; width:min(440px,90vw); }
/* Kinetic drift hint in MP setup */
.mp-controls-hint {
  display:flex; flex-wrap:wrap; gap:0.5rem; justify-content:center; align-items:center;
  padding:0.6rem 0.8rem; background:rgba(0,10,15,0.6);
  border:1px solid rgba(0,255,255,0.12); border-radius:4px;
}
.mp-ctrl-tag {
  font-family:var(--mono); font-size:0.72rem; letter-spacing:0.1em;
  padding:3px 8px; border-radius:3px; font-weight:600;
}
.mp-ctrl-boost { color:rgba(255,200,0,0.9); background:rgba(255,200,0,0.08); border:1px solid rgba(255,200,0,0.3); }
.mp-ctrl-brake { color:rgba(0,200,255,0.9); background:rgba(0,200,255,0.08); border:1px solid rgba(0,200,255,0.3); }
.mp-ctrl-sub { font-size:0.6rem; color:rgba(255,255,255,0.28); letter-spacing:0.1em; width:100%; text-align:center; margin-top:0.2rem; }
/* ── Room section ────────────────────────────────────────────────── */
.room-section { display:flex; flex-direction:column; gap:0.5rem; }
.room-row { display:flex; align-items:center; gap:0.6rem; }
.room-code-input { font-family:var(--mono); flex:1; font-size:14px; letter-spacing:0.25em; text-transform:uppercase; text-align:center; padding:0.7rem; background:var(--void); border:1px solid rgba(0,255,255,0.3); border-radius:3px; color:var(--cyan); }
.room-code-input:focus { outline:none; border-color:var(--cyan); box-shadow:var(--glow-cyan); }
.room-or { font-size:0.7rem; color:rgba(255,255,255,0.3); white-space:nowrap; }
.room-create-btn { font-family:var(--mono); font-size:0.72rem; letter-spacing:0.12em; padding:0.7rem 1rem; background:rgba(0,255,255,0.08); border:1px solid rgba(0,255,255,0.4); border-radius:3px; color:var(--cyan); cursor:pointer; white-space:nowrap; transition:all 0.15s ease; }
.room-create-btn:hover { background:var(--cyan); color:var(--void); }
.room-display { font-size:0.8rem; letter-spacing:0.1em; color:rgba(255,255,255,0.55); text-align:center; padding:0.5rem; background:rgba(0,255,255,0.04); border:1px solid rgba(0,255,255,0.15); border-radius:3px; cursor:pointer; }
.room-code-big { font-size:1.3rem; color:var(--cyan); letter-spacing:0.3em; text-shadow:var(--glow-cyan); }
.room-copy-hint { font-size:0.65rem; color:rgba(0,255,255,0.4); }
/* ── Lobby ───────────────────────────────────────────────────────── */
.mp-lobby { display:flex; flex-direction:column; align-items:center; gap:1rem; width:min(440px,90vw); padding:1.5rem; background:rgba(0,6,10,0.9); border:1px solid var(--cyan); border-radius:6px; }
.lobby-title { font-size:0.78rem; letter-spacing:0.25em; color:rgba(0,255,255,0.7); }
.lobby-countdown { font-size:2.8rem; color:#ffff00; letter-spacing:0.1em; text-shadow:0 0 20px rgba(255,255,0,0.7); font-weight:bold; min-height:3.5rem; display:flex; align-items:center; }
.lobby-players { width:100%; display:flex; flex-direction:column; gap:0.4rem; max-height:200px; overflow-y:auto; }
.lobby-player-row { display:flex; align-items:center; gap:0.7rem; padding:0.45rem 0.7rem; background:rgba(0,20,30,0.6); border-radius:3px; font-size:0.82rem; }
.lobby-player-dot { width:8px; height:8px; border-radius:50%; flex-shrink:0; }
.lobby-player-name { flex:1; color:var(--white); }
.lobby-player-hint { font-size:0.6rem; color:rgba(255,255,255,0.22); letter-spacing:0.06em; }
.lobby-hint { font-size:0.65rem; color:rgba(255,255,255,0.28); text-align:center; }
.lobby-share-link { font-size:0.62rem; color:rgba(0,255,255,0.5); cursor:pointer; word-break:break-all; padding:0.35rem 0.5rem; border:1px solid rgba(0,255,255,0.12); border-radius:3px; text-align:center; }
.lobby-share-link:hover { color:var(--cyan); border-color:rgba(0,255,255,0.35); }
/* ── In-game leaderboard ─────────────────────────────────────────── */
.mp-leaderboard { position:fixed; top:50%; right:1.1rem; transform:translateY(-50%); width:230px; background:rgba(0,4,8,0.92); border:1px solid rgba(255,255,0,0.4); border-radius:4px; padding:0.9rem; opacity:0; transition:opacity 0.3s ease; pointer-events:none; z-index:15; }
.mp-leaderboard.is-visible { opacity:1; }
.mp-lb-title { font-size:10px; letter-spacing:0.2em; color:rgba(255,255,0,0.8); text-align:center; margin-bottom:0.7rem; padding-bottom:0.5rem; border-bottom:1px solid rgba(255,255,0,0.2); }
.mp-lb-list { display:flex; flex-direction:column; gap:0.35rem; }
.mp-lb-row { display:flex; align-items:center; gap:0.4rem; padding:0.35rem 0.5rem; background:rgba(0,15,22,0.7); border-radius:2px; font-size:11px; color:var(--white); }
.mp-lb-row.is-you { border:1px solid rgba(255,255,0,0.6); background:rgba(255,255,0,0.05); }
.mp-lb-row.is-dead { opacity:0.35; }
.mp-lb-rank { color:rgba(255,255,0,0.55); min-width:18px; font-size:10px; }
.mp-lb-name { flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.mp-lb-kills { color:#ff6688; font-size:10px; min-width:24px; text-align:right; }
.mp-lb-time { color:rgba(255,255,255,0.5); font-size:9px; min-width:28px; text-align:right; }
.mp-session-timer { font-size:1.1rem; color:#ffff00; text-align:center; margin-top:0.7rem; padding-top:0.6rem; border-top:1px solid rgba(255,255,0,0.2); font-weight:bold; }
/* ── Kill feed ───────────────────────────────────────────────────── */
.kill-feed { position:fixed; top:9rem; right:1.1rem; width:250px; display:flex; flex-direction:column; gap:0.3rem; z-index:14; pointer-events:none; }
.kill-feed-entry { font-size:11px; padding:0.3rem 0.6rem; background:rgba(0,0,0,0.75); border-left:2px solid #ff6688; border-radius:0 2px 2px 0; color:rgba(255,255,255,0.8); opacity:1; transition:opacity 0.5s ease; }
.kill-feed-entry.fading { opacity:0; }
/* ── Respawn overlay ─────────────────────────────────────────────── */
.respawn-overlay { position:fixed; inset:0; display:flex; align-items:center; justify-content:center; background:rgba(255,0,40,0.08); z-index:22; opacity:0; pointer-events:none; transition:opacity 0.2s ease; }
.respawn-overlay.is-visible { opacity:1; }
.respawn-text { font-size:2rem; color:#ff2244; letter-spacing:0.3em; text-shadow:0 0 30px rgba(255,0,40,0.9); animation:death-pulse 0.8s ease-in-out infinite; }
/* ── MP end screen ───────────────────────────────────────────────── */
.mp-end-screen { position:fixed; inset:0; display:flex; align-items:center; justify-content:center; background:rgba(0,0,0,0.97); z-index:30; opacity:0; pointer-events:none; transition:opacity 0.4s ease; }
.mp-end-screen.is-visible { opacity:1; pointer-events:auto; }
.mp-end-content { display:flex; flex-direction:column; align-items:center; gap:1.2rem; padding:2.5rem; border:1px solid rgba(255,255,0,0.5); background:rgba(0,0,0,0.97); border-radius:6px; max-width:min(520px,92vw); text-align:center; }
.mp-end-title { font-size:1.8rem; letter-spacing:0.2em; color:#ffff00; }
.mp-end-rank { font-size:1.2rem; color:var(--cyan); padding:0.8rem 1.5rem; background:rgba(0,255,255,0.07); border-radius:4px; }
.mp-end-list { width:100%; max-height:280px; overflow-y:auto; }
.mp-end-buttons { display:flex; gap:1rem; margin-top:0.5rem; }
```

---

## PART 8 — PORTAL — COMPLETE VERIFIED IMPLEMENTATION

### Fix 1 — Portal arrival: skip typewriter, start instantly

Already covered in Part 1 Fix 3. Confirm `immediatePortalCheck()` runs before the typewriter block.

### Fix 2 — Return portal label

In `buildStartPortal()`:

```javascript
function buildStartPortal(sys, referrer, playerZ) {
  if (sys.startPortal) return;
  const group = new THREE.Group();
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(8, 1, 4, 12),
    new THREE.MeshBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.7 })
  );
  group.add(ring);
  const label = makePortalLabel("← RETURN");
  label.position.set(0, 11, 0);
  label.scale.multiplyScalar(0.5);
  group.add(label);
  const safeZ = (playerZ && playerZ !== 0) ? playerZ + 12 : 12;
  group.position.set(-28, 3, safeZ);
  _scene.add(group);
  sys.startPortal = { group, visible: true, referrer };
}
```

### Fix 3 — Portal exit URL includes full pathname + throttle speed

Already handled by Step 10 in Part 7 which references `throttleMult` directly from the closure.

### Fix 4 — Portal arrival AI line

In `startGame()`, after `threeApp.beginRun({ fromPortal, referrer })`:

```javascript
if (fromPortal) {
  setTimeout(() => {
    const arrivals = [
      "you fell in from somewhere else. still going to crash.",
      "portal arrival. interesting. survive.",
      "you brought your chaos with you. welcome.",
    ];
    aiTroll?.announce(arrivals[Math.floor(Math.random() * arrivals.length)], {
      priority: 4, interrupt: true, ttlMs: 3000, dedupeKey: 'portal-arrival'
    });
  }, 800);
}
```

---

## PART 9 — MOBILE CONTROLS

Mobile uses a virtual joystick on the left for movement, tap/hold on the right for shooting, and two dedicated buttons for Boost (⚡) and Brake (⚓).

### Add to app.innerHTML (after `<div id="shoot-hint">`)

```html
<!-- Mobile virtual joystick -->
<div id="vj-zone" style="position:fixed;left:0;bottom:0;width:45vw;height:45vh;z-index:12;display:none;touch-action:none;">
  <div id="vj-base" style="position:absolute;width:110px;height:110px;border:2px solid rgba(0,255,255,0.3);border-radius:50%;background:rgba(0,20,30,0.5);left:50%;top:50%;transform:translate(-50%,-50%);">
    <div id="vj-thumb" style="position:absolute;width:44px;height:44px;border-radius:50%;background:rgba(0,255,255,0.55);top:50%;left:50%;transform:translate(-50%,-50%);pointer-events:none;"></div>
  </div>
</div>
<!-- Mobile shoot zone -->
<div id="shoot-zone" style="position:fixed;right:0;bottom:0;width:45vw;height:45vh;z-index:12;display:none;touch-action:none;align-items:center;justify-content:center;">
  <div style="width:80px;height:80px;border:2px solid rgba(255,200,0,0.5);border-radius:50%;background:rgba(255,180,0,0.06);display:flex;align-items:center;justify-content:center;font-family:var(--mono);font-size:9px;letter-spacing:0.2em;color:rgba(255,200,0,0.6);">SHOOT</div>
</div>
<!-- Mobile throttle bar -->
<div id="mobile-throttle-bar" style="position:fixed;bottom:calc(45vh + 0.6rem);left:50%;transform:translateX(-50%);display:none;gap:0.6rem;z-index:13;align-items:center;">
  <button id="mobile-brake-btn" class="mobile-throttle-btn mobile-throttle-btn--brake">
    <span>⚓</span><span class="mobile-throttle-label">BRAKE</span>
  </button>
  <div id="mobile-heat-bar" class="mobile-heat-bar">
    <div id="mobile-heat-fill" class="mobile-heat-fill"></div>
    <span id="mobile-speed-text" class="mobile-speed-text">—</span>
  </div>
  <button id="mobile-boost-btn" class="mobile-throttle-btn mobile-throttle-btn--boost">
    <span>⚡</span><span class="mobile-throttle-label">BOOST</span>
  </button>
</div>
```

### Add mobile throttle styles to style.css

```css
/* ── Mobile throttle bar ─────────────────────────────────────────── */
#mobile-throttle-bar { display:none; }
@media (pointer: coarse) { #mobile-throttle-bar { display:flex; } }

.mobile-throttle-btn {
  font-family: var(--mono);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 0.45rem 0.9rem;
  border-radius: 20px;
  border: 1px solid;
  background: transparent;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  user-select: none;
  transition: all 0.08s ease;
  font-size: 1rem;
}
.mobile-throttle-btn--boost {
  color: rgba(255,200,0,0.85);
  border-color: rgba(255,200,0,0.4);
}
.mobile-throttle-btn--boost:active {
  background: rgba(255,200,0,0.15);
  box-shadow: 0 0 14px rgba(255,200,0,0.4);
}
.mobile-throttle-btn--brake {
  color: rgba(0,200,255,0.85);
  border-color: rgba(0,200,255,0.4);
}
.mobile-throttle-btn--brake:active {
  background: rgba(0,200,255,0.12);
  box-shadow: 0 0 12px rgba(0,200,255,0.3);
}
.mobile-throttle-label {
  font-size: 7px;
  letter-spacing: 0.14em;
}
.mobile-heat-bar {
  width: 64px;
  height: 8px;
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(0,255,255,0.2);
  border-radius: 4px;
  overflow: hidden;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}
.mobile-heat-fill {
  position: absolute;
  left: 0; top: 0; bottom: 0;
  width: 0%;
  background: linear-gradient(90deg, #ffcc00, #ff4400);
  transition: width 0.1s ease;
  border-radius: 4px;
}
.mobile-speed-text {
  position: relative;
  font-size: 7px;
  color: rgba(0,255,255,0.7);
  font-family: var(--mono);
  letter-spacing: 0.08em;
  z-index: 1;
  pointer-events: none;
}
```

### Add mobile controls setup in main.js

After the `G` object declaration, add:

```javascript
// ── Mobile controls ───────────────────────────────────────────────
let _mobileBoostHeld = false;
let _mobileBrakeHeld = false;

(function setupMobileControls() {
  if (!('ontouchstart' in window)) return;

  const vjZone    = document.getElementById('vj-zone');
  const vjBase    = document.getElementById('vj-base');
  const vjThumb   = document.getElementById('vj-thumb');
  const shootZone = document.getElementById('shoot-zone');
  const throttleBar = document.getElementById('mobile-throttle-bar');
  const boostBtn  = document.getElementById('mobile-boost-btn');
  const brakeBtn  = document.getElementById('mobile-brake-btn');

  if (vjZone)    vjZone.style.display    = 'block';
  if (shootZone) shootZone.style.display = 'flex';
  if (throttleBar) throttleBar.style.display = 'flex';

  const R = 48;
  let joyX = 0, joyY = 0;

  function updateJoy(touch) {
    const rect = vjBase.getBoundingClientRect();
    let dx = touch.clientX - (rect.left + rect.width / 2);
    let dy = touch.clientY - (rect.top  + rect.height / 2);
    const d = Math.hypot(dx, dy);
    if (d > R) { dx = dx/d*R; dy = dy/d*R; }
    joyX = dx / R;
    joyY = -(dy / R);
    vjThumb.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
  }

  vjZone.addEventListener('touchstart', e => { e.preventDefault(); updateJoy(e.touches[0]); }, { passive:false });
  vjZone.addEventListener('touchmove',  e => { e.preventDefault(); updateJoy(e.touches[0]); }, { passive:false });
  vjZone.addEventListener('touchend',   e => {
    e.preventDefault(); joyX = 0; joyY = 0;
    vjThumb.style.transform = 'translate(-50%, -50%)';
  }, { passive:false });

  // Shoot zone — hold fires continuously
  let shootInterval = null;
  shootZone.addEventListener('touchstart', e => {
    e.preventDefault();
    // shoot() is called from the tick loop via _mobileShootHeld
    window._mobileShootHeld = true;
  }, { passive:false });
  shootZone.addEventListener('touchend', e => {
    e.preventDefault();
    window._mobileShootHeld = false;
  }, { passive:false });

  // Boost button
  if (boostBtn) {
    boostBtn.addEventListener('touchstart', e => { e.preventDefault(); _mobileBoostHeld = true; },  { passive:false });
    boostBtn.addEventListener('touchend',   e => { e.preventDefault(); _mobileBoostHeld = false; }, { passive:false });
  }

  // Brake button
  if (brakeBtn) {
    brakeBtn.addEventListener('touchstart', e => { e.preventDefault(); _mobileBrakeHeld = true; },  { passive:false });
    brakeBtn.addEventListener('touchend',   e => { e.preventDefault(); _mobileBrakeHeld = false; }, { passive:false });
  }

  window._mobileJoy = { getX: () => joyX, getY: () => joyY };
})();
```

### Wire into tick() — replace rawX/rawY and shoot trigger:

```javascript
// In tick(), replace the rawX/rawY lines:
const _joy = window._mobileJoy;
let rawX = ((keys.has("KeyD")||keys.has("ArrowRight"))?1:0)
         - ((keys.has("KeyA")||keys.has("ArrowLeft"))?1:0)
         + touchDX
         + (_joy ? _joy.getX() : 0);
let rawY = ((keys.has("KeyW")||keys.has("ArrowUp"))?1:0)
         - ((keys.has("KeyS")||keys.has("ArrowDown"))?1:0)
         + touchDY
         + (_joy ? _joy.getY() : 0);

// Replace the continuous shoot line:
if ((keys.has("Space") || mouseDown || touchShootHeld || window._mobileShootHeld) && shootCool <= 0) shoot();
```

### Update mobile heat bar in tick()

Add near the end of the tick loop (where HUD is updated):

```javascript
// Sync mobile heat bar
const mobileHeatFill = document.getElementById('mobile-heat-fill');
const mobileSpeedTxt = document.getElementById('mobile-speed-text');
if (mobileHeatFill) mobileHeatFill.style.width = `${Math.round(boostHeat * 100)}%`;
if (mobileSpeedTxt) mobileSpeedTxt.textContent = boostOverheat
  ? 'HOT'
  : `${Math.round(getSpeed(diffT) * throttleMult)}`;
```

---

## PART 10 — RAILWAY DEPLOYMENT

1. Push `server.js` + updated `package.json` to GitHub
2. railway.app → New Project → Deploy from GitHub → select repo
3. Start command: `node server.js`
4. Settings → Networking → Generate Domain → copy URL
5. In `main.js`, replace `'https://YOUR-RAILWAY-URL.up.railway.app'` with your actual URL
6. Push again → Cloudflare Pages auto-deploys

**Optional — nixpacks.toml at project root:**

```toml
[phases.build]
cmds = ["npm install"]

[start]
cmd = "node server.js"
```

---

## PART 11 — FINAL CHECKLIST

### Must-have (disqualification risk)
- [ ] `<script async src="https://vibej.am/2026/widget.js"></script>` in `<head>`
- [ ] Game loads in < 3 seconds
- [ ] No login/signup required
- [ ] Submitted at vibej.am with correct categories ticked

### Kinetic Drift
- [ ] SHIFT increases speed to ~155% with heat buildup
- [ ] C decreases speed to ~45%
- [ ] Overheat banner fires and boost locks out until cool
- [ ] Speed color in HUD changes: yellow = boost, blue = brake, red = overheat
- [ ] Boost heat bar appears when heat > 5%
- [ ] Mobile ⚡ and ⚓ buttons visible on touch device
- [ ] Mobile heat bar syncs to `boostHeat`

### Gameplay
- [ ] Cores never appear inside obstacles (test 10 runs)
- [ ] Portal fires on timer AND core unlock
- [ ] Win sequence → `vibej.am/portal/2026` redirect works
- [ ] `?portal=true` → starts game in < 1 second, no intro visible
- [ ] `?portal=true&username=foo` → sets name correctly
- [ ] `?portal=true&ref=https://example.com` → return portal spawns with "← RETURN" label
- [ ] Walking into return portal → sends back to ref URL

### Multiplayer
- [ ] CREATE ROOM → 6-char code appears
- [ ] Second browser tab can JOIN with that code
- [ ] Both players see each other's ships
- [ ] Bullets visible cross-player
- [ ] Kill feed works
- [ ] Leaderboard sorted correctly
- [ ] Session ends after 180s with standings
- [ ] `?room=ABCDEF` pre-fills room code
- [ ] Lobby shows copyable share link

### Mobile
- [ ] Virtual joystick visible on left side
- [ ] Left thumb moves ship
- [ ] Right half tap/hold fires
- [ ] ⚡ BOOST button holds active
- [ ] ⚓ BRAKE button holds active
- [ ] Mobile heat bar shows boost temperature

### Controls HUD
- [ ] Left panel shows WASD (desktop) or LEFT/MOVE (mobile)
- [ ] Right panel shows SPACE/MOUSE + SHIFT=BOOST + C=BRAKE
- [ ] Boost key styled yellow, brake key styled cyan
- [ ] Panels hidden on < 480px screens
- [ ] Right panel hides when MP leaderboard visible
- [ ] Panels hide on death, reappear on retry

### AI Commentary
- [ ] All lines are ≤ 8 words (test with TTS on)
- [ ] Pre-attack warning fires 1.2s before each AI event
- [ ] Chapter banners fire on state transitions
- [ ] Chapter transitions accelerate when cores are destroyed fast
- [ ] `onCoreDestroyed` only speaks every 2 kills

---

## THE HONEST TRUTH

Your game has the best narrative hook in the jam. The AI going SMUG → BROKEN → "please take me with you" is something no other entry has. The judges will remember it.

The **Kinetic Drift** throttle system (Shift/C) transforms this from a passive runner into an active dogfighting game. In solo play, it's a skill tool — feather your speed to dodge obstacles at angles. In multiplayer, it's pure tactics — anchor to let an enemy overshoot, then boost onto their tail. The controls HUD makes this legible to a judge who's never touched the game.

Fix the cores (Part 1). Get multiplayer working (Part 7). Add the throttle (Part 6). These three things move you from "notable entry" to gold contender.

Ship it.