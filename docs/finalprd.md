# SKYBREAK — Multiplayer & Portal PRD
## Product Requirements Document for AI Agent Implementation
### Version 2.0 · Vibe Jam 2026

---

## 0. CONTEXT AND CONSTRAINTS

### What exists right now
- `main.js` — solo game fully working: ship flies through tunnel, shoots AI bots (cores), AI villain dialogue arc (SMUG→BROKEN), portal escape sequence
- `server.js` — socket.io server exists but uses an **incompatible event schema** with what main.js expects
- `style.css` — all MP CSS classes already defined (mode-select, mp-leaderboard, kill-feed, etc.)
- `index.html` — socket.io CDN already loaded
- The server uses events: `player_state`, `bullet_fired` (server-authoritative), `core_spawn`, `core_destroyed`
- The current main.js has **no socket.io calls at all** — the client side was never wired up

### The primary problem
The server and client were built independently and don't speak the same language. This PRD defines the **correct unified protocol** that both must use. The server needs partial refactoring. The client needs full MP wiring. Do not invent new event names — use exactly the names in Section 4.

### Non-negotiables
- Solo mode must work identically to current behavior — zero regression
- No white flash or brightness changes when other players are near
- Other players must be visible as distinct colored ships with name tags
- The AI villain (AITroll class) must continue working in MP — it still taunts you
- Portal webring redirect must still work at the end
- `<script async src="https://vibej.am/2026/widget.js"></script>` must stay in index.html head
- The game uses `type: "module"` — server.js already uses ESM imports, keep it

---

## 1. INTRO SCREEN FLOW

### Current state (broken)
The intro screen shows a form immediately. There is no mode select in front of it.

### Required state

The intro screen has three sequential stages:

#### Stage 1 — Mode Select (default on page load)

The `[SYSTEM_AI] > ` box runs a typewriter: **"SELECT MODE"** — each character appears one by one at 38ms intervals, same mechanism as the existing typewriter code.

Visible elements:
- Logo, title, subtitle
- The typewriter label running "SELECT MODE"
- Two buttons: **SOLO** and **MULTIPLAYER**

The mode-select div and both buttons already exist in main.js HTML. They just need to be shown by default and the form/mp-setup hidden.

```
Default visibility on page load:
  #mode-select     → display: flex   ✅ SHOW
  #intro-hint      → display: none   ✅ HIDE  
  #intro-form      → display: none   ✅ HIDE
  #mp-setup        → display: none   ✅ HIDE
  #mp-lobby        → display: none   ✅ HIDE
```

#### Stage 2A — Solo clicked

Typewriter text changes to: **"identify yourself. or don't. i'll find out anyway."** — restarts the typewriter animation with this new text.

Visible elements:
- `#mode-select` → hide
- `#intro-hint` → show (flex)
- `#intro-form` → show (flex)
- A "← BACK" text link appears below the form to return to mode select

The intro-hint shows device-aware instructions:
- Desktop (width ≥ 768px): "WASD · MOUSE AIM · SPACE/CLICK = SHOOT · PINK BOT = TARGET"
- Mobile (width < 768px or touch device): "LEFT HALF = MOVE · RIGHT HALF = SHOOT · PINK BOT = TARGET"

#### Stage 2B — Multiplayer clicked

Typewriter text changes to: **"identify yourself. or don't. i'll find out anyway."** — same animation.

Visible elements:
- `#mode-select` → hide
- `#mp-setup` → show (flex)

The mp-setup shows:
1. Pilot name input (optional)
2. Three room buttons side by side:
   - **CREATE ROOM** — opens a browser `prompt("Enter a custom room code (leave blank for random):") ` or just generates random, then creates the room and shows the lobby
   - **JOIN ROOM** — opens `prompt("Enter room code:")`, validates 6 chars, then joins
   - **PUBLIC LOBBY** — joins or creates a public room, auto-starts with 2+ players after 20s

A "← BACK" link below to return to mode select.

**Remove the room-code-input text field entirely from the UI.** The prompts replace it. This simplifies the flow drastically.

#### Stage 3 — Lobby (after room joined)

- `#mp-setup` → hide
- `#mp-lobby` → show (flex)
- Shows room code prominently with "click to copy"
- Shows share link: `yourdomain.com?room=XXXXXX`
- Shows countdown timer (20s, starts when 2nd player joins)
- Shows player list with colored dots and names
- "LEAVE" button to go back

When the server fires `session_started`, the lobby hides and the game launches.

---

## 2. MULTIPLAYER GAME DESIGN

### 2.1 Spawn positions

All players spawn in the same tunnel at the same Z position (z=0). They are spread across X and Y so they don't overlap:

```javascript
// Spawn spread based on player index in room (0..7)
function getSpawnOffset(playerIndex, totalPlayers) {
  const angle = (playerIndex / totalPlayers) * Math.PI * 2;
  const r = totalPlayers > 1 ? 6 : 0;
  return { x: Math.cos(angle) * r, y: Math.sin(angle) * r * 0.6 };
}
```

The local player's ship spawns at that offset. `shipAnchor.position.set(offset.x, offset.y, 0)` and `shipTarget.set(offset.x, offset.y, 0)` at run start.

### 2.2 Shared tunnel, independent physics

All players fly through the same procedurally generated tunnel. The tunnel seed is based on room code so all clients generate identical obstacle layouts. 

**How to sync tunnel seed:**
- Server sends `seed` in `session_started` event
- Client uses `rng32(seed)` instead of `rng32(Date.now())` for obstacle spawning
- This means all players see identical obstacles

### 2.3 Player visibility

Other players render as colored ships with name tags. **No white flash, no glow, no screen effect** when near other players. Pure mesh visibility only.

Other player ship appearance:
- Cone body (same proportions as player ship but slightly smaller: scale 0.82 → 0.75)
- Color from their `color` field
- Name tag sprite above ship (same `makeNameTag` function)
- A small colored dot under the ship for easy identification

Distance culling: only render other players if `Math.abs(otherZ - myZ) < 800`. Beyond that, skip the mesh position update (don't remove mesh, just don't update).

**CRITICAL:** The local player's own ship is never affected by other players' positions. No collision, no slowdown, no visual effect from proximity.

### 2.4 PvP shooting

When the local player fires a bullet:
1. Local bullet is created as normal (existing Bullet class, yellow)
2. Server receives `bullet_fired` with position and direction
3. Server does **server-authoritative hit detection** using the `linePointDistance` function already in server.js
4. If a hit is confirmed, server emits `player_hit` to all players
5. Client receiving `player_hit` shows damage effect on the victim's ship (brief red flash on their mesh material)
6. Client receiving `player_eliminated` shows kill feed entry

**Damage:** Each hit deals 10 HP (existing server logic). Player starts at 100 HP. At 0 HP, `player_eliminated` fires. Eliminated player respawns after 3 seconds at their original spawn position.

**Respawn:**
- Server sends `respawn` event to the eliminated player's socket
- Client receiving `respawn` moves `shipAnchor` back to spawn offset position
- Brief white flash (existing `flashWhite` function, opacity 0.12, 100ms)
- 1.5s of invulnerability after respawn (invuln timer)

**NO PvP BULLET VISUALS ON CLIENT:** Do not render incoming bullets from other players. Only the shooter sees their own bullet. This avoids interpolation jank. Just apply the damage effect when server confirms hit.

### 2.5 Speed and the leaderboard

The leaderboard ranks players by **furthest Z position** (most negative Z = furthest ahead). This is the primary ranking metric. Secondary: kills.

The HUD leaderboard shows:
```
#1  🚀 pilotname    ⚔3  -2450m
#2  🐢 otherpilot   ⚔1  -2200m  ← YOU (highlighted)
#3  ✖  deadpilot    ⚔0  -1800m
```

- Rank by Z position (most negative = furthest ahead = rank 1)
- Show kill count
- Show distance (rounded to 10m)
- "YOU" row highlighted with yellow border
- Dead players shown at 35% opacity with ✖ prefix
- Update every 500ms from `room_state` broadcast

The server broadcasts `room_state` every 2 seconds during active game. Client also updates leaderboard on every `player_state` event received (real-time position tracking).

### 2.6 AI bots (cores) in multiplayer

**Host is authoritative for cores.** The host client (first player to create the room) spawns cores normally via existing game logic. When a core spawns, host emits `core_spawn` to server. Server relays to non-host clients. Non-host clients render the cores but cannot spawn them.

When any player shoots a core:
1. Local bullet collision detection fires (existing code)
2. Client emits `core_destroyed` with core ID to server
3. Server broadcasts `core_destroyed` to all clients
4. All clients remove that core mesh and increment their local `coresDestroyed`
5. Escape time reduction is applied on all clients

**First-come-first-served:** If two players shoot the same core simultaneously, server deduplicates via `activeCores` Set (already implemented in server.js). The first `core_destroyed` wins, second is ignored.

Core IDs: when spawning, assign `group.userData.mpId = `core_${currentWaveId}_${index}`` and use this as the ID for network events.

### 2.7 Portal in multiplayer

- Portal unlock condition is synced: once the host triggers portal unlock (via timer or cores), the host emits a `portal_unlocked` event to the server, which broadcasts to all clients
- All clients unlock their portal simultaneously
- When a player escapes through the portal, they emit `portal_escape` and redirect to vibej.am individually
- Other players can continue playing and escaping until session ends
- Session ends when all players have either escaped or 180s is up

---

## 3. TECHNICAL ARCHITECTURE

### 3.1 File changes required

**`server.js` — refactor required:**
- Keep existing event handlers but fix the issues listed in Section 4
- Add `seed` to `session_started` payload
- Add `portal_unlocked` event handler + broadcast
- Fix `player_state` → currently relays fine, keep it
- Fix `bullet_fired` → currently server-authoritative, keep it but fix hit radius (current 2.4 is too small, use 3.5)
- Add respawn handler: after `player_eliminated`, schedule a 3s timeout then emit `respawn` to the eliminated socket and `respawn_broadcast` to the room
- Remove the `speedLane` field entirely — it's not used in the new design

**`main.js` — additions required (no existing code deleted):**
- Add MP state variables block (see Section 5.1)
- Replace intro screen HTML in `app.innerHTML` (see Section 5.2)
- Replace `G.introForm` event listener block with full mode-select wiring (see Section 5.3)
- Add `initSocket()` function and all socket handlers (see Section 5.4)
- Modify `spawnCore()` to assign `mpId` and emit `core_spawn` if host (see Section 5.5)
- Modify `updateCores()` bullet collision to emit `core_destroyed` in MP mode (see Section 5.5)
- Add `updateOtherPlayer()` and `removeMpPlayer()` functions (see Section 5.6)
- Modify `beginRun()` to accept `{ speedMult, seed }` params (see Section 5.7)
- Modify `resetRun()` to clear `otherPlayers` map (see Section 5.7)
- Add `getShipPosition()`, `getShipRotation()`, `getSurvivalTime()`, `isHittable()` getters to buildThreeApp return (see Section 5.7)
- Modify `tick()` to broadcast `player_state` every 50ms and update leaderboard (see Section 5.8)

**`style.css` — no changes needed.** All required CSS already exists.

**`index.html` — no changes needed.** Socket.io CDN already present.

### 3.2 Module scope variables

The following variables must be module-scope (outside all functions) in `main.js`:

```javascript
// ── MP state (add after existing let declarations) ──────────────
const SOCKET_URL = 'https://YOUR-RAILWAY-URL.up.railway.app';

let socket         = null;       // Socket.io connection
let mpMode         = false;      // true when in a multiplayer session
let myRoomCode     = null;       // current room code
let amHost         = false;      // true if this client created the room
let mySpawnOffset  = { x: 0, y: 0 }; // spawn X/Y for this player
let otherPlayers   = new Map();  // socketId → { mesh, nameTag, data }
let posInterval    = null;       // setInterval for position broadcast
let mpRoomState    = { players: [] }; // latest room_state from server
let lbTickInterval = null;       // leaderboard update interval
let _mpSpeedMult   = 1.0;        // applied in tick() to getSpeed()
let _mpSeed        = null;       // tunnel/obstacle seed from server
```

---

## 4. COMPLETE SOCKET EVENT PROTOCOL

This is the definitive event contract. Both server.js and main.js must use exactly these event names and payloads.

### Client → Server

| Event | Payload | When |
|---|---|---|
| `create_room` | `{ name, color, code? }` | Player clicks CREATE ROOM |
| `join_room` | `{ code, name, color }` | Player clicks JOIN ROOM |
| `join_public` | `{ name, color }` | Player clicks PUBLIC LOBBY |
| `player_state` | `{ x, y, z, rotZ, survivalTime, alive }` | Every 50ms during active game |
| `bullet_fired` | `{ x, y, z, dx, dy, dz }` | On each shot |
| `core_spawn` | `{ id, x, y, z, waveId, index }` | Host only, when core spawns |
| `core_destroyed` | `{ id }` | When bullet hits a core |
| `portal_unlocked` | `{}` | Host only, when portal unlocks |
| `portal_escape` | `{ survivalTime }` | When player exits portal |

### Server → Client

| Event | Payload | When |
|---|---|---|
| `room_created` | `{ code }` | After create_room |
| `room_joined` | `{ code }` | After join_room or join_public |
| `public_joined` | `{ code }` | After join_public |
| `room_role` | `{ isHost }` | After join, and on host transfer |
| `room_state` | `{ code, status, host, players[], startAt, sessionEnd }` | On state change, every 2s during active |
| `join_error` | `string message` | When join fails |
| `countdown_started` | `{ startAt }` | When 2nd player joins public room |
| `session_started` | `{ sessionEnd, seed, players[] }` | Game begins |
| `session_ended` | `{ standings[] }` | 180s elapsed |
| `player_state` | `{ id, name, color, x, y, z, rotZ, survivalTime, alive }` | Relayed from other players |
| `player_hit` | `{ victimId, health, shooterId }` | Bullet hit, victim survives |
| `player_eliminated` | `{ killerId, killerName, victimId, victimName }` | Bullet kill |
| `respawn` | `{ x, y }` | 3s after elimination, to victim only |
| `core_spawn` | `{ id, x, y, z, waveId, index }` | Relayed from host to non-hosts |
| `core_destroyed` | `{ id, by }` | Core killed, broadcast to all |
| `portal_unlocked` | `{}` | Broadcast to all when host unlocks portal |
| `player_escaped` | `{ id, name, survivalTime }` | Broadcast when someone escapes |
| `player_left` | `{ id }` | On disconnect |

### players[] shape in room_state and session_started

```javascript
{
  id: string,           // socket id
  name: string,
  color: string,        // hex color
  kills: number,
  deaths: number,
  alive: boolean,
  escaped: boolean,
  health: number,       // 0..100
  survivalTime: number, // seconds
  z: number,            // current Z position (for leaderboard ranking)
}
```

### session_started additional fields

```javascript
{
  sessionEnd: number,   // epoch ms
  seed: number,         // integer, use as rng32(seed) for obstacle spawning
  players: [...],       // same shape as room_state players
  spawnOffsets: [       // array of {id, x, y} — one per player
    { id: socketId, x: number, y: number }
  ]
}
```

The server computes `spawnOffsets` at session start:

```javascript
// In server.js startSession():
const playerList = Array.from(room.players.values());
const spawnOffsets = playerList.map((p, i) => ({
  id: p.id,
  x: playerList.length > 1 ? Math.cos((i / playerList.length) * Math.PI * 2) * 6 : 0,
  y: playerList.length > 1 ? Math.sin((i / playerList.length) * Math.PI * 2) * 3.6 : 0,
}));
const seed = Math.floor(Math.random() * 0xFFFFFFFF);
room.seed = seed;
io.to(code).emit("session_started", { sessionEnd: room.sessionEnd, seed, players: playerList, spawnOffsets });
```

---

## 5. IMPLEMENTATION DETAILS

### 5.1 Intro screen HTML replacement

In `app.innerHTML`, find the `<!-- Intro -->` comment and replace the entire `<div id="intro-screen">` block with:

```html
<!-- Intro -->
<div id="intro-screen" class="intro-screen">
  <img class="logo-mark" src="/logo.png" alt="SKYBREAK" onerror="this.style.display='none'"/>
  <h1 class="game-title">SKYBREAK</h1>
  <p class="game-subtitle">AI REALITY COLLAPSE</p>
  <div id="intro-label" class="intro-label"></div>

  <!-- Stage 1: Mode select (shown by default) -->
  <div id="mode-select" class="mode-select">
    <button id="btn-solo" class="mode-btn mode-btn--solo">
      <div class="mode-btn-icon">▶</div>
      <div class="mode-btn-title">SOLO</div>
      <div class="mode-btn-desc">Face the AI alone</div>
    </button>
    <button id="btn-multi" class="mode-btn mode-btn--multi">
      <div class="mode-btn-icon">⚔</div>
      <div class="mode-btn-title">MULTIPLAYER</div>
      <div class="mode-btn-desc">Fight other pilots</div>
    </button>
  </div>

  <!-- Stage 2A: Solo -->
  <div id="intro-hint" class="intro-hint" style="display:none">
    <div class="intro-title">SYSTEM BREACH</div>
    <div class="intro-narrative">SHOOT AI BOTS TO BREAK THE LOCK EARLY.</div>
    <div class="intro-narrative accent">REACH THE PORTAL BEFORE THE VOID TAKES YOU.</div>
    <div id="intro-controls-hint" class="intro-key">
      <!-- Populated by JS based on device -->
    </div>
  </div>
  <form id="intro-form" class="intro-form" style="display:none">
    <input id="intro-input" class="intro-input" type="text"
      placeholder="enter pilot name... or leave blank" maxlength="16"
      autocomplete="off" autocapitalize="none" autocorrect="off" spellcheck="false">
    <button type="submit" class="intro-button">ENTER THE VOID</button>
    <button type="button" id="btn-back-solo" style="background:none;border:none;color:rgba(0,255,255,0.35);font-family:var(--mono);font-size:0.7rem;letter-spacing:0.1em;cursor:pointer;margin-top:-0.3rem;">← BACK</button>
  </form>

  <!-- Stage 2B: Multiplayer -->
  <div id="mp-setup" class="mp-setup" style="display:none">
    <input id="mp-name" class="intro-input" type="text"
      placeholder="pilot name (optional)" maxlength="16"
      autocomplete="off" autocapitalize="none" autocorrect="off" spellcheck="false">
    <div class="mp-room-buttons">
      <button id="btn-create-room" class="mode-btn" style="min-width:130px; padding:1rem 1.2rem;">
        <div class="mode-btn-icon" style="font-size:1.4rem;">+</div>
        <div class="mode-btn-title" style="font-size:0.82rem;">CREATE ROOM</div>
        <div class="mode-btn-desc">Custom code</div>
      </button>
      <button id="btn-join-room" class="mode-btn" style="min-width:130px; padding:1rem 1.2rem;">
        <div class="mode-btn-icon" style="font-size:1.4rem;">→</div>
        <div class="mode-btn-title" style="font-size:0.82rem;">JOIN ROOM</div>
        <div class="mode-btn-desc">Enter code</div>
      </button>
      <button id="btn-public" class="mode-btn mode-btn--multi" style="min-width:130px; padding:1rem 1.2rem;">
        <div class="mode-btn-icon" style="font-size:1.4rem;">⚡</div>
        <div class="mode-btn-title" style="font-size:0.82rem;">PUBLIC</div>
        <div class="mode-btn-desc">Auto-match</div>
      </button>
    </div>
    <div id="mp-status" style="font-size:0.72rem;letter-spacing:0.12em;color:rgba(0,255,255,0.45);text-align:center;min-height:1.4em;"></div>
    <button type="button" id="btn-back-mp" style="background:none;border:none;color:rgba(0,255,255,0.35);font-family:var(--mono);font-size:0.7rem;letter-spacing:0.1em;cursor:pointer;">← BACK</button>
  </div>

  <!-- Stage 3: Lobby -->
  <div id="mp-lobby" class="mp-lobby" style="display:none">
    <div class="lobby-title">WAITING FOR PILOTS</div>
    <div class="room-display" style="cursor:pointer;" id="lobby-code-display">
      ROOM CODE: <strong id="lobby-room-code" class="room-code-big"></strong>
      <span id="lobby-copy-hint" class="room-copy-hint"> · click to copy</span>
    </div>
    <div id="lobby-share-link" class="lobby-share-link"></div>
    <div id="lobby-countdown" class="lobby-countdown">—</div>
    <div id="lobby-players" class="lobby-players"></div>
    <div id="lobby-status" class="lobby-hint">Waiting for players... share the code above</div>
    <button id="btn-lobby-cancel" class="death-btn death-btn--quit" style="margin-top:0.5rem">LEAVE</button>
  </div>

  <p class="creator-credit">made by ai, prompted by
    <a href="https://x.com/AlphaGoat2711" target="_blank">@AlphaGoat2711</a> · vibe jam 2026</p>
  <p class="github-link">
    <a href="https://github.com/AlphaTheGoat27/skybreak" target="_blank">open source on github</a>
  </p>
</div>

<!-- MP overlays — outside intro-screen, always in DOM -->
<div id="mp-leaderboard" class="mp-leaderboard">
  <div class="mp-lb-title">LIVE STANDINGS</div>
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
      <button id="mp-end-quit" class="death-btn death-btn--quit">QUIT TO JAM</button>
    </div>
  </div>
</div>
```

Add this CSS to style.css (`.mp-room-buttons`):

```css
.mp-room-buttons {
  display: flex;
  gap: 0.8rem;
  flex-wrap: wrap;
  justify-content: center;
}
```

### 5.2 Typewriter system changes

The existing typewriter runs once on load with a fixed string. It needs to be:
1. Cancellable (so Stage 1→2 transition can restart it)
2. Runnable with a custom string

Replace the existing typewriter block with:

```javascript
let typeInterval = null;
function runTypewriter(text, targetEl) {
  if (typeInterval) clearInterval(typeInterval);
  if (!targetEl) return;
  targetEl.textContent = '';
  targetEl.classList.add('is-typing');
  let idx = 0;
  typeInterval = setInterval(() => {
    idx++;
    targetEl.textContent = text.slice(0, idx);
    if (idx >= text.length) {
      clearInterval(typeInterval);
      typeInterval = null;
      targetEl.classList.remove('is-typing');
    }
  }, 38);
}

// Run on page load — Stage 1 text
runTypewriter("SELECT MODE", G.introLabel);
```

Then in the button handlers:

```javascript
// When SOLO clicked:
runTypewriter("identify yourself. or don't. i'll find out anyway.", G.introLabel);

// When MULTIPLAYER clicked:
runTypewriter("identify yourself. or don't. i'll find out anyway.", G.introLabel);
```

### 5.3 Mode select wiring (complete replacement of event listener block)

Find `G.introForm.addEventListener("submit", ...)` and replace everything from there up to (but not including) the `Bullet` class with:

```javascript
// ── G refs additions ──────────────────────────────────────────────
// Add these to the G object:
// modeSelect, btnSolo, btnMulti, introHint, introControlsHint,
// mpSetup, mpName, btnCreate, btnJoin, btnPublic, mpStatus,
// btnBackSolo, btnBackMp, mpLobby, lobbyRoomCode, lobbyCopyHint,
// lobbyCodeDisplay, lobbyCountdown, lobbyPlayers, lobbyStatus,
// btnLobbyCancel, mpLeaderboard, respawnOverlay, mpEndScreen

// All IDs already exist in the HTML above. Add them to G:
Object.assign(G, {
  modeSelect:         document.getElementById('mode-select'),
  btnSolo:            document.getElementById('btn-solo'),
  btnMulti:           document.getElementById('btn-multi'),
  introHint:          document.getElementById('intro-hint'),
  introControlsHint:  document.getElementById('intro-controls-hint'),
  mpSetup:            document.getElementById('mp-setup'),
  mpName:             document.getElementById('mp-name'),
  btnCreate:          document.getElementById('btn-create-room'),
  btnJoin:            document.getElementById('btn-join-room'),
  btnPublic:          document.getElementById('btn-public'),
  mpStatus:           document.getElementById('mp-status'),
  btnBackSolo:        document.getElementById('btn-back-solo'),
  btnBackMp:          document.getElementById('btn-back-mp'),
  mpLobby:            document.getElementById('mp-lobby'),
  lobbyRoomCode:      document.getElementById('lobby-room-code'),
  lobbyCopyHint:      document.getElementById('lobby-copy-hint'),
  lobbyCodeDisplay:   document.getElementById('lobby-code-display'),
  lobbyCountdown:     document.getElementById('lobby-countdown'),
  lobbyPlayers:       document.getElementById('lobby-players'),
  lobbyStatus:        document.getElementById('lobby-status'),
  btnLobbyCancel:     document.getElementById('btn-lobby-cancel'),
  mpLeaderboard:      document.getElementById('mp-leaderboard'),
  respawnOverlay:     document.getElementById('respawn-overlay'),
  mpEndScreen:        document.getElementById('mp-end-screen'),
});

// ── Helper: populate controls hint ───────────────────────────────
function populateControlsHint() {
  if (!G.introControlsHint) return;
  const isTouch = 'ontouchstart' in window || window.innerWidth < 768;
  if (isTouch) {
    G.introControlsHint.innerHTML = '<span>LEFT HALF = MOVE</span><span>RIGHT HALF = SHOOT</span><span>PINK BOT = SHOOT IT</span>';
  } else {
    G.introControlsHint.innerHTML = '<span>WASD = MOVE</span><span>MOUSE = AIM</span><span>SPACE/CLICK = SHOOT</span><span>PINK BOT = SHOOT IT</span>';
  }
}

// ── Back to mode select ───────────────────────────────────────────
function showModeSelect() {
  if (G.modeSelect)  G.modeSelect.style.display  = 'flex';
  if (G.introHint)   G.introHint.style.display   = 'none';
  if (G.introForm)   G.introForm.style.display   = 'none';
  if (G.mpSetup)     G.mpSetup.style.display     = 'none';
  if (G.mpLobby)     G.mpLobby.style.display     = 'none';
  runTypewriter("SELECT MODE", G.introLabel);
}

G.btnBackSolo?.addEventListener('click', showModeSelect);
G.btnBackMp?.addEventListener('click', () => {
  socket?.disconnect(); socket = null;
  showModeSelect();
});

// ── SOLO button ───────────────────────────────────────────────────
G.btnSolo?.addEventListener('click', () => {
  G.modeSelect.style.display = 'none';
  G.introHint.style.display  = 'flex';
  G.introForm.style.display  = 'flex';
  populateControlsHint();
  runTypewriter("identify yourself. or don't. i'll find out anyway.", G.introLabel);
  setTimeout(() => G.introInput.focus(), 50);
});

// ── MULTIPLAYER button ────────────────────────────────────────────
G.btnMulti?.addEventListener('click', () => {
  G.modeSelect.style.display = 'none';
  G.mpSetup.style.display    = 'flex';
  runTypewriter("identify yourself. or don't. i'll find out anyway.", G.introLabel);
  initSocket();
  setTimeout(() => G.mpName?.focus(), 50);
});

// ── MP: CREATE ROOM ───────────────────────────────────────────────
G.btnCreate?.addEventListener('click', async () => {
  if (!socket?.connected) {
    if (G.mpStatus) G.mpStatus.textContent = 'connecting to server...';
    return;
  }
  const customCode = window.prompt('Custom room code (leave blank for random, max 6 chars):') || '';
  const name = G.mpName?.value.trim();
  const color = pickMpColor();
  if (G.mpStatus) G.mpStatus.textContent = 'creating room...';
  socket.emit('create_room', { name, color, code: customCode.toUpperCase().slice(0, 6) });
});

// ── MP: JOIN ROOM ─────────────────────────────────────────────────
G.btnJoin?.addEventListener('click', () => {
  if (!socket?.connected) {
    if (G.mpStatus) G.mpStatus.textContent = 'connecting...';
    return;
  }
  const code = window.prompt('Enter room code:');
  if (!code || code.trim().length < 4) return;
  const name = G.mpName?.value.trim();
  const color = pickMpColor();
  if (G.mpStatus) G.mpStatus.textContent = `joining ${code.toUpperCase()}...`;
  socket.emit('join_room', { code: code.trim().toUpperCase(), name, color });
});

// ── MP: PUBLIC LOBBY ──────────────────────────────────────────────
G.btnPublic?.addEventListener('click', () => {
  if (!socket?.connected) {
    if (G.mpStatus) G.mpStatus.textContent = 'connecting...';
    return;
  }
  const name = G.mpName?.value.trim();
  const color = pickMpColor();
  if (G.mpStatus) G.mpStatus.textContent = 'finding public lobby...';
  socket.emit('join_public', { name, color });
});

// ── Lobby: copy code ──────────────────────────────────────────────
G.lobbyCodeDisplay?.addEventListener('click', () => {
  const code = G.lobbyRoomCode?.textContent;
  if (!code) return;
  navigator.clipboard?.writeText(code);
  if (G.lobbyCopyHint) {
    G.lobbyCopyHint.textContent = ' · copied!';
    setTimeout(() => { G.lobbyCopyHint.textContent = ' · click to copy'; }, 2000);
  }
});

// ── Lobby: leave ─────────────────────────────────────────────────
G.btnLobbyCancel?.addEventListener('click', () => {
  socket?.disconnect(); socket = null;
  myRoomCode = null; amHost = false;
  G.mpLobby.style.display = 'none';
  showModeSelect();
});

// ── Auto-fill ?room= from URL ─────────────────────────────────────
const _urlRoom = new URLSearchParams(location.search).get('room');
if (_urlRoom) {
  setTimeout(() => {
    G.btnMulti?.click();
    setTimeout(() => {
      if (G.mpStatus) G.mpStatus.textContent = `joining ${_urlRoom.toUpperCase()}...`;
      socket?.emit('join_room', { code: _urlRoom.toUpperCase(), name: '', color: pickMpColor() });
    }, 800);
  }, 400);
}

function pickMpColor() {
  const c = ['#00ffff','#ff00ff','#ffff00','#00ff88','#ff6600','#88aaff','#ff4488','#44ffbb'];
  return c[Math.floor(Math.random() * c.length)];
}

// ── Solo form ─────────────────────────────────────────────────────
G.introForm?.addEventListener("submit", e => { e.preventDefault(); startGame(); });
window.addEventListener("keydown", e => {
  if (e.key === "Enter" && !hasStarted && document.activeElement === G.introInput) {
    e.preventDefault(); startGame();
  }
});
```

### 5.4 initSocket() — complete implementation

Add this entire block before the `Bullet` class definition:

```javascript
// ═══════════════════════════════════════════════════════════════════
// SOCKET.IO CLIENT
// ═══════════════════════════════════════════════════════════════════
let _lobbyCountdownInterval = null;

function initSocket() {
  if (socket?.connected) return;
  socket = io(SOCKET_URL, { transports: ['websocket'] });

  socket.on('connect', () => {
    if (G.mpStatus) G.mpStatus.textContent = 'connected.';
    if (G.btnCreate) G.btnCreate.querySelector('.mode-btn-desc').textContent = 'Custom code';
  });

  socket.on('connect_error', () => {
    if (G.mpStatus) G.mpStatus.textContent = 'server waking up... retry in 4s';
    setTimeout(() => { if (!socket?.connected) initSocket(); }, 4000);
  });

  socket.on('join_error', (msg) => {
    if (G.mpStatus) G.mpStatus.textContent = `error: ${msg}`;
  });

  socket.on('room_role', ({ isHost }) => {
    amHost = isHost;
  });

  function enterLobby(code) {
    myRoomCode = code;
    if (G.mpSetup)  G.mpSetup.style.display  = 'none';
    if (G.mpLobby)  G.mpLobby.style.display  = 'flex';
    if (G.lobbyRoomCode) G.lobbyRoomCode.textContent = code;
    // Build share link
    const shareLinkEl = document.getElementById('lobby-share-link');
    if (shareLinkEl) {
      const link = `${location.origin}${location.pathname}?room=${code}`;
      shareLinkEl.textContent = link;
      shareLinkEl.onclick = () => {
        navigator.clipboard?.writeText(link);
        shareLinkEl.textContent = 'COPIED!';
        setTimeout(() => { shareLinkEl.textContent = link; }, 2000);
      };
    }
  }

  socket.on('room_created', ({ code }) => { enterLobby(code); });
  socket.on('room_joined',  ({ code }) => { enterLobby(code); });
  socket.on('public_joined',({ code }) => { enterLobby(code); });

  socket.on('room_state', (state) => {
    mpRoomState = state;
    renderLobbyPlayers(state.players);
    if (mpMode) updateLeaderboard();
  });

  socket.on('countdown_started', ({ startAt }) => {
    if (_lobbyCountdownInterval) clearInterval(_lobbyCountdownInterval);
    if (G.lobbyStatus) G.lobbyStatus.textContent = 'Game starting soon...';
    _lobbyCountdownInterval = setInterval(() => {
      const left = Math.max(0, Math.ceil((startAt - Date.now()) / 1000));
      if (G.lobbyCountdown) G.lobbyCountdown.textContent = `${left}s`;
      if (left <= 0) clearInterval(_lobbyCountdownInterval);
    }, 200);
  });

  socket.on('session_started', ({ sessionEnd, seed, players, spawnOffsets }) => {
    mpMode = true;
    _mpSeed = seed;

    // Find my spawn offset
    const myOffset = spawnOffsets?.find(s => s.id === socket.id);
    mySpawnOffset = myOffset ? { x: myOffset.x, y: myOffset.y } : { x: 0, y: 0 };

    // Set player name from mp-name field if not already set
    if (!PLAYER_NAME || PLAYER_NAME === '') {
      PLAYER_NAME = (G.mpName?.value.trim() || '').replace(/[^a-zA-Z0-9_\-]/g, '').slice(0, 16)
                    || ('pilot_' + socket.id.slice(0, 4));
    }

    launchMpGame(sessionEnd, players);
  });

  // Other player positions
  socket.on('player_state', (data) => {
    if (data.id === socket.id) return; // ignore own echo
    updateOtherPlayer(data);
  });

  // PvP hit (not eliminated, just damaged)
  socket.on('player_hit', ({ victimId, health, shooterId }) => {
    if (victimId === socket.id) {
      // I was hit — brief red vignette only, no flash
      G.damageFlash?.classList.add('is-active');
      setTimeout(() => G.damageFlash?.classList.remove('is-active'), 150);
    } else {
      // Another player was hit — brief red flash on their ship mesh
      const entry = otherPlayers.get(victimId);
      if (entry?.mesh) flashOtherShip(entry.mesh, '#ff2244');
    }
    updateLeaderboard();
  });

  // PvP kill
  socket.on('player_eliminated', ({ killerId, killerName, victimId, victimName }) => {
    const isMe = victimId === socket.id;
    const iKilled = killerId === socket.id;
    if (iKilled) {
      aiTroll?.pushLine(`${victimName} eliminated.`);
      addKillFeedEntry(`YOU → ${victimName}`, '#ffff00');
    } else if (isMe) {
      addKillFeedEntry(`${killerName} → YOU`, '#ff0044');
    } else {
      addKillFeedEntry(`${killerName} → ${victimName}`, '#ff6688');
    }
    // Hide eliminated player's ship briefly
    const entry = otherPlayers.get(victimId);
    if (entry?.mesh) entry.mesh.visible = false;
    updateLeaderboard();
  });

  // Respawn (sent only to the eliminated player)
  socket.on('respawn', ({ x, y }) => {
    // Move my ship back to spawn
    if (threeApp) {
      threeApp.forceRespawn(x ?? mySpawnOffset.x, y ?? mySpawnOffset.y);
    }
    G.respawnOverlay?.classList.remove('is-visible');
    // Show respawn overlay briefly
    G.respawnOverlay?.classList.add('is-visible');
    setTimeout(() => G.respawnOverlay?.classList.remove('is-visible'), 400);
  });

  // Core sync (non-host receives cores from host)
  socket.on('core_spawn', (coreData) => {
    if (amHost) return; // host already spawned it locally
    // Non-host: create the core at the given position
    if (typeof spawnCoreAtPosition === 'function') {
      spawnCoreAtPosition(coreData);
    }
  });

  socket.on('core_destroyed', ({ id, by }) => {
    // Remove core with this mpId from the local cores array
    const idx = cores.findIndex(c => c.mesh.userData.mpId === id);
    if (idx !== -1) {
      _scene.remove(cores[idx].mesh);
      cores.splice(idx, 1);
      coresDestroyed = Math.min(coresDestroyed + 1, CFG.AI_BOTS_FOR_INSTANT_WIN);
      escapeTimeNeeded = Math.max(CFG.MIN_ESCAPE_TIME, CFG.BASE_ESCAPE_TIME - coresDestroyed * CFG.TIME_REDUCTION_PER_AI_BOT);
      disruptMeter = THREE.MathUtils.clamp(coresDestroyed / CFG.AI_BOTS_FOR_INSTANT_WIN, 0, 1);
      if (by === socket.id) {
        aiTroll?.onCoreDestroyed(coresDestroyed, CFG.AI_BOTS_FOR_INSTANT_WIN);
      }
      if (coresDestroyed >= CFG.AI_BOTS_FOR_INSTANT_WIN && !portalUnlocked) {
        if (amHost) socket.emit('portal_unlocked', {});
        unlockPortal(coresDestroyed);
      }
    }
  });

  socket.on('portal_unlocked', () => {
    if (!portalUnlocked) unlockPortal(coresDestroyed);
  });

  socket.on('player_escaped', ({ id, name, survivalTime }) => {
    addKillFeedEntry(`${name || 'pilot'} ESCAPED · ${(survivalTime || 0).toFixed(1)}s`, '#00ffff');
    // Hide their ship
    const entry = otherPlayers.get(id);
    if (entry?.mesh) entry.mesh.visible = false;
  });

  socket.on('session_ended', ({ standings }) => {
    showMpEndScreen(standings);
  });

  socket.on('player_left', ({ id }) => {
    removeMpPlayer(id);
    addKillFeedEntry('a pilot disconnected', 'rgba(255,255,255,0.25)');
  });
}

// ── Lobby rendering ───────────────────────────────────────────────
function renderLobbyPlayers(players) {
  if (!G.lobbyPlayers) return;
  G.lobbyPlayers.innerHTML = players.map(p => `
    <div class="lobby-player-row">
      <div class="lobby-player-dot" style="background:${p.color}"></div>
      <div class="lobby-player-name">${p.name}</div>
      <div class="lobby-player-hint">${p.id === socket?.id ? '(you)' : ''}</div>
    </div>`).join('');
  if (G.lobbyStatus) {
    G.lobbyStatus.textContent = players.length < 2
      ? 'Waiting for another pilot...'
      : `${players.length} pilots ready`;
  }
}

// ── Launch MP game ────────────────────────────────────────────────
function launchMpGame(sessionEnd, players) {
  if (G.mpLobby) G.mpLobby.style.display = 'none';
  hasStarted = true;

  if (!aiTroll) aiTroll = new AITroll(G.aiBox, G.aiMsg, PLAYER_NAME);
  else aiTroll.setPilot(PLAYER_NAME);

  if (!threeApp) { threeApp = buildThreeApp(G.gameLayer); threeApp.start(); }

  threeApp.beginRun({ multiplayer: true, speedMult: _mpSpeedMult, seed: _mpSeed, spawnX: mySpawnOffset.x, spawnY: mySpawnOffset.y });

  G.hud.classList.add('is-active');
  G.introScreen.classList.add('is-fading');
  setTimeout(() => G.introScreen.classList.add('is-gone'), 500);
  setTimeout(() => aiTroll.pushFirstLine(true), 700);

  if (G.mpLeaderboard) G.mpLeaderboard.classList.add('is-visible');
  if ('ontouchstart' in window) { G.shootHint?.classList.add('is-visible'); showMobileTutorial(); }

  // Initialize other players
  if (players) {
    for (const p of players) {
      if (p.id !== socket.id) {
        updateOtherPlayer({ ...p, x: 0, y: 0, z: 0, rotZ: 0 });
      }
    }
  }

  startPosBroadcast();
  startMpSessionTimer(sessionEnd);
}

// ── Position broadcast ────────────────────────────────────────────
function startPosBroadcast() {
  if (posInterval) clearInterval(posInterval);
  posInterval = setInterval(() => {
    if (!socket?.connected || !threeApp || !mpMode) return;
    const pos = threeApp.getShipPosition();
    const rot = threeApp.getShipRotation();
    socket.emit('player_state', {
      x: pos.x, y: pos.y, z: pos.z,
      rotZ: rot.z,
      survivalTime: threeApp.getSurvivalTime(),
      alive: true,
    });
  }, 50);
}

function stopPosBroadcast() {
  if (posInterval) clearInterval(posInterval);
  posInterval = null;
}

// ── Kill feed ─────────────────────────────────────────────────────
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

// ── Leaderboard ───────────────────────────────────────────────────
function startMpSessionTimer(sessionEnd) {
  if (lbTickInterval) clearInterval(lbTickInterval);
  lbTickInterval = setInterval(() => {
    const left = Math.max(0, Math.floor((sessionEnd - Date.now()) / 1000));
    const el = document.getElementById('mp-session-timer');
    if (el) el.textContent = `${Math.floor(left / 60)}:${(left % 60).toString().padStart(2, '0')}`;
    updateLeaderboard();
    if (left <= 0) clearInterval(lbTickInterval);
  }, 500);
}

function updateLeaderboard() {
  const list = document.getElementById('mp-lb-list');
  if (!list) return;
  // Merge server state with local player's actual Z
  const localZ = threeApp ? threeApp.getShipPosition().z : 0;
  const players = mpRoomState.players.map(p =>
    p.id === socket?.id
      ? { ...p, z: localZ, survivalTime: threeApp?.getSurvivalTime() ?? p.survivalTime }
      : p
  );
  // Sort by Z (most negative = furthest ahead = rank 1)
  const sorted = [...players].sort((a, b) => (a.z ?? 0) - (b.z ?? 0));
  list.innerHTML = sorted.map((p, i) => {
    const isMe = p.id === socket?.id;
    const dist = Math.abs(Math.round((p.z ?? 0) / 10) * 10);
    return `<div class="mp-lb-row ${isMe ? 'is-you' : ''} ${!p.alive ? 'is-dead' : ''}">
      <span class="mp-lb-rank">#${i + 1}</span>
      <span class="mp-lb-name" style="color:${p.color}">${p.escaped ? '🏆' : p.alive ? '' : '✖'} ${p.name}</span>
      <span class="mp-lb-kills">⚔${p.kills}</span>
      <span class="mp-lb-time">${dist}m</span>
    </div>`;
  }).join('');
}

// ── MP end screen ─────────────────────────────────────────────────
function showMpEndScreen(standings) {
  stopPosBroadcast();
  if (lbTickInterval) clearInterval(lbTickInterval);
  const myRank = standings.findIndex(p => p.id === socket?.id) + 1;
  const rankEl = document.getElementById('mp-end-rank');
  if (rankEl) rankEl.textContent = `YOU PLACED #${myRank} OF ${standings.length}`;
  const list = document.getElementById('mp-end-list');
  if (list) list.innerHTML = standings.map((p, i) => `
    <div class="mp-lb-row ${p.id === socket?.id ? 'is-you' : ''}">
      <span class="mp-lb-rank">#${i + 1}</span>
      <span class="mp-lb-name" style="color:${p.color}">${p.name}</span>
      <span class="mp-lb-kills">⚔${p.kills}</span>
      <span class="mp-lb-time">${(p.survivalTime || 0).toFixed(1)}s</span>
    </div>`).join('');
  G.mpEndScreen?.classList.add('is-visible');
  document.getElementById('mp-end-retry')?.addEventListener('click', () => location.reload(), { once: true });
  document.getElementById('mp-end-quit')?.addEventListener('click', () => { location.href = CFG.WEBRING_URL; }, { once: true });
}

// ── Other player meshes ───────────────────────────────────────────
function buildOtherShip(color) {
  const g = new THREE.Group();
  const col = parseInt((color || '#ff00ff').replace('#', ''), 16);
  const hull = new THREE.Mesh(
    new THREE.ConeGeometry(0.5, 4, 10),
    new THREE.MeshBasicMaterial({ color: col })
  );
  hull.rotation.x = Math.PI / 2;
  g.add(hull);
  const wing = new THREE.Mesh(
    new THREE.BoxGeometry(3.5, 0.08, 1.4),
    new THREE.MeshBasicMaterial({ color: col })
  );
  wing.position.z = 0.4;
  g.add(wing);
  // Small dot below ship for easy tracking
  const dot = new THREE.Mesh(
    new THREE.SphereGeometry(0.3, 6, 6),
    new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.7 })
  );
  dot.position.y = -1.4;
  g.add(dot);
  g.scale.setScalar(0.75);
  return g;
}

function flashOtherShip(mesh, colorHex) {
  // Brief color flash on hit — no fog, no screen effect
  mesh.traverse(child => {
    if (child.isMesh) {
      const orig = child.material.color.getHex();
      child.material.color.setStyle(colorHex);
      setTimeout(() => child.material.color.setHex(orig), 120);
    }
  });
}

function updateOtherPlayer(data) {
  if (!_scene) return;
  let entry = otherPlayers.get(data.id);
  if (!entry) {
    const group = new THREE.Group();
    const ship = buildOtherShip(data.color);
    group.add(ship);
    const tag = makeNameTag(data.name || data.id.slice(0, 6));
    tag.position.y = 3;
    group.add(tag);
    _scene.add(group);
    entry = { mesh: group, data: { ...data } };
    otherPlayers.set(data.id, entry);
  }
  entry.mesh.visible = data.alive !== false;
  // Only update position if within render distance
  const myZ = threeApp ? threeApp.getShipPosition().z : 0;
  if (Math.abs((data.z ?? 0) - myZ) < 800) {
    entry.mesh.position.set(data.x ?? 0, data.y ?? 0, data.z ?? 0);
    entry.mesh.rotation.z = data.rotZ ?? 0;
  }
  entry.data = { ...entry.data, ...data };
}

function removeMpPlayer(id) {
  const entry = otherPlayers.get(id);
  if (entry && _scene) {
    _scene.remove(entry.mesh);
    otherPlayers.delete(id);
  }
}
```

### 5.5 Core sync modifications

In `spawnCore()`, after `_scene.add(group)`, add:

```javascript
// Assign MP id
const mpId = `core_${waveId}_${index}_${Date.now()}`;
group.userData.mpId = mpId;
cores.push({ mesh: group, active: true });

// Host broadcasts core spawn to other players
if (mpMode && amHost && socket?.connected) {
  socket.emit('core_spawn', {
    id: mpId,
    x: group.position.x,
    y: group.position.y,
    z: group.position.z,
    waveId,
    index,
  });
}
```

Add a `spawnCoreAtPosition` function (called by non-hosts receiving `core_spawn` event):

```javascript
function spawnCoreAtPosition({ id, x, y, z, waveId, index }) {
  if (cores.length >= CFG.MAX_AI_BOTS) return;
  // Same as spawnCore but at a fixed position and with given id
  // Copy the mesh construction from spawnCore, then:
  group.position.set(x, y, z);
  group.userData.mpId = id;
  // ... (copy full mesh construction)
  _scene.add(group);
  cores.push({ mesh: group, active: true });
}
```

In `updateCores()`, in the bullet collision section, after `cores.splice(closestIdx, 1)`, add:

```javascript
// In MP mode: tell server about core destruction
if (mpMode && socket?.connected) {
  const mpId = closestCore.mesh.userData.mpId;
  if (mpId) socket.emit('core_destroyed', { id: mpId });
  // Don't increment coresDestroyed here in MP — wait for server echo via core_destroyed event
  return; // skip the local increment below
}
// Solo mode: increment normally
cdRef.val++;
// ... rest of existing code
```

### 5.6 beginRun() and resetRun() modifications

Find `beginRun` in `buildThreeApp` return object:

```javascript
beginRun({ fromPortal = false, referrer = null, multiplayer = false, speedMult = 1.0, seed = null, spawnX = 0, spawnY = 0 } = {}) {
  resetRun();
  _mpSpeedMult = speedMult;

  // Apply seed for obstacle spawning
  if (seed !== null) {
    spawnState.rng = rng32(seed >>> 0);
  }

  // Apply spawn offset for MP
  shipAnchor.position.set(spawnX, spawnY, 0);
  shipTarget.set(spawnX, spawnY, 0);

  isRunActive = true;
  prevTs = 0;
  aiTroll?.stopSpeech();
  speechSynthesis?.cancel();
  G.deathScreen.classList.remove('is-visible');
  G.portalArrow.classList.remove('is-visible');
  audio.start();
  if (fromPortal && referrer) buildStartPortal(portalSys, referrer, shipAnchor.position.z);
},
```

Add `forceRespawn` to the return object:

```javascript
forceRespawn(x, y) {
  shipAnchor.position.x = x;
  shipAnchor.position.y = y;
  shipTarget.x = x;
  shipTarget.y = y;
  invuln = 1.5; // 1.5s invulnerability
  health = Math.min(CFG.PLAYER_HEALTH, health + 40); // partial health restore
  updateHUD(coresDestroyed, escapeTimeNeeded);
},
```

Add getters:

```javascript
getShipPosition: () => ({ x: shipAnchor.position.x, y: shipAnchor.position.y, z: shipAnchor.position.z }),
getShipRotation: () => ({ z: shipAnchor.rotation.z }),
getSurvivalTime: () => wallTime,
getHealth: () => health,
isHittable: () => (isRunActive && !endSeq && invuln <= 0),
```

Add `let _mpSpeedMult = 1.0;` with the other run-state variables.
Add `_mpSpeedMult = 1.0;` in `resetRun()`.
Change `const spd = getSpeed(diffT)` in tick() to `const spd = getSpeed(diffT) * _mpSpeedMult;`.

In `resetRun()`, add after `aiDirector.reset()`:

```javascript
// Clear MP other players
for (const [id, entry] of otherPlayers) {
  if (entry.mesh.parent) _scene.remove(entry.mesh);
}
otherPlayers.clear();
```

### 5.7 Bullet broadcast in shoot()

Find `bullets.push(new Bullet(spawnPos, dir, target))` and add after:

```javascript
// Broadcast to server for MP hit detection
if (mpMode && socket?.connected) {
  socket.emit('bullet_fired', {
    x: spawnPos.x, y: spawnPos.y, z: spawnPos.z,
    dx: dir.x, dy: dir.y, dz: dir.z,
  });
}
```

### 5.8 Position broadcast in tick()

The `startPosBroadcast()` setInterval already handles this. No tick changes needed for position.

Add leaderboard update call at the bottom of tick(), after `updateHUD`:

```javascript
// Update MP leaderboard (only if visible and in MP mode)
if (mpMode && G.mpLeaderboard?.classList.contains('is-visible')) {
  // Leaderboard updates via interval in startMpSessionTimer
  // Also update on player_state events via socket handler
}
```

---

## 6. SERVER.JS REQUIRED CHANGES

### 6.1 Add seed to session_started

In `startSession()`:

```javascript
function startSession(code) {
  const room = rooms.get(code);
  if (!room || room.status !== "lobby") return;
  room.status = "active";
  room.activeCores = new Set();
  room.sessionEnd = Date.now() + SESSION_TIME * 1000;
  room.seed = Math.floor(Math.random() * 0xFFFFFFFF);

  // Compute spawn offsets
  const playerList = Array.from(room.players.values());
  const spawnOffsets = playerList.map((p, i) => ({
    id: p.id,
    x: playerList.length > 1 ? Math.cos((i / playerList.length) * Math.PI * 2) * 6 : 0,
    y: playerList.length > 1 ? Math.sin((i / playerList.length) * Math.PI * 2) * 3.6 : 0,
  }));

  io.to(code).emit("session_started", {
    sessionEnd: room.sessionEnd,
    seed: room.seed,
    players: playerList.map(p => ({ id: p.id, name: p.name, color: p.color, kills: 0, deaths: 0, alive: true, escaped: false, health: 100, survivalTime: 0, z: 0 })),
    spawnOffsets,
  });
  setTimeout(() => endSession(code), SESSION_TIME * 1000);
}
```

### 6.2 Fix hit radius

In `bullet_fired` handler:

```javascript
const HIT_RADIUS = 3.5; // was 2.4, too small
```

### 6.3 Add respawn emit

After `player_eliminated` is emitted inside `bullet_fired` handler:

```javascript
// Schedule respawn after 3 seconds
setTimeout(() => {
  const r = rooms.get(roomCode);
  if (!r || r.status !== "active") return;
  const v = r.players.get(victim.id);
  if (!v) return;
  v.alive = true;
  v.health = 100;
  const victimOffset = spawnOffsets?.[victimIndex] || { x: 0, y: 0 };
  io.to(victim.id).emit("respawn", { x: victimOffset.x, y: victimOffset.y });
  broadcastRoom(roomCode);
}, 3000);
```

For this to work, compute and store `spawnOffsets` on the room object at session start:

```javascript
// In startSession(), after computing spawnOffsets:
room.spawnOffsets = spawnOffsets;
```

Then in `bullet_fired`:

```javascript
const victimIndex = playerList.findIndex(p => p.id === victim.id);
const victimOffset = room.spawnOffsets?.[victimIndex] || { x: 0, y: 0 };
```

### 6.4 Add portal_unlocked relay

```javascript
socket.on("portal_unlocked", () => {
  const roomCode = socket.data.roomCode;
  const room = rooms.get(roomCode);
  if (!room || room.status !== "active") return;
  if (room.host !== socket.id) return; // host only
  socket.to(roomCode).emit("portal_unlocked");
});
```

### 6.5 Fix room_state broadcast to include Z positions

In `broadcastRoom`, update the players map:

```javascript
players: Array.from(room.players.values()).map(p => ({
  id: p.id, name: p.name, color: p.color,
  kills: p.kills, deaths: p.deaths, alive: p.alive,
  escaped: p.escaped || false, health: p.health ?? 100,
  survivalTime: p.survivalTime,
  z: p.z ?? 0,  // ← ADD THIS
})),
```

### 6.6 Update player Z from player_state events

In `player_state` handler, after updating x/y/z:

```javascript
player.z = Number.isFinite(z) ? z : player.z; // already there ✅
```

This is already in the server. Good.

### 6.7 Room state broadcast interval during active game

Add this in `startSession()` after the initial broadcast:

```javascript
// Broadcast room state every 2s during active game for leaderboard sync
room.broadcastInterval = setInterval(() => {
  const r = rooms.get(code);
  if (!r || r.status === "ended") {
    clearInterval(room.broadcastInterval);
    return;
  }
  broadcastRoom(code);
}, 2000);
```

In `endSession()`, add:

```javascript
if (room.broadcastInterval) clearInterval(room.broadcastInterval);
```

---

## 7. TESTING CHECKLIST

### Functional tests (manual)

**Solo flow:**
- [ ] Page loads → typewriter shows "SELECT MODE"
- [ ] Click SOLO → typewriter restarts with "identify yourself..." → form and hint appear
- [ ] Device-appropriate controls shown (keyboard on desktop, touch on mobile)
- [ ] Click BACK → returns to mode select
- [ ] Enter name + ENTER → game starts, all solo mechanics work as before
- [ ] Portal escape → redirects to vibej.am
- [ ] `?portal=true` → game auto-starts, no intro flash

**Multiplayer flow:**
- [ ] Click MULTIPLAYER → mp-setup shows with 3 buttons
- [ ] CREATE ROOM → prompt appears → room created → lobby shows
- [ ] Share link visible and copies to clipboard
- [ ] Second player opens `?room=XXXXXX` → auto-joins → shown in lobby player list
- [ ] With 2 players: countdown starts at 20s
- [ ] Session starts → both players in game → can see each other's ships
- [ ] Ships move when other player moves
- [ ] No white flash or brightness change when near other players
- [ ] Leaderboard shows both players ranked by Z position
- [ ] Leaderboard updates every 0.5s
- [ ] Shooting: bullet hits other player → red flash on their ship
- [ ] 10 hits = elimination → kill feed shows → eliminated player sees RESPAWNING overlay → respawns in 3s
- [ ] Cores: host spawns cores, non-host sees same cores
- [ ] Both players can shoot cores
- [ ] First to destroy core wins it → coresDestroyed increments for all
- [ ] Portal unlock syncs to all players
- [ ] Player exits portal → others see "X ESCAPED" in kill feed
- [ ] After 180s → SESSION OVER screen with standings

**PUBLIC LOBBY:**
- [ ] Click PUBLIC → joins or creates public room
- [ ] Second player clicks PUBLIC → joins same room
- [ ] Countdown starts when 2 players in
- [ ] Game starts after countdown

### Regression tests
- [ ] Solo mode unchanged from before any MP additions
- [ ] AI troll speaks and progresses through states in solo
- [ ] Death screen and retry work in solo
- [ ] Portal and return portal work in solo
- [ ] Mobile touch controls work in solo

---

## 8. KNOWN ISSUES AND SOLUTIONS

| Issue | Root Cause | Solution |
|---|---|---|
| Other players teleport | 50ms broadcast interval with no interpolation | Lerp mesh position: `mesh.position.lerp(target, 0.2)` per tick |
| Server cold start delays connection | Railway free tier sleeps | Show "waking server..." in mpStatus, auto-retry in 4s |
| Cores desynced between players | Race condition on simultaneous destroy | Server deduplicates via `activeCores` Set — first emit wins |
| Two players on exactly the same Z | Same tunnel seed, same speed | Spawn offsets separate them on X/Y; Z converges naturally |
| Hit detection feels wrong | Server uses player position from last `player_state` broadcast | Hit radius 3.5 compensates for 50ms lag |

---

## 9. ENVIRONMENT VARIABLES

Create `.env` at project root:

```
PORT=3001
CORS_ORIGIN=*
```

Railway auto-injects `PORT`. Leave `CORS_ORIGIN=*` for jam.

---

## 10. DEPLOYMENT

1. Push to GitHub
2. Railway: New Project → from repo → start command `node server.js`
3. Railway: Settings → Networking → Generate Domain
4. Copy domain URL → paste into `SOCKET_URL` in main.js
5. Push → Cloudflare Pages auto-deploys
6. Test: open two incognito tabs → click MULTIPLAYER → CREATE ROOM in tab 1 → JOIN ROOM in tab 2

The entire implementation is self-contained in `main.js`, `server.js`, `style.css`, and `index.html`. No new files needed except `.env`.