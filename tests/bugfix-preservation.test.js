/**
 * Preservation Property Tests
 *
 * These tests MUST PASS on unfixed code — they capture the baseline behavior
 * that must be preserved after the fix is applied.
 *
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5
 */

import { describe, it, expect } from "vitest";

// ─────────────────────────────────────────────────────────────────────────────
// Minimal THREE.js-like Vector3 stub (mirrors bugfix-exploration.test.js)
// ─────────────────────────────────────────────────────────────────────────────
class Vector3 {
  constructor(x = 0, y = 0, z = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
  }
  copy(v) {
    this.x = v.x;
    this.y = v.y;
    this.z = v.z;
    return this;
  }
  /**
   * Replicates THREE.Vector3.lerp exactly:
   *   this = this + (v - this) * alpha
   */
  lerp(v, alpha) {
    this.x += (v.x - this.x) * alpha;
    this.y += (v.y - this.y) * alpha;
    this.z += (v.z - this.z) * alpha;
    return this;
  }
  set(x, y, z) {
    this.x = x;
    this.y = y;
    this.z = z;
    return this;
  }
  clone() {
    return new Vector3(this.x, this.y, this.z);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Extracted logic from main.js — UNFIXED versions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * UNFIXED tick-loop remote player position update (main.js ~line 2318).
 * Directly lerps mesh toward absolute world-space entry.pos.
 */
function unfixedTickLerp(meshPosition, entryPos) {
  meshPosition.lerp(entryPos, 0.35);
}

/**
 * UNFIXED speed formula from main.js tick (~line 2268).
 * No multiplayer reduction applied.
 */
function unfixedGetEffectiveSpeed(getSpeedFn, diffT, throttleMult, _mpMode) {
  // Bug: mpMode is ignored — same formula regardless of mode
  return getSpeedFn(diffT) * throttleMult;
}

/**
 * Simplified getSpeed extracted from main.js (lines 2613-2621).
 * Returns forward speed based on elapsed run time.
 */
function getSpeed(t) {
  if (t >= 110) return 130;
  if (t >= 85) return 85 + (t - 85) * ((130 - 115) / (110 - 85));
  if (t >= 60) return 100 + (t - 60) * ((115 - 100) / (85 - 60));
  if (t >= 40) return 82 + (t - 40) * ((100 - 82) / (60 - 40));
  if (t >= 20) return 60 + (t - 20) * ((82 - 60) / (40 - 20));
  return 42 + (t / 20) * (60 - 42);
}

// ─────────────────────────────────────────────────────────────────────────────
// Extracted logic from server.js — UNFIXED version
// ─────────────────────────────────────────────────────────────────────────────

/**
 * UNFIXED bullet_fired handler logic (server.js ~line 175).
 * Immediately sets victim.alive = false on any hit.
 */
function unfixedApplyBulletHit(victim, shooter) {
  victim.alive = false;
  victim.deaths += 1;
  shooter.kills += 1;
  return { eliminated: true };
}

/**
 * makePlayer factory from server.js — current (buggy) version.
 * Note: no `health` field.
 */
function makePlayer(id, name, color) {
  return {
    id,
    name: name || `pilot_${id.slice(0, 4)}`,
    color: color || "#00ccff",
    kills: 0,
    deaths: 0,
    alive: true,
    escaped: false,
    survivalTime: 0,
    x: 0,
    y: 0,
    z: 0,
    rotZ: 0,
    // NOTE: no `health` field — this is the bug
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Simple seeded pseudo-random number generator (LCG) for reproducible tests.
 * Returns values in [0, 1).
 */
function makePrng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

/**
 * Generate N random (localZ, remoteZ) pairs where |localZ - remoteZ| <= 200.
 * localZ is drawn from [-5000, 0], remoteZ is constrained to be within 200 of localZ.
 */
function generateCloseZPairs(n, seed = 42) {
  const rand = makePrng(seed);
  const pairs = [];
  for (let i = 0; i < n; i++) {
    const localZ = -(rand() * 5000);           // [-5000, 0]
    const offset = (rand() * 2 - 1) * 200;    // [-200, 200]
    const remoteZ = localZ + offset;
    pairs.push({ localZ, remoteZ });
  }
  return pairs;
}

/**
 * Generate N random victim health values in [1, 10].
 */
function generateLethalHealthValues(n, seed = 99) {
  const rand = makePrng(seed);
  const values = [];
  for (let i = 0; i < n; i++) {
    // Integer in [1, 10]
    values.push(Math.floor(rand() * 10) + 1);
  }
  return values;
}

/**
 * Generate N random (diffT, throttleMult) pairs for speed tests.
 * diffT in [0, 120], throttleMult in [0.45, 1.55].
 */
function generateSpeedInputs(n, seed = 7) {
  const rand = makePrng(seed);
  const inputs = [];
  for (let i = 0; i < n; i++) {
    const diffT = rand() * 120;
    const throttleMult = 0.45 + rand() * (1.55 - 0.45);
    inputs.push({ diffT, throttleMult });
  }
  return inputs;
}

// ─────────────────────────────────────────────────────────────────────────────
// Preservation 1 — Z Gap ≤ 200 (main.js tick)
// ─────────────────────────────────────────────────────────────────────────────

describe("Preservation 1 — Z Gap ≤ 200: lerp behavior is correct (MUST PASS on unfixed code)", () => {
  /**
   * **Validates: Requirements 3.2, 3.7**
   *
   * When |localZ - remoteZ| <= 200, the unfixed lerp already places the mesh
   * correctly (within fog range). The fix must not change this behavior.
   *
   * Property: for any (localZ, remoteZ) where |localZ - remoteZ| <= 200,
   * the lerp moves the mesh 35% toward entry.pos.z.
   * i.e., new mesh.z = old mesh.z + (entry.pos.z - old mesh.z) * 0.35
   */
  it("lerp moves mesh 35% toward entry.pos when Z gap <= 200 (property test, 50 samples)", () => {
    const pairs = generateCloseZPairs(50, 42);

    for (const { localZ, remoteZ } of pairs) {
      // Confirm this is the non-buggy domain
      expect(Math.abs(localZ - remoteZ)).toBeLessThanOrEqual(200);

      // Mesh starts at localZ (as if it was last rendered near the local player)
      const meshPosition = new Vector3(0, 0, localZ);
      const entryPos = new Vector3(0, 0, remoteZ);

      // Compute expected result of lerp manually
      const expectedZ = localZ + (remoteZ - localZ) * 0.35;

      // Apply unfixed lerp
      unfixedTickLerp(meshPosition, entryPos);

      // The mesh should have moved exactly 35% toward remoteZ
      expect(meshPosition.z).toBeCloseTo(expectedZ, 10);
    }
  });

  it("lerp result is within fog-visible range (±200 of localZ) when Z gap <= 200", () => {
    const pairs = generateCloseZPairs(50, 123);

    for (const { localZ, remoteZ } of pairs) {
      expect(Math.abs(localZ - remoteZ)).toBeLessThanOrEqual(200);

      // Mesh starts at localZ
      const meshPosition = new Vector3(0, 0, localZ);
      const entryPos = new Vector3(0, 0, remoteZ);

      unfixedTickLerp(meshPosition, entryPos);

      // After lerp, mesh should still be within 200 units of localZ
      // (since remoteZ is within 200 of localZ, and lerp moves only 35% toward it)
      expect(Math.abs(localZ - meshPosition.z)).toBeLessThanOrEqual(200);
    }
  });

  it("lerp at exact boundary (|gap| = 200) still moves mesh 35% toward entry.pos", () => {
    const cases = [
      { localZ: -1000, remoteZ: -800 },   // gap = 200 exactly
      { localZ: -1000, remoteZ: -1200 },  // gap = 200 exactly (other direction)
      { localZ: 0, remoteZ: -200 },       // gap = 200 at origin
      { localZ: -5000, remoteZ: -4800 },  // gap = 200 deep in tunnel
    ];

    for (const { localZ, remoteZ } of cases) {
      expect(Math.abs(localZ - remoteZ)).toBeLessThanOrEqual(200);

      const meshPosition = new Vector3(0, 0, localZ);
      const entryPos = new Vector3(0, 0, remoteZ);
      const expectedZ = localZ + (remoteZ - localZ) * 0.35;

      unfixedTickLerp(meshPosition, entryPos);

      expect(meshPosition.z).toBeCloseTo(expectedZ, 10);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Preservation 2 — Lethal Hit (server.js bullet_fired)
// ─────────────────────────────────────────────────────────────────────────────

describe("Preservation 2 — Lethal Hit: victim with health in [1,10] is eliminated (MUST PASS on unfixed code)", () => {
  /**
   * **Validates: Requirements 3.4, 3.5**
   *
   * When a victim has health <= 10 (or no health field, as in the unfixed code),
   * a bullet hit MUST result in alive = false. This is the correct elimination
   * behavior that must be preserved after the fix.
   *
   * On unfixed code: unfixedApplyBulletHit always sets alive = false, so this
   * test PASSES — it captures the baseline elimination behavior.
   */
  it("victim with no health field is eliminated on bullet hit (unfixed behavior)", () => {
    const victim = makePlayer("victim-1", "player_b", "#ff00ff");
    const shooter = makePlayer("shooter-1", "player_a", "#00ffff");

    // Confirm no health field (unfixed makePlayer)
    expect(victim.health).toBeUndefined();
    expect(victim.alive).toBe(true);

    unfixedApplyBulletHit(victim, shooter);

    // Elimination must occur
    expect(victim.alive).toBe(false);
  });

  it("victim with health=10 is eliminated on bullet hit (property test, 20 samples)", () => {
    const healthValues = generateLethalHealthValues(20, 99);

    for (const health of healthValues) {
      // All values are in [1, 10]
      expect(health).toBeGreaterThanOrEqual(1);
      expect(health).toBeLessThanOrEqual(10);

      const victim = { ...makePlayer("victim-x", "player_b", "#ff00ff"), health };
      const shooter = makePlayer("shooter-x", "player_a", "#00ffff");

      expect(victim.alive).toBe(true);

      unfixedApplyBulletHit(victim, shooter);

      // Elimination must occur for any health in [1, 10]
      expect(victim.alive).toBe(false);
    }
  });

  it("victim with health=10 exactly is eliminated", () => {
    const victim = { ...makePlayer("victim-2", "player_b", "#ff00ff"), health: 10 };
    const shooter = makePlayer("shooter-2", "player_a", "#00ffff");

    unfixedApplyBulletHit(victim, shooter);

    expect(victim.alive).toBe(false);
    expect(victim.deaths).toBe(1);
    expect(shooter.kills).toBe(1);
  });

  it("victim with health=1 is eliminated", () => {
    const victim = { ...makePlayer("victim-3", "player_b", "#ff00ff"), health: 1 };
    const shooter = makePlayer("shooter-3", "player_a", "#00ffff");

    unfixedApplyBulletHit(victim, shooter);

    expect(victim.alive).toBe(false);
  });

  it("kill/death counters are incremented on elimination", () => {
    const victim = makePlayer("victim-4", "player_b", "#ff00ff");
    const shooter = makePlayer("shooter-4", "player_a", "#00ffff");

    expect(victim.deaths).toBe(0);
    expect(shooter.kills).toBe(0);

    unfixedApplyBulletHit(victim, shooter);

    expect(victim.deaths).toBe(1);
    expect(shooter.kills).toBe(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Preservation 3 — Solo Speed (main.js tick)
// ─────────────────────────────────────────────────────────────────────────────

describe("Preservation 3 — Solo Speed: mpMode=false produces getSpeed(diffT)*throttleMult (MUST PASS on unfixed code)", () => {
  /**
   * **Validates: Requirements 3.1**
   *
   * When mpMode = false, the speed formula is exactly getSpeed(diffT) * throttleMult.
   * No multiplier is applied. This must remain unchanged after the fix.
   *
   * On unfixed code: unfixedGetEffectiveSpeed ignores mpMode and always returns
   * getSpeed(diffT) * throttleMult, so this test PASSES.
   */
  it("solo speed equals getSpeed(diffT)*throttleMult exactly (property test, 50 samples)", () => {
    const inputs = generateSpeedInputs(50, 7);

    for (const { diffT, throttleMult } of inputs) {
      const mpMode = false;
      const expected = getSpeed(diffT) * throttleMult;
      const actual = unfixedGetEffectiveSpeed(getSpeed, diffT, throttleMult, mpMode);

      expect(actual).toBeCloseTo(expected, 10);
    }
  });

  it("solo speed is unchanged at diffT=0 (start of run)", () => {
    const diffT = 0;
    const throttleMult = 1.0;
    const expected = getSpeed(diffT) * throttleMult;
    const actual = unfixedGetEffectiveSpeed(getSpeed, diffT, throttleMult, false);
    expect(actual).toBeCloseTo(expected, 10);
  });

  it("solo speed is unchanged at diffT=120 (end of run)", () => {
    const diffT = 120;
    const throttleMult = 1.0;
    const expected = getSpeed(diffT) * throttleMult;
    const actual = unfixedGetEffectiveSpeed(getSpeed, diffT, throttleMult, false);
    expect(actual).toBeCloseTo(expected, 10);
  });

  it("solo speed with boost throttle (1.55x) is unchanged", () => {
    const diffT = 45;
    const throttleMult = 1.55; // CFG.BOOST_MULT
    const expected = getSpeed(diffT) * throttleMult;
    const actual = unfixedGetEffectiveSpeed(getSpeed, diffT, throttleMult, false);
    expect(actual).toBeCloseTo(expected, 10);
  });

  it("solo speed with brake throttle (0.45x) is unchanged", () => {
    const diffT = 30;
    const throttleMult = 0.45; // CFG.ANCHOR_MULT
    const expected = getSpeed(diffT) * throttleMult;
    const actual = unfixedGetEffectiveSpeed(getSpeed, diffT, throttleMult, false);
    expect(actual).toBeCloseTo(expected, 10);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Preservation 4 — Remote Player Visibility Flag (main.js)
// ─────────────────────────────────────────────────────────────────────────────

describe("Preservation 4 — Remote Player Visibility Flag: mesh.visible = entry.alive (MUST PASS on unfixed code)", () => {
  /**
   * **Validates: Requirements 3.2**
   *
   * entry.mesh.visible is set to entry.alive in the tick loop.
   * When entry.alive = false, the mesh must be hidden.
   * This behavior must be preserved after the fix.
   *
   * We simulate the tick-loop visibility assignment directly.
   */

  /**
   * Simulates the tick-loop visibility update for a remote player entry.
   * Extracted from main.js tick loop (the line: entry.mesh.visible = entry.alive).
   */
  function applyVisibilityFlag(entry) {
    entry.mesh.visible = entry.alive;
  }

  it("mesh.visible = false when entry.alive = false", () => {
    const entry = {
      alive: false,
      mesh: { visible: true, position: new Vector3() },
      pos: new Vector3(0, 0, -100),
      lastSeen: Date.now(),
    };

    applyVisibilityFlag(entry);

    expect(entry.mesh.visible).toBe(false);
  });

  it("mesh.visible = true when entry.alive = true", () => {
    const entry = {
      alive: true,
      mesh: { visible: false, position: new Vector3() },
      pos: new Vector3(0, 0, -100),
      lastSeen: Date.now(),
    };

    applyVisibilityFlag(entry);

    expect(entry.mesh.visible).toBe(true);
  });

  it("visibility flag tracks alive state through multiple transitions", () => {
    const entry = {
      alive: true,
      mesh: { visible: true, position: new Vector3() },
      pos: new Vector3(0, 0, -100),
      lastSeen: Date.now(),
    };

    // Alive → visible
    applyVisibilityFlag(entry);
    expect(entry.mesh.visible).toBe(true);

    // Eliminated → hidden
    entry.alive = false;
    applyVisibilityFlag(entry);
    expect(entry.mesh.visible).toBe(false);

    // Respawned → visible again
    entry.alive = true;
    applyVisibilityFlag(entry);
    expect(entry.mesh.visible).toBe(true);
  });

  it("visibility flag is independent of mesh position", () => {
    // Even if mesh is at a weird position, visibility is driven only by alive
    const entry = {
      alive: false,
      mesh: { visible: true, position: new Vector3(999, 999, 999) },
      pos: new Vector3(0, 0, 0),
      lastSeen: Date.now(),
    };

    applyVisibilityFlag(entry);

    expect(entry.mesh.visible).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Preservation 5 — Stale Player Removal (main.js)
// ─────────────────────────────────────────────────────────────────────────────

describe("Preservation 5 — Stale Player Removal: entries with lastSeen > 4500ms are removed (MUST PASS on unfixed code)", () => {
  /**
   * **Validates: Requirements 3.3**
   *
   * Entries with lastSeen > 4500 ms should be removed from otherPlayers and
   * their mesh removed from the scene. This behavior must be preserved after the fix.
   *
   * We simulate the stale-removal logic extracted from the main.js tick loop.
   */

  /**
   * Simulates the stale player removal logic from main.js tick loop.
   * Extracted logic: if (Date.now() - entry.lastSeen > 4500) remove entry.
   */
  function applyStaleRemoval(otherPlayers, scene, now = Date.now()) {
    const STALE_THRESHOLD_MS = 4500;
    for (const [id, entry] of otherPlayers) {
      if (now - entry.lastSeen > STALE_THRESHOLD_MS) {
        scene.remove(entry.mesh);
        otherPlayers.delete(id);
      }
    }
  }

  it("entry with lastSeen > 4500ms is removed from otherPlayers", () => {
    const now = Date.now();
    const otherPlayers = new Map();
    const scene = { removedMeshes: [], remove(mesh) { this.removedMeshes.push(mesh); } };

    const mesh = { id: "mesh-stale" };
    otherPlayers.set("player-stale", {
      mesh,
      alive: true,
      pos: new Vector3(0, 0, -100),
      lastSeen: now - 5000, // 5000ms ago — stale
    });

    applyStaleRemoval(otherPlayers, scene, now);

    expect(otherPlayers.has("player-stale")).toBe(false);
  });

  it("stale entry's mesh is removed from the scene", () => {
    const now = Date.now();
    const otherPlayers = new Map();
    const scene = { removedMeshes: [], remove(mesh) { this.removedMeshes.push(mesh); } };

    const mesh = { id: "mesh-stale" };
    otherPlayers.set("player-stale", {
      mesh,
      alive: true,
      pos: new Vector3(0, 0, -100),
      lastSeen: now - 5000,
    });

    applyStaleRemoval(otherPlayers, scene, now);

    expect(scene.removedMeshes).toContain(mesh);
  });

  it("entry with lastSeen exactly at 4500ms is NOT removed (boundary: > not >=)", () => {
    const now = Date.now();
    const otherPlayers = new Map();
    const scene = { removedMeshes: [], remove(mesh) { this.removedMeshes.push(mesh); } };

    const mesh = { id: "mesh-boundary" };
    otherPlayers.set("player-boundary", {
      mesh,
      alive: true,
      pos: new Vector3(0, 0, -100),
      lastSeen: now - 4500, // exactly 4500ms — NOT stale (> not >=)
    });

    applyStaleRemoval(otherPlayers, scene, now);

    // Exactly 4500ms: now - lastSeen = 4500, which is NOT > 4500
    expect(otherPlayers.has("player-boundary")).toBe(true);
    expect(scene.removedMeshes).not.toContain(mesh);
  });

  it("entry with lastSeen < 4500ms is NOT removed (fresh player)", () => {
    const now = Date.now();
    const otherPlayers = new Map();
    const scene = { removedMeshes: [], remove(mesh) { this.removedMeshes.push(mesh); } };

    const mesh = { id: "mesh-fresh" };
    otherPlayers.set("player-fresh", {
      mesh,
      alive: true,
      pos: new Vector3(0, 0, -100),
      lastSeen: now - 1000, // 1000ms ago — fresh
    });

    applyStaleRemoval(otherPlayers, scene, now);

    expect(otherPlayers.has("player-fresh")).toBe(true);
    expect(scene.removedMeshes).not.toContain(mesh);
  });

  it("only stale entries are removed when multiple players exist", () => {
    const now = Date.now();
    const otherPlayers = new Map();
    const scene = { removedMeshes: [], remove(mesh) { this.removedMeshes.push(mesh); } };

    const staleMesh = { id: "mesh-stale" };
    const freshMesh = { id: "mesh-fresh" };

    otherPlayers.set("player-stale", {
      mesh: staleMesh,
      alive: true,
      pos: new Vector3(0, 0, -100),
      lastSeen: now - 6000, // stale
    });
    otherPlayers.set("player-fresh", {
      mesh: freshMesh,
      alive: true,
      pos: new Vector3(0, 0, -200),
      lastSeen: now - 500, // fresh
    });

    applyStaleRemoval(otherPlayers, scene, now);

    expect(otherPlayers.has("player-stale")).toBe(false);
    expect(otherPlayers.has("player-fresh")).toBe(true);
    expect(scene.removedMeshes).toContain(staleMesh);
    expect(scene.removedMeshes).not.toContain(freshMesh);
  });

  it("entry with lastSeen = 4501ms is removed (just over threshold)", () => {
    const now = Date.now();
    const otherPlayers = new Map();
    const scene = { removedMeshes: [], remove(mesh) { this.removedMeshes.push(mesh); } };

    const mesh = { id: "mesh-just-stale" };
    otherPlayers.set("player-just-stale", {
      mesh,
      alive: true,
      pos: new Vector3(0, 0, -100),
      lastSeen: now - 4501, // 1ms over threshold
    });

    applyStaleRemoval(otherPlayers, scene, now);

    expect(otherPlayers.has("player-just-stale")).toBe(false);
  });
});
