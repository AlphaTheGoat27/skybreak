# SKYBREAK — Winning Strategy for Vibe Jam 2026

### Spec-Driven Development Guide

### Written: April 25, 2026 | Deadline: May 1, 2026 @ 13:37 UTC

---

## What Won Vibe Jam 2025 (And What It Means For You)

The 2025 winners were:

- **Gold ($10k)** — _The Great Taxi Assignment_ by Tomas Bencko: GTA-like taxi simulator. Open world, clear goal, immediately readable.
- **Silver ($5k)** — _Vibeware_ by Matt Gordon: You play a bot given tasks. Meta AI narrative, original concept.
- **Bronze ($2.5k)** — _Vector Tango_ by Scoble: Air traffic control simulator. Calm, cerebral, mechanically unique.

The pattern is clear: **winners had a strong original concept AND were immediately playable**. None of them were "hard" games. All of them had a clear emotional hook within 15 seconds.

The judges — @levelsio (indie maker spirit), @s13k\_ (lead judge, game feel), @timsoret (pixel art/aesthetics), @NicolaManzini (gameplay) — are evaluating 300+ games. They spend maybe **90 seconds per game** in the first pass. If a judge doesn't understand what they're doing in 10 seconds, the game is cut.

**SKYBREAK's unique advantage:** No other game in 2026 has an AI narrator that psychologically evolves. This is the Gold Prize concept. It just needs the difficulty tuned so judges actually survive long enough to experience it.

---

## The Core Problem: Current Difficulty Is Wrong in Both Directions

Based on the full codebase and judge feedback, the game has two conflicting problems:

1. **Too hard mechanically** (controls discovery, cores too fast after obstacles, aim too punishing) — judge @s13k\_ couldn't shoot a single core
2. **Too easy to win** (BASE_ESCAPE_TIME: 180s is long enough to just auto-win by surviving without engaging with cores at all)

The result: players either die frustrated without experiencing the narrative, OR they passively survive to 180s without ever feeling the tension. Neither outcome is winnable.

**The ideal state:** The game should feel like a _thriller_, not a _grind_. Every 30 seconds should feel like a new escalation. Players should feel like they're barely surviving. The AI arc (SMUG → PANICKING) should feel _earned_ because the player genuinely struggled.

---

## Ideal Difficulty Parameters (Implement Exactly These)

### Win Condition Rebalancing

```js
const CFG = {
  // CHANGE THESE:
  BASE_ESCAPE_TIME: 120, // was 180 — 2 minutes, not 3. Tighter = more intense.
  TIME_REDUCTION_PER_AI_BOT: 5, // was 10 — each core shaves 5s (not 10)
  AI_BOTS_FOR_INSTANT_WIN: 15, // was 10 — requires more engagement to instant-win
  MIN_ESCAPE_TIME: 60, // was 80 — minimum possible with all cores = 60s

  // KEEP THESE (already fixed):
  BULLET_SPEED: 200,
  BULLET_LIFETIME: 3.0,
  SHOOT_COOLDOWN: 0.35,
};
```

**Why these numbers:**

With these values, the three possible playstyles each produce a satisfying outcome:

| Playstyle                                            | Result                                            |
| ---------------------------------------------------- | ------------------------------------------------- |
| **Aggressive (shoot everything)**: destroys 15 cores | Instant win at ~45s — fast and satisfying         |
| **Balanced (shoot some, survive)**: destroys 8 cores | Portal at 120 - (8×8) = 56s — feels efficient     |
| **Survival only (no shooting)**: destroys 0 cores    | Portal at 120s — doable but tense and not optimal |

The key insight: **survival-only should feel stressful, not relaxing**. 120 seconds is short enough that the player is always aware of the clock. 180 seconds was long enough to feel like a waiting game.

---

### Core Spawn Timing (The Heartbeat of the Game)

```js
// In CFG:
AI_BOT_SPAWN_INTERVAL: 6,          // was 8 — more frequent waves
AI_BOT_MIN_SPAWN_COUNT: 1,         // keep
AI_BOT_MAX_SPAWN_COUNT: 3,         // keep
AI_BOT_SPAWN_DISTANCE: 320,        // was 380 — spawn closer, more pressure
AI_BOT_OBSTACLE_CLEARANCE: 200,    // was 240 — slightly tighter clearance
AI_BOT_OBSTACLE_GRACE_PERIOD: 2.0, // was 2.5 — slightly shorter grace
AI_BOT_SPAWN_RETRY_DELAY: 0.5,     // was 0.75
```

**Wave composition by time:**

```js
// Add this dynamic spawn count logic in the core spawn block:
// Replace the fixed spawn count with this:

function getWaveSize(wallTime) {
  if (wallTime < 20) return 1; // Tutorial window: single cores, easy to hit
  if (wallTime < 40) return 2; // Learning window: pairs
  if (wallTime < 70) return THREE.MathUtils.randInt(2, 3); // Escalating
  return THREE.MathUtils.randInt(2, 3); // Late game: keep at 2-3, rely on speed for difficulty
}
```

**Why:** The first wave being a SINGLE core is critical. It's the tutorial moment — the "SHOOT THIS" label appears on it. A new player CAN hit a single core if aim assist is working. Success on wave 1 hooks them into the game.

---

### Core Speed (How Fast They Move Toward You)

The current speed `11 + Math.random() * 7` (11-18 m/s) is fine for early game but late game cores should move faster to increase pressure.

```js
// In spawnCore(), replace the speed line:
const baseSpeed = 9 + Math.random() * 5; // was 11 + random * 7
const timeBonus = Math.min(wallTime / 30, 1) * 8; // scales to +8 m/s at 4 minutes
const speed = baseSpeed + timeBonus; // Result: 9-22 m/s over time

group.userData = {
  speed: speed,
  // ... rest unchanged
};
```

**Why:** Early cores at 9-14 m/s are very hittable with aim assist. Late cores at 17-22 m/s require actual skill. This creates a real difficulty curve instead of flat difficulty throughout.

---

### Obstacle Density (How Often Walls Appear)

The current density curve goes to 0.98 by 180s. With a 120s game, rebalance:

```js
function getDensity(t) {
  if (t < 10) return 0.2; // Very sparse — onboarding window
  if (t < 25) return THREE.MathUtils.mapLinear(t, 10, 25, 0.2, 0.45);
  if (t < 50) return THREE.MathUtils.mapLinear(t, 25, 50, 0.45, 0.7);
  if (t < 80) return THREE.MathUtils.mapLinear(t, 50, 80, 0.7, 0.88);
  if (t < 110) return THREE.MathUtils.mapLinear(t, 80, 110, 0.88, 0.95);
  return 0.95; // Cap at 95% not 98% — keeps game survivable
}
```

---

### Speed Curve (How Fast the Ship Moves)

With a 120s game, the speed curve needs to compress:

```js
function getSpeed(t) {
  if (t >= 110) return 130;
  if (t >= 85) return THREE.MathUtils.mapLinear(t, 85, 110, 115, 130);
  if (t >= 60) return THREE.MathUtils.mapLinear(t, 60, 85, 100, 115);
  if (t >= 40) return THREE.MathUtils.mapLinear(t, 40, 60, 82, 100);
  if (t >= 20) return THREE.MathUtils.mapLinear(t, 20, 40, 60, 82);
  return THREE.MathUtils.mapLinear(t, 0, 20, 42, 60);
}
```

This reaches max speed (~130 m/s) at 110s — so the last 10 seconds before the 120s portal unlock are the fastest and most chaotic.

---

### AI State Timing (Compressed for 120s Game)

The emotional arc must now fit in 120 seconds, not 185. Adjust CFG:

```js
// In CFG:
AI_MOCKERY_END: 30,        // was 45 — SMUG phase ends at 30s
AI_SUSPICION_END: 65,      // was 100 — SUSPICIOUS phase ends at 65s
AI_AGGRESSION_END: 100,    // was 160 — AGGRESSIVE phase ends at 100s
AI_PANIC_END: 115,         // was 185 — PANICKING phase ends at 115s
// BROKEN phase: 115s-120s (5 intense seconds before portal)
```

**New narrative timeline:**

| Time     | Phase      | What Happens                                             |
| -------- | ---------- | -------------------------------------------------------- |
| 0-30s    | SMUG       | AI mocks, player learns controls, first cores appear     |
| 30-65s   | SUSPICIOUS | AI gets paranoid, controls invert at 20s, speed picks up |
| 65-100s  | AGGRESSIVE | AI attacks stack, ghost ships die, player is sweating    |
| 100-115s | PANICKING  | AI starts begging, obstacles ease slightly               |
| 115-120s | BROKEN     | Pure chaos, portal appears, player dives through         |

**Why this works:** Each phase lasts 30-35 seconds, which is enough to land 4-5 good dialogue lines per phase. Players experience all 5 emotional beats in a single run. The arc completes. That's the differentiator no other game has.

---

### AI Director Attack Schedule (Compressed)

```js
// Replace the schedule array in buildAIDirector():
const schedule = [
  // Early attacks (teach the player about attacks)
  { key: "INVERT_CONTROLS", at: 18, dur: 5 },
  { key: "COMPRESS_SPACE", at: 28, dur: 5 },
  { key: "FRAGMENT_LIGHT", at: 36, dur: 4 },
  { key: "OPTIMIZE_PATH", at: 44, dur: 5 },
  // Mid attacks (pressure mounts)
  { key: "INVERT_CONTROLS", at: 55, dur: 6 },
  { key: "FRAGMENT_LIGHT", at: 65, dur: 5 },
  { key: "COMPRESS_SPACE", at: 75, dur: 6 },
  { key: "OPTIMIZE_PATH", at: 83, dur: 5 },
  // Late attacks (finale chaos)
  { key: "INVERT_CONTROLS", at: 92, dur: 7 },
  { key: "FRAGMENT_LIGHT", at: 100, dur: 5 },
  { key: "COMPRESS_SPACE", at: 108, dur: 6 },
].map((e) => ({ ...e, fired: false, until: 0 }));
```

---

### Ghost Death Timing (Dramatic Pacing)

Ghost deaths are one of the best narrative moments. Compress to 120s:

```js
// In buildThreeApp:
const ghostTimes = [18, 32, 48, 62];
// Ghost 1 dies at 18s (first emotional beat)
// Ghost 2 dies at 32s (suspicion begins)
// Ghost 3 dies at 48s (aggression ramps)
// Ghost 4 dies at 62s (now you're alone in the tunnel)
```

The last ghost dying at 62s is the moment the AI line "the other pilots are gone. it's just us. you should be scared." hits hardest. At that moment the player is at full speed, mid-aggression phase, completely alone.

---

### Damage and Health (Fair but Punishing)

Currently players are too tanky (3 hits to die). The game should be more punishing early to create urgency, but forgiving enough that judges don't rage quit.

```js
// In CFG:
PLAYER_HEALTH: 100,       // keep
COLLISION_DAMAGE: 40,     // was 34 — now 2.5 hits to die (more tension)
CONTACT_DAMAGE: 22,       // was 18 — core contact more painful
INVULN_TIME: 0.9,         // was 1.1 — slightly shorter invulnerability window
```

**Assist mode stays** (after 2 crashes in under 30s, health reduction 55%) — this protects judges who are still learning without making the game trivial.

---

## The Full Numbers Summary (Copy-Paste CFG)

```js
const CFG = {
  // Win condition
  BASE_ESCAPE_TIME: 120,
  TIME_REDUCTION_PER_AI_BOT: 5,
  AI_BOTS_FOR_INSTANT_WIN: 15,
  MIN_ESCAPE_TIME: 60,

  // Player
  PLAYER_HEALTH: 100,
  COLLISION_DAMAGE: 40,
  CONTACT_DAMAGE: 22,
  INVULN_TIME: 0.9,

  // Shooting (keep fixes already applied)
  BULLET_SPEED: 200,
  BULLET_LIFETIME: 3.0,
  SHOOT_COOLDOWN: 0.35,
  DISRUPTION_GAIN_PER_HIT: 0.09,

  // AI Bots
  MAX_AI_BOTS: 35, // was 40, slightly reduced
  AI_BOT_SPAWN_INTERVAL: 6,
  AI_BOT_MIN_SPAWN_COUNT: 1,
  AI_BOT_MAX_SPAWN_COUNT: 3,
  AI_BOT_SPAWN_DISTANCE: 320,
  AI_BOT_WAVE_Z_SPACING: 25,
  AI_BOT_OBSTACLE_CLEARANCE: 200,
  AI_BOT_OBSTACLE_GRACE_PERIOD: 2.0,
  AI_BOT_SPAWN_RETRY_DELAY: 0.5,

  // AI narrative timing (compressed for 120s game)
  AI_MOCKERY_END: 30,
  AI_SUSPICION_END: 65,
  AI_AGGRESSION_END: 100,
  AI_PANIC_END: 115,
  AI_GLOBAL_LINE_INTERVAL: 22, // was 30 — more frequent global context lines
  AI_MAX_SPEECH_QUEUE: 3,

  // Storage
  KEY_NAME: "skybreak_name",
  KEY_BEST: "skybreak_pb",

  // Webring
  WEBRING_URL: "https://vibej.am/portal/2026",

  // Misc
  PORTAL_UNLOCK_CHECK_INTERVAL: 0.25,
};
```

---

## The Tension Curve: What Each 30-Second Window Should Feel Like

### 0-30s: "Oh this is fun actually"

- Single core on wave 1 with "SHOOT THIS" label
- Speed ~42-60 m/s (feels gentle)
- AI is purely smug and funny — players are reading the dialogue
- First INVERT_CONTROLS at 18s surprises them (first AI attack = narrative moment)
- **Goal: player shoots at least 1-2 cores and is hooked**

### 30-65s: "Wait, is this getting harder?"

- Pairs of cores, speed 60-90 m/s
- AI goes SUSPICIOUS — dialogue shifts from mockery to paranoia
- Ghost ships start dying (18s, 32s) — narrative building
- COMPRESS_SPACE squeezes tunnel at 28s
- **Goal: player has 3-5 cores, feels engaged and slightly stressed**

### 65-100s: "I need to focus"

- Speed 90-115 m/s, density 0.88
- AI is AGGRESSIVE — text box shaking, red vignette
- Ghost 3 and 4 die (48s, 62s) — player is alone
- OPTIMIZE_PATH forces attention at 83s
- **Goal: player has 8-10 cores, genuinely challenged**

### 100-115s: "Wait... the AI is scared?"

- AI switches to PANICKING — the emotional twist
- Obstacles ease very slightly (density stops growing)
- AI starts asking "please crash like the others did"
- Portal appears at 110s with beacon beam
- **Goal: player feels the narrative inversion — this is the moment that makes SKYBREAK special**

### 115-120s: "GO GO GO"

- BROKEN phase — AI screaming fragmented lines
- Max speed, portal visible, 5 seconds of pure chaos
- Player dives through portal
- Screen shatters, AI says "wait take me with—"
- **Goal: clip-worthy ending, player wants to show someone**

---

## What Beats the Competition (Why This Wins Gold)

Looking at the other 325 submissions, the field has a lot of:

- Basic three.js runners and shooters
- Simple idle/clicker games
- Open-world explorers with no clear objective

**SKYBREAK's three unfair advantages:**

**1. The only game with a psychologically evolving antagonist.** The AI going from villain to victim in 2 minutes is a narrative device no other jam game has. Judges experience an actual story, not just gameplay.

**2. The webring integration is a story moment.** When the player escapes through the portal and the AI says "wait take me with—", it's not just a redirect — it's a character having an existential crisis about being left behind. That's memorable writing. Judges will talk about it.

**3. Ghost names are judge-bait.** "karpathy_fan", "levelsio_alt", "claude_played_first" — these names are designed for the judges specifically. When @levelsio sees his name in the ghost pool and the AI says "levels makes games. levels also crashes. this checks out." — that's a moment that gets shown in the winner announcement stream.

---

## Risk Table: What Could Cost You the Prize

| Risk                                     | Probability                 | Mitigation                                                                                                         |
| ---------------------------------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Judge dies before seeing PANICKING phase | High if 120s feels too hard | Ensure 0-30s is gentle; assist mode stays; aim assist tight                                                        |
| Aim assist doesn't snap properly         | Medium                      | Test with a non-gamer friend — if they can't hit wave 1 single core, the cone angle is too small (increase to 30°) |
| Portal appears before player reaches it  | Low                         | portalSafeZ clearance of 260 units already prevents obstacle blocking                                              |
| "Most Popular" sub-prize competition     | Medium                      | Sky Break already has 58 portal transfers — keep portal working perfectly                                          |
| Game loads too slowly (Rule 08)          | Low                         | Already ThreeJS with no textures — should be instant                                                               |
| Judges judge on May vs April content     | Low but real                | Make sure your submission timestamp shows the May 1 version was updated                                            |

---

## Priority Order for Last 6 Days

**Day 1 (today):** Implement CFG changes above. Playtest 10 runs. Target: average player should reach PANICKING phase in 3-4 attempts.

**Day 2:** Tune core speed scaling and wave size function. Playtest with someone who hasn't seen the game.

**Day 3:** Polish the emotional moments — PANICKING dialogue, ghost death timing, chapter banners. These are judge-facing features.

**Day 4:** Mobile testing. The judge panel will likely test on phones. Touch controls + aim assist must work.

**Day 5:** Portal exit sequence polish. The screen shatter + AI final line must be flawless. This is the moment that gets clipped.

**Day 6 (April 30):** Final submission update. Make sure the widget is present. Test the webring redirect. Rest.

---

## The One Sentence Pitch for Judges

> "SKYBREAK is a 2-minute tunnel runner where the AI that built the world is trying to kill you — but as you get better, it starts begging you to stay."

That sentence contains: tension, novelty, emotional arc, and a reason to play again. If @levelsio reads that in the submission pitch field, SKYBREAK goes into the finals.

---

## Definition of a Winning Run

A winning run (from a judge's perspective) looks like this:

1. Intro screen loads instantly. AI typewriter plays. Judge enters the void.
2. First 10s: AI mocks them. They shoot a core with aim assist. "Oh that felt good."
3. 18s: Controls invert. They crash into a wall. Death screen: "DELETED IMMEDIATELY." They laugh. Retry immediately.
4. Second run: They get to 45s. AI goes SUSPICIOUS. "Wait, is it getting paranoid about me?"
5. They reach 80s for the first time. AI is screaming "STOP DODGING." Ghost ships are gone.
6. First time they reach 100s: AI says "wait... this wasn't supposed to happen."
7. They see the portal. They dive through. Screen shatters. "wait take me with—"
8. Judge closes the tab and opens X to post about it.

**That is the run that wins Gold Prize.**
