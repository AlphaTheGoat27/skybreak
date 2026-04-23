Issue 1: Impossible obstacle clustering (walls + windmill stacking with no gap)

 Add a minimum Z-spacing enforcement between different obstacle types. In spawnObstacles(), before placing any obstacle, check if any active obstacle of a different type exists within a threshold (e.g. 120 units) of the new spawn Z. If so, skip this spawn slot entirely and only advance state.nextZ.
 Increase getSpawnGap() values after t=60. Currently at t=75+ gaps drop to 88→72→65 units. At high speed (100+ m/s) this is geometrically impossible. Change the late-game values: t<70 → 160, t<110 → 130, t<150 → 110, default → 95.
 Prevent windmills from spawning within 200 units of a wall. Windmills need the full tunnel width. Add a specific check: if a wall is active within 200 Z-units ahead of the player, skip windmill spawns for that slot.
 Cap simultaneous active obstacle count. Add a counter. If activeObstacleCount >= 3 at any time, skip new spawns until one scrolls past. Count actives across all pools before the while loop in spawnObstacles().
 Widen wall gaps in late game. In getGapCfg(), the final return has wallGapHX: 3.4, wallGapHY: 3.6 — these are dangerously tight. Set floor values to wallGapHX: 4.2, wallGapHY: 4.5 regardless of time. The difficulty should come from speed and density, not from physically impossible gaps.
 Add a "breather" zone after every crusher wall. After placing a isCrusher = true wall, force the next state.nextZ -= getSpawnGap(t) * 2.2 (double gap) so the player has recovery space.


Issue 2: Bullets not shooting straight / only 1 of 3 cores gets destroyed

 Fix the aim vector calculation in getAimTarget(). Currently it unprojects mouse screen coords and subtracts camera.position, which gives a world-space ray that drifts depending on camera position. Replace the direction with a fixed forward vector: new THREE.Vector3(0, 0, -1) transformed by the camera's world quaternion. This makes bullets always fire straight ahead regardless of mouse position.
 Remove mouse-aim influence from bullet direction entirely, unless you want a mouse-aim mechanic. Right now ptrX/ptrY is added to ship movement and used to aim bullets — so moving the mouse steers the ship AND skews the bullet. Pick one. For straight-shooting: in getAimTarget(), return dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion).
 Fix the wave-harvest deduplication logic that limits you to 1 core per wave. In updateCores(), when a bullet hits a core, you call harvestedWaves.add(ud.waveId) and then break out of the bullet loop. But the core loop i continues — subsequent cores in the same wave are blocked by harvestedWaves.has(ud.waveId). This is intentional per your comment ("Siblings ignore bullets") but it means shooting 3 cores in a wave only ever destroys 1 and credits 1. Decision point: if you want all 3 cores to be destroyable but only credit 1 kill, remove the harvestedWaves guard and instead track coresDestroyed differently. If you want 1-kill-per-wave, make it visually clear (e.g. remaining wave cores should disappear or dim after the first is hit).
 The simplest fix for the above: Remove harvestedWaves entirely. Instead, increment coresDestroyed per bullet hit, and remove the hit core. Cap coresDestroyed at CORES_FOR_INSTANT_WIN. This means all 3 cores per wave are individually destroyable and each counts toward the 20.
 Fix bullet spawn position. Currently spawnPos = shipAnchor.position.clone().add(new THREE.Vector3(0, 0, -2)). Since the ship moves forward (Z decreases), bullets spawn 2 units ahead — fine. But verify BULLET_SPEED: 145 with forward direction (0,0,-1) actually moves in the correct negative-Z direction. Confirm vel = dir.normalize().multiplyScalar(145) with dir (0,0,-1) gives vel.z = -145. If the camera/ship Z is decreasing over time, this is correct.


Summary order of implementation

Fix getAimTarget() → straight bullets first (5 min change)
Remove harvestedWaves dedupe → all cores destroyable (10 min change)
Increase getSpawnGap() late-game values (2 min change)
Widen getGapCfg() floor values (2 min change)
Add inter-obstacle Z-spacing check in spawnObstacles() (15 min change)
Add double-gap after crusher walls (5 min change)
Add simultaneous active obstacle cap (10 min change)