# Implementation Plan

- [x] 1. Write bug condition exploration tests
  - **Property 1: Bug Condition** - Remote Fog Culling / Instant Kill / Speed Parity
  - **CRITICAL**: These tests MUST FAIL on unfixed code — failure confirms the bugs exist
  - **DO NOT attempt to fix the tests or the code when they fail**
  - **NOTE**: These tests encode the expected behavior — they will validate the fix when they pass after implementation
  - **GOAL**: Surface counterexamples that demonstrate each bug exists
  - **Scoped PBT Approach**: For deterministic bugs, scope the property to the concrete failing case(s) to ensure reproducibility

  **Bug 1 — Visibility (main.js tick loop)**
  - Simulate `entry.pos.z = 0`, `shipAnchor.position.z = -2000` (isBugCondition_Visibility returns true: |−2000 − 0| = 2000 > 200)
  - Call the current `entry.mesh.position.lerp(entry.pos, 0.35)` logic
  - Assert `Math.abs(shipAnchor.position.z - entry.mesh.position.z) <= 100` (mesh should be near local player)
  - On unfixed code: mesh ends up at Z≈0, assertion FAILS — counterexample documented: `lerp(0, 0.35)` places mesh at absolute Z=0, 2000 units from camera
  - Also test `upsertRemotePlayer` initial placement: remote Z=0, local Z=−2000 → assert initial mesh Z is within ±100 of −2000
  - On unfixed code: `mesh.position.copy(entry.pos)` places mesh at Z=0, assertion FAILS

  **Bug 2 — Instant Kill (server.js bullet_fired)**
  - Simulate a `bullet_fired` event hitting a victim with `health` absent (as in current `makePlayer`) and `alive: true`
  - Assert `victim.alive === true` and `victim.health === 90` after one bullet hit
  - On unfixed code: `victim.alive` is set to `false` immediately, assertion FAILS — counterexample: first hit eliminates player regardless of health
  - Also test: victim with `health: 100` (if field were present) — assert same result

  **Bug 3 — Speed (main.js tick)**
  - Set `mpMode = true`, compute `spd = getSpeed(diffT) * throttleMult` (current formula)
  - Assert `spd < getSpeed(diffT) * throttleMult` (i.e., a reduction is applied)
  - On unfixed code: no reduction exists, `spd === getSpeed(diffT) * throttleMult`, assertion FAILS — counterexample: multiplayer speed equals solo speed

  - Run all three tests on UNFIXED code
  - **EXPECTED OUTCOME**: All three tests FAIL (this is correct — it proves the bugs exist)
  - Document counterexamples found to understand root cause
  - Mark task complete when tests are written, run, and failures are documented
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Non-Buggy Rendering / Lethal Hit / Solo Speed
  - **IMPORTANT**: Follow observation-first methodology — observe UNFIXED code behavior for non-buggy inputs first
  - **Scoped PBT Approach**: Generate random inputs in the non-buggy domain and assert observed behavior is preserved

  **Preservation 1 — Z Gap ≤ 200 (main.js tick)**
  - Observe: for random (localZ, remoteZ) pairs where `|localZ − remoteZ| ≤ 200`, the unfixed lerp places the mesh at `lerp(entry.pos, 0.35)` — i.e., mesh Z moves 35% toward `entry.pos.z`
  - Write property-based test: generate random (localZ, remoteZ) pairs where `|localZ − remoteZ| ≤ 200`; verify fixed rendered Z is within 1 unit of original rendered Z
  - Verify test PASSES on UNFIXED code (baseline confirmed)

  **Preservation 2 — Lethal Hit (server.js bullet_fired)**
  - Observe: victim with `health = 10` (or no health field) hit by a bullet → `victim.alive = false` on unfixed code
  - Write property-based test: generate random victim health values in [1, 10]; verify a single bullet hit always results in `alive = false`
  - Verify test PASSES on UNFIXED code (elimination at 0 HP is preserved)

  **Preservation 3 — Solo Speed (main.js tick)**
  - Observe: `mpMode = false` → `spd = getSpeed(diffT) * throttleMult` with no reduction on unfixed code
  - Write property-based test: generate random `diffT` and `throttleMult` values with `mpMode = false`; verify `spd` equals exactly `getSpeed(diffT) * throttleMult`
  - Verify test PASSES on UNFIXED code (solo speed baseline confirmed)

  **Preservation 4 — Remote Player Visibility Flag (main.js)**
  - Observe: `entry.mesh.visible` is set to `entry.alive` in both `upsertRemotePlayer` and the tick loop
  - Write test: set `entry.alive = false`, run tick update, assert `entry.mesh.visible === false`
  - Verify test PASSES on UNFIXED code

  **Preservation 5 — Stale Player Removal (main.js)**
  - Observe: entries with `lastSeen > 4500 ms` are removed from the scene
  - Write test: set `entry.lastSeen = Date.now() - 5000`, run tick update, assert entry is removed from `otherPlayers` and mesh is removed from scene
  - Verify test PASSES on UNFIXED code

  - Run all preservation tests on UNFIXED code
  - **EXPECTED OUTCOME**: All preservation tests PASS (confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 3. Fix all three multiplayer bugs

  - [x] 3.1 Fix Bug 1 — Remote player Z-relative rendering in `main.js`
    - In the `tick` loop (~line 2318), replace `entry.mesh.position.lerp(entry.pos, 0.35)` with:
      ```js
      const relativeZ = entry.pos.z - shipAnchor.position.z;
      const clampedRelZ = THREE.MathUtils.clamp(relativeZ, -100, 100);
      const targetPos = new THREE.Vector3(
        entry.pos.x,
        entry.pos.y,
        shipAnchor.position.z + clampedRelZ
      );
      entry.mesh.position.lerp(targetPos, 0.35);
      ```
    - In `upsertRemotePlayer` (~line 1147), replace `mesh.position.copy(entry.pos)` on first creation with:
      ```js
      const initRelZ = THREE.MathUtils.clamp(
        (z || 0) - shipAnchor.position.z, -100, 100
      );
      mesh.position.set(x || 0, y || 0, shipAnchor.position.z + initRelZ);
      ```
    - _Bug_Condition: isBugCondition_Visibility(localZ, remoteZ) where ABS(localZ − remoteZ) > 200_
    - _Expected_Behavior: ABS(shipAnchor.position.z − entry.mesh.position.z) <= 100 after lerp_
    - _Preservation: X and Y positions unchanged; mesh.visible still driven by entry.alive; stale removal unchanged_
    - _Requirements: 2.1, 2.2, 3.2, 3.3, 3.7_

  - [x] 3.2 Fix Bug 2 — 10 damage per bullet in `server.js`
    - In `makePlayer`, add `health: 100` to the returned object
    - In the `bullet_fired` handler, replace the instant-kill block with damage accumulation:
      ```js
      if (!victim) return;
      victim.health = Math.max(0, victim.health - 10);
      if (victim.health <= 0) {
        victim.alive = false;
        victim.deaths += 1;
        shooter.kills += 1;
        io.to(roomCode).emit("player_eliminated", {
          killerId: shooter.id, killerName: shooter.name,
          victimId: victim.id, victimName: victim.name,
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
          victimId: victim.id, health: victim.health, shooterId: shooter.id,
        });
      }
      ```
    - In `broadcastRoom`, include `health: p.health ?? 100` in the player state map
    - Add `player_hit` socket handler in `main.js` for visual hit feedback on remote player mesh:
      ```js
      socket.on("player_hit", ({ victimId, health, shooterId }) => {
        const entry = otherPlayers.get(victimId);
        if (!entry?.mesh) return;
        entry.mesh.traverse((child) => {
          if (!child.isMesh || !child.material?.color) return;
          const orig = child.material.color.clone();
          child.material.color.set(0xff4444);
          setTimeout(() => child.material.color.copy(orig), 120);
        });
      });
      ```
    - _Bug_Condition: isBugCondition_InstantKill(victim) where victim.alive = true AND health field absent AND bullet just hit_
    - _Expected_Behavior: victim.health = original − 10, victim.alive = true, player_hit emitted (when health > 0)_
    - _Preservation: elimination still occurs when health reaches 0; respawn still fires after 2200 ms with health reset to 100_
    - _Requirements: 2.3, 3.4, 3.5_

  - [x] 3.3 Fix Bug 3 — Multiplayer speed reduction in `main.js`
    - In the `tick` function ship movement section (~line 2268), replace:
      ```js
      const spd = getSpeed(diffT) * throttleMult;
      ```
      with:
      ```js
      const mpSpeedMult = mpMode ? 0.55 : 1.0;
      const spd = getSpeed(diffT) * throttleMult * mpSpeedMult;
      ```
    - _Bug_Condition: isBugCondition_Speed(mpMode) where mpMode = true_
    - _Expected_Behavior: spd = getSpeed(diffT) * throttleMult * 0.55 in multiplayer_
    - _Preservation: solo mode (mpMode = false) uses mpSpeedMult = 1.0, so spd is exactly getSpeed(diffT) * throttleMult — unchanged_
    - _Requirements: 2.4, 3.1_

  - [x] 3.4 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Remote Fog Culling / Instant Kill / Speed Parity
    - **IMPORTANT**: Re-run the SAME tests from task 1 — do NOT write new tests
    - The tests from task 1 encode the expected behavior for all three bugs
    - When these tests pass, it confirms the expected behavior is satisfied
    - Run all three bug condition exploration tests from step 1
    - **EXPECTED OUTCOME**: All three tests PASS (confirms all three bugs are fixed)
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 3.5 Verify preservation tests still pass
    - **Property 2: Preservation** - Non-Buggy Rendering / Lethal Hit / Solo Speed
    - **IMPORTANT**: Re-run the SAME tests from task 2 — do NOT write new tests
    - Run all five preservation property tests from step 2
    - **EXPECTED OUTCOME**: All preservation tests PASS (confirms no regressions)
    - Confirm all tests still pass after fix (no regressions)

- [x] 4. Checkpoint — Ensure all tests pass
  - Run the full test suite and confirm all tests pass
  - Verify Bug 1: remote player mesh Z is within ±100 of `shipAnchor.position.z` for any Z gap
  - Verify Bug 2: single bullet hit leaves victim alive with 90 HP; 10th hit eliminates; respawn resets health to 100
  - Verify Bug 3: `mpMode = true` produces 0.55× speed; `mpMode = false` produces unchanged speed
  - Verify all preservation properties still hold (solo speed, lethal hit, stale removal, visibility flag)
  - Ask the user if any questions arise
