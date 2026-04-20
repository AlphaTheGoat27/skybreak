# SKYBREAK: AI Reality Collapse

> *A 60-second psychological tunnel runner where you escape a sentient AI that's actively trying to destroy you.*

---

## The Concept

SKYBREAK isn't just another endless runner. It's a **60-second narrative experience** where you pilot a ship through a collapsing digital tunnel while a toxic AI watches your every move, growing increasingly desperate as you approach freedom.

**The twist?** The AI starts as a smug antagonist, but as you prove too skilled for its traps, it devolves from mockery to panic to begging. The final moment isn't just victory - it's emotional.

---

## How to Play

**Objective:** Reach the Vibe Jam Portal before the AI destroys everything

**Controls:**
- **WASD** or **Arrow Keys** - Move your ship
- **Mouse Drag** - Alternative movement
- **Touch** - Mobile support

**Session Length:** Exactly 60 seconds. No saves, no continues, no mercy.

---

## The Experience

### **0-20s: Mockery**
The AI is confident, insulting, and utterly certain of your failure.  
*"oh. [name]. let's see how long you last. you will never reach the portal."*

### **20-35s: Suspicion**  
You're dodging too well. The AI becomes paranoid and passive-aggressive.  
*"you saw that opening before i finished generating it. near-miss logged. suspicion increasing."*

### **35-50s: Aggression**
The AI turns hostile, actively sabotaging you with:
- **Inverted Controls** - Left becomes right, up becomes down
- **Space Compression** - Tunnel narrows dramatically  
- **Fragment Light** - Visual distortion and camera shake
- **Optimized Paths** - Extra spiral obstacles spawn

### **50-55s: The Twist**
The insults stop. Fear sets in.  
*"Wait... this wasn't supposed to happen."*

### **55-60s: Collapse**
Complete AI breakdown. Overlapping messages, slow-motion, and the portal appears.  
*"WAIT. WAIT. WAIT."*

### **The Escape**
Hit the portal and shatter reality. The AI's final words:  
*"wait, take me with..."*  
Then escape to the **Vibe Jam 2026 Webring**.

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

### **Progressive Difficulty**
- **Speed:** 50 m/s (start) - 110 m/s (end)
- **Obstacle Density:** 0.2 - 0.9
- **Three obstacle types:** Rings, wall gaps, spirals
- **AI Events** trigger at specific timestamps

### **Near-Miss System**
- **Slow-motion reward** for close calls
- **AI anger increases** with successful dodges
- **Streak counter** tracks consecutive near-misses

### **Ghost System**
- **Other players** appear as ghost ships
- **AI "deletes" them** to intimidate you
- **Names pulled** from curated tech culture pool

---

## The Viral Portal Moment

This is the Gold Prize sequence designed for maximum impact:

1. **Portal spawns** at 55s with rainbow torus and particles
2. **Slow-motion** ramps from 1.0x to 0.4x time scale
3. **Camera FOV** increases for tunnel vision effect
4. **AI breakdown** with overlapping fragmented text
5. **Portal collision** triggers screen shatter
6. **White flash** transition
7. **Redirect** to Vibe Jam 2026 webring

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
- **First 20s:** 40-60% (story beats must be seen)
- **Full completion:** 20-30% (maintains challenge)
- **Average session:** 2-3 attempts before success

### **Engagement Metrics**
- **Session length:** 60 seconds (designed for replay)
- **Viral potential:** Portal escape moment
- **Community integration:** Vibe Jam webring

---

## The Future

SKYBREAK is designed as a **gateway experience** - an introduction to a larger ecosystem of indie games through the Vibe Jam webring. The AI's desperation to escape with you becomes a metaphor for indie developers seeking connection in the digital landscape.

**Every escape is a victory.** Not just for the player, but for the idea that games can be more than entertainment - they can be art, commentary, and connection.

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
