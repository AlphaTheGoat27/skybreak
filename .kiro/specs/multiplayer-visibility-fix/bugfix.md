# Bugfix Requirements Document

## Introduction

Three related multiplayer gameplay bugs in SKYBREAK affect the quality of PvP sessions:

1. **Remote player invisibility** — other players' ships are invisible during multiplayer because their meshes are placed at absolute world-space Z coordinates while the local player has flown hundreds of units forward. The exponential fog (`FogExp2`, density 0.011) fully obscures objects beyond ~200 units, so any Z-position divergence between players causes them to vanish into the black tunnel fog.

2. **Instant elimination on bullet hit** — a single bullet immediately kills any player it hits (`victim.alive = false`). The intended design is 10 damage per bullet with 100 HP, requiring 10 hits to eliminate a player.

3. **Multiplayer speed too fast** — the tunnel forward speed is identical in solo and multiplayer, making it very hard for players to see and engage each other before they fly past.

---

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN a remote player's absolute Z position differs from the local player's Z position by more than ~200 units THEN the system renders the remote player's mesh fully obscured by exponential fog, making them invisible.

1.2 WHEN two players join a session at different times or survive for different durations THEN the system places their meshes at diverging absolute Z coordinates, causing the Z gap to grow and remote players to disappear permanently.

1.3 WHEN a bullet fired by any player passes within the hit radius of a remote player THEN the system immediately sets `victim.alive = false`, eliminating the player in a single hit regardless of prior damage.

1.4 WHEN a multiplayer session is active THEN the system uses the same forward tunnel speed as solo mode, causing players to fly past each other too quickly to aim or react.

### Expected Behavior (Correct)

2.1 WHEN a remote player's absolute Z position differs from the local player's Z position THEN the system SHALL render the remote player's mesh offset by the relative Z difference so they appear within the visible fog range near the local player.

2.2 WHEN two players are in the same active session THEN the system SHALL keep remote player meshes positioned relative to the local player's current Z, so they remain visible regardless of how far each player has individually traveled.

2.3 WHEN a bullet fired by any player passes within the hit radius of a remote player THEN the system SHALL deduct 10 HP from the victim's health (starting at 100 HP) and only eliminate the player when their health reaches 0 or below.

2.4 WHEN a multiplayer session is active THEN the system SHALL apply a reduced forward speed multiplier so players travel more slowly through the tunnel, giving them more time to see and engage each other.

### Unchanged Behavior (Regression Prevention)

3.1 WHEN a player is in solo mode THEN the system SHALL CONTINUE TO use the original forward speed progression unmodified.

3.2 WHEN a remote player's `alive` field is `false` THEN the system SHALL CONTINUE TO hide their mesh (`mesh.visible = false`).

3.3 WHEN a remote player has not sent a state update for more than 4500 ms THEN the system SHALL CONTINUE TO remove their mesh from the scene.

3.4 WHEN a bullet misses all remote players THEN the system SHALL CONTINUE TO produce no hit or damage effect.

3.5 WHEN a player is eliminated (health reaches 0) THEN the system SHALL CONTINUE TO broadcast `player_eliminated`, increment kill/death counters, and respawn the victim after 2200 ms.

3.6 WHEN a player escapes through the portal in multiplayer THEN the system SHALL CONTINUE TO record their escape and update the leaderboard standings.

3.7 WHEN the local player's own position is sent via `player_state` THEN the system SHALL CONTINUE TO send absolute world-space coordinates (the relative offset is applied only on the receiving client's render side).

---

## Bug Condition Pseudocode

### Bug 1 — Remote Player Fog Culling

```pascal
FUNCTION isBugCondition_Visibility(localZ, remoteZ)
  INPUT: localZ of type Number (local shipAnchor.position.z)
         remoteZ of type Number (received remote player z)
  OUTPUT: boolean

  RETURN ABS(localZ - remoteZ) > 200
END FUNCTION

// Property: Fix Checking
FOR ALL (localZ, remoteZ) WHERE isBugCondition_Visibility(localZ, remoteZ) DO
  renderedZ ← remotePlayerMesh.position.z
  ASSERT ABS(localZ - renderedZ) <= 50   // mesh is near the local player
END FOR

// Property: Preservation Checking
FOR ALL (localZ, remoteZ) WHERE NOT isBugCondition_Visibility(localZ, remoteZ) DO
  ASSERT F(localZ, remoteZ) = F'(localZ, remoteZ)  // rendering unchanged when already close
END FOR
```

### Bug 2 — Instant Kill

```pascal
FUNCTION isBugCondition_InstantKill(hitCount)
  INPUT: hitCount of type Number (bullets that have hit this player)
  OUTPUT: boolean

  RETURN hitCount = 1   // first hit triggers elimination in the buggy version
END FUNCTION

// Property: Fix Checking
FOR ALL victim WHERE isBugCondition_InstantKill(victim.hitCount) DO
  result ← applyBulletHit'(victim)
  ASSERT victim.health = 90 AND victim.alive = true
END FOR

// Property: Preservation Checking
FOR ALL victim WHERE victim.health <= 10 DO
  result ← applyBulletHit'(victim)
  ASSERT victim.alive = false   // elimination still happens at 0 HP
END FOR
```

### Bug 3 — Multiplayer Speed

```pascal
FUNCTION isBugCondition_Speed(mode)
  INPUT: mode of type String ("solo" | "multiplayer")
  OUTPUT: boolean

  RETURN mode = "multiplayer"
END FUNCTION

// Property: Fix Checking
FOR ALL sessions WHERE isBugCondition_Speed(session.mode) DO
  speed ← getEffectiveForwardSpeed'(session)
  ASSERT speed < getEffectiveForwardSpeed_solo(session)
END FOR

// Property: Preservation Checking
FOR ALL sessions WHERE NOT isBugCondition_Speed(session.mode) DO
  ASSERT getEffectiveForwardSpeed'(session) = getEffectiveForwardSpeed(session)
END FOR
```
