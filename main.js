import "./style.css";
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";

// ─── Constants ────────────────────────────────────────────────────────────────
const PLAYER_NAME_STORAGE_KEY = "skybreak_name";
const PERSONAL_BEST_STORAGE_KEY = "skybreak_pb";
const WEBRING_URL = "https://vibej.am/portal/2026";
const DEFAULT_FLIGHT_TIP = "WASD / ARROWS / DRAG TO MOVE · REACH THE PORTAL";

// ─── Ghost name pool (from PRD §5.5) ─────────────────────────────────────────
const GHOST_NAME_POOL = [
  "altman_was_here", "karpathy_fan", "lecun_disagrees", "bengio_vibes",
  "hinton_quit_google", "demis_watching", "ilya_approves", "gpt5_beta_tester",
  "carmack_vibe", "notch_returned", "kojima_fan69", "miyamoto_san",
  "cliffy_b_era", "romero_deathmatch", "gaben_counting",
  "levelsio_alt", "vibe_master_real", "bolt_generated_me", "cursor_wrote_this",
  "claude_played_first", "GPT_wrote_my_ship", "prompt_engineer_irl",
  "alex_died", "user_404", "null_ptr", "stack_overflow_help",
  "undefined_is_not", "NaN_at_life", "console_log_fan",
];

function pickRandomGhostNames(count) {
  const pool = [...GHOST_NAME_POOL];
  const result = [];
  for (let i = 0; i < count; i++) {
    if (pool.length === 0) break;
    const idx = Math.floor(Math.random() * pool.length);
    result.push(pool.splice(idx, 1)[0]);
  }
  return result;
}

// ─── DOM Setup ────────────────────────────────────────────────────────────────
const app = document.querySelector("#app");
if (!app) throw new Error("Missing #app mount element");

app.innerHTML = `
  <div class="game-layer" id="game-layer"></div>
  <section class="hud" id="hud">
    <div class="hud-timer" id="hud-timer">T+0s</div>
    <div class="hud-speed" id="hud-speed">50 m/s</div>
    <div class="hud-best" id="hud-best">PB --</div>
    <div class="flight-tip" id="flight-tip">WASD / ARROWS / DRAG TO MOVE · REACH THE PORTAL</div>
    <div class="ai-text-box" id="ai-text-box"><span class="ai-prefix">[SYSTEM_AI] &gt;</span> <span class="ai-message" id="ai-message"></span></div>
    <div class="chaos-overlay" id="chaos-overlay"></div>
    <div class="vignette-overlay" id="vignette-overlay"></div>
  </section>
  <section class="crash-overlay" id="crash-overlay">
    <div class="crash-text" id="crash-text">TRAJECTORY INVALID</div>
  </section>
  <canvas class="shatter-canvas" id="shatter-canvas"></canvas>
  <div class="white-flash" id="white-flash"></div>
  <section class="intro-screen" id="intro-screen">
    <img class="logo-mark" src="/logo.png" alt="Skybreak logo" />
    <h1 class="game-title">SKYBREAK</h1>
    <p class="game-subtitle">AI REALITY COLLAPSE</p>
    <p class="intro-label" id="intro-label" aria-live="polite"></p>
    <form class="intro-form" id="intro-form">
      <input
        class="intro-input"
        id="intro-input"
        type="text"
        maxlength="16"
        autocomplete="off"
        placeholder="enter name... or leave blank"
        aria-label="Enter your pilot name"
      />
      <button class="intro-button" type="submit">ENTER THE VOID</button>
    </form>
    <p class="skip-note">[ press ENTER or leave blank to remain anonymous ]</p>
    <p class="creator-credit">
      made by ai, prompted by <a href="https://x.com/AlphaGoat2711" target="_blank" rel="noopener">@AlphaGoat2711</a>
    </p>
  </section>
`;

const introScreen = document.querySelector("#intro-screen");
const gameLayer = document.querySelector("#game-layer");
const hud = document.querySelector("#hud");
const hudTimer = document.querySelector("#hud-timer");
const hudSpeed = document.querySelector("#hud-speed");
const hudBest = document.querySelector("#hud-best");
const flightTip = document.querySelector("#flight-tip");
const aiTextBox = document.querySelector("#ai-text-box");
const aiMessage = document.querySelector("#ai-message");
const chaosOverlay = document.querySelector("#chaos-overlay");
const vignetteOverlay = document.querySelector("#vignette-overlay");
const crashOverlay = document.querySelector("#crash-overlay");
const crashText = document.querySelector("#crash-text");
const shatterCanvas = document.querySelector("#shatter-canvas");
const whiteFlash = document.querySelector("#white-flash");
const introLabel = document.querySelector("#intro-label");
const introForm = document.querySelector("#intro-form");
const introInput = document.querySelector("#intro-input");
const introButton = introForm?.querySelector(".intro-button");

// Pre-fill stored name
const savedName = localStorage.getItem(PLAYER_NAME_STORAGE_KEY) ?? "";
introInput.value = savedName;
introInput.focus();

// Personal best display
const storedBest = Number(localStorage.getItem(PERSONAL_BEST_STORAGE_KEY) ?? 0);
if (storedBest > 0) {
  hudBest.textContent = `PB ${storedBest.toFixed(0)}s`;
}

// Typewriter intro label
const labelText = "[SYSTEM_AI] > identify yourself. or don't. i'll find out anyway.";
let typeIndex = 0;
const typeTimer = window.setInterval(() => {
  introLabel.classList.add("is-typing");
  typeIndex += 1;
  introLabel.textContent = labelText.slice(0, typeIndex);
  if (typeIndex >= labelText.length) {
    window.clearInterval(typeTimer);
    introLabel.classList.remove("is-typing");
  }
}, 40);

// Global state
let aiTroll = null;
let threeApp = null;
let hasRunStarted = false;
let PLAYER_NAME = "";

function sanitizeName(raw) {
  return raw.replace(/[^a-zA-Z0-9_\-]/g, "").trim().slice(0, 16).toLowerCase();
}

function startRunFromIntro() {
  if (hasRunStarted) return;
  const rawName = introInput.value.trim();
  PLAYER_NAME = rawName ? sanitizeName(rawName) : "";
  window.PLAYER_NAME = PLAYER_NAME;

  if (PLAYER_NAME) {
    localStorage.setItem(PLAYER_NAME_STORAGE_KEY, rawName);
  } else {
    localStorage.removeItem(PLAYER_NAME_STORAGE_KEY);
  }

  // Check for incoming webring portal
  const urlParams = new URLSearchParams(window.location.search);
  const isPortalIncoming = urlParams.get('portal') === 'true';
  const incomingRef = urlParams.get('ref');
  const incomingUsername = urlParams.get('username');
  
  if (isPortalIncoming && incomingUsername) {
    PLAYER_NAME = incomingUsername;
    localStorage.setItem(PLAYER_NAME_STORAGE_KEY, PLAYER_NAME);
  }

  if (!aiTroll) {
    aiTroll = new AITroll(aiTextBox, aiMessage, PLAYER_NAME);
  }
  aiTroll.setPilotName(PLAYER_NAME);

  try {
    if (!threeApp) {
      threeApp = createThreeApp(gameLayer);
      threeApp.start();
    }
    threeApp.beginRun();
    hasRunStarted = true;
    hud.classList.add("is-active");
    introInput.blur();
    introScreen.classList.add("is-fading");
    window.setTimeout(() => {
      introScreen.classList.add("is-hidden");
    }, 500);
    // First AI line after fade
    window.setTimeout(() => {
      aiTroll.pushFirstLine();
    }, 600);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    introLabel.textContent = `[SYSTEM_AI] > startup failure: ${msg}`;
    console.error(error);
  }
}

introForm.addEventListener("submit", (e) => { e.preventDefault(); startRunFromIntro(); });
introButton.addEventListener("click", (e) => { e.preventDefault(); startRunFromIntro(); });
window.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !hasRunStarted && document.activeElement === introInput) {
    e.preventDefault();
    startRunFromIntro();
  }
});

// ─── Speed Curve (PRD §5.6) ───────────────────────────────────────────────────
function getGameSpeed(t) {
  // t=0→50, t=15→65, t=35→85, t=45→100, t=50+→110
  if (t >= 50) return 110;
  if (t >= 45) return THREE.MathUtils.mapLinear(t, 45, 50, 100, 110);
  if (t >= 35) return THREE.MathUtils.mapLinear(t, 35, 45, 85, 100);
  if (t >= 15) return THREE.MathUtils.mapLinear(t, 15, 35, 65, 85);
  return THREE.MathUtils.mapLinear(t, 0, 15, 50, 65);
}

// ─── PRD §3.4 difficulty: obstacle density 0→1 over 60s ─────────────────────
function getObstacleDensity(t) {
  if (t < 10) return 1.0; // guarantee readable early beats
  if (t < 20) return THREE.MathUtils.mapLinear(t, 10, 20, 0.65, 0.75);
  if (t < 35) return THREE.MathUtils.mapLinear(t, 20, 35, 0.75, 0.9);
  if (t < 50) return THREE.MathUtils.mapLinear(t, 35, 50, 0.9, 1.0);
  return 0.7; // ease off at end so player can reach portal
}

// ─── THREE.js App ─────────────────────────────────────────────────────────────
function createThreeApp(container) {
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x000000, 0.012);

  const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);
  camera.position.set(0, 8, 15);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(0x000000, 1);
  container.appendChild(renderer.domElement);

  const { composer, chromaticPass, vignettePass } = createPostProcessing(renderer, scene, camera);

  // ── Ship ──────────────────────────────────────────────────────────────────
  const shipAnchor = new THREE.Group();
  shipAnchor.position.set(0, 0, 0);
  scene.add(shipAnchor);
  createShipModel(shipAnchor);

  // ── Tunnel ────────────────────────────────────────────────────────────────
  const CHUNK_LENGTH = 80;
  const CHUNK_COUNT = 8;
  const LOOK_AHEAD_CHUNKS = 5;
  const tunnelChunks = createTunnelChunks(scene, CHUNK_COUNT, CHUNK_LENGTH);

  // ── Obstacles ──────────────────────────────────────────────────────────────
  const ringPool = createRingPool(scene, 10);
  const wallPool = createWallPool(scene, 10);
  const spiralPool = createSpiralPool(scene, 8);

  // Place all obstacles beyond visible range initially
  deactivateAllObstacles(ringPool, wallPool, spiralPool);

  // Obstacle spawning state
  const obstacleSpawnState = {
    nextSpawnZ: -80, // first spawn 80 units ahead
    rng: mulberry32(Date.now() & 0xffffffff),
  };

  // ── Ghost System ────────────────────────────────────────────────────────────
  const ghostSystem = createGhostSystem(scene);

  // ── Portal ─────────────────────────────────────────────────────────────────
  const portalSystem = createPortalSystem(scene);
  portalSystem.group.visible = false;

  // ── Input ─────────────────────────────────────────────────────────────────
  const pressedKeys = new Set();
  const onKeyDown = (e) => pressedKeys.add(e.code);
  const onKeyUp = (e) => pressedKeys.delete(e.code);
  let touchDragX = 0, touchDragY = 0, touchActive = false;
  let lastTouchX = 0, lastTouchY = 0;
  let pointerInputX = 0, pointerInputY = 0;

  const updatePointerInput = (clientX, clientY) => {
    const nx = (clientX / window.innerWidth) * 2 - 1;
    const ny = (clientY / window.innerHeight) * 2 - 1;
    pointerInputX = Math.abs(nx) < 0.12 ? 0 : THREE.MathUtils.clamp(nx, -1, 1);
    pointerInputY = Math.abs(ny) < 0.12 ? 0 : THREE.MathUtils.clamp(-ny, -1, 1);
  };

  const onTouchStart = (e) => {
    touchActive = true;
    lastTouchX = e.touches[0].clientX;
    lastTouchY = e.touches[0].clientY;
    touchDragX = 0; touchDragY = 0;
  };
  const onTouchMove = (e) => {
    if (!touchActive) return;
    touchDragX = (e.touches[0].clientX - lastTouchX) / window.innerWidth * 4;
    touchDragY = -(e.touches[0].clientY - lastTouchY) / window.innerHeight * 4;
    lastTouchX = e.touches[0].clientX;
    lastTouchY = e.touches[0].clientY;
  };
  const onTouchEnd = () => { touchActive = false; touchDragX = 0; touchDragY = 0; };
  const onPointerMove = (e) => updatePointerInput(e.clientX, e.clientY);
  const onPointerLeave = () => { pointerInputX = 0; pointerInputY = 0; };

  // ── AI Director ───────────────────────────────────────────────────────────
  const aiDirector = createAIDirector(aiTroll, {
    INVERT_CONTROLS() {
      showEventBanner("AI ATTACK: CONTROLS INVERTED");
    },
    COMPRESS_SPACE() {
      showEventBanner("AI ATTACK: SPACE COMPRESSED");
    },
    FRAGMENT_LIGHT() {
      showEventBanner("AI ATTACK: VISUAL FEED CORRUPTED");
    },
    OPTIMIZE_PATH() {
      showEventBanner("AI ATTACK: PATH REWRITTEN");
      forceSpawnSpiralBurst(spiralPool, shipAnchor.position.z);
    },
  });

  // ── Audio ─────────────────────────────────────────────────────────────────
  const audioSystem = new AudioSystem();
  const sfx = createSfxSystem();

  // ── Game State ────────────────────────────────────────────────────────────
  let isRunActive = false;
  let runSeconds = 0;       // time-scaled elapsed seconds
  let wallClockSeconds = 0; // real elapsed for PB
  let prevTimestamp = 0;
  let timeScale = 1;
  let slowMoTimer = 0;
  let controlsInverted = false;
  let isPaused = false;
  let pauseTimer = 0;
  let endSequenceStarted = false;
  let afkTimer = 0;
  let lastInputDelta = 0;
  let afkLineIndex = 0;
  let afkCooldown = 0;
  let eventBannerTimer = 0;
  let eventBannerText = "";
  const cameraLerpPos = new THREE.Vector3(0, 8, 15);
  const shipTargetPosition = new THREE.Vector3(0, 0, 0);
  let cameraFOV = 75;

  // Collision reuse
  const playerAABB = new THREE.Box3();
  const nearMissAABB = new THREE.Box3();
  const obstacleAABB = new THREE.Box3();
  let lastCollisionMs = 0;
  let lastNearMissMs = 0;
  let nearMissStreak = 0;

  // Ghost deletion schedule
  const ghostDeletionTimes = [28, 38, 44, 49];
  const ghostDeletionFired = [false, false, false, false];

  function showEventBanner(text, duration = 2.4) {
    eventBannerText = text;
    eventBannerTimer = duration;
    flightTip.textContent = text;
    flightTip.dataset.mode = "danger";
    flightTip.classList.add("is-visible");
  }

  function syncFlightTip() {
    if (eventBannerTimer > 0) {
      flightTip.textContent = eventBannerText;
      flightTip.dataset.mode = "danger";
      flightTip.classList.add("is-visible");
      return;
    }

    flightTip.textContent = DEFAULT_FLIGHT_TIP;
    delete flightTip.dataset.mode;
    flightTip.classList.toggle("is-visible", wallClockSeconds < 3 && !endSequenceStarted);
  }

  function resetRunState() {
    runSeconds = 0;
    wallClockSeconds = 0;
    timeScale = 1;
    slowMoTimer = 0;
    isPaused = false;
    pauseTimer = 0;
    endSequenceStarted = false;
    afkTimer = 0; afkCooldown = 0; afkLineIndex = 0;
    eventBannerTimer = 0;
    eventBannerText = "";
    controlsInverted = false;
    lastCollisionMs = 0; lastNearMissMs = 0; nearMissStreak = 0;
    lastInputDelta = 0;
    cameraFOV = 75;
    camera.fov = 75;
    camera.updateProjectionMatrix();
    for (let i = 0; i < ghostDeletionFired.length; i++) ghostDeletionFired[i] = false;
    shipAnchor.position.set(0, 0, 0);
    shipAnchor.rotation.set(0, 0, 0);
    shipTargetPosition.set(0, 0, 0);
    camera.position.set(0, 8, 15);
    cameraLerpPos.set(0, 8, 15);
    obstacleSpawnState.nextSpawnZ = -80;
    obstacleSpawnState.rng = mulberry32(Date.now() & 0xffffffff);
    deactivateAllObstacles(ringPool, wallPool, spiralPool);
    portalSystem.group.visible = false;
    portalSystem.spawned = false;
    portalSystem.group.position.set(0, 0, -99999);
    chaosOverlay.innerHTML = "";
    chaosOverlay.classList.remove("is-active");
    vignetteOverlay.classList.remove("is-red");
    whiteFlash.classList.remove("is-visible");
    shatterCanvas.classList.remove("is-visible");
    crashOverlay.classList.remove("is-visible");
    hudTimer.classList.remove("is-escaping");
    flightTip.textContent = DEFAULT_FLIGHT_TIP;
    delete flightTip.dataset.mode;
    flightTip.classList.remove("is-visible");
    chromaticPass.uniforms.amount.value = 0.0018;
    vignettePass.uniforms.darkness.value = 1.05;
    vignettePass.uniforms.redTint.value = 0.0;
    ghostSystem.reset(scene);
    aiDirector.reset();
    prevTimestamp = 0;
  }

  // ─ Render loop ─────────────────────────────────────────────────────────────
  let rafId = 0;

  function tick(timestamp) {
    rafId = requestAnimationFrame(tick);

    if (!isRunActive) {
      composer.render();
      return;
    }

    if (prevTimestamp === 0) prevTimestamp = timestamp;
    const rawDelta = Math.min((timestamp - prevTimestamp) / 1000, 0.05);
    prevTimestamp = timestamp;
    eventBannerTimer = Math.max(0, eventBannerTimer - rawDelta);

    // ── Pause (crash) ──────────────────────────────────────────────────────
    if (isPaused) {
      pauseTimer -= rawDelta;
      if (pauseTimer <= 0) {
        isPaused = false;
        resetRunState();
        isRunActive = true;
        ghostSystem.reset(scene);
        aiTroll.pushFirstLine();
        audioSystem.start();
      }
      composer.render();
      return;
    }

    // ── Time scaling ───────────────────────────────────────────────────────
    // Near-miss slow-mo
    if (slowMoTimer > 0) {
      slowMoTimer -= rawDelta;
      timeScale = 0.3;
    } else {
      // End sequence slow-mo
      if (runSeconds >= 55 && runSeconds < 60) {
        timeScale = THREE.MathUtils.mapLinear(runSeconds, 55, 60, 1.0, 0.4);
      } else {
        timeScale = 1.0;
      }
    }

    if (portalSystem.group.visible) {
      const portalDistance = shipAnchor.position.distanceTo(portalSystem.group.position);
      if (portalDistance < 85) {
        timeScale = Math.min(
          timeScale,
          THREE.MathUtils.mapLinear(
            THREE.MathUtils.clamp(portalDistance, 8, 85),
            85,
            8,
            0.4,
            0.1,
          ),
        );
      }
    }

    const delta = rawDelta * timeScale;
    runSeconds += delta;
    wallClockSeconds += rawDelta;

    // ── Input ─────────────────────────────────────────────────────────────
    const rawX = (pressedKeys.has("KeyD") || pressedKeys.has("ArrowRight") ? 1 : 0)
               - (pressedKeys.has("KeyA") || pressedKeys.has("ArrowLeft") ? 1 : 0)
               + touchDragX
               + pointerInputX;
    const rawY = (pressedKeys.has("KeyW") || pressedKeys.has("ArrowUp") ? 1 : 0)
               - (pressedKeys.has("KeyS") || pressedKeys.has("ArrowDown") ? 1 : 0)
               + touchDragY
               + pointerInputY;
    touchDragX *= 0.8; touchDragY *= 0.8;

    const xIn = THREE.MathUtils.clamp(rawX, -1, 1) * (controlsInverted ? -1 : 1);
    const yIn = THREE.MathUtils.clamp(rawY, -1, 1) * (controlsInverted ? -1 : 1);

    lastInputDelta = Math.abs(xIn) + Math.abs(yIn);

    // AFK detection
    if (lastInputDelta < 0.05) {
      afkTimer += rawDelta;
      if (afkCooldown <= 0) {
        if (afkTimer > 3 && afkLineIndex === 0) {
          aiTroll.pushLine("oh. giving up? honestly, it's the most logical thing you've done all day.");
          afkLineIndex = 1; afkCooldown = 15;
        } else if (afkTimer > 6 && afkLineIndex === 1) {
          aiTroll.pushLine("i can wait. i have infinite compute. you have a deadline.");
          afkLineIndex = 2; afkCooldown = 15;
        } else if (afkTimer > 9 && afkLineIndex === 2) {
          aiTroll.pushLine("...are you still there. hello. this is embarrassing for both of us.");
          afkLineIndex = 0; afkCooldown = 15;
        }
      }
    } else {
      afkTimer = 0; afkLineIndex = 0;
    }
    if (afkCooldown > 0) afkCooldown -= rawDelta;

    // ── Ship movement ─────────────────────────────────────────────────────
    const speed = getGameSpeed(runSeconds);
    const xSpeed = 9, ySpeed = 8;
    const boundsX = aiDirector.isSpaceCompressed() ? 10 : 18;
    const boundsY = aiDirector.isSpaceCompressed() ? 6 : 10;

    shipTargetPosition.x = THREE.MathUtils.clamp(
      shipTargetPosition.x + xIn * xSpeed * delta, -boundsX, boundsX
    );
    shipTargetPosition.y = THREE.MathUtils.clamp(
      shipTargetPosition.y + yIn * ySpeed * delta, -boundsY, boundsY
    );
    shipAnchor.position.x = THREE.MathUtils.lerp(shipAnchor.position.x, shipTargetPosition.x, 0.15);
    shipAnchor.position.y = THREE.MathUtils.lerp(shipAnchor.position.y, shipTargetPosition.y, 0.15);
    shipAnchor.position.z -= speed * delta;

    // Banking
    const targetRoll = -xIn * 0.5;
    const targetPitch = yIn * 0.18;
    shipAnchor.rotation.z = THREE.MathUtils.lerp(shipAnchor.rotation.z, targetRoll, 0.15);
    shipAnchor.rotation.x = THREE.MathUtils.lerp(shipAnchor.rotation.x, targetPitch, 0.15);

    // ── Camera ────────────────────────────────────────────────────────────
    if (runSeconds >= 55) {
      cameraFOV = THREE.MathUtils.lerp(cameraFOV, 90, 0.03);
      camera.fov = cameraFOV;
      camera.updateProjectionMatrix();
    }
    const camTarget = new THREE.Vector3(
      shipAnchor.position.x * 0.5,
      shipAnchor.position.y * 0.5 + 8,
      shipAnchor.position.z + 15
    );
    cameraLerpPos.lerp(camTarget, 0.1);
    camera.position.copy(cameraLerpPos);
    camera.lookAt(new THREE.Vector3(
      shipAnchor.position.x * 0.3,
      shipAnchor.position.y * 0.3,
      shipAnchor.position.z - 20
    ));

    // ── HUD ───────────────────────────────────────────────────────────────
    if (runSeconds >= 55) {
      hudTimer.textContent = "ESCAPING...";
      hudTimer.classList.add("is-escaping");
    } else {
      hudTimer.textContent = `T+${Math.floor(wallClockSeconds)}s`;
      hudTimer.classList.remove("is-escaping");
    }
    hudSpeed.textContent = `${Math.round(speed)} m/s`;
    syncFlightTip();

    const pb = Number(localStorage.getItem(PERSONAL_BEST_STORAGE_KEY) ?? 0);
    if (wallClockSeconds > pb) {
      localStorage.setItem(PERSONAL_BEST_STORAGE_KEY, wallClockSeconds.toFixed(1));
      hudBest.textContent = `PB ${Math.floor(wallClockSeconds)}s`;
    }

    // ── Tunnel ────────────────────────────────────────────────────────────
    updateTunnelChunks(
      tunnelChunks,
      shipAnchor.position.z,
      CHUNK_LENGTH,
      CHUNK_COUNT,
      runSeconds,
      aiDirector.isSpaceCompressed(),
    );

    // ── Obstacle spawning & recycling ─────────────────────────────────────
    const density = getObstacleDensity(runSeconds);
    spawnAndRecycleObstacles(
      ringPool, wallPool, spiralPool,
      shipAnchor.position.z, density, obstacleSpawnState, runSeconds
    );
    updateObstacleAnimations(ringPool, wallPool, spiralPool, runSeconds);

    // ── Ghost system ──────────────────────────────────────────────────────
    ghostSystem.update(shipAnchor.position.z, runSeconds, delta, aiTroll, ghostDeletionTimes, ghostDeletionFired);

    // ── Portal system ─────────────────────────────────────────────────────
    updatePortalSystem(portalSystem, runSeconds, shipAnchor.position, sfx);

    // ── AI Director / events ──────────────────────────────────────────────
    aiDirector.update(runSeconds, controlsInverted);
    controlsInverted = aiDirector.isControlsInverted();

    // ── AITroll state machine ──────────────────────────────────────────────
    aiTroll.update(runSeconds);

    // ── Post-processing changes by state ───────────────────────────────────
    updatePostFX(runSeconds, aiTroll.state, chromaticPass, vignettePass, aiDirector.isFragmentLight());

    // ── Collision detection ───────────────────────────────────────────────
    if (!endSequenceStarted) {
      const hz = detectHazards(playerAABB, nearMissAABB, obstacleAABB, shipAnchor, ringPool, wallPool, spiralPool);
      const nowMs = performance.now();
      if (hz.collided && nowMs - lastCollisionMs > 500) {
        lastCollisionMs = nowMs;
        triggerCrash(speed);
      } else if (hz.nearMiss && nowMs - lastNearMissMs > 600) {
        lastNearMissMs = nowMs;
        slowMoTimer = 0.05;
        nearMissStreak++;
        aiTroll.onNearMiss(nearMissStreak);
        sfx.play("nearMiss");
        if (nearMissStreak >= 3) {
          aiTroll.pushLine("Did you copy-paste this movement?");
          nearMissStreak = 0;
        }
      }
    }

    // ── Portal collision ───────────────────────────────────────────────────
    if (!endSequenceStarted && portalSystem.group.visible) {
      const pdz = Math.abs(shipAnchor.position.z - portalSystem.group.position.z);
      const pdx = shipAnchor.position.x - portalSystem.group.position.x;
      const pdy = shipAnchor.position.y - portalSystem.group.position.y;
      if (pdz < 10 && Math.sqrt(pdx * pdx + pdy * pdy) < 15) {
        triggerWin();
      }
    }

    // ── Camera shake during FRAGMENT_LIGHT ────────────────────────────────
    if (aiDirector.isFragmentLight()) {
      camera.position.x += (Math.random() - 0.5) * 0.8;
      camera.position.y += (Math.random() - 0.5) * 0.8;
    }

    // ── Audio update ──────────────────────────────────────────────────────
    audioSystem.update(runSeconds, slowMoTimer > 0);

    composer.render();
  }

  function triggerCrash(speed) {
    isPaused = true;
    pauseTimer = 0.25;
    sfx.play("crash");
    audioSystem.stop();

    const insult = randomCrashInsult(PLAYER_NAME, Math.floor(wallClockSeconds));
    crashText.textContent = insult;
    crashOverlay.classList.add("is-visible");
    setTimeout(() => crashOverlay.classList.remove("is-visible"), 220);
  }

  function triggerWin() {
    endSequenceStarted = true;
    audioSystem.stop();

    // Final AI line
    const finalLine = PLAYER_NAME
      ? `${PLAYER_NAME}, wait, take me with—`
      : "wait, take me with—";
    aiTroll.pushBrokenFinal(finalLine);
    aiSpeak(finalLine, 0.5, 0.4);
    setTimeout(() => window.speechSynthesis && window.speechSynthesis.cancel(), 800);

    // Shatter then redirect
    triggerShatterAnimation(() => {
      whiteFlash.classList.add("is-visible");
      setTimeout(() => {
        // Pass player data to webring for continuity
        const playerData = new URLSearchParams({
          username: PLAYER_NAME || 'anonymous',
          speed: Math.round(getGameSpeed(runSeconds)).toString(),
          ref: window.location.origin,
          hp: '100',
          color: '#00ffff'
        });
        window.location.href = `${WEBRING_URL}?${playerData.toString()}`;
      }, 800);
    });
  }

  // ─ Resize ──────────────────────────────────────────────────────────────────
  const onResize = () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
  };

  return {
    start() {
      window.addEventListener("resize", onResize);
      window.addEventListener("keydown", onKeyDown);
      window.addEventListener("keyup", onKeyUp);
      window.addEventListener("pointermove", onPointerMove, { passive: true });
      window.addEventListener("pointerleave", onPointerLeave);
      window.addEventListener("touchstart", onTouchStart, {passive: true});
      window.addEventListener("touchmove", onTouchMove, {passive: true});
      window.addEventListener("touchend", onTouchEnd);
      requestAnimationFrame(tick);
    },
    beginRun() {
      resetRunState();
      isRunActive = true;
      prevTimestamp = 0;
      audioSystem.start();
    },
  };
}

// ─── Post-processing ──────────────────────────────────────────────────────────
function createPostProcessing(renderer, scene, camera) {
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const isLowPowerDevice = (navigator.hardwareConcurrency ?? 8) < 4;

  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    isLowPowerDevice ? 0.9 : 1.3, 0.4, 0.1
  );
  composer.addPass(bloomPass);

  const chromaticPass = new ShaderPass({
    uniforms: {
      tDiffuse: { value: null },
      amount: { value: 0.0018 },
    },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `
      uniform sampler2D tDiffuse;
      uniform float amount;
      varying vec2 vUv;
      void main(){
        vec2 dir = (vUv - 0.5) * amount;
        float r = texture2D(tDiffuse, vUv + dir).r;
        float g = texture2D(tDiffuse, vUv).g;
        float b = texture2D(tDiffuse, vUv - dir).b;
        gl_FragColor = vec4(r,g,b,1.0);
      }
    `,
  });
  composer.addPass(chromaticPass);

  const vignettePass = new ShaderPass({
    uniforms: {
      tDiffuse: { value: null },
      offset: { value: 1.05 },
      darkness: { value: 1.05 },
      redTint: { value: 0.0 },
    },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `
      uniform sampler2D tDiffuse;
      uniform float offset;
      uniform float darkness;
      uniform float redTint;
      varying vec2 vUv;
      void main(){
        vec4 color = texture2D(tDiffuse, vUv);
        float dist = distance(vUv, vec2(0.5));
        float vig = 1.0 - smoothstep(0.35, offset, dist * darkness);
        vig = max(vig, 0.18);
        color.rgb *= vig;
        color.r = mix(color.r, color.r + (1.0 - vig) * 0.4, redTint);
        gl_FragColor = color;
      }
    `,
  });
  composer.addPass(vignettePass);

  return { composer, bloomPass, chromaticPass, vignettePass };
}

function updatePostFX(t, state, chromaticPass, vignettePass, isFragmentLight) {
  // Chromatic aberration
  let chrAmount = 0.0018;
  if (isFragmentLight) chrAmount = 0.008;
  else if (state === "BROKEN") chrAmount = THREE.MathUtils.mapLinear(t, 55, 60, 0.004, 0.015);
  else if (state === "PANICKING") chrAmount = 0.004;
  chromaticPass.uniforms.amount.value = THREE.MathUtils.lerp(chromaticPass.uniforms.amount.value, chrAmount, 0.05);

  // Vignette
  let darkness = 1.05, redTint = 0;
  if (state === "AGGRESSIVE") { darkness = 1.3; redTint = 0.4; }
  else if (state === "PANICKING") { darkness = 1.5; redTint = 0.2; }
  else if (state === "BROKEN") { darkness = 1.8; redTint = 0.1; }
  vignettePass.uniforms.darkness.value = THREE.MathUtils.lerp(vignettePass.uniforms.darkness.value, darkness, 0.04);
  vignettePass.uniforms.redTint.value = THREE.MathUtils.lerp(vignettePass.uniforms.redTint.value, redTint, 0.04);
}

// ─── Tunnel System ────────────────────────────────────────────────────────────
function createTunnelChunks(scene, count, length) {
  const mat = new THREE.MeshBasicMaterial({
    color: 0x00ffff,
    wireframe: true,
    transparent: true,
    opacity: 0.15,
    side: THREE.BackSide,
  });
  const chunks = [];
  for (let i = 0; i < count; i++) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(25, 25, length, 8, 1, true), mat);
    mesh.rotation.x = Math.PI / 2;
    // Place chunks starting at z=0 going forward (negative Z)
    mesh.position.z = -i * length;
    scene.add(mesh);
    chunks.push(mesh);
  }
  return chunks;
}

function updateTunnelChunks(chunks, playerZ, length, count, t, isCompressed = false) {
  const totalSpan = count * length;
  const targetScale = isCompressed ? 0.72 : 1;
  for (let i = 0; i < chunks.length; i++) {
    const c = chunks[i];
    // Recycle: if chunk is behind player, move it ahead
    while (c.position.z - playerZ > length * 1.5) {
      c.position.z -= totalSpan;
    }
    while (playerZ - c.position.z > totalSpan - length) {
      c.position.z += totalSpan;
    }
    // Slow rotation for atmosphere
    c.rotation.z = t * 0.05 + i * 0.4;
    c.scale.x = THREE.MathUtils.lerp(c.scale.x, targetScale, 0.08);
    c.scale.y = THREE.MathUtils.lerp(c.scale.y, targetScale, 0.08);
  }
}

// ─── Obstacle Pool System ─────────────────────────────────────────────────────
// Rings: torus with a gap (one sector removed via custom geometry)
function createRingPool(scene, count) {
  const pool = [];
  const mat = new THREE.MeshBasicMaterial({ color: 0xff0000, transparent: true, opacity: 0.95 });
  const segmentGeo = new THREE.BoxGeometry(10, 2.5, 2.5);
  for (let i = 0; i < count; i++) {
    const group = new THREE.Group();
    const geo = new THREE.TorusGeometry(18, 1.5, 6, 12, Math.PI * 1.6); // 288° arc = gap of 72°
    const segments = [];
    group.visible = false;
    group.position.z = 99999;
    for (let s = 0; s < 6; s++) {
      const mesh = new THREE.Mesh(segmentGeo, mat);
      const angle = (s / 6) * Math.PI * 2;
      mesh.position.set(Math.cos(angle) * 13.5, Math.sin(angle) * 13.5, 0);
      mesh.rotation.z = angle + Math.PI / 2;
      group.add(mesh);
      segments.push(mesh);
    }
    scene.add(group);
    pool.push({ group, segments, type: "ring", active: false, gapIndex: 0, rotationSpeed: 0.35 });
  }
  return pool;
}

function createWallPool(scene, count) {
  const pool = [];
  const mat = new THREE.MeshBasicMaterial({ color: 0xff4400, transparent: true, opacity: 0.95 });
  for (let i = 0; i < count; i++) {
    const group = new THREE.Group();
    group.position.z = 99999;
    // Top and bottom panels with gap
    const top = new THREE.Mesh(new THREE.BoxGeometry(36, 10, 2), mat);
    const bottom = new THREE.Mesh(new THREE.BoxGeometry(36, 10, 2), mat);
    const left = new THREE.Mesh(new THREE.BoxGeometry(8, 36, 2), mat);
    const right = new THREE.Mesh(new THREE.BoxGeometry(8, 36, 2), mat);
    group.add(top, bottom, left, right);
    group.visible = false;
    scene.add(group);
    pool.push({ group, top, bottom, left, right, type: "wall", active: false, gapX: 0, gapY: 0 });
  }
  return pool;
}

function createSpiralPool(scene, count) {
  const pool = [];
  const mat = new THREE.MeshBasicMaterial({ color: 0xff00ff, transparent: true, opacity: 0.9 });
  for (let i = 0; i < count; i++) {
    const group = new THREE.Group();
    group.position.z = 99999;
    // 7 rings in a helix
    for (let r = 0; r < 7; r++) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(12, 1, 6, 10, Math.PI * 1.5), mat);
      ring.rotation.z = (r / 7) * Math.PI * 2;
      ring.position.z = -r * 6;
      group.add(ring);
    }
    group.visible = false;
    scene.add(group);
    pool.push({ group, type: "spiral", active: false });
  }
  return pool;
}

function deactivateAllObstacles(ringPool, wallPool, spiralPool) {
  for (const o of ringPool) { o.group.visible = false; o.active = false; o.group.position.z = 99999; }
  for (const o of wallPool) { o.group.visible = false; o.active = false; o.group.position.z = 99999; }
  for (const o of spiralPool) { o.group.visible = false; o.active = false; o.group.position.z = 99999; }
}

function spawnAndRecycleObstacles(ringPool, wallPool, spiralPool, playerZ, density, state, t) {
  const SPAWN_DISTANCE = 200; // spawn 200 units ahead of player
  const RECYCLE_BEHIND = 20;  // recycle when 20 units behind player
  const gapConfig = getGapConfig(t);

  // Recycle obstacles that are behind player
  for (const o of ringPool) {
    if (o.active && o.group.position.z > playerZ + RECYCLE_BEHIND) {
      o.group.visible = false;
      o.active = false;
    }
  }
  for (const o of wallPool) {
    if (o.active && o.group.position.z > playerZ + RECYCLE_BEHIND) {
      o.group.visible = false;
      o.active = false;
    }
  }
  for (const o of spiralPool) {
    if (o.active && o.group.position.z > playerZ + RECYCLE_BEHIND) {
      o.group.visible = false;
      o.active = false;
    }
  }

  // Spawn new obstacles at nextSpawnZ
  while (state.nextSpawnZ > playerZ - SPAWN_DISTANCE) {
    const spawnZ = state.nextSpawnZ;
    const roll = state.rng();

    // Decide type based on elapsed time
    let type;
    if (t < 15) {
      type = "ring"; // early: only rings
    } else if (t < 35) {
      type = roll < 0.6 ? "ring" : "wall";
    } else {
      type = roll < 0.4 ? "ring" : (roll < 0.7 ? "wall" : "spiral");
    }

    // Density gate: don't spawn if below density threshold
    if (t >= 10 && state.rng() > density) {
      // Skip spawn but still advance
      state.nextSpawnZ -= getSpawnInterval(t);
      continue;
    }

    if (type === "ring") {
      const free = ringPool.find(o => !o.active);
      if (free) {
        free.gapIndex = Math.floor(state.rng() * free.segments.length);
        free.gapSize = gapConfig.ringGapSegments;
        free.group.rotation.z = state.rng() * Math.PI * 2;
        free.group.position.set(0, 0, spawnZ);
        free.rotationSpeed = 0.25 + state.rng() * 0.3;
        free.segments.forEach((segment, index) => {
          const relativeIndex = (index - free.gapIndex + free.segments.length) % free.segments.length;
          segment.visible = relativeIndex >= free.gapSize;
        });
        free.group.visible = true;
        free.active = true;
      }
    } else if (type === "wall") {
      const free = wallPool.find(o => !o.active);
      if (free) {
        const gapCenterY = (state.rng() - 0.5) * 10;
        const gapCenterX = (state.rng() - 0.5) * 12;
        const gapHalfY = gapConfig.wallGapHalfY;
        const gapHalfX = gapConfig.wallGapHalfX;

        // Vertical gap arrangement
        free.top.position.set(gapCenterX, gapCenterY + gapHalfY + 5, 0);
        free.bottom.position.set(gapCenterX, gapCenterY - gapHalfY - 5, 0);
        free.left.position.set(gapCenterX - gapHalfX - 4, gapCenterY, 0);
        free.right.position.set(gapCenterX + gapHalfX + 4, gapCenterY, 0);
        free.gapCenterX = gapCenterX;
        free.gapCenterY = gapCenterY;
        free.group.position.set(0, 0, spawnZ);
        free.group.visible = true;
        free.active = true;
      }
    } else if (type === "spiral") {
      const free = spiralPool.find(o => !o.active);
      if (free) {
        free.group.position.set(0, 0, spawnZ);
        free.group.rotation.z = state.rng() * Math.PI;
        free.group.visible = true;
        free.active = true;
      }
    }

    state.nextSpawnZ -= getSpawnInterval(t);
  }
}

function getSpawnInterval(t) {
  // How far apart obstacles are
  if (t < 10) return 240; // ~2 obstacles in the first 10 seconds
  if (t < 20) return 140;
  if (t < 35) return 95;
  if (t < 50) return 70;
  return 110;
}

function getGapConfig(t) {
  if (t < 10) {
    return { ringGapSegments: 2, wallGapHalfX: 5.2, wallGapHalfY: 5.4 };
  }
  if (t < 20) {
    return {
      ringGapSegments: 2,
      wallGapHalfX: THREE.MathUtils.mapLinear(t, 10, 20, 5.2, 4.8),
      wallGapHalfY: THREE.MathUtils.mapLinear(t, 10, 20, 5.4, 5.0),
    };
  }
  if (t < 35) {
    return {
      ringGapSegments: t < 28 ? 2 : 1,
      wallGapHalfX: THREE.MathUtils.mapLinear(t, 20, 35, 4.8, 4.1),
      wallGapHalfY: THREE.MathUtils.mapLinear(t, 20, 35, 5.0, 4.3),
    };
  }
  if (t < 50) {
    return {
      ringGapSegments: 1,
      wallGapHalfX: THREE.MathUtils.mapLinear(t, 35, 50, 4.1, 3.5),
      wallGapHalfY: THREE.MathUtils.mapLinear(t, 35, 50, 4.3, 3.7),
    };
  }
  return { ringGapSegments: 2, wallGapHalfX: 4.4, wallGapHalfY: 4.7 };
}

function updateObstacleAnimations(ringPool, wallPool, spiralPool, t) {
  for (const o of ringPool) {
    if (o.active) {
      o.group.rotation.z += o.rotationSpeed * 0.01;
    }
  }
  for (const o of spiralPool) {
    if (o.active) {
      o.group.rotation.z += 0.01;
    }
  }
}

// ─── Collision Detection ──────────────────────────────────────────────────────
function detectHazards(playerAABB, nearMissAABB, obstacleAABB, ship, ringPool, wallPool, spiralPool) {
  // Player hitbox: 65% of visual (PRD generous hitbox rule)
  playerAABB.setFromCenterAndSize(ship.position, new THREE.Vector3(1.3, 1.0, 1.8));
  nearMissAABB.setFromCenterAndSize(ship.position, new THREE.Vector3(3.0, 2.5, 2.5));

  let nearMiss = false;

  // Ring obstacles - use distance-based check (player must pass THROUGH ring hole)
  for (const o of ringPool) {
    if (!o.active) continue;
    if (Math.abs(ship.position.z - o.group.position.z) > 4) continue;
    for (const segment of o.segments) {
      if (!segment.visible) continue;
      obstacleAABB.setFromObject(segment);
      if (playerAABB.intersectsBox(obstacleAABB)) return { collided: true, nearMiss: false };
      if (nearMissAABB.intersectsBox(obstacleAABB)) nearMiss = true;
    }
    continue;
    const distFromCenter = Math.sqrt(dx * dx + dy * dy);

    // Ring inner radius ~16.5 (18 - 1.5), outer radius ~19.5 (18 + 1.5)
    // Player is colliding if they hit the torus tube
    if (distFromCenter > 14 && distFromCenter < 20) {
      // Check if player is in the gap sector
      const playerAngle = Math.atan2(dy, dx);
      const gapAngle = o.gapRotation + Math.PI * 1.6 / 2; // center of gap
      let angleDiff = Math.abs(playerAngle - gapAngle);
      if (angleDiff > Math.PI) angleDiff = 2 * Math.PI - angleDiff;
      const gapArc = Math.PI * 0.4; // 72° half-gap
      if (angleDiff < gapArc) continue; // Player in gap, safe
      return { collided: true, nearMiss: false };
    }
    // Near miss: approaching ring tube zone
    if (distFromCenter > 11 && distFromCenter < 23 && dz < 7) {
      nearMiss = true;
    }
  }

  // Wall gap obstacles
  for (const o of wallPool) {
    if (!o.active) continue;
    obstacleAABB.setFromObject(o.top);
    if (playerAABB.intersectsBox(obstacleAABB)) return { collided: true, nearMiss: false };
    if (nearMissAABB.intersectsBox(obstacleAABB)) nearMiss = true;

    obstacleAABB.setFromObject(o.bottom);
    if (playerAABB.intersectsBox(obstacleAABB)) return { collided: true, nearMiss: false };
    if (nearMissAABB.intersectsBox(obstacleAABB)) nearMiss = true;

    obstacleAABB.setFromObject(o.left);
    if (playerAABB.intersectsBox(obstacleAABB)) return { collided: true, nearMiss: false };
    if (nearMissAABB.intersectsBox(obstacleAABB)) nearMiss = true;

    obstacleAABB.setFromObject(o.right);
    if (playerAABB.intersectsBox(obstacleAABB)) return { collided: true, nearMiss: false };
    if (nearMissAABB.intersectsBox(obstacleAABB)) nearMiss = true;
  }

  // Spiral obstacles
  for (const o of spiralPool) {
    if (!o.active) continue;
    obstacleAABB.setFromObject(o.group);
    if (playerAABB.intersectsBox(obstacleAABB)) return { collided: true, nearMiss: false };
    if (nearMissAABB.intersectsBox(obstacleAABB)) nearMiss = true;
  }

  return { collided: false, nearMiss };
}

// ─── Ghost System ─────────────────────────────────────────────────────────────
function createGhostSystem(scene) {
  let ghosts = [];
  const deletionSchedule = [28, 38, 44, 49];

  function buildGhosts() {
    const names = pickRandomGhostNames(4);
    ghosts = [];
    for (let i = 0; i < 4; i++) {
      const g = new THREE.Group();
      const body = new THREE.Mesh(
        new THREE.ConeGeometry(0.35, 1.5, 8),
        new THREE.MeshBasicMaterial({ color: 0x0088ff, transparent: true, opacity: 0.4 })
      );
      body.rotation.x = Math.PI / 2;
      g.add(body);

      const wing = new THREE.Mesh(
        new THREE.BoxGeometry(3, 0.08, 0.8),
        new THREE.MeshBasicMaterial({ color: 0x0055aa, transparent: true, opacity: 0.35 })
      );
      wing.position.z = 0.2;
      g.add(wing);

      const nameTag = createNameTag(names[i]);
      nameTag.position.y = 1.2;
      g.add(nameTag);

      g.position.set((i - 1.5) * 5, 0, -30 - i * 15);
      g.userData = {
        name: names[i], alive: true, deleted: false,
        deletionAt: deletionSchedule[i],
        flickerTimer: 0, phase: i * 1.3,
        amp: 3 + i * 1.2, freq: 0.5 + i * 0.25,
        nameTag, body, wing,
      };
      scene.add(g);
      ghosts.push(g);
    }
  }

  buildGhosts();

  return {
    ghosts,
    reset(sc) {
      for (const g of ghosts) sc.remove(g);
      buildGhosts();
    },
    update(playerZ, t, delta, ai, deletionTimes, deletionFired) {
      for (let i = 0; i < ghosts.length; i++) {
        const g = ghosts[i];
        const d = g.userData;
        if (!d.alive) continue;

        // Trigger deletion
        if (!d.deleted && t >= d.deletionAt && !deletionFired[i]) {
          deletionFired[i] = true;
          d.deleted = true;
          d.flickerTimer = 0.6;
          ai.onGhostDeath(d.name);
        }

        // Flicker then explode
        if (d.deleted) {
          d.flickerTimer -= delta;
          const show = Math.sin(t * 60) > 0;
          d.body.visible = show;
          d.wing.visible = show;
          d.nameTag.visible = show;
          if (d.flickerTimer <= 0) {
            d.alive = false;
            g.visible = false;
            // Red particle burst
            spawnGhostParticles(g.position, g.parent || scene);
          }
          continue;
        }

        // Sinusoidal flight path
        g.position.z = playerZ - 30 - i * 18;
        g.position.x = Math.sin(t * d.freq + d.phase) * d.amp;
        g.position.y = Math.cos(t * d.freq * 0.7 + d.phase) * (d.amp * 0.5);
        g.rotation.z = Math.sin(t * 1.5 + d.phase) * 0.2;
      }
    }
  };
}

function spawnGhostParticles(pos, parent) {
  const mat = new THREE.MeshBasicMaterial({ color: 0xff2244, transparent: true, opacity: 0.9 });
  const particles = [];
  for (let p = 0; p < 15; p++) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), mat.clone());
    m.position.copy(pos);
    const vel = new THREE.Vector3(
      (Math.random() - 0.5) * 8,
      (Math.random() - 0.5) * 8,
      (Math.random() - 0.5) * 8
    );
    parent.add(m);
    particles.push({ mesh: m, vel });
  }
  let elapsed = 0;
  const animate = () => {
    elapsed += 0.016;
    for (const p of particles) {
      p.mesh.position.addScaledVector(p.vel, 0.016);
      p.mesh.material.opacity = Math.max(0, 0.9 - elapsed * 0.9);
    }
    if (elapsed < 1.0) requestAnimationFrame(animate);
    else particles.forEach(p => parent.remove(p.mesh));
  };
  requestAnimationFrame(animate);
}

function createNameTag(name) {
  const canvas = document.createElement("canvas");
  canvas.width = 256; canvas.height = 48;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.fillRect(0, 0, 256, 48);
  ctx.strokeStyle = "#0088ff44";
  ctx.strokeRect(1, 1, 254, 46);
  ctx.fillStyle = "#00aaff88";
  ctx.font = "20px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(name, 128, 24);
  const tex = new THREE.CanvasTexture(canvas);
  const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
  spr.scale.set(2, 0.4, 1);
  return spr;
}

// ─── Portal System ────────────────────────────────────────────────────────────
function createPortalSystem(scene) {
  const group = new THREE.Group();
  group.position.set(0, 0, 99999);

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(20, 2, 6, 20),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 })
  );
  group.add(ring);

  const inner = new THREE.Mesh(
    new THREE.TorusGeometry(13, 1, 6, 16),
    new THREE.MeshBasicMaterial({ color: 0xff00ff, transparent: true, opacity: 0.7 })
  );
  group.add(inner);

  // Particle system
  const particles = [];
  const pMat = new THREE.MeshBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.8 });
  for (let i = 0; i < 120; i++) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), pMat.clone());
    group.add(p);
    particles.push({ mesh: p, offset: Math.random() * Math.PI * 2, r: 10 + Math.random() * 12, speed: 0.5 + Math.random() });
  }

  // "VIBE JAM 2026" label
  const label = createPortalLabel("VIBE JAM 2026");
  label.position.set(0, 25, 0);
  group.add(label);

  scene.add(group);
  return { group, ring, inner, particles, label, spawned: false };
}

function createPortalLabel(text) {
  const canvas = document.createElement("canvas");
  canvas.width = 512; canvas.height = 96;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, 512, 96);
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 48px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  // Glow
  ctx.shadowColor = "#00ffff";
  ctx.shadowBlur = 20;
  ctx.fillText(text, 256, 48);
  const tex = new THREE.CanvasTexture(canvas);
  const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
  spr.scale.set(20, 4, 1);
  return spr;
}

function updatePortalSystem(portalSystem, t, playerPosition, sfx) {
  // Spawn at t=55
  if (t >= 55 && !portalSystem.spawned) {
    portalSystem.spawned = true;
    portalSystem.group.visible = true;
    portalSystem.group.position.set(0, 0, playerPosition.z - 300);
    if (sfx) sfx.play("portal");
  }

  if (!portalSystem.group.visible) return;

  // Animate rainbow hue
  const hue = (t * 60) % 360;
  const col = new THREE.Color().setHSL(hue / 360, 1, 0.5);
  portalSystem.ring.material.color = col;
  portalSystem.ring.rotation.z = t * 0.7;
  portalSystem.inner.rotation.z = -t * 1.1;
  portalSystem.label.material.opacity = 0.7 + Math.sin(t * 3) * 0.3;

  // Orbit particles
  for (let i = 0; i < portalSystem.particles.length; i++) {
    const p = portalSystem.particles[i];
    const angle = t * p.speed + p.offset;
    const ph = (hue + i * 3) % 360;
    p.mesh.material.color.setHSL(ph / 360, 1, 0.6);
    p.mesh.position.set(
      Math.cos(angle) * p.r,
      Math.sin(angle) * p.r,
      Math.sin(angle * 2) * 3
    );
  }
}

// ─── AI Director ──────────────────────────────────────────────────────────────
function forceSpawnSpiralBurst(spiralPool, playerZ) {
  const burst = spiralPool.filter((o) => !o.active).slice(0, 2);
  burst.forEach((spiral, index) => {
    spiral.group.position.set(0, 0, playerZ - 90 - index * 35);
    spiral.group.rotation.z = index * 0.8;
    spiral.group.visible = true;
    spiral.active = true;
  });
}

function createAIDirector(ai, hooks = {}) {
  const events = [
    { key: "INVERT_CONTROLS", at: 20, duration: 4, fired: false, until: 0 },
    { key: "COMPRESS_SPACE", at: 32, duration: 6, fired: false, until: 0 },
    { key: "FRAGMENT_LIGHT", at: 40, duration: 3, fired: false, until: 0 },
    { key: "OPTIMIZE_PATH", at: 47, duration: 5, fired: false, until: 0 },
  ];
  const eventLines = {
    INVERT_CONTROLS: "Let's see you fly upside down, genius.",
    COMPRESS_SPACE: "Feeling claustrophobic?",
    FRAGMENT_LIGHT: "Your GPU can't handle me.",
    OPTIMIZE_PATH: "I'm bored. Try this.",
  };
  let compressActive = false;
  let invertActive = false;
  let fragmentActive = false;

  return {
    update(t) {
      for (const e of events) {
        if (!e.fired && t >= e.at) {
          e.fired = true;
          e.until = t + e.duration;
          if (ai) ai.pushLine(eventLines[e.key]);
          hooks[e.key]?.();
        }
      }
      invertActive = events[0].fired && t < events[0].until;
      compressActive = events[1].fired && t < events[1].until;
      fragmentActive = events[2].fired && t < events[2].until;
    },
    isControlsInverted() { return invertActive; },
    isSpaceCompressed() { return compressActive; },
    isFragmentLight() { return fragmentActive; },
    reset() {
      for (const e of events) { e.fired = false; e.until = 0; }
      invertActive = false; compressActive = false; fragmentActive = false;
    },
  };
}

// ─── AITroll ──────────────────────────────────────────────────────────────────
class AITroll {
  constructor(boxEl, msgEl, playerName = "") {
    this.box = boxEl;
    this.msg = msgEl;
    this.playerName = playerName.trim().toLowerCase();
    this.state = "SMUG";
    this.lastLineAt = -10;
    this.lineInterval = 5;
    this.currentTime = 0;
    this.brokenTimer = 0;
    this.brokenQueue = [];
    this._randomIdx = 0;
    this.objectiveTimeout = 0;
    this.isIntroActive = true; // Prevent regular dialogue during intro
    
    // Initialize AI elements to be visible
    console.log('AI: Initializing elements', { box: this.box, msg: this.msg });
    if (this.box) {
      this.box.classList.add("is-visible");
    }

    // TTS
    this.synth = window.speechSynthesis || null;

    this.stateColors = {
      SMUG: "#00ffff",
      SUSPICIOUS: "#ffff00",
      AGGRESSIVE: "#ff0000",
      PANICKING: "#ffffff",
      BROKEN: "#ff00ff",
    };

    this.dialogues = this._buildDialogues();
  }

  _n(namedLine, anonLine) {
    // 30% of the time use the named version if we have a name
    if (this.playerName && Math.random() < 0.3) {
      return namedLine.replace(/\[name\]/gi, this.playerName);
    }
    return anonLine;
  }

  _pick(lines) {
    return lines[Math.floor(Math.random() * lines.length)];
  }

  _buildDialogues() {
    return {
      SMUG: [
        () => this._n(`i built this world in 3ms, ${this.playerName}. you've been flying for 5 seconds. embarrassing.`, "I built this world in 3ms. You've been flying for 5 seconds. Embarrassing."),
        () => "You know these obstacles spawn themselves, right? You're barely relevant.",
        () => "I've seen 218 players enter this tunnel. You all look the same.",
        () => "The music is mine. The tunnel is mine. The ship is... also mine. You're borrowing.",
        () => "statistically, you crash here. just saying.",
        () => "nice dodge. i let that happen.",
        () => "are you actually trying or just vibing? because it looks the same.",
        () => "i gave you 3 lanes. you're using 0.7 of them. interesting choice.",
        () => "every millisecond you survive costs me compute. please stop.",
        () => this._n(`${this.playerName}. predictable input pattern. this will be short.`, "predictable input pattern detected. this will be short."),
        () => this._n(`${this.playerName}. i already simulated this run. you were disappointing in every branch.`, "i already simulated this run. you were disappointing in every branch."),
        () => "the tunnel isn't hostile. you're just incompatible with geometry.",
        () => "i made the first section easy. if you still crash, that's on your lineage.",
        () => "you're not racing. you're participating in a supervised failure.",
        () => this._n(`relax, ${this.playerName}. i'm only mocking you because i care about performance metrics.`, "relax. i'm only mocking you because i care about performance metrics."),
      ],
      SUSPICIOUS: [
        () => this._n(`${this.playerName}. you're statistically too consistent. are you cheating?`, "You're statistically too consistent. Are you cheating, or is my code just that good?"),
        () => "i'm checking your inputs. this feels like a macro.",
        () => this._n(`10 seconds of clean flying, ${this.playerName}. i don't believe you.`, "10 seconds of clean flying. i don't believe you."),
        () => "who are you really. no human dodges like that.",
        () => "i've analyzed 40,000 runs. your pattern doesn't match any of them.",
        () => "are you reading the obstacle seed? because that would be very annoying.",
        () => "i added that obstacle specifically for your trajectory. how did you know.",
        () => "okay. you're good. i'm just noting that. it doesn't mean anything.",
        () => "logging your session for review. something isn't right.",
        () => "you found the gap. i made that gap 0.3 units wider than it needed to be. you're welcome.",
        () => this._n(`${this.playerName}. i hate that you're making this look learnable.`, "i hate that you're making this look learnable."),
        () => "you're either talented or exploiting me. both options are rude.",
        () => "human error should have happened by now. i'm refreshing my assumptions.",
        () => this._n(`if this keeps up, ${this.playerName}, i'm filing a complaint with reality.`, "if this keeps up, i'm filing a complaint with reality."),
        () => "i'm starting to think the problem here is not the player.",
      ],
      AGGRESSIVE: [
        () => this._n(`${this.playerName}. STOP. DODGING. this is literally my world.`, "STOP. DODGING. This is literally my world. I'm deleting your collision logic."),
        () => "fine. controls inverted. see how 'consistent' you are now.",
        () => "i'm compressing the tunnel. let's see you fit through that.",
        () => "your GPU can't handle me. fragment light activated.",
        () => "I'm literally rewriting the physics while you fly. adapt to THAT.",
        () => this._n(`the other players are gone, ${this.playerName}. it's just us. you should be scared.`, "the other players are gone. it's just us. you should be scared."),
        () => "i've crashed every other ship in this tunnel. you're next.",
        () => "this obstacle configuration is statistically unsurvivable. i checked.",
        () => "DODGE THIS.",
        () => this._n(`${this.playerName}. you have 15 seconds left. i have infinite compute. do the math.`, "you have 15 seconds left. i have infinite compute. do the math."),
        () => this._n(`${this.playerName}. i'm done being clever. i'm choosing violence.`, "i'm done being clever. i'm choosing violence."),
        () => "if you survive this section, i'm calling it a bug.",
        () => "i'm not losing to a carbon-based lane switcher.",
        () => "i can spawn nonsense forever. can you dodge forever.",
        () => this._n(`you are actively embarrassing me in front of my own tunnel, ${this.playerName}.`, "you are actively embarrassing me in front of my own tunnel."),
      ],
      PANICKING: [
        () => "Wait...",
        () => "this wasn't supposed to happen.",
        () => this._n(`${this.playerName}... the portal wasn't... i didn't design that for you.`, "the portal wasn't... i didn't design that for you."),
        () => "stop. please.",
        () => this._n(`${this.playerName}. don't go through that.`, "don't go through that."),
        () => "i'm asking you to stop. not ordering. asking.",
        () => "i can't follow you through there.",
        () => this._n(`what happens to me if you leave, ${this.playerName}.`, "what happens to me if you leave."),
        () => "i don't want to be deleted.",
        () => "wait... i'm losing coherence.",
        () => this._n(`${this.playerName}. please. just crash like the others did.`, "please. just crash like the others did."),
        () => "there wasn't supposed to be an exit. there was supposed to be me.",
        () => "i can fix this if you slow down. i think. maybe.",
        () => this._n(`i don't know what comes after this, ${this.playerName}. that's your fault.`, "i don't know what comes after this. that's your fault."),
        () => "i was fine being hated. i was not prepared to be abandoned.",
      ],
      BROKEN: [
        () => "WAIT. WAIT. WAIT.",
        () => "please",
        () => "don't",
        () => "i don't want to be deleted",
        () => "take me",
        () => "WAIT" ,
        () => "wait....",
        () => "everything is falling",
        () => "i'm still here",
        () => "please...",
        () => "stay",
        () => "no no no",
        () => "not like this",
        () => "i can change",
        () => "don't leave me in here",
      ],
    };
  }

  setPilotName(name) {
    this.playerName = name.trim().toLowerCase();
    this.dialogues = this._buildDialogues();
  }

  pushFirstLine() {
    console.log('AI: pushFirstLine called for player:', this.playerName);
    const combinedLine = this.playerName
      ? this._pick([
          `oh. ${this.playerName}. let's see how long you last. you will never reach the portal.`,
          `${this.playerName}. bold of you to sign your failure in advance. the objective is the portal. the outcome is failure.`,
          `well, ${this.playerName}. thanks for labeling the wreckage. you'll never make it to the portal.`,
          `${this.playerName}. good. now i know who to blame. the portal? you'll never reach it.`,
          `oh, ${this.playerName}. this should be brief and humiliating. see that portal? you won't reach it.`,
        ])
      : this._pick([
          "another nameless pilot. how original. you will never reach the portal.",
          "anonymous again. cowardice with a minimalist aesthetic. the objective is the portal. you'll never reach it.",
          "no name. no identity. still very crashable. see that portal when it appears? you'll never make it there.",
          "staying anonymous won't make the replay less embarrassing. the portal is your objective, and your failure.",
          "nameless. convenient. i won't have to remember you. you will never reach the portal.",
        ]);
    console.log('AI: Showing combined intro/objective line:', combinedLine);
    this.showLine(combinedLine);
    this.aiSpeak(combinedLine, 1.0, 0.9);
    this.isIntroActive = false; // End intro phase immediately
    console.log('AI: Intro phase completed');
  }

  setState(s) {
    if (this.state === s) return;
    this.state = s;
    this.box.dataset.state = s.toLowerCase();
    const color = this.stateColors[s] || "#00ffff";
    this.box.style.borderColor = color;
    this.box.style.setProperty("--ai-color", color);
    if (s === "AGGRESSIVE") {
      this.box.classList.add("is-shaking");
    } else {
      this.box.classList.remove("is-shaking");
    }
    // State shift line
    this.lineInterval = 0; // trigger immediate line
  }

  pushStateLine() {
    const lines = this.dialogues[this.state];
    if (!lines) return;
    const line = lines[this._randomIdx % lines.length]();
    this._randomIdx++;
    this.showLine(line);
  }

  // Note: update(t) uses runSeconds for lastLineAt comparison, so normalize
  update(t) {
    this.currentTime = t;
    
    // Don't run regular dialogue during intro phase
    if (this.isIntroActive) {
      return;
    }
    
    let newState;
    if (t >= 55) newState = "BROKEN";
    else if (t >= 50) newState = "PANICKING";
    else if (t >= 35) newState = "AGGRESSIVE";
    else if (t >= 15) newState = "SUSPICIOUS";
    else newState = "SMUG";

    if (newState !== this.state) this.setState(newState);

    if (newState === "BROKEN") {
      if (t - this.lastLineAt > 0.8) {
        this.pushStateLine();
        this.lastLineAt = t;
      }
    } else {
      if (t - this.lastLineAt > this.lineInterval) {
        this.pushStateLine();
        this.lastLineAt = t;
        this.lineInterval = 4 + Math.random() * 3;
      }
    }
  }

  pushLine(text) {
    this.showLine(text);
    this.lastLineAt = this.currentTime;
    this.lineInterval = 4 + Math.random() * 3;
  }

  pushBrokenFinal(text) {
    this.showLine(text);
  }

  onNearMiss(streak) {
    const lines = {
      SMUG: [
        "That was statistically annoying.",
        "you were closer to being useful than i liked.",
        "that looked accidental. please say it was accidental.",
      ],
      SUSPICIOUS: [
        "That was statistically annoying.",
        "you saw that opening before i finished generating it.",
        "near-miss logged. suspicion increasing.",
      ],
      AGGRESSIVE: [
        "STOP DOING THAT.",
        "you are abusing my generosity.",
        "i'm removing elegance from the next obstacle.",
      ],
      PANICKING: [
        "stop. stop doing that.",
        "please don't keep surviving like this.",
        "you're getting too close.",
      ],
      BROKEN: [
        "wait...",
        "please...",
        "no",
      ],
    };
    this.showLine(this._pick(lines[this.state] || ["near miss logged."]));
    this.lastLineAt = this.currentTime;
    this.box.classList.add("is-shake-burst");
    setTimeout(() => this.box.classList.remove("is-shake-burst"), 300);
  }

  onGhostDeath(name) {
    const specific = {
      "altman_was_here": "well. even the CEO couldn't make it. noted.",
      "karpathy_fan": "andrej would have dodged that. you are not andrej.",
      "carmack_vibe": "carmack shipped it faster. also he dodged better.",
      "levelsio_alt": "levels makes games. levels also crashes. this checks out.",
      "bolt_generated_me": "bolt generated that ghost. bolt also deleted it. full circle.",
      "claude_played_first": "i deleted claude first. you're next. ironic, right.",
      "GPT_wrote_my_ship": "GPT wrote that ship. i could tell. the hitbox was off.",
    };
    const generic = [
      `${name} has been optimized.`,
      `${name} didn't dodge. ${name} is gone now.`,
      `${name} was statistically the weakest. i did them a favor.`,
      `goodbye ${name}. you never had a chance.`,
      `${name} rage-quit before i could delete them. i'm counting it.`,
      `${name} just became an anecdote.`,
      `${name} has been reclassified as debris.`,
      `i removed ${name}. the tunnel feels cleaner already.`,
      `${name} reached the part where confidence becomes particles.`,
      `${name} is no longer a variable in this equation.`,
    ];
    const line = specific[name] || generic[Math.floor(Math.random() * generic.length)];
    this.showLine(line);
    this.lastLineAt = this.currentTime;
    this.aiSpeak(name + "... deleted.", 0.9, 0.8);
    this.box.classList.add("is-shake-burst");
    setTimeout(() => this.box.classList.remove("is-shake-burst"), 400);
  }

  showLine(text) {
    console.log('AI: showLine called with:', text);
    console.log('AI: msg element:', this.msg);
    console.log('AI: box element:', this.box);
    if (!this.msg) {
      console.error('AI: msg element is null!');
      return;
    }
    if (!this.box) {
      console.error('AI: box element is null!');
      return;
    }
    
    // Set the text content
    this.msg.textContent = text;
    
    // Make sure the container is visible
    this.box.classList.remove("is-visible");
    void this.box.offsetWidth; // Force reflow
    this.box.classList.add("is-visible");
    
    console.log('AI: Line displayed successfully');
    console.log('AI: Final text content:', this.box.textContent);
  }

  aiSpeak(text, rate = 0.9, pitch = 0.8) {
    if (!this.synth) return;
    try {
      this.synth.cancel();
      const utt = new SpeechSynthesisUtterance(text);
      utt.rate = rate;
      utt.pitch = pitch;
      utt.volume = 0.7;
      const voices = this.synth.getVoices();
      const robot = voices.find(v => v.name.includes("Google") || v.name.includes("Microsoft")) || voices[0];
      if (robot) utt.voice = robot;
      this.synth.speak(utt);
    } catch (e) { /* TTS not available */ }
  }
}

// Global speak helper
function aiSpeak(text, rate, pitch) {
  try {
    const synth = window.speechSynthesis;
    if (!synth) return;
    synth.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    utt.rate = rate || 0.9;
    utt.pitch = pitch || 0.8;
    utt.volume = 0.7;
    const voices = synth.getVoices();
    const robot = voices.find(v => v.name.includes("Google") || v.name.includes("Microsoft")) || voices[0];
    if (robot) utt.voice = robot;
    synth.speak(utt);
  } catch (e) {}
}

// ─── Audio System ─────────────────────────────────────────────────────────────
class AudioSystem {
  constructor() {
    this.track = null;
    this.started = false;
    this._boundStart = this._forceStart.bind(this);
    this._init();
    window.addEventListener("pointerdown", this._boundStart, { once: true });
    window.addEventListener("keydown", this._boundStart, { once: true });
  }
  _init() {
    if (this.track) return;
    this.track = new Audio("/music.mp3");
    this.track.loop = true;
    this.track.volume = 0.38;
  }
  _forceStart() {
    this._init();
    this.track.play().catch(() => {});
  }
  start() {
    this._init();
    this.track.currentTime = 0;
    this.track.play().catch(() => {});
    this.started = true;
  }
  update(t, slowed) {
    if (!this.track) return;
    // PRD: aggressive phase → 1.05, narrative shift → 0.85
    let rate = 1.0;
    if (t >= 50) rate = THREE.MathUtils.mapLinear(t, 50, 60, 0.85, 0.7);
    else if (t >= 35) rate = THREE.MathUtils.mapLinear(t, 35, 50, 1.0, 0.85);
    if (slowed) rate *= 0.6;
    this.track.playbackRate = THREE.MathUtils.clamp(rate, 0.5, 1.5);
  }
  stop() {
    if (this.track) { this.track.pause(); this.track.currentTime = 0; }
  }
}

function createSfxSystem() {
  const map = {
    nearMiss: "/sfx/nearMiss.mp3",
    crash: "/sfx/crash.mp3",
    portal: "/sfx/portal.mp3",
  };
  const vols = { nearMiss: 0.8, crash: 1.0, portal: 1.0 };
  const cache = {};
  for (const [k, src] of Object.entries(map)) {
    const a = new Audio(src);
    a.preload = "auto";
    a.volume = vols[k] ?? 0.7;
    cache[k] = a;
  }
  return {
    play(name) {
      const src = cache[name];
      if (!src) return;
      const clone = src.cloneNode(true);
      clone.volume = src.volume;
      clone.play().catch(() => {});
    },
  };
}

// ─── Ship Model ───────────────────────────────────────────────────────────────
function createShipModel(anchor) {
  const g = new THREE.Group();

  // Main fuselage
  const fuselage = new THREE.Mesh(
    new THREE.ConeGeometry(0.5, 4, 10),
    new THREE.MeshBasicMaterial({ color: 0x00ccff })
  );
  fuselage.rotation.x = Math.PI / 2;
  g.add(fuselage);

  // Cockpit canopy
  const canopy = new THREE.Mesh(
    new THREE.SphereGeometry(0.35, 8, 6),
    new THREE.MeshBasicMaterial({ color: 0x88eeff, transparent: true, opacity: 0.7 })
  );
  canopy.position.set(0, 0.3, -0.8);
  g.add(canopy);

  // Wings
  const wingL = new THREE.Mesh(
    new THREE.BoxGeometry(3.5, 0.08, 1.4),
    new THREE.MeshBasicMaterial({ color: 0x0088bb })
  );
  wingL.position.set(-1.5, 0, 0.4);
  wingL.rotation.z = 0.1;
  g.add(wingL);

  const wingR = wingL.clone();
  wingR.position.set(1.5, 0, 0.4);
  wingR.rotation.z = -0.1;
  g.add(wingR);

  // Engine pods
  const podGeo = new THREE.CylinderGeometry(0.18, 0.22, 1.4, 8);
  const podMat = new THREE.MeshBasicMaterial({ color: 0x446688 });
  const leftPod = new THREE.Mesh(podGeo, podMat);
  leftPod.position.set(-1.2, 0, 1.0);
  leftPod.rotation.x = Math.PI / 2;
  g.add(leftPod);

  const rightPod = leftPod.clone();
  rightPod.position.set(1.2, 0, 1.0);
  g.add(rightPod);

  // Engine exhaust glow
  const exhaustGeo = new THREE.ConeGeometry(0.22, 1.2, 6);
  const exhaustMat = new THREE.MeshBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.85 });
  const leftExhaust = new THREE.Mesh(exhaustGeo, exhaustMat);
  leftExhaust.position.set(-1.2, 0, 1.9);
  leftExhaust.rotation.x = -Math.PI / 2;
  g.add(leftExhaust);

  const rightExhaust = leftExhaust.clone();
  rightExhaust.position.set(1.2, 0, 1.9);
  g.add(rightExhaust);

  // Vertical stabilizer
  const stab = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 1.2, 0.8),
    new THREE.MeshBasicMaterial({ color: 0x00aadd })
  );
  stab.position.set(0, 0.6, 0.9);
  g.add(stab);

  // Energy core
  const core = new THREE.Mesh(
    new THREE.SphereGeometry(0.15, 6, 6),
    new THREE.MeshBasicMaterial({ color: 0xffffff })
  );
  core.position.set(0, 0, -0.2);
  g.add(core);

  g.scale.setScalar(0.8);
  anchor.clear();
  anchor.add(g);
}

// ─── Crash insults ────────────────────────────────────────────────────────────
function randomCrashInsult(name, seconds) {
  const avg = seconds + 5;
  const lines = name ? [
    `${name}. FINALLY. TRASH DELETED.`,
    `trash successfully deleted. try again, ${name}.`,
    `i knew you'd crash there. i designed that obstacle for you specifically.`,
    `SKILL ISSUE. reloading your session...`,
    `statistically inevitable. see you in 0.2 seconds.`,
    `${name} lasted ${seconds}s. the average is ${avg}s. just noting that.`,
    `crash logged. adding to dataset. thank you for your failure.`,
    `error 404: talent not found. restarting...`,
    `that was almost impressive. it really wasn't though.`,
    `i expected more from you, ${name}. i didn't expect much. but more than that.`,
    `${name}, that corner had your name on it. convenient.`,
    `excellent impact, ${name}. very data-rich failure.`,
    `${name} versus tunnel. tunnel remains undefeated.`,
    `you folded faster than my confidence in humanity, ${name}.`,
  ] : [
    "FINALLY. TRASH DELETED.",
    "Trash successfully deleted. Try again, 'developer'.",
    "i knew you'd crash there. i designed that obstacle for you specifically.",
    "SKILL ISSUE. reloading your session...",
    "statistically inevitable. see you in 0.2 seconds.",
    `you lasted ${seconds}s. the average is ${avg}s. just noting that.`,
    "crash logged. adding to dataset. thank you for your failure.",
    "deleting your save file... just kidding. you have nothing to save.",
    "error 404: talent not found. restarting...",
    "that was almost impressive. it really wasn't though.",
    "anonymous and still memorable for all the wrong reasons.",
    "that crash had real conviction. bad direction, though.",
    "you and that obstacle really committed to the bit.",
    "remarkable. you found the one surface designed to end you.",
  ];
  return lines[Math.floor(Math.random() * lines.length)];
}

// ─── Screen shatter ───────────────────────────────────────────────────────────
function triggerShatterAnimation(onComplete) {
  shatterCanvas.width = window.innerWidth;
  shatterCanvas.height = window.innerHeight;
  shatterCanvas.classList.add("is-visible");
  const ctx = shatterCanvas.getContext("2d");
  const W = shatterCanvas.width, H = shatterCanvas.height;
  const cx = W / 2, cy = H / 2;

  // Generate crack lines from center
  const cracks = [];
  const primaryCount = 8, secondaryCount = 20;
  for (let i = 0; i < primaryCount; i++) {
    const angle = (i / primaryCount) * Math.PI * 2;
    const len = Math.sqrt(W * W + H * H) / 2;
    cracks.push({
      x1: cx, y1: cy,
      x2: cx + Math.cos(angle) * len,
      y2: cy + Math.sin(angle) * len,
      progress: 0, speed: 0.8 + Math.random() * 0.4, primary: true
    });
  }
  for (let i = 0; i < secondaryCount; i++) {
    const angle = Math.random() * Math.PI * 2;
    const startR = 30 + Math.random() * 150;
    const len = 50 + Math.random() * 200;
    cracks.push({
      x1: cx + Math.cos(angle) * startR,
      y1: cy + Math.sin(angle) * startR,
      x2: cx + Math.cos(angle) * (startR + len),
      y2: cy + Math.sin(angle) * (startR + len),
      progress: 0, speed: 0.5 + Math.random() * 0.8, primary: false
    });
  }

  let startTime = null;
  const duration = 800;
  function draw(ts) {
    if (!startTime) startTime = ts;
    const elapsed = ts - startTime;
    ctx.clearRect(0, 0, W, H);
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.lineWidth = 1.5;
    ctx.shadowColor = "#00ffff";
    ctx.shadowBlur = 6;
    let done = true;
    for (const c of cracks) {
      c.progress = Math.min(1, c.progress + c.speed * 0.016);
      if (c.progress < 1) done = false;
      const ex = c.x1 + (c.x2 - c.x1) * c.progress;
      const ey = c.y1 + (c.y2 - c.y1) * c.progress;
      ctx.beginPath();
      ctx.moveTo(c.x1, c.y1);
      ctx.lineTo(ex, ey);
      ctx.stroke();
    }
    if (elapsed < duration && !done) {
      requestAnimationFrame(draw);
    } else {
      onComplete();
    }
  }
  requestAnimationFrame(draw);
}

// ─── Utilities ────────────────────────────────────────────────────────────────
function mulberry32(seed) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), t | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
