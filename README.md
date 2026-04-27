# SKYBREAK: AI Reality Collapse

> *A high-speed survival shooter where you shoot glitch cores, dodge obstacles, and escape a sentient AI that's actively trying to destroy you.*

---

## The Concept

SKYBREAK is a **survival shooter with a narrative arc**. You pilot a ship through a collapsing digital tunnel, shoot AI bot cores to reduce your escape time, and dodge obstacles while a toxic AI watches your every move — growing increasingly desperate as you approach freedom.

**The twist?** The AI starts as a smug antagonist, but as you prove too skilled for its traps, it devolves from mockery to panic to begging. The final moment isn't just victory — it's emotional.

---

## How to Play

**Objective:** Destroy 8 AI bots OR survive 150 seconds to unlock the portal and escape.

**Controls:**
- **WASD** or **Arrow Keys** — Move your ship
- **Mouse** — Aim your crosshair
- **SPACE** or **Left Click** — Shoot
- **SHIFT** — Boost (builds heat)
- **C** — Brake
- **Touch** — Mobile supported (right side to shoot, left joystick to move)

**Hybrid Win Condition:**
- Each AI bot destroyed reduces escape time by 8 seconds
- Destroy 8 AI bots to instantly unlock the portal
- Or survive the full 150 seconds

**Health System:**
- 100 HP
- Obstacle collisions deal 20 damage
- 0.9 seconds of invulnerability after each hit
- 5 hits to die — survivable with good dodging

---

## The AI's Personality Arc

The AI watches your every move and reacts in real time. Destroying cores accelerates its breakdown — each kill pushes the AI 15 seconds forward in its arc.

| Phase | Time (natural) | Description |
|-------|----------------|-------------|
| **Smug** | 0s – 38s | Confident, insulting, certain of your failure |
| **Suspicious** | 38s – 80s | Paranoid that you're cheating or too consistent |
| **Aggressive** | 80s – 125s | Actively sabotages with direct attacks |
| **Panicking** | 125s – 142s | Fear sets in. Begging starts. |
| **Broken** | 142s+ | Complete breakdown as you approach the portal |

Shoot cores aggressively and you can push the AI from Smug to Broken in under a minute.

---

## Obstacles

Obstacles spawn in bursts with guaranteed clear gaps between them so AI bot cores can always appear.

| Obstacle | Appears At | Description |
|----------|------------|-------------|
| **Rings** | 0s+ | Rotating rings with gaps. Only obstacle for first 12 seconds. |
| **Wall Gaps** | 12s+ | Orange walls with openings. Crushers (moving walls) appear after 25s. |
| **Firewalls** | 35s+ | Purple wireframe rings with a shootable core. Shoot the center to clear. |
| **Windmills** | 35s+ | Spinning red blades. More frequent after 75s. |

Obstacle spacing is enforced — no two obstacles can be within 220 units of each other.

---

## AI Attacks

The AI director fires attacks on a schedule. Each fires multiple times across the run.

| Attack | Trigger Times | Duration | Effect |
|--------|---------------|----------|--------|
| **Invert Controls** | 18s, 55s, 92s | 5–7s | Left/right and up/down inputs reversed |
| **Compress Space** | 28s, 75s, 108s | 5–6s | Tunnel narrows, demands tighter movement |
| **Fragment Light** | 36s, 65s, 100s | 4–5s | Screen flicker and subtle camera wobble |
| **Optimize Path** | 44s, 83s | 5s | Forces wall corridor obstacles ahead |

A short warning line fires 1.2 seconds before each attack so you have time to react.

---

## AI Bots (Cores)

- Pink/red octahedrons that float toward you from 420 units ahead
- **Shoot them** to destroy and reduce escape time by 8 seconds each
- Destroying a core also accelerates game speed and obstacle density
- Cores spawn every 8 seconds — 1 at a time early, up to 2 at once after 30 seconds
- 8 cores destroyed = portal unlocks immediately

---

## Speed Curve

Speed ramps gradually across the 150 second run:

| Time | Speed |
|------|-------|
| 0s | 32 m/s |
| 15s | 42 m/s |
| 40s | 52 m/s |
| 70s | 65 m/s |
| 100s | 78 m/s |
| 130s+ | 90 m/s |

Destroying cores also pushes the speed curve forward — aggressive players fly faster.

---

## Multiplayer

- Up to 8 players per room
- Create a custom room code or quick-join a public room
- Public rooms start automatically after 20 seconds with 2+ players
- Leaderboard ranks by distance traveled (Z position), not kills
- Host is authoritative for core spawns — everyone sees the same map
- Bullet hit detection radius: 9 units server-side

---

## Ghost System

- Ghost ships with names from tech culture appear alongside you
- The AI "deletes" them at scripted moments to intimidate you
- Names include: altman_was_here, karpathy_fan, carmack_vibe, levelsio_alt, bolt_generated_me, etc.

---

## Technical Stack

- **Engine:** Three.js (vanilla JavaScript, no game engine)
- **Renderer:** WebGL with post-processing (bloom, chromatic aberration, vignette)
- **Audio:** Web Audio API + browser Speech Synthesis (Chrome keep-alive for 15s kill prevention)
- **Multiplayer:** Socket.io (Node.js server)
- **Physics:** Custom AABB collision detection
- **Performance:** Object pooling for all obstacles, bullets, and particles
- **Build:** Vite

---

## Running Locally

```bash
git clone https://github.com/AlphaTheGoat27/skybreak
cd skybreak
npm install
npm run dev
```

Multiplayer server (separate terminal):
```bash
node server.js
```

Set `VITE_SOCKET_URL` in `.env` to point at your server.

---

## Audio Files

Place these in `/public/`:
- `music.mp3` — Background track
- `sfx/bullet.mp3` — Shoot sound
- `sfx/nearMiss.mp3` — Near-miss whoosh
- `sfx/crash.mp3` — Impact sound
- `sfx/portal.mp3` — Portal entry

---

## Vibe Jam 2026 Compliance

| Rule | Requirement | Status |
|------|-------------|--------|
| Rule 02 | Widget JS snippet | ✅ Embedded in HTML |
| Rule 03 | 90%+ AI code | ✅ All game logic AI-generated |
| Rule 04 | New game (post April 1) | ✅ Fresh project |
| Rule 05 | Web, free, no login | ✅ Deployed on Cloudflare Pages |
| Rule 08 | No loading screens | ✅ Procedural generation |

---

*Made for Vibe Jam 2026. Escape the simulation. Join the webring.*
