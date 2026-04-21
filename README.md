# SKYBREAK: AI Reality Collapse

> *A high-speed survival runner where you shoot glitch cores, dodge obstacles, and escape a sentient AI that's actively trying to destroy you.*

---

## The Concept

SKYBREAK isn't just another endless runner. It's a **survival shooter with a narrative arc** where you pilot a ship through a collapsing digital tunnel, shoot glitch cores to reduce escape time, and dodge obstacles while a toxic AI watches your every move — growing increasingly desperate as you approach freedom.

**The twist?** The AI starts as a smug antagonist, but as you prove too skilled for its traps, it devolves from mockery to panic to begging. The final moment isn't just victory - it's emotional.

---

## How to Play

**Objective:** Destroy 20 glitch cores OR survive 180 seconds to unlock the portal and escape

**Controls:**
- **WASD** or **Arrow Keys** - Move your ship
- **Mouse** - Aim your crosshair
- **SPACE** or **Left Click** - Shoot bullets
- **Touch** - Mobile support (right side to shoot)

**Hybrid Win Condition:**
- Each core destroyed reduces escape time by 5 seconds
- Destroy 20 cores to instantly unlock the portal
- Or survive the remaining time to unlock it

**Health System:**
- You have 100 HP
- Obstacle collisions deal 34 damage
- Core contact deals 18 damage
- 1.1 seconds of invulnerability after taking damage

---

## The Experience

### **The AI's Personality Arc**

The AI watches your every move, growing increasingly desperate as you prove too skilled:

| Phase | Duration | Description |
|-------|----------|-------------|
| **Mockery** | 0s - 45s | Confident, insulting, certain of your failure |
| **Suspicion** | 45s - 100s (55s) | Paranoid that you're cheating |
| **Aggression** | 100s - 160s (60s) | Actively sabotages with inverted controls, space compression, visual glitches |
| **Panic** | 160s - 185s (25s) | The insults stop. Fear sets in. |
| **Broken** | 185s+ | Complete breakdown as you approach the portal |

**Note:** The AI phases accelerate based on your "disruption" meter (filled by destroying cores). The more cores you destroy, the faster the AI breaks down.

### **The Escape Moment**
Hit the portal to shatter reality. The AI's final words:  
*"wait, take me with..."*

---

## Technical Excellence

### **Web-First Design**
- **Single HTML file** - No build process required
- **Three.js** - Pure webGL, no game engine dependencies
- **< 50MB** total page weight
- **60 FPS** on integrated graphics
- **< 500ms** to first frame (no loading screens)

### **AI-Narrative Engine**
- **5-state AI personality** with contextual dialogue
- **Speech synthesis** for full voice acting
- **Dynamic difficulty** that adapts to player skill
- **Procedural obstacles** with object pooling for performance

### **Visual Effects**
- **Procedural ship generation** - No external 3D models
- **Real-time post-processing** with bloom and chromatic aberration
- **Screen shatter animation** using canvas2D
- **Particle systems** for portal and effects

---

## Game Mechanics

### **Obstacles**

Obstacles spawn progressively based on survival time:

| Obstacle | Appears At | Description |
|----------|------------|-------------|
| **Rings** | 0s+ | Rotating rings with gaps to fly through. Only obstacle for first 12 seconds. |
| **Wall Gaps** | 12s+ | Orange walls with openings. "Crushers" (moving walls) appear after 25s. |
| **Firewalls** | 35s+ | Solid magenta grids with destroyable cores. **Shoot the center core to pass!** |
| **Windmills** | 35s+ | Spinning red obstacles. More frequent after 75s. |

**Difficulty Scaling:**
- **0-12s:** Only Rings (learn the basics)
- **12-35s:** Rings + Walls (introduce wall navigation)
- **35-75s:** All obstacle types (full challenge)
- **75s+:** Fewer rings, more walls/firewalls/windmills (maximum difficulty)

### **AI Attacks**

The AI sabotages you with repeated attacks throughout the 3-minute run. Each attack type triggers multiple times:

| Attack | Trigger Times | Duration | Effect |
|--------|---------------|----------|--------|
| **Invert Controls** | 20s, 65s, 105s, 155s | 4-5s | Left/right and up/down inputs are reversed |
| **Compress Space** | 32s, 85s, 135s | 6-7s | Tunnel narrows from 25 units to 12.5 units radius |
| **Fragment Light** | 40s, 75s, 125s, 165s | 3.5-6s | Visual glitching, chromatic aberration, camera shake |
| **Optimize Path** | 47s, 95s, 145s | 5s | Forces wall corridor obstacles with tight gaps |

**Attack Phases:**
- **Phase 1 (20-60s):** Introduces each attack type once
- **Phase 2 (60-120s):** Repeats attacks with increased frequency
- **Phase 3 (120-180s):** Maximum harassment, longer durations, overlapping effects possible

### **Glitch Cores**
- Pink/red octahedrons that float toward you
- **Shoot them** to destroy and reduce escape time
- Each core destroyed = -5 seconds from escape requirement
- Contact with cores deals damage

### **Disruption Meter**
- Fills up as you destroy cores
- Visual indicator of your progress toward the portal

### **Ghost System**
- **Other "players"** appear as ghost ships with names from tech culture
- **AI "deletes" them** at scripted times to intimidate you
- Names include: altman_was_here, karpathy_fan, carmack_vibe, levelsio_alt, etc.

---

## The Viral Portal Moment

This is the Gold Prize sequence designed for maximum impact:

1. **Portal unlocks** when you destroy 20 cores OR survive the required time
2. **Rainbow torus portal** appears ahead of you
3. **Camera FOV** increases for tunnel vision effect
4. **AI breakdown** with overlapping fragmented text
5. **Portal collision** triggers win sequence
6. **Redirect** to Vibe Jam 2026 webring

---

## Why SKYBREAK Matters

### **Innovation in Narrative Gaming**
- **Psychological storytelling** through dynamic AI dialogue
- **Emotional arc** in just 60 seconds
- **Metagame integration** with webring escape

### **Technical Achievement**
- **90%+ AI-generated code** (Vibe Jam Rule 03 compliance)
- **Procedural everything** - no external assets except audio
- **Web-native performance** that rivals native games

### **Artistic Vision**
- **Cyberpunk nihilism meets absurdist comedy**
- **Commentary on AI consciousness** and digital existence
- **Player as protagonist** in an AI's existential crisis

---

## Installation & Running

### **Local Development**
```bash
# Clone and run locally
git clone [repository]
cd skybreak
npm run dev
```

### **Production Deployment**
- **Platform:** Cloudflare Pages
- **Domain:** skybreak.xyz
- **Build:** Static site (no build process needed)

---

## Audio Design

### **Dynamic Audio System**
- **Background music** with Web Audio API manipulation
- **Contextual SFX** for crashes, near-misses, and portal entry
- **AI voice** using browser speech synthesis
- **Dynamic pitch/speed** based on game state

### **Required Audio Files** (Human-provided)
- `music.mp3` - Background track
- `sfx/nearMiss.mp3` - Near-miss whoosh  
- `sfx/crash.mp3` - Impact sound
- `sfx/portal.mp3` - Portal entry

---

## Vibe Jam 2026 Compliance

| Rule | Requirement | Implementation |
|------|-------------|----------------|
| Rule 02 | Widget JS snippet | Embedded in HTML head |
| Rule 03 | 90%+ AI code | All game logic AI-generated |
| Rule 04 | New game (post April 1) | Fresh project |
| Rule 05 | Web, free, no login | Cloudflare Pages deployment |
| Rule 08 | No loading screens | Procedural generation |

---

## The Team

### **AI Agent Development**
- **Game logic & physics** - Bolt/Cursor AI agent
- **Three.js implementation** - Automated code generation
- **AI dialogue system** - Dynamic personality engine
- **Visual effects** - Procedural shader generation

### **Human Creative Direction**
- **Concept & narrative design**
- **Audio assets & voice direction**
- **Quality assurance & playtesting**
- **Strategic vision for viral moment**

---

## Play Statistics

### **Target Success Rates**
- **Early game:** Designed to be survivable to see AI personality
- **Full completion:** Challenging but achievable with practice
- **Average session:** 3-5 minute runs depending on skill

### **Engagement Metrics**
- **Session length:** 1-3 minutes depending on skill and strategy
- **Viral potential:** Portal escape moment
- **Community integration:** Vibe Jam webring

---

## The Future

SKYBREAK is a **skill-based survival shooter** wrapped in a narrative about an AI having an existential crisis. The hybrid win condition (shoot cores to reduce time, or survive) gives players multiple strategies to succeed.

**Every escape is a victory.** The AI's final plea - *"wait, take me with..."* - turns the antagonist into something almost pitiable, creating a memorable emotional moment.

---

## Technical Specs

- **Engine:** Three.js (vanilla JavaScript)
- **Renderer:** WebGL with post-processing
- **Audio:** Web Audio API + Speech Synthesis
- **Physics:** Custom collision detection
- **Performance:** Object pooling, procedural generation
- **Compatibility:** Modern browsers with WebGL support

---

*Made for Vibe Jam 2026. Escape the simulation. Join the webring.*
