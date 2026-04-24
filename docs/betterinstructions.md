# SKYBREAK — First-Time Player Clarity & Game Feel Improvements

## The Core Problem

Right now a first-time player lands in the game and experiences something like this:

> *"There's an AI saying something snarky. I'm flying. There are pink diamond shapes. There are red ring obstacles. The AI is talking. I crashed. What was I doing? I'll try again."*

The narrative — **an AI that built this world is actively collapsing it, and you need to destroy its "cores" to break the lock on the exit portal before time runs out** — is essentially invisible. The story only lands for players who read the intro hint text carefully AND survive long enough to see the AI shift emotional states. Most players won't.

The goal of these suggestions is to make the **story legible without reading anything**, and the **win condition obvious from second one**.

---

## Part 1 — Diagnosis: What First-Timers Don't Know

| What the player doesn't understand | Why it matters |
|---|---|
| The pink diamond shapes (cores) are the primary thing to shoot | They look decorative, not like enemies or objectives |
| Shooting cores actually does something (cuts escape time) | No immediate visual feedback connects shooting → progress |
| The portal is locked and has two unlock conditions | The HUD says "PORTAL LOCKED" but doesn't explain why or what to do |
| The AI is narrating a collapse in progress | The AI text reads like taunting, not exposition |
| The AI emotional arc is the story | State changes (SMUG → PANICKING → BROKEN) look like random insult variety |
| "Integrity" vs "Disruption" bars mean anything different | Both bars are present but their relationship to winning is opaque |
| Speed is increasing and that's intentional and bad | The player doesn't feel the acceleration as threat |

---

## Part 2 — Intro Screen: The Biggest Missed Opportunity

### Current state
The intro has a typewriter AI line, a hint block, and a name input. The hint block reads:

> *"DESTROY 10 CORES OR SURVIVE 180s TO UNLOCK THE PORTAL / EACH CORE DESTROYED CUTS 10s FROM ESCAPE TIME"*

This is correct but inert. It reads as instructions, not story. A first-time player sees rules before they have any reason to care.

### What to change

**Replace the hint block with a 3-line narrative frame that doubles as instruction:**

```
THE AI BUILT THIS WORLD. IT'S COLLAPSING.
SHOOT THE RED CORES TO BREAK THE LOCK EARLY.
REACH THE PORTAL BEFORE THE VOID TAKES YOU.
```

This accomplishes:
- Establishes the AI as the antagonist and cause of the problem
- Names "cores" as the active goal (not just "destroy 10")
- Introduces the portal as escape (not just a win condition)
- Frames survival as threat ("the void takes you") without explaining the timer mechanically

**Add a visual key under the name input** — a tiny icon legend, one line, monospace:

```
[ ◆ CORE = shoot it ]   [ ⬡ PORTAL = reach it ]   [ WASD + SPACE ]
```

This takes 4 seconds to read and removes the most common confusion point entirely.

### Implementation in `main.js` — `app.innerHTML` intro section

Replace the `<div id="intro-hint">` block with:

```html
<div id="intro-hint" class="intro-hint">
  <div class="intro-narrative">THE AI BUILT THIS WORLD. IT IS COLLAPSING.</div>
  <div class="intro-narrative">SHOOT THE GLOWING CORES TO BREAK THE LOCK EARLY.</div>
  <div class="intro-narrative accent">REACH THE PORTAL BEFORE THE VOID TAKES YOU.</div>
  <div class="intro-key">
    <span>◆ PINK CORE → SHOOT IT</span>
    <span>⬡ PORTAL → FLY THROUGH IT</span>
    <span>WASD · SPACE / CLICK = SHOOT</span>
  </div>
</div>
```

Add to `style.css`:

```css
.intro-narrative {
  font-size: 13px;
  letter-spacing: 0.18em;
  color: rgba(200, 245, 255, 0.82);
  text-align: center;
  line-height: 1.9;
}
.intro-narrative.accent { color: var(--cyan); text-shadow: 0 0 12px rgba(0,255,255,0.45); }
.intro-key {
  display: flex;
  gap: 1.4rem;
  flex-wrap: wrap;
  justify-content: center;
  font-size: 10px;
  letter-spacing: 0.16em;
  color: rgba(0,255,255,0.45);
  padding-top: 0.4rem;
  border-top: 1px solid rgba(0,255,255,0.1);
  margin-top: 0.3rem;
}
```

---

## Part 3 — The First 8 Seconds: AI Opening Line Is Wrong

### Current first line
When a named player starts: *"oh. [name]. let's see how long you last."*

This establishes the AI as a smug antagonist, which is correct tonally — but it tells the player **nothing about what they're doing or why**. It's pure character, zero context.

### The fix: make the first line do double duty

The first AI line should establish the situation AND the AI's attitude simultaneously. The player needs to hear something that makes them understand the world is already in crisis, not just that the AI dislikes them.

**Replace the greeting variants in `pushFirstLine()` with these:**

Named:
```
"oh. [name]. i've been waiting. this world is already collapsing — but the exit is mine. shoot my cores if you want it early."
```

Anonymous:
```
"another pilot. the world is collapsing. the portal is locked. shoot my cores to break it early, or just survive 180 seconds. prediction: neither."
```

This single change means a player who reads **only the first AI line** now knows:
- The world is collapsing (stakes)
- There is an exit portal (goal)
- Cores are the fast path to unlocking it (primary mechanic)
- 180 seconds is the fallback (secondary mechanic)
- The AI is hostile (tone)

The RULES variant (currently shown 5 seconds after the greeting) can stay but becomes reinforcement rather than first contact:

```
"destroy 10 cores. each one cuts 10 seconds off your escape timer. or wait 180 seconds for the lock to break itself. the void doesn't care either way."
```

---

## Part 4 — Core Visual Design: They Don't Read as "Shoot This"

### Current problem

The glowing pink octahedrons with torus rings are genuinely beautiful — but they read as environmental decoration or ambient hazards, not as interactive targets. Nothing about them says "this is the primary objective."

### Fixes

**1. Add a targeting reticle when a core is on screen**

When any core exists within a forward cone of ~30 degrees from the ship's heading and within 300 units, render a faint diamond reticle around it — just a CSS3D sprite or a thin wireframe box. Color: `rgba(255, 200, 0, 0.55)`. This visually classifies cores as "things that react to your cursor."

Implementation: inside `updateCores()`, for each active core, check angle to ship heading. If within targeting cone, set a flag on the core's userData (`isTargeted = true`) and render a targeting sprite. Remove when out of cone.

**2. Add a subtle "lock" indicator above the first core wave**

On the very first core wave spawn (currentWaveId === 1), display a brief floating text sprite above one of the cores for 2 seconds: `"SHOOT THIS"` in yellow, `font-size: 11px`. Disappears after 2 seconds, never appears again. This is the only explicit tutorial text in the game world itself.

**3. Make core impact feedback more dramatic**

Currently `spawnParticles()` creates rainbow particles on hit. The rainbow makes hits feel like celebrations but not like damage. Consider: first flash white (signal: "hit!"), then burst rainbow particles. The white flash is the "I hit something" read; the rainbow is the reward.

In `spawnParticles()`, add a brief point light flash or a screen-space white dot at the hit position:

```javascript
// Add a brief white flare at hit position (screen-space)
G.whiteFlash.style.opacity = "0.06";
G.whiteFlash.style.transition = "opacity 50ms";
setTimeout(() => { G.whiteFlash.style.opacity = "0"; }, 55);
```

**4. Core glow should pulse faster when player is near**

Cores currently float at a steady animation rate. When a core is within 80 units of the ship, accelerate its rotation speed by 2x and increase its emissive opacity. This creates a physical feedback loop: fly toward a core → it reacts → you feel engaged with it as an interactive object, not scenery.

---

## Part 5 — HUD: The Progress Bar Is Disconnected from the Story

### Current state

The HUD shows:
- Timer (T+0s)
- Speed (50 m/s)
- OBJECTIVE text
- CORES 0/20 · PORTAL LOCKED
- Disruption bar
- Integrity bar

The problem is that none of this is narratively framed. "PORTAL LOCKED" is a game state, not a story beat. "DISRUPTION" is a mechanic label, not a story element.

### Suggested HUD Reframe

**Rename "DISRUPTION" → "SIGNAL BREAK"**

"Disruption" sounds like an attack meter. "Signal Break" sounds like you're tearing open a channel — which is what destroying cores is narratively doing. This is a one-word change with significant effect on comprehension.

**Rename "INTEGRITY" → "HULL"**

"Integrity" is technically accurate but clinical. "HULL" is immediately understood: it goes to zero, you die.

**Change the PORTAL LOCKED display to show countdown dynamically:**

Instead of static `PORTAL LOCKED`, show:

- Before any cores: `PORTAL LOCKS AT 180s · HUNT CORES TO CUT TIME`
- After 3 cores: `PORTAL UNLOCKS AT 150s · 7 CORES OR 150s`
- After 7 cores: `PORTAL UNLOCKS AT 110s · 3 MORE CORES = 80s`
- After 9 cores: `ONE MORE CORE = PORTAL NOW`
- Unlocked: `PORTAL OPEN · FLY THROUGH THE RING`

This makes the core economy visible. Every core destroyed visibly changes the countdown. Players feel the leverage of each kill.

Implementation in `updateHUD()` — replace the `hudProgress` text generation with:

```javascript
let progressText;
const remaining = CFG.CORES_FOR_INSTANT_WIN - cores;
const timeLeft = Math.max(0, escapeNeeded - wallTime);

if (portalUnlocked) {
  progressText = `PORTAL OPEN · FLY THROUGH THE RING · HP ${Math.ceil(health)}`;
} else if (cores === 0) {
  progressText = `CORES 0/10 · PORTAL UNLOCKS AT ${Math.ceil(escapeNeeded)}s OR AFTER 10 CORES · HP ${Math.ceil(health)}`;
} else if (remaining <= 1) {
  progressText = `CORES ${cores}/10 · ONE MORE CORE OPENS THE PORTAL · ${Math.ceil(timeLeft)}s FALLBACK · HP ${Math.ceil(health)}`;
} else {
  progressText = `CORES ${cores}/10 · ${remaining} MORE CUTS ${Math.ceil(timeLeft)}s TO ${Math.ceil(Math.max(CFG.MIN_ESCAPE_TIME, escapeNeeded - CFG.TIME_REDUCTION_PER_CORE))}s · HP ${Math.ceil(health)}`;
}
G.hudProgress.textContent = progressText;
```

---

## Part 6 — State Transitions: The AI Arc Should Feel Like Story Chapters

### Current problem

The AI state changes happen invisibly. The color of the AI box border shifts (cyan → yellow → red → white → magenta) but there's nothing that tells the player "something just changed — this is a story moment."

First-time players don't know that the AI going from smug to scared is the emotional payoff they've been working toward. It just reads as "different insults."

### Fixes

**1. Add a full-width chapter banner on state transition**

When the AI changes state, flash a 2.5-second banner across the center of the screen (not the bottom banner — center of viewport, large) that names the chapter. This is the narrative spine made visible.

```
[ T=0 ]      ━━━━━━━━━━━━━━━━━  CHAPTER I: THE AI IS SMUG  ━━━━━━━━━━━━━━━━━
[ T=45s ]    ━━━━━━━━━━━━━━━━━  CHAPTER II: THE AI IS SUSPICIOUS  ━━━━━━━━━━━━
[ T=100s ]   ━━━━━━━━━━━━━━━━━  CHAPTER III: THE AI IS HOSTILE  ━━━━━━━━━━━━━━
[ T=160s ]   ━━━━━━━━━━━━━━━━━  CHAPTER IV: THE AI IS AFRAID  ━━━━━━━━━━━━━━━
[ T=185s ]   ━━━━━━━━━━━━━━━━━  CHAPTER V: COLLAPSE  ━━━━━━━━━━━━━━━━━━━━━━━━
```

These banners are:
- Centered on screen
- Large (2rem+), letter-spaced, faded out over 2.5s
- The text color matches the new AI state color
- They do not repeat — only fire once per state

Implementation: add a `#chapter-banner` div to the DOM, with CSS for centered overlay display. In `AITroll.setState()`, fire it.

```css
#chapter-banner {
  position: fixed;
  top: 50%;
  left: 0;
  right: 0;
  transform: translateY(-50%);
  text-align: center;
  font-family: var(--mono);
  font-size: clamp(0.9rem, 2.5vw, 1.3rem);
  letter-spacing: 0.35em;
  color: var(--cyan);
  pointer-events: none;
  z-index: 18;
  opacity: 0;
  transition: opacity 0.2s ease;
}
#chapter-banner.is-visible { opacity: 1; }
```

```javascript
// In AITroll.setState():
setState(state, atTime = this.t) {
  if (this.state === state) return;
  this.state = state;
  // ... existing code ...

  // Chapter banner
  const chapterNames = {
    SUSPICIOUS: "THE AI IS WATCHING YOU",
    AGGRESSIVE: "THE AI IS HOSTILE",
    PANICKING:  "THE AI IS AFRAID",
    BROKEN:     "THE WORLD IS COLLAPSING",
  };
  const chapterText = chapterNames[state];
  if (chapterText) {
    const banner = document.getElementById("chapter-banner");
    if (banner) {
      banner.textContent = `━ ${chapterText} ━`;
      banner.style.color = this.colors[state] || "#00ffff";
      banner.classList.add("is-visible");
      setTimeout(() => banner.classList.remove("is-visible"), 2400);
    }
  }
}
```

**2. Environmental changes should reinforce each chapter**

Currently the tunnel color and post-processing shift subtly but players don't consciously register it as "things are getting worse." Consider adding one visible, named environmental cue per chapter:

| Chapter | Environmental tell |
|---|---|
| SMUG (0-45s) | Tunnel wireframe: default cyan, steady |
| SUSPICIOUS (45-100s) | Tunnel wireframe flickers occasionally (1-2x per 10s). Brief static. |
| AGGRESSIVE (100-160s) | Tunnel occasionally pulses red for 0.3s. The AI events are already here. |
| PANICKING (160-185s) | Tunnel wireframe fades to white/dim. Portal glow visible far ahead. |
| BROKEN (185s+) | Tunnel geometry starts visually fragmenting (increase wireframe opacity flicker). Portal is right there. |

---

## Part 7 — The Portal: Make It Iconic and Unmissable

### Current problem

The portal spawns 200-230 units ahead of the player when unlocked. At game speed (100+ m/s), that's about 2 seconds away. By the time the player visually processes "there is a big glowing ring," they're almost through it or have already missed it due to obstacles.

The portal needs to be anticipated, not discovered. The player should *want* to reach it for 30+ seconds before they do.

### Fixes

**1. Portal indicator beam — visible from 600 units away**

When the portal spawns (or is about to spawn), render a vertical beam of light at its position — a tall, thin cylinder of emissive white/rainbow material extending "upward" out of the tunnel. This is visible at long range as a beacon. The player sees the destination before they reach it.

```javascript
// In buildPortalSystem(), add a beam:
const beamGeo = new THREE.CylinderGeometry(0.3, 0.3, 600, 6);
const beamMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.22 });
const beam = new THREE.Mesh(beamGeo, beamMat);
beam.position.set(0, 0, 0); // position relative to portal group
group.add(beam);
```

Animate the beam opacity: pulse between 0.1 and 0.35 at 1Hz. Even players facing obstacles will catch the beacon in peripheral vision.

**2. HUD directional arrow when portal is unlocked**

Add a small arrow/chevron element at the top of the screen when the portal is active, pointing forward with the text `PORTAL ▼ XXm`. This gives players who've been weaving through obstacles a constant reminder that there's a destination ahead.

```html
<div id="portal-arrow" class="portal-arrow">PORTAL ▼ ---m</div>
```

```css
.portal-arrow {
  position: absolute;
  top: 3.2rem;
  left: 50%;
  transform: translateX(-50%);
  font-size: 11px;
  letter-spacing: 0.2em;
  color: #00ffff;
  background: rgba(0,4,8,0.88);
  border: 1px solid rgba(0,255,255,0.5);
  padding: 4px 14px;
  border-radius: 2px;
  opacity: 0;
  transition: opacity 0.3s ease;
  text-shadow: 0 0 10px rgba(0,255,255,0.7);
  animation: blink 0.7s steps(1) infinite;
}
.portal-arrow.is-visible { opacity: 1; }
```

Update in the main tick when portalUnlocked:
```javascript
if (portalUnlocked && portalSys.group.visible) {
  const dist = Math.abs(shipAnchor.position.z - portalSys.group.position.z);
  const arrow = document.getElementById("portal-arrow");
  if (arrow) {
    arrow.textContent = `PORTAL ▼ ${Math.max(0, Math.round(dist))}m`;
    arrow.classList.add("is-visible");
  }
}
```

**3. Screen edge glow when portal is close**

When within 150 units of the portal, begin adding a white/rainbow vignette glow on all four screen edges (not just the center vignette). This makes the approach feel like entering something physically different — the portal has a presence before you reach it.

---

## Part 8 — The AI Attacks: Players Don't Know They're Being Attacked

### Current problem

When INVERT_CONTROLS fires, a banner appears at the bottom saying "⚠ AI ATTACK: CONTROLS INVERTED." But players in the middle of dodging obstacles are not reading the bottom of the screen. Many will assume they've glitched their input, not that the AI just did something intentional.

This is actually the most narratively important moment in the mid-game — **the AI is actively fighting back** — and it reads as a bug.

### Fixes

**1. Play a distinct audio cue for AI attacks**

A short, sharp "system alert" sound (different from crash or near-miss) should play the instant any AI attack activates. The sound says "this is intentional, the AI did this." Even without looking at the banner, the player knows something happened.

**2. Flash the AI box on attack activation**

When an attack fires, the AI box should briefly pulse bright (opacity 1 → 0 → 1 twice over 200ms) and the border should flash the attack color (yellow for INVERT, purple for COMPRESS, etc). This connects "AI said something" → "thing that just happened to me" causally.

**3. On INVERT_CONTROLS specifically, show a full-screen brief overlay**

Inverted controls is the most disorienting event. Add a 0.5-second full-screen overlay that fades immediately:

```html
<div id="invert-overlay" class="invert-overlay">⚠ CONTROLS INVERTED</div>
```

```css
.invert-overlay {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2.2rem;
  letter-spacing: 0.3em;
  color: #ffff00;
  background: rgba(20, 20, 0, 0.55);
  pointer-events: none;
  z-index: 22;
  opacity: 0;
  transition: opacity 0.15s ease;
}
.invert-overlay.is-visible { opacity: 1; }
```

Flash it for 0.8s when INVERT_CONTROLS fires, then fade. This makes the inversion feel like a deliberate world event, not a controller bug.

---

## Part 9 — Death Screen: A Missed Narrative Moment

### Current state

The death screen shows:
- "YOU LOST"
- "survived Xs"
- "cores destroyed: N/10"
- An AI insult line
- TRY AGAIN / QUIT buttons

This is functional but cold. The player just experienced a narrative moment (the AI beat them) and the death screen doesn't continue that story.

### Suggestions

**1. Change "YOU LOST" to a contextual title based on when they died**

| Time of death | Title |
|---|---|
| Under 20s | `DELETED IMMEDIATELY` |
| 20-60s | `THE AI LAUGHED` |
| 60-120s | `ALMOST SUSPICIOUS` |
| 120-160s | `THE AI RELAXED` |
| Over 160s | `SO CLOSE` |

**2. Add a "progress toward escape" micro visual**

A simple horizontal bar below the survival time showing `[████░░░░░░] 43% to portal escape`. This gives the player a concrete sense of progress even in failure, and makes trying again feel worthwhile.

**3. The AI insult should be spoken (TTS) on death screen**

Currently `onDeath()` calls `stopSpeech()` and then `show()` with `{ speak: false }` for the crash line. The crash line in `randomInsult()` is great writing but players only see it for 0.2 seconds before the death screen appears. The death screen's `deathAiLine` shows the same insult — that insult should be spoken aloud by the TTS voice when the death screen appears. One line, slower rate, quiet. It makes the AI feel present even in death.

In `G.deathRetry` setup, after showing the death screen:
```javascript
setTimeout(() => {
  if (aiTroll) aiTroll._queueSpeech(insult, { rate: 0.75, pitch: 0.7, priority: 2, ttlMs: 8000 });
}, 300);
```

---

## Part 10 — Mobile: Touch Controls Are Nearly Invisible

### Current state

Mobile players get a thin 3px line on the right edge of the screen with rotated "TAP→SHOOT" text. This is invisible in practice. There's no indication of where to tap for movement.

### Minimum viable mobile tutorial

Add a 3-second transparent overlay when the game starts on mobile (detected via `"ontouchstart" in window`). The overlay shows:

```
LEFT HALF = MOVE    RIGHT HALF = SHOOT
      ←  |  →
         |
```

It fades automatically after 3 seconds or on first touch. One time only, never again.

---

## Part 11 — Suggested Priority Order for Implementation

These are ranked by impact-to-effort ratio:

| Priority | Change | Effort | Impact |
|---|---|---|---|
| 1 | Replace intro hint with narrative frame + icon key | 20 min | Very high — affects every first impression |
| 2 | Rewrite the first AI line to explain the situation | 10 min | Very high — heard by every player |
| 3 | Dynamic HUD progress text (cores → cuts timer) | 30 min | High — makes the core economy legible |
| 4 | Chapter banner on AI state transition | 45 min | High — makes the story arc visible |
| 5 | INVERT_CONTROLS full-screen flash overlay | 20 min | High — removes "is this a bug" confusion |
| 6 | Portal direction arrow + distance indicator | 30 min | High — removes "where am I going" confusion |
| 7 | Core targeting reticle when in forward cone | 1 hr | Medium — confirms cores are interactive |
| 8 | "SHOOT THIS" floating text on first core wave | 15 min | Medium — explicit once-only tutorial |
| 9 | Contextual death screen title | 20 min | Medium — improves retry motivation |
| 10 | Portal beacon beam (visible at 600 units) | 30 min | Medium — makes the destination iconic |
| 11 | TTS on death screen | 15 min | Low-medium — nice character continuity |
| 12 | Mobile touch overlay tutorial | 25 min | Medium for mobile players specifically |

---

## Part 12 — One Line Summary for Each Improvement

- **Intro text** → Tell the story in three lines before the player touches the keyboard.
- **First AI line** → Use it to deliver the situation, not just attitude.
- **Core visuals** → Signal "interactive target" not "ambient decoration."
- **HUD progress** → Show the math: shoot this core → portal opens this many seconds sooner.
- **Chapter banners** → Name the acts so players know they're in a story.
- **AI attacks** → Make it obvious the AI is doing something intentional, not that the game is broken.
- **Portal arrow** → Give players a compass at all times once the exit is open.
- **Death screen** → Continue the narrative instead of ending it.

The game's writing and concept are already strong. The gap is entirely in **surface legibility** — the story is there, it's just not wearing enough signs.