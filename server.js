import "dotenv/config";
import express from "express";
import http from "http";
import { Server } from "socket.io";

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: process.env.CORS_ORIGIN || "*" },
  pingInterval: 2000,
  pingTimeout: 5000,
});

const LOBBY_WAIT = 20;
const SESSION_TIME = 180;
const MAX_PLAYERS = 8;
const rooms = new Map();
const publicRooms = new Set();

function makeCode() { return Math.random().toString(36).substring(2, 8).toUpperCase(); }
function randomColor() {
  const c = ["#00ffff", "#ff00ff", "#ffff00", "#00ff88", "#ff6600", "#88aaff", "#ff4488", "#44ffbb"];
  return c[Math.floor(Math.random() * c.length)];
}
function makePlayer(id, name, color) {
  return {
    id,
    name: (name || `pilot_${id.slice(0, 4)}`).replace(/[^a-zA-Z0-9_\-]/g, "").slice(0, 16) || "anon",
    color: color || randomColor(),
    kills: 0, deaths: 0, alive: true, escaped: false,
    health: 100,
    survivalTime: 0, x: (Math.random() - 0.5) * 12, y: (Math.random() - 0.5) * 8, z: 0, rotZ: 0,
  };
}

function linePointDistance(from, dir, point) {
  const toPoint = {
    x: point.x - from.x,
    y: point.y - from.y,
    z: point.z - from.z,
  };
  const t = toPoint.x * dir.x + toPoint.y * dir.y + toPoint.z * dir.z;
  if (t < 0 || t > 110) return Infinity;
  const closest = {
    x: from.x + dir.x * t,
    y: from.y + dir.y * t,
    z: from.z + dir.z * t,
  };
  const dx = closest.x - point.x;
  const dy = closest.y - point.y;
  const dz = closest.z - point.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}
function broadcastRoom(code) {
  const room = rooms.get(code);
  if (!room) return;
  io.to(code).emit("room_state", {
    code, status: room.status,
    host: room.host,
    isPublic: !!room.isPublic,
    players: Array.from(room.players.values()).map(p => ({
      id: p.id, name: p.name, color: p.color, kills: p.kills, deaths: p.deaths, alive: p.alive, escaped: p.escaped || false, health: p.health ?? 100, survivalTime: p.survivalTime, z: p.z,
    })),
    startAt: room.startAt, sessionEnd: room.sessionEnd,
  });
}

function startSession(code) {
  const room = rooms.get(code);
  if (!room || room.status !== "lobby") return;
  room.status = "active";
  room.activeCores = new Set();
  room.sessionEnd = Date.now() + SESSION_TIME * 1000;
  io.to(code).emit("session_started", { sessionEnd: room.sessionEnd });
  setTimeout(() => endSession(code), SESSION_TIME * 1000);
}
function endSession(code) {
  const room = rooms.get(code);
  if (!room || room.status === "ended") return;
  room.status = "ended";
  const final = Array.from(room.players.values()).sort((a, b) => (b.kills - a.kills) || (b.survivalTime - a.survivalTime));
  io.to(code).emit("session_ended", { standings: final });
  setTimeout(() => rooms.delete(code), 300000);
}

io.on("connection", (socket) => {
  socket.on("create_room", ({ name, color, code }) => {
    const preferred = (code || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
    const codeValue = preferred || makeCode();
    if (rooms.has(codeValue)) { socket.emit("join_error", "Code already in use"); return; }
    const player = makePlayer(socket.id, name, color);
    rooms.set(codeValue, { code: codeValue, host: socket.id, isPublic: false, players: new Map([[socket.id, player]]), status: "lobby", countdownTimer: null, startAt: null, sessionEnd: null, activeCores: new Set() });
    socket.join(codeValue);
    socket.data.roomCode = codeValue;
    socket.emit("room_created", { code: codeValue });
    socket.emit("room_role", { isHost: true });
    broadcastRoom(codeValue);
  });

  socket.on("join_room", ({ code, name, color }) => {
    const roomCode = (code || "").toUpperCase();
    const room = rooms.get(roomCode);
    if (!room) { socket.emit("join_error", "Room not found"); return; }
    if (room.status !== "lobby") { socket.emit("join_error", "Game already started"); return; }
    if (room.players.size >= MAX_PLAYERS) { socket.emit("join_error", "Room full"); return; }
    const player = makePlayer(socket.id, name, color || randomColor());
    room.players.set(socket.id, player);
    socket.join(roomCode);
    socket.data.roomCode = roomCode;
    socket.emit("room_joined", { code: roomCode });
    socket.emit("room_role", { isHost: room.host === socket.id });
    broadcastRoom(roomCode);
    if (room.isPublic && room.players.size >= 2 && !room.countdownTimer) {
      const startAt = Date.now() + LOBBY_WAIT * 1000;
      room.startAt = startAt;
      room.countdownTimer = setTimeout(() => startSession(roomCode), LOBBY_WAIT * 1000);
      io.to(roomCode).emit("countdown_started", { startAt });
    }
  });

  socket.on("join_public", ({ name, color }) => {
    let targetCode = null;
    for (const code of publicRooms) {
      const room = rooms.get(code);
      if (room && room.status === "lobby" && room.players.size < MAX_PLAYERS) {
        targetCode = code;
        break;
      }
    }
    if (!targetCode) {
      targetCode = makeCode();
      const host = makePlayer(socket.id, name, color);
      rooms.set(targetCode, {
        code: targetCode,
        host: socket.id,
        isPublic: true,
        players: new Map([[socket.id, host]]),
        status: "lobby",
        countdownTimer: null,
        startAt: null,
        sessionEnd: null,
        activeCores: new Set(),
      });
      publicRooms.add(targetCode);
      socket.join(targetCode);
      socket.data.roomCode = targetCode;
      socket.emit("public_joined", { code: targetCode });
      socket.emit("room_role", { isHost: true });
      broadcastRoom(targetCode);
      return;
    }
    const room = rooms.get(targetCode);
    const player = makePlayer(socket.id, name, color || randomColor());
    room.players.set(socket.id, player);
    socket.join(targetCode);
    socket.data.roomCode = targetCode;
    socket.emit("public_joined", { code: targetCode });
    socket.emit("room_role", { isHost: room.host === socket.id });
    broadcastRoom(targetCode);
    if (room.players.size >= 2 && !room.countdownTimer) {
      const startAt = Date.now() + LOBBY_WAIT * 1000;
      room.startAt = startAt;
      room.countdownTimer = setTimeout(() => startSession(targetCode), LOBBY_WAIT * 1000);
      io.to(targetCode).emit("countdown_started", { startAt });
    }
  });

  socket.on("start_room", ({ code }) => {
    const roomCode = (code || socket.data.roomCode || "").toUpperCase();
    const room = rooms.get(roomCode);
    if (!room || room.status !== "lobby") return;
    if (room.host !== socket.id) return;
    startSession(roomCode);
  });

  socket.on("player_state", ({ x, y, z, rotZ, survivalTime, alive }) => {
    const roomCode = socket.data.roomCode;
    if (!roomCode) return;
    const room = rooms.get(roomCode);
    if (!room || room.status !== "active") return;
    const player = room.players.get(socket.id);
    if (!player) return;

    player.x = Number.isFinite(x) ? x : player.x;
    player.y = Number.isFinite(y) ? y : player.y;
    player.z = Number.isFinite(z) ? z : player.z;
    player.rotZ = Number.isFinite(rotZ) ? rotZ : player.rotZ;
    player.survivalTime = Number.isFinite(survivalTime) ? survivalTime : player.survivalTime;
    if (typeof alive === "boolean") player.alive = alive;

    socket.to(roomCode).emit("player_state", {
      id: player.id,
      name: player.name,
      color: player.color,
      x: player.x,
      y: player.y,
      z: player.z,
      rotZ: player.rotZ,
      survivalTime: player.survivalTime,
      alive: player.alive,
    });
  });

  socket.on("bullet_fired", ({ x, y, z, dx, dy, dz }) => {
    const roomCode = socket.data.roomCode;
    if (!roomCode) return;
    const room = rooms.get(roomCode);
    if (!room || room.status !== "active") return;
    const shooter = room.players.get(socket.id);
    if (!shooter || !shooter.alive) return;
    if (![x, y, z, dx, dy, dz].every(Number.isFinite)) return;

    const len = Math.hypot(dx, dy, dz) || 1;
    const dir = { x: dx / len, y: dy / len, z: dz / len };
    const from = { x, y, z };
    let victim = null;
    let bestDist = Infinity;
    const HIT_RADIUS = 2.4;

    for (const [id, p] of room.players) {
      if (id === socket.id || !p.alive) continue;
      const d = linePointDistance(from, dir, p);
      if (d < HIT_RADIUS && d < bestDist) {
        bestDist = d;
        victim = p;
      }
    }

    if (!victim) return;
    victim.health = Math.max(0, (victim.health ?? 100) - 10);
    if (victim.health <= 0) {
      victim.alive = false;
      victim.deaths += 1;
      shooter.kills += 1;

      io.to(roomCode).emit("player_eliminated", {
        killerId: shooter.id,
        killerName: shooter.name,
        victimId: victim.id,
        victimName: victim.name,
      });
      broadcastRoom(roomCode);
    } else {
      io.to(roomCode).emit("player_hit", {
        victimId: victim.id,
        health: victim.health,
        shooterId: shooter.id,
      });
    }
  });

  socket.on("core_spawn", (core) => {
    const roomCode = socket.data.roomCode;
    if (!roomCode) return;
    const room = rooms.get(roomCode);
    if (!room || room.status !== "active") return;
    if (room.host !== socket.id) return;
    if (!core?.id || room.activeCores.has(core.id)) return;
    room.activeCores.add(core.id);
    socket.to(roomCode).emit("core_spawn", core);
  });

  socket.on("core_destroyed", ({ id }) => {
    const roomCode = socket.data.roomCode;
    if (!roomCode || !id) return;
    const room = rooms.get(roomCode);
    if (!room || room.status !== "active") return;
    if (!room.activeCores.has(id)) return;
    room.activeCores.delete(id);
    io.to(roomCode).emit("core_destroyed", { id, by: socket.id });
  });

  socket.on("disconnect", () => {
    const roomCode = socket.data.roomCode;
    if (!roomCode) return;
    const room = rooms.get(roomCode);
    if (!room) return;

    room.players.delete(socket.id);
    io.to(roomCode).emit("player_left", { id: socket.id });

    if (room.players.size === 0) {
      rooms.delete(roomCode);
      publicRooms.delete(roomCode);
      return;
    }

    if (room.host === socket.id) {
      room.host = room.players.keys().next().value;
      io.to(roomCode).emit("room_role", { isHost: false });
      io.to(room.host).emit("room_role", { isHost: true });
    }

    broadcastRoom(roomCode);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`SKYBREAK server :${PORT}`));
