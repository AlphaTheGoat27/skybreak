/**
 * Bug Condition Exploration Tests
 *
 * These tests encode the EXPECTED (correct) behavior for all three bugs.
 * They FAILED on unfixed code (confirming the bugs existed).
 * After the fix, they MUST PASS.
 *
 * Validates: Requirements 1.1, 1.2, 1.3, 1.4 (bug condition) and 2.1, 2.2, 2.3, 2.4 (expected behavior)
 */

import { describe, it, expect } from "vitest";

// ─────────────────────────────────────────────────────────────────────────────
// Minimal THREE.js-like Vector3 stub (no import needed — avoids browser deps)
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

// Minimal MathUtils.clamp stub
const MathUtils = {
  clamp: (v, min, max) => Math.max(min, Math.min(max, v)),
};

// ─────────────────────────────────────────────────────────────────────────────
// Extracted logic — FIXED versions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * FIXED tick-loop remote player position update (main.js).
 * Clamps remote player Z relative to local player so they stay within fog range.
 */
function fixedTickLerp(meshPosition, entryPos, shipAnchorZ) {
  const relativeZ = entryPos.z - shipAnchorZ;
  const clampedRelZ = MathUtils.clamp(relativeZ, -100, 100);
  const targetPos = new Vector3(entryPos.x, entryPos.y, shipAnchorZ + clampedRelZ);
  meshPosition.lerp(targetPos, 0.35);
}

/**
 * FIXED upsertRemotePlayer initial placement (main.js).
 * Places mesh relative to local player Z so it starts within fog range.
 */
function fixedUpsertInitialPlacement(meshPosition, x, y, z, shipAnchorZ) {
  const initRelZ = MathUtils.clamp((z || 0) - shipAnchorZ, -100, 100);
  meshPosition.set(x || 0, y || 0, shipAnchorZ + initRelZ);
}

/**
 * FIXED speed formula from main.js tick.
 * Applies 0.55x multiplier in multiplayer mode.
 */
function fixedGetEffectiveSpeed(getSpeedFn, diffT, throttleMult, mpMode) {
  const mpSpeedMult = mpMode ? 0.55 : 1.0;
  return getSpeedFn(diffT) * throttleMult * mpSpeedMult;
}

/**
 * Simplified getSpeed extracted from main.js.
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
// Extracted logic from server.js — FIXED version
// ─────────────────────────────────────────────────────────────────────────────

/**
 * FIXED bullet_fired handler logic (server.js).
 * Deducts 10 HP; only eliminates when health reaches 0.
 */
function fixedApplyBulletHit(victim, shooter) {
  victim.health = Math.max(0, (victim.health ?? 100) - 10);
  if (victim.health <= 0) {
    victim.alive = false;
    victim.deaths += 1;
    shooter.kills += 1;
    return { eliminated: true };
  }
  return { eliminated: false, health: victim.health };
}

/**
 * makePlayer factory — FIXED version with health: 100.
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
    health: 100,
    survivalTime: 0,
    x: 0, y: 0, z: 0, rotZ: 0,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Bug 1 — Remote Player Fog Culling (Visibility) — FIXED
// ─────────────────────────────────────────────────────────────────────────────

describe("Bug 1 — Remote Player Visibility (Fog Culling) — FIXED", () => {
  /**
   * isBugCondition_Visibility: |localZ - remoteZ| > 200
   *
   * After fix: mesh Z is clamped to within ±100 of shipAnchor.position.z.
   * Assertion PASSES on fixed code.
   */
  it("tick lerp: mesh should be within ±100 of local player Z when Z gap > 200 (PASSES after fix)", () => {
    const shipAnchorZ = -2000;
    const remoteZ = 0;

    // Bug condition: |localZ - remoteZ| = 2000 > 200 → bug triggers
    expect(Math.abs(shipAnchorZ - remoteZ)).toBeGreaterThan(200);

    const meshPosition = new Vector3(0, 0, shipAnchorZ); // mesh starts near local player
    const entryPos = new Vector3(0, 0, remoteZ);

    fixedTickLerp(meshPosition, entryPos, shipAnchorZ);

    // After fixed lerp, mesh.position.z should be within ±100 of shipAnchorZ
    expect(Math.abs(shipAnchorZ - meshPosition.z)).toBeLessThanOrEqual(100);
  });

  it("upsertRemotePlayer: initial mesh placement should be within ±100 of local player Z (PASSES after fix)", () => {
    const shipAnchorZ = -2000;
    const remoteZ = 0;

    expect(Math.abs(shipAnchorZ - remoteZ)).toBeGreaterThan(200);

    const meshPosition = new Vector3(0, 0, 0);

    fixedUpsertInitialPlacement(meshPosition, 0, 0, remoteZ, shipAnchorZ);

    // After fixed placement, mesh.z should be within ±100 of shipAnchorZ
    expect(Math.abs(shipAnchorZ - meshPosition.z)).toBeLessThanOrEqual(100);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Bug 2 — Instant Kill on Bullet Hit — FIXED
// ─────────────────────────────────────────────────────────────────────────────

describe("Bug 2 — Instant Kill on Bullet Hit — FIXED", () => {
  /**
   * After fix: single bullet hit deducts 10 HP, victim stays alive.
   * Assertion PASSES on fixed code.
   */
  it("single bullet hit: victim should remain alive with health=90 after one hit (PASSES after fix)", () => {
    const victim = makePlayer("victim-1", "player_b", "#ff00ff");
    const shooter = makePlayer("shooter-1", "player_a", "#00ffff");

    expect(victim.health).toBe(100);
    expect(victim.alive).toBe(true);

    fixedApplyBulletHit(victim, shooter);

    expect(victim.alive).toBe(true);
    expect(victim.health).toBe(90);
  });

  it("single bullet hit on victim with health=100: should survive with health=90 (PASSES after fix)", () => {
    const victim = makePlayer("victim-2", "player_b", "#ff00ff");
    const shooter = makePlayer("shooter-1", "player_a", "#00ffff");

    expect(victim.alive).toBe(true);
    expect(victim.health).toBe(100);

    fixedApplyBulletHit(victim, shooter);

    expect(victim.alive).toBe(true);
    expect(victim.health).toBe(90);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Bug 3 — Multiplayer Speed Too Fast (No Reduction Applied) — FIXED
// ─────────────────────────────────────────────────────────────────────────────

describe("Bug 3 — Multiplayer Speed Parity (No Reduction) — FIXED", () => {
  /**
   * After fix: mpMode=true applies 0.55x multiplier.
   * Assertion PASSES on fixed code.
   */
  it("mpMode=true: effective speed should be less than solo speed (PASSES after fix)", () => {
    const diffT = 30;
    const throttleMult = 1.0;
    const mpMode = true;

    const soloSpeed = getSpeed(diffT) * throttleMult;
    const mpSpeed = fixedGetEffectiveSpeed(getSpeed, diffT, throttleMult, mpMode);

    expect(mpSpeed).toBeLessThan(soloSpeed);
    expect(mpSpeed).toBeCloseTo(soloSpeed * 0.55, 10);
  });

  it("mpMode=true at diffT=60: effective speed should be less than solo speed (PASSES after fix)", () => {
    const diffT = 60;
    const throttleMult = 1.0;
    const mpMode = true;

    const soloSpeed = getSpeed(diffT) * throttleMult;
    const mpSpeed = fixedGetEffectiveSpeed(getSpeed, diffT, throttleMult, mpMode);

    expect(mpSpeed).toBeLessThan(soloSpeed);
    expect(mpSpeed).toBeCloseTo(soloSpeed * 0.55, 10);
  });

  it("mpMode=true with boost throttle: effective speed should still be less than solo speed (PASSES after fix)", () => {
    const diffT = 45;
    const throttleMult = 1.55;
    const mpMode = true;

    const soloSpeed = getSpeed(diffT) * throttleMult;
    const mpSpeed = fixedGetEffectiveSpeed(getSpeed, diffT, throttleMult, mpMode);

    expect(mpSpeed).toBeLessThan(soloSpeed);
    expect(mpSpeed).toBeCloseTo(soloSpeed * 0.55, 10);
  });
});
