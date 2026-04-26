# Multiplayer Visibility Fix — Bugfix Design

## Overview

Three related multiplayer gameplay bugs degrade the PvP experience in SKYBREAK:

1. **Remote player invisibility** — remote player meshes are placed at absolute world-space Z coordinates in `_scene`. Because `shipAnchor.position.z` decreases continuously (e.g., −2000 after 40 s), any Z divergence between players (e.g., one player dies and respawns at Z=0 while the other is at Z=−2000) pushes the remote mesh far outside the `FogExp2(0x000000, 0.011)` visibility range (~200 units), making them permanently invisible. The fix clamps the rendered Z of remote meshes to within ±100 units of the local player's Z.

2. **Instant kill on bullet hit** — `server.js` sets `victim.alive = false` on the first bullet hit. The intended design is 100 HP with 10 damage per bullet (10 hits to eliminate). The fix adds a `health` field to the server player model and emits a `player_hit` event for non-lethal hits.

3. **Multiplayer speed too fast** — the forward speed is identical in solo and multiplayer, making it very hard for players to see and engage each other. The fix applies a 0.55× speed multiplier when `mpMode` is true.

The fix is minimal and targeted: only the three identified code paths are changed; all other game logic is preserved.

---

## Glossary

- **Bug_Condition (C)**: The condition that triggers a bug — defined separately for each of the three bugs below.
- **Property (P)**: The desired correct behavior when the bug condition holds.
- **Preservation**: Existing behaviors that must remain unchanged after the fix.
- **`shipAnchor`**: The `THREE.Group` in `main.js` whose `position.z` decreases continuously as the local player flies forward through the tunnel.
- **`entry.pos`**: The `THREE.Vector3` stored in `otherPlayers` Map entries, holding the last received absolute world-space position of a remote player.
- **`entry.mesh`**: The `THREE.Group` (ship mesh) added to `_scene` for a remote player.
- **`upsertRemotePlayer`**: The function in `main.js` (line ~1147) that creates or updates a remote player entry when a `player_state` socket event is received.
- **`tick`**: The `requestAnimationFrame` loop in `main.js` that drives all per-frame game logic, including the `entry.mesh.position.lerp(entry.pos, 0.35)` call for remote players.
- **`makePlayer`**: The factory function in `server.js` that creates the server-side player state object.
- **`bullet_fired`**: The socket event handler in `server.js` that performs hit detection and currently sets `victim.alive = false` immediately.
- **`broadcastRoom`**: The function in `server.js` that emits `room_state` to all players in a room.
- **`mpMode`**: The boolean flag in `main.js` that is `true` when the local player is in a multiplayer session.
- **`getSpeed(diffT)`**: The function in `main.js` that returns the current forward speed based on elapsed run time.
- **`throttleMult`**: The multiplier in `main.js` applied to `getSpeed` output for boost/brake; the new `mpSpeedMult` is applied alongside it.
- **`FogExp2(0x000000, 0.011)`**: The exponential fog applied to `_scene`; objects beyond ~200 units from the camera are fully obscured.

---

## Bug Details

### Bug 1 — Remote Player Fog Culling

The bug manifests when a remote player's absolute Z position diverges from the local player's Z position by more than ~200 units. The `tick` loop lerps `entry.mesh.position` directly to `entry.pos` (absolute world-space), so the mesh ends up far from the camera and is fully obscured by `FogExp2`.

**Formal Specification:**
```
FUNCTION isBugCondition_Visibility(localZ, remoteZ)
  INPUT: localZ  — Number (shipAnchor.position.z, e.g. -2000)
         remoteZ — Number (received remote player z, e.g. 0)
  OUTPUT: boolean

  RETURN ABS(localZ - remoteZ) > 200
END FUNCTION
```

**Examples:**
- Local player at Z=−2000, remote player respawned at Z=0 → |−2000 − 0| = 2000 > 200 → **bug triggers**, remote mesh is invisible.
- Local player at Z=−500, remote player at Z=−480 → |−500 − (−480)| = 20 ≤ 200 → **bug does not trigger**, remote mesh is visible.
- Local player at Z=−1000, remote player at Z=−850 → |−1000 − (−850)| = 150 ≤ 200 → **bug does not trigger**, remote mesh is visible.
- Local player at Z=−1000, remote player at Z=−750 → |−1000 − (−750)| = 250 > 200 → **bug triggers**, remote mesh is invisible.

---

### Bug 2 — Instant Kill on Bullet Hit

The bug manifests when any bullet hits a remote player for the first time. The `bullet_fired` handler in `server.js` immediately sets `victim.alive = false` regardless of prior damage, eliminating the player in a single hit.

**Formal Specification:**
```
FUNCTION isBugCondition_InstantKill(victim)
  INPUT: victim — server player object
  OUTPUT: boolean

  RETURN victim.alive = true
         AND "health" field is absent from victim
         AND a bullet has just hit victim
END FUNCTION
```

**Examples:**
- Player A fires one bullet that hits Player B (full health) → Player B is immediately eliminated → **bug triggers**.
- Player A fires nine bullets that hit Player B → Player B should have 10 HP remaining but is eliminated on the first hit → **bug triggers**.
- Player B has 10 HP remaining and is hit → Player B is eliminated → **expected behavior** (not a bug).

---

### Bug 3 — Multiplayer Speed Too Fast

The bug manifests whenever `mpMode` is `true`. The `tick` loop computes `const spd = getSpeed(diffT) * throttleMult` without any multiplayer-specific reduction, so the tunnel speed is identical to solo mode.

**Formal Specification:**
```
FUNCTION isBugCondition_Speed(mpMode)
  INPUT: mpMode — boolean
  OUTPUT: boolean

  RETURN mpMode = true
END FUNCTION
```

**Examples:**
- Solo session: `mpMode = false`, `spd = getSpeed(diffT) * throttleMult` → **no bug**.
- Multiplayer session: `mpMode = true`, `spd = getSpeed(diffT) * throttleMult` (same as solo) → **bug triggers**, players fly past each other too quickly.

---

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- 3.1 Solo mode forward speed MUST remain exactly `getSpeed(diffT) * throttleMult` — the `mpSpeedMult` is only applied when `mpMode` is `true`.
- 3.2 Remote player meshes MUST be hidden (`mesh.visible = false`) when `entry.alive` is `false`, exactly as before.
- 3.3 Remote player entries MUST be removed from the scene after 4500 ms of no state updates, exactly as before.
- 3.4 Bullets that miss all remote players MUST produce no hit or damage effect, exactly as before.
- 3.5 Player elimination (health reaching 0) MUST still broadcast `player_eliminated`, increment kill/death counters, and schedule a respawn after 2200 ms.
- 3.6 Portal escape in multiplayer MUST still record the escape and update leaderboard standings.
- 3.7 The local player's `player_state` socket emission MUST continue to send absolute world-space coordinates — the relative Z offset is applied only on the receiving client's render side.
- 3.8 Mouse clicks, keyboard inputs other than movement, and all non-multiplayer game logic MUST be completely unaffected.

**Scope:**
All inputs that do NOT involve the three identified bug conditions should be completely unaffected by this fix. This includes:
- Solo mode gameplay (speed, rendering, damage)
- Remote player rendering when Z positions are already within 200 units
- Any bullet hit that reduces health to exactly 0 (elimination still occurs)

---

## Hypothesized Root Cause

### Bug 1 — Remote Player Fog Culling

1. **Absolute Z rendering without relative offset**: `entry.mesh.position.lerp(entry.pos, 0.35)` in the `tick` loop places the mesh at the remote player's absolute world-space Z. When players have traveled different distances (e.g., one respawned), the Z gap exceeds the fog visibility range.

2. **No Z clamping in `upsertRemotePlayer`**: The initial `mesh.position.copy(entry.pos)` on first creation also uses absolute Z, so the mesh starts invisible if the Z gap is already large.

3. **Exponential fog density**: `FogExp2(0x000000, 0.011)` makes objects at 200+ units essentially invisible (opacity < 0.1), so even moderate Z divergence causes complete invisibility.

### Bug 2 — Instant Kill

1. **Missing `health` field in `makePlayer`**: The server player object has no `health` property, so the `bullet_fired` handler has no HP to decrement and falls through to immediate elimination.

2. **No damage accumulation logic**: The handler goes directly from hit detection to `victim.alive = false; victim.deaths += 1; shooter.kills += 1` with no intermediate damage state.

3. **No `player_hit` event**: There is no mechanism to inform clients of non-lethal hits, so no visual feedback (hit flash) is possible.

### Bug 3 — Multiplayer Speed

1. **No mode-aware speed multiplier**: The `tick` loop computes `const spd = getSpeed(diffT) * throttleMult` without checking `mpMode`. The `mpMode` flag exists and is accessible in the same scope but is not used in the speed calculation.

---

## Correctness Properties

Property 1: Bug Condition — Remote Player Rendered Within Fog Range

_For any_ pair of (localZ, remoteZ) where `isBugCondition_Visibility` returns true (i.e., `|localZ − remoteZ| > 200`), the fixed `tick` loop SHALL render the remote player's mesh at a Z position within ±100 units of `shipAnchor.position.z`, keeping the mesh within the fog visibility range.

**Validates: Requirements 2.1, 2.2**

Property 2: Preservation — Remote Player Rendering Unchanged When Already Close

_For any_ pair of (localZ, remoteZ) where `isBugCondition_Visibility` returns false (i.e., `|localZ − remoteZ| ≤ 200`), the fixed `tick` loop SHALL produce a rendered mesh Z position that is functionally equivalent to the original `entry.mesh.position.lerp(entry.pos, 0.35)` behavior (within the same fog-visible range).

**Validates: Requirements 3.2, 3.3, 3.7**

Property 3: Bug Condition — Bullet Hit Applies 10 Damage, Not Instant Kill

_For any_ victim where `isBugCondition_InstantKill` returns true (victim is alive and has full or partial health above 10), the fixed `bullet_fired` handler SHALL deduct exactly 10 HP from `victim.health`, leave `victim.alive = true`, and emit a `player_hit` event with the remaining health. The victim SHALL NOT be eliminated.

**Validates: Requirements 2.3**

Property 4: Preservation — Elimination Still Occurs at 0 HP

_For any_ victim where `victim.health <= 10` and a bullet hits them, the fixed `bullet_fired` handler SHALL set `victim.alive = false`, increment `victim.deaths` and `shooter.kills`, emit `player_eliminated`, and schedule a respawn — identical to the original elimination behavior.

**Validates: Requirements 3.4, 3.5**

Property 5: Bug Condition — Multiplayer Speed Is Reduced

_For any_ game session where `isBugCondition_Speed` returns true (`mpMode = true`), the fixed `tick` loop SHALL compute `spd = getSpeed(diffT) * throttleMult * 0.55`, producing a forward speed that is 45% lower than the solo equivalent.

**Validates: Requirements 2.4**

Property 6: Preservation — Solo Speed Is Unchanged

_For any_ game session where `isBugCondition_Speed` returns false (`mpMode = false`), the fixed `tick` loop SHALL compute `spd = getSpeed(diffT) * throttleMult` — identical to the original, with no multiplayer multiplier applied.

**Validates: Requirements 3.1**

---

## Fix Implementation

### Bug 1 — Remote Player Z-Relative Rendering

**File**: `main.js`

**Locations**: `upsertRemotePlayer` function (~line 1147) and the `tick` loop remote player update block (~line 2290).

**Specific Changes**:

1. **`tick` loop — replace direct lerp with clamped relative Z**:
   ```js
   // BEFORE:
   entry.mesh.position.lerp(entry.pos, 0.35);

   // AFTER:
   const relativeZ = entry.pos.z - shipAnchor.position.z;
   const clampedRelZ = THREE.MathUtils.clamp(relativeZ, -100, 100);
   const targetPos = new THREE.Vector3(
     entry.pos.x,
     entry.pos.y,
     shipAnchor.position.z + clampedRelZ
   );
   entry.mesh.position.lerp(targetPos, 0.35);
   ```

2. **`upsertRemotePlayer` — apply same clamping on initial mesh placement**:
   ```js
   // BEFORE (on first creation):
   mesh.position.copy(entry.pos);

   // AFTER:
   const initRelZ = THREE.MathUtils.clamp(
     (z || 0) - shipAnchor.position.z, -100, 100
   );
   mesh.position.set(x || 0, y || 0, shipAnchor.position.z + initRelZ);
   ```

**Rationale**: X and Y positions are bounded (−12 to +12) and are correct as-is. Only Z needs the relative offset because it grows unboundedly as players fly forward. Clamping to ±100 keeps remote players within the fog-visible range (~200 units) even when one player respawns far behind.

---

### Bug 2 — 10 Damage Per Bullet

**File**: `server.js`

**Specific Changes**:

1. **`makePlayer` — add `health` field**:
   ```js
   // BEFORE:
   return {
     id, name, color,
     kills: 0, deaths: 0, alive: true, escaped: false,
     survivalTime: 0, x: 0, y: 0, z: 0, rotZ: 0,
   };

   // AFTER:
   return {
     id, name, color,
     kills: 0, deaths: 0, alive: true, escaped: false,
     health: 100,
     survivalTime: 0, x: 0, y: 0, z: 0, rotZ: 0,
   };
   ```

2. **`bullet_fired` handler — replace instant kill with damage accumulation**:
   ```js
   // BEFORE:
   if (!victim) return;
   victim.alive = false;
   victim.deaths += 1;
   shooter.kills += 1;
   io.to(roomCode).emit("player_eliminated", { ... });
   broadcastRoom(roomCode);
   setTimeout(() => { /* respawn */ }, 2200);

   // AFTER:
   if (!victim) return;
   victim.health = Math.max(0, victim.health - 10);
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
     setTimeout(() => {
       const curRoom = rooms.get(roomCode);
       if (!curRoom || curRoom.status !== "active") return;
       const curVictim = curRoom.players.get(victim.id);
       if (!curVictim) return;
       curVictim.alive = true;
       curVictim.health = 100;
       io.to(roomCode).emit("player_respawned", { id: curVictim.id, name: curVictim.name });
       broadcastRoom(roomCode);
     }, 2200);
   } else {
     io.to(roomCode).emit("player_hit", {
       victimId: victim.id,
       health: victim.health,
       shooterId: shooter.id,
     });
   }
   ```

3. **`broadcastRoom` — include `health` in player state** (optional, for leaderboard health display):
   ```js
   // In the players map inside broadcastRoom:
   // BEFORE:
   { id, name, color, kills, deaths, alive, escaped, survivalTime, z }

   // AFTER:
   { id, name, color, kills, deaths, alive, escaped, health: p.health ?? 100, survivalTime, z }
   ```

**File**: `main.js`

4. **Handle `player_hit` socket event — show hit flash on remote player mesh**:
   ```js
   socket.on("player_hit", ({ victimId, health, shooterId }) => {
     const entry = otherPlayers.get(victimId);
     if (!entry?.mesh) return;
     // Brief color flash on the remote player's marker to indicate damage
     entry.mesh.traverse((child) => {
       if (!child.isMesh || !child.material?.color) return;
       const orig = child.material.color.clone();
       child.material.color.set(0xff4444);
       setTimeout(() => child.material.color.copy(orig), 120);
     });
   });
   ```

---

### Bug 3 — Multiplayer Speed Reduction

**File**: `main.js`

**Location**: `tick` function, ship movement section (~line 2280).

**Specific Change**:
```js
// BEFORE:
const spd = getSpeed(diffT) * throttleMult;

// AFTER:
const mpSpeedMult = mpMode ? 0.55 : 1.0;
const spd = getSpeed(diffT) * throttleMult * mpSpeedMult;
```

**Rationale**: The `mpMode` flag is already in scope in the `tick` closure. The 0.55 multiplier reduces tunnel speed by 45%, giving players significantly more time to see and engage each other. Solo mode is completely unaffected.

---

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate each bug on unfixed code, then verify the fix works correctly and preserves existing behavior.

---

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate each bug BEFORE implementing the fix. Confirm or refute the root cause analysis.

**Test Plan**: Write unit tests that simulate the buggy conditions and assert the incorrect behavior. Run these on the UNFIXED code to observe failures and understand the root cause.

**Test Cases**:

1. **Visibility — Large Z Gap** (will fail on unfixed code):
   Simulate `entry.pos.z = 0`, `shipAnchor.position.z = -2000`. Call the lerp logic. Assert that `entry.mesh.position.z` ends up near −2000 (within ±100), not near 0. On unfixed code, the mesh will be at Z≈0, far from the camera.

2. **Instant Kill — First Hit** (will fail on unfixed code):
   Simulate a `bullet_fired` event hitting a player with full health. Assert `victim.alive === true` and `victim.health === 90`. On unfixed code, `victim.alive` will be `false`.

3. **Speed — Multiplayer Session** (will fail on unfixed code):
   Set `mpMode = true`. Compute `spd = getSpeed(diffT) * throttleMult`. Assert `spd < getSpeed(diffT) * throttleMult * 1.0` (i.e., speed is reduced). On unfixed code, no reduction is applied.

4. **Visibility — Respawn Scenario** (will fail on unfixed code):
   Simulate Player A at Z=−1500, Player B respawns at Z=0. Assert Player B's mesh is rendered within ±100 of Player A's Z. On unfixed code, Player B's mesh will be at Z≈0.

**Expected Counterexamples**:
- Remote player mesh Z position equals `entry.pos.z` (absolute), not clamped relative to `shipAnchor.position.z`.
- `victim.alive` is `false` after a single bullet hit regardless of health.
- `spd` in multiplayer equals solo speed with no reduction.

---

### Fix Checking

**Goal**: Verify that for all inputs where each bug condition holds, the fixed code produces the expected behavior.

**Pseudocode:**
```
// Bug 1
FOR ALL (localZ, remoteZ) WHERE isBugCondition_Visibility(localZ, remoteZ) DO
  renderedZ := tick_fixed(localZ, remoteZ).mesh.position.z
  ASSERT ABS(localZ - renderedZ) <= 100
END FOR

// Bug 2
FOR ALL victim WHERE isBugCondition_InstantKill(victim) DO
  result := bullet_fired_fixed(victim)
  ASSERT victim.health = 90 AND victim.alive = true
END FOR

// Bug 3
FOR ALL session WHERE isBugCondition_Speed(session.mpMode) DO
  spd := getEffectiveSpeed_fixed(session)
  ASSERT spd = getSpeed(session.diffT) * session.throttleMult * 0.55
END FOR
```

---

### Preservation Checking

**Goal**: Verify that for all inputs where each bug condition does NOT hold, the fixed code produces the same result as the original.

**Pseudocode:**
```
// Bug 1
FOR ALL (localZ, remoteZ) WHERE NOT isBugCondition_Visibility(localZ, remoteZ) DO
  ASSERT tick_original(localZ, remoteZ).mesh.position.z
       ≈ tick_fixed(localZ, remoteZ).mesh.position.z
END FOR

// Bug 2
FOR ALL victim WHERE victim.health <= 10 DO
  ASSERT bullet_fired_original(victim).alive = false
       = bullet_fired_fixed(victim).alive
END FOR

// Bug 3
FOR ALL session WHERE NOT isBugCondition_Speed(session.mpMode) DO
  ASSERT getEffectiveSpeed_original(session) = getEffectiveSpeed_fixed(session)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many test cases automatically across the input domain (e.g., random Z positions within the non-buggy range).
- It catches edge cases that manual unit tests might miss (e.g., Z gap exactly at the 200-unit boundary).
- It provides strong guarantees that behavior is unchanged for all non-buggy inputs.

**Test Plan**: Observe behavior on UNFIXED code first for non-buggy inputs, then write property-based tests capturing that behavior.

**Test Cases**:
1. **Z Gap ≤ 200 Preservation**: Generate random (localZ, remoteZ) pairs where `|localZ − remoteZ| ≤ 200`. Verify the fixed lerp target is within 1 unit of the original lerp target.
2. **Lethal Hit Preservation**: Verify that a victim with `health = 10` is still eliminated (alive = false) after a bullet hit in the fixed code.
3. **Solo Speed Preservation**: Set `mpMode = false`. Verify `spd` is exactly `getSpeed(diffT) * throttleMult` with no multiplier applied.
4. **Remote Player Visibility Flag Preservation**: Verify `entry.mesh.visible` is still set to `entry.alive` in both `upsertRemotePlayer` and the tick loop.
5. **Stale Player Removal Preservation**: Verify that entries with `lastSeen > 4500 ms` are still removed from the scene.

---

### Unit Tests

- Test `tick` remote player lerp with Z gap = 0, 100, 200, 201, 500, 2000 — verify rendered Z is always within ±100 of `shipAnchor.position.z`.
- Test `upsertRemotePlayer` initial placement with large Z gap — verify mesh starts within fog range.
- Test `bullet_fired` with victim at 100 HP → expect `health = 90`, `alive = true`, `player_hit` emitted.
- Test `bullet_fired` with victim at 10 HP → expect `health = 0`, `alive = false`, `player_eliminated` emitted.
- Test `bullet_fired` with victim at 20 HP → expect `health = 10`, `alive = true`, `player_hit` emitted.
- Test `makePlayer` — verify `health: 100` is present in the returned object.
- Test speed computation with `mpMode = true` → verify 0.55× reduction.
- Test speed computation with `mpMode = false` → verify no reduction.
- Test respawn after elimination — verify `health` is reset to 100 on respawn.

### Property-Based Tests

- Generate random `(localZ, remoteZ)` pairs across the full range [−5000, 0] × [−5000, 0]. Verify that the fixed rendered Z is always within ±100 of `localZ` (Property 1).
- Generate random `(localZ, remoteZ)` pairs where `|localZ − remoteZ| ≤ 200`. Verify the fixed rendered Z is within 1 unit of the original rendered Z (Property 2 — preservation).
- Generate random victim health values in [11, 100]. Verify that a single bullet hit always results in `alive = true` and `health = original − 10` (Property 3).
- Generate random victim health values in [1, 10]. Verify that a single bullet hit always results in `alive = false` (Property 4 — preservation).
- Generate random `diffT` and `throttleMult` values. Verify that `mpMode = true` always produces exactly 0.55× the solo speed (Property 5).
- Generate random `diffT` and `throttleMult` values. Verify that `mpMode = false` always produces exactly the same speed as the original (Property 6 — preservation).

### Integration Tests

- Full multiplayer session: two clients join, one flies for 30 s while the other stays at Z=0 (simulating respawn). Verify the flying player can see the stationary player's mesh.
- Full multiplayer session: Player A fires 9 bullets at Player B. Verify Player B is still alive after 9 hits and eliminated on the 10th.
- Full multiplayer session: Verify the tunnel speed is visibly slower in multiplayer than in a solo session at the same `diffT`.
- Respawn flow: Verify that after elimination, the respawned player has `health = 100` and is visible to other players.
- Solo mode regression: Start a solo session and verify speed, damage, and rendering are identical to pre-fix behavior.
