# SKYBREAK — Multiplayer + Portal Implementation Spec
> Vibe Jam 2026 · No Database · Cloudflare Pages (static) + Railway.app (free server)

---

## OVERVIEW & STRATEGY

**Why this wins the jam:**
- Multiplayer is the single biggest differentiator — most entries are solo
- Speed asymmetry (slow vs normal) creates a **natural skill trade-off** judges will notice
- PvP shooting = clip-worthy moments = social spread
- Portal webring = bonus prize category eligibility
- No login, no download, instant room code sharing = Rule 05 compliant

**Architecture:**
```
Cloudflare Pages (your static game files)
        │
        │  WebSocket
        ▼
Railway.app (free tier, Node.js server.js)
        │
        ├── Rooms (6-char code)
        ├── Lobby (20s countdown)
        ├── Position broadcast (50ms tick)
        ├── Bullet relay + hit confirm
        └── Kill leaderboard
```

**No database.** All state lives in server memory per-session. Rooms are destroyed when empty.

---

## PART 0 — PRE-FLIGHT CHECKLIST

Before writing a single line of code, confirm:

- [ ] You have a Railway.app account (free, no card needed at signup)
- [ ] Your GitHub repo is linked to Cloudflare Pages (already done based on your deployments)
- [ ] `server.js` does NOT live in the Vite build output — it's separate at project root
- [ ] `package.json` has both `"dev": "vite"` and `"server": "node server.js"` scripts
- [ ] Socket.io CDN tag is added to `index.html` **before** your module script

---

## PART 1 — SERVER (`server.js`)

### 1.1 Dependencies

```bash
# Run this once locally to add to package.json
npm install express socket.io
```

### 1.2 Full server.js

Create `server.js` at the project root (not inside `src/` or `public/`):

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

// ── Constants ──────────────────────────────────────────────────────
const LOBBY_WAIT   = 20;     // seconds before game auto-starts
const SESSION_TIME = 180;    // seconds per game session
const MAX_PLAYERS  = 8;

// Speed multipliers — client sends chosen lane, server stores it
// Slow: 0.6x  |  Normal: 1.0x
// Different speeds = players CAN see and shoot each other
// Same speed = still visible but harder to engage (no forced separation)

// ── Room state shape ───────────────────────────────────────────────
// room = {
//   code: string,
//   host: socketId,
//   players: Map<socketId, PlayerObj>,
//   status: 'lobby' | 'active' | 'ended',
//   countdownTimer: TimeoutHandle | null,
//   startAt: number | null,      // epoch ms
//   sessionEnd: number | null,   // epoch ms
// }
//
// PlayerObj = {
//   id, name, color, speedLane,
//   kills, deaths, alive, escaped,
//   survivalTime, x, y, z, rotZ
// }

const rooms = new Map();

// ── Helpers ────────────────────────────────────────────────────────
function makeCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function randomColor() {
  const c = ['#00ffff','#ff00ff','#ffff00','#00ff88','#ff6600','#88aaff','#ff4488','#44ffbb'];
  return c[Math.floor(Math.random() * c.length)];
}

function broadcastRoom(code) {
  const room = rooms.get(code);
  if (!room) return;
  io.to(code).emit('room_state', {
    code,
    status: room.status,
    players: Array.from(room.players.values()).map(p => ({
      id: p.id,
      name: p.name,
      color: p.color,
      speedLane: p.speedLane,
      kills: p.kills,
      deaths: p.deaths,
      alive: p.alive,
      escaped: p.escaped || false,
      survivalTime: p.survivalTime,
    })),
    startAt: room.startAt,
    sessionEnd: room.sessionEnd,
  });
}

// ── Connection handler ─────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log('connect:', socket.id);

  // ── CREATE ROOM ──────────────────────────────────────────────────
  socket.on('create_room', ({ name, color, speedLane }) => {
    const code = makeCode();
    const player = makePlayer(socket.id, name, color, speedLane);
    rooms.set(code, {
      code,
      host: socket.id,
      players: new Map([[socket.id, player]]),
      status: 'lobby',
      countdownTimer: null,
      startAt: null,
      sessionEnd: null,
    });
    socket.join(code);
    socket.data.roomCode = code;
    socket.emit('room_created', { code });
    broadcastRoom(code);
  });

  // ── JOIN ROOM ────────────────────────────────────────────────────
  socket.on('join_room', ({ code, name, color, speedLane }) => {
    const room = rooms.get(code?.toUpperCase());
    if (!room)                          { socket.emit('join_error', 'Room not found'); return; }
    if (room.status !== 'lobby')        { socket.emit('join_error', 'Game already started'); return; }
    if (room.players.size >= MAX_PLAYERS) { socket.emit('join_error', 'Room full (max 8)'); return; }

    const player = makePlayer(socket.id, name, color || randomColor(), speedLane);
    room.players.set(socket.id, player);
    socket.join(code.toUpperCase());
    socket.data.roomCode = code.toUpperCase();
    socket.emit('room_joined', { code: code.toUpperCase() });
    broadcastRoom(code.toUpperCase());

    // Auto-start countdown when 2+ players
    if (room.players.size >= 2 && !room.countdownTimer) {
      const startAt = Date.now() + LOBBY_WAIT * 1000;
      room.startAt = startAt;
      room.countdownTimer = setTimeout(() => startSession(code.toUpperCase()), LOBBY_WAIT * 1000);
      io.to(code.toUpperCase()).emit('countdown_started', { startAt });
    }
  });

  // ── POSITION UPDATE (client sends every 50ms) ────────────────────
  socket.on('pos', (data) => {
    const code = socket.data.roomCode;
    const room = rooms.get(code);
    if (!room || room.status !== 'active') return;
    const p = room.players.get(socket.id);
    if (!p || !p.alive) return;

    p.x = data.x; p.y = data.y; p.z = data.z;
    p.rotZ = data.rotZ;
    p.survivalTime = data.survivalTime || 0;

    // Relay to everyone else in room
    socket.to(code).emit('player_moved', {
      id: socket.id,
      x: data.x, y: data.y, z: data.z,
      rotZ: data.rotZ,
      color: p.color,
      name: p.name,
      speedLane: p.speedLane,
      survivalTime: p.survivalTime,
    });
  });

  // ── BULLET FIRED — relay to others ──────────────────────────────
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

  // ── HIT CONFIRM — victim self-reports (client-authoritative) ────
  socket.on('i_was_hit', ({ shooterId }) => {
    const code = socket.data.roomCode;
    const room = rooms.get(code);
    if (!room || room.status !== 'active') return;

    const victim  = room.players.get(socket.id);
    const shooter = room.players.get(shooterId);
    if (!victim || !victim.alive) return;

    victim.deaths++;
    victim.alive = false;
    if (shooter) shooter.kills++;

    io.to(code).emit('player_killed', {
      victimId:    socket.id,
      victimName:  victim.name,
      shooterId,
      shooterName: shooter?.name || '???',
      shooterKills: shooter?.kills || 0,
    });

    broadcastRoom(code);

    // Respawn after 3 seconds
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

  // ── PORTAL ESCAPE ────────────────────────────────────────────────
  socket.on('portal_escape', ({ survivalTime }) => {
    const code = socket.data.roomCode;
    const room = rooms.get(code);
    if (!room) return;
    const p = room.players.get(socket.id);
    if (p) { p.escaped = true; p.survivalTime = survivalTime; }
    io.to(code).emit('player_escaped', {
      id: socket.id,
      name: p?.name,
      survivalTime,
    });
    broadcastRoom(code);
  });

  // ── DISCONNECT ───────────────────────────────────────────────────
  socket.on('disconnect', () => {
    const code = socket.data.roomCode;
    const room = rooms.get(code);
    if (!room) return;
    room.players.delete(socket.id);
    io.to(code).emit('player_left', { id: socket.id });

    if (room.players.size === 0) {
      if (room.countdownTimer) clearTimeout(room.countdownTimer);
      rooms.delete(code);
      console.log('room destroyed:', code);
    } else {
      // If host left, reassign host
      if (room.host === socket.id) {
        room.host = room.players.keys().next().value;
      }
      broadcastRoom(code);
    }
  });
});

// ── Session lifecycle ──────────────────────────────────────────────
function makePlayer(id, name, color, speedLane) {
  return {
    id,
    name: (name || 'pilot_' + id.slice(0, 4)).replace(/[^a-zA-Z0-9_\-]/g, '').slice(0, 16) || 'anon',
    color: color || randomColor(),
    speedLane: speedLane === 'normal' ? 'normal' : 'slow',
    kills: 0, deaths: 0, alive: true, escaped: false,
    survivalTime: 0, x: 0, y: 0, z: 0, rotZ: 0,
  };
}

function startSession(code) {
  const room = rooms.get(code);
  if (!room || room.status !== 'lobby') return;
  room.status = 'active';
  room.sessionEnd = Date.now() + SESSION_TIME * 1000;
  io.to(code).emit('session_started', { sessionEnd: room.sessionEnd });
  console.log('session started:', code, room.players.size, 'players');
  setTimeout(() => endSession(code), SESSION_TIME * 1000);
}

function endSession(code) {
  const room = rooms.get(code);
  if (!room || room.status === 'ended') return;
  room.status = 'ended';
  const final = Array.from(room.players.values())
    .sort((a, b) => (b.kills - a.kills) || (b.survivalTime - a.survivalTime));
  io.to(code).emit('session_ended', { standings: final });
  console.log('session ended:', code);
  // Clean up room after 5 minutes
  setTimeout(() => rooms.delete(code), 300_000);
}

// ── Start server ───────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`SKYBREAK server :${PORT}`));
```

---

## PART 2 — RAILWAY.APP DEPLOYMENT (5 minutes)

### Steps

1. Push your repo to GitHub (already done — you're on Cloudflare Pages CI)
2. Go to **railway.app** → sign in with GitHub → **New Project** → **Deploy from GitHub Repo**
3. Select your skybreak repo
4. Railway auto-detects Node.js. Set the start command: `node server.js`
5. Add environment variable (optional): `NODE_ENV=production`
6. Click **Deploy**. Wait ~90 seconds.
7. Click **Settings → Networking → Generate Domain**
8. Copy the URL — looks like: `https://skybreak-production.up.railway.app`
9. In `main.js`, set: `const SOCKET_URL = 'https://skybreak-production.up.railway.app';`

### Railway free tier limits
- 500 hours/month compute (enough for ~16 days continuous or jam burst traffic)
- No credit card needed for hobby plan
- If it sleeps: first connection wakes it in ~3s (warn players with "connecting..." state)

### package.json update required

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

> **Important:** Railway uses `dependencies` not `devDependencies`. Express and socket.io must be in `dependencies`.

---

## PART 3 — INDEX.HTML CHANGES

Add the Socket.io client CDN tag to `index.html` `<head>`, **before** `<script type="module">`:

```html
<script src="https://cdn.socket.io/4.7.2/socket.io.min.js"></script>
```

Also add the in-game MP overlays to `index.html` (or inject via `app.innerHTML` in `main.js`):
See Part 5 for the exact HTML blocks to inject.

---

## PART 4 — INTRO SCREEN REDESIGN

### 4.1 Replace intro HTML in `app.innerHTML`

Find the `<div id="intro-screen">` block in the `app.innerHTML` string and **replace entirely**:

```html
<div id="intro-screen" class="intro-screen">
  <img class="logo-mark" src="/logo.png" alt="SKYBREAK" onerror="this.style.display='none'"/>
  <h1 class="game-title">SKYBREAK</h1>
  <p class="game-subtitle">AI REALITY COLLAPSE</p>
  <div id="intro-label" class="intro-label"></div>

  <!-- STEP 1: Mode select -->
  <div id="mode-select" class="mode-select">
    <button id="btn-solo" class="mode-btn mode-btn--solo">
      <div class="mode-btn-icon">▶</div>
      <div class="mode-btn-title">SOLO</div>
      <div class="mode-btn-desc">Face the AI alone · survive 180s</div>
    </button>
    <button id="btn-multi" class="mode-btn mode-btn--multi">
      <div class="mode-btn-icon">⚔</div>
      <div class="mode-btn-title">MULTIPLAYER</div>
      <div class="mode-btn-desc">Shoot rivals · PvP · speed asymmetry</div>
    </button>
  </div>

  <!-- STEP 2A: Solo form -->
  <form id="intro-form" class="intro-form" style="display:none">
    <input id="intro-input" class="intro-input" type="text"
      placeholder="enter pilot name... or leave blank" maxlength="16"
      autocomplete="off" autocapitalize="none" autocorrect="off" spellcheck="false">
    <button type="submit" class="intro-button">ENTER THE VOID</button>
  </form>

  <!-- STEP 2B: Multiplayer setup -->
  <div id="mp-setup" class="mp-setup" style="display:none">
    <input id="mp-name" class="intro-input" type="text"
      placeholder="pilot name (optional)" maxlength="16"
      autocomplete="off" autocapitalize="none" autocorrect="off" spellcheck="false">

    <!-- Speed selector -->
    <div class="speed-lanes">
      <div class="speed-lanes-label">CHOOSE YOUR SPEED</div>
      <div class="speed-lane-btns">
        <button class="speed-lane-btn active" data-speed="slow">
          <span class="sln-icon">🐢</span>
          <span class="sln-name">SLOW</span>
          <span class="sln-desc">60% speed<br>easier to aim at others<br>easier to be hit</span>
        </button>
        <button class="speed-lane-btn" data-speed="normal">
          <span class="sln-icon">🚀</span>
          <span class="sln-name">NORMAL</span>
          <span class="sln-desc">full speed<br>harder to hit<br>harder to aim</span>
        </button>
      </div>
      <p class="speed-lane-note">All players see each other regardless of speed</p>
    </div>

    <!-- Room code row -->
    <div class="room-section">
      <div class="room-row">
        <input id="room-code-input" class="room-code-input" type="text"
          placeholder="ENTER CODE" maxlength="6"
          autocomplete="off" autocapitalize="characters" spellcheck="false">
        <span class="room-or">OR</span>
        <button id="btn-create-room" class="room-create-btn">CREATE ROOM</button>
      </div>
      <div id="room-display" class="room-display" style="display:none">
        ROOM CODE: <strong id="room-code-text" class="room-code-big"></strong>
        <span id="room-copy-hint" class="room-copy-hint"> · click to copy</span>
      </div>
    </div>

    <button id="btn-mp-join" class="intro-button" style="display:none">JOIN LOBBY</button>
  </div>

  <!-- STEP 3: Lobby waiting room -->
  <div id="mp-lobby" class="mp-lobby" style="display:none">
    <div class="lobby-title">WAITING FOR PILOTS</div>
    <div id="lobby-room-display" class="room-display" style="display:block; margin-bottom:0.5rem">
      ROOM CODE: <strong id="lobby-room-code" class="room-code-big"></strong>
      <span id="lobby-copy-hint" class="room-copy-hint"> · click to copy</span>
    </div>
    <div id="lobby-countdown" class="lobby-countdown">—</div>
    <div id="lobby-players" class="lobby-players"></div>
    <div class="lobby-hint">Game starts in 20s · Share the code above with friends</div>
    <button id="btn-lobby-cancel" class="death-btn death-btn--quit" style="margin-top:0.5rem">LEAVE</button>
  </div>

  <p class="creator-credit">made by ai, prompted by
    <a href="https://x.com/AlphaGoat2711" target="_blank">@AlphaGoat2711</a> · vibe jam 2026</p>
  <p class="github-link">
    <a href="https://github.com/AlphaTheGoat27/skybreak" target="_blank">open source on github</a>
  </p>
</div>
```

---

## PART 5 — IN-GAME MP UI BLOCKS

Append these to the `app.innerHTML` string, **after the death screen** and **before the intro screen**:

```html
<!-- In-game multiplayer leaderboard (right side) -->
<div id="mp-leaderboard" class="mp-leaderboard">
  <div class="mp-lb-title">LIVE SESSION</div>
  <div id="mp-lb-list" class="mp-lb-list"></div>
  <div id="mp-session-timer" class="mp-session-timer">3:00</div>
</div>

<!-- Kill feed (top right, below leaderboard) -->
<div id="kill-feed" class="kill-feed"></div>

<!-- Respawn overlay (shown for 3s on death in MP) -->
<div id="respawn-overlay" class="respawn-overlay">
  <div class="respawn-text">RESPAWNING...</div>
</div>

<!-- MP End Screen (shown after session_ended event) -->
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

---

## PART 6 — CSS ADDITIONS (`style.css`)

Append to the **end** of `style.css`:

```css
/* ── Mode Select ─────────────────────────────────────────────────── */
.mode-select {
  display: flex;
  gap: 1.2rem;
  flex-wrap: wrap;
  justify-content: center;
}

.mode-btn {
  font-family: var(--mono);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.45rem;
  padding: 1.4rem 2rem;
  min-width: 180px;
  background: rgba(0,10,15,0.75);
  border: 1px solid rgba(0,255,255,0.28);
  border-radius: 5px;
  cursor: pointer;
  transition: all 0.18s ease;
  color: var(--white);
}

.mode-btn:hover {
  border-color: var(--cyan);
  background: rgba(0,255,255,0.06);
  transform: translateY(-4px);
  box-shadow: var(--glow-cyan);
}

.mode-btn-icon { font-size: 2rem; }
.mode-btn-title { font-size: 1rem; letter-spacing: 0.18em; color: var(--cyan); }
.mode-btn-desc { font-size: 0.68rem; color: rgba(255,255,255,0.45); text-align: center; }

.mode-btn--multi { border-color: rgba(255,0,255,0.28); }
.mode-btn--multi .mode-btn-title { color: var(--magenta); }
.mode-btn--multi:hover { border-color: var(--magenta); box-shadow: var(--glow-magenta); }

/* ── MP Setup Panel ──────────────────────────────────────────────── */
.mp-setup {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  width: min(440px, 90vw);
}

/* ── Speed lanes ─────────────────────────────────────────────────── */
.speed-lanes { display: flex; flex-direction: column; gap: 0.5rem; }
.speed-lanes-label {
  font-size: 0.68rem;
  letter-spacing: 0.2em;
  color: rgba(255,255,255,0.45);
  text-align: center;
}
.speed-lane-btns { display: flex; gap: 0.8rem; }
.speed-lane-btn {
  font-family: var(--mono);
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.3rem;
  padding: 0.9rem;
  background: rgba(0,10,15,0.8);
  border: 1px solid rgba(0,255,255,0.2);
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.15s ease;
  text-align: center;
  color: var(--white);
}
.speed-lane-btn.active {
  border-color: var(--cyan);
  background: rgba(0,255,255,0.07);
  box-shadow: 0 0 12px rgba(0,255,255,0.2);
}
.speed-lane-btn:hover { border-color: var(--cyan); background: rgba(0,255,255,0.05); }
.sln-icon { font-size: 1.4rem; }
.sln-name { font-size: 0.8rem; letter-spacing: 0.15em; color: var(--cyan); }
.sln-desc { font-size: 0.6rem; color: rgba(255,255,255,0.4); line-height: 1.5; }
.speed-lane-note { font-size: 0.62rem; color: rgba(255,255,255,0.3); text-align: center; letter-spacing: 0.06em; }

/* ── Room section ────────────────────────────────────────────────── */
.room-section { display: flex; flex-direction: column; gap: 0.5rem; }
.room-row { display: flex; align-items: center; gap: 0.6rem; }
.room-code-input {
  font-family: var(--mono);
  flex: 1;
  font-size: 14px;
  letter-spacing: 0.25em;
  text-transform: uppercase;
  text-align: center;
  padding: 0.7rem;
  background: var(--void);
  border: 1px solid rgba(0,255,255,0.3);
  border-radius: 3px;
  color: var(--cyan);
  caret-color: var(--cyan);
}
.room-code-input::placeholder { color: rgba(0,255,255,0.25); letter-spacing: 0.15em; }
.room-code-input:focus { outline: none; border-color: var(--cyan); box-shadow: var(--glow-cyan); }
.room-or { font-size: 0.7rem; color: rgba(255,255,255,0.3); white-space: nowrap; }
.room-create-btn {
  font-family: var(--mono);
  font-size: 0.72rem;
  letter-spacing: 0.12em;
  padding: 0.7rem 1rem;
  background: rgba(0,255,255,0.08);
  border: 1px solid rgba(0,255,255,0.4);
  border-radius: 3px;
  color: var(--cyan);
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.15s ease;
}
.room-create-btn:hover { background: var(--cyan); color: var(--void); box-shadow: var(--glow-cyan); }
.room-display {
  font-size: 0.8rem;
  letter-spacing: 0.1em;
  color: rgba(255,255,255,0.55);
  text-align: center;
  padding: 0.5rem;
  background: rgba(0,255,255,0.04);
  border: 1px solid rgba(0,255,255,0.15);
  border-radius: 3px;
  cursor: pointer;
}
.room-code-big { font-size: 1.3rem; color: var(--cyan); letter-spacing: 0.3em; text-shadow: var(--glow-cyan); }
.room-copy-hint { font-size: 0.65rem; color: rgba(0,255,255,0.4); }

/* ── Lobby ───────────────────────────────────────────────────────── */
.mp-lobby {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  width: min(440px, 90vw);
  padding: 1.5rem;
  background: rgba(0,6,10,0.9);
  border: 1px solid var(--cyan);
  border-radius: 6px;
}
.lobby-title { font-size: 0.78rem; letter-spacing: 0.25em; color: rgba(0,255,255,0.7); text-align: center; }
.lobby-countdown {
  font-size: 2.8rem;
  color: #ffff00;
  letter-spacing: 0.1em;
  text-shadow: 0 0 20px rgba(255,255,0,0.7);
  font-weight: bold;
  min-height: 3.5rem;
  display: flex;
  align-items: center;
}
.lobby-players { width: 100%; display: flex; flex-direction: column; gap: 0.4rem; max-height: 200px; overflow-y: auto; }
.lobby-player-row {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  padding: 0.45rem 0.7rem;
  background: rgba(0,20,30,0.6);
  border-radius: 3px;
  font-size: 0.82rem;
}
.lobby-player-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.lobby-player-name { flex: 1; color: var(--white); }
.lobby-player-lane { font-size: 0.65rem; color: rgba(255,255,255,0.35); letter-spacing: 0.1em; }
.lobby-hint { font-size: 0.65rem; color: rgba(255,255,255,0.28); text-align: center; letter-spacing: 0.08em; line-height: 1.5; }

/* ── In-game leaderboard ─────────────────────────────────────────── */
.mp-leaderboard {
  position: fixed;
  top: 50%;
  right: 1.1rem;
  transform: translateY(-50%);
  width: 240px;
  background: rgba(0,4,8,0.92);
  border: 1px solid rgba(255,255,0,0.4);
  border-radius: 4px;
  padding: 0.9rem;
  opacity: 0;
  transition: opacity 0.3s ease;
  pointer-events: none;
  z-index: 15;
}
.mp-leaderboard.is-visible { opacity: 1; }
.mp-lb-title { font-size: 10px; letter-spacing: 0.2em; color: rgba(255,255,0,0.8); text-align: center; margin-bottom: 0.7rem; padding-bottom: 0.5rem; border-bottom: 1px solid rgba(255,255,0,0.2); }
.mp-lb-list { display: flex; flex-direction: column; gap: 0.35rem; }
.mp-lb-row {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.35rem 0.5rem;
  background: rgba(0,15,22,0.7);
  border-radius: 2px;
  font-size: 11px;
  color: var(--white);
}
.mp-lb-row.is-you { border: 1px solid rgba(255,255,0,0.6); background: rgba(255,255,0,0.05); }
.mp-lb-row.is-dead { opacity: 0.35; }
.mp-lb-rank { color: rgba(255,255,0,0.55); min-width: 18px; font-size: 10px; }
.mp-lb-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mp-lb-kills { color: #ff6688; font-size: 10px; min-width: 28px; text-align: right; }
.mp-lb-time { color: rgba(255,255,255,0.5); font-size: 9px; min-width: 32px; text-align: right; }
.mp-session-timer { font-size: 1.1rem; color: #ffff00; text-align: center; margin-top: 0.7rem; padding-top: 0.6rem; border-top: 1px solid rgba(255,255,0,0.2); font-weight: bold; }

/* ── Kill feed ───────────────────────────────────────────────────── */
.kill-feed {
  position: fixed;
  top: 9rem;
  right: 1.1rem;
  width: 260px;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  z-index: 14;
  pointer-events: none;
}
.kill-feed-entry {
  font-size: 11px;
  padding: 0.3rem 0.6rem;
  background: rgba(0,0,0,0.75);
  border-left: 2px solid #ff6688;
  border-radius: 0 2px 2px 0;
  color: rgba(255,255,255,0.8);
  opacity: 1;
  transition: opacity 0.5s ease;
  letter-spacing: 0.05em;
}
.kill-feed-entry.fading { opacity: 0; }

/* ── Respawn overlay ─────────────────────────────────────────────── */
.respawn-overlay {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255,0,40,0.08);
  z-index: 22;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.2s ease;
}
.respawn-overlay.is-visible { opacity: 1; }
.respawn-text {
  font-size: 2rem;
  color: #ff2244;
  letter-spacing: 0.3em;
  text-shadow: 0 0 30px rgba(255,0,40,0.9);
  animation: death-pulse 0.8s ease-in-out infinite;
}

/* ── MP end screen ───────────────────────────────────────────────── */
.mp-end-screen {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0,0,0,0.97);
  z-index: 30;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.4s ease;
}
.mp-end-screen.is-visible { opacity: 1; pointer-events: auto; }
.mp-end-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.2rem;
  padding: 2.5rem;
  border: 1px solid rgba(255,255,0,0.5);
  background: rgba(0,0,0,0.97);
  border-radius: 6px;
  max-width: min(520px, 92vw);
  text-align: center;
}
.mp-end-title { font-size: 1.8rem; letter-spacing: 0.2em; color: #ffff00; }
.mp-end-rank { font-size: 1.2rem; color: var(--cyan); padding: 0.8rem 1.5rem; background: rgba(0,255,255,0.07); border-radius: 4px; }
.mp-end-list { width: 100%; max-height: 280px; overflow-y: auto; }
.mp-end-buttons { display: flex; gap: 1rem; margin-top: 0.5rem; }
```

---

## PART 7 — CLIENT-SIDE JS (add to `main.js`)

### 7.1 Top-of-file additions (after CFG block)

```javascript
// ── Socket.io + Multiplayer state ──────────────────────────────────
const SOCKET_URL = 'https://YOUR-RAILWAY-URL.up.railway.app'; // ← replace after deploy

let socket         = null;
let mpMode         = false;
let myRoomCode     = null;
let mySpeedLane    = 'slow';
let otherPlayers   = new Map(); // socketId → { mesh, data }
let posInterval    = null;
let mpRoomState    = { players: [] };
let mpSessionEndMs = 0;
let lbTickInterval = null;

const SPEED_MULT = { slow: 0.6, normal: 1.0 };
```

### 7.2 DOM refs additions (append to the G object)

```javascript
// Add to G = { ... } block:
const GM = {
  modeSelect:    document.getElementById('mode-select'),
  btnSolo:       document.getElementById('btn-solo'),
  btnMulti:      document.getElementById('btn-multi'),
  mpSetup:       document.getElementById('mp-setup'),
  mpName:        document.getElementById('mp-name'),
  speedBtns:     document.querySelectorAll('.speed-lane-btn'),
  roomCodeInput: document.getElementById('room-code-input'),
  btnCreate:     document.getElementById('btn-create-room'),
  roomDisplay:   document.getElementById('room-display'),
  roomCodeText:  document.getElementById('room-code-text'),
  roomCopyHint:  document.getElementById('room-copy-hint'),
  btnMpJoin:     document.getElementById('btn-mp-join'),
  mpLobby:       document.getElementById('mp-lobby'),
  lobbyRoomCode: document.getElementById('lobby-room-code'),
  lobbyCopyHint: document.getElementById('lobby-copy-hint'),
  lobbyCountdown:document.getElementById('lobby-countdown'),
  lobbyPlayers:  document.getElementById('lobby-players'),
  btnLobbyCancel:document.getElementById('btn-lobby-cancel'),
};
```

### 7.3 Mode select event handlers

```javascript
// ── Mode select ──────────────────────────────────────────────────
GM.btnSolo.addEventListener('click', () => {
  GM.modeSelect.style.display = 'none';
  G.introForm.style.display = 'flex';
  G.introInput.focus();
});

GM.btnMulti.addEventListener('click', () => {
  GM.modeSelect.style.display = 'none';
  GM.mpSetup.style.display = 'flex';
  GM.mpName.focus();
  initSocket();
});

// Speed toggle
GM.speedBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    GM.speedBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    mySpeedLane = btn.dataset.speed;
  });
});

// Create room
GM.btnCreate.addEventListener('click', () => {
  if (!socket?.connected) { GM.btnCreate.textContent = 'CONNECTING...'; return; }
  socket.emit('create_room', {
    name: GM.mpName.value.trim(),
    color: pickColor(),
    speedLane: mySpeedLane,
  });
});

// Code input — show JOIN button at 6 chars
GM.roomCodeInput.addEventListener('input', () => {
  const v = GM.roomCodeInput.value.trim();
  GM.btnMpJoin.style.display = v.length === 6 ? 'block' : 'none';
});

// Copy code
GM.roomCopyHint.addEventListener('click', () => {
  navigator.clipboard?.writeText(GM.roomCodeText.textContent);
  GM.roomCopyHint.textContent = ' · copied!';
  setTimeout(() => { GM.roomCopyHint.textContent = ' · click to copy'; }, 2000);
});

GM.lobbyCopyHint?.addEventListener('click', () => {
  navigator.clipboard?.writeText(GM.lobbyRoomCode.textContent);
  GM.lobbyCopyHint.textContent = ' · copied!';
  setTimeout(() => { GM.lobbyCopyHint.textContent = ' · click to copy'; }, 2000);
});

// Join lobby
GM.btnMpJoin.addEventListener('click', () => {
  const code = (GM.roomCodeInput.value.trim() || myRoomCode || '').toUpperCase();
  if (!code) return;
  socket.emit('join_room', {
    code,
    name: GM.mpName.value.trim(),
    color: pickColor(),
    speedLane: mySpeedLane,
  });
});

// Leave lobby
GM.btnLobbyCancel.addEventListener('click', () => {
  socket?.disconnect();
  socket = null;
  GM.mpLobby.style.display = 'none';
  GM.mpSetup.style.display = 'none';
  GM.modeSelect.style.display = 'flex';
  myRoomCode = null;
});

// Check URL for ?room= param to auto-join
const urlParams = new URLSearchParams(location.search);
if (urlParams.get('room')) {
  // Pre-fill room code and show MP setup automatically after a short delay
  setTimeout(() => {
    GM.btnMulti.click();
    GM.roomCodeInput.value = urlParams.get('room').toUpperCase();
    GM.btnMpJoin.style.display = 'block';
  }, 500);
}

function pickColor() {
  const c = ['#00ffff','#ff00ff','#ffff00','#00ff88','#ff6600','#88aaff','#ff4488','#44ffbb'];
  return c[Math.floor(Math.random() * c.length)];
}
```

### 7.4 Socket initialization + event handlers

```javascript
function initSocket() {
  if (socket?.connected) return;
  // socket.io is loaded via CDN script tag
  socket = io(SOCKET_URL, { transports: ['websocket'] });

  socket.on('connect', () => {
    console.log('MP connected:', socket.id);
    GM.btnCreate.textContent = 'CREATE ROOM';
  });

  socket.on('connect_error', () => {
    GM.btnCreate.textContent = 'SERVER OFFLINE';
  });

  socket.on('room_created', ({ code }) => {
    myRoomCode = code;
    GM.roomDisplay.style.display = 'block';
    GM.roomCodeText.textContent = code;
    GM.btnMpJoin.style.display = 'block';
    GM.btnMpJoin.textContent = 'JOIN MY LOBBY';
    // Auto-join as host
    socket.emit('join_room', {
      code,
      name: GM.mpName.value.trim(),
      color: pickColor(),
      speedLane: mySpeedLane,
    });
  });

  socket.on('join_error', (msg) => { alert('Could not join: ' + msg); });

  socket.on('room_joined', ({ code }) => {
    myRoomCode = code;
    GM.mpSetup.style.display = 'none';
    GM.mpLobby.style.display = 'flex';
    GM.lobbyRoomCode.textContent = code;
    // Share link construction
    const shareUrl = `${location.origin}?room=${code}`;
    console.log('Share link:', shareUrl);
  });

  socket.on('room_state', (state) => {
    mpRoomState = state;
    renderLobbyPlayers(state.players);
    if (mpMode) updateLeaderboard();
  });

  socket.on('countdown_started', ({ startAt }) => {
    startLobbyCountdown(startAt);
  });

  socket.on('session_started', ({ sessionEnd }) => {
    mpMode = true;
    mpSessionEndMs = sessionEnd;
    PLAYER_NAME = (GM.mpName.value.trim() || '').replace(/[^a-zA-Z0-9_\-]/g, '').slice(0,16) || 'pilot_' + socket.id.slice(0,4);
    launchMpGame(sessionEnd);
  });

  socket.on('player_moved', (data) => {
    updateOtherPlayer(data);
  });

  socket.on('bullet_incoming', (data) => {
    spawnIncomingBullet(data);
  });

  socket.on('player_killed', (data) => {
    onPlayerKilled(data);
  });

  socket.on('respawn', () => {
    document.getElementById('respawn-overlay')?.classList.remove('is-visible');
    G.whiteFlash.style.opacity = '0.15';
    setTimeout(() => { G.whiteFlash.style.opacity = '0'; }, 150);
  });

  socket.on('player_escaped', (data) => {
    addKillFeedEntry(`${data.name} ESCAPED · ${data.survivalTime.toFixed(1)}s`, '#00ffff');
  });

  socket.on('session_ended', (data) => {
    showMpEndScreen(data.standings);
  });

  socket.on('player_left', ({ id }) => {
    removeOtherPlayer(id);
    addKillFeedEntry('a pilot disconnected', 'rgba(255,255,255,0.3)');
  });
}

// ── Lobby helpers ──────────────────────────────────────────────────
let _countdownInterval = null;

function startLobbyCountdown(startAt) {
  if (_countdownInterval) clearInterval(_countdownInterval);
  _countdownInterval = setInterval(() => {
    const left = Math.max(0, Math.ceil((startAt - Date.now()) / 1000));
    GM.lobbyCountdown.textContent = left + 's';
    if (left <= 0) clearInterval(_countdownInterval);
  }, 200);
}

function renderLobbyPlayers(players) {
  if (!GM.lobbyPlayers) return;
  GM.lobbyPlayers.innerHTML = players.map(p => `
    <div class="lobby-player-row">
      <div class="lobby-player-dot" style="background:${p.color}"></div>
      <div class="lobby-player-name">${p.name}</div>
      <div class="lobby-player-lane">${p.speedLane === 'slow' ? '🐢 SLOW' : '🚀 NORMAL'}</div>
    </div>
  `).join('');
}
```

### 7.5 Launch MP game

```javascript
function launchMpGame(sessionEnd) {
  // Hide lobby
  GM.mpLobby.style.display = 'none';

  // Start Three.js if not already running
  hasStarted = true;
  if (!aiTroll) aiTroll = new AITroll(G.aiBox, G.aiMsg, PLAYER_NAME);
  if (!threeApp) { threeApp = buildThreeApp(G.gameLayer); threeApp.start(); }

  // Apply speed multiplier for this player's lane
  const speedMult = SPEED_MULT[mySpeedLane] || 1.0;
  threeApp.beginRun({ multiplayer: true, speedMult });

  G.hud.classList.add('is-active');
  G.introScreen.classList.add('is-fading');
  setTimeout(() => G.introScreen.classList.add('is-gone'), 500);
  setTimeout(() => aiTroll.pushFirstLine(), 700);

  // Show MP leaderboard
  document.getElementById('mp-leaderboard')?.classList.add('is-visible');

  // Start sending position
  startPosBroadcast();

  // Start session countdown in leaderboard
  startSessionTimer(sessionEnd);
}
```

### 7.6 Position broadcast

```javascript
function startPosBroadcast() {
  if (posInterval) clearInterval(posInterval);
  posInterval = setInterval(() => {
    if (!socket?.connected || !threeApp) return;
    const pos = threeApp.getShipPosition();
    const rot = threeApp.getShipRotation();
    socket.emit('pos', {
      x: pos.x, y: pos.y, z: pos.z,
      rotZ: rot.z,
      survivalTime: threeApp.getSurvivalTime(),
    });
  }, 50);
}

function stopPosBroadcast() {
  if (posInterval) clearInterval(posInterval);
  posInterval = null;
}
```

### 7.7 Getters — add to `buildThreeApp` return object

Find the `return { start() {...}, beginRun() {...} }` at the bottom of `buildThreeApp` and add these:

```javascript
return {
  start() { /* existing code unchanged */ },
  beginRun({ fromPortal = false, referrer = null, multiplayer = false, speedMult = 1.0 } = {}) {
    resetRun();
    _speedMultiplier = speedMult;   // NEW line
    isRunActive = true;
    prevTs = 0;
    G.deathScreen.classList.remove('is-visible');
    audio.start();
    if (fromPortal && referrer) buildStartPortal(portalSys, referrer, shipAnchor.position.z);
  },
  // NEW getters:
  getShipPosition: () => ({ ...shipAnchor.position }),
  getShipRotation: () => ({ ...shipAnchor.rotation }),
  getSurvivalTime: () => wallTime,
  getHealth: () => health,
};
```

Near the top of `buildThreeApp`, after the `let` declarations, add:
```javascript
let _speedMultiplier = 1.0;
```

In the tick function where `spd` is used (find `const spd = getSpeed(diffT)`), change to:
```javascript
const spd = getSpeed(diffT) * _speedMultiplier;
```

### 7.8 Render other players

Add these functions inside `buildThreeApp` (after `buildShip`):

```javascript
// ── Other players ────────────────────────────────────────────────
function buildOtherShip(color) {
  const g = new THREE.Group();
  const col = parseInt((color || '#ff00ff').replace('#',''), 16);
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
  g.scale.setScalar(0.9);
  return g;
}

function updateOtherPlayer(data) {
  let entry = otherPlayers.get(data.id);
  if (!entry) {
    const group = new THREE.Group();
    const ship = buildOtherShip(data.color);
    group.add(ship);
    const tag = makeNameTag(data.name || data.id.slice(0,6));
    tag.position.y = 2.5;
    group.add(tag);
    // Speed indicator sprite
    const speedTag = makeNameTag(data.speedLane === 'slow' ? '🐢' : '🚀');
    speedTag.position.set(1.5, 1.2, 0);
    speedTag.scale.set(0.8, 0.16, 1);
    group.add(speedTag);
    _scene.add(group);
    entry = { mesh: group, data };
    otherPlayers.set(data.id, entry);
  }
  entry.mesh.position.set(data.x, data.y, data.z);
  entry.mesh.rotation.z = data.rotZ || 0;
  entry.data = { ...entry.data, ...data };
}

function removeOtherPlayer(id) {
  const entry = otherPlayers.get(id);
  if (entry) { _scene.remove(entry.mesh); otherPlayers.delete(id); }
}
```

### 7.9 Bullet broadcast — hook into existing `shoot()`

Inside the existing `shoot()` function, **after** `bullets.push(new Bullet(...))`:

```javascript
if (mpMode && socket?.connected) {
  socket.emit('bullet_fired', {
    x: spawnPos.x, y: spawnPos.y, z: spawnPos.z,
    dx: dir.x, dy: dir.y, dz: dir.z,
    color: '#00ffff',
  });
}
```

### 7.10 Incoming bullets with hit detection

```javascript
function spawnIncomingBullet(data) {
  if (!_scene) return;
  const col = parseInt((data.color || '#ff00ff').replace('#',''), 16);
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.25, 6, 6),
    new THREE.MeshBasicMaterial({ color: col })
  );
  mesh.position.set(data.x, data.y, data.z);
  _scene.add(mesh);
  const vel = new THREE.Vector3(data.dx, data.dy, data.dz).normalize().multiplyScalar(CFG.BULLET_SPEED);
  let life = 0;
  let hit  = false;

  function tick() {
    if (hit) return;
    life += 0.016;
    if (life > CFG.BULLET_LIFETIME) { _scene.remove(mesh); return; }
    mesh.position.addScaledVector(vel, 0.016);

    // Client-side proximity check — if close enough, victim self-reports
    if (!endSeq && isRunActive) {
      const myPos = shipAnchor.position;
      if (mesh.position.distanceTo(myPos) < 2.8) {
        hit = true;
        _scene.remove(mesh);
        socket?.emit('i_was_hit', { shooterId: data.shooterId });
        // Show respawn overlay
        document.getElementById('respawn-overlay')?.classList.add('is-visible');
        G.damageFlash.classList.add('is-active');
        setTimeout(() => G.damageFlash.classList.remove('is-active'), 300);
        return;
      }
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}
```

> **Note:** `endSeq` and `isRunActive` are declared inside `buildThreeApp`. You need to expose them or use closure. Cleanest approach: add `isHittable: () => (isRunActive && !endSeq)` to the `buildThreeApp` return object, then check `threeApp.isHittable()` in `spawnIncomingBullet`.

### 7.11 Kill events + kill feed

Add these outside `buildThreeApp`:

```javascript
function onPlayerKilled(data) {
  const isYou     = data.victimId  === socket?.id;
  const youKilled = data.shooterId === socket?.id;

  if (youKilled) {
    aiTroll?.pushLine(`${data.victimName} eliminated. adding to my collection.`);
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
  // Fade out after 4s
  setTimeout(() => {
    div.classList.add('fading');
    setTimeout(() => div.remove(), 500);
  }, 4000);
}
```

### 7.12 Leaderboard + session timer

```javascript
function startSessionTimer(sessionEnd) {
  if (lbTickInterval) clearInterval(lbTickInterval);
  lbTickInterval = setInterval(() => {
    const left = Math.max(0, Math.floor((sessionEnd - Date.now()) / 1000));
    const m = Math.floor(left / 60);
    const s = (left % 60).toString().padStart(2, '0');
    const el = document.getElementById('mp-session-timer');
    if (el) el.textContent = `${m}:${s}`;
    updateLeaderboard();
    if (left <= 0) clearInterval(lbTickInterval);
  }, 500);
}

function updateLeaderboard() {
  const list = document.getElementById('mp-lb-list');
  if (!list) return;
  const sorted = [...mpRoomState.players].sort((a, b) => (b.kills - a.kills) || (b.survivalTime - a.survivalTime));
  list.innerHTML = sorted.map((p, i) => `
    <div class="mp-lb-row ${p.id === socket?.id ? 'is-you' : ''} ${!p.alive ? 'is-dead' : ''}">
      <span class="mp-lb-rank">#${i+1}</span>
      <span class="mp-lb-name" style="color:${p.color}">${p.name}</span>
      <span class="mp-lb-kills">⚔${p.kills}</span>
      <span class="mp-lb-time">${p.survivalTime.toFixed(0)}s</span>
    </div>
  `).join('');
}
```

### 7.13 MP end screen

```javascript
function showMpEndScreen(standings) {
  stopPosBroadcast();
  if (lbTickInterval) clearInterval(lbTickInterval);

  const myRank  = standings.findIndex(p => p.id === socket?.id) + 1;
  const total   = standings.length;

  document.getElementById('mp-end-rank').textContent = `YOU PLACED #${myRank} OF ${total}`;

  const list = document.getElementById('mp-end-list');
  list.innerHTML = standings.map((p, i) => `
    <div class="mp-lb-row ${p.id === socket?.id ? 'is-you' : ''}">
      <span class="mp-lb-rank">#${i+1}</span>
      <span class="mp-lb-name" style="color:${p.color}">${p.name}</span>
      <span class="mp-lb-kills">⚔${p.kills}</span>
      <span class="mp-lb-time">${p.survivalTime.toFixed(1)}s</span>
    </div>
  `).join('');

  document.getElementById('mp-end-screen')?.classList.add('is-visible');

  document.getElementById('mp-end-retry')?.addEventListener('click', () => location.reload(), { once: true });
  document.getElementById('mp-end-quit')?.addEventListener('click', () => { location.href = CFG.WEBRING_URL; }, { once: true });
}
```

---

## PART 8 — PORTAL IMPLEMENTATION

Portals are partially working in your existing code. This section covers what needs fixing/adding.

### 8.1 Exit portal — update `triggerWin()`

Find `triggerWin()` in `main.js`. Replace the `URLSearchParams` block and redirect:

```javascript
function triggerWin() {
  endSeq = true;
  audio.stop();
  aiTroll?.onWin(PLAYER_NAME);

  const finalLine = PLAYER_NAME ? `${PLAYER_NAME}... wait, take me with you—` : "wait, take me with you—";
  aiTroll?.pushBrokenFinal(finalLine);

  const zoomId = setInterval(() => {
    camFOV = THREE.MathUtils.lerp(camFOV, 38, 0.14);
    camera.fov = camFOV; camera.updateProjectionMatrix();
  }, 16);

  let shakeAmt = 0;
  const shakeId = setInterval(() => {
    shakeAmt = Math.min(3.5, shakeAmt + 0.45);
    camera.position.x += (Math.random() - 0.5) * shakeAmt;
    camera.position.y += (Math.random() - 0.5) * shakeAmt;
  }, 40);

  setTimeout(() => {
    clearInterval(zoomId);
    clearInterval(shakeId);
    speechSynthesis?.cancel();
    aiSpeak("—please", 0.3, 0.2);

    triggerShatter(() => {
      G.whiteFlash.classList.add("is-visible");
      setTimeout(() => {
        // Build portal exit URL with all params
        const p = new URLSearchParams({
          username: PLAYER_NAME || 'anonymous',
          speed:    Math.round(getSpeed(diffT) * (_speedMultiplier || 1)).toString(),
          ref:      location.origin + location.pathname,
          hp:       Math.ceil(health).toString(),
          color:    '#00ffff',
          won:      'true',
        });

        // In MP mode: emit escape event before redirect
        if (mpMode && socket?.connected) {
          socket.emit('portal_escape', { survivalTime: wallTime });
          setTimeout(() => { location.href = `${CFG.WEBRING_URL}?${p}`; }, 300);
        } else {
          location.href = `${CFG.WEBRING_URL}?${p}`;
        }
      }, 650);
    });
  }, 1050);
}
```

> **Note:** `_speedMultiplier` is scoped inside `buildThreeApp`. Expose it via `threeApp.getSpeedMult?.()` or store it in the outer scope as `let globalSpeedMult = 1.0` and update it in `beginRun`.

### 8.2 Incoming portal — `startGame()` already handles this

Your existing code in `startGame()` reads `?portal=true` and `?ref=` from the URL and calls `buildStartPortal()`. Confirm these lines are present:

```javascript
const params = new URLSearchParams(window.location.search);
const fromPortal = params.get("portal") === "true";
const referrer = params.get("ref") || null;
if (fromPortal && params.get("username")) {
  PLAYER_NAME = params.get("username");
  localStorage.setItem(CFG.KEY_NAME, PLAYER_NAME);
}
threeApp.beginRun({ fromPortal, referrer });
```

### 8.3 Return portal collision — already implemented

`buildStartPortal()` exists in your code. The return portal teleports back to `sp.referrer`. Confirm the tick loop has:

```javascript
if (portalSys.startPortal?.visible) {
  const sp = portalSys.startPortal;
  const sd = shipAnchor.position.distanceTo(sp.group.position);
  if (sd < 16) {
    const back = new URLSearchParams({
      username: PLAYER_NAME || 'anonymous',
      speed: Math.round(getSpeed(diffT)).toString(),
      ref: location.origin,
      hp: '100',
      portal: 'true',
    });
    location.href = `${sp.referrer}?${back}`;
  }
}
```

### 8.4 Portal auto-skip in MP

In MP mode, when a player escapes through the portal, skip the dramatic cutscene and redirect faster (so lobby flow isn't broken). Add this to the portal collision check inside tick:

```javascript
if (!endSeq && portalUnlocked && portalSys.group.visible) {
  const pd = shipAnchor.position.distanceTo(portalSys.group.position);
  if (pd < 18) {
    if (mpMode) {
      // Fast exit for MP — no cutscene
      endSeq = true;
      stopPosBroadcast();
      socket?.emit('portal_escape', { survivalTime: wallTime });
      const p = new URLSearchParams({ username: PLAYER_NAME || 'anonymous', speed: Math.round(getSpeed(diffT)).toString(), ref: location.origin, hp: Math.ceil(health).toString(), color: '#00ffff', won: 'true' });
      setTimeout(() => { location.href = `${CFG.WEBRING_URL}?${p}`; }, 400);
    } else {
      triggerWin();
    }
  }
}
```

---

## PART 9 — DEPLOYMENT CHECKLIST

### Server (Railway.app)
- [ ] `server.js` created at project root with all socket handlers from Part 1
- [ ] `express` and `socket.io` added to `dependencies` in `package.json`
- [ ] Pushed to GitHub
- [ ] Railway project created and linked to repo
- [ ] Start command set to `node server.js`
- [ ] Railway public URL generated and copied
- [ ] `SOCKET_URL` constant in `main.js` updated with Railway URL
- [ ] Test server directly: `curl https://your-railway-url.up.railway.app` (should return empty response, not error)

### Client (Cloudflare Pages)
- [ ] `<script src="https://cdn.socket.io/4.7.2/socket.io.min.js"></script>` added to `index.html` `<head>` before module script
- [ ] `SOCKET_URL` updated in `main.js`
- [ ] Mode select shows on intro screen (SOLO + MULTIPLAYER buttons)
- [ ] SOLO mode works exactly as before — no regression
- [ ] MULTIPLAYER button shows speed selector + room code input
- [ ] CREATE ROOM generates and displays 6-char code
- [ ] Room code is copyable
- [ ] `?room=CODE` in URL auto-fills room code on load
- [ ] JOIN LOBBY button appears after 6 chars entered
- [ ] After joining: lobby screen shows with 20s countdown + player list
- [ ] Countdown starts when 2+ players join
- [ ] Game launches after countdown (or immediately when server fires `session_started`)
- [ ] Other players visible as ships with name tags and speed icons (🐢/🚀)
- [ ] Your bullets broadcast to other players
- [ ] Incoming bullets visible and can hit you
- [ ] Death from MP bullet → 3s respawn overlay → back in game
- [ ] Kill feed appears top-right with scroll
- [ ] Leaderboard shows kills + survival time sorted correctly
- [ ] "is-you" row highlighted in leaderboard
- [ ] Session timer counts down from 3:00
- [ ] Session ended → MP end screen with final standings
- [ ] PLAY AGAIN reloads page
- [ ] QUIT TO JAM goes to webring URL

### Portals
- [ ] `?portal=true` in URL auto-skips intro and shows return portal in-game
- [ ] `?ref=` URL forwarded correctly when player exits
- [ ] `?username=` param used as player name on portal arrival
- [ ] `?room=` param in URL triggers MP setup auto-fill
- [ ] Widget snippet `<script async src="https://vibej.am/2026/widget.js"></script>` in `index.html` (required for jam eligibility)

### Vibe Jam specific
- [ ] No login required to play
- [ ] Room code shareable without auth
- [ ] Game loads instantly — no loading screen
- [ ] Game works on mobile (touch)
- [ ] Widget JS snippet present (required — disqualified without it)

---

## PART 10 — QUICK WINS FOR JUDGES

Small touches that dramatically improve judge experience:

1. **Share link on lobby screen** — construct `https://skybreak.xyz?room=ABCDEF` and show it in the lobby. One click to invite friends.
2. **Kill quote in AI dialogue** — when you score a kill, AI says something snarky (`"${victimName} deleted. adding to my collection."`)
3. **Speed shows in leaderboard** — add 🐢/🚀 next to name in the live leaderboard
4. **Arrival message** — when `?portal=true`, AI says something like: "you arrived through a tear. interesting. now survive."
5. **Disconnect message** — when someone disconnects, kill feed says their name, not just "a pilot"
6. **Portal counter** — show in HUD `"X pilots escaped"` during MP session

---

## SCORE IMPACT SUMMARY

| Feature | What judges see | Prize relevance |
|---|---|---|
| Multiplayer lobby + room codes | Unique mechanic, instant play | Most Popular |
| Speed asymmetry | Creative design decision, skill trade-off | Innovation |
| Kill leaderboard | Competitive hook, replayability | Most Played |
| PvP bullets + respawn | Clip-worthy moments | Viral / Most Popular |
| Portal webring | Webring participation, return portal | Portal bonus prize |
| No login + code sharing | Rule 05 compliant | Eligibility |
| AI commentary on kills | Consistent theme | Atmosphere / judges love it |