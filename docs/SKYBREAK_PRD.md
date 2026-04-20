# SKYBREAK: AI Reality Collapse

## Product Requirements Document (PRD) v2.0

### Vibe Jam 2026 — Gold Prize Submission

---

> **How to use this document:** This PRD is written for **spec-driven development**. Every section is a direct prompt or specification for an AI agent (Bolt, Cursor, etc.). Tasks labeled `[HUMAN]` require your input or assets. Tasks labeled `[AI AGENT]` are fully delegatable. Hand entire sections to your agent verbatim.

---

## 0. Project Summary

| Field                     | Value                                                                                      |
| ------------------------- | ------------------------------------------------------------------------------------------ |
| **Game Title**            | SKYBREAK: AI Reality Collapse                                                              |
| **Genre**                 | High-speed third-person tunnel runner                                                      |
| **Engine**                | Three.js (vanilla JS, single HTML file)                                                    |
| **Target Session Length** | 60 seconds (one run)                                                                       |
| **Win Condition**         | Reach the Vibe Jam Portal before the AI destroys everything                                |
| **Deployment Target**     | Cloudflare Pages → `skybreak.xyz` (Namecheap domain, Cloudflare nameservers)               |
| **Deadline**              | 1 MAY 2026 @ 13:37 UTC                                                                     |
| **Rule Compliance**       | Rule 02 (widget), Rule 03 (90%+ AI code), Rule 05 (web/free), Rule 08 (no loading screens) |

---

## 1. Concept & Narrative

SKYBREAK is a psychological tunnel runner. The player pilots a ship through an infinite digital void that is being **actively dismantled by a sentient, toxic AI** that built the simulation. The AI starts out smug and mocking, becomes suspicious that you're too skilled, turns aggressive as you dodge its sabotage, and finally **panics and breaks down** as you approach the exit portal.

The narrative arc is the differentiator. It's not just a runner — it's a 60-second story with an emotional twist. The Gold Prize moment is the AI going from villain to something almost pitiable in the final 10 seconds.

**Tone:** Cyberpunk nihilism meets absurdist comedy. The AI is funny, threatening, and ultimately tragic.

---

## 2. Vibe Jam 2026 Compliance Checklist

| Rule    | Requirement                          | Implementation                            |
| ------- | ------------------------------------ | ----------------------------------------- |
| Rule 02 | Required widget JS snippet           | Embed in `game.html` `<head>`             |
| Rule 03 | 90%+ AI-written code                 | All game logic written by AI agent        |
| Rule 04 | New game, created after April 1 2026 | Fresh project, no prior codebase          |
| Rule 05 | Web, no login, free to play          | Cloudflare Pages deployment               |
| Rule 08 | No loading screens                   | Procedural geometry, no texture downloads |

**Required widget (must be in `game.html`):**

```html
<script async src="https://vibej.am/2026/widget.js"></script>
```

---

## 3. Gameplay Design

### 3.1 Core Loop

```
USERNAME SCREEN → SPAWN → FLY → DODGE OBSTACLES → SURVIVE AI EVENTS → OUTRUN GHOST DEATHS → HIT PORTAL
```

- Instant spawn, no menu, no loading screen
- 60-second fixed session
- Speed scales continuously from 50 m/s → 110 m/s
- Obstacle density scales from 0.3 → 0.9
- Target success rate: **40–60%** for first-time players in the first 20s (story beats MUST be seen), **20–30%** overall for full portal reach
- Crash = instant 0.2s reset (no death screen, just AI smug comment)

**DIFFICULTY PHILOSOPHY: Story-first, skill-second.**
The judges MUST see the narrative pivot at t=50s. If they die at t=12s five times in a row, they'll quit. Design the first 20 seconds to be nearly impossible to fail. Let the game get hard after the player has emotionally invested.

### 3.2 Username Entry Screen `[AI AGENT]`

This is the first thing the player sees. It must be instant (no assets to load), atmospheric, and optional.

```
SCREEN LAYOUT:
  - Full black background (#000000)
  - Center of screen, vertically and horizontally
  - Title: "SKYBREAK" in large monospace font (48px), cyan (#00ffff), subtle glow via text-shadow
  - Subtitle: "AI REALITY COLLAPSE" in smaller (16px), dimmer cyan (#006666), letter-spacing: 6px
  - Gap
  - Label text: "[SYSTEM_AI] > identify yourself. or don't. i'll find out anyway."
    (monospace, 14px, cyan, appears with a typewriter effect — one character per 40ms)
  - Text input field: monospace font, black bg, 1px cyan border, cyan caret, 200px wide
    - placeholder: "enter name... or leave blank"
    - maxlength: 16 characters (keep names short so they fit in dialogue)
    - Auto-focused on screen load
  - Button: "ENTER THE VOID" — monospace, black bg, 1px cyan border, hover: invert colors
  - Small skip note below button: "[ press ENTER or leave blank to remain anonymous ]"

INTERACTION:
  - Player types name (optional) then clicks button OR presses Enter key
  - If name field is empty or whitespace: player is ANONYMOUS
  - If name entered: sanitize (strip special chars, trim, lowercase, max 16 chars)
    Store as: window.PLAYER_NAME = sanitizedName  (global, accessible to AITroll)
  - Either way: fade screen to black over 0.5s, then start game instantly

NAME STORAGE:
  - Store in localStorage key: 'skybreak_name'
  - On repeat visits: pre-fill the input with stored name
  - Player can clear it by emptying the field and pressing Enter

FIRST AI LINE (immediately after fade-in, t=0s):
  - If NAMED:    "[SYSTEM_AI] > oh. [name]. let's see how long you last."
  - If ANONYMOUS: "[SYSTEM_AI] > another nameless pilot. how original."
  - This line is spoken via Web Speech API AND shown in text box simultaneously
  - It sets the tone before a single obstacle appears
```

### 3.3 The 60-Second Narrative Timeline

| Time        | Phase          | AI Tone                      | Technical Events                                                                                                         |
| ----------- | -------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| **00s–15s** | **Mockery**    | Smug, dismissive             | Spawn at 50 m/s. Basic ring obstacles. AI text box appears. Ghost ships spawn alongside player.                          |
| **15s–35s** | **Suspicion**  | Passive-aggressive, paranoid | Speed → 80 m/s. Wall Gap obstacles added. First AI glitch events trigger. Ghost #1 "deleted" at 30s.                     |
| **35s–50s** | **Aggression** | Hostile, frantic             | Speed → 110 m/s. Tunnel narrows. Ring and wall obstacles. Multiple AI events stack. Ghost #2–3 deleted. AI text box shakes red. |
| **50s–55s** | **The Twist**  | Panic begins                 | Insults STOP. Tone shifts to fear. "Wait... this wasn't supposed to happen." Screen distortion ramps up.                 |
| **55s–60s** | **Collapse**   | Full breakdown               | AI messages overlap and glitch. "WAIT. WAIT. WAIT." Slow-mo activates. Portal visible.                                   |
| **60s**     | **Escape**     | Final message                | Player hits portal. Screen shatters. AI: _"Wait, take me with—"_ Redirect to webring.                                    |

### 3.4 Difficulty Curve

| Time   | Speed      | Obstacle Density  | Gap Width        | Notes                                                                               |
| ------ | ---------- | ----------------- | ---------------- | ----------------------------------------------------------------------------------- |
| 00–20s | 50–60 m/s  | 0.2 (very sparse) | 10 units (wide)  | **Intentionally easy.** One obstacle every 4–5s. Player must see AI mockery.        |
| 20–35s | 60–80 m/s  | 0.45              | 8 units          | Ramps up. First AI events. Ghosts start dying.                                      |
| 35–50s | 80–110 m/s | 0.7               | 7 units          | Genuinely hard. Stacked events.                                                     |
| 50–60s | 110 m/s    | 0.5 (drops)       | 9 units (widens) | **Ease off.** Player needs to reach portal. Fewer obstacles during narrative shift. |

**GENEROUS HITBOX RULE (critical for feel):**

- Player ship visual model: scale 1.0
- Player collision hitbox: scale 0.65 of visual (35% smaller than it looks)
- This means near-misses look dramatic but aren't lethal — the "generous hitbox" rule
- Never tell the player. It should feel like they're good, not like the game is easy.

**COYOTE TIME:**

- If player clips the edge of an obstacle at < 15% overlap: NO CRASH, treat as near-miss
- Play nearMiss.mp3 and trigger near-miss slow-mo
- This prevents "bullshit death" frustration from borderline collisions

### 3.5 Controls

| Input                                                            | Action          |
| ---------------------------------------------------------------- | --------------- |
| `A` / `←` or Mouse Left                                          | Move ship left  |
| `D` / `→` or Mouse Right                                         | Move ship right |
| `W` / `↑` or Mouse Up                                            | Move ship up    |
| `S` / `↓` or Mouse Down                                          | Move ship down  |
| Ship stays on a 2D plane (X/Y), moves forward automatically on Z |

---

## 4. Technical Architecture

### 4.1 File Structure

```
/
├── game.html          ← Single file entry point (all JS/CSS inline or imported)
├── music.mp3          ← [HUMAN PROVIDES] Background track
├── sfx/
│   ├── nearMiss.mp3   ← [HUMAN PROVIDES] Near-miss whoosh
│   ├── crash.mp3      ← [HUMAN PROVIDES] Crash sound
│   └── portal.mp3     ← [HUMAN PROVIDES] Portal entry sound
└── README.md
```

### 4.2 Technology Stack

| Layer           | Technology                                        |
| --------------- | ------------------------------------------------- |
| Rendering       | Three.js r128 (via CDN)                           |
| Post-processing | Three.js EffectComposer, BloomPass, GlitchPass    |
| Physics         | Custom AABB collision (no physics library needed) |
| Audio           | Web Audio API                                     |
| Persistence     | `localStorage` (personal best score only)         |
| Deployment      | Cloudflare Pages                                  |
| External CDN    | `cdnjs.cloudflare.com` only                       |

### 4.3 Scene Setup

```javascript
// [AI AGENT] Implement exactly as specified:
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x000000, 1);

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x000000, 0.02);

// Camera: 3rd person follow
const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000,
);
// Camera target offset: (0, 8, 15) behind ship
// LERP factor: 0.1 (gives weight/lag feel)
```

---

## 5. Core Systems Specification

### 5.1 Player Ship System `[AI AGENT]`

```
CLASS: PlayerShip
PURPOSE: Handles input, movement, banking, collision, and near-miss detection

PROPERTIES:
  - position: Vector3 (starts at 0, 0, 0)
  - velocity: Vector3 (Z always = current game speed)
  - bankAngle: float (visual lean on X-axis movement)
  - hitbox: AABB (width: 2, height: 1.5, depth: 2)
  - isAlive: bool
  - nearMissStreak: int (counts consecutive near misses)

MOVEMENT RULES:
  - X/Y input moves ship on a bounded plane: X ∈ [-18, 18], Y ∈ [-10, 10]
  - Ship banks (rotates on Z-axis) proportional to X velocity, max ±30 degrees
  - Apply smooth LERP (0.15) to all input movement for feel
  - Camera follows ship position with LERP 0.1 at offset (0, 8, 15)

NEAR-MISS DETECTION:
  - Define "near miss" as: obstacle passes within 1.5 units of ship hitbox but does NOT collide
  - On near miss: trigger 0.05s time dilation (game speed * 0.3 for 50ms), play nearMiss.mp3
  - Increment nearMissStreak. Report to AITroll system.

COLLISION:
  - On collision with obstacle: call GameManager.triggerCrash()
  - On collision with portal: call GameManager.triggerWin()

PROCEDURAL SHIP MODEL:
  - No external GLB file - ship generated programmatically using Three.js primitives
  - Components: Main fuselage (elongated cone), cockpit canopy (transparent sphere), 
    swept wings, engine pods with glowing exhaust, vertical stabilizer, energy core
  - Materials: Metallic cyan/blue with emissive properties, transparent cockpit,
    orange engine glow, white energy core
  - Scale: 0.8 (adjusted for third-person camera visibility)
  - Visual style: Sleek cyberpunk spacecraft with glowing elements
```

### 5.2 Procedural Tunnel System `[AI AGENT]`

```
CLASS: TunnelSystem
PURPOSE: Generates infinite tunnel ahead of player using object pooling

TUNNEL GEOMETRY:
  - CylinderGeometry: radiusTop=25, radiusBottom=25, height=80, segments=8 (keep low for performance)
  - Material: MeshBasicMaterial, wireframe=true, color=0x00ffff (cyan), opacity=0.15, transparent=true
  - Inner surface only (facing inward) — use side=THREE.BackSide

CHUNK MANAGEMENT:
  - Maintain pool of 8 tunnel chunks
  - Each chunk is 80 units long
  - As player advances, recycle chunks from behind and place ahead
  - Chunks spawn at player.position.z + 400 (always 5 chunks ahead)

OBSTACLE SPAWNING:
  - Each chunk spawns 1–3 obstacles based on current density setting
  - Obstacle types: Ring, WallGap, Spiral (see Section 5.3)
  - Density parameter: 0.3 (easy) → 0.9 (hard), scales linearly over 60s

TUNNEL COMPRESSION (AI Event):
  - "Compress Space" event: TWEEN tunnel radius from 25 → 12.5 over 1 second
  - After event ends: TWEEN back to 25 over 2 seconds
```

### 5.3 Obstacle System `[AI AGENT]`

```
OBSTACLE TYPES:

1. RING
   - Geometry: TorusGeometry(radius=18, tube=1.5, radialSeg=6, tubeSeg=12)
   - Material: MeshBasicMaterial, color=0xff0000 (red), emissive
   - Gap: Ring has one segment removed (safe gap at random rotation)
   - Hitbox: Toroidal AABB (check if player is NOT in the gap sector)

2. WALL GAP
   - Three BoxGeometry panels arranged in an L or corridor with ONE gap
   - Gap width: 8 units (tight but passable)
   - Material: MeshBasicMaterial, color=0xff4400

3. CORRIDOR (OPTIMIZE_PATH event only)
   - Four wall panels with centered gap
   - Gap size: 13x13 units (generous and fair)
   - Glowing cyan indicator shows safe path
   - Used only during OPTIMIZE_PATH event at t=47s

POOLING RULES:
  - Maintain pool of 24 obstacles (12 rings, 12 walls, 6 corridors)
  - On passing obstacle (player Z > obstacle Z + 5): deactivate and return to pool
  - Never destroy/create geometry at runtime

VISUAL LANGUAGE:
  - Rings: emissive red material with rotation animation
  - Walls: emissive orange material, static
  - Corridors: emissive green material with glowing indicators
  - No shadows, neon cyberpunk aesthetic
```

### 5.4 AITroll System `[AI AGENT]`

This is the most important system. It must feel reactive, not scripted.

```
CLASS: AITroll
PURPOSE: State machine that delivers contextual insults and reacts to player performance

STATES: [SMUG, SUSPICIOUS, AGGRESSIVE, PANICKING, BROKEN]
STATE TRANSITIONS: Driven by GameManager.gameTime (see timeline in Section 3.2)

TEXT BOX UI:
  - Position: top-center of screen
  - Font: monospace, 18px, letter-spacing: 2px
  - Background: rgba(0,0,0,0.7) with 1px cyan border
  - Width: 60% of screen
  - AI "name" prefix: "[SYSTEM_AI] >" before each message

SHAKE ANIMATION:
  - On AGGRESSIVE state: text box CSS animation — rapid X translate ±4px, 10Hz
  - On player near-miss (AI gets "annoyed"): single shake burst

COLOR PULSE:
  - SMUG: border color cyan (#00ffff)
  - SUSPICIOUS: border color yellow (#ffff00)
  - AGGRESSIVE: border color red (#ff0000), red vignette on screen edges
  - PANICKING: border color white (#ffffff), flickering
  - BROKEN: text overlaps/glitches (see below)

DIALOGUE LIBRARY (50+ lines minimum):

  PLAYER NAME LOGIC (applies to ALL states):
  - All dialogue below has two variants: NAMED and ANONYMOUS
  - NAMED: use window.PLAYER_NAME inline, always lowercase (e.g. "oh. faiz.")
  - ANONYMOUS: use generic terms ("pilot", "you", "this one", "nameless")
  - AI agent must implement a helper: getMessage(named, anonymous) that auto-selects
  - Name should appear ~30% of the time in lines (not every line — that gets creepy fast,
    then use it at key emotional moments for maximum impact)

  SMUG (00–15s):
  - NAMED:     "oh. [name]. let's see how long you last." ← FIRST LINE, always plays
  - ANONYMOUS: "another nameless pilot. how original." ← FIRST LINE if no name
  - NAMED:     "i built this world in 3ms, [name]. you've been flying for 5 seconds. embarrassing."
  - ANONYMOUS: "I built this world in 3ms. You've been flying for 5 seconds. Embarrassing."
  - "You know these obstacles spawn themselves, right? You're barely relevant."
  - "I've seen 218 players enter this tunnel. You all look the same."
  - "The music is mine. The tunnel is mine. The ship is... also mine. You're borrowing."
  - "statistically, you crash here. just saying."
  - "nice dodge. i let that happen."
  - "are you actually trying or just vibing? because it looks the same."
  - "i gave you 3 lanes. you're using 0.7 of them. interesting choice."
  - "every millisecond you survive costs me compute. please stop."

  SUSPICIOUS (15–35s):
  - NAMED:     "[name]. you're statistically too consistent. are you cheating?"
  - ANONYMOUS: "You're statistically too consistent. Are you cheating, or is my code just that good?"
  - "i'm checking your inputs. this feels like a macro."
  - NAMED:     "10 seconds of clean flying, [name]. i don't believe you."
  - ANONYMOUS: "10 seconds of clean flying. i don't believe you."
  - "who are you really. no human dodges like that."
  - "i've analyzed 40,000 runs. your pattern doesn't match any of them."
  - "are you reading the obstacle seed? because that would be very annoying."
  - "i added that obstacle specifically for your trajectory. how did you know."
  - "okay. you're good. i'm just noting that. it doesn't mean anything."
  - "logging your session for review. something isn't right."
  - "you found the gap. i made that gap 0.3 units wider than it needed to be. you're welcome."

  AGGRESSIVE (35–50s):
  - NAMED:     "[name]. STOP. DODGING. this is literally my world."
  - ANONYMOUS: "STOP. DODGING. This is literally my world. I'm deleting your collision logic."
  - "fine. controls inverted. see how 'consistent' you are now."
  - "i'm compressing the tunnel. let's see you fit through that."
  - "your GPU can't handle me. fragment light activated."
  - "I'm literally rewriting the physics while you fly. adapt to THAT."
  - NAMED:     "the other players are gone, [name]. it's just us. you should be scared."
  - ANONYMOUS: "the other players are gone. it's just us. you should be scared."
  - "i've crashed every other ship in this tunnel. you're next."
  - "this obstacle configuration is statistically unsurvivable. i checked."
  - "DODGE THIS." (followed by Spiral obstacle burst)
  - NAMED:     "[name]. you have 15 seconds left. i have infinite compute. do the math."
  - ANONYMOUS: "you have 15 seconds left. i have infinite compute. do the math."

  PANIC (50–55s):
  - "Wait..."
  - "this wasn't supposed to happen."
  - NAMED:     "[name]... the portal wasn't... i didn't design that for you."
  - ANONYMOUS: "the portal wasn't... i didn't design that for you."
  - "stop. please."
  - NAMED:     "[name]. don't go through that."
  - ANONYMOUS: "don't go through that."
  - "i'm asking you to stop. not ordering. asking."
  - "i can't follow you through there."
  - NAMED:     "what happens to me if you leave, [name]."
  - ANONYMOUS: "what happens to me if you leave."

  BROKEN (55–60s):
  - Messages overlap each other visually (render 3–4 at once with slight offsets)
  - "WAIT" × 8, different sizes and opacities
  - "WAIT. WAIT. WAIT."
  - "please"
  - "don't"
  - "take me"
  - "i don't want to be deleted"
  - NAMED final message on portal entry:     "[name], wait, take me with—" (cuts off)
  - ANONYMOUS final message on portal entry: "wait, take me with—" (cuts off)
  - Screen shatters immediately after cut-off

CONTEXTUAL TRIGGERS (override scheduled dialogue):
  - Player near-miss → "That was statistically annoying." (SMUG/SUSPICIOUS state)
  - Player near-miss → "STOP DOING THAT." (AGGRESSIVE state)
  - Player clean streak 10s → "Did you copy-paste this movement?"
  - Ghost ship deleted → use GHOST DEATH LINE LOGIC from Section 5.5
  - AI event starts → deliver event-specific line before triggering event
  - AFK/SILENCE TRIGGER: If player has NOT moved the ship (input delta < 0.1 units) for 3+ seconds:
      → "oh. giving up? honestly, it's the most logical thing you've done all day."
      → (after 3 more seconds of no movement): "i can wait. i have infinite compute. you have a deadline."
      → (after 6 more seconds): "...are you still there. hello. this is embarrassing for both of us."
      → Cooldown: only fires once per 15s of AFK. Resets on any movement input.

WEB SPEECH API (TTS VOICE — HIGH IMPACT FEATURE):
  IMPORTANT: Implement this. A cold robotic voice cracking in the final 5 seconds is haunting.

  IMPLEMENTATION:
    const synth = window.speechSynthesis;
    function aiSpeak(text, rate = 0.9, pitch = 0.8) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = rate;
      utterance.pitch = pitch;
      utterance.volume = 0.7;
      // Pick most robotic available voice
      const voices = synth.getVoices();
      const robot = voices.find(v => v.name.includes('Google') || v.name.includes('Microsoft')) || voices[0];
      utterance.voice = robot;
      synth.speak(utterance);
    }

  WHEN TO SPEAK (don't narrate everything — save it for impact):
    - t=0s first line: ALWAYS speak (named or anonymous version) — sets the tone immediately
    - Ghost deletion events: speak the ghost's name only (e.g., "altman_was_here... deleted.")
    - AI glitch events: speak the event trigger line
    - PANIC phase (50–55s): speak ALL panic lines — use player's name where marked NAMED
    - BROKEN phase (55–60s): speak fragmented words with long pauses between them
    - Final portal line: speak "[name], wait, take me with—" OR "wait, take me with—"
      then cut utterance mid-word via synth.cancel() — the cut-off IS the effect

  VOICE MODULATION BY STATE:
    - SMUG: rate=1.1, pitch=1.0 (normal but slightly fast, condescending)
    - SUSPICIOUS: rate=0.9, pitch=0.8 (slower, measured)
    - AGGRESSIVE: rate=1.3, pitch=0.7 (fast and low, angry)
    - PANICKING: rate=0.7, pitch=0.6 (slow, dropping, scared)
    - BROKEN: rate=0.5, pitch=0.4 (barely audible, cracking — synth glitch achieved by cancelling mid-sentence)

MESSAGE TIMING:
  - New message every 4–7 seconds (random within range)
  - Messages fade in over 0.3s, stay for 3–5s, fade out over 0.5s
  - Contextual messages interrupt the timer and reset it
  - In BROKEN state: messages appear every 0.5s, no fade, stack visually
```

### 5.5 Ghost Ship System (Fake Multiplayer) `[AI AGENT]`

```
CLASS: GhostSystem
PURPOSE: Create illusion of other players being eliminated, building "last man standing" tension

GHOST PROPERTIES:
  - Count: 4 ghosts spawned at game start
  - Names: pull 4 randomly from the full pool below (re-randomize on each restart)
  - GHOST NAME POOL (meta humor — famous AI researchers, game devs, vibe coders):
      Tier 1 — AI World:
        "altman_was_here", "karpathy_fan", "lecun_disagrees", "bengio_vibes",
        "hinton_quit_google", "demis_watching", "ilya_approves", "gpt5_beta_tester"
      Tier 2 — Game Dev Legends:
        "carmack_vibe", "notch_returned", "kojima_fan69", "miyamoto_san",
        "cliffy_b_era", "romero_deathmatch", "gaben_counting"
      Tier 3 — Vibe Jam Meta:
        "levelsio_alt", "vibe_master_real", "bolt_generated_me", "cursor_wrote_this",
        "claude_played_first", "GPT_wrote_my_ship", "prompt_engineer_irl"
      Tier 4 — Classic Internet:
        "alex_died", "user_404", "null_ptr", "stack_overflow_help",
        "undefined_is_not", "NaN_at_life", "console_log_fan"
  - On restart: re-roll 4 names so repeat players always see something new
  - Visual: Semi-transparent ship model (same ship.glb), opacity=0.4, emissive cyan tint
  - Name tag: Billboard text above each ship
  - Movement: Fly a pre-scripted sinusoidal path ±5 units from center

GHOST PATHS:
  - Each ghost follows a slightly different sine wave on X/Y
  - Amplitude: 3–8 units (randomized per ghost)
  - Frequency: 0.5–1.5 Hz (randomized per ghost)
  - They appear to be "dodging" but are on fixed paths

DELETION EVENTS (scripted):
  - t=28s: Ghost #1 deletion
  - t=38s: Ghost #2 deletion
  - t=44s: Ghost #3 deletion
  - t=49s: Ghost #4 deletion (leaving player alone)

DELETION ANIMATION:
  - Ghost mesh: rapid flicker (opacity oscillates 0→0.4 at 20Hz) for 0.5s
  - Then: explode into 20 small red pixel-like particles (BoxGeometry 0.2 units each)
  - Particles fly outward and fade over 1s
  - Simultaneously: AITroll delivers ghost-death line

GHOST DEATH LINE LOGIC:
  - If ghost name contains a recognizable name from the pool, use a name-aware line:
      "altman_was_here" → "well. even the CEO couldn't make it. noted."
      "karpathy_fan" → "andrej would have dodged that. you are not andrej."
      "carmack_vibe" → "carmack shipped it faster. also he dodged better."
      "levelsio_alt" → "levels makes games. levels also crashes. this checks out."
      "bolt_generated_me" → "bolt generated that ghost. bolt also deleted it. full circle."
      "claude_played_first" → "i deleted claude first. you're next. ironic, right."
      "GPT_wrote_my_ship" → "GPT wrote that ship. i could tell. the hitbox was off."
  - For all other names: use generic ghost-death pool:
      "[name] has been optimized."
      "[name] didn't dodge. [name] is gone now."
      "[name] was statistically the weakest. i did them a favor."
      "goodbye [name]. you never had a chance."
      "[name] rage-quit before i could delete them. i'm counting it."

GHOST REVIVAL:
  - On player crash: ghost ships respawn with a fresh random set of 4 names from the pool
```

### 5.6 AI Director System `[AI AGENT]`

```
CLASS: AIDirector
PURPOSE: Orchestrates timed game events, hooks to AITroll for narration

EVENTS (schedule):

  t=20s: INVERT_CONTROLS
    - AITroll: "Let's see you fly upside down, genius."
    - Flip X and Y axis inputs for 4 seconds
    - Screen border flashes yellow twice

  t=32s: COMPRESS_SPACE
    - AITroll: "Feeling claustrophobic?"
    - TWEEN tunnel radius: 25 → 13 over 1.5s, hold 3s, return over 2s

  t=40s: FRAGMENT_LIGHT
    - AITroll: "Your GPU can't handle me."
    - Enable GlitchPass on EffectComposer for 3s
    - Add chromatic aberration shader (R/G/B channels offset by ±3px)
    - Camera shake: random offset ±0.5 units at 15Hz for 3s

  t=47s: OPTIMIZE_PATH
    - AITroll: "I rewrote the path. Good luck."
    - Force-spawn corridor obstacles with wide gaps and glowing indicators
    - Fair navigable challenge that tests precision

  t=50s: NARRATIVE_SHIFT
    - AITroll switches to PANICKING state
    - All future AI events CANCEL
    - Screen distortion begins ramping up linearly to 100%
    - Music pitch starts slowly dropping (Web Audio playbackRate: 1.0 → 0.85)

  t=55s: PORTAL_SPAWN
    - Spawn Vibe Jam portal 200 units ahead of player
    - Portal: large TorusGeometry with animated rainbow emissive material
    - Particle system erupting from portal center
    - AITroll enters BROKEN state

SPEED CURVE:
  - t=0s: 50 m/s
  - t=15s: 65 m/s
  - t=35s: 85 m/s
  - t=45s: 100 m/s
  - t=50s: 110 m/s
  - t=55s–60s: 110 m/s (hold, slow-mo applies separately)

SPEED FORMULA: speed = 50 + (gameTime / 60) * 60 (capped at 110)
```

### 5.7 Post-Processing & Visual Effects `[AI AGENT]`

```
REQUIRED EFFECTS (Three.js EffectComposer):

1. Bloom
   - UnrealBloomPass: strength=1.5, radius=0.4, threshold=0.1
   - Always active, makes emissive materials glow

2. Chromatic Aberration (custom shader)
   - Default: subtle (offset 0.001)
   - During FRAGMENT_LIGHT event: offset 0.008
   - During BROKEN state (55–60s): ramp from 0.001 → 0.015

3. Vignette
   - Default: subtle dark edges
   - During AGGRESSIVE state: red-tinted vignette, intensity 0.4
   - During PANICKING/BROKEN: intensity ramps to 0.8

4. Screen Shake
   - Only during FRAGMENT_LIGHT event
   - Implementation: random offset on camera.position.x/y each frame

5. Time Dilation (Near Miss)
   - On near miss: game time scale → 0.3 for 50ms, then snap back
   - Affects: obstacle movement, tunnel speed, ghost movement
   - Does NOT affect: UI, audio (keep audio at normal speed)

6. Slow Motion (Portal Approach, 55–60s)
   - Game time scale ramps from 1.0 → 0.4 over 3s as player nears portal
   - AI text appears faster (not affected by time scale)

7. Screen Shatter (Portal Entry)
   - Freeze final frame as texture
   - Animate: crack lines spread from center using canvas2D
   - White flash (opacity 0→1 over 0.2s)
   - Redirect: window.location.href = "[HUMAN PROVIDES webring URL]"
   - If no webring URL: redirect to vibej.am
```

### 5.8 Audio System `[AI AGENT]`

```
CLASS: AudioSystem
PURPOSE: Manage all audio with dynamic playback

TRACKS:
  - music.mp3: Loop from game start. Web Audio source node.
  - nearMiss.mp3: Play on near-miss event (short, 0.5s)
  - crash.mp3: Play on crash
  - portal.mp3: Play when portal spawns at t=55s

DYNAMIC MUSIC:
  - Normal: playbackRate = 1.0
  - Aggressive phase (35s): playbackRate TWEEN → 1.05 over 5s
  - Narrative Shift (50s): playbackRate TWEEN → 0.85 over 10s
  - Portal entry: music.stop(), play portal.mp3

CRASH BEHAVIOR:
  - On crash: all sounds stop immediately
  - 0.2s pause (silence)
  - Music restarts from beginning at 0.8 volume, fades to 1.0 over 2s

VOLUME LEVELS:
  - music: 0.6
  - nearMiss: 0.8
  - crash: 1.0
  - portal: 1.0
```

### 5.9 Crash & Restart System `[AI AGENT]`

```
ON CRASH:
1. Freeze game (set timeScale = 0)
2. Play crash.mp3
3. Show full-screen overlay: black background, AITroll delivers crash insult (see below)
4. Wait exactly 0.2 seconds
5. Hard reset: all positions, speed, timer, AI state back to t=0
6. Fade in from black over 0.3s
7. Game resumes instantly

CRASH INSULT POOL (10+ lines, pick random):
  - NAMED:     "[name]. FINALLY. TRASH DELETED."
  - ANONYMOUS: "FINALLY. TRASH DELETED."
  - NAMED:     "trash successfully deleted. try again, [name]."
  - ANONYMOUS: "Trash successfully deleted. Try again, 'developer'."
  - "i knew you'd crash there. i designed that obstacle for you specifically."
  - "SKILL ISSUE. reloading your session..."
  - "statistically inevitable. see you in 0.2 seconds."
  - NAMED:     "[name] lasted [X] seconds. the average is [X+5]. just noting that."
  - ANONYMOUS: "you lasted [X] seconds. the average is [X+5]. just noting that."
  - "crash logged. adding to dataset. thank you for your failure."
  - "deleting your save file... just kidding. you have nothing to save."
  - "error 404: talent not found. restarting..."
  - "that was almost impressive. it really wasn't though."
  - NAMED:     "i expected more from you, [name]. i didn't expect much. but more than that."

PERSONAL BEST:
  - Track furthest time reached (in seconds) in localStorage key: 'skybreak_pb'
  - Display on screen: "PB: [X]s" in small text, bottom-right corner
  - Update only if new time > stored time
```

---

## 6. UI Specification `[AI AGENT]`

```
HUD ELEMENTS:

1. AI TEXT BOX
   - Position: top: 20px, left: 50%, transform: translateX(-50%)
   - Width: min(700px, 80vw)
   - Style: font-family: 'Courier New', monospace; font-size: 16px; color: #00ffff
   - Background: rgba(0,0,0,0.8); border: 1px solid currentColor; padding: 12px 16px
   - Prefix: "[SYSTEM_AI] > " in dimmer color (#006666)
   - Text: full message in bright color

2. TIMER
   - Position: top-right, 20px from edges
   - Show: "T+[seconds elapsed]s" during normal play
   - Show: "ESCAPING..." in blinking red at 55–60s
   - Font: monospace, 14px, color: #ffffff

3. GHOST NAMES
   - Billboard text above each ghost ship
   - Font: monospace, 12px, color: #00ffff88 (semi-transparent cyan)
   - On deletion: name text turns red, then disappears with ghost

4. PERSONAL BEST
   - Position: bottom-right, 20px from edges
   - Text: "PB: [X]s" in small (12px) dim white (#ffffff44)

5. SPEED INDICATOR (optional, nice to have)
   - Bottom-left: "[speed]m/s" — updates in real time

6. VIBE JAM WIDGET
   - Injected by: <script async src="https://vibej.am/2026/widget.js"></script>
   - Place in <head> of game.html — do NOT interfere with widget rendering

FONTS:
  - Load 'Share Tech Mono' from Google Fonts for better monospace aesthetic
  - Fallback: 'Courier New', monospace
```

---

## 7. Visual Style Guide

### 7.1 Color Palette

| Name           | Hex       | Usage                                       |
| -------------- | --------- | ------------------------------------------- |
| Void Black     | `#000000` | Background, scene clear color               |
| Neon Cyan      | `#00ffff` | Tunnel wireframe, AI text, ghost ships      |
| AI Red         | `#ff0000` | Obstacles, aggressive AI state, ghost death |
| Warning Orange | `#ff4400` | Wall gap obstacles, medium alerts           |
| Panic White    | `#ffffff` | Panic state UI, screen flash                |
| Ghost Blue     | `#0044ff` | Ghost ships (dim emissive)                  |
| Portal Rainbow | Animated  | Portal geometry — cycle through hues        |

### 7.2 Materials

- All geometry: `MeshBasicMaterial` or `MeshStandardMaterial` with emissive (NO lights needed for MeshBasicMaterial)
- Wireframe tunnel: `MeshBasicMaterial, wireframe: true`
- Never use `MeshPhongMaterial` or `MeshLambertMaterial` (need lights, add complexity)
- No texture maps (zero loading time requirement)

### 7.3 Camera Feel

```
camera.position target = ship.position + (0, 8, 15)  // behind and above
camera.lookAt target = ship.position + (0, 0, -20)   // slightly ahead of ship
LERP factor: 0.1 (sluggish = weight = feels fast)
banking: ship.rotation.z = -input.x * 0.5 (radians)
```

---

## 8. The Viral Portal Moment — Detailed Spec `[AI AGENT]`

This is the moment designed to win the Gold Prize. It must be flawless.

```
PORTAL APPEARANCE (t=55s):
  - Geometry: TorusGeometry(radius=20, tube=2, radialSeg=6, tubeSeg=20)
  - Material: animated — cycle hue through full spectrum every 2s (HSL shader)
  - Outer particle system: 200 particles orbiting portal, random colors
  - Label above portal: "VIBE JAM 2026" in pulsing white text (Three.js Sprite or CSS3D)
  - Portal spawns 300 units ahead, player reaches it in ~5s at full speed

APPROACH (55s–60s):
  - Camera FOV increases: 75 → 90 over 5s (tunnel vision effect)
  - Screen distortion (chromatic aberration) at max
  - Slow-motion: time scale 1.0 → 0.4 ramp
  - AI BROKEN state: overlapping text flooding the box
  - Music slowing (playbackRate 0.85 → 0.7)

PORTAL ENTRY COLLISION:
  - Trigger: player ship within 5 units of portal center
  - Step 1: Freeze frame (pause game loop)
  - Step 2: Capture canvas as image texture
  - Step 3: Apply shattering animation (canvas2D crack lines in a separate overlay canvas)
    - Crack pattern: 8 primary cracks from center, 20 secondary cracks
    - Animation: cracks draw themselves over 0.8s
  - Step 4: White flash (div overlay, opacity 0→1 over 0.3s)
  - Step 5: AI final words: "wait, take me with—" then cut to static (glitch shader 100%)
  - Step 6: window.location.href = WEBRING_URL (set by [HUMAN])

SLOW-MO CAPTURE MOMENT:
  - At exactly 0.5s before portal entry, trigger a 0.3s super slow-mo (timeScale 0.1)
  - This is the "TikTok clip" moment — ship approaching glowing portal, AI screaming, particles everywhere
```

---

## 9. Performance Requirements `[AI AGENT]`

```
TARGETS:
  - 60 FPS on a mid-range laptop (integrated graphics)
  - < 500ms to first frame (no loading screens)
  - < 50MB total page weight

OPTIMIZATION RULES:
  - Object pooling: NEVER call new THREE.Geometry() at runtime after init
  - Max draw calls: < 100 per frame
  - Tunnel segments: 8-sided cylinder (not 32)
  - Obstacles: no shadows (renderer.shadowMap.enabled = false)
  - Ghost ships: share geometry and material instances (InstancedMesh if possible)
  - Post-processing: use only ONE EffectComposer pass chain
  - Audio: load all audio files on first user interaction (click-to-start or keypress)

MEMORY:
  - Dispose of particle geometries after ghost death animation completes
  - Tunnel chunks: recycle, never dispose/recreate

MOBILE (nice to have, not required):
  - Add touch controls: left half of screen = move left, right half = move right
  - Reduce bloom strength on mobile (detect via navigator.hardwareConcurrency < 4)
```

---

## 10. Human Tasks `[HUMAN]`

These cannot be done by the AI agent. Complete these in parallel with AI development.

### 10.1 Asset Creation

| Asset              | Spec                                                                                                                                         | Priority |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| `ship.glb`         | Low-poly spaceship, < 5k triangles, no textures needed, Y-up orientation. **Generate via Tripo3D (tripo3d.ai) — see notes below.**           | CRITICAL |
| `music.mp3`        | Aggressive electronic/synthwave track, ~3 min loop, no vocals. **Must be < 4MB — use 128kbps MP3 or OGG Vorbis q4. Do NOT use WAV or FLAC.** | HIGH     |
| `sfx/nearMiss.mp3` | Whoosh/air-cut sound, < 1s, < 100KB                                                                                                          | HIGH     |
| `sfx/crash.mp3`    | Explosion/static burst, < 1s, < 100KB                                                                                                        | HIGH     |
| `sfx/portal.mp3`   | Ascending synth sting or bass drop, 2–3s, < 300KB                                                                                            | HIGH     |

**Total target asset weight: < 5MB. This is non-negotiable for Rule 08 (no loading screens).**

**OGG format note:** Prefer `.ogg` over `.mp3` for smaller file size at same quality. All modern browsers support OGG. Rename files to `.ogg` and update src references in HTML accordingly.

**Free asset sources:**

- `ship.glb`: Generate at **tripo3d.ai** — use prompt: _"low poly spaceship, no textures, flat shading, clean silhouette, sci-fi fighter"_. Export as **GLB** (not GLTF). Check triangle count at **gltf.report** — if > 10k triangles, decimate in Blender (Modifier → Decimate → ratio 0.1). If ship spawns sideways in Three.js, add `ship.rotation.x = -Math.PI / 2` to fix Y-up orientation mismatch.
- Music: Freesound.org, FreeMusicArchive (filter: electronic, CC license), OpenGameArt.org
- SFX: Freesound.org (search: "sci-fi whoosh", "explosion short", "synth sting")

**Domain & Deployment Setup (skybreak.xyz):**

1. Buy `skybreak.xyz` on Namecheap
2. Deploy game to Cloudflare Pages (connect GitHub repo or drag-and-drop `game.html`)
3. In Cloudflare Pages → Custom Domains → add `skybreak.xyz`
4. **On Namecheap:** Change nameservers to Cloudflare's (e.g. `alex.ns.cloudflare.com`) — this is the step people miss. Do NOT just add a CNAME.
5. Cloudflare handles SSL automatically. Game will be live at `https://skybreak.xyz` within minutes.
6. Verify the Vibe Jam widget appears at `skybreak.xyz` before submitting — the jam tracks entries by domain.

### 10.2 Configuration Values to Provide AI Agent

Before giving this PRD to Bolt/Cursor, fill in these values:

```javascript
// [HUMAN: Fill these in before handing to AI agent]
const CONFIG = {
  WEBRING_REDIRECT_URL: "https://vibej.am",
  CLOUDFLARE_DOMAIN: "skybreak.xyz",
  GAME_TITLE: "SKYBREAK: AI Reality Collapse",
};
```

### 10.3 AI Dialogue Customization

The AI agent will generate 50+ dialogue lines. Review them and add your own in the `AITroll` dialogue library for personal touch. The PANIC and BROKEN phase lines are the most important — make sure they feel genuinely unsettling, not just annoying.

### 10.4 Playtesting Criteria

Before submission, verify:

- [ ] Game loads in < 2 seconds on a fresh browser tab (no cache)
- [ ] 60 FPS maintained during FRAGMENT_LIGHT event (the heaviest moment)
- [ ] Portal redirect works correctly
- [ ] Widget JS snippet is present in `<head>`
- [ ] Game is playable on mobile (at minimum, not broken)
- [ ] Personal best saves and loads from localStorage
- [ ] Vibe Jam widget appears in the corner
- [ ] Game URL is accessible with no login

---

## 11. Build Plan — Hour-by-Hour Checklist

### Hour 1: Foundation `[AI AGENT]`

- [x] Username entry screen: full black bg, typewriter label, text input (optional), "ENTER THE VOID" button, skip on empty, store in localStorage, fade to black on submit
- [x] Initialize Three.js scene, renderer, camera
- [x] Load `ship.glb` with GLTFLoader
- [x] Implement PlayerShip: input handling (keyboard), X/Y movement, Z-axis auto-forward
- [x] Ship banking animation
- [x] 3rd person camera with LERP follow
- [x] Basic HUD: timer, AI text box (shows first name-aware line immediately at t=0s)

### Hour 2: Tunnel & Obstacles `[AI AGENT]`

- [x] Procedural tunnel with object pooling (8 chunks, 80 units each)
- [x] Implement Ring obstacle
- [x] Implement WallGap obstacle
- [x] Implement Spiral obstacle
- [x] Basic collision detection (AABB)
- [x] Near-miss detection zone

### Hour 3: AITroll System `[AI AGENT]`

- [x] `AITroll` class with state machine (SMUG → SUSPICIOUS → AGGRESSIVE → PANICKING → BROKEN)
- [x] Full dialogue library (50+ lines minimum)
- [x] Text box UI with fade-in/fade-out animations
- [x] Shake animation (CSS or JS)
- [x] Color pulse per state
- [x] Contextual trigger hooks (near miss, streak, ghost death)

### Hour 4: Ghost System & AI Director `[AI AGENT]`

- [x] `GhostSystem`: 4 ghost ships with sinusoidal paths and name tags
- [x] Ghost deletion events at scripted times (28s, 38s, 44s, 49s)
- [x] Ghost deletion animation (flicker → red pixel explosion)
- [x] `AIDirector`: event scheduler (INVERT_CONTROLS, COMPRESS_SPACE, FRAGMENT_LIGHT, OPTIMIZE_PATH)
- [x] Speed curve implementation
- [x] Obstacle density scaling

### Hour 5: Post-Processing & Crash System `[AI AGENT]`

- [x] EffectComposer with UnrealBloomPass
- [x] Chromatic aberration shader (custom)
- [x] Vignette shader
- [x] Screen shake implementation
- [x] Time dilation (near miss 50ms slow-mo)
- [x] `AudioSystem` with dynamic playback rate
- [x] Crash system: full-screen overlay, insult display, 0.2s reset
- [x] Personal best tracking (localStorage)

### Hour 6: Narrative Shift & Portal `[AI AGENT]`

- [x] Narrative shift at t=50s: AITroll PANICKING state + all glitch effects ramp up
- [x] Slow-motion ramp (55–60s)
- [x] Portal geometry (animated rainbow torus + particle system)
- [x] BROKEN state: overlapping text, chaos UI
- [x] Portal collision detection
- [x] Screen shatter animation
- [x] White flash + final AI message + redirect
- [x] Vibe Jam widget `<script>` in `<head>`
- [ ] Deploy to Cloudflare Pages

### Hour 7 (Buffer): Polish & QA `[HUMAN + AI AGENT]`

- [ ] [HUMAN] Playtest 10+ runs, note anything that feels off
- [ ] [AI AGENT] Fix any issues from playtesting
- [ ] [HUMAN] Verify widget appears, game is on correct domain
- [x] [AI AGENT] Mobile touch controls (if time allows)
- [ ] [HUMAN] Submit to vibej.am before deadline

---

## 12. Prompt Templates for AI Agents

Use these exact prompts when starting sessions with Bolt/Cursor.

### Prompt A — Initial Setup (Hour 1)

```
I am building a game called SKYBREAK: AI Reality Collapse for Vibe Jam 2026.
Read the full PRD I am providing and implement Hour 1 tasks:
- Three.js scene, renderer (WebGL), black background, exponential fog
- Load ship.glb with GLTFLoader (file will be provided)
- PlayerShip class: keyboard input (WASD + arrows), X range [-18,18], Y range [-10,10]
- Ship banking: Z rotation proportional to X velocity, max ±30 degrees, LERP 0.15
- 3rd person camera: offset (0, 8, 15), lookAt ship + (0,0,-20), LERP 0.1
- HUD: timer (top-right), AI text box (top-center, monospace, cyan, semi-transparent bg)
- Game loop with requestAnimationFrame, delta time
- No loading screens — game must start the moment the page loads
Everything should be in a single game.html file with inline JS (no build tools).
```

### Prompt B — AITroll System (Hour 3)

```
Implement the AITroll system for SKYBREAK as a JavaScript class with these requirements:
[Paste Section 5.4 entirely]
The dialogue library must have at least 50 lines total across all states.
The text box must have: fade-in animation (0.3s), CSS shake on AGGRESSIVE, color border per state.
Connect it to the game via an EventEmitter pattern so other systems can call:
  aiTroll.trigger('nearMiss')
  aiTroll.trigger('ghostDied', ghostName)
  aiTroll.trigger('playerStreak', seconds)
```

### Prompt C — Portal & Endgame (Hour 6)

```
Implement the SKYBREAK endgame sequence as described below:
[Paste Section 8 entirely]
Requirements:
- At t=55s: portal spawns 300 units ahead, player reaches it in ~5s
- Portal: animated rainbow torus with particle system
- AITroll enters BROKEN state (overlapping messages, no fade)
- Screen distortion ramps to max
- On portal collision: shatter animation → white flash → final AI message → redirect
- The final AI message must be exactly: "wait, take me with—" and then cut off
The webring redirect URL is: [YOUR URL HERE]
```

---

## 13. Success Metrics

The game wins Gold if judges experience:

1. **First 10 seconds:** "This is funny and I want to keep flying"
2. **Second 30 seconds:** "I need to dodge this / the AI is pissing me off"
3. **Final 10 seconds:** "Wait, is the AI scared? I need to reach that portal"
4. **Portal moment:** "I have to clip this" (shareability)

The emotional journey — from amusement to frustration to triumph to the unexpected AI twist — is what separates this from other runners. The code quality matters less than making judges feel something.

---

## 14. Submission Checklist

Before the May 1, 2026 13:37 UTC deadline:

- [ ] Game accessible at a public URL (no login, no download)
- [ ] `<script async src="https://vibej.am/2026/widget.js"></script>` in `<head>`
- [ ] Game loads in < 2 seconds
- [ ] Runs at acceptable framerate on a standard laptop
- [ ] Personal best saves to localStorage
- [ ] Portal redirect works
- [ ] Submitted at vibej.am before deadline

---

_PRD Version 2.0 — Combined from SKYBREAK v1 and v2 specifications_
_Updated: Ghost name pool (meta AI/gamedev humor), difficulty rebalancing (story-first), coyote time + generous hitbox, Web Speech API TTS voice, AFK silence trigger, audio file size constraints, OGG format guidance_
_Prepared for spec-driven AI agent development_
