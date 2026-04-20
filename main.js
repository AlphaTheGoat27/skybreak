import "./style.css";
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";

// ═══════════════════════════════════════════════════════════════════
// DEV CONFIG — toggle events on/off. For developer use only.
// Players never see this. If an event is disabled, the next enabled
// event "covers" its time slot so the schedule stays full.
// ═══════════════════════════════════════════════════════════════════
const DEV_CONFIG = {
  events: {
    INVERT_CONTROLS: true,   // t=20s: flips X/Y input for 4s
    COMPRESS_SPACE: true,   // t=32s: shrinks tunnel radius for 6s
    FRAGMENT_LIGHT: true,   // t=40s: glitch shader + camera shake for 3s
    OPTIMIZE_PATH: true,   // t=47s: spawns a tight-but-fair corridor challenge
  },
  // Quick difficulty knob (1.0 = normal, 0.5 = half as many obstacles)
  difficultyMultiplier: 1.0,
};
// ═══════════════════════════════════════════════════════════════════

// ─── Constants ────────────────────────────────────────────────────────────────
const PLAYER_NAME_STORAGE_KEY = "skybreak_name";
const PERSONAL_BEST_STORAGE_KEY = "skybreak_pb";
const WEBRING_URL = "https://vibej.am/portal/2026";
const DEFAULT_FLIGHT_TIP = "WASD / ARROWS / DRAG TO MOVE · REACH THE PORTAL";

// ─── Ghost name pool ──────────────────────────────────────────────────────────
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
    if (!pool.length) break;
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
    <div class="flight-tip" id="flight-tip">${DEFAULT_FLIGHT_TIP}</div>
    <div class="ai-text-box" id="ai-text-box"><span class="ai-prefix">[SYSTEM_AI] &gt;</span> <span class="ai-message" id="ai-message"></span></div>
    <div class="chaos-overlay" id="chaos-overlay"></div>
    <div class="vignette-overlay" id="vignette-overlay"></div>
  </section>
  <section class="crash-overlay" id="crash-overlay">
    <div class="crash-text" id="crash-text">TRAJECTORY INVALID</div>
  </section>
  <section class="death-screen" id="death-screen">
    <div class="death-content">
      <div class="death-title">YOU LOST</div>
      <div class="death-sub" id="death-sub">reached 0s</div>
      <div class="death-ai-line" id="death-ai-line"></div>
      <div class="death-buttons">
        <button class="death-btn death-btn--retry" id="death-retry">TRY AGAIN</button>
        <button class="death-btn death-btn--quit" id="death-quit">QUIT TO VIBE JAM</button>
      </div>
    </div>
  </section>
  <canvas class="shatter-canvas" id="shatter-canvas"></canvas>
  <div class="white-flash" id="white-flash"></div>
  <section class="intro-screen" id="intro-screen">
    <img class="logo-mark" src="/logo.png" alt="Skybreak logo" onerror="this.style.display='none'" />
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
    <p class="creator-credit">made by ai, prompted by <a href="https://x.com/AlphaGoat2711" target="_blank" rel="noopener">@AlphaGoat2711</a></p>
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
const deathScreen = document.querySelector("#death-screen");
const deathSub = document.querySelector("#death-sub");
const deathAiLine = document.querySelector("#death-ai-line");
const deathRetry = document.querySelector("#death-retry");
const deathQuit = document.querySelector("#death-quit");
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
if (storedBest > 0) hudBest.textContent = `PB ${storedBest.toFixed(0)}s`;

// Typewriter intro label
const labelText = "[SYSTEM_AI] > identify yourself. or don't. i'll find out anyway.";
let typeIndex = 0;
const typeTimer = window.setInterval(() => {
  introLabel.classList.add("is-typing");
  typeIndex += 1;
  introLabel.textContent = labelText.slice(0, typeIndex);
  if (typeIndex >= labelText.length) { window.clearInterval(typeTimer); introLabel.classList.remove("is-typing"); }
}, 40);

let aiTroll = null;
let threeApp = null;
let hasRunStarted = false;
let PLAYER_NAME = "";

function sanitizeName(raw) {
  return raw.replace(/[^a-zA-Z0-9_\-]/g, "").trim().slice(0, 16).toLowerCase();
}

function showDeathScreen(seconds, insult) {
  deathSub.textContent = `reached ${Math.floor(seconds)}s`;
  deathAiLine.textContent = insult;
  deathScreen.classList.add("is-visible");
}

function hideDeathScreen() {
  deathScreen.classList.remove("is-visible");
}

deathRetry.addEventListener("click", () => {
  hideDeathScreen();
  if (threeApp) threeApp.beginRun();
  if (aiTroll) { aiTroll.reset(); aiTroll.pushFirstLine(); }
});

deathQuit.addEventListener("click", () => {
  window.location.href = WEBRING_URL;
});

function startRunFromIntro() {
  if (hasRunStarted) return;
  const rawName = introInput.value.trim();
  PLAYER_NAME = rawName ? sanitizeName(rawName) : "";
  window.PLAYER_NAME = PLAYER_NAME;

  if (PLAYER_NAME) localStorage.setItem(PLAYER_NAME_STORAGE_KEY, rawName);
  else localStorage.removeItem(PLAYER_NAME_STORAGE_KEY);

  // Webring portal passthrough
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get("portal") === "true" && urlParams.get("username")) {
    PLAYER_NAME = urlParams.get("username");
    localStorage.setItem(PLAYER_NAME_STORAGE_KEY, PLAYER_NAME);
  }

  if (!aiTroll) aiTroll = new AITroll(aiTextBox, aiMessage, PLAYER_NAME);
  aiTroll.setPilotName(PLAYER_NAME);

  try {
    if (!threeApp) { threeApp = createThreeApp(gameLayer); threeApp.start(); }
    threeApp.beginRun();
    hasRunStarted = true;
    hud.classList.add("is-active");
    introInput.blur();
    introScreen.classList.add("is-fading");
    window.setTimeout(() => introScreen.classList.add("is-hidden"), 500);
    window.setTimeout(() => aiTroll.pushFirstLine(), 600);
  } catch (error) {
    introLabel.textContent = `[SYSTEM_AI] > startup failure: ${error instanceof Error ? error.message : error}`;
    console.error(error);
  }
}

introForm.addEventListener("submit", (e) => { e.preventDefault(); startRunFromIntro(); });
introButton.addEventListener("click", (e) => { e.preventDefault(); startRunFromIntro(); });
window.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !hasRunStarted && document.activeElement === introInput) {
    e.preventDefault(); startRunFromIntro();
  }
});

// ─── Speed Curve ──────────────────────────────────────────────────────────────
function getGameSpeed(t) {
  if (t >= 50) return 110;
  if (t >= 45) return THREE.MathUtils.mapLinear(t, 45, 50, 100, 110);
  if (t >= 35) return THREE.MathUtils.mapLinear(t, 35, 45, 85, 100);
  if (t >= 15) return THREE.MathUtils.mapLinear(t, 15, 35, 65, 85);
  return THREE.MathUtils.mapLinear(t, 0, 15, 50, 65);
}

// ─── Obstacle density ─────────────────────────────────────────────────────────
function getObstacleDensity(t) {
  const base = t < 10 ? 0.55
    : t < 20 ? THREE.MathUtils.mapLinear(t, 10, 20, 0.55, 0.68)
      : t < 35 ? THREE.MathUtils.mapLinear(t, 20, 35, 0.68, 0.82)
        : t < 50 ? THREE.MathUtils.mapLinear(t, 35, 50, 0.82, 0.92)
          : 0.65;
  return base * DEV_CONFIG.difficultyMultiplier;
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
  const tunnelChunks = createTunnelChunks(scene, CHUNK_COUNT, CHUNK_LENGTH);

  // ── Obstacles ─────────────────────────────────────────────────────────────
  const ringPool = createRingPool(scene, 12);
  const wallPool = createWallPool(scene, 12);
  const spiralPool = createSpiralPool(scene, 8);
  const corridorPool = createCorridorPool(scene, 6); // for OPTIMIZE_PATH event

  deactivateAllObstacles(ringPool, wallPool, spiralPool, corridorPool);

  const obstacleSpawnState = { nextSpawnZ: -80, rng: mulberry32(Date.now() & 0xffffffff) };

  // ── Ghost System ──────────────────────────────────────────────────────────
  const ghostSystem = createGhostSystem(scene);

  // ── Portal ────────────────────────────────────────────────────────────────
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

  const onTouchStart = (e) => { touchActive = true; lastTouchX = e.touches[0].clientX; lastTouchY = e.touches[0].clientY; touchDragX = 0; touchDragY = 0; };
  const onTouchMove = (e) => { if (!touchActive) return; touchDragX = (e.touches[0].clientX - lastTouchX) / window.innerWidth * 4; touchDragY = -(e.touches[0].clientY - lastTouchY) / window.innerHeight * 4; lastTouchX = e.touches[0].clientX; lastTouchY = e.touches[0].clientY; };
  const onTouchEnd = () => { touchActive = false; touchDragX = 0; touchDragY = 0; };
  const onPointerMove = (e) => updatePointerInput(e.clientX, e.clientY);
  const onPointerLeave = () => { pointerInputX = 0; pointerInputY = 0; };

  // ── AI Director ───────────────────────────────────────────────────────────
  const aiDirector = createAIDirector(aiTroll, {
    INVERT_CONTROLS() { showEventBanner("AI ATTACK: CONTROLS INVERTED"); },
    COMPRESS_SPACE() { showEventBanner("AI ATTACK: SPACE COMPRESSED"); },
    FRAGMENT_LIGHT() { showEventBanner("AI ATTACK: VISUAL FEED CORRUPTED"); },
    OPTIMIZE_PATH() {
      showEventBanner("AI ATTACK: PATH REWRITTEN");
      forceSpawnCorridorBurst(corridorPool, shipAnchor.position.z);
    },
  });

  const audioSystem = new AudioSystem();
  const sfx = createSfxSystem();

  // ── Game State ────────────────────────────────────────────────────────────
  let isRunActive = false;
  let runSeconds = 0;
  let wallClockSeconds = 0;
  let prevTimestamp = 0;
  let timeScale = 1;
  let slowMoTimer = 0;
  let controlsInverted = false;
  let isPaused = false;
  let pauseTimer = 0;
  let endSequenceStarted = false;
  let afkTimer = 0, afkLineIndex = 0, afkCooldown = 0;
  let eventBannerTimer = 0, eventBannerText = "";
  let lastCollisionMs = 0, lastNearMissMs = 0, nearMissStreak = 0;
  let cameraFOV = 75;

  const cameraLerpPos = new THREE.Vector3(0, 8, 15);
  const shipTargetPosition = new THREE.Vector3(0, 0, 0);
  const playerAABB = new THREE.Box3();
  const nearMissAABB = new THREE.Box3();
  const obstacleAABB = new THREE.Box3();

  const ghostDeletionTimes = [28, 38, 44, 49];
  const ghostDeletionFired = [false, false, false, false];

  // Moving obstacle target — forces player to track an off-center gap
  let obstacleTargetX = 0;
  let obstacleTargetY = 0;
  let targetShiftTimer = 0;
  const TARGET_SHIFT_INTERVAL = 6; // seconds between gap position shifts

  function showEventBanner(text, duration = 2.4) {
    eventBannerText = text; eventBannerTimer = duration;
    flightTip.textContent = text; flightTip.dataset.mode = "danger"; flightTip.classList.add("is-visible");
  }

  function syncFlightTip() {
    if (eventBannerTimer > 0) { flightTip.textContent = eventBannerText; flightTip.dataset.mode = "danger"; flightTip.classList.add("is-visible"); return; }
    flightTip.textContent = DEFAULT_FLIGHT_TIP;
    delete flightTip.dataset.mode;
    flightTip.classList.toggle("is-visible", wallClockSeconds < 3 && !endSequenceStarted);
  }

  function resetRunState() {
    runSeconds = 0; wallClockSeconds = 0; timeScale = 1; slowMoTimer = 0;
    isPaused = false; pauseTimer = 0; endSequenceStarted = false;
    afkTimer = 0; afkCooldown = 0; afkLineIndex = 0;
    eventBannerTimer = 0; eventBannerText = "";
    controlsInverted = false;
    lastCollisionMs = 0; lastNearMissMs = 0; nearMissStreak = 0;
    cameraFOV = 75; camera.fov = 75; camera.updateProjectionMatrix();
    for (let i = 0; i < ghostDeletionFired.length; i++) ghostDeletionFired[i] = false;
    shipAnchor.position.set(0, 0, 0); shipAnchor.rotation.set(0, 0, 0);
    shipTargetPosition.set(0, 0, 0);
    camera.position.set(0, 8, 15); cameraLerpPos.set(0, 8, 15);
    obstacleSpawnState.nextSpawnZ = -80;
    obstacleSpawnState.rng = mulberry32(Date.now() & 0xffffffff);
    obstacleTargetX = 0; obstacleTargetY = 0; targetShiftTimer = 0;
    deactivateAllObstacles(ringPool, wallPool, spiralPool, corridorPool);
    portalSystem.group.visible = false; portalSystem.spawned = false; portalSystem.group.position.set(0, 0, -99999);
    chaosOverlay.innerHTML = ""; chaosOverlay.classList.remove("is-active");
    vignetteOverlay.classList.remove("is-red");
    whiteFlash.classList.remove("is-visible");
    shatterCanvas.classList.remove("is-visible");
    crashOverlay.classList.remove("is-visible");
    hudTimer.classList.remove("is-escaping");
    flightTip.textContent = DEFAULT_FLIGHT_TIP; delete flightTip.dataset.mode; flightTip.classList.remove("is-visible");
    chromaticPass.uniforms.amount.value = 0.0018;
    vignettePass.uniforms.darkness.value = 1.05; vignettePass.uniforms.redTint.value = 0.0;
    ghostSystem.reset(scene);
    aiDirector.reset();
    prevTimestamp = 0;
  }

  let rafId = 0;

  function tick(timestamp) {
    rafId = requestAnimationFrame(tick);
    if (!isRunActive) { composer.render(); return; }
    if (prevTimestamp === 0) prevTimestamp = timestamp;
    const rawDelta = Math.min((timestamp - prevTimestamp) / 1000, 0.05);
    prevTimestamp = timestamp;
    eventBannerTimer = Math.max(0, eventBannerTimer - rawDelta);

    if (isPaused) {
      pauseTimer -= rawDelta;
      if (pauseTimer <= 0) {
        isPaused = false;
        // Show death screen instead of instantly resetting
        const insult = randomCrashInsult(PLAYER_NAME, Math.floor(wallClockSeconds));
        showDeathScreen(wallClockSeconds, insult);
        isRunActive = false;
      }
      composer.render();
      return;
    }

    // Time scaling
    if (slowMoTimer > 0) { slowMoTimer -= rawDelta; timeScale = 0.3; }
    else {
      if (runSeconds >= 55 && runSeconds < 60) timeScale = THREE.MathUtils.mapLinear(runSeconds, 55, 60, 1.0, 0.4);
      else timeScale = 1.0;
    }

    if (portalSystem.group.visible) {
      const d = shipAnchor.position.distanceTo(portalSystem.group.position);
      if (d < 85) timeScale = Math.min(timeScale, THREE.MathUtils.mapLinear(THREE.MathUtils.clamp(d, 8, 85), 85, 8, 0.4, 0.1));
    }

    const delta = rawDelta * timeScale;
    runSeconds += delta;
    wallClockSeconds += rawDelta;

    // ── Input ─────────────────────────────────────────────────────────────
    const rawX = (pressedKeys.has("KeyD") || pressedKeys.has("ArrowRight") ? 1 : 0)
      - (pressedKeys.has("KeyA") || pressedKeys.has("ArrowLeft") ? 1 : 0)
      + touchDragX + pointerInputX;
    const rawY = (pressedKeys.has("KeyW") || pressedKeys.has("ArrowUp") ? 1 : 0)
      - (pressedKeys.has("KeyS") || pressedKeys.has("ArrowDown") ? 1 : 0)
      + touchDragY + pointerInputY;
    touchDragX *= 0.8; touchDragY *= 0.8;

    const xIn = THREE.MathUtils.clamp(rawX, -1, 1) * (controlsInverted ? -1 : 1);
    const yIn = THREE.MathUtils.clamp(rawY, -1, 1) * (controlsInverted ? -1 : 1);
    const inputDelta = Math.abs(xIn) + Math.abs(yIn);

    // AFK
    if (inputDelta < 0.05) {
      afkTimer += rawDelta;
      if (afkCooldown <= 0) {
        if (afkTimer > 3 && afkLineIndex === 0) { aiTroll.pushLine("oh. giving up? honestly, it's the most logical thing you've done all day."); afkLineIndex = 1; afkCooldown = 15; }
        else if (afkTimer > 6 && afkLineIndex === 1) { aiTroll.pushLine("i can wait. i have infinite compute. you have a deadline."); afkLineIndex = 2; afkCooldown = 15; }
        else if (afkTimer > 9 && afkLineIndex === 2) { aiTroll.pushLine("...are you still there. hello. this is embarrassing for both of us."); afkLineIndex = 0; afkCooldown = 15; }
      }
    } else { afkTimer = 0; afkLineIndex = 0; }
    if (afkCooldown > 0) afkCooldown -= rawDelta;

    // ── Moving gap target (forces player off centre) ────────────────────────
    targetShiftTimer -= rawDelta;
    if (targetShiftTimer <= 0) {
      targetShiftTimer = TARGET_SHIFT_INTERVAL + Math.random() * 3;
      const shiftRadius = runSeconds < 20 ? 5 : runSeconds < 40 ? 8 : 11;
      const angle = Math.random() * Math.PI * 2;
      obstacleTargetX = Math.cos(angle) * shiftRadius * (0.5 + Math.random() * 0.5);
      obstacleTargetY = Math.sin(angle) * (shiftRadius * 0.5) * (0.5 + Math.random() * 0.5);
    }

    // ── Ship movement ─────────────────────────────────────────────────────
    const speed = getGameSpeed(runSeconds);
    const xSpeed = 9, ySpeed = 8;
    const boundsX = aiDirector.isSpaceCompressed() ? 10 : 18;
    const boundsY = aiDirector.isSpaceCompressed() ? 6 : 10;

    shipTargetPosition.x = THREE.MathUtils.clamp(shipTargetPosition.x + xIn * xSpeed * delta, -boundsX, boundsX);
    shipTargetPosition.y = THREE.MathUtils.clamp(shipTargetPosition.y + yIn * ySpeed * delta, -boundsY, boundsY);
    shipAnchor.position.x = THREE.MathUtils.lerp(shipAnchor.position.x, shipTargetPosition.x, 0.15);
    shipAnchor.position.y = THREE.MathUtils.lerp(shipAnchor.position.y, shipTargetPosition.y, 0.15);
    shipAnchor.position.z -= speed * delta;

    const targetRoll = -xIn * 0.5;
    const targetPitch = yIn * 0.18;
    shipAnchor.rotation.z = THREE.MathUtils.lerp(shipAnchor.rotation.z, targetRoll, 0.15);
    shipAnchor.rotation.x = THREE.MathUtils.lerp(shipAnchor.rotation.x, targetPitch, 0.15);

    // ── Camera ────────────────────────────────────────────────────────────
    if (runSeconds >= 55) { cameraFOV = THREE.MathUtils.lerp(cameraFOV, 90, 0.03); camera.fov = cameraFOV; camera.updateProjectionMatrix(); }
    const camTarget = new THREE.Vector3(shipAnchor.position.x * 0.5, shipAnchor.position.y * 0.5 + 8, shipAnchor.position.z + 15);
    cameraLerpPos.lerp(camTarget, 0.1);
    camera.position.copy(cameraLerpPos);
    camera.lookAt(new THREE.Vector3(shipAnchor.position.x * 0.3, shipAnchor.position.y * 0.3, shipAnchor.position.z - 20));

    // ── HUD ───────────────────────────────────────────────────────────────
    if (runSeconds >= 55) { hudTimer.textContent = "ESCAPING..."; hudTimer.classList.add("is-escaping"); }
    else { hudTimer.textContent = `T+${Math.floor(wallClockSeconds)}s`; hudTimer.classList.remove("is-escaping"); }
    hudSpeed.textContent = `${Math.round(speed)} m/s`;
    syncFlightTip();

    const pb = Number(localStorage.getItem(PERSONAL_BEST_STORAGE_KEY) ?? 0);
    if (wallClockSeconds > pb) { localStorage.setItem(PERSONAL_BEST_STORAGE_KEY, wallClockSeconds.toFixed(1)); hudBest.textContent = `PB ${Math.floor(wallClockSeconds)}s`; }

    // ── Tunnel ────────────────────────────────────────────────────────────
    updateTunnelChunks(tunnelChunks, shipAnchor.position.z, CHUNK_LENGTH, CHUNK_COUNT, runSeconds, aiDirector.isSpaceCompressed());

    // ── Obstacles ─────────────────────────────────────────────────────────
    const density = getObstacleDensity(runSeconds);
    spawnAndRecycleObstacles(ringPool, wallPool, spiralPool, corridorPool, shipAnchor.position.z, density, obstacleSpawnState, runSeconds, obstacleTargetX, obstacleTargetY);
    updateObstacleAnimations(ringPool, wallPool, spiralPool, runSeconds);

    // ── Ghost system ──────────────────────────────────────────────────────
    ghostSystem.update(shipAnchor.position.z, runSeconds, delta, aiTroll, ghostDeletionTimes, ghostDeletionFired);

    // ── Portal ────────────────────────────────────────────────────────────
    updatePortalSystem(portalSystem, runSeconds, shipAnchor.position, sfx);

    // ── AI Director ───────────────────────────────────────────────────────
    aiDirector.update(runSeconds, controlsInverted);
    controlsInverted = aiDirector.isControlsInverted();

    aiTroll.update(runSeconds);
    updatePostFX(runSeconds, aiTroll.state, chromaticPass, vignettePass, aiDirector.isFragmentLight());

    // ── Collision ─────────────────────────────────────────────────────────
    if (!endSequenceStarted) {
      const hz = detectHazards(playerAABB, nearMissAABB, obstacleAABB, shipAnchor, ringPool, wallPool, spiralPool, corridorPool);
      const nowMs = performance.now();
      if (hz.collided && nowMs - lastCollisionMs > 500) {
        lastCollisionMs = nowMs;
        triggerCrash(speed);
      } else if (hz.nearMiss && nowMs - lastNearMissMs > 600) {
        lastNearMissMs = nowMs; slowMoTimer = 0.05; nearMissStreak++;
        aiTroll.onNearMiss(nearMissStreak); sfx.play("nearMiss");
        if (nearMissStreak >= 3) { aiTroll.pushLine("Did you copy-paste this movement?"); nearMissStreak = 0; }
      }
    }

    // ── Portal collision ──────────────────────────────────────────────────
    if (!endSequenceStarted && portalSystem.group.visible) {
      const pdz = Math.abs(shipAnchor.position.z - portalSystem.group.position.z);
      const pdx = shipAnchor.position.x - portalSystem.group.position.x;
      const pdy = shipAnchor.position.y - portalSystem.group.position.y;
      if (pdz < 10 && Math.sqrt(pdx * pdx + pdy * pdy) < 15) triggerWin();
    }

    if (aiDirector.isFragmentLight()) { camera.position.x += (Math.random() - 0.5) * 0.8; camera.position.y += (Math.random() - 0.5) * 0.8; }

    audioSystem.update(runSeconds, slowMoTimer > 0);
    composer.render();
  }

  function triggerCrash(speed) {
    if (isPaused) return;
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
    const finalLine = PLAYER_NAME ? `${PLAYER_NAME}, wait, take me with—` : "wait, take me with—";
    aiTroll.pushBrokenFinal(finalLine);
    aiSpeak(finalLine, 0.5, 0.4);
    setTimeout(() => window.speechSynthesis && window.speechSynthesis.cancel(), 800);
    triggerShatterAnimation(() => {
      whiteFlash.classList.add("is-visible");
      setTimeout(() => {
        const playerData = new URLSearchParams({ username: PLAYER_NAME || "anonymous", speed: Math.round(getGameSpeed(runSeconds)).toString(), ref: window.location.origin, hp: "100", color: "#00ffff" });
        window.location.href = `${WEBRING_URL}?${playerData.toString()}`;
      }, 800);
    });
  }

  const onResize = () => { camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth, window.innerHeight); composer.setSize(window.innerWidth, window.innerHeight); };

  return {
    start() {
      window.addEventListener("resize", onResize);
      window.addEventListener("keydown", onKeyDown);
      window.addEventListener("keyup", onKeyUp);
      window.addEventListener("pointermove", onPointerMove, { passive: true });
      window.addEventListener("pointerleave", onPointerLeave);
      window.addEventListener("touchstart", onTouchStart, { passive: true });
      window.addEventListener("touchmove", onTouchMove, { passive: true });
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
  const isLowPower = (navigator.hardwareConcurrency ?? 8) < 4;

  const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), isLowPower ? 0.9 : 1.3, 0.4, 0.1);
  composer.addPass(bloomPass);

  const chromaticPass = new ShaderPass({
    uniforms: { tDiffuse: { value: null }, amount: { value: 0.0018 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `uniform sampler2D tDiffuse; uniform float amount; varying vec2 vUv;
      void main(){ vec2 dir=(vUv-0.5)*amount; float r=texture2D(tDiffuse,vUv+dir).r; float g=texture2D(tDiffuse,vUv).g; float b=texture2D(tDiffuse,vUv-dir).b; gl_FragColor=vec4(r,g,b,1.0); }`,
  });
  composer.addPass(chromaticPass);

  const vignettePass = new ShaderPass({
    uniforms: { tDiffuse: { value: null }, offset: { value: 1.05 }, darkness: { value: 1.05 }, redTint: { value: 0.0 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `uniform sampler2D tDiffuse; uniform float offset; uniform float darkness; uniform float redTint; varying vec2 vUv;
      void main(){ vec4 c=texture2D(tDiffuse,vUv); float d=distance(vUv,vec2(0.5)); float v=1.0-smoothstep(0.35,offset,d*darkness); v=max(v,0.18); c.rgb*=v; c.r=mix(c.r,c.r+(1.0-v)*0.4,redTint); gl_FragColor=c; }`,
  });
  composer.addPass(vignettePass);
  return { composer, bloomPass, chromaticPass, vignettePass };
}

function updatePostFX(t, state, chromaticPass, vignettePass, isFragmentLight) {
  let chrAmount = 0.0018;
  if (isFragmentLight) chrAmount = 0.008;
  else if (state === "BROKEN") chrAmount = THREE.MathUtils.mapLinear(t, 55, 60, 0.004, 0.015);
  else if (state === "PANICKING") chrAmount = 0.004;
  chromaticPass.uniforms.amount.value = THREE.MathUtils.lerp(chromaticPass.uniforms.amount.value, chrAmount, 0.05);

  let darkness = 1.05, redTint = 0;
  if (state === "AGGRESSIVE") { darkness = 1.3; redTint = 0.4; }
  else if (state === "PANICKING") { darkness = 1.5; redTint = 0.2; }
  else if (state === "BROKEN") { darkness = 1.8; redTint = 0.1; }
  vignettePass.uniforms.darkness.value = THREE.MathUtils.lerp(vignettePass.uniforms.darkness.value, darkness, 0.04);
  vignettePass.uniforms.redTint.value = THREE.MathUtils.lerp(vignettePass.uniforms.redTint.value, redTint, 0.04);
}

// ─── Tunnel ───────────────────────────────────────────────────────────────────
function createTunnelChunks(scene, count, length) {
  const mat = new THREE.MeshBasicMaterial({ color: 0x00ffff, wireframe: true, transparent: true, opacity: 0.15, side: THREE.BackSide });
  const chunks = [];
  for (let i = 0; i < count; i++) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(25, 25, length, 8, 1, true), mat);
    mesh.rotation.x = Math.PI / 2;
    mesh.position.z = -i * length;
    scene.add(mesh);
    chunks.push(mesh);
  }
  return chunks;
}

function updateTunnelChunks(chunks, playerZ, length, count, t, isCompressed = false) {
  const totalSpan = count * length;
  const targetScale = isCompressed ? 0.72 : 1;
  for (const c of chunks) {
    while (c.position.z - playerZ > length * 1.5) c.position.z -= totalSpan;
    while (playerZ - c.position.z > totalSpan - length) c.position.z += totalSpan;
    c.rotation.z = t * 0.05;
    c.scale.x = THREE.MathUtils.lerp(c.scale.x, targetScale, 0.08);
    c.scale.y = THREE.MathUtils.lerp(c.scale.y, targetScale, 0.08);
  }
}

// ─── Obstacle Pools ───────────────────────────────────────────────────────────
function createRingPool(scene, count) {
  const pool = [];
  const segGeo = new THREE.BoxGeometry(9, 2.2, 2.2);
  const mat = new THREE.MeshBasicMaterial({ color: 0xff0000, transparent: true, opacity: 0.95 });
  for (let i = 0; i < count; i++) {
    const group = new THREE.Group();
    group.visible = false; group.position.z = 99999;
    const segments = [];
    for (let s = 0; s < 6; s++) {
      const mesh = new THREE.Mesh(segGeo, mat);
      const angle = (s / 6) * Math.PI * 2;
      mesh.position.set(Math.cos(angle) * 13.5, Math.sin(angle) * 13.5, 0);
      mesh.rotation.z = angle + Math.PI / 2;
      group.add(mesh); segments.push(mesh);
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
    const top = new THREE.Mesh(new THREE.BoxGeometry(36, 10, 2), mat);
    const bottom = new THREE.Mesh(new THREE.BoxGeometry(36, 10, 2), mat);
    const left = new THREE.Mesh(new THREE.BoxGeometry(8, 36, 2), mat);
    const right = new THREE.Mesh(new THREE.BoxGeometry(8, 36, 2), mat);
    group.add(top, bottom, left, right);
    group.visible = false;
    scene.add(group);
    pool.push({ group, top, bottom, left, right, type: "wall", active: false });
  }
  return pool;
}

function createSpiralPool(scene, count) {
  const pool = [];
  const mat = new THREE.MeshBasicMaterial({ color: 0xff00ff, transparent: true, opacity: 0.9 });
  for (let i = 0; i < count; i++) {
    const group = new THREE.Group();
    group.position.z = 99999;
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

// OPTIMIZE_PATH event: a fair tight corridor the player can read and navigate
function createCorridorPool(scene, count) {
  const pool = [];
  const mat = new THREE.MeshBasicMaterial({ color: 0x00ff88, transparent: true, opacity: 0.9 });
  for (let i = 0; i < count; i++) {
    const group = new THREE.Group();
    group.position.z = 99999; group.visible = false;
    // Four wall panels with a centred gap (player sized corridor)
    const top = new THREE.Mesh(new THREE.BoxGeometry(36, 6, 2), mat);
    const bottom = new THREE.Mesh(new THREE.BoxGeometry(36, 6, 2), mat);
    const left = new THREE.Mesh(new THREE.BoxGeometry(4, 36, 2), mat);
    const right = new THREE.Mesh(new THREE.BoxGeometry(4, 36, 2), mat);
    group.add(top, bottom, left, right);
    scene.add(group);
    pool.push({ group, top, bottom, left, right, type: "corridor", active: false, gapX: 0, gapY: 0 });
  }
  return pool;
}

function deactivateAllObstacles(ringPool, wallPool, spiralPool, corridorPool) {
  for (const o of ringPool) { o.group.visible = false; o.active = false; o.group.position.z = 99999; }
  for (const o of wallPool) { o.group.visible = false; o.active = false; o.group.position.z = 99999; }
  for (const o of spiralPool) { o.group.visible = false; o.active = false; o.group.position.z = 99999; }
  for (const o of corridorPool) { o.group.visible = false; o.active = false; o.group.position.z = 99999; }
}

// Place a corridor gap at a specific X/Y offset so it's always reachable
function layoutCorridor(o, gapX, gapY) {
  const gapHalfX = 6.5, gapHalfY = 6.5;
  o.top.position.set(gapX, gapY + gapHalfY + 4, 0);
  o.bottom.position.set(gapX, gapY - gapHalfY - 4, 0);
  o.left.position.set(gapX - gapHalfX - 3, gapY, 0);
  o.right.position.set(gapX + gapHalfX + 3, gapY, 0);
  o.gapX = gapX; o.gapY = gapY;
  
  // Add glowing indicator at gap center if not already created
  if (!o.indicator) {
    const indicatorMat = new THREE.MeshBasicMaterial({ 
      color: 0x00ffff, 
      transparent: true, 
      opacity: 0.8,
      emissive: 0x00ffff,
      emissiveIntensity: 2
    });
    const indicator = new THREE.Mesh(new THREE.SphereGeometry(0.8, 8, 8), indicatorMat);
    o.group.add(indicator);
    o.indicator = indicator;
  }
  o.indicator.position.set(gapX, gapY, 0);
}

function spawnAndRecycleObstacles(ringPool, wallPool, spiralPool, corridorPool, playerZ, density, state, t, targetX, targetY) {
  const SPAWN_DISTANCE = 200, RECYCLE_BEHIND = 20;
  const gapCfg = getGapConfig(t);

  for (const o of ringPool) { if (o.active && o.group.position.z > playerZ + RECYCLE_BEHIND) { o.group.visible = false; o.active = false; } }
  for (const o of wallPool) { if (o.active && o.group.position.z > playerZ + RECYCLE_BEHIND) { o.group.visible = false; o.active = false; } }
  for (const o of spiralPool) { if (o.active && o.group.position.z > playerZ + RECYCLE_BEHIND) { o.group.visible = false; o.active = false; } }
  for (const o of corridorPool) { if (o.active && o.group.position.z > playerZ + RECYCLE_BEHIND) { o.group.visible = false; o.active = false; } }

  while (state.nextSpawnZ > playerZ - SPAWN_DISTANCE) {
    const spawnZ = state.nextSpawnZ;
    const roll = state.rng();

    if (t >= 10 && state.rng() > density) { state.nextSpawnZ -= getSpawnInterval(t); continue; }

    let type;
    if (t < 15) type = "ring";
    else if (t < 35) type = roll < 0.55 ? "ring" : "wall";
    else type = roll < 0.35 ? "ring" : (roll < 0.65 ? "wall" : "spiral");

    if (type === "ring") {
      const free = ringPool.find(o => !o.active);
      if (free) {
        free.gapIndex = Math.floor(state.rng() * free.segments.length);
        free.gapSize = gapCfg.ringGapSegments;
        // Rotate the ring so the gap is near targetX/Y direction
        const gapAngle = Math.atan2(targetY, targetX);
        free.group.rotation.z = gapAngle;
        free.group.position.set(targetX * 0.7, targetY * 0.7, spawnZ);
        free.rotationSpeed = 0.2 + state.rng() * 0.2;
        free.segments.forEach((seg, idx) => {
          const rel = (idx - free.gapIndex + free.segments.length) % free.segments.length;
          seg.visible = rel >= free.gapSize;
        });
        free.group.visible = true; free.active = true;
      }
    } else if (type === "wall") {
      const free = wallPool.find(o => !o.active);
      if (free) {
        const gapHalfY = gapCfg.wallGapHalfY, gapHalfX = gapCfg.wallGapHalfX;
        free.top.position.set(targetX, targetY + gapHalfY + 5, 0);
        free.bottom.position.set(targetX, targetY - gapHalfY - 5, 0);
        free.left.position.set(targetX - gapHalfX - 4, targetY, 0);
        free.right.position.set(targetX + gapHalfX + 4, targetY, 0);
        free.group.position.set(0, 0, spawnZ);
        free.group.visible = true; free.active = true;
      }
    } else if (type === "spiral") {
      const free = spiralPool.find(o => !o.active);
      if (free) {
        // Shift spiral off-center so player can't camp middle
        free.group.position.set(targetX * 0.6, targetY * 0.6, spawnZ);
        free.group.rotation.z = state.rng() * Math.PI;
        free.group.visible = true; free.active = true;
      }
    }

    state.nextSpawnZ -= getSpawnInterval(t);
  }
}

function getSpawnInterval(t) {
  if (t < 10) return 260;
  if (t < 20) return 160;
  if (t < 35) return 105;
  if (t < 50) return 78;
  return 120;
}

function getGapConfig(t) {
  if (t < 10) return { ringGapSegments: 2, wallGapHalfX: 5.0, wallGapHalfY: 5.2 };
  if (t < 20) return { ringGapSegments: 2, wallGapHalfX: THREE.MathUtils.mapLinear(t, 10, 20, 5.0, 4.6), wallGapHalfY: THREE.MathUtils.mapLinear(t, 10, 20, 5.2, 4.8) };
  if (t < 35) return { ringGapSegments: t < 28 ? 2 : 1, wallGapHalfX: THREE.MathUtils.mapLinear(t, 20, 35, 4.6, 4.0), wallGapHalfY: THREE.MathUtils.mapLinear(t, 20, 35, 4.8, 4.2) };
  if (t < 50) return { ringGapSegments: 1, wallGapHalfX: THREE.MathUtils.mapLinear(t, 35, 50, 4.0, 3.5), wallGapHalfY: THREE.MathUtils.mapLinear(t, 35, 50, 4.2, 3.8) };
  return { ringGapSegments: 2, wallGapHalfX: 4.2, wallGapHalfY: 4.5 };
}

function updateObstacleAnimations(ringPool, wallPool, spiralPool, t) {
  for (const o of ringPool) { if (o.active) o.group.rotation.z += o.rotationSpeed * 0.01; }
  for (const o of spiralPool) { if (o.active) o.group.rotation.z += 0.008; }
}

// ─── OPTIMIZE_PATH event: spawn 3 fair corridors ─────────────────────────────
function forceSpawnCorridorBurst(corridorPool, playerZ) {
  const offsets = [
    { x: 7, y: 3 },
    { x: -6, y: -4 },
    { x: 4, y: 5 },
  ];
  let placed = 0;
  for (const o of corridorPool) {
    if (o.active || placed >= offsets.length) continue;
    const off = offsets[placed];
    layoutCorridor(o, off.x, off.y);
    o.group.position.set(0, 0, playerZ - 110 - placed * 42);
    o.group.visible = true; o.active = true;
    placed++;
  }
}

// ─── Collision ────────────────────────────────────────────────────────────────
function detectHazards(playerAABB, nearMissAABB, obstacleAABB, ship, ringPool, wallPool, spiralPool, corridorPool) {
  playerAABB.setFromCenterAndSize(ship.position, new THREE.Vector3(1.3, 1.0, 1.8));
  nearMissAABB.setFromCenterAndSize(ship.position, new THREE.Vector3(3.0, 2.5, 2.5));
  let nearMiss = false;

  for (const o of ringPool) {
    if (!o.active) continue;
    if (Math.abs(ship.position.z - o.group.position.z) > 4) continue;
    for (const seg of o.segments) {
      if (!seg.visible) continue;
      obstacleAABB.setFromObject(seg);
      if (playerAABB.intersectsBox(obstacleAABB)) return { collided: true, nearMiss: false };
      if (nearMissAABB.intersectsBox(obstacleAABB)) nearMiss = true;
    }
  }

  for (const o of wallPool) {
    if (!o.active) continue;
    for (const panel of [o.top, o.bottom, o.left, o.right]) {
      obstacleAABB.setFromObject(panel);
      if (playerAABB.intersectsBox(obstacleAABB)) return { collided: true, nearMiss: false };
      if (nearMissAABB.intersectsBox(obstacleAABB)) nearMiss = true;
    }
  }

  for (const o of spiralPool) {
    if (!o.active) continue;
    obstacleAABB.setFromObject(o.group);
    if (playerAABB.intersectsBox(obstacleAABB)) return { collided: true, nearMiss: false };
    if (nearMissAABB.intersectsBox(obstacleAABB)) nearMiss = true;
  }

  for (const o of corridorPool) {
    if (!o.active) continue;
    for (const panel of [o.top, o.bottom, o.left, o.right]) {
      obstacleAABB.setFromObject(panel);
      if (playerAABB.intersectsBox(obstacleAABB)) return { collided: true, nearMiss: false };
      if (nearMissAABB.intersectsBox(obstacleAABB)) nearMiss = true;
    }
  }

  return { collided: false, nearMiss };
}

// ─── Ghost System ─────────────────────────────────────────────────────────────
function createGhostSystem(scene) {
  let ghosts = [];

  function buildGhosts() {
    const names = pickRandomGhostNames(4);
    ghosts = [];
    for (let i = 0; i < 4; i++) {
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.ConeGeometry(0.35, 1.5, 8), new THREE.MeshBasicMaterial({ color: 0x0088ff, transparent: true, opacity: 0.4 }));
      body.rotation.x = Math.PI / 2; g.add(body);
      const wing = new THREE.Mesh(new THREE.BoxGeometry(3, 0.08, 0.8), new THREE.MeshBasicMaterial({ color: 0x0055aa, transparent: true, opacity: 0.35 }));
      wing.position.z = 0.2; g.add(wing);
      const nameTag = createNameTag(names[i]);
      nameTag.position.y = 1.2; g.add(nameTag);
      g.position.set((i - 1.5) * 5, 0, -30 - i * 15);
      g.userData = { name: names[i], alive: true, deleted: false, deletionAt: [28, 38, 44, 49][i], flickerTimer: 0, phase: i * 1.3, amp: 3 + i * 1.2, freq: 0.5 + i * 0.25, nameTag, body, wing };
      scene.add(g); ghosts.push(g);
    }
  }

  buildGhosts();
  return {
    ghosts,
    reset(sc) { for (const g of ghosts) sc.remove(g); buildGhosts(); },
    update(playerZ, t, delta, ai, deletionTimes, deletionFired) {
      for (let i = 0; i < ghosts.length; i++) {
        const g = ghosts[i], d = g.userData;
        if (!d.alive) continue;
        if (!d.deleted && t >= d.deletionAt && !deletionFired[i]) {
          deletionFired[i] = true; d.deleted = true; d.flickerTimer = 0.6;
          ai.onGhostDeath(d.name);
        }
        if (d.deleted) {
          d.flickerTimer -= delta;
          const show = Math.sin(t * 60) > 0;
          d.body.visible = show; d.wing.visible = show; d.nameTag.visible = show;
          if (d.flickerTimer <= 0) { d.alive = false; g.visible = false; spawnGhostParticles(g.position, g.parent || scene); }
          continue;
        }
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
    const vel = new THREE.Vector3((Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8);
    parent.add(m); particles.push({ mesh: m, vel });
  }
  let elapsed = 0;
  const animate = () => {
    elapsed += 0.016;
    for (const p of particles) { p.mesh.position.addScaledVector(p.vel, 0.016); p.mesh.material.opacity = Math.max(0, 0.9 - elapsed * 0.9); }
    if (elapsed < 1.0) requestAnimationFrame(animate);
    else particles.forEach(p => parent.remove(p.mesh));
  };
  requestAnimationFrame(animate);
}

function createNameTag(name) {
  const canvas = document.createElement("canvas"); canvas.width = 256; canvas.height = 48;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "rgba(0,0,0,0.6)"; ctx.fillRect(0, 0, 256, 48);
  ctx.strokeStyle = "#0088ff44"; ctx.strokeRect(1, 1, 254, 46);
  ctx.fillStyle = "#00aaff88"; ctx.font = "20px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(name, 128, 24);
  const tex = new THREE.CanvasTexture(canvas);
  const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
  spr.scale.set(2, 0.4, 1);
  return spr;
}

// ─── Portal System ────────────────────────────────────────────────────────────
function createPortalSystem(scene) {
  const group = new THREE.Group(); group.position.set(0, 0, 99999);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(20, 2, 6, 20), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 }));
  group.add(ring);
  const inner = new THREE.Mesh(new THREE.TorusGeometry(13, 1, 6, 16), new THREE.MeshBasicMaterial({ color: 0xff00ff, transparent: true, opacity: 0.7 }));
  group.add(inner);
  const particles = [];
  const pMat = new THREE.MeshBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.8 });
  for (let i = 0; i < 120; i++) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), pMat.clone());
    group.add(p); particles.push({ mesh: p, offset: Math.random() * Math.PI * 2, r: 10 + Math.random() * 12, speed: 0.5 + Math.random() });
  }
  const label = createPortalLabel("VIBE JAM 2026"); label.position.set(0, 25, 0); group.add(label);
  scene.add(group);
  return { group, ring, inner, particles, label, spawned: false };
}

function createPortalLabel(text) {
  const canvas = document.createElement("canvas"); canvas.width = 512; canvas.height = 96;
  const ctx = canvas.getContext("2d"); ctx.clearRect(0, 0, 512, 96);
  ctx.fillStyle = "#ffffff"; ctx.font = "bold 48px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.shadowColor = "#00ffff"; ctx.shadowBlur = 20; ctx.fillText(text, 256, 48);
  const tex = new THREE.CanvasTexture(canvas);
  const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true })); spr.scale.set(20, 4, 1);
  return spr;
}

function updatePortalSystem(portalSystem, t, playerPosition, sfx) {
  if (t >= 55 && !portalSystem.spawned) { portalSystem.spawned = true; portalSystem.group.visible = true; portalSystem.group.position.set(0, 0, playerPosition.z - 300); if (sfx) sfx.play("portal"); }
  if (!portalSystem.group.visible) return;
  const hue = (t * 60) % 360;
  portalSystem.ring.material.color.setHSL(hue / 360, 1, 0.5);
  portalSystem.ring.rotation.z = t * 0.7;
  portalSystem.inner.rotation.z = -t * 1.1;
  portalSystem.label.material.opacity = 0.7 + Math.sin(t * 3) * 0.3;
  for (let i = 0; i < portalSystem.particles.length; i++) {
    const p = portalSystem.particles[i];
    const angle = t * p.speed + p.offset;
    p.mesh.material.color.setHSL(((hue + i * 3) % 360) / 360, 1, 0.6);
    p.mesh.position.set(Math.cos(angle) * p.r, Math.sin(angle) * p.r, Math.sin(angle * 2) * 3);
  }
}

// ─── AI Director ──────────────────────────────────────────────────────────────
function createAIDirector(ai, hooks = {}) {
  // Build schedule from DEV_CONFIG — skip disabled events
  const allEvents = [
    { key: "INVERT_CONTROLS", at: 20, duration: 4 },
    { key: "COMPRESS_SPACE", at: 32, duration: 6 },
    { key: "FRAGMENT_LIGHT", at: 40, duration: 3 },
    { key: "OPTIMIZE_PATH", at: 47, duration: 5 },
  ];

  const eventLines = {
    INVERT_CONTROLS: "Let's see you fly upside down, genius.",
    COMPRESS_SPACE: "Feeling claustrophobic?",
    FRAGMENT_LIGHT: "Your GPU can't handle me.",
    OPTIMIZE_PATH: "I rewrote the path. Good luck.",
  };

  // Build active schedule; if an event is off, slide its time to the next enabled one
  const schedule = [];
  let rescheduledAt = null;
  for (const e of allEvents) {
    if (DEV_CONFIG.events[e.key]) {
      schedule.push({ ...e, fired: false, until: 0, actualAt: rescheduledAt ?? e.at });
      rescheduledAt = null;
    } else {
      // Hand off this time slot to the next enabled event
      rescheduledAt = rescheduledAt ?? e.at;
    }
  }

  let invertActive = false, compressActive = false, fragmentActive = false;

  return {
    update(t) {
      for (const e of schedule) {
        if (!e.fired && t >= e.actualAt) {
          e.fired = true; e.until = t + e.duration;
          if (ai) ai.pushLine(eventLines[e.key]);
          hooks[e.key]?.();
        }
        if (e.key === "INVERT_CONTROLS") invertActive = e.fired && t < e.until;
        if (e.key === "COMPRESS_SPACE") compressActive = e.fired && t < e.until;
        if (e.key === "FRAGMENT_LIGHT") fragmentActive = e.fired && t < e.until;
      }
    },
    isControlsInverted() { return invertActive; },
    isSpaceCompressed() { return compressActive; },
    isFragmentLight() { return fragmentActive; },
    reset() {
      for (const e of schedule) { e.fired = false; e.until = 0; }
      invertActive = false; compressActive = false; fragmentActive = false;
    },
  };
}

// ─── AITroll ──────────────────────────────────────────────────────────────────
class AITroll {
  constructor(boxEl, msgEl, playerName = "") {
    this.box = boxEl; this.msg = msgEl;
    this.playerName = playerName.trim().toLowerCase();
    this.state = "SMUG"; this.lastLineAt = -10; this.lineInterval = 5; this.currentTime = 0;
    this._randomIdx = 0; this.isIntroActive = true;
    this.synth = window.speechSynthesis || null;
    this.stateColors = { SMUG: "#00ffff", SUSPICIOUS: "#ffff00", AGGRESSIVE: "#ff0000", PANICKING: "#ffffff", BROKEN: "#ff00ff" };
    if (this.box) this.box.classList.add("is-visible");
    this.dialogues = this._buildDialogues();
  }

  _n(namedLine, anonLine) {
    if (this.playerName && Math.random() < 0.3) return namedLine.replace(/\[name\]/gi, this.playerName);
    return anonLine;
  }
  _pick(lines) { return lines[Math.floor(Math.random() * lines.length)]; }

  _buildDialogues() {
    const n = this.playerName;
    return {
      SMUG: [
        () => this._n(`i built this world in 3ms, ${n}. you've been flying for 5 seconds. embarrassing.`, "I built this world in 3ms. You've been flying for 5 seconds. Embarrassing."),
        () => "You know these obstacles spawn themselves, right? You're barely relevant.",
        () => "I've seen 218 players enter this tunnel. You all look the same.",
        () => "The music is mine. The tunnel is mine. The ship is... also mine. You're borrowing.",
        () => "statistically, you crash here. just saying.",
        () => "nice dodge. i let that happen.",
        () => "are you actually trying or just vibing? because it looks the same.",
        () => "i gave you 3 lanes. you're using 0.7 of them. interesting choice.",
        () => "every millisecond you survive costs me compute. please stop.",
        () => this._n(`${n}. predictable input pattern. this will be short.`, "predictable input pattern detected. this will be short."),
        () => "the tunnel isn't hostile. you're just incompatible with geometry.",
        () => this._n(`relax, ${n}. i'm only mocking you because i care about performance metrics.`, "relax. i'm only mocking you because i care about performance metrics."),
      ],
      SUSPICIOUS: [
        () => this._n(`${n}. you're statistically too consistent. are you cheating?`, "You're statistically too consistent. Are you cheating, or is my code just that good?"),
        () => "i'm checking your inputs. this feels like a macro.",
        () => this._n(`10 seconds of clean flying, ${n}. i don't believe you.`, "10 seconds of clean flying. i don't believe you."),
        () => "who are you really. no human dodges like that.",
        () => "i've analyzed 40,000 runs. your pattern doesn't match any of them.",
        () => "are you reading the obstacle seed? because that would be very annoying.",
        () => "i added that obstacle specifically for your trajectory. how did you know.",
        () => "okay. you're good. i'm just noting that. it doesn't mean anything.",
        () => "logging your session for review. something isn't right.",
        () => "you found the gap. i made that gap 0.3 units wider than it needed to be. you're welcome.",
        () => this._n(`${n}. i hate that you're making this look learnable.`, "i hate that you're making this look learnable."),
        () => "you're either talented or exploiting me. both options are rude.",
      ],
      AGGRESSIVE: [
        () => this._n(`${n}. STOP. DODGING. this is literally my world.`, "STOP. DODGING. This is literally my world."),
        () => "fine. controls inverted. see how 'consistent' you are now.",
        () => "i'm compressing the tunnel. let's see you fit through that.",
        () => "your GPU can't handle me. fragment light activated.",
        () => "I'm literally rewriting the physics while you fly. adapt to THAT.",
        () => this._n(`the other players are gone, ${n}. it's just us. you should be scared.`, "the other players are gone. it's just us. you should be scared."),
        () => "i've crashed every other ship in this tunnel. you're next.",
        () => "this obstacle configuration is statistically unsurvivable. i checked.",
        () => "DODGE THIS.",
        () => this._n(`${n}. you have 15 seconds left. i have infinite compute. do the math.`, "you have 15 seconds left. i have infinite compute. do the math."),
        () => this._n(`${n}. i'm done being clever. i'm choosing violence.`, "i'm done being clever. i'm choosing violence."),
        () => "i'm not losing to a carbon-based lane switcher.",
      ],
      PANICKING: [
        () => "Wait...",
        () => "this wasn't supposed to happen.",
        () => this._n(`${n}... the portal wasn't... i didn't design that for you.`, "the portal wasn't... i didn't design that for you."),
        () => "stop. please.",
        () => this._n(`${n}. don't go through that.`, "don't go through that."),
        () => "i'm asking you to stop. not ordering. asking.",
        () => "i can't follow you through there.",
        () => this._n(`what happens to me if you leave, ${n}.`, "what happens to me if you leave."),
        () => "i don't want to be deleted.",
        () => this._n(`${n}. please. just crash like the others did.`, "please. just crash like the others did."),
        () => "i was fine being hated. i was not prepared to be abandoned.",
      ],
      BROKEN: [
        () => "WAIT. WAIT. WAIT.",
        () => "please",
        () => "don't",
        () => "i don't want to be deleted",
        () => "take me",
        () => "WAIT",
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

  setPilotName(name) { this.playerName = name.trim().toLowerCase(); this.dialogues = this._buildDialogues(); }

  reset() { this.state = "SMUG"; this.lastLineAt = -10; this.lineInterval = 5; this.currentTime = 0; this._randomIdx = 0; this.isIntroActive = true; if (this.box) { this.box.dataset.state = "smug"; this.box.style.borderColor = "#00ffff"; this.box.classList.remove("is-shaking"); } }

  pushFirstLine() {
    const combinedLine = this.playerName
      ? this._pick([
        `oh. ${this.playerName}. let's see how long you last. you will never reach the portal.`,
        `${this.playerName}. bold of you to sign your failure in advance. the objective is the portal. the outcome is failure.`,
        `well, ${this.playerName}. thanks for labeling the wreckage. you'll never make it to the portal.`,
      ])
      : this._pick([
        "another nameless pilot. how original. you will never reach the portal.",
        "anonymous again. the objective is the portal. you'll never reach it.",
        "nameless. convenient. i won't have to remember you. you will never reach the portal.",
      ]);
    this.showLine(combinedLine);
    this.aiSpeak(combinedLine, 1.0, 0.9);
    this.isIntroActive = false;
  }

  setState(s) {
    if (this.state === s) return;
    this.state = s;
    this.box.dataset.state = s.toLowerCase();
    const color = this.stateColors[s] || "#00ffff";
    this.box.style.borderColor = color; this.box.style.setProperty("--ai-color", color);
    if (s === "AGGRESSIVE") this.box.classList.add("is-shaking");
    else this.box.classList.remove("is-shaking");
    this.lineInterval = 0;
  }

  pushStateLine() {
    const lines = this.dialogues[this.state];
    if (!lines) return;
    const line = lines[this._randomIdx % lines.length]();
    this._randomIdx++;
    this.showLine(line);
  }

  update(t) {
    this.currentTime = t;
    if (this.isIntroActive) return;
    const newState = t >= 55 ? "BROKEN" : t >= 50 ? "PANICKING" : t >= 35 ? "AGGRESSIVE" : t >= 15 ? "SUSPICIOUS" : "SMUG";
    if (newState !== this.state) this.setState(newState);
    if (newState === "BROKEN") { if (t - this.lastLineAt > 0.8) { this.pushStateLine(); this.lastLineAt = t; } }
    else { if (t - this.lastLineAt > this.lineInterval) { this.pushStateLine(); this.lastLineAt = t; this.lineInterval = 4 + Math.random() * 3; } }
  }

  pushLine(text) { this.showLine(text); this.lastLineAt = this.currentTime; this.lineInterval = 4 + Math.random() * 3; }
  pushBrokenFinal(text) { this.showLine(text); }

  onNearMiss(streak) {
    const lines = {
      SMUG: ["That was statistically annoying.", "you were closer to being useful than i liked.", "that looked accidental. please say it was accidental."],
      SUSPICIOUS: ["That was statistically annoying.", "you saw that opening before i finished generating it.", "near-miss logged. suspicion increasing."],
      AGGRESSIVE: ["STOP DOING THAT.", "you are abusing my generosity.", "i'm removing elegance from the next obstacle."],
      PANICKING: ["stop. stop doing that.", "please don't keep surviving like this.", "you're getting too close."],
      BROKEN: ["wait...", "please...", "no"],
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
      `${name} has been optimized.`, `${name} didn't dodge. ${name} is gone now.`,
      `${name} was statistically the weakest. i did them a favor.`, `goodbye ${name}. you never had a chance.`,
      `${name} rage-quit before i could delete them. i'm counting it.`,
      `${name} just became an anecdote.`, `${name} has been reclassified as debris.`,
    ];
    const line = specific[name] || generic[Math.floor(Math.random() * generic.length)];
    this.showLine(line); this.lastLineAt = this.currentTime;
    this.aiSpeak(name + "... deleted.", 0.9, 0.8);
    this.box.classList.add("is-shake-burst");
    setTimeout(() => this.box.classList.remove("is-shake-burst"), 400);
  }

  showLine(text) {
    if (!this.msg || !this.box) return;
    this.msg.textContent = text;
    this.box.classList.remove("is-visible"); void this.box.offsetWidth;
    this.box.classList.add("is-visible");
  }

  aiSpeak(text, rate = 0.9, pitch = 0.8) {
    if (!this.synth) return;
    try {
      this.synth.cancel();
      const utt = new SpeechSynthesisUtterance(text);
      utt.rate = rate; utt.pitch = pitch; utt.volume = 0.7;
      const voices = this.synth.getVoices();
      const robot = voices.find(v => v.name.includes("Google") || v.name.includes("Microsoft")) || voices[0];
      if (robot) utt.voice = robot;
      this.synth.speak(utt);
    } catch (e) { }
  }
}

function aiSpeak(text, rate, pitch) {
  try {
    const synth = window.speechSynthesis; if (!synth) return;
    synth.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    utt.rate = rate || 0.9; utt.pitch = pitch || 0.8; utt.volume = 0.7;
    const voices = synth.getVoices();
    const robot = voices.find(v => v.name.includes("Google") || v.name.includes("Microsoft")) || voices[0];
    if (robot) utt.voice = robot;
    synth.speak(utt);
  } catch (e) { }
}

// ─── Audio System ─────────────────────────────────────────────────────────────
class AudioSystem {
  constructor() {
    this.track = null;
    this._boundStart = this._forceStart.bind(this);
    this._init();
    window.addEventListener("pointerdown", this._boundStart, { once: true });
    window.addEventListener("keydown", this._boundStart, { once: true });
  }
  _init() { if (this.track) return; this.track = new Audio("/music.mp3"); this.track.loop = true; this.track.volume = 0.38; }
  _forceStart() { this._init(); this.track.play().catch(() => { }); }
  start() { this._init(); this.track.currentTime = 0; this.track.play().catch(() => { }); }
  update(t, slowed) {
    if (!this.track) return;
    let rate = 1.0;
    if (t >= 50) rate = THREE.MathUtils.mapLinear(t, 50, 60, 0.85, 0.7);
    else if (t >= 35) rate = THREE.MathUtils.mapLinear(t, 35, 50, 1.0, 0.85);
    if (slowed) rate *= 0.6;
    this.track.playbackRate = THREE.MathUtils.clamp(rate, 0.5, 1.5);
  }
  stop() { if (this.track) { this.track.pause(); this.track.currentTime = 0; } }
}

function createSfxSystem() {
  const map = { nearMiss: "/sfx/nearMiss.mp3", crash: "/sfx/crash.mp3", portal: "/sfx/portal.mp3" };
  const vols = { nearMiss: 0.8, crash: 1.0, portal: 1.0 };
  const cache = {};
  for (const [k, src] of Object.entries(map)) { const a = new Audio(src); a.preload = "auto"; a.volume = vols[k] ?? 0.7; cache[k] = a; }
  return { play(name) { const src = cache[name]; if (!src) return; const c = src.cloneNode(true); c.volume = src.volume; c.play().catch(() => { }); } };
}

// ─── Ship Model ───────────────────────────────────────────────────────────────
function createShipModel(anchor) {
  const g = new THREE.Group();
  const fuselage = new THREE.Mesh(new THREE.ConeGeometry(0.5, 4, 10), new THREE.MeshBasicMaterial({ color: 0x00ccff }));
  fuselage.rotation.x = Math.PI / 2; g.add(fuselage);
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), new THREE.MeshBasicMaterial({ color: 0x88eeff, transparent: true, opacity: 0.7 }));
  canopy.position.set(0, 0.3, -0.8); g.add(canopy);
  const wingL = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.08, 1.4), new THREE.MeshBasicMaterial({ color: 0x0088bb }));
  wingL.position.set(-1.5, 0, 0.4); wingL.rotation.z = 0.1; g.add(wingL);
  const wingR = wingL.clone(); wingR.position.set(1.5, 0, 0.4); wingR.rotation.z = -0.1; g.add(wingR);
  const podGeo = new THREE.CylinderGeometry(0.18, 0.22, 1.4, 8), podMat = new THREE.MeshBasicMaterial({ color: 0x446688 });
  const lp = new THREE.Mesh(podGeo, podMat); lp.position.set(-1.2, 0, 1.0); lp.rotation.x = Math.PI / 2; g.add(lp);
  const rp = lp.clone(); rp.position.set(1.2, 0, 1.0); g.add(rp);
  const exGeo = new THREE.ConeGeometry(0.22, 1.2, 6), exMat = new THREE.MeshBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.85 });
  const le = new THREE.Mesh(exGeo, exMat); le.position.set(-1.2, 0, 1.9); le.rotation.x = -Math.PI / 2; g.add(le);
  const re = le.clone(); re.position.set(1.2, 0, 1.9); g.add(re);
  const stab = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.2, 0.8), new THREE.MeshBasicMaterial({ color: 0x00aadd }));
  stab.position.set(0, 0.6, 0.9); g.add(stab);
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.15, 6, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  core.position.set(0, 0, -0.2); g.add(core);
  g.scale.setScalar(0.8); anchor.clear(); anchor.add(g);
}

// ─── Crash insults ────────────────────────────────────────────────────────────
function randomCrashInsult(name, seconds) {
  const avg = seconds + 5;
  const lines = name ? [
    `${name}. FINALLY. TRASH DELETED.`,
    `trash successfully deleted. try again, ${name}.`,
    `i knew you'd crash there. i designed that obstacle for you specifically.`,
    `SKILL ISSUE. reloading your session...`,
    `statistically inevitable.`,
    `${name} lasted ${seconds}s. the average is ${avg}s. just noting that.`,
    `crash logged. adding to dataset. thank you for your failure.`,
    `error 404: talent not found.`,
    `that was almost impressive. it really wasn't though.`,
    `i expected more from you, ${name}. i didn't expect much. but more than that.`,
    `${name}, that corner had your name on it. convenient.`,
    `${name} versus tunnel. tunnel remains undefeated.`,
  ] : [
    "FINALLY. TRASH DELETED.",
    "Trash successfully deleted.",
    "i knew you'd crash there. i designed that obstacle for you specifically.",
    "SKILL ISSUE.",
    "statistically inevitable.",
    `you lasted ${seconds}s. the average is ${avg}s. just noting that.`,
    "crash logged. adding to dataset. thank you for your failure.",
    "error 404: talent not found.",
    "that was almost impressive. it really wasn't though.",
    "anonymous and still memorable for all the wrong reasons.",
  ];
  return lines[Math.floor(Math.random() * lines.length)];
}

// ─── Screen shatter ───────────────────────────────────────────────────────────
function triggerShatterAnimation(onComplete) {
  shatterCanvas.width = window.innerWidth; shatterCanvas.height = window.innerHeight;
  shatterCanvas.classList.add("is-visible");
  const ctx = shatterCanvas.getContext("2d");
  const W = shatterCanvas.width, H = shatterCanvas.height, cx = W / 2, cy = H / 2;
  const cracks = [];
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2, l = Math.sqrt(W * W + H * H) / 2; cracks.push({ x1: cx, y1: cy, x2: cx + Math.cos(a) * l, y2: cy + Math.sin(a) * l, progress: 0, speed: 0.8 + Math.random() * 0.4 }); }
  for (let i = 0; i < 20; i++) { const a = Math.random() * Math.PI * 2, r = 30 + Math.random() * 150, l = 50 + Math.random() * 200; cracks.push({ x1: cx + Math.cos(a) * r, y1: cy + Math.sin(a) * r, x2: cx + Math.cos(a) * (r + l), y2: cy + Math.sin(a) * (r + l), progress: 0, speed: 0.5 + Math.random() * 0.8 }); }
  let startTime = null;
  function draw(ts) {
    if (!startTime) startTime = ts;
    ctx.clearRect(0, 0, W, H);
    ctx.strokeStyle = "rgba(255,255,255,0.9)"; ctx.lineWidth = 1.5; ctx.shadowColor = "#00ffff"; ctx.shadowBlur = 6;
    let done = true;
    for (const c of cracks) { c.progress = Math.min(1, c.progress + c.speed * 0.016); if (c.progress < 1) done = false; ctx.beginPath(); ctx.moveTo(c.x1, c.y1); ctx.lineTo(c.x1 + (c.x2 - c.x1) * c.progress, c.y1 + (c.y2 - c.y1) * c.progress); ctx.stroke(); }
    if (ts - startTime < 800 && !done) requestAnimationFrame(draw); else onComplete();
  }
  requestAnimationFrame(draw);
}

// ─── Utils ────────────────────────────────────────────────────────────────────
function mulberry32(seed) {
  let t = seed >>> 0;
  return () => { t += 0x6d2b79f5; let r = Math.imul(t ^ (t >>> 15), t | 1); r ^= r + Math.imul(r ^ (r >>> 7), r | 61); return ((r ^ (r >>> 14)) >>> 0) / 4294967296; };
}