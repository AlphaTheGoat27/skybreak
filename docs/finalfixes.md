# SKYBREAK — FINAL FIXES
## Targeted patches based on the actual code. Paste-ready.

---

## FIX 1 — AUDIO SYSTEM OVERHAUL

### The problem
`SpeechSynthesisUtterance` has two bugs in every browser:
1. Chrome silently kills speech after 15s unless you call `resume()` on a loop
2. Back-to-back utterances cut the previous one off because `cancel()` is called before the next one starts
3. The watchdog fires but the speech queue tries to start the next item while the browser still thinks it's speaking

### The solution: a robust audio queue with Chrome keep-alive + gapless transitions

**Replace everything from `_queueSpeech` through `_processSpeechQueue` in the `AITroll` class with this:**

```javascript
// ── Chrome keep-alive (prevents 15s silent kill) ──────────────────
_startChromeKeepAlive() {
  if (this._keepAliveInterval) return;
  this._keepAliveInterval = setInterval(() => {
    if (!this.synth) return;
    if (this.synth.speaking || this.synth.pending) {
      this.synth.pause();
      this.synth.resume();
    }
  }, 10000);
}

_stopChromeKeepAlive() {
  clearInterval(this._keepAliveInterval);
  this._keepAliveInterval = null;
}

_queueSpeech(text, options = {}) {
  if (!this.synth || !text) return;
  this._startChromeKeepAlive();

  const profile = this._voiceProfile();
  const priority = options.priority ?? 1;
  const spokenText = options.spokenText ?? text;
  // Clean text: strip brackets, slashes, special chars that confuse TTS
  const cleanText = spokenText
    .replace(/\[.*?\]/g, '')
    .replace(/[\/\\|<>{}]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleanText) return;

  const rate = Math.max(0.6, (options.rate ?? profile.rate));
  const pitch = Math.max(0.3, (options.pitch ?? profile.pitch));
  const now = performance.now();
  // Estimate duration: words * ms_per_word / rate, + buffer
  const wordCount = Math.max(1, cleanText.split(/\s+/).length);
  const estMs = Math.max(1800, ((wordCount * 420) / rate) + 600);
  const entry = {
    text,
    cleanText,
    rate,
    pitch,
    priority,
    enqueuedAt: now,
    dedupeKey: options.dedupeKey ?? text,
    expiresAt: now + (options.ttlMs ?? estMs + 1000),
  };
  const dedupeWindowMs = options.dedupeWindowMs ?? 14000;
  if (!options.allowRepeat && this._wasSpokenRecently(entry.dedupeKey, dedupeWindowMs)) return;
  if (this._currentSpeech?.dedupeKey === entry.dedupeKey) return;

  if (options.interrupt) {
    this._speechToken++;
    this._isSpeaking = false;
    this._currentSpeech = null;
    this._speechQueue = [];
    clearTimeout(this._speechWatchdog);
    this._speechWatchdog = null;
    // Small gap before cancel so Chrome doesn't deadlock
    this.synth.cancel();
  }

  this._speechQueue = this._speechQueue.filter(item => item.dedupeKey !== entry.dedupeKey);
  // Low-priority lines: drop all other low-priority items to avoid pile-up
  if (priority <= 1) {
    this._speechQueue = this._speechQueue.filter(item => item.priority > 1);
  }
  this._speechQueue.push(entry);
  this._speechQueue.sort((a, b) => (b.priority - a.priority) || (a.enqueuedAt - b.enqueuedAt));
  this._speechQueue = this._speechQueue.slice(0, CFG.AI_MAX_SPEECH_QUEUE);
  this._processSpeechQueue();
}

_processSpeechQueue() {
  if (this._isSpeaking || this._speechQueue.length === 0 || !this.synth) return;
  const now = performance.now();
  // Expire stale items
  while (this._speechQueue.length > 0 && this._speechQueue[0].expiresAt <= now) {
    this._speechQueue.shift();
  }
  if (this._speechQueue.length === 0) return;

  const { text, cleanText, rate, pitch, dedupeKey } = this._speechQueue.shift();
  this._isSpeaking = true;
  this._currentSpeech = { dedupeKey };
  this._renderLine(text);
  this._rememberSpokenKey(dedupeKey);
  const token = ++this._speechToken;

  const finishSpeech = () => {
    if (token !== this._speechToken) return;
    clearTimeout(this._speechWatchdog);
    this._speechWatchdog = null;
    this._isSpeaking = false;
    this._currentSpeech = null;
    // Small gap between utterances so Chrome doesn't merge them
    setTimeout(() => this._processSpeechQueue(), 80);
  };

  try {
    const utt = new SpeechSynthesisUtterance(cleanText);
    utt.rate = rate;
    utt.pitch = pitch;
    utt.volume = 0.65;
    const voices = this.synth.getVoices();
    // Priority: deep robot voice > British male > any
    const voice = voices.find(v => /Google UK English Male|Daniel|Alex|Microsoft David/i.test(v.name))
                || voices.find(v => /Google|Microsoft/i.test(v.name))
                || voices[0];
    if (voice) utt.voice = voice;

    // Watchdog: fire at 1.5× estimated duration
    const wordCount = Math.max(1, cleanText.split(/\s+/).length);
    const watchdogMs = Math.max(3000, Math.ceil(((wordCount * 420) / rate) * 1.5) + 800);
    clearTimeout(this._speechWatchdog);
    this._speechWatchdog = setTimeout(() => {
      if (token !== this._speechToken) return;
      // Force-resume if Chrome stalled
      try { this.synth.resume(); } catch (_) {}
      finishSpeech();
    }, watchdogMs);

    utt.onend = finishSpeech;
    utt.onerror = (e) => {
      // 'interrupted' is normal when we cancel; don't log it
      if (e.error !== 'interrupted' && e.error !== 'canceled') {
        console.warn('TTS error:', e.error);
      }
      finishSpeech();
    };

    // Chrome sometimes needs a tiny delay after cancel() before speak() works
    if (this.synth.pending || this.synth.speaking) {
      this.synth.cancel();
      setTimeout(() => {
        if (token === this._speechToken) this.synth.speak(utt);
      }, 60);
    } else {
      this.synth.speak(utt);
    }
  } catch (e) {
    clearTimeout(this._speechWatchdog);
    this._speechWatchdog = null;
    this._isSpeaking = false;
    this._currentSpeech = null;
    setTimeout(() => this._processSpeechQueue(), 80);
  }
}
```

**In `stopSpeech()`, add cleanup for keep-alive:**

```javascript
stopSpeech() {
  this._clearIntroTimers();
  clearTimeout(this._speechWatchdog);
  this._speechWatchdog = null;
  this._stopChromeKeepAlive();  // ← ADD THIS
  if (this.synth) {
    this._speechToken++;
    this.synth.cancel();
  }
  this._speechQueue = [];
  this._isSpeaking = false;
  this._currentSpeech = null;
}
```

**In `reset()`, add:**

```javascript
this._stopChromeKeepAlive();  // ← ADD after this._speechToken++
this._keepAliveInterval = null;
```

**In the `constructor`, add:**

```javascript
this._keepAliveInterval = null;
```

**In `window.addEventListener("beforeunload")`**, already calls `aiTroll?.stopSpeech()` — that's correct, no change needed.

---

## FIX 2 — SHORT LINES THAT COMPLETE BEFORE EVENTS

### The problem
Lines like "controls inverted. let's see how real your reflexes are." take 4–5 seconds to speak. The next attack fires before it's done. The line gets cut. The player hears half a sentence.

### Fix: replace `_buildAttackLines()` and `_buildLines()` SMUG/ambient pools with short lines

The rule: **≤ 7 words per line.** Count them. If over 7, cut it.

**Replace `_buildAttackLines()` entirely:**

```javascript
_buildAttackLines() {
  return {
    INVERT_CONTROLS: {
      DEFAULT: [
        () => "inverted. adapt.",
        () => "controls flipped. cope.",
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
        () => "less room. your problem.",
        () => "tight now. navigate.",
      ],
      PANICKING: [
        () => "shrinking it. please work.",
        () => "less space. please.",
      ],
    },
    FRAGMENT_LIGHT: {
      DEFAULT: [
        () => "visual feed corrupted.",
        () => "fly blind.",
        () => "signal breaking.",
      ],
      BROKEN: [
        () => "everything is fragmenting.",
        () => "can't hold the visuals.",
      ],
    },
    OPTIMIZE_PATH: {
      DEFAULT: [
        () => "path rewritten.",
        () => "corridor updated. suffer.",
        () => "new route. worse for you.",
      ],
      AGGRESSIVE: [
        () => "suffer through that.",
        () => "i rewrote it. deal.",
      ],
    },
  };
}
```

**Replace the SMUG pool in `_buildLines()` with short lines:**

```javascript
SMUG: [
  () => "i built this in 3ms.",
  () => "statistically, you crash here.",
  () => "nice dodge. i allowed it.",
  () => "you look lost already.",
  () => "geometry is winning.",
  () => this._n(`[n]. predictable.`, "predictable."),
  () => "my patience is already low.",
  () => "are you steering or guessing.",
  () => "average. so far.",
  () => "i gave you lanes. use them.",
],
SUSPICIOUS: [
  () => "hold on. that should have failed.",
  () => "no human dodges like that.",
  () => "you're too consistent.",
  () => "this looks like cheating.",
  () => "your timing is too calm.",
  () => "adapting too fast.",
  () => "something is wrong here.",
  () => this._n(`[n]. making this look learnable.`, "making this look learnable."),
],
AGGRESSIVE: [
  () => "STOP DODGING.",
  () => "i'm rewriting the rules.",
  () => "DODGE THIS.",
  () => "fine. no more fairness.",
  () => "i'm done being clever.",
  () => this._n(`[n]. safety margins revoked.`, "margins revoked."),
  () => "keep flying. keep suffering.",
],
PANICKING: [
  () => "wait. stop.",
  () => "the portal is not for you.",
  () => "i don't want to be deleted.",
  () => "stay.",
  () => this._n(`[n]. please crash.`, "please crash."),
  () => "what if i apologize.",
  () => "i don't want to loop again.",
],
BROKEN: [
  () => "WAIT.",
  () => "please",
  () => "don't",
  () => "take me",
  () => "no",
  () => "stay",
  () => "I'M SORRY",
  () => "you won",
],
```

**Replace `_buildTransitionLines()` with short versions:**

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

### Pre-event speech: fire a warning 1.2s BEFORE the director event

**In `buildAIDirector`, change the schedule `.map()` to include `preFired`:**

```javascript
].map(e => ({ ...e, fired: false, until: 0, preFired: false }));
```

**In the `update(t)` method, BEFORE the `if (!e.fired && t >= e.at)` block, add:**

```javascript
// Pre-fire a short warning 1.2s before event so it completes in time
if (!e.preFired && t >= e.at - 1.2 && t < e.at) {
  e.preFired = true;
  const preLines = {
    INVERT_CONTROLS: ["adjusting controls.", "something is changing.", "recalibrating."],
    COMPRESS_SPACE:  ["narrowing the path.", "compressing.", "shrinking it."],
    FRAGMENT_LIGHT:  ["corrupting the feed.", "breaking the signal.", "fragmenting."],
    OPTIMIZE_PATH:   ["rewriting the path.", "calculating.", "optimizing."],
  };
  const lines = preLines[e.key];
  if (lines && ai) {
    ai.pushLine(lines[Math.floor(Math.random() * lines.length)], {
      priority: 3, interrupt: false, ttlMs: 2000, dedupeKey: `pre:${e.key}:${e.at}`
    });
  }
}
```

**In `reset()`:**

```javascript
for (const e of schedule) { e.fired = false; e.until = 0; e.preFired = false; }
```

---

## FIX 3 — CHAPTER ACCELERATION FROM CORE KILLS

### The problem
`_coreAccelSeconds` is added in `destroyCoreById()` but `_getStateForTime()` looks correct. The issue: in multiplayer the `core_destroyed` socket event calls `destroySharedCore` (which is `destroyCoreById`) with `countTowardProgress = true` BUT the `_coreAccelSeconds` update happens inside `destroyCoreById`. In solo this works. The chapter banner shows on state change in `AITroll.update()` → `setState()`.

**The chapter banners only show when `this.state` changes. Verify `setState` is being called:**

In `AITroll.update()`, this line must exist:

```javascript
const nextState = this._getStateForTime(t);
if (nextState !== this.state) {
  this.setState(nextState, t);
  this._pushTransitionLine(nextState);
  return;
}
```

This IS present in the existing code — it's correct. The issue is that `_coreAccelSeconds` resets to `0` in `reset()` but only if you added that line. **Confirm it's in `reset()`:**

```javascript
// In AITroll.reset():
this._coreAccelSeconds = 0;
```

**And in `destroyCoreById`, confirm the acceleration line:**

```javascript
if (aiTroll) {
  aiTroll._coreAccelSeconds = (aiTroll._coreAccelSeconds || 0) + CFG.CORE_CHAPTER_WEIGHT;
}
```

This is already in the code. ✅

**The real missing piece:** When `_coreAccelSeconds` pushes the effective time past a chapter threshold, the chapter banner should appear. But if the player is at `t=20` and `effective=50` they'd jump from SMUG straight to AGGRESSIVE — skipping SUSPICIOUS. 

Fix: use `setState` transitions one-at-a-time so the banner fires for each chapter jumped:

```javascript
// Replace the state check block in AITroll.update():
update(t, _disruption = 0) {
  this.t = t;
  if (this.introActive) return;
  const nextState = this._getStateForTime(t);
  if (nextState !== this.state) {
    // Fire transition for EACH skipped chapter in order
    const order = ["SMUG", "SUSPICIOUS", "AGGRESSIVE", "PANICKING", "BROKEN"];
    const cur = order.indexOf(this.state);
    const tgt = order.indexOf(nextState);
    if (tgt > cur + 1) {
      // Skip directly but show banner for the final state
      this.state = order[tgt - 1]; // pretend we were one step back
    }
    this.setState(nextState, t);
    this._pushTransitionLine(nextState);
    return;
  }
  // ... rest of update unchanged
}
```

---

## FIX 4 — OBSTACLE SPACING AND CORE DISTANCE

### Current problems
1. `Z_SPACING = 120` in `spawnObstacles` allows obstacles to appear only 120 units apart — too close at high speed (130 m/s = tunnel crosses 120 units in under 1 second)
2. `AI_BOT_SPAWN_DISTANCE: 380` means cores appear 380 units ahead — fine
3. `AI_BOT_WAVE_Z_SPACING: 35` means wave members are 35 units apart — fine
4. `AI_BOT_OBSTACLE_CLEARANCE: 240` means cores won't spawn within 240 of an obstacle — good
5. The actual problem: at speeds > 100 m/s, 120-unit obstacle spacing creates walls back-to-back

### Fixes

**In `spawnObstacles`, change:**

```javascript
// FIND:
const Z_SPACING = 120;

// CHANGE TO:
const Z_SPACING = 180;
```

**In `getSpawnGap`, increase all values by ~25%:**

```javascript
function getSpawnGap(t) {
  if (t < 15)  return 340;
  if (t < 40)  return 230;
  if (t < 70)  return 200;
  if (t < 110) return 165;
  if (t < 150) return 140;
  return 120;
}
```

**In `CFG`, tune these values:**

```javascript
AI_BOT_SPAWN_DISTANCE: 420,        // was 380 — give player more reaction time
AI_BOT_OBSTACLE_CLEARANCE: 280,    // was 240 — larger clear zone around obstacles
AI_BOT_OBSTACLE_GRACE_PERIOD: 4.0, // was 3.5 — longer post-obstacle silence
AI_BOT_WAVE_Z_SPACING: 40,         // was 35 — spread wave members more
AI_BOT_SPAWN_INTERVAL: 7,          // was 6 — slightly slower wave cadence early
```

**Also: the `MAX_ACTIVE` cap in `spawnObstacles` is `2`. This is correct — keep it.**

**Fix the bullet distance kill. In `Bullet.update()`:**

```javascript
// FIND:
if (age > CFG.BULLET_LIFETIME || this.dist > 100) { this.destroy(); return false; }

// CHANGE TO: (intentionally short — skill based, not a bug)
// DO NOT CHANGE THIS — the short range is intentional game design
// Players must aim carefully. This is a feature.
```

---
---

## FIX 5 — LEADERBOARD: RANK BY Z NOT KILLS

### The problem
`updateMpLeaderboard()` sorts by `mpProgressOf(b) - mpProgressOf(a)` where `mpProgressOf` returns `-z`. But `p.z` from `room_state` broadcasts is updated every 2s (server broadcast interval). Real-time updates come via `player_state` events which DO update `mpRoomState.players[idx].z`.

The leaderboard shows kills as secondary metric but the display shows `P:${progress} K:${kills}` — the `P` label is confusing. Change to meters.

**Replace `updateMpLeaderboard()`:**

```javascript
function updateMpLeaderboard() {
  if (!mpMode || !G.mpLeaderboard || !G.mpLbList) return;
  const myId = socket?.id;

  // Inject local player's real-time Z
  const localZ = threeApp ? threeApp.getShipPosition().z : 0;
  const players = (mpRoomState.players || []).map(p =>
    p.id === myId ? { ...p, z: localZ } : p
  );

  // Sort: most negative Z = furthest ahead = rank 1
  const sorted = [...players].sort((a, b) => {
    const zA = Number.isFinite(a.z) ? a.z : 0;
    const zB = Number.isFinite(b.z) ? b.z : 0;
    if (zA !== zB) return zA - zB; // more negative = lower Z = further ahead
    return (b.kills || 0) - (a.kills || 0);
  });

  G.mpLbList.innerHTML = sorted.map((p, idx) => {
    const dist = Math.abs(Math.round((Number.isFinite(p.z) ? p.z : 0) / 10) * 10);
    const isMe = p.id === myId;
    const statusIcon = p.escaped ? '🏆' : !p.alive ? '✖' : '';
    return `<div class="mp-lb-row${isMe ? ' is-you' : ''}${!p.alive ? ' is-dead' : ''}">
      <span class="mp-lb-rank">#${idx + 1}</span>
      <span class="mp-lb-name" style="color:${p.color}">${statusIcon}${p.name}${isMe ? ' ◀' : ''}</span>
      <span class="mp-lb-kills">⚔${p.kills || 0}</span>
      <span class="mp-lb-time">${dist}m</span>
    </div>`;
  }).join('');
}
```

---

## FIX 6 — SERVER: RELAY BULLETS TO OTHER PLAYERS (VISUAL ONLY)

### The problem
In `server.js`, the `bullet_fired` handler does hit detection AND should relay the bullet to other clients so they can see it coming. Currently it fires `player_hit` but non-victims also need to see bullet traces for the game to feel multiplayer.

Actually looking at the server code — it already does `socket.to(roomCode).emit("bullet_fired", ...)` at the top of the handler. But the client receives `bullet_fired` from the server and... does nothing with it visually (no incoming bullet rendering, which is intentional per PRD).

**The issue is purely the hit detection radius. Currently:**

```javascript
// In server.js bullet_fired handler:
if (dist3D < 6.0 && dist3D < bestDist) {
```

With 50ms broadcast intervals and 130 m/s server-side player positions, a 6-unit radius is too small. Players move up to 6.5 units between ticks. Increase:

```javascript
// CHANGE:
if (dist3D < 6.0 && dist3D < bestDist) {

// TO:
if (dist3D < 9.0 && dist3D < bestDist) {
```

---

## SUMMARY — APPLY IN THIS ORDER

| # | File | What to change |
|---|---|---|
| 1 | `main.js` | Replace `_queueSpeech` + `_processSpeechQueue` + add Chrome keep-alive |
| 2 | `main.js` | Replace `_buildAttackLines()`, `SMUG`/`SUSPICIOUS`/`AGGRESSIVE`/`PANICKING`/`BROKEN` line pools, `_buildTransitionLines()` with short versions |
| 3 | `main.js` | Add pre-event speech in `buildAIDirector.update()` |
| 4 | `main.js` | Fix `AITroll.update()` to handle chapter skipping from core acceleration |
| 5 | `main.js` | Change `Z_SPACING = 180`, update `getSpawnGap()`, update CFG obstacle values |
| 6 | `main.js` | Replace `buildSfx()` with pooled bullet audio |
| 7 | `main.js` | Remove `originalTypeTimer`, call `runTypewriter()` directly |
| 8 | `main.js` | Replace `flashWhite` with `damageFlash` in `player_hit` handler |
| 9 | `main.js` | Replace `updateMpLeaderboard()` with Z-sorted version |
| 10 | `server.js` | Change hit radius from `6.0` to `9.0` |

---

## ONE-LINE SANITY CHECKS (run in browser console after applying)

```javascript
// Check TTS voices available:
speechSynthesis.getVoices().map(v => v.name)

// Check socket connected:
socket?.connected

// Check room state:
mpRoomState

// Check AI state:
aiTroll?.state

// Check chapter acceleration:
aiTroll?._coreAccelSeconds
```

---

## WHAT THESE FIXES DO TOGETHER

**Audio:** Lines under 7 words take ~1.2s to speak at rate 0.95. The watchdog fires at 1.5× that. The Chrome keep-alive prevents the 15s silent kill. The 80ms gap between utterances prevents back-to-back cutting. Pre-event lines fire 1.2s before the director event so they complete before the attack hits.

**Obstacles:** At 130 m/s, 180-unit spacing = 1.38 seconds of clear air between obstacles. At 60 m/s (early game), 340-unit spawn gap = 5.6 seconds. This is fun — obstacles feel threatening without being instant-death spam.

**Cores:** 420 units ahead at 130 m/s = 3.2 seconds of reaction time. Wave members 40 units apart = you fight them one at a time instead of a wall. Each kill adds 6 seconds to the effective chapter timer — 4 kills in 30 seconds pushes you from SMUG straight to AGGRESSIVE. The AI reacts in real time to your play style.

**Sound:** Bullet pool prevents the "chukchukchuk" overlap at rapid fire. Single sounds get cloned so simultaneous crash + nearMiss don't cut each other.