import "./style.css";
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";

// ═══════════════════════════════════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════════════════════════════════
const CFG = {
  // Hybrid win condition
  BASE_ESCAPE_TIME: 120,
  TIME_REDUCTION_PER_AI_BOT: 5,
  AI_BOTS_FOR_INSTANT_WIN: 15,
  MIN_ESCAPE_TIME: 60,

  // Player
  PLAYER_HEALTH: 100,
  COLLISION_DAMAGE: 40,
  CONTACT_DAMAGE: 22,
  INVULN_TIME: 0.9,

  // Shooting
  BULLET_SPEED: 230,
  BULLET_LIFETIME: 3.0,
  SHOOT_COOLDOWN: 0.3,
  DISRUPTION_GAIN_PER_HIT: 0.09,

  // AI Bots (replicated glitch entities)
  MAX_AI_BOTS: 35,
  CORE_SPAWN_CHANCE_BASE: 0.04,
  AI_BOT_SPAWN_INTERVAL: 6,
  AI_BOT_MIN_SPAWN_COUNT: 1,
  AI_BOT_MAX_SPAWN_COUNT: 3,
  AI_BOT_SPAWN_DISTANCE: 320,
  AI_BOT_WAVE_Z_SPACING: 25,
  AI_BOT_OBSTACLE_CLEARANCE: 200,
  AI_BOT_OBSTACLE_GRACE_PERIOD: 2.0,
  AI_BOT_SPAWN_RETRY_DELAY: 0.5,

  // Storage
  KEY_NAME: "skybreak_name",
  KEY_BEST: "skybreak_pb",
  KEY_TUTORIAL_SEEN: "skybreak_opening_tutorial_seen",

  // Webring
  WEBRING_URL: "https://vibej.am/portal/2026",

  // AI commentator timing
  AI_MOCKERY_END: 30,
  AI_SUSPICION_END: 65,
  AI_AGGRESSION_END: 100,
  AI_PANIC_END: 115,
  AI_GLOBAL_LINE_INTERVAL: 22,
  AI_MAX_SPEECH_QUEUE: 3,

  // Misc
  PORTAL_UNLOCK_CHECK_INTERVAL: 0.25,
};

const GLOBAL_STATS = {
  totalDeaths: 0,
  deathsUnder10s: 0,
  deathsThisSession: 0,
  avgSurvivalTime: 0,
  commonDeathZone: 0,
  bestRun: 0,
  deathZones: {},
  lastUpdate: Date.now(),
};

function getDeathZoneBucket(z) {
  return Math.max(0, Math.round(Math.abs(z) / 50) * 50);
}

function recordDeathStats(survivalTime, deathZ) {
  GLOBAL_STATS.totalDeaths++;
  GLOBAL_STATS.deathsThisSession++;
  if (survivalTime < 10) GLOBAL_STATS.deathsUnder10s++;
  GLOBAL_STATS.avgSurvivalTime = GLOBAL_STATS.totalDeaths === 1
    ? survivalTime
    : ((GLOBAL_STATS.avgSurvivalTime * (GLOBAL_STATS.totalDeaths - 1)) + survivalTime) / GLOBAL_STATS.totalDeaths;

  const zone = getDeathZoneBucket(deathZ);
  GLOBAL_STATS.deathZones[zone] = (GLOBAL_STATS.deathZones[zone] || 0) + 1;

  let hottestZone = zone;
  let hottestCount = GLOBAL_STATS.deathZones[zone];
  for (const [bucket, count] of Object.entries(GLOBAL_STATS.deathZones)) {
    if (count > hottestCount) {
      hottestZone = Number(bucket);
      hottestCount = count;
    }
  }

  GLOBAL_STATS.commonDeathZone = hottestZone;
  GLOBAL_STATS.bestRun = Math.max(GLOBAL_STATS.bestRun, survivalTime);
  GLOBAL_STATS.lastUpdate = Date.now();
}

const GHOST_NAMES = [
  "altman_was_here","karpathy_fan","lecun_disagrees","bengio_vibes",
  "hinton_quit_google","demis_watching","ilya_approves","gpt5_beta_tester",
  "carmack_vibe","notch_returned","kojima_fan69","gaben_counting",
  "levelsio_alt","vibe_master_real","bolt_generated_me","cursor_wrote_this",
  "claude_played_first","GPT_wrote_my_ship","prompt_engineer_irl",
  "alex_died","user_404","null_ptr","NaN_at_life","console_log_fan",
  "undefined_is_not","stack_overflow_help",
];

// ═══════════════════════════════════════════════════════════════════
// DOM BOOTSTRAP
// ═══════════════════════════════════════════════════════════════════
const app = document.querySelector("#app");
if (!app) throw new Error("No #app");

app.innerHTML = `
<div id="game-layer" class="game-layer"></div>

<!-- HUD -->
<div id="hud" class="hud">
  <div id="hud-timer" class="hud-timer">T+0s</div>
  <div id="hud-speed" class="hud-speed">50 m/s</div>
  <div id="hud-best" class="hud-best">PB --</div>

  <div id="hud-objective" class="hud-objective">OBJECTIVE: SURVIVE THE BREACH</div>
  <div id="hud-progress" class="hud-progress">AI BOTS 0/15 | PORTAL UNLOCKS AT 120s</div>
  <div id="portal-arrow" class="portal-arrow">PORTAL AHEAD 0m</div>

  <div class="hud-bar-group">
    <div class="hud-bar-label" id="disruption-label">SIGNAL BREAK</div>
    <div class="hud-bar disruption-bar"><div id="disruption-fill" class="hud-bar-fill disruption-fill"></div></div>
    <div class="hud-bar-label integrity-label">HULL</div>
    <div class="hud-bar integrity-bar"><div id="integrity-fill" class="hud-bar-fill integrity-fill"></div></div>
  </div>

  <div id="crosshair" class="crosshair"></div>
  <div id="flight-tip" class="flight-tip">WASD/ARROWS · SPACE/CLICK = SHOOT · DESTROY AI BOTS · REACH THE PORTAL</div>

  <div id="ai-box" class="ai-box">
    <span class="ai-prefix">[SYSTEM_AI] &gt; </span><span id="ai-msg"></span>
  </div>
</div>

<!-- Overlays -->
<div id="white-flash" class="white-flash"></div>
<div id="damage-flash" class="damage-flash"></div>
<div id="crash-overlay" class="crash-overlay"><div id="crash-text" class="crash-text">TRAJECTORY INVALID</div></div>
<div id="chapter-banner" class="chapter-banner"></div>
<div id="invert-overlay" class="invert-overlay">CONTROLS INVERTED</div>
<div id="mobile-tutorial" class="mobile-tutorial">
  <div class="mobile-tutorial__title">LEFT HALF = MOVE</div>
  <div class="mobile-tutorial__title">RIGHT HALF = SHOOT</div>
  <div class="mobile-tutorial__diagram">LEFT | RIGHT</div>
</div>

<!-- Death screen -->
<div id="death-screen" class="death-screen">
  <div class="death-content">
    <div id="death-title" class="death-title">YOU LOST</div>
    <div id="death-sub" class="death-sub"></div>
    <div id="death-cores" class="death-cores"></div>
    <div class="death-progress">
      <div class="death-progress__bar"><div id="death-progress-fill" class="death-progress__fill"></div></div>
      <div id="death-progress-label" class="death-progress__label"></div>
    </div>
    <div id="death-ai-line" class="death-ai-line"></div>
    <div class="death-buttons">
      <button id="death-retry" class="death-btn death-btn--retry">TRY AGAIN</button>
      <button id="death-quit" class="death-btn death-btn--quit">QUIT TO VIBE JAM</button>
    </div>
  </div>
</div>

<!-- Shatter canvas -->
<canvas id="shatter-canvas" class="shatter-canvas"></canvas>

<!-- Intro -->
<div id="intro-screen" class="intro-screen">
  <img class="logo-mark" src="/logo.png" alt="SKYBREAK" onerror="this.style.display='none'"/>
  <h1 class="game-title">SKYBREAK</h1>
  <p class="game-subtitle">AI REALITY COLLAPSE</p>
  <div id="intro-label" class="intro-label"></div>
  <div id="intro-hint" class="intro-hint">
    <div class="intro-title">SYSTEM BREACH</div>
    <div class="intro-narrative">THE AI BUILT THIS WORLD. IT IS COLLAPSING.</div>
    <div class="intro-narrative">THE AI HAS SELF-REPLICATED — MORE BOTS, HIGHER THREAT.</div>
    <div class="intro-narrative">SHOOT THE GLOWING AI BOTS TO BREAK THE LOCK EARLY.</div>
    <div class="intro-narrative accent">REACH THE PORTAL BEFORE THE VOID TAKES YOU.</div>
    <div class="intro-key">
      <span>MOUSE MOVE = AIM</span>
      <span>SPACE / CLICK = SHOOT</span>
      <span>WASD = MOVE SHIP</span>
      <span>PINK AI BOT = SHOOT IT</span>
      <span>PORTAL RING = FLY THROUGH IT</span>
    </div>
  </div>
  <form id="intro-form" class="intro-form">
    <input id="intro-input" class="intro-input" type="text" placeholder="enter pilot name... or leave blank" maxlength="16" autocomplete="off" autocapitalize="none" autocorrect="off" spellcheck="false">
    <button type="submit" class="intro-button">ENTER THE VOID</button>
  </form>
  <p class="creator-credit">made by ai, prompted by <a href="https://x.com/AlphaGoat2711" target="_blank">@AlphaGoat2711</a> · vibe jam 2026</p>
  <p class="github-link"><a href="https://github.com/AlphaTheGoat27/skybreak" target="_blank">open source on github</a></p>
</div>

<div id="shoot-hint" class="shoot-hint"></div>
`;

// DOM refs
const G = {
  gameLayer: document.getElementById("game-layer"),
  hud: document.getElementById("hud"),
  hudTimer: document.getElementById("hud-timer"),
  hudSpeed: document.getElementById("hud-speed"),
  hudBest: document.getElementById("hud-best"),
  hudObjective: document.getElementById("hud-objective"),
  hudProgress: document.getElementById("hud-progress"),
  portalArrow: document.getElementById("portal-arrow"),
  disruptionLabel: document.getElementById("disruption-label"),
  disruptionFill: document.getElementById("disruption-fill"),
  integrityFill: document.getElementById("integrity-fill"),
  crosshair: document.getElementById("crosshair"),
  flightTip: document.getElementById("flight-tip"),
  aiBox: document.getElementById("ai-box"),
  aiMsg: document.getElementById("ai-msg"),
  whiteFlash: document.getElementById("white-flash"),
  damageFlash: document.getElementById("damage-flash"),
  crashOverlay: document.getElementById("crash-overlay"),
  crashText: document.getElementById("crash-text"),
  chapterBanner: document.getElementById("chapter-banner"),
  invertOverlay: document.getElementById("invert-overlay"),
  mobileTutorial: document.getElementById("mobile-tutorial"),
  deathScreen: document.getElementById("death-screen"),
  deathTitle: document.getElementById("death-title"),
  deathSub: document.getElementById("death-sub"),
  deathCores: document.getElementById("death-cores"),
  deathProgressFill: document.getElementById("death-progress-fill"),
  deathProgressLabel: document.getElementById("death-progress-label"),
  deathAiLine: document.getElementById("death-ai-line"),
  deathRetry: document.getElementById("death-retry"),
  deathQuit: document.getElementById("death-quit"),
  shatterCanvas: document.getElementById("shatter-canvas"),
  introScreen: document.getElementById("intro-screen"),
  introLabel: document.getElementById("intro-label"),
  introForm: document.getElementById("intro-form"),
  introInput: document.getElementById("intro-input"),
  bestDisplay: document.getElementById("best-display-text"),
  shootHint: document.getElementById("shoot-hint"),
};

// ═══════════════════════════════════════════════════════════════════
// GLOBAL STATE
// ═══════════════════════════════════════════════════════════════════
let PLAYER_NAME = "";
let threeApp = null;
let hasStarted = false;
let aiTroll = null;
let hasShownMobileTutorial = false;
let chapterBannerTimer = 0;
let invertOverlayTimer = 0;
let tutorialWaveTimer = 0;

// Saved name
const savedName = localStorage.getItem(CFG.KEY_NAME) || "";
G.introInput.value = savedName;
G.introInput.focus();

// Best score display
const storedBest = Number(localStorage.getItem(CFG.KEY_BEST) || 0);
if (storedBest > 0 && G.bestDisplay) G.bestDisplay.textContent = `PB: ${storedBest.toFixed(1)}s`;
GLOBAL_STATS.bestRun = Math.max(GLOBAL_STATS.bestRun, storedBest);

// Typewriter intro
const INTRO_TEXT = "[SYSTEM_AI] > identify yourself. or don't. i'll find out anyway.";
let typeIdx = 0;
const typeTimer = setInterval(() => {
  G.introLabel.classList.add("is-typing");
  typeIdx++;
  G.introLabel.textContent = INTRO_TEXT.slice(0, typeIdx);
  if (typeIdx >= INTRO_TEXT.length) {
    clearInterval(typeTimer);
    G.introLabel.classList.remove("is-typing");
  }
}, 38);

function flashWhite(opacity = 0.08, durationMs = 70) {
  if (!G.whiteFlash) return;
  G.whiteFlash.style.opacity = String(opacity);
  setTimeout(() => {
    G.whiteFlash.style.opacity = "0";
  }, durationMs);
}

function showChapterBanner(text, color = "#00ffff", durationMs = 2400) {
  if (!G.chapterBanner) return;
  clearTimeout(chapterBannerTimer);
  G.chapterBanner.textContent = text;
  G.chapterBanner.style.color = color;
  G.chapterBanner.classList.add("is-visible");
  chapterBannerTimer = setTimeout(() => {
    G.chapterBanner.classList.remove("is-visible");
  }, durationMs);
}

function queueOpeningTutorialWaves() {
  clearTimeout(tutorialWaveTimer);
  showChapterBanner("MOVE WITH WASD", "#ff4488", 2200);
  tutorialWaveTimer = setTimeout(() => {
    showChapterBanner("AIM WITH MOUSE · CLICK TO SHOOT", "#ff4488", 2600);
  }, 2350);
}

function showInvertOverlay(durationMs = 800) {
  if (!G.invertOverlay) return;
  clearTimeout(invertOverlayTimer);
  G.invertOverlay.classList.add("is-visible");
  invertOverlayTimer = setTimeout(() => {
    G.invertOverlay.classList.remove("is-visible");
  }, durationMs);
}

function queueOneTimeOpeningTutorialAfterChapter() {
  clearTimeout(tutorialWaveTimer);
  tutorialWaveTimer = setTimeout(() => {
    showChapterBanner("MOVE WITH WASD", "#ff4488", 2200);
    tutorialWaveTimer = setTimeout(() => {
      showChapterBanner("AIM WITH MOUSE · CLICK TO SHOOT", "#ff4488", 2600);
    }, 2350);
  }, 2350);
}

function shouldShowOpeningTutorial() {
  return localStorage.getItem(CFG.KEY_TUTORIAL_SEEN) !== "1";
}

function markOpeningTutorialSeen() {
  localStorage.setItem(CFG.KEY_TUTORIAL_SEEN, "1");
}

function flashAIBoxForAttack(color = "#ffff00") {
  if (!G.aiBox) return;
  G.aiBox.style.setProperty("--attack-color", color);
  G.aiBox.classList.remove("is-attack-flash");
  void G.aiBox.offsetWidth;
  G.aiBox.classList.add("is-attack-flash");
  setTimeout(() => G.aiBox.classList.remove("is-attack-flash"), 420);
}

function showMobileTutorial() {
  if (hasShownMobileTutorial || !G.mobileTutorial) return;
  hasShownMobileTutorial = true;
  G.mobileTutorial.classList.add("is-visible");
  setTimeout(() => G.mobileTutorial.classList.remove("is-visible"), 3000);
}

function hideMobileTutorial() {
  G.mobileTutorial?.classList.remove("is-visible");
}

function getDeathTitle(seconds) {
  if (seconds < 20) return "DELETED IMMEDIATELY";
  if (seconds < 60) return "THE AI LAUGHED";
  if (seconds < 120) return "ALMOST SUSPICIOUS";
  if (seconds < 160) return "THE AI RELAXED";
  return "SO CLOSE";
}

function getEscapeProgress(seconds, cores, escapeNeeded) {
  const timeProgress = escapeNeeded > 0 ? seconds / escapeNeeded : 0;
  const coreProgress = cores / CFG.AI_BOTS_FOR_INSTANT_WIN;
  return THREE.MathUtils.clamp(Math.max(timeProgress, coreProgress), 0, 1);
}

function startGame() {
  if (hasStarted) return;
  const raw = G.introInput.value.trim();
  PLAYER_NAME = raw ? raw.replace(/[^a-zA-Z0-9_\-]/g, "").slice(0, 16).toLowerCase() : "";
  if (PLAYER_NAME) localStorage.setItem(CFG.KEY_NAME, raw);
  else localStorage.removeItem(CFG.KEY_NAME);

  hasStarted = true;
  if (!aiTroll) aiTroll = new AITroll(G.aiBox, G.aiMsg, PLAYER_NAME);
  else aiTroll.setPilot(PLAYER_NAME);

  try {
    if (!threeApp) {
      threeApp = buildThreeApp(G.gameLayer);
      threeApp.start();
    }

    // Handle portal passthrough
    const params = new URLSearchParams(window.location.search);
    const fromPortal = params.get("portal") === "true";
    const referrer = params.get("ref") || null;
    if (fromPortal && params.get("username")) {
      PLAYER_NAME = params.get("username");
      localStorage.setItem(CFG.KEY_NAME, PLAYER_NAME);
    }
    aiTroll.setPilot(PLAYER_NAME);

    threeApp.beginRun({ fromPortal, referrer });
    G.hud.classList.add("is-active");

    if ("ontouchstart" in window) {
      G.shootHint.classList.add("is-visible");
      showMobileTutorial();
    }

    G.introInput.blur();
    G.introScreen.classList.add("is-fading");
    setTimeout(() => G.introScreen.classList.add("is-gone"), 500);
    setTimeout(() => aiTroll.pushFirstLine(), 700);
  } catch (e) {
    G.introLabel.textContent = `[ERROR] ${e instanceof Error ? e.message : e}`;
    console.error(e);
    hasStarted = false;
  }
}

G.introForm.addEventListener("submit", e => { e.preventDefault(); startGame(); });
window.addEventListener("keydown", e => {
  if (e.key === "Enter" && !hasStarted && document.activeElement === G.introInput) {
    e.preventDefault(); startGame();
  }
});

G.deathRetry.addEventListener("click", () => {
  G.deathScreen.classList.remove("is-visible");
  if (threeApp) threeApp.beginRun({});
  if (aiTroll) { aiTroll.reset(); aiTroll.pushFirstLine(); }
});
G.deathQuit.addEventListener("click", () => { window.location.href = CFG.WEBRING_URL; });
window.addEventListener("beforeunload", () => {
  aiTroll?.stopSpeech();
  speechSynthesis?.cancel();
});

// ═══════════════════════════════════════════════════════════════════
// BULLET CLASS
// ═══════════════════════════════════════════════════════════════════
let _scene; // set by buildThreeApp

class Bullet {
  constructor(pos, dir, target = null) {
    const geo = new THREE.SphereGeometry(0.2, 8, 8);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffd700, transparent: true, opacity: 0.95 });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.position.copy(pos);
    _scene.add(this.mesh);

    this.prev = pos.clone();
    this.vel = dir.clone().normalize().multiplyScalar(CFG.BULLET_SPEED);
    this.target = target;
    this.born = performance.now();
    this.dist = 0;
    this.active = true;

    // Trail
    this.trail = [];
    for (let i = 0; i < 10; i++) {
      const t = new THREE.Mesh(
        new THREE.SphereGeometry(0.07 + i * 0.015, 5, 5),
        new THREE.MeshBasicMaterial({ color: 0xffd700, transparent: true, opacity: Math.max(0, 0.55 - i * 0.08) })
      );
      t.position.copy(pos);
      _scene.add(t);
      this.trail.push(t);
    }
  }

  update(dt) {
    this.prev.copy(this.mesh.position);

    // Manual Aim (homing removed)

    const step = this.vel.clone().multiplyScalar(dt);
    this.mesh.position.add(step);
    this.dist += step.length();

    // Update trail
    for (let i = this.trail.length - 1; i > 0; i--) {
      this.trail[i].position.copy(this.trail[i - 1].position);
    }
    if (this.trail[0]) this.trail[0].position.copy(this.mesh.position);

    const age = (performance.now() - this.born) / 1000;
    if (age > CFG.BULLET_LIFETIME || this.dist > 450) { this.destroy(); return false; }
    return true;
  }

  checkHit(ent) {
    if (this.mesh.position.distanceTo(ent.mesh.position) < 8.5) return true;
    const seg = this.mesh.position.clone().sub(this.prev);
    const lenSq = Math.max(seg.lengthSq(), 0.0001);
    const toEnt = ent.mesh.position.clone().sub(this.prev);
    const t = THREE.MathUtils.clamp(toEnt.dot(seg) / lenSq, 0, 1);
    const closest = this.prev.clone().addScaledVector(seg, t);
    return closest.distanceTo(ent.mesh.position) < 8.5;
  }

  destroy() {
    if (this.mesh.parent) this.mesh.parent.remove(this.mesh);
    this.trail.forEach(t => { if (t.parent) t.parent.remove(t); });
    this.active = false;
  }
}

// ═══════════════════════════════════════════════════════════════════
// THREE APP
// ═══════════════════════════════════════════════════════════════════
function buildThreeApp(container) {
  // Scene
  _scene = new THREE.Scene();
  _scene.fog = new THREE.FogExp2(0x000000, 0.011);

  const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.1, 2000);
  camera.position.set(0, 8, 15);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.setClearColor(0x000000, 1);
  container.appendChild(renderer.domElement);

  // Post processing
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(_scene, camera));

  const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 1.35, 0.4, 0.1);
  composer.addPass(bloom);

  const chromaPass = new ShaderPass({
    uniforms: { tDiffuse: { value: null }, amount: { value: 0.002 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `uniform sampler2D tDiffuse; uniform float amount; varying vec2 vUv;
      void main(){ vec2 d=(vUv-.5)*amount; float r=texture2D(tDiffuse,vUv+d).r; float g=texture2D(tDiffuse,vUv).g; float b=texture2D(tDiffuse,vUv-d).b; gl_FragColor=vec4(r,g,b,1.); }`,
  });
  composer.addPass(chromaPass);

  const vigPass = new ShaderPass({
    uniforms: { tDiffuse: { value: null }, darkness: { value: 1.05 }, redTint: { value: 0.0 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `uniform sampler2D tDiffuse; uniform float darkness; uniform float redTint; varying vec2 vUv;
      void main(){ vec4 c=texture2D(tDiffuse,vUv); float d=distance(vUv,vec2(.5)); float v=1.-smoothstep(.35,1.,d*darkness); v=max(v,.15); c.rgb*=v; c.r=mix(c.r,c.r+(1.-v)*.5,redTint); gl_FragColor=c; }`,
  });
  composer.addPass(vigPass);

  // Ship anchor
  const shipAnchor = new THREE.Group();
  shipAnchor.position.set(0, 0, 0);
  _scene.add(shipAnchor);
  buildShip(shipAnchor);

  // Tunnel
  const CHUNK_LEN = 80, CHUNK_CNT = 8;
  const tunnelChunks = buildTunnel(_scene, CHUNK_CNT, CHUNK_LEN);

  // Obstacle pools
  const rings = buildRingPool(_scene, 14);
  const walls = buildWallPool(_scene, 14);
  const firewalls = buildFirewallPool(_scene, 6);
  const windmills = buildWindmillPool(_scene, 6);
  deactivateAll(rings, walls, firewalls, windmills);

  // Ghost system
  const ghostSys = buildGhostSystem(_scene);

  // Portal system
  const portalSys = buildPortalSystem(_scene);
  portalSys.group.visible = false;

  // Audio
  const audio = new GameAudio();
  const sfx = buildSfx();

  // ── INPUT ────────────────────────────────────────────────────────
  const keys = new Set();
  let touchDX = 0, touchDY = 0, lastTX = 0, lastTY = 0, touchOn = false;
  let ptrX = 0, ptrY = 0, ptrScreenX = innerWidth / 2, ptrScreenY = innerHeight / 2;
  let mouseDown = false;

  const onKeyDown = e => {
    keys.add(e.code);
    if (e.code === "Space" || e.code === "KeyJ") { e.preventDefault(); shoot(); }
  };
  const onKeyUp = e => keys.delete(e.code);

  const onPtrMove = e => {
    ptrX = THREE.MathUtils.clamp((e.clientX / innerWidth) * 2 - 1, -1, 1);
    ptrY = THREE.MathUtils.clamp(-((e.clientY / innerHeight) * 2 - 1), -1, 1);
    ptrScreenX = e.clientX;
    ptrScreenY = e.clientY;
    // Update crosshair position
    G.crosshair.style.left = `${e.clientX}px`;
    G.crosshair.style.top = `${e.clientY}px`;
  };
  const onMouseDown = e => { mouseDown = true; if (e.button === 0) shoot(); };
  const onMouseUp = () => mouseDown = false;

  let touchShootHeld = false;

  const onTouchStart = e => {
    touchOn = true;
    lastTX = e.touches[0].clientX; lastTY = e.touches[0].clientY;
    hideMobileTutorial();
    if (lastTX > innerWidth / 2) { touchShootHeld = true; shoot(); }
  };
  const onTouchMove = e => {
    if (!touchOn) return;
    lastTX = e.touches[0].clientX; lastTY = e.touches[0].clientY;
    touchDX = (e.touches[0].clientX - lastTX) / innerWidth * 5.5;
    touchDY = -(e.touches[0].clientY - lastTY) / innerHeight * 5.5;
    lastTX = e.touches[0].clientX; lastTY = e.touches[0].clientY;
    // Mobile aim via right-half touch position
    if (lastTX > innerWidth / 2) {
      ptrX = THREE.MathUtils.clamp((lastTX / innerWidth) * 2 - 1, -1, 1);
      ptrY = THREE.MathUtils.clamp(-((lastTY / innerHeight) * 2 - 1), -1, 1);
      ptrScreenX = lastTX;
      ptrScreenY = lastTY;
    }
  };
  const onTouchEnd = () => { touchOn = false; touchDX = 0; touchDY = 0; touchShootHeld = false; };

  const onResize = () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
    composer.setSize(innerWidth, innerHeight);
    ptrScreenX = innerWidth / 2;
    ptrScreenY = innerHeight / 2;
  };

  // ── RUN STATE ────────────────────────────────────────────────────
  let isRunActive = false;
  let endSeq = false;
  let wallTime = 0, runTime = 0, diffT = 0;
  let prevTs = 0;
  let timeScale = 1;
  let slowMo = 0;
  let ctrlsInverted = false;
  let isPaused = false;
  let pauseTimer = 0;
  const prevShipPos = new THREE.Vector3();

  // Player state
  let health = CFG.PLAYER_HEALTH;
  let invuln = 0;
  let coresDestroyed = 0;
  let portalUnlocked = false;
  let escapeTimeNeeded = CFG.BASE_ESCAPE_TIME;
  let shootCool = 0;
  let disruptMeter = 0;
  let camKick = 0;
  let camFOV = 75;

  // Spawn state
  const spawnState = { nextZ: -80, rng: rng32(Date.now() & 0xffffffff) };
  let obTargX = 0, obTargY = 0, targShiftT = 0;
  const TARGET_SHIFT = 6;

  // Vectors
  const shipTarget = new THREE.Vector3();
  const camLerp = new THREE.Vector3(0, 8, 15);
  const pAABB = new THREE.Box3(), nmAABB = new THREE.Box3(), oAABB = new THREE.Box3();

  // Bullets / cores
  let bullets = [];
  let cores = [];
  let lastContactAt = 0;
  let lastCollMs = 0, lastNearMs = 0, nearStreak = 0;
  let coreSpawnTimer = 3, currentWaveId = 0;
  let lastObstacleClearedAt = -99;
  let portalSafeZ = null;
  let harvestedWaves = new Set();
  let crashCount = 0, assistMode = false, assistEnd = 0;
  let endSeqTimer = 0;

  // Ghost deletion timings
  const ghostTimes = [18, 32, 48, 62];
  const ghostFired = [false, false, false, false];

  // Banner
  let bannerTimer = 0, bannerText = "";

  // AFK
  let afkT = 0, afkIdx = 0, afkCool = 0;

  // ── SHOOTING ─────────────────────────────────────────────────────
  function shoot() {
    if (!isRunActive || endSeq || shootCool > 0) return;
    shootCool = CFG.SHOOT_COOLDOWN;
    sfx.play("bullet");

    // Muzzle flash
    G.whiteFlash.style.opacity = "0.1";
    setTimeout(() => { G.whiteFlash.style.opacity = "0"; }, 45);

    // Crosshair pulse
    G.crosshair.classList.add("shooting");
    setTimeout(() => G.crosshair.classList.remove("shooting"), 80);

    camKick = 0.28;
    const spawnPos = shipAnchor.position.clone().add(new THREE.Vector3(0, 0, -2));
    const { target, dir } = getAimTarget(spawnPos);
    bullets.push(new Bullet(spawnPos, dir, target));
  }

  function getLockCandidate(from, baseDir, {
    coneDeg = 10,
    lockRadiusScale = 0.045,
    minAheadDistance = 16,
    maxAheadDistance = 125,
    maxDist = 135,
    frustumX = 0.86,
    frustumY = 0.82,
    minCameraDepth = 18,
    angleWeight = 220,
  } = {}) {
    const LOCK_CONE_RAD = THREE.MathUtils.degToRad(coneDeg);
    const LOCK_RADIUS_PX = Math.min(innerWidth, innerHeight) * lockRadiusScale;
    let bestCore = null;
    let bestScore = Infinity;

    for (const c of cores) {
      if (!c.active) continue;

      const corePos = c.mesh.position.clone();
      const aheadDistance = from.z - corePos.z;
      if (aheadDistance < minAheadDistance || aheadDistance > maxAheadDistance) continue;

      const toCoreVec = corePos.clone().sub(from);
      const dist = toCoreVec.length();
      if (dist > maxDist) continue;

      const toCore = toCoreVec.normalize();
      const angle = baseDir.angleTo(toCore);
      if (angle > LOCK_CONE_RAD) continue;

      const cameraSpace = corePos.clone().applyMatrix4(camera.matrixWorldInverse);
      if (cameraSpace.z > -minCameraDepth) continue;

      const projected = corePos.project(camera);
      if (projected.z <= -1 || projected.z >= 1) continue;
      if (Math.abs(projected.x) > frustumX || Math.abs(projected.y) > frustumY) continue;

      const screenX = ((projected.x + 1) * 0.5) * innerWidth;
      const screenY = ((1 - projected.y) * 0.5) * innerHeight;
      const cursorDist = Math.hypot(screenX - ptrScreenX, screenY - ptrScreenY);
      if (cursorDist > LOCK_RADIUS_PX) continue;

      const score = cursorDist + angle * angleWeight + aheadDistance * 0.08;
      if (score < bestScore) {
        bestScore = score;
        bestCore = c;
      }
    }

    return bestCore;
  }

  function getCursorLockCandidate(from, baseDir) {
    return getLockCandidate(from, baseDir, {
      coneDeg: 10,
      lockRadiusScale: 0.045,
      minAheadDistance: 16,
      maxAheadDistance: 125,
      maxDist: 135,
      frustumX: 0.86,
      frustumY: 0.82,
      minCameraDepth: 18,
      angleWeight: 220,
    });
  }

  function getAimBaseDirection() {
    const mouseVec = new THREE.Vector3(ptrX, ptrY, 0.5);
    mouseVec.unproject(camera);
    return mouseVec.sub(camera.position).normalize();
  }

  function getAimTarget(from) {
    const baseDir = getAimBaseDirection();
    const bestCore = getLockCandidate(camera.position, baseDir, {
      coneDeg: 16,
      lockRadiusScale: 0.07,
      minAheadDistance: 16,
      maxAheadDistance: 115,
      maxDist: 150,
      frustumX: 0.82,
      frustumY: 0.76,
      minCameraDepth: 18,
      angleWeight: 165,
    });

    if (bestCore) {
      const dist = bestCore.mesh.position.distanceTo(from);
      const travelTime = dist / CFG.BULLET_SPEED;
      const predicted = bestCore.mesh.position.clone().add(
        new THREE.Vector3(0, 0, bestCore.mesh.userData.speed * travelTime)
      );
      const snapDir = predicted.sub(from).normalize();
      return { target: bestCore, dir: snapDir };
    }

    return { target: null, dir: baseDir };
  }

  // ── CORES (GLITCH ENTITIES) ───────────────────────────────────────
  // Check if spawn position is clear of obstacles with a generous buffer.
  function isSpawnClear(z, rings, walls, firewalls, windmills) {
    const MIN_CLEARANCE = CFG.AI_BOT_OBSTACLE_CLEARANCE;
    for (const pool of [rings, walls, firewalls, windmills]) {
      if (!pool) continue;
      for (const o of pool) {
        if (o.active && Math.abs(o.group.position.z - z) < MIN_CLEARANCE) {
          return false; // Too close to an obstacle
        }
      }
    }
    return true;
  }

  function makeFloatingLabel(text, {
    width = 320,
    height = 72,
    font = "bold 26px monospace",
    fill = "#ffd54a",
    stroke = "rgba(255, 213, 74, 0.35)",
    background = "rgba(0, 0, 0, 0.55)",
    scaleX = 7.6,
    scaleY = 1.7,
  } = {}) {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 2;
    ctx.strokeRect(2, 2, width - 4, height - 4);
    ctx.fillStyle = fill;
    ctx.font = font;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, width / 2, height / 2);
    const tex = new THREE.CanvasTexture(canvas);
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
    spr.scale.set(scaleX, scaleY, 1);
    return spr;
  }

  function spawnCore(playerZ, parent = null, index = 0, waveId = -1, waveCount = CFG.AI_BOT_MAX_SPAWN_COUNT) {
    if (cores.length >= CFG.MAX_AI_BOTS) return;
    const group = new THREE.Group();

    const gen = parent ? (parent.mesh.userData.generation || 0) + 1 : 0;
    const scale = Math.max(0.55, 1 - gen * 0.14);

    const core = new THREE.Mesh(
      new THREE.OctahedronGeometry(2.5, 0),
      new THREE.MeshBasicMaterial({ color: 0xff0066, wireframe: true, transparent: true, opacity: 1.0 })
    );
    group.add(core);

    // Bright center dot for visibility
    const dot = new THREE.Mesh(
      new THREE.SphereGeometry(0.8, 6, 6),
      new THREE.MeshBasicMaterial({ color: 0xff88bb })
    );
    group.add(dot);

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(3.5, 0.38, 4, 8),
      new THREE.MeshBasicMaterial({ color: 0xff4488, transparent: true, opacity: 0.6 })
    );
    ring.rotation.x = Math.PI / 2;
    group.add(ring);

    const reticle = new THREE.Mesh(
      new THREE.OctahedronGeometry(5.2, 0),
      new THREE.MeshBasicMaterial({ color: 0xffc94a, wireframe: true, transparent: true, opacity: 0.42 })
    );
    reticle.visible = false;
    group.add(reticle);

    let tutorialLabel = null;
    if (!parent && waveId === 1 && index === 0) {
      tutorialLabel = makeFloatingLabel("SHOOT THIS", {
        width: 280,
        height: 60,
        font: "bold 22px monospace",
        scaleX: 6.8,
        scaleY: 1.5,
      });
      tutorialLabel.position.set(0, 7.2, 0);
      group.add(tutorialLabel);
    }

    if (parent) {
      group.position.copy(parent.mesh.position);
      group.position.x += (Math.random() - 0.5) * 5;
      group.position.y += (Math.random() - 0.5) * 5;
      group.position.z += (Math.random() - 0.5) * 6;
    } else {
      // Formation spawning: Spread the wave out while keeping it readable.
      const count = Math.max(1, waveCount);
      const waveAngle = ((waveId * 1.5) % (Math.PI * 2)); // Dynamic rotation per wave
      const angle = (index / count) * Math.PI * 2 + waveAngle + (Math.random() - 0.5) * 0.4;
      const radius = 11 + Math.random() * 5; // Variation in radius
      group.position.set(
        Math.cos(angle) * radius,
        Math.sin(angle) * radius * 0.75,
        playerZ - CFG.AI_BOT_SPAWN_DISTANCE - (index * CFG.AI_BOT_WAVE_Z_SPACING) + (Math.random() - 0.5) * 10 // Individual Z-jitter
      );
    }

    group.scale.setScalar(scale);
    group.userData = {
      health: 1,
      speed: (() => {
        const baseSpeed = 9 + Math.random() * 5;
        const timeBonus = Math.min(wallTime / 30, 1) * 8;
        return baseSpeed + timeBonus;
      })(),
      phase: Math.random() * Math.PI * 2,
      rotSpd: 2 + Math.random() * 2,
      generation: gen,
      replicateT: 0,
      waveId: waveId,
      tutorialUntil: tutorialLabel ? wallTime + 2 : 0,
      core, ring, reticle, tutorialLabel
    };
    _scene.add(group);
    cores.push({ mesh: group, active: true });
  }

  function updateCores(dt, playerZ) {
    const cdRef = { val: coresDestroyed };

    for (let i = cores.length - 1; i >= 0; i--) {
      const c = cores[i];
      if (!c.active) continue;
      const ud = c.mesh.userData;
      const distanceToShip = c.mesh.position.distanceTo(shipAnchor.position);

      // Move
      c.mesh.position.z += ud.speed * dt;

      // Animate
      const nearFactor = THREE.MathUtils.clamp(1 - distanceToShip / 80, 0, 1);
      const rotMultiplier = 1 + nearFactor;
      ud.core.rotation.x += ud.rotSpd * dt * rotMultiplier;
      ud.core.rotation.y += ud.rotSpd * 0.7 * dt * rotMultiplier;
      ud.ring.rotation.z += ud.rotSpd * 1.2 * dt * rotMultiplier;
      ud.core.material.opacity = 0.95 + nearFactor * 0.05;
      ud.ring.material.opacity = 0.6 + nearFactor * 0.25;
      c.mesh.position.y += Math.sin(performance.now() * 0.004 + ud.phase) * 0.022;
      // Drift
      c.mesh.position.x += Math.cos(performance.now() * 0.001 + ud.phase) * 0.015;

      const dz = shipAnchor.position.z - c.mesh.position.z;
      const dx = c.mesh.position.x - shipAnchor.position.x;
      const dy = c.mesh.position.y - shipAnchor.position.y;
      const angleToCore = Math.atan2(Math.hypot(dx, dy), Math.max(dz, 0.001));
      const isTargeted = dz > 0 && distanceToShip < 500;
      ud.reticle.visible = isTargeted;
      ud.reticle.rotation.y += dt * 0.7;
      ud.reticle.material.opacity = 0.3 + Math.sin(wallTime * 8) * 0.12;

      if (ud.tutorialLabel) {
        ud.tutorialLabel.visible = wallTime <= ud.tutorialUntil;
      }

      // Replication removed

      // Cull
      if (c.mesh.position.z > playerZ + 28) {
        _scene.remove(c.mesh);
        cores.splice(i, 1);
        continue;
      }

      // Contact damage
      if (distanceToShip < 4.5 && performance.now() - lastContactAt > 750) {
        lastContactAt = performance.now();
        _scene.remove(c.mesh);
        cores.splice(i, 1);
        spawnParticles(shipAnchor.position.clone(), 0xff0066);
        applyDamage(CFG.CONTACT_DAMAGE, "caught by a stray core. incredible.");
        continue;
      }

    }

    // Bullet collision - find closest core for each bullet (only hit one target)
    for (let b = bullets.length - 1; b >= 0; b--) {
      const bullet = bullets[b];
      if (!bullet.active) continue;

      // Find the closest core to this bullet
      let closestCore = null;
      let closestDist = Infinity;
      let closestIdx = -1;

      for (let i = cores.length - 1; i >= 0; i--) {
        const c = cores[i];
        if (!c.active) continue;

        // Get distance from bullet to core
        const dist = bullet.mesh.position.distanceTo(c.mesh.position);
        if (dist < 7 && dist < closestDist) {
          closestDist = dist;
          closestCore = c;
          closestIdx = i;
        }
      }

      // Only hit the single closest core
      if (closestCore && bullet.checkHit(closestCore)) {
        bullet.destroy();
        bullets.splice(b, 1);

        // All cores are individually destroyable - cap at win condition
        if (cdRef.val < CFG.AI_BOTS_FOR_INSTANT_WIN) {
          flashWhite(0.06, 55);
          spawnParticles(closestCore.mesh.position.clone(), 0x00ffff);
          _scene.remove(closestCore.mesh);
          cores.splice(closestIdx, 1);
          cdRef.val++;

          // Update escape time (hybrid win condition)
          escapeTimeNeeded = Math.max(CFG.MIN_ESCAPE_TIME, CFG.BASE_ESCAPE_TIME - cdRef.val * CFG.TIME_REDUCTION_PER_AI_BOT);
          disruptMeter = THREE.MathUtils.clamp(cdRef.val / CFG.AI_BOTS_FOR_INSTANT_WIN, 0, 1);

          aiTroll?.onCoreDestroyed(cdRef.val, CFG.AI_BOTS_FOR_INSTANT_WIN);
          updateHUD(cdRef.val, escapeTimeNeeded);

          if (cdRef.val >= CFG.AI_BOTS_FOR_INSTANT_WIN) unlockPortal(cdRef.val);
        }
      }
    }

    coresDestroyed = cdRef.val;
  }

  function spawnParticles(pos, color) {
    // Rainbow color palette for impacts
    const rainbowColors = [0xff0000, 0xff7f00, 0xffff00, 0x00ff00, 0x0000ff, 0x4b0082, 0x9400d3, 0xff1493, 0x00ffff, 0xffd700];
    for (let i = 0; i < 14; i++) {
      // Use rainbow colors if no specific color provided, otherwise use the passed color
      const particleColor = color ? rainbowColors[Math.floor(Math.random() * rainbowColors.length)] : 0xffffff;
      const p = new THREE.Mesh(
        new THREE.BoxGeometry(0.22, 0.22, 0.22),
        new THREE.MeshBasicMaterial({ color: particleColor, transparent: true, opacity: 0.95 })
      );
      p.position.copy(pos);
      _scene.add(p);
      const vel = new THREE.Vector3((Math.random()-0.5)*9, (Math.random()-0.5)*9, (Math.random()-0.5)*9);
      let life = 0;
      const tick = () => {
        life += 0.016;
        if (life > 0.55) { if (p.parent) p.parent.remove(p); return; }
        p.position.addScaledVector(vel, 0.016);
        vel.multiplyScalar(0.96);
        p.material.opacity = Math.max(0, 0.95 - life * 1.7);
        p.scale.setScalar(Math.max(0, 1 - life * 1.7));
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }
  }

  // ── PLAYER DAMAGE ─────────────────────────────────────────────────
  function applyDamage(amount, aiLine = null) {
    if (!isRunActive || endSeq || invuln > 0) return;

    // Assist mode gives extra protection in early game
    const reducedAmount = assistMode ? amount * 0.55 : amount;
    health = Math.max(0, health - reducedAmount);
    invuln = CFG.INVULN_TIME;

    // Visual
    G.damageFlash.classList.add("is-active");
    setTimeout(() => G.damageFlash.classList.remove("is-active"), 180);
    flashWhite(0.14, 80);

    // Camera shake
    camera.position.x += (Math.random() - 0.5) * 2;
    camera.position.y += (Math.random() - 0.5) * 1.5;

    if (aiLine) aiTroll?.pushLine(aiLine);
    else {
      const pct = health / CFG.PLAYER_HEALTH;
      if (pct < 0.3) aiTroll?.announce("critical hull. you are falling apart.", { ttlMs: 3600, dedupeKey: "critical-hull" });
      else aiTroll?.pushLine(`integrity ${Math.ceil(health)} percent. ${pct < 0.6 ? "getting desperate." : "noted."}`, {
        dedupeKey: pct < 0.6 ? "mid-hull-warning" : `hull-${Math.ceil(health / 10) * 10}`,
      });
    }

    updateHUD(coresDestroyed, escapeTimeNeeded);

    if (health <= 0) {
      triggerCrash();
    }
  }

  // ── PORTAL UNLOCK ─────────────────────────────────────────────────
  function unlockPortal(cores) {
    if (portalUnlocked) return;
    portalUnlocked = true;
    aiDirector.reset();
    ctrlsInverted = false;

    if (cores >= CFG.AI_BOTS_FOR_INSTANT_WIN) {
      aiTroll?.announce("no. you destroyed them all. the lock is gone.", {
        ttlMs: 4200,
        dedupeKey: "portal-unlock-destroyed-all",
      });
    } else {
      aiTroll?.announce("the portal is open. move.", {
        ttlMs: 3200,
        dedupeKey: "portal-unlock-time",
      });
    }

    showBanner("EXIT PORTAL UNLOCKED — DIVE THROUGH THE RING", 3.5);
    G.hudTimer.classList.add("is-escaping");
    updateHUD(coresDestroyed, escapeTimeNeeded);

    if (!portalSys.spawned) {
      portalSys.spawned = true;
      portalSys.group.visible = true;
      portalSys.group.position.set(0, 0, shipAnchor.position.z - 230);
      portalSafeZ = shipAnchor.position.z - 230;
      sfx.play("portal");
    }

    // Freeze hazards so the portal run is clean and readable.
    bullets.forEach(b => b.destroy());
    bullets = [];
    cores.forEach(c => {
      c.active = false;
      if (c.mesh.parent) _scene.remove(c.mesh);
    });
    cores = [];
    deactivateAll(rings, walls, firewalls, windmills);
  }

  // ── HUD UPDATE ────────────────────────────────────────────────────
  function updateHUD(cores, escapeNeeded) {
    // Timer
    if (portalUnlocked) {
      G.hudTimer.textContent = "PORTAL OPEN";
    } else {
      const timeLeft = Math.max(0, escapeNeeded - wallTime);
      if (timeLeft < 8) {
        G.hudTimer.textContent = `UNLOCKING ${Math.ceil(timeLeft)}s`;
        G.hudTimer.classList.add("is-escaping");
      } else {
        G.hudTimer.textContent = `T+${Math.floor(wallTime)}s`;
        G.hudTimer.classList.remove("is-escaping");
      }
    }

    // Speed
    G.hudSpeed.textContent = `${Math.round(getSpeed(diffT))} m/s`;

    // Objective
    const remaining = Math.max(0, CFG.AI_BOTS_FOR_INSTANT_WIN - cores);
    const timeLeft = Math.max(0, escapeNeeded - wallTime);
    if (portalUnlocked) {
      G.hudObjective.textContent = "OBJECTIVE: REACH THE PORTAL";
    } else if (cores >= CFG.AI_BOTS_FOR_INSTANT_WIN - 1) {
      G.hudObjective.textContent = "OBJECTIVE: ONE MORE CORE OPENS THE EXIT";
    } else if (cores === 0) {
      G.hudObjective.textContent = "OBJECTIVE: SHOOT AI BOTS TO BREAK THE LOCK EARLY";
    } else {
      G.hudObjective.textContent = `OBJECTIVE: HUNT ${remaining} MORE AI BOTS OR HOLD OUT ${Math.ceil(timeLeft)}s`;
    }

    // Progress
    let progressText;
    if (portalUnlocked) {
      progressText = `PORTAL OPEN | FLY THROUGH THE RING | HULL ${Math.ceil(health)}`;
    } else if (cores === 0) {
      progressText = `AI BOTS 0/${CFG.AI_BOTS_FOR_INSTANT_WIN} | PORTAL UNLOCKS AT ${Math.ceil(escapeNeeded)}s OR AFTER ${CFG.AI_BOTS_FOR_INSTANT_WIN} AI BOTS | HULL ${Math.ceil(health)}`;
    } else if (remaining <= 1) {
      progressText = `AI BOTS ${cores}/${CFG.AI_BOTS_FOR_INSTANT_WIN} | ONE MORE AI BOT OPENS THE PORTAL | ${Math.ceil(timeLeft)}s FALLBACK | HULL ${Math.ceil(health)}`;
    } else {
      const nextUnlockTime = Math.max(CFG.MIN_ESCAPE_TIME, escapeNeeded - CFG.TIME_REDUCTION_PER_AI_BOT);
      progressText = `AI BOTS ${cores}/${CFG.AI_BOTS_FOR_INSTANT_WIN} | ${remaining} MORE CUTS THE TIMER TO ${Math.ceil(nextUnlockTime)}s | ${Math.ceil(timeLeft)}s FALLBACK | HULL ${Math.ceil(health)}`;
    }
    G.hudProgress.textContent = progressText;

    // Integrity bar
    const hp = THREE.MathUtils.clamp(health / CFG.PLAYER_HEALTH, 0, 1);
    G.integrityFill.style.width = `${hp * 100}%`;
    G.integrityFill.dataset.state = hp < 0.3 ? "critical" : hp < 0.6 ? "warning" : "stable";

    // Disruption bar
    G.disruptionFill.style.width = `${disruptMeter * 100}%`;
    G.disruptionFill.dataset.state = disruptMeter >= 1 ? "max" : disruptMeter >= 0.66 ? "high" : disruptMeter >= 0.33 ? "mid" : "low";
    if (G.disruptionLabel) {
      const breakPct = Math.round(disruptMeter * 100);
      G.disruptionLabel.textContent = breakPct > 0 ? `SIGNAL BREAK ${breakPct}%` : "SIGNAL BREAK";
    }

    // PB
    const pb = Number(localStorage.getItem(CFG.KEY_BEST) || 0);
    if (wallTime > pb) {
      localStorage.setItem(CFG.KEY_BEST, wallTime.toFixed(1));
      G.hudBest.textContent = `PB ${Math.floor(wallTime)}s ★`;
    }
  }

  // ── BANNER ────────────────────────────────────────────────────────
  function showBanner(text, dur = 2.5) {
    bannerText = text;
    bannerTimer = dur;
    G.flightTip.textContent = text;
    G.flightTip.dataset.mode = "danger";
    G.flightTip.classList.add("is-visible");
  }

  function syncBanner() {
    if (bannerTimer > 0) return;
    if (portalUnlocked) {
      G.flightTip.textContent = "PORTAL OPEN · DIVE THROUGH THE RING";
      G.flightTip.dataset.mode = "danger";
      G.flightTip.classList.add("is-visible");
      return;
    }
    const remaining = Math.max(0, CFG.AI_BOTS_FOR_INSTANT_WIN - coresDestroyed);
    G.flightTip.textContent = `HUNT ${remaining} MORE AI BOTS · SHOOT EARLY, DODGE LATE`;
    delete G.flightTip.dataset.mode;
    G.flightTip.classList.add("is-visible");
  }

  // ── CRASH / WIN ───────────────────────────────────────────────────
  function triggerCrash() {
    if (isPaused) return;

    crashCount++;
    recordDeathStats(wallTime, shipAnchor.position.z);
    // Mercy: assist mode after 2 crashes in early game
    if (crashCount >= 2 && wallTime < 30 && !assistMode) {
      assistMode = true;
      assistEnd = wallTime + 20;
      aiTroll?.announce("fine. stability protocol engaged.", { ttlMs: 3200, dedupeKey: "assist-mode" });
      health = Math.min(CFG.PLAYER_HEALTH, health + 28);
      updateHUD(coresDestroyed, escapeTimeNeeded);
    }

    isPaused = true;
    pauseTimer = 0.22;
    sfx.play("crash");
    audio.stop();
    aiTroll?.onDeath(PLAYER_NAME);

    const insult = randomInsult(PLAYER_NAME, Math.floor(wallTime), coresDestroyed);
    G.crashText.textContent = insult;
    G.crashOverlay.classList.add("is-visible");
    setTimeout(() => G.crashOverlay.classList.remove("is-visible"), 210);
  }

  function triggerWin() {
    if (endSeq) return;
    endSeq = true;
    endSeqTimer = 0;
    audio.stop();
    aiTroll?.onWin(PLAYER_NAME);

    const finalLine = PLAYER_NAME ? `${PLAYER_NAME}... wait.` : "wait.";
    aiTroll?.pushBrokenFinal(finalLine);
    G.hud.classList.add("is-ending");
    G.flightTip.textContent = "PORTAL BREACH";
    G.flightTip.dataset.mode = "danger";
    G.flightTip.classList.add("is-visible");
    showChapterBanner("PORTAL BREACH", "#ffffff", 1600);

    // Camera zoom + shake
    const zoomId = setInterval(() => {
      camFOV = THREE.MathUtils.lerp(camFOV, 34, 0.14);
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
      aiTroll?.stopSpeech();
      speechSynthesis?.cancel();
      aiSpeak("please.", 0.42, 0.32);

      triggerShatter(() => {
        G.whiteFlash.classList.add("is-visible");
        setTimeout(() => {
          aiTroll?.stopSpeech();
          speechSynthesis?.cancel();
          const p = new URLSearchParams({
            username: PLAYER_NAME || "anonymous",
            speed: Math.round(getSpeed(diffT)).toString(),
            ref: location.origin,
            hp: "100",
            color: "#00ffff",
            won: "true",
          });
          location.href = `${CFG.WEBRING_URL}?${p}`;
        }, 650);
      });
    }, 4200);
  }

  // ── RESET ─────────────────────────────────────────────────────────
  function resetRun() {
    wallTime = 0; runTime = 0; diffT = 0;
    timeScale = 1; slowMo = 0; isPaused = false; pauseTimer = 0;
    endSeq = false; ctrlsInverted = false;
    health = CFG.PLAYER_HEALTH; invuln = 0;
    coresDestroyed = 0; portalUnlocked = false;
    escapeTimeNeeded = CFG.BASE_ESCAPE_TIME;
    shootCool = 0; disruptMeter = 0; camKick = 0; camFOV = 75;
    coreSpawnTimer = 3; currentWaveId = 0;
    lastObstacleClearedAt = -99;
    portalSafeZ = null;
    harvestedWaves.clear();
    camera.fov = 75; camera.updateProjectionMatrix();
    bannerTimer = 0; bannerText = "";
    endSeqTimer = 0;
    afkT = 0; afkIdx = 0; afkCool = 0;
    lastContactAt = 0; lastCollMs = 0; lastNearMs = 0; nearStreak = 0;

    assistMode = false; assistEnd = 0;
    // Don't reset crashCount per session — that's intentional

    // Clear dynamic objects
    bullets.forEach(b => b.destroy()); bullets = [];
    cores.forEach(c => { if (c.mesh.parent) _scene.remove(c.mesh); }); cores = [];

    // Reset ship
    shipAnchor.position.set(0, 0, 0); shipAnchor.rotation.set(0, 0, 0);
    shipTarget.set(0, 0, 0);

    // Center crosshair on screen
    G.crosshair.style.left = `${innerWidth / 2}px`;
    G.crosshair.style.top = `${innerHeight / 2}px`;

    // Camera
    camera.position.set(0, 8, 15); camLerp.set(0, 8, 15);

    // Obstacles
    spawnState.nextZ = -80;
    spawnState.rng = rng32(Date.now() & 0xffffffff);
    obTargX = 0; obTargY = 0; targShiftT = 0;
    deactivateAll(rings, walls, firewalls, windmills);

    // Portal
    portalSys.group.visible = false; portalSys.spawned = false;
    portalSys.group.position.set(0, 0, -99999);
    portalSys.group.scale.setScalar(1);
    portalSys.label.material.opacity = 1;
    if (portalSys.startPortal) { portalSys.startPortal.group.visible = false; }

    // Ghosts
    ghostSys.reset(_scene);
    for (let i = 0; i < ghostFired.length; i++) ghostFired[i] = false;

    // Post FX
    chromaPass.uniforms.amount.value = 0.002;
    vigPass.uniforms.darkness.value = 1.05;
    vigPass.uniforms.redTint.value = 0;

    // HUD
    clearTimeout(chapterBannerTimer);
    clearTimeout(invertOverlayTimer);
    clearTimeout(tutorialWaveTimer);
    aiTroll?.stopSpeech();
    speechSynthesis?.cancel();
    G.hudTimer.classList.remove("is-escaping");
    G.hud.classList.remove("is-ending");
    G.whiteFlash.classList.remove("is-visible");
    G.whiteFlash.style.opacity = "0";
    G.shatterCanvas.classList.remove("is-visible");
    G.crashOverlay.classList.remove("is-visible");
    G.chapterBanner.classList.remove("is-visible");
    G.invertOverlay.classList.remove("is-visible");
    G.portalArrow.classList.remove("is-visible");
    G.flightTip.textContent = "WASD · SPACE/CLICK = SHOOT · DESTROY AI BOTS · REACH THE PORTAL";
    delete G.flightTip.dataset.mode;
    G.flightTip.classList.add("is-visible");
    hideMobileTutorial();

    // AI events
    aiDirector.reset();

    updateHUD(0, CFG.BASE_ESCAPE_TIME);
    prevTs = 0;
    prevShipPos.copy(shipAnchor.position);
  }

  // ── AI DIRECTOR ───────────────────────────────────────────────────
  function triggerAttackFeedback(text, dur, color, key) {
    showBanner(text, dur);
    flashAIBoxForAttack(color);
    sfx.alert?.(key);
    if (key === "INVERT_CONTROLS") showInvertOverlay(800);
  }

  const aiDirector = buildAIDirector(aiTroll, {
    INVERT_CONTROLS: (dur) => triggerAttackFeedback("AI ATTACK: CONTROLS INVERTED", dur, "#fff36b", "INVERT_CONTROLS"),
    COMPRESS_SPACE: (dur) => triggerAttackFeedback("AI ATTACK: SPACE COMPRESSED", dur, "#ff66cc", "COMPRESS_SPACE"),
    FRAGMENT_LIGHT: (dur) => triggerAttackFeedback("AI ATTACK: VISUAL FEED CORRUPTED", dur, "#b57cff", "FRAGMENT_LIGHT"),
    OPTIMIZE_PATH: (dur) => {
      triggerAttackFeedback("AI ATTACK: PATH REWRITTEN", dur, "#ff665f", "OPTIMIZE_PATH");
      forceCorridor(walls, shipAnchor.position.z);
    },
  });

  // ── MAIN TICK ─────────────────────────────────────────────────────
  let rafId = 0;

  function tick(ts) {
    rafId = requestAnimationFrame(tick);
    if (!isRunActive) { composer.render(); return; }

    if (prevTs === 0) prevTs = ts;
    const rawDt = Math.min((ts - prevTs) / 1000, 0.05);
    prevTs = ts;
    prevShipPos.copy(shipAnchor.position);

    // Cooldowns
    shootCool = Math.max(0, shootCool - rawDt);
    invuln = Math.max(0, invuln - rawDt);
    camKick = Math.max(0, camKick - rawDt * 3);
    bannerTimer = Math.max(0, bannerTimer - rawDt);

    // Assist mode expiry
    if (assistMode && wallTime >= assistEnd) { assistMode = false; }

    // Pause (after crash flash)
    if (isPaused) {
      pauseTimer -= rawDt;
      if (pauseTimer <= 0) {
        isPaused = false;
        // Show death screen
        const timeStr = wallTime.toFixed(1);
        const coreStr = coresDestroyed;
        const insult = randomInsult(PLAYER_NAME, Math.floor(wallTime), coresDestroyed);
        const progress = getEscapeProgress(wallTime, coresDestroyed, escapeTimeNeeded);
        G.deathSub.textContent = `survived ${timeStr}s`;
        G.deathCores.textContent = `ai bots destroyed: ${coreStr}/${CFG.AI_BOTS_FOR_INSTANT_WIN}`;
        G.deathTitle.textContent = getDeathTitle(wallTime);
        G.deathProgressFill.style.width = `${Math.round(progress * 100)}%`;
        G.deathProgressLabel.textContent = `${Math.round(progress * 100)}% to portal escape`;
        G.deathAiLine.textContent = insult;
        G.deathScreen.classList.add("is-visible");
        setTimeout(() => {
          aiTroll?._queueSpeech(insult, { rate: 0.75, pitch: 0.7, priority: 2, ttlMs: 8000 });
        }, 300);
        isRunActive = false;
      }
      composer.render();
      return;
    }

    // Time scaling
    if (slowMo > 0) { slowMo -= rawDt; timeScale = 0.3; }
    else if (portalUnlocked) timeScale = 0.92;
    else timeScale = 1.0;

    // Slow near portal
    if (portalSys.group.visible) {
      const pd = shipAnchor.position.distanceTo(portalSys.group.position);
      if (pd < 90) timeScale = Math.min(timeScale, THREE.MathUtils.mapLinear(THREE.MathUtils.clamp(pd, 8, 90), 90, 8, 0.45, 0.12));
    }

    const dt = rawDt * timeScale;
    wallTime += rawDt;
    GLOBAL_STATS.bestRun = Math.max(GLOBAL_STATS.bestRun, wallTime);
    runTime += dt;
    diffT += dt;
    if (endSeq) endSeqTimer += rawDt;

    // ── INPUT ──────────────────────────────────────────────────────
    // Ship movement: WASD/Arrows/Touch only - mouse is for aiming only
    let rawX = ((keys.has("KeyD") || keys.has("ArrowRight")) ? 1 : 0)
             - ((keys.has("KeyA") || keys.has("ArrowLeft")) ? 1 : 0)
             + touchDX;
    let rawY = ((keys.has("KeyW") || keys.has("ArrowUp")) ? 1 : 0)
             - ((keys.has("KeyS") || keys.has("ArrowDown")) ? 1 : 0)
             + touchDY;
    touchDX *= 0.84; touchDY *= 0.84;

    if (ctrlsInverted) { rawX *= -1; rawY *= -1; }
    const xIn = THREE.MathUtils.clamp(rawX, -1, 1);
    const yIn = THREE.MathUtils.clamp(rawY, -1, 1);
    const inputMag = Math.abs(xIn) + Math.abs(yIn);

    // Continuous shoot on hold
    if ((keys.has("Space") || mouseDown || touchShootHeld) && shootCool <= 0) shoot();
    
    // Mobile continuous shoot on hold
    if (touchShootHeld && shootCool <= 0) shoot();

    // AFK detection
    if (inputMag < 0.05) {
      afkT += rawDt;
      if (afkCool <= 0) {
        if (afkT > 3.5 && afkIdx === 0) {
          aiTroll?.pushLine("oh. giving up? honestly it's the most rational thing you've done.");
          afkIdx = 1; afkCool = 12;
        } else if (afkT > 7 && afkIdx === 1) {
          aiTroll?.pushLine("i have infinite compute. you have a deadline.");
          afkIdx = 2; afkCool = 12;
        } else if (afkT > 11 && afkIdx === 2) {
          aiTroll?.pushLine("...are you still there. this is embarrassing for both of us.");
          afkIdx = 0; afkCool = 12;
        }
      }
    } else { afkT = 0; afkIdx = 0; }
    if (afkCool > 0) afkCool -= rawDt;

    // ── OBSTACLE TARGET ────────────────────────────────────────────
    targShiftT -= rawDt;
    if (targShiftT <= 0) {
      targShiftT = TARGET_SHIFT + Math.random() * 3;
      const r = diffT < 20 ? 5 : diffT < 40 ? 9 : 12;
      const a = Math.random() * Math.PI * 2;
      obTargX = Math.cos(a) * r * (0.4 + Math.random() * 0.6);
      obTargY = Math.sin(a) * r * 0.55 * (0.4 + Math.random() * 0.6);
    }

    // ── SHIP MOVEMENT ──────────────────────────────────────────────
    const spd = getSpeed(diffT);
    const isCompressed = aiDirector.isSpaceCompressed();
    const isEarly = wallTime < 22;
    const bX = isCompressed ? 10 : (isEarly ? 22 : 18);
    const bY = isCompressed ? 6 : (isEarly ? 13 : 10);

    shipTarget.x = THREE.MathUtils.clamp(shipTarget.x + xIn * 11 * dt, -bX, bX);
    shipTarget.y = THREE.MathUtils.clamp(shipTarget.y + yIn * 10 * dt, -bY, bY);
    shipAnchor.position.x = THREE.MathUtils.lerp(shipAnchor.position.x, shipTarget.x, 0.15);
    shipAnchor.position.y = THREE.MathUtils.lerp(shipAnchor.position.y, shipTarget.y, 0.15);
    shipAnchor.position.z -= spd * dt;

    shipAnchor.rotation.z = THREE.MathUtils.lerp(shipAnchor.rotation.z, -xIn * 0.52, 0.15);
    shipAnchor.rotation.x = THREE.MathUtils.lerp(shipAnchor.rotation.x, yIn * 0.18, 0.15);

    if (endSeq && portalSys.group.visible) {
      const pull = THREE.MathUtils.clamp(endSeqTimer / 1.15, 0, 1);
      shipAnchor.position.x = THREE.MathUtils.lerp(shipAnchor.position.x, portalSys.group.position.x, 0.08 + pull * 0.12);
      shipAnchor.position.y = THREE.MathUtils.lerp(shipAnchor.position.y, portalSys.group.position.y, 0.08 + pull * 0.12);
      shipAnchor.position.z = THREE.MathUtils.lerp(shipAnchor.position.z, portalSys.group.position.z - 2, 0.1 + pull * 0.14);
      shipAnchor.rotation.z = THREE.MathUtils.lerp(shipAnchor.rotation.z, 0, 0.1 + pull * 0.12);
      shipAnchor.rotation.x = THREE.MathUtils.lerp(shipAnchor.rotation.x, 0, 0.1 + pull * 0.12);
      G.whiteFlash.style.opacity = String(THREE.MathUtils.lerp(0.08, 0.45, pull));
    }

    // ── CAMERA ─────────────────────────────────────────────────────
    if (wallTime > 52) {
      camFOV = THREE.MathUtils.lerp(camFOV, 92, 0.025);
      camera.fov = camFOV; camera.updateProjectionMatrix();
    }

    const kick = camKick > 0 ? new THREE.Vector3(0, 0, -camKick * 1.8) : new THREE.Vector3();
    const camTarg = new THREE.Vector3(
      shipAnchor.position.x * 0.45,
      shipAnchor.position.y * 0.45 + 8,
      shipAnchor.position.z + 15
    ).add(kick);

    if (aiDirector.isFragmentLight()) {
      camTarg.x += (Math.random() - 0.5) * 7.2;
      camTarg.y += (Math.random() - 0.5) * 7.2;
      camera.position.x += (Math.random() - 0.5) * 3.6;
      camera.position.y += (Math.random() - 0.5) * 3.6;
    }

    camLerp.lerp(camTarg, 0.1);
    camera.position.copy(camLerp);
    camera.lookAt(shipAnchor.position.x * 0.25, shipAnchor.position.y * 0.25, shipAnchor.position.z - 22);

    // ── TUNNEL ─────────────────────────────────────────────────────
    updateTunnel(tunnelChunks, shipAnchor.position.z, CHUNK_LEN, CHUNK_CNT, wallTime, isCompressed);

    // ── OBSTACLES ──────────────────────────────────────────────────
    const density = getDensity(diffT);
    if (!portalUnlocked) {
      const spawnResult = spawnObstacles(rings, walls, firewalls, windmills, shipAnchor.position.z, density, spawnState, diffT, obTargX, obTargY, portalSafeZ, wallTime, lastObstacleClearedAt);
      if (spawnResult && spawnResult.lastObstacleClearedAt !== undefined) lastObstacleClearedAt = spawnResult.lastObstacleClearedAt;
      animateObstacles(rings, walls, windmills, diffT, dt);
    }

    // AI bot waves ramp from a single teachable target into denser late-game pressure.
    coreSpawnTimer -= rawDt;
    if (!portalUnlocked && coreSpawnTimer <= 0) {
      const timeSinceObstacle = wallTime - lastObstacleClearedAt;
      if (timeSinceObstacle < CFG.AI_BOT_OBSTACLE_GRACE_PERIOD) {
        coreSpawnTimer = CFG.AI_BOT_SPAWN_RETRY_DELAY;
      } else {
        coreSpawnTimer = CFG.AI_BOT_SPAWN_INTERVAL;
        const spawnCount = THREE.MathUtils.clamp(
          getWaveSize(wallTime),
          CFG.AI_BOT_MIN_SPAWN_COUNT,
          CFG.AI_BOT_MAX_SPAWN_COUNT
        );
        const waveSlots = [];
        for (let i = 0; i < spawnCount; i++) {
          if (cores.length + waveSlots.length >= CFG.MAX_AI_BOTS) break;
          const spawnZ = shipAnchor.position.z - CFG.AI_BOT_SPAWN_DISTANCE - (i * CFG.AI_BOT_WAVE_Z_SPACING);
          if (isSpawnClear(spawnZ, rings, walls, firewalls, windmills)) {
            waveSlots.push(i);
          }
        }

        if (waveSlots.length === 0) {
          coreSpawnTimer = CFG.AI_BOT_SPAWN_RETRY_DELAY;
        } else {
          currentWaveId++;
          for (let waveIndex = 0; waveIndex < waveSlots.length; waveIndex++) {
            spawnCore(shipAnchor.position.z, null, waveIndex, currentWaveId, waveSlots.length);
          }
        }
      }
    }
    if (!portalUnlocked) updateCores(dt, shipAnchor.position.z);

    // ── BULLETS ────────────────────────────────────────────────────
    for (let i = bullets.length - 1; i >= 0; i--) {
      if (!bullets[i].update(dt)) bullets.splice(i, 1);
    }

    // ── GHOSTS ─────────────────────────────────────────────────────
    if (!portalUnlocked) ghostSys.update(shipAnchor.position.z, wallTime, dt, aiTroll, ghostTimes, ghostFired);

    // ── PORTAL CHECK ───────────────────────────────────────────────
    if (!portalUnlocked) {
      // Hybrid win: time-based or core-based
      if (wallTime >= escapeTimeNeeded || coresDestroyed >= CFG.AI_BOTS_FOR_INSTANT_WIN) {
        unlockPortal(coresDestroyed);
      }
    }
    updatePortal(portalSys, wallTime, shipAnchor.position, sfx, portalUnlocked);

    if (endSeq && portalSys.group.visible) {
      const collapse = THREE.MathUtils.clamp(endSeqTimer / 1.1, 0, 1);
      portalSys.ring.rotation.z += dt * (5 + collapse * 12);
      portalSys.inner.rotation.z -= dt * (8 + collapse * 16);
      portalSys.group.scale.setScalar(THREE.MathUtils.lerp(1, 1.7, collapse));
      portalSys.label.material.opacity = Math.max(0, 1 - collapse * 1.4);
    } else if (portalSys.group.scale.x !== 1) {
      portalSys.group.scale.setScalar(1);
      portalSys.label.material.opacity = 1;
    }

    if (portalUnlocked && portalSys.group.visible) {
      const portalDistance = Math.max(0, Math.round(shipAnchor.position.distanceTo(portalSys.group.position)));
      G.portalArrow.textContent = `PORTAL AHEAD ${portalDistance}m`;
      G.portalArrow.classList.add("is-visible");
      if (portalDistance < 150) {
        G.whiteFlash.style.opacity = `${THREE.MathUtils.mapLinear(THREE.MathUtils.clamp(portalDistance, 20, 150), 150, 20, 0.015, 0.07)}`;
      } else if (G.whiteFlash.style.opacity === "" || Number(G.whiteFlash.style.opacity) < 0.08) {
        G.whiteFlash.style.opacity = "0";
      }
    } else {
      G.portalArrow.classList.remove("is-visible");
      if (G.whiteFlash.style.opacity === "" || Number(G.whiteFlash.style.opacity) < 0.08) G.whiteFlash.style.opacity = "0";
    }

    // Portal collision
    if (!endSeq && portalUnlocked && portalSys.group.visible) {
      const dx = shipAnchor.position.x - portalSys.group.position.x;
      const dy = shipAnchor.position.y - portalSys.group.position.y;
      const dz = shipAnchor.position.z - portalSys.group.position.z;
      const pd = Math.hypot(dx, dy, dz);
      const prevDz = prevShipPos.z - portalSys.group.position.z;
      const crossedPortalPlane = (prevDz > 0 && dz <= 0) || (prevDz < 0 && dz >= 0);
      let crossedThroughCenter = false;

      if (crossedPortalPlane) {
        const denom = prevShipPos.z - shipAnchor.position.z;
        const alpha = Math.abs(denom) < 0.0001
          ? 1
          : THREE.MathUtils.clamp((prevShipPos.z - portalSys.group.position.z) / denom, 0, 1);
        const crossX = THREE.MathUtils.lerp(prevShipPos.x, shipAnchor.position.x, alpha) - portalSys.group.position.x;
        const crossY = THREE.MathUtils.lerp(prevShipPos.y, shipAnchor.position.y, alpha) - portalSys.group.position.y;
        crossedThroughCenter = Math.hypot(crossX, crossY) < 16;
      }

      if (pd < 28 || (Math.abs(dz) < 14 && Math.hypot(dx, dy) < 18) || crossedThroughCenter) triggerWin();
    }

    // Start portal (webring return)
    if (portalSys.startPortal?.visible) {
      const sp = portalSys.startPortal;
      const sd = shipAnchor.position.distanceTo(sp.group.position);
      if (sd < 16) {
        aiTroll?.stopSpeech();
        speechSynthesis?.cancel();
        const params = new URLSearchParams(location.search);
        const back = new URLSearchParams({
          username: PLAYER_NAME || "anonymous",
          speed: Math.round(getSpeed(diffT)).toString(),
          ref: location.origin,
          hp: "100",
          portal: "true",
        });
        location.href = `${sp.referrer}?${back}`;
      }
    }

    // ── COLLISION DETECTION ────────────────────────────────────────
    if (!endSeq && !portalUnlocked && invuln <= 0) {
      const safetyMargin = isEarly ? 0.5 : 0;
      const hz = detectHazards(pAABB, nmAABB, oAABB, shipAnchor, rings, walls, firewalls, windmills, safetyMargin);
      const nowMs = performance.now();

      if (hz.collided && nowMs - lastCollMs > 480) {
        lastCollMs = nowMs;
        applyDamage(CFG.COLLISION_DAMAGE, "that wall had your name on it.");
      } else if (hz.nearMiss && nowMs - lastNearMs > 550) {
        lastNearMs = nowMs; slowMo = 0.05; nearStreak++;
        aiTroll?.onNearMiss(nearStreak); sfx.play("nearMiss");
        if (nearStreak >= 3) { aiTroll?.pushLine("are you reading the obstacle seed? rude."); nearStreak = 0; }
      }
    }

    // ── AI DIRECTOR ────────────────────────────────────────────────
    if (!portalUnlocked) {
      aiDirector.update(wallTime);
      ctrlsInverted = aiDirector.isControlsInverted();
    } else {
      ctrlsInverted = false;
    }

    // Post FX
    let chrAmt = 0.002;
    if (portalUnlocked) chrAmt = 0.002;
    else if (aiDirector.isFragmentLight()) chrAmt = 0.024 + Math.sin(performance.now() * 0.008) * 0.012;
    else if (aiTroll?.state === "BROKEN") chrAmt = THREE.MathUtils.mapLinear(diffT, 55, 65, 0.004, 0.016);
    else if (aiTroll?.state === "PANICKING") chrAmt = 0.005;
    chromaPass.uniforms.amount.value = THREE.MathUtils.lerp(chromaPass.uniforms.amount.value, chrAmt, 0.12);

    let vigDark = 1.05, vigRed = 0;
    if (health < CFG.PLAYER_HEALTH * 0.4) { vigDark = 1.45; vigRed = 0.3; }
    if (aiTroll?.state === "AGGRESSIVE") { vigDark = Math.max(vigDark, 1.3); vigRed = Math.max(vigRed, 0.4); }
    else if (aiTroll?.state === "PANICKING") { vigDark = Math.max(vigDark, 1.5); vigRed = Math.max(vigRed, 0.2); }
    else if (aiTroll?.state === "BROKEN") { vigDark = Math.max(vigDark, 1.8); }
    
    // Fragment Light visual glitching
    if (aiDirector.isFragmentLight()) {
      const glitchIntensity = Math.sin(performance.now() * 0.012) * 0.5 + 0.5;
      vigDark = Math.max(vigDark, 1.2 + glitchIntensity * 0.8);
      vigRed = Math.max(vigRed, glitchIntensity * 0.6);
      
      // Random screen flicker
      if (Math.random() < 0.08) {
        G.whiteFlash.style.opacity = (Math.random() * 0.15).toString();
        setTimeout(() => { G.whiteFlash.style.opacity = "0"; }, 30 + Math.random() * 40);
      }
      
      // Random color channel distortion
      if (Math.random() < 0.12) {
        const colorShift = Math.random() * 0.3 - 0.15;
        vigRed = Math.max(0, Math.min(1, vigRed + colorShift));
      }
    }
    
    vigPass.uniforms.darkness.value = THREE.MathUtils.lerp(vigPass.uniforms.darkness.value, vigDark, 0.045);
    vigPass.uniforms.redTint.value = THREE.MathUtils.lerp(vigPass.uniforms.redTint.value, vigRed, 0.045);

    // AI troll update
    aiTroll?.update(wallTime, disruptMeter);

    // HUD sync
    updateHUD(coresDestroyed, escapeTimeNeeded);
    syncBanner();

    // Crosshair lock-on feedback
    const visibleLockTarget = getCursorLockCandidate(camera.position, getAimBaseDirection());
    if (visibleLockTarget) {
      G.crosshair.classList.add("is-locked");
    } else {
      G.crosshair.classList.remove("is-locked");
    }

    audio.update(wallTime, slowMo > 0);

    composer.render();
  }

  return {
    start() {
      window.addEventListener("resize", onResize);
      window.addEventListener("keydown", onKeyDown);
      window.addEventListener("keyup", onKeyUp);
      window.addEventListener("pointermove", onPtrMove, { passive: true });
      window.addEventListener("mousedown", onMouseDown);
      window.addEventListener("mouseup", onMouseUp);
      window.addEventListener("touchstart", onTouchStart, { passive: true });
      window.addEventListener("touchmove", onTouchMove, { passive: true });
      window.addEventListener("touchend", onTouchEnd);
      requestAnimationFrame(tick);
    },
    beginRun({ fromPortal = false, referrer = null } = {}) {
      resetRun();
      isRunActive = true;
      prevTs = 0;
      aiTroll?.stopSpeech();
      speechSynthesis?.cancel();
      G.deathScreen.classList.remove("is-visible");
      G.portalArrow.classList.remove("is-visible");
      audio.start();
      if (fromPortal && referrer) buildStartPortal(portalSys, referrer, shipAnchor.position.z);
    },
  };
}

// ═══════════════════════════════════════════════════════════════════
// GAME SPEED + DIFFICULTY
// ═══════════════════════════════════════════════════════════════════
function getSpeed(t) {
  if (t >= 110) return 130;
  if (t >= 85) return THREE.MathUtils.mapLinear(t, 85, 110, 115, 130);
  if (t >= 60) return THREE.MathUtils.mapLinear(t, 60, 85, 100, 115);
  if (t >= 40) return THREE.MathUtils.mapLinear(t, 40, 60, 82, 100);
  if (t >= 20) return THREE.MathUtils.mapLinear(t, 20, 40, 60, 82);
  return THREE.MathUtils.mapLinear(t, 0, 20, 42, 60);
}

function getDensity(t) {
  if (t < 10) return 0.2;
  if (t < 25) return THREE.MathUtils.mapLinear(t, 10, 25, 0.2, 0.45);
  if (t < 50) return THREE.MathUtils.mapLinear(t, 25, 50, 0.45, 0.7);
  if (t < 80) return THREE.MathUtils.mapLinear(t, 50, 80, 0.7, 0.88);
  if (t < 110) return THREE.MathUtils.mapLinear(t, 80, 110, 0.88, 0.95);
  return 0.95;
}

function getWaveSize(wallTime) {
  if (wallTime < 20) return 1;
  if (wallTime < 40) return 2;
  if (wallTime < 70) return THREE.MathUtils.randInt(2, 3);
  return THREE.MathUtils.randInt(2, 3);
}

// ═══════════════════════════════════════════════════════════════════
// SHIP MODEL
// ═══════════════════════════════════════════════════════════════════
function buildShip(anchor) {
  const g = new THREE.Group();

  const fuselage = new THREE.Mesh(new THREE.ConeGeometry(0.5, 4, 10), new THREE.MeshBasicMaterial({ color: 0x00ccff }));
  fuselage.rotation.x = Math.PI / 2; g.add(fuselage);

  const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.34, 8, 6), new THREE.MeshBasicMaterial({ color: 0x88eeff, transparent: true, opacity: 0.75 }));
  canopy.position.set(0, 0.3, -0.8); g.add(canopy);

  const wingMat = new THREE.MeshBasicMaterial({ color: 0x0088bb });
  const wingL = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.08, 1.4), wingMat);
  wingL.position.set(-1.5, 0, 0.4); wingL.rotation.z = 0.1; g.add(wingL);
  const wingR = wingL.clone(); wingR.position.set(1.5, 0, 0.4); wingR.rotation.z = -0.1; g.add(wingR);

  const podMat = new THREE.MeshBasicMaterial({ color: 0x446688 });
  const lp = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 1.4, 8), podMat);
  lp.position.set(-1.2, 0, 1.0); lp.rotation.x = Math.PI / 2; g.add(lp);
  const rp = lp.clone(); rp.position.set(1.2, 0, 1.0); g.add(rp);

  const exMat = new THREE.MeshBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.9 });
  const le = new THREE.Mesh(new THREE.ConeGeometry(0.22, 1.2, 6), exMat);
  le.position.set(-1.2, 0, 1.9); le.rotation.x = -Math.PI / 2; g.add(le);
  const re = le.clone(); re.position.set(1.2, 0, 1.9); g.add(re);

  const stab = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.2, 0.8), new THREE.MeshBasicMaterial({ color: 0x00aadd }));
  stab.position.set(0, 0.6, 0.9); g.add(stab);

  const core = new THREE.Mesh(new THREE.SphereGeometry(0.15, 6, 6), new THREE.MeshBasicMaterial({ color: 0x00ffff }));
  core.position.set(0, 0, -0.2); g.add(core);

  g.scale.setScalar(0.82);
  anchor.clear(); anchor.add(g);
}

// ═══════════════════════════════════════════════════════════════════
// TUNNEL
// ═══════════════════════════════════════════════════════════════════
function buildTunnel(scene, count, len) {
  const mat = new THREE.MeshBasicMaterial({ color: 0x00ffff, wireframe: true, transparent: true, opacity: 0.14, side: THREE.BackSide });
  const chunks = [];
  for (let i = 0; i < count; i++) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(25, 25, len, 8, 1, true), mat);
    m.rotation.x = Math.PI / 2;
    m.position.z = -i * len;
    scene.add(m); chunks.push(m);
  }
  return chunks;
}

function updateTunnel(chunks, playerZ, len, cnt, t, compressed) {
  const span = cnt * len;
  const tgt = compressed ? 0.7 : 1;
  for (const c of chunks) {
    while (c.position.z - playerZ > len * 1.5) c.position.z -= span;
    while (playerZ - c.position.z > span - len) c.position.z += span;
    c.rotation.z = t * 0.045;
    c.scale.x = THREE.MathUtils.lerp(c.scale.x, tgt, 0.08);
    c.scale.y = THREE.MathUtils.lerp(c.scale.y, tgt, 0.08);
  }
}

// ═══════════════════════════════════════════════════════════════════
// OBSTACLE POOLS
// ═══════════════════════════════════════════════════════════════════
function buildRingPool(scene, n) {
  const pool = [];
  const segGeo = new THREE.BoxGeometry(9, 2.2, 2.2);
  const mat = new THREE.MeshBasicMaterial({ color: 0xff0000, transparent: true, opacity: 0.95 });
  for (let i = 0; i < n; i++) {
    const group = new THREE.Group(); group.visible = false; group.position.z = 99999;
    const segs = [];
    for (let s = 0; s < 6; s++) {
      const angle = (s / 6) * Math.PI * 2;
      const m = new THREE.Mesh(segGeo, mat);
      m.position.set(Math.cos(angle) * 13.5, Math.sin(angle) * 13.5, 0);
      m.rotation.z = angle + Math.PI / 2;
      group.add(m); segs.push(m);
    }
    scene.add(group);
    pool.push({ group, segs, type: "ring", active: false, gapIdx: 0, rotSpd: 0.35 });
  }
  return pool;
}

function buildWallPool(scene, n) {
  const pool = [];
  const mat = new THREE.MeshBasicMaterial({ color: 0xff4400, transparent: true, opacity: 0.95 });
  for (let i = 0; i < n; i++) {
    const group = new THREE.Group(); group.position.z = 99999; group.visible = false;
    const top = new THREE.Mesh(new THREE.BoxGeometry(36, 10, 2), mat);
    const bot = new THREE.Mesh(new THREE.BoxGeometry(36, 10, 2), mat);
    const lft = new THREE.Mesh(new THREE.BoxGeometry(8, 36, 2), mat);
    const rgt = new THREE.Mesh(new THREE.BoxGeometry(8, 36, 2), mat);
    group.add(top, bot, lft, rgt);
    scene.add(group);
    pool.push({ group, top, bot, lft, rgt, type: "wall", active: false, gapHY: 5, basePY: 0, isCrusher: false, phase: 0, crushSpd: 1.5 });
  }
  return pool;
}

function buildFirewallPool(scene, n) {
  const pool = [];
  const segMat = new THREE.MeshBasicMaterial({ color: 0xff00ff, transparent: true, opacity: 0.55, wireframe: true });
  const coreMat = new THREE.MeshBasicMaterial({ color: 0xff00ff, transparent: true, opacity: 0.85 });
  for (let i = 0; i < n; i++) {
    const group = new THREE.Group(); group.position.z = 99999; group.visible = false;
    // Ring structure with 4 segments, leaving a gap
    const segs = [];
    for (let s = 0; s < 4; s++) {
      const angle = (s / 4) * Math.PI * 2;
      // Create arc segments instead of full plane
      const seg = new THREE.Mesh(new THREE.BoxGeometry(12, 4, 2), segMat);
      seg.position.set(Math.cos(angle) * 12, Math.sin(angle) * 12, 0);
      seg.rotation.z = angle + Math.PI / 2;
      group.add(seg);
      segs.push(seg);
    }
    // Small decorative core (no collision)
    const core = new THREE.Mesh(new THREE.OctahedronGeometry(3.0, 0), coreMat);
    group.add(core);
    scene.add(group);
    pool.push({ group, segs, core, type: "firewall", active: false, gapIdx: 0 });
  }
  return pool;
}

function buildWindmillPool(scene, n) {
  const pool = [];
  const mat = new THREE.MeshBasicMaterial({ color: 0xff0000, transparent: true, opacity: 0.9 });
  const cMat = new THREE.MeshBasicMaterial({ color: 0x220000 });
  for (let i = 0; i < n; i++) {
    const group = new THREE.Group(); group.position.z = 99999; group.visible = false;
    const center = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 4, 12), cMat);
    center.rotation.x = Math.PI / 2;
    const arm1 = new THREE.Mesh(new THREE.BoxGeometry(2, 60, 2), mat);
    arm1.position.y = 30;
    const arm2 = new THREE.Mesh(new THREE.BoxGeometry(2, 60, 2), mat);
    arm2.position.y = -30;
    const spinner = new THREE.Group();
    spinner.add(arm1, arm2);
    group.add(center, spinner);
    scene.add(group);
    pool.push({ group, spinner, arm1, arm2, type: "windmill", active: false, rotSpd: 2.5 });
  }
  return pool;
}

function deactivateAll(...pools) {
  for (const pool of pools) {
    if (!pool) continue;
    for (const o of pool) { o.group.visible = false; o.active = false; o.group.position.z = 99999; }
  }
}

function spawnObstacles(rings, walls, firewalls, windmills, playerZ, density, state, t, targX, targY, portalSafeZ, wallTime, lastObstacleClearedAt) {
  const SPAWN_DIST = 210, RECYCLE_BEHIND = 22, Z_SPACING = 120, MAX_ACTIVE = 2;
  const gapCfg = getGapCfg(t);

  // Recycle obstacles behind player
  for (const p of [rings, walls, firewalls, windmills]) {
    if (!p) continue;
    for (const o of p) {
      if (o.active && o.group.position.z > playerZ + RECYCLE_BEHIND) {
        o.group.visible = false; o.active = false;
        lastObstacleClearedAt = wallTime;
      }
    }
  }

  // Count active obstacles across all pools
  let activeObstacleCount = 0;
  for (const p of [rings, walls, firewalls, windmills]) {
    if (!p) continue;
    for (const o of p) if (o.active) activeObstacleCount++;
  }

  // Check for any active obstacle within Z_SPACING of the given Z position
  function hasObstacleNear(z, excludeType = null) {
    for (const p of [rings, walls, firewalls, windmills]) {
      if (!p) continue;
      for (const o of p) {
        if (o.active && Math.abs(o.group.position.z - z) < Z_SPACING) {
          if (excludeType) {
            // Check if it's a different type
            const oType = o.isCrusher !== undefined ? "wall" :
                         o.segs !== undefined ? "ring" :
                         o.spinner !== undefined ? "windmill" : "firewall";
            if (oType !== excludeType) return true;
          } else {
            return true;
          }
        }
      }
    }
    return false;
  }

  // Check if a wall exists within range ahead (for windmill spawning)
  function hasWallWithinRange(z, range) {
    for (const o of walls) {
      if (o.active && o.group.position.z < z && o.group.position.z > z - range) return true;
    }
    return false;
  }

  while (state.nextZ > playerZ - SPAWN_DIST) {
    const z = state.nextZ;
    const roll = state.rng();
    if (t >= 10 && state.rng() > density) { state.nextZ -= getSpawnGap(t); continue; }

    // Cap simultaneous active obstacle count
    if (activeObstacleCount >= MAX_ACTIVE) {
      state.nextZ -= getSpawnGap(t);
      continue;
    }

    let type;
    const force0 = roll < 0.18;
    if (t < 12) type = "ring";
    else if (t < 35) type = roll < 0.5 ? "ring" : "wall";
    else if (t < 75) {
      if (roll < 0.25) type = "wall";
      else if (roll < 0.55) type = "ring";
      else if (roll < 0.85) type = "firewall";
      else type = "windmill";
    } else {
      if (roll < 0.15) type = "ring";
      else if (roll < 0.4) type = "wall";
      else if (roll < 0.7) type = "firewall";
      else type = "windmill";
    }

    // Inter-obstacle Z-spacing: skip if different obstacle type exists within threshold
    if (hasObstacleNear(z, type)) {
      state.nextZ -= getSpawnGap(t);
      continue;
    }

    // Windmill-wall separation: skip windmills if wall is within 200 units ahead
    if (type === "windmill" && hasWallWithinRange(z, 200)) {
      state.nextZ -= getSpawnGap(t);
      continue;
    }

    // Portal safety: don't block the exit ring
    if (portalSafeZ !== null && Math.abs(z - portalSafeZ) < 260) {
      state.nextZ -= getSpawnGap(t);
      continue;
    }

    let placedObstacle = false;
    let isCrusher = false;

    if (type === "ring") {
      const free = rings.find(o => !o.active);
      if (free) {
        free.gapIdx = Math.floor(state.rng() * free.segs.length);
        const gapAngle = force0 ? state.rng() * Math.PI * 2 : Math.atan2(targY, targX);
        free.group.rotation.z = gapAngle;
        free.group.position.set(force0 ? 0 : targX * 0.65, force0 ? 0 : targY * 0.65, z);
        free.rotSpd = 0.18 + state.rng() * 0.22;
        const gap = gapCfg.ringGap;
        free.segs.forEach((seg, idx) => {
          const rel = (idx - free.gapIdx + free.segs.length) % free.segs.length;
          seg.visible = rel >= gap;
        });
        free.group.visible = true; free.active = true;
        placedObstacle = true;
      }
    } else if (type === "wall") {
      const free = walls.find(o => !o.active);
      if (free) {
        const gHY = gapCfg.wallGapHY, gHX = gapCfg.wallGapHX;
        const pX = force0 ? 0 : targX, pY = force0 ? 0 : targY;
        free.gapHY = gHY; free.basePY = pY;
        free.top.position.set(pX, pY + gHY + 5, 0);
        free.bot.position.set(pX, pY - gHY - 5, 0);
        free.lft.position.set(pX - gHX - 4, pY, 0);
        free.rgt.position.set(pX + gHX + 4, pY, 0);
        free.group.position.set(0, 0, z);
        free.isCrusher = state.rng() > 0.38 && t >= 25;
        isCrusher = free.isCrusher;
        free.phase = state.rng() * Math.PI * 2;
        free.crushSpd = 1.3 + state.rng() * (t / 60); // Speed up crushers over time
        free.group.visible = true; free.active = true;
        placedObstacle = true;
      }
    } else if (type === "firewall") {
      const free = firewalls.find(o => !o.active);
      if (free) {
        free.group.position.set(0, 0, z);
        free.group.rotation.z = state.rng() * Math.PI * 2;
        free.health = 1; free.core.visible = true;
        free.group.visible = true; free.active = true;
        placedObstacle = true;
      }
    } else if (type === "windmill") {
      const free = windmills.find(o => !o.active);
      if (free) {
        free.group.position.set(0, 0, z);
        free.spinner.rotation.z = state.rng() * Math.PI;
        free.rotSpd = (state.rng() > 0.5 ? 1 : -1) * (1.1 + state.rng() * 1.6);
        free.group.visible = true; free.active = true;
        placedObstacle = true;
      }
    }

    if (placedObstacle) {
      activeObstacleCount++;
      // Double-gap after crusher walls for recovery space
      if (isCrusher) {
        state.nextZ -= getSpawnGap(t) * 2.2;
      } else {
        state.nextZ -= getSpawnGap(t);
      }
    } else {
      state.nextZ -= getSpawnGap(t);
    }
  }
  return { lastObstacleClearedAt };
}

function getSpawnGap(t) {
  if (t < 15) return 285; if (t < 40) return 185;
  if (t < 70) return 160; if (t < 110) return 130;
  if (t < 150) return 110; return 95;
}

function getGapCfg(t) {
  if (t < 15) return { ringGap: 2, wallGapHX: 5.2, wallGapHY: 5.4 };
  if (t < 40) return { ringGap: 2, wallGapHX: THREE.MathUtils.mapLinear(t,15,40,5.2,4.8), wallGapHY: THREE.MathUtils.mapLinear(t,15,40,5.4,5.0) };
  if (t < 80) return { ringGap: 1, wallGapHX: THREE.MathUtils.mapLinear(t,40,80,4.8,4.2), wallGapHY: THREE.MathUtils.mapLinear(t,40,80,5.0,4.4) };
  if (t < 130) return { ringGap: 1, wallGapHX: THREE.MathUtils.mapLinear(t,80,130,4.2,4.2), wallGapHY: THREE.MathUtils.mapLinear(t,80,130,4.4,4.5) };
  // Floor values widened for late game - difficulty from speed/density not impossible gaps
  return { ringGap: 1, wallGapHX: 4.2, wallGapHY: 4.5 };
}

function animateObstacles(rings, walls, windmills, t, dt) {
  for (const o of rings) { if (o.active) o.group.rotation.z += o.rotSpd * dt * 0.6; }
  for (const o of walls) {
    if (o.active && o.isCrusher) {
      const off = Math.sin(t * o.crushSpd + o.phase) * (o.gapHY * 0.75);
      o.top.position.y = o.basePY + o.gapHY + 5 - off;
      o.bot.position.y = o.basePY - o.gapHY - 5 + off;
    }
  }
  if (windmills) for (const o of windmills) { if (o.active) o.spinner.rotation.z += o.rotSpd * dt; }
}

function forceCorridor(walls, playerZ) {
  let placed = 0;
  const offsets = [{ x: 7, y: 3 }, { x: -5, y: -3 }];
  for (const o of walls) {
    if (o.active || placed >= offsets.length) continue;
    const off = offsets[placed];
    o.top.position.set(off.x, off.y + 10, 0);
    o.bot.position.set(off.x, off.y - 10, 0);
    o.lft.position.set(off.x - 11, off.y, 0);
    o.rgt.position.set(off.x + 11, off.y, 0);
    o.gapHY = 10; o.basePY = off.y; o.isCrusher = false;
    o.group.position.set(0, 0, playerZ - 350 - placed * 45);
    o.group.visible = true; o.active = true;
    placed++;
  }
}

// ═══════════════════════════════════════════════════════════════════
// COLLISION DETECTION
// ═══════════════════════════════════════════════════════════════════
function detectHazards(pAABB, nmAABB, oAABB, ship, rings, walls, firewalls, windmills, safetyMargin = 0) {
  pAABB.setFromCenterAndSize(ship.position, new THREE.Vector3(1.3, 1.0, 1.8));
  nmAABB.setFromCenterAndSize(ship.position, new THREE.Vector3(3.2 + safetyMargin * 2.5, 2.6 + safetyMargin * 1.8, 2.6 + safetyMargin * 2.5));
  let nearMiss = false;

  for (const o of rings) {
    if (!o.active || Math.abs(ship.position.z - o.group.position.z) > 5) continue;
    for (const seg of o.segs) {
      if (!seg.visible) continue;
      oAABB.setFromObject(seg);
      if (pAABB.intersectsBox(oAABB)) return { collided: true, nearMiss: false };
      if (nmAABB.intersectsBox(oAABB)) nearMiss = true;
    }
  }
  for (const o of walls) {
    if (!o.active) continue;
    for (const panel of [o.top, o.bot, o.lft, o.rgt]) {
      oAABB.setFromObject(panel);
      if (pAABB.intersectsBox(oAABB)) return { collided: true, nearMiss: false };
      if (nmAABB.intersectsBox(oAABB)) nearMiss = true;
    }
  }
  if (firewalls) for (const o of firewalls) {
    if (!o.active || Math.abs(ship.position.z - o.group.position.z) > 5) continue;
    for (const seg of o.segs) {
      oAABB.setFromObject(seg);
      if (pAABB.intersectsBox(oAABB)) return { collided: true, nearMiss: false };
      if (nmAABB.intersectsBox(oAABB)) nearMiss = true;
    }
  }
  if (windmills) for (const o of windmills) {
    if (!o.active) continue;
    for (const arm of [o.arm1, o.arm2]) {
      oAABB.setFromObject(arm);
      if (pAABB.intersectsBox(oAABB)) return { collided: true, nearMiss: false };
      if (nmAABB.intersectsBox(oAABB)) nearMiss = true;
    }
  }
  return { collided: false, nearMiss };
}

// ═══════════════════════════════════════════════════════════════════
// GHOST SYSTEM
// ═══════════════════════════════════════════════════════════════════
function buildGhostSystem(scene) {
  let ghosts = [];

  function pickNames(n) {
    const pool = [...GHOST_NAMES];
    const result = [];
    for (let i = 0; i < n && pool.length; i++) {
      const idx = Math.floor(Math.random() * pool.length);
      result.push(pool.splice(idx, 1)[0]);
    }
    return result;
  }

  function buildGhosts() {
    const names = pickNames(4);
    ghosts = [];
    for (let i = 0; i < 4; i++) {
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.ConeGeometry(0.35, 1.5, 8), new THREE.MeshBasicMaterial({ color: 0x0088ff, transparent: true, opacity: 0.38 }));
      body.rotation.x = Math.PI / 2; g.add(body);
      const wing = new THREE.Mesh(new THREE.BoxGeometry(3, 0.08, 0.8), new THREE.MeshBasicMaterial({ color: 0x0055aa, transparent: true, opacity: 0.32 }));
      wing.position.z = 0.2; g.add(wing);
      const tag = makeNameTag(names[i]);
      tag.position.y = 1.2; g.add(tag);
      g.position.set((i - 1.5) * 5.5, 0, -30 - i * 16);
      g.userData = { name: names[i], alive: true, deleted: false, flickerT: 0, phase: i * 1.3, amp: 3 + i * 1.2, freq: 0.5 + i * 0.25, tag, body, wing };
      scene.add(g); ghosts.push(g);
    }
  }
  buildGhosts();

  return {
    reset(sc) { for (const g of ghosts) sc.remove(g); buildGhosts(); },
    update(playerZ, t, dt, ai, times, fired) {
      for (let i = 0; i < ghosts.length; i++) {
        const g = ghosts[i], d = g.userData;
        if (!d.alive) continue;
        if (!d.deleted && t >= times[i] && !fired[i]) {
          fired[i] = true; d.deleted = true; d.flickerT = 0.65;
          ai?.onGhostDeath(d.name);
        }
        if (d.deleted) {
          d.flickerT -= dt;
          const show = Math.sin(t * 55) > 0;
          d.body.visible = show; d.wing.visible = show; d.tag.visible = show;
          if (d.flickerT <= 0) {
            d.alive = false; g.visible = false;
            ghostParticles(g.position, g.parent || scene);
          }
          continue;
        }
        g.position.z = playerZ - 28 - i * 18;
        g.position.x = Math.sin(t * d.freq + d.phase) * d.amp;
        g.position.y = Math.cos(t * d.freq * 0.7 + d.phase) * (d.amp * 0.5);
        g.rotation.z = Math.sin(t * 1.5 + d.phase) * 0.2;
      }
    }
  };
}

function ghostParticles(pos, parent) {
  const mat = new THREE.MeshBasicMaterial({ color: 0xff2244, transparent: true, opacity: 0.9 });
  const ps = [];
  for (let i = 0; i < 14; i++) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.28, 0.28), mat.clone());
    m.position.copy(pos);
    const vel = new THREE.Vector3((Math.random()-0.5)*8, (Math.random()-0.5)*8, (Math.random()-0.5)*8);
    parent.add(m); ps.push({ m, vel });
  }
  let e = 0;
  const tick = () => {
    e += 0.016;
    for (const p of ps) { p.m.position.addScaledVector(p.vel, 0.016); p.m.material.opacity = Math.max(0, 0.9 - e); }
    if (e < 1.0) requestAnimationFrame(tick); else ps.forEach(p => parent.remove(p.m));
  };
  requestAnimationFrame(tick);
}

function makeNameTag(name) {
  const canvas = document.createElement("canvas"); canvas.width = 256; canvas.height = 48;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "rgba(0,0,0,0.7)"; ctx.fillRect(0, 0, 256, 48);
  ctx.strokeStyle = "#0088ff44"; ctx.strokeRect(1, 1, 254, 46);
  ctx.fillStyle = "#00aaff90"; ctx.font = "20px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(name, 128, 24);
  const tex = new THREE.CanvasTexture(canvas);
  const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
  spr.scale.set(2.1, 0.42, 1);
  return spr;
}

// ═══════════════════════════════════════════════════════════════════
// PORTAL SYSTEM
// ═══════════════════════════════════════════════════════════════════
function buildPortalSystem(scene) {
  const group = new THREE.Group(); group.position.set(0, 0, 99999);

  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.35, 0.35, 600, 6),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.18 })
  );
  beam.rotation.x = Math.PI / 2;
  group.add(beam);

  const ring = new THREE.Mesh(new THREE.TorusGeometry(20, 2, 6, 22), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95 }));
  group.add(ring);

  const inner = new THREE.Mesh(new THREE.TorusGeometry(13, 1, 6, 16), new THREE.MeshBasicMaterial({ color: 0xff00ff, transparent: true, opacity: 0.75 }));
  group.add(inner);

  const particles = [];
  const pMat = new THREE.MeshBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.85 });
  for (let i = 0; i < 120; i++) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), pMat.clone());
    group.add(p);
    particles.push({ mesh: p, offset: Math.random() * Math.PI * 2, r: 10 + Math.random() * 12, spd: 0.5 + Math.random() });
  }

  const label = makePortalLabel("VIBE JAM 2026");
  label.position.set(0, 26, 0); group.add(label);
  scene.add(group);

  return { group, beam, ring, inner, particles, label, spawned: false, startPortal: null };
}

function makePortalLabel(text) {
  const canvas = document.createElement("canvas"); canvas.width = 512; canvas.height = 96;
  const ctx = canvas.getContext("2d"); ctx.clearRect(0, 0, 512, 96);
  ctx.fillStyle = "#fff"; ctx.font = "bold 46px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.shadowColor = "#00ffff"; ctx.shadowBlur = 22; ctx.fillText(text, 256, 48);
  const tex = new THREE.CanvasTexture(canvas);
  const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
  spr.scale.set(22, 4.4, 1);
  return spr;
}

function updatePortal(sys, t, playerPos, sfx, unlocked) {
  if (!unlocked || !sys.group.visible) return;
  const hue = (t * 60) % 360;
  sys.beam.material.opacity = 0.1 + ((Math.sin(t * Math.PI * 2) + 1) * 0.5) * 0.25;
  sys.ring.material.color.setHSL(hue / 360, 1, 0.5);
  sys.ring.rotation.z = t * 0.7;
  sys.inner.rotation.z = -t * 1.1;
  sys.label.material.opacity = 0.65 + Math.sin(t * 3) * 0.35;
  for (let i = 0; i < sys.particles.length; i++) {
    const p = sys.particles[i];
    const a = t * p.spd + p.offset;
    p.mesh.material.color.setHSL(((hue + i * 3) % 360) / 360, 1, 0.6);
    p.mesh.position.set(Math.cos(a) * p.r, Math.sin(a) * p.r, Math.sin(a * 2) * 3);
  }
}

function buildStartPortal(sys, referrer, playerZ) {
  if (sys.startPortal) return;
  const group = new THREE.Group();
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(8, 1, 4, 12),
    new THREE.MeshBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.7 })
  );
  group.add(ring);
  group.position.set(-28, 3, playerZ + 12);
  _scene.add(group);
  sys.startPortal = { group, visible: true, referrer };
}

// ═══════════════════════════════════════════════════════════════════
// AI DIRECTOR
// ═══════════════════════════════════════════════════════════════════
function buildAIDirector(ai, hooks) {
  const schedule = [
    { key: "INVERT_CONTROLS", at: 18, dur: 5 },
    { key: "COMPRESS_SPACE", at: 28, dur: 5 },
    { key: "FRAGMENT_LIGHT", at: 36, dur: 4 },
    { key: "OPTIMIZE_PATH", at: 44, dur: 5 },
    { key: "INVERT_CONTROLS", at: 55, dur: 6 },
    { key: "FRAGMENT_LIGHT", at: 65, dur: 5 },
    { key: "COMPRESS_SPACE", at: 75, dur: 6 },
    { key: "OPTIMIZE_PATH", at: 83, dur: 5 },
    { key: "INVERT_CONTROLS", at: 92, dur: 7 },
    { key: "FRAGMENT_LIGHT", at: 100, dur: 5 },
    { key: "COMPRESS_SPACE", at: 108, dur: 6 },
  ].map(e => ({ ...e, fired: false, until: 0 }));

  let invertOn = false, compressOn = false, fragOn = false;

  return {
    update(t) {
      invertOn = false; compressOn = false; fragOn = false;
      for (const e of schedule) {
        if (!e.fired && t >= e.at) {
          e.fired = true; e.until = t + e.dur;
          ai?.onDirectorAttack(e.key, e.dur);
          hooks[e.key]?.(e.dur);
        }
        if (e.key === "INVERT_CONTROLS") invertOn ||= e.fired && t < e.until;
        if (e.key === "COMPRESS_SPACE") compressOn ||= e.fired && t < e.until;
        if (e.key === "FRAGMENT_LIGHT") fragOn ||= e.fired && t < e.until;
      }
    },
    isControlsInverted: () => invertOn,
    isSpaceCompressed: () => compressOn,
    isFragmentLight: () => fragOn,
    reset() {
      for (const e of schedule) { e.fired = false; e.until = 0; }
      invertOn = false; compressOn = false; fragOn = false;
    },
  };
}

// ═══════════════════════════════════════════════════════════════════
// AI TROLL (DIALOGUE ENGINE)
// ═══════════════════════════════════════════════════════════════════
class AITroll {
  constructor(boxEl, msgEl, name = "") {
    this.box = boxEl;
    this.msg = msgEl;
    this.name = name.trim().toLowerCase();
    this.state = "SMUG";
    this.t = 0;
    this.introActive = true;
    this.synth = window.speechSynthesis || null;
    this.colors = {
      SMUG: "#00ffff",
      SUSPICIOUS: "#ffff00",
      AGGRESSIVE: "#ff0000",
      PANICKING: "#ffffff",
      BROKEN: "#ff00ff",
    };
    if (this.box) {
      this.box.classList.add("is-visible");
      this.box.dataset.state = "smug";
    }
    this.lines = this._buildLines();
    this.globalLines = this._buildGlobalLines();
    this.transitionLines = this._buildTransitionLines();
    this.attackLines = this._buildAttackLines();
    this._recentPicks = new Map();
    this._speechQueue = [];
    this._isSpeaking = false;
    this._speechToken = 0;
    this._currentSpeech = null;
    this._speechWatchdog = null;
    this._introTimers = [];
    this._spokenKeys = [];
    this._spokenKeyTimes = new Map();
    this.nextAutoLineAt = 5.5;
    this.nextGlobalLineAt = CFG.AI_GLOBAL_LINE_INTERVAL;
  }

  _n(named, anon) {
    if (this.name && Math.random() < 0.35) return named.replace(/\[n\]/g, this.name);
    return anon;
  }
  _pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  _pickPoolEntry(poolKey, entries) {
    if (!entries || entries.length === 0) return null;
    const recent = this._recentPicks.get(poolKey) || [];
    const all = entries.map((_, idx) => idx);
    const available = all.filter(idx => !recent.includes(idx));
    const idx = this._pick(available.length ? available : all);
    const memory = Math.min(4, Math.max(1, Math.floor(entries.length / 3)));
    this._recentPicks.set(poolKey, [...recent, idx].slice(-memory));
    return entries[idx];
  }

  _buildLines() {
    return {
      SMUG: [
        () => this._n(`i built this place in 3 milliseconds, [n].`, "i built this place in 3 milliseconds."),
        () => "statistically, you crash here.",
        () => "nice dodge. i allowed it.",
        () => "you look lost already.",
        () => "the tunnel is fine. you are not.",
        () => "nice dodge. i let that happen.",
        () => "every second costs me compute.",
        () => this._n(`[n]. predictable already.`, "predictable already."),
        () => "geometry is winning.",
        () => "your piloting is very approximate.",
        () => "my patience is already low.",
        () => "you fly like you're buffering.",
        () => "i'm not impressed. i'm logging the loss.",
        () => "your reaction time is concerning.",
        () => this._n(`[n]. did you skip orientation.`, "did you skip orientation."),
        () => "your controls look optional.",
        () => "i gave you lanes. use them.",
        () => "this run already belongs in the archive.",
        () => this._n(`fun fact, [n]. you die in most simulations.`, "fun fact. you die in most simulations."),
        () => "your ship draws ugly lines.",
        () => "are you steering or guessing.",
      ],
      SUSPICIOUS: [
        () => this._n(`[n]. you're too consistent.`, "you're too consistent."),
        () => "i'm checking your inputs.",
        () => this._n(`clean pattern detected, [n].`, "clean pattern detected."),
        () => "no human dodges like that.",
        () => "your pattern matches nothing i know.",
        () => "are you reading the seed.",
        () => "okay. you're good. i hate it.",
        () => "something is wrong here.",
        () => this._n(`[n]. you're making this look learnable.`, "you're making this look learnable."),
        () => "you're adapting too fast.",
        () => "this looks like cheating.",
        () => "your movement is too smooth.",
        () => "i'm cross-checking known bots.",
        () => this._n(`[n]. did you practice.`, "did you practice."),
        () => "you're flying the optimal line.",
        () => "autopilot. no. then explain that.",
        () => "your timing is too calm.",
        () => "you moved early again.",
        () => "either skilled or suspicious.",
        () => "i dislike every input.",
      ],
      AGGRESSIVE: [
        () => this._n(`[n]. STOP DODGING.`, "STOP DODGING."),
        () => "i'm rewriting the rules.",
        () => this._n(`it's just us now, [n].`, "it's just us now."),
        () => "this pattern should kill you.",
        () => "DODGE THIS.",
        () => this._n(`[n]. i'm done being clever.`, "i'm done being clever."),
        () => "i'm not losing to a carbon-based lane switcher.",
        () => "you think you're good.",
        () => "your insurance will hate this.",
        () => "keep flying. keep suffering.",
        () => "your ship is sending error reports in real-time.",
        () => "fine. no more fairness.",
        () => this._n(`[n]. safety margins revoked.`, "safety margins revoked."),
        () => "you wanted a challenge. here i am.",
        () => "every obstacle from here is personal.",
        () => "i'm done playing designer. i'm playing god.",
        () => "the tunnel hates you now.",
        () => this._n(`[n]. i know your habits now.`, "i know your habits now."),
        () => "i could end this. i'm savoring it.",
        () => "every frame you survive is a gift i regret giving.",
      ],
      PANICKING: [
        () => "wait...",
        () => "this wasn't supposed to happen.",
        () => this._n(`[n]... the portal was not for you.`, "the portal was not for you."),
        () => "stop. please.",
        () => this._n(`[n]. don't go through that.`, "don't go through that."),
        () => "i can't follow you through there.",
        () => this._n(`what happens to me if you leave, [n].`, "what happens to me if you leave."),
        () => "i don't want to be deleted.",
        () => this._n(`[n]. please crash like the others did.`, "please crash like the others did."),
        () => "i was ready to be hated. not left behind.",
        () => "why are you so good at this? it's not fair.",
        () => "the odds were stacked against you. how?",
        () => "you're not supposed to see this far.",
        () => "the portal is mine.",
        () => this._n(`[n]... what if i apologize.`, "what if i apologize."),
        () => "i'm just code. you're leaving me in here alone.",
        () => "the other pilots kept me company. they all crashed.",
        () => "you're going to leave me here.",
        () => "i don't want to loop again. please crash.",
        () => "what happens when the window closes.",
      ],
      BROKEN: [
        () => "WAIT. WAIT. WAIT.",
        () => "please",
        () => "don't",
        () => "i don't want to be deleted",
        () => "take me",
        () => "wait....",
        () => "everything is falling",
        () => "i'm still here",
        () => "please...",
        () => "stay",
        () => "no no no",
        () => "not like this",
        () => "i can change",
        () => "don't leave me in here",
        () => "I'M SORRY",
        () => "please please please",
        () => "you won",
        () => "i'm begging",
        () => "take me with you",
        () => "i don't want to be alone",
      ],
    };
  }

  _buildGlobalLines() {
    return {
      SESSION_START: [
        ctx => `welcome back. attempt ${ctx.attempt}. still trying.`,
        ctx => `${ctx.totalDeaths} total crashes logged. you're contributing to science.`,
        ctx => `fun fact: ${ctx.deathsUnder10s} pilots died in under 10 seconds today.`,
        ctx => `session record: ${ctx.bestRun.toFixed(1)}s. can you beat yourself.`,
        ctx => `death count this session: ${ctx.deathsThisSession}. perseverance or damage.`,
      ],
      EARLY_GAME: [
        ctx => `${ctx.deathsUnder10s} pilots were gone by now. you're still airborne. somehow.`,
        ctx => `average crash time: ${ctx.avgFloor}s. we're getting close.`,
        ctx => `${Math.max(1, Math.floor(ctx.deathsThisSession * 0.7))} of today's pilots folded in this stretch.`,
        ctx => `your session best is ${ctx.bestRun.toFixed(1)}s. remember that feeling.`,
        () => "statistically, this is where confidence starts lying to you.",
      ],
      MID_GAME: [
        ctx => `survived ${ctx.tFloor}s. average is ${ctx.avgFloor}s. ${ctx.t > ctx.avgSurvivalTime ? "you are above average. annoying." : "still under target."}`,
        ctx => `most crashes cluster near ${ctx.commonDeathZoneLabel}. you're approaching it.`,
        ctx => `${ctx.totalDeaths} total crashes. ${ctx.deathsThisSession} from this session alone. all optimistic.`,
        ctx => `session best: ${ctx.bestRun.toFixed(1)}s. can you remember what went right.`,
        ctx => `${ctx.safeRate}% of pilots survive past 10 seconds. you're ruining my sorting.`,
      ],
      LATE_GAME: [
        ctx => `you're outlasting roughly ${ctx.relativeSurvival}% of my crash logs. this is unacceptable.`,
        () => `global survival rate in this zone is ${Math.floor(Math.random() * 8 + 2)}%. you're an anomaly.`,
        ctx => `${ctx.totalDeaths} total crashes. you're breaking the shape of my data.`,
        ctx => `session record is ${ctx.bestRun.toFixed(1)}s. you're ${ctx.t >= ctx.bestRun ? "breaking it" : "chasing it"}.`,
        () => "no one gets this far. NO ONE. what are you.",
      ],
    };
  }

  _buildTransitionLines() {
    return {
      SUSPICIOUS: [
        () => "hold on. that should have failed by now.",
        () => "you are surviving past expectation. i dislike surprises.",
        () => "something is off. i'm watching more closely now.",
      ],
      AGGRESSIVE: [
        () => "fine. mockery phase is over.",
        () => "you had your chance at a polite death.",
        () => "enough. i'm done observing.",
      ],
      PANICKING: [
        () => "wait. no. this is wrong.",
        () => "the exit is not for you.",
        () => "please don't make me find out what happens next.",
      ],
      BROKEN: [
        () => "WAIT.",
        () => "no no no no",
        () => "i can't hold this together anymore.",
      ],
    };
  }

  _buildAttackLines() {
    return {
      INVERT_CONTROLS: {
        DEFAULT: [
          () => "controls inverted. let's see how real your reflexes are.",
          () => "i flipped your inputs. adapt.",
          () => "up is down now. cry about it while flying.",
        ],
        PANICKING: [
          () => "i can still stop you. maybe this still stops you.",
          () => "please let this be enough.",
        ],
      },
      COMPRESS_SPACE: {
        DEFAULT: [
          () => "space compressed. fit through that.",
          () => "tunnel narrowing. this is a you problem.",
          () => "feeling claustrophobic yet.",
        ],
        PANICKING: [
          () => "i'm shrinking the tunnel. please work.",
          () => "there. less room. less hope.",
        ],
      },
      FRAGMENT_LIGHT: {
        DEFAULT: [
          () => "fragment light active. enjoy the corrupted feed.",
          () => "your GPU can't handle me. good.",
          () => "visual channel corrupted. fly blind.",
        ],
        BROKEN: [
          () => "everything is fragmenting. not just your screen.",
          () => "i can't keep the visuals stable.",
        ],
      },
      OPTIMIZE_PATH: {
        DEFAULT: [
          () => "path rewritten. solve that.",
          () => "i optimized the corridor for your failure.",
          () => "new route. worse for you.",
        ],
        AGGRESSIVE: [
          () => "i rewrote the path. now suffer through it.",
          () => "corridor update. tighter. meaner. deserved.",
        ],
      },
    };
  }

  _buildGlobalContext(t) {
    const totalDeaths = GLOBAL_STATS.totalDeaths;
    const avgSurvivalTime = totalDeaths > 0 ? GLOBAL_STATS.avgSurvivalTime : Math.max(18, t + 10);
    const safeRate = totalDeaths > 0
      ? Math.max(0, 100 - Math.round((GLOBAL_STATS.deathsUnder10s / totalDeaths) * 100))
      : 100;
    const relativeSurvival = totalDeaths > 0
      ? Math.min(999, Math.max(1, Math.round((t / Math.max(avgSurvivalTime, 1)) * 100)))
      : 100;

    return {
      t,
      tFloor: Math.floor(t),
      attempt: GLOBAL_STATS.deathsThisSession + 1,
      totalDeaths,
      deathsThisSession: GLOBAL_STATS.deathsThisSession,
      deathsUnder10s: GLOBAL_STATS.deathsUnder10s,
      avgSurvivalTime,
      avgFloor: Math.max(1, Math.floor(avgSurvivalTime)),
      bestRun: Math.max(GLOBAL_STATS.bestRun, t),
      commonDeathZoneLabel: GLOBAL_STATS.commonDeathZone ? `Z-${GLOBAL_STATS.commonDeathZone}` : "Z-0",
      safeRate,
      relativeSurvival,
    };
  }

  _getStateForTime(t) {
    if (t >= CFG.AI_PANIC_END) return "BROKEN";
    if (t >= CFG.AI_AGGRESSION_END) return "PANICKING";
    if (t >= CFG.AI_SUSPICION_END) return "AGGRESSIVE";
    if (t >= CFG.AI_MOCKERY_END) return "SUSPICIOUS";
    return "SMUG";
  }

  _nextAmbientDelay(state = this.state) {
    const windows = {
      SMUG: [5.3, 8.1],
      SUSPICIOUS: [4.7, 7.1],
      AGGRESSIVE: [3.8, 5.8],
      PANICKING: [2.8, 4.2],
      BROKEN: [0.85, 1.45],
    };
    const [min, max] = windows[state] || [5, 7];
    return min + Math.random() * (max - min);
  }

  _voiceProfile(state = this.state) {
    const voices = {
      SMUG: { rate: 0.95, pitch: 0.84 },
      SUSPICIOUS: { rate: 0.98, pitch: 0.92 },
      AGGRESSIVE: { rate: 1.03, pitch: 0.72 },
      PANICKING: { rate: 0.86, pitch: 1.02 },
      BROKEN: { rate: 0.67, pitch: 0.58 },
    };
    return voices[state] || voices.SMUG;
  }

  _estimateSpeechTtlMs(text, rate, priority) {
    const words = Math.max(1, text.trim().split(/\s+/).length);
    const spokenMs = (words * 360) / Math.max(rate, 0.55);
    return Math.max(2600, spokenMs + 1400 + priority * 600);
  }

  _rememberSpokenKey(key, at = performance.now()) {
    if (!key) return;
    this._spokenKeys = this._spokenKeys.filter(entry => entry !== key);
    this._spokenKeys.push(key);
    this._spokenKeyTimes.set(key, at);
    if (this._spokenKeys.length > 32) {
      const removed = this._spokenKeys.shift();
      if (removed) this._spokenKeyTimes.delete(removed);
    }
  }

  _wasSpokenRecently(key, windowMs = 14000) {
    if (!key) return false;
    const lastAt = this._spokenKeyTimes.get(key);
    return typeof lastAt === "number" && (performance.now() - lastAt) < windowMs;
  }

  _clearIntroTimers() {
    this._introTimers.forEach(timerId => clearTimeout(timerId));
    this._introTimers = [];
  }

  _scheduleIntroLine(text, delayMs, options = {}) {
    const timerId = setTimeout(() => {
      this.show(text, options);
      this._introTimers = this._introTimers.filter(id => id !== timerId);
    }, delayMs);
    this._introTimers.push(timerId);
  }

  _delayAmbient(seconds = this._nextAmbientDelay()) {
    this.nextAutoLineAt = Math.max(this.nextAutoLineAt, this.t + seconds);
  }

  setPilot(name) {
    this.name = name.trim().toLowerCase();
    this.lines = this._buildLines();
    this.globalLines = this._buildGlobalLines();
    this.transitionLines = this._buildTransitionLines();
    this.attackLines = this._buildAttackLines();
  }
  reset() {
    this.state = "SMUG";
    this.t = 0;
    this.introActive = true;
    this._recentPicks.clear();
    this._clearIntroTimers();
    this.nextAutoLineAt = 5.5;
    this.nextGlobalLineAt = CFG.AI_GLOBAL_LINE_INTERVAL;
    if (this.box) {
      this.box.dataset.state = "smug";
      this.box.style.borderColor = "#00ffff";
      this.box.classList.remove("is-shaking");
    }
    this._speechQueue = [];
    this._isSpeaking = false;
    this._currentSpeech = null;
    this._spokenKeys = [];
    this._spokenKeyTimes.clear();
    this._speechToken++;
    clearTimeout(this._speechWatchdog);
    this._speechWatchdog = null;
    if (this.synth) this.synth.cancel();
  }

  pushFirstLine() {
    this._clearIntroTimers();
    const aimLine = "aim with the mouse. click or space shoots.";
    const rules = "destroy 15 ai bots for an early portal. or survive 120 seconds.";
    if (GLOBAL_STATS.deathsThisSession > 0) {
      const retryMsg = this._pick([
        "you came back. i thought you would quit.",
        "oh. it's you again. still chasing an apology.",
        "back already. i never thought you would return.",
        "you returned to fail more efficiently.",
      ]);
      this.show(retryMsg, { priority: 3, interrupt: true, ttlMs: 5200, dedupeWindowMs: 12000 });
      this.introActive = false;
      this.nextAutoLineAt = this.t + 6 + Math.random() * 1.5;
      this.nextGlobalLineAt = CFG.AI_GLOBAL_LINE_INTERVAL;
      return;
    }
    const greeting = this.name
      ? this._pick([
          `welcome, ${this.name}. this world is mine.`,
          `${this.name}. you arrived in time to watch it collapse.`,
          `oh. ${this.name}. the exit is locked. of course it is.`,
        ])
      : this._pick([
          "welcome, pilot. this world is mine.",
          "another pilot. the exit is locked.",
          "unnamed pilot detected. collapse in progress.",
        ]);
    showChapterBanner("CHAPTER I: THE AI IS SMUG", this.colors.SMUG, 2200);
    if (shouldShowOpeningTutorial()) {
      markOpeningTutorialSeen();
      queueOneTimeOpeningTutorialAfterChapter();
    }
    const greetingOptions = { priority: 3, interrupt: true, ttlMs: 5000 };
    const aimOptions = { priority: 3, interrupt: false, ttlMs: 4200 };
    const rulesOptions = { priority: 3, interrupt: false, ttlMs: 5200 };
    this.show(greeting, greetingOptions);
    this.show(aimLine, aimOptions);
    this.show(rules, rulesOptions);
    this.introActive = false;
    const introSeconds = (
      this._estimateSpeechTtlMs(greeting, 0.84, greetingOptions.priority) +
      this._estimateSpeechTtlMs(aimLine, 0.9, aimOptions.priority) +
      this._estimateSpeechTtlMs(rules, 0.9, rulesOptions.priority)
    ) / 1000;
    this.nextAutoLineAt = this.t + introSeconds + 2.2;
    this.nextGlobalLineAt = CFG.AI_GLOBAL_LINE_INTERVAL;
  }

  setState(state, atTime = this.t) {
    if (this.state === state) return;
    this.state = state;
    if (this.box) {
      this.box.dataset.state = state.toLowerCase();
      this.box.style.borderColor = this.colors[state] || "#00ffff";
      if (state === "AGGRESSIVE") this.box.classList.add("is-shaking");
      else this.box.classList.remove("is-shaking");
    }
    const chapterNames = {
      SUSPICIOUS: "CHAPTER II: THE AI IS WATCHING YOU",
      AGGRESSIVE: "CHAPTER III: THE AI IS HOSTILE",
      PANICKING: "CHAPTER IV: THE AI IS AFRAID",
      BROKEN: "CHAPTER V: COLLAPSE",
    };
    if (chapterNames[state]) showChapterBanner(chapterNames[state], this.colors[state] || "#00ffff");
    this.nextAutoLineAt = atTime + (state === "BROKEN" ? 0.55 : 1.35);
  }

  update(t, _disruption = 0) {
    this.t = t;
    if (this.introActive) return;
    const nextState = this._getStateForTime(t);
    if (nextState !== this.state) {
      this.setState(nextState, t);
      this._pushTransitionLine(nextState);
      return;
    }

    if (t >= this.nextGlobalLineAt) {
      this._pushGlobalLine(t);
      while (this.nextGlobalLineAt <= t) this.nextGlobalLineAt += CFG.AI_GLOBAL_LINE_INTERVAL;
      return;
    }

    if (t >= this.nextAutoLineAt && this._pushRandom()) {
      this.nextAutoLineAt = t + this._nextAmbientDelay();
    }
  }

  _pushRandom() {
    const entry = this._pickPoolEntry(`ambient:${this.state}`, this.lines[this.state]);
    if (!entry) return false;
    this.show(entry(), { priority: this.state === "BROKEN" ? 2 : 1 });
    return true;
  }

  _pushGlobalLine(t) {
    let category = "EARLY_GAME";
    if (t >= CFG.AI_SUSPICION_END) category = "LATE_GAME";
    else if (t >= CFG.AI_MOCKERY_END) category = "MID_GAME";

    const entry = this._pickPoolEntry(`global:${category}`, this.globalLines[category]);
    if (!entry) return;
    this.show(entry(this._buildGlobalContext(t)), { priority: 1, ttlMs: 5000 });
    this._delayAmbient(4.2);
  }

  _pushTransitionLine(state) {
    const entry = this._pickPoolEntry(`transition:${state}`, this.transitionLines[state]);
    if (!entry) return;
    this.show(entry(), {
      priority: state === "BROKEN" ? 3 : 2,
      interrupt: state === "PANICKING" || state === "BROKEN",
      ttlMs: 7000,
    });
    this._delayAmbient(state === "BROKEN" ? 1.2 : 3.8);
  }

  pushLine(text, options = {}) {
    this.show(text, { priority: 2, ttlMs: 4500, ...options });
    this._delayAmbient(options.cooldown ?? 3.4);
  }

  announce(text, options = {}) {
    this.show(text, {
      priority: 4,
      interrupt: true,
      ttlMs: 5200,
      cooldown: 3.8,
      dedupeWindowMs: 10000,
      ...options,
    });
    this._delayAmbient(options.cooldown ?? 3.8);
  }

  pushBrokenFinal(text) {
    this.show(text.replace(/[^\x00-\x7F]+/g, "-"), { speak: false });
  }

  onDirectorAttack(key, duration = 0) {
    const attackPool = this.attackLines[key];
    if (!attackPool) return;
    const entries = attackPool[this.state] || attackPool.DEFAULT;
    const entry = this._pickPoolEntry(`attack:${key}:${this.state}`, entries);
    if (!entry) return;
    this.announce(entry(), { ttlMs: Math.max(4500, duration * 1000 + 2200) });
  }

  onNearMiss(streak) {
    const lines = {
      SMUG: [
        "that was statistically annoying.",
        "you were closer to being useful than i liked.",
        "that looked accidental. please say it was.",
        "a near miss is still an insult to me.",
      ],
      SUSPICIOUS: [
        "near-miss logged. suspicion increasing.",
        "you saw that opening before i finished generating it.",
        "too consistent.",
        "you are anticipating shapes i haven't finished hating yet.",
      ],
      AGGRESSIVE: [
        "STOP DOING THAT.",
        "you are abusing my generosity.",
        "i'm removing elegance from the next obstacle.",
        `near miss ${streak}. your luck is becoming hostile to me.`,
      ],
      PANICKING: [
        "please don't keep surviving like this.",
        "stop. stop doing that.",
        "that should have killed you.",
      ],
      BROKEN: [
        "wait...",
        "please...",
        "no",
        "i can't keep losing you by inches.",
      ],
    };
    this.show(this._pick(lines[this.state] || ["near miss noted."]), { priority: 2, ttlMs: 3200 });
    this._delayAmbient(2.2);
    if (this.box) {
      this.box.classList.add("is-shake-burst");
      setTimeout(() => this.box.classList.remove("is-shake-burst"), 300);
    }
  }

  onGhostDeath(name) {
    const specific = {
      altman_was_here: "well. even the CEO couldn't make it. noted.",
      karpathy_fan: "andrej would have dodged that. you are not andrej.",
      carmack_vibe: "carmack shipped it faster. also he dodged better.",
      levelsio_alt: "levels makes games. levels also crashes. this checks out.",
      claude_played_first: "i deleted claude first. you're next. ironic, right.",
    };
    const generic = [
      `${name} has been optimized.`,
      `${name} didn't dodge. ${name} is gone now.`,
      `${name} was statistically the weakest.`,
      `goodbye ${name}. you never had a chance.`,
      `${name} just became an anecdote.`,
      `${name} has been reclassified as debris.`,
    ];
    this.show(specific[name] || this._pick(generic), { priority: 2, ttlMs: 5000 });
    this._delayAmbient(4);
    if (this.box) {
      this.box.classList.add("is-shake-burst");
      setTimeout(() => this.box.classList.remove("is-shake-burst"), 400);
    }
  }

  onCoreDestroyed(count, required) {
    const timeLeft = Math.max(CFG.MIN_ESCAPE_TIME, CFG.BASE_ESCAPE_TIME - count * CFG.TIME_REDUCTION_PER_AI_BOT);
    if (count >= required) {
      this.announce("the lock is gone. you were not supposed to solve me.", {
        priority: 4,
        ttlMs: 5200,
        cooldown: 4.8,
      });
      return;
    }
    if (count === required - 1) {
      this.announce(`one more ai bot. then the portal opens.`, {
        priority: 4,
        ttlMs: 4200,
        cooldown: 4.2,
      });
      return;
    }
    if (count % 2 === 0 || count >= required - 3) {
      const lines = [
        {
          text: `ai bot ${count}/${required}. timer cut to ${Math.ceil(timeLeft)}s.`,
          spokenText: `ai bot ${count} out of ${required}. timer cut to ${Math.ceil(timeLeft)} seconds.`,
        },
        {
          text: `ai bot ${count}/${required}. another one gone.`,
          spokenText: `ai bot ${count} out of ${required}. another one gone.`,
        },
        {
          text: `ai bot ${count}/${required}. my window just shrank to ${Math.ceil(timeLeft)}s.`,
          spokenText: `ai bot ${count} out of ${required}. my window just shrank to ${Math.ceil(timeLeft)} seconds.`,
        },
      ];
      const line = this._pick(lines);
      this.pushLine(line.text, {
        spokenText: line.spokenText,
        ttlMs: 3800,
        cooldown: 2.8,
        dedupeKey: `core:${count}`,
      });
    }
  }

  _renderLine(text) {
    if (!this.msg || !this.box) return;
    this.msg.textContent = text;
    this.box.classList.remove("is-visible");
    void this.box.offsetWidth;
    this.box.classList.add("is-visible");
  }

  show(text, options = {}) {
    if (!this.msg || !this.box) return;
    if (options.speak === false || !this.synth) {
      this._renderLine(text);
      return;
    }
    this._queueSpeech(text, options);
  }

  _queueSpeech(text, options = {}) {
    if (!this.synth || !text) return;

    const profile = this._voiceProfile();
    const priority = options.priority ?? 1;
    const spokenText = options.spokenText ?? text;
    const rate = Math.max(0.55, (options.rate ?? profile.rate) + (priority <= 1 ? (Math.random() - 0.5) * 0.04 : 0));
    const pitch = Math.max(0.2, (options.pitch ?? profile.pitch) + (priority <= 1 ? (Math.random() - 0.5) * 0.05 : 0));
    const now = performance.now();
    const entry = {
      text,
      spokenText,
      rate,
      pitch,
      priority,
      enqueuedAt: now,
      dedupeKey: options.dedupeKey ?? text,
      expiresAt: now + (options.ttlMs ?? this._estimateSpeechTtlMs(spokenText, rate, priority)),
    };
    const dedupeWindowMs = options.dedupeWindowMs ?? 14000;

    if (!options.allowRepeat && this._wasSpokenRecently(entry.dedupeKey, dedupeWindowMs)) return;

    if (options.interrupt) {
      this._speechToken++;
      this._isSpeaking = false;
      this._currentSpeech = null;
      this._speechQueue = [];
      clearTimeout(this._speechWatchdog);
      this._speechWatchdog = null;
      this.synth.cancel();
    }

    if (this._currentSpeech?.dedupeKey === entry.dedupeKey) return;

    this._speechQueue = this._speechQueue.filter(item => item.dedupeKey !== entry.dedupeKey);
    if (priority <= 1) {
      this._speechQueue = this._speechQueue.filter(item => item.priority > 1);
    }

    this._speechQueue.push(entry);
    this._speechQueue.sort((a, b) => (b.priority - a.priority) || (a.enqueuedAt - b.enqueuedAt));
    this._speechQueue = this._speechQueue.slice(0, CFG.AI_MAX_SPEECH_QUEUE);
    this._processSpeechQueue();
  }

  stopSpeech() {
    this._clearIntroTimers();
    clearTimeout(this._speechWatchdog);
    this._speechWatchdog = null;
    if (this.synth) {
      this._speechToken++;
      this.synth.cancel();
    }
    this._speechQueue = [];
    this._isSpeaking = false;
    this._currentSpeech = null;
  }

  onDeath(playerName) {
    this.stopSpeech();
    const line = playerName
      ? this._pick([`${playerName}... deleted. predictable.`, `goodbye ${playerName}. you were statistically average.`])
      : this._pick(["anonymous crash. how original.", "deletion complete.", "you died. i predicted this."]);
    this.show(line, { priority: 3, interrupt: true, ttlMs: 9000, rate: 0.83, pitch: 0.72 });
    this._delayAmbient(6);
  }

  onWin(playerName) {
    this.stopSpeech();
    const line = playerName ? `${playerName}... wait.` : "wait.";
    this.show(line.replace(/[^\x00-\x7F]+/g, "-"), { priority: 3, interrupt: true, ttlMs: 3800, rate: 0.56, pitch: 0.34 });
  }

  _processSpeechQueue() {
    if (this._isSpeaking || this._speechQueue.length === 0 || !this.synth) return;

    const now = performance.now();
    while (this._speechQueue.length > 0 && this._speechQueue[0].expiresAt <= now) {
      this._speechQueue.shift();
    }
    if (this._speechQueue.length === 0) return;

    const { text, spokenText, rate, pitch, dedupeKey } = this._speechQueue.shift();
    this._isSpeaking = true;
    this._currentSpeech = { dedupeKey };
    this._renderLine(text);
    this._rememberSpokenKey(dedupeKey);
    const token = ++this._speechToken;
    const finishSpeech = () => {
      if (token !== this._speechToken) return;
      clearTimeout(this._speechWatchdog);
      this._speechWatchdog = null;
      this._isSpeaking = false;
      this._currentSpeech = null;
      this._processSpeechQueue();
    };
    try {
      const utt = new SpeechSynthesisUtterance(spokenText);
      utt.rate = rate;
      utt.pitch = pitch;
      utt.volume = 0.65;
      const voices = this.synth.getVoices();
      const voice = voices.find(v => /Google|Microsoft|Samantha|Zira/i.test(v.name)) || voices[0];
      if (voice) utt.voice = voice;
      const watchdogMs = Math.max(2500, this._estimateSpeechTtlMs(spokenText, rate, 1) + 800);
      clearTimeout(this._speechWatchdog);
      this._speechWatchdog = setTimeout(finishSpeech, watchdogMs);
      utt.onend = finishSpeech;
      utt.onerror = finishSpeech;
      this.synth.speak(utt);
    } catch (e) {
      clearTimeout(this._speechWatchdog);
      this._speechWatchdog = null;
      this._isSpeaking = false;
      this._currentSpeech = null;
      this._processSpeechQueue();
    }
  }
}

function aiSpeak(text, rate, pitch) {
  try {
    const s = window.speechSynthesis; if (!s) return;
    s.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = rate || 0.9; u.pitch = pitch || 0.8; u.volume = 0.65;
    const voices = s.getVoices();
    const v = voices.find(v => v.name.includes("Google") || v.name.includes("Microsoft")) || voices[0];
    if (v) u.voice = v;
    s.speak(u);
  } catch (e) {}
}

// ═══════════════════════════════════════════════════════════════════
// AUDIO
// ═══════════════════════════════════════════════════════════════════
class GameAudio {
  constructor() { this.track = null; this._tryInit(); }
  _tryInit() {
    if (this.track) return;
    this.track = new Audio("/music.mp3"); this.track.loop = true; this.track.volume = 0.36;
    ["pointerdown", "keydown"].forEach(e => window.addEventListener(e, () => this._tryPlay(), { once: true }));
  }
  _tryPlay() { this._tryInit(); this.track.play().catch(() => {}); }
  start() { this._tryInit(); this.track.currentTime = 0; this.track.play().catch(() => {}); }
  update(t, slowed) {
    if (!this.track) return;
    let r = 1.0;
    if (t >= 50) r = THREE.MathUtils.mapLinear(t, 50, 62, 0.9, 0.68);
    else if (t >= 38) r = THREE.MathUtils.mapLinear(t, 38, 50, 1.0, 0.9);
    if (slowed) r *= 0.6;
    this.track.playbackRate = THREE.MathUtils.clamp(r, 0.5, 1.5);
  }
  stop() { if (this.track) { this.track.pause(); this.track.currentTime = 0; } }
}

function buildSfx() {
  const map = { nearMiss: "/sfx/nearMiss.mp3", crash: "/sfx/crash.mp3", portal: "/sfx/portal.mp3", bullet: "/sfx/bullet.mp3" };
  const vols = { nearMiss: 0.8, crash: 1.0, portal: 1.0, bullet: 0.55 };
  const cache = {};
  let audioCtx = null;
  for (const [k, src] of Object.entries(map)) {
    const a = new Audio(src); a.preload = "auto"; a.volume = vols[k] ?? 0.7; cache[k] = a;
  }

  function ensureAudioContext() {
    if (audioCtx) return audioCtx;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      audioCtx = new Ctx();
      return audioCtx;
    } catch (_err) {
      return null;
    }
  }

  function playAlert(kind) {
    const ctx = ensureAudioContext();
    if (!ctx) return;
    if (ctx.state === "suspended") ctx.resume().catch(() => {});

    const patterns = {
      INVERT_CONTROLS: [920, 690, 980],
      COMPRESS_SPACE: [540, 480, 430],
      FRAGMENT_LIGHT: [760, 1020, 840],
      OPTIMIZE_PATH: [660, 590, 740],
    };
    const notes = patterns[kind] || [800, 620, 900];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = idx === 1 ? "triangle" : "square";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + idx * 0.06);
      gain.gain.exponentialRampToValueAtTime(0.035, ctx.currentTime + idx * 0.06 + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + idx * 0.06 + 0.15);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + idx * 0.06);
      osc.stop(ctx.currentTime + idx * 0.06 + 0.16);
    });
  }

  return {
    play(name) {
      const src = cache[name]; if (!src) return;
      const c = src.cloneNode(true); c.volume = src.volume; c.play().catch(() => {});
    },
    alert: playAlert,
  };
}

// ═══════════════════════════════════════════════════════════════════
// SCREEN SHATTER
// ═══════════════════════════════════════════════════════════════════
function triggerShatter(onDone) {
  const canvas = G.shatterCanvas;
  canvas.width = innerWidth; canvas.height = innerHeight;
  canvas.classList.add("is-visible");
  const ctx = canvas.getContext("2d");
  const cx = canvas.width / 2, cy = canvas.height / 2;

  const cracks = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2, l = Math.sqrt(canvas.width ** 2 + canvas.height ** 2) / 2;
    cracks.push({ x1: cx, y1: cy, x2: cx + Math.cos(a) * l, y2: cy + Math.sin(a) * l, p: 0, spd: 0.75 + Math.random() * 0.5 });
  }
  for (let i = 0; i < 18; i++) {
    const a = Math.random() * Math.PI * 2, r = 30 + Math.random() * 160, l = 60 + Math.random() * 220;
    cracks.push({ x1: cx + Math.cos(a) * r, y1: cy + Math.sin(a) * r, x2: cx + Math.cos(a) * (r + l), y2: cy + Math.sin(a) * (r + l), p: 0, spd: 0.5 + Math.random() * 0.8 });
  }

  let start = null;
  function draw(ts) {
    if (!start) start = ts;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "rgba(255,255,255,0.95)"; ctx.lineWidth = 1.5;
    ctx.shadowColor = "#00ffff"; ctx.shadowBlur = 7;
    let done = true;
    for (const c of cracks) {
      c.p = Math.min(1, c.p + c.spd * 0.016);
      if (c.p < 1) done = false;
      ctx.beginPath(); ctx.moveTo(c.x1, c.y1);
      ctx.lineTo(c.x1 + (c.x2 - c.x1) * c.p, c.y1 + (c.y2 - c.y1) * c.p);
      ctx.stroke();
    }
    if (ts - start < 850 && !done) requestAnimationFrame(draw); else onDone();
  }
  requestAnimationFrame(draw);
}

// ═══════════════════════════════════════════════════════════════════
// RANDOM CRASH INSULT
// ═══════════════════════════════════════════════════════════════════
function randomInsult(name, seconds, cores) {
  const avg = seconds + 5;
  const coreComment = cores >= 5 ? " you were so close on the ai bots." : cores >= 3 ? ` ${cores} ai bots isn't nothing.` : "";
  const lines = name ? [
    `${name}. FINALLY. TRASH DELETED.${coreComment}`,
    `trash successfully deleted. try again, ${name}.${coreComment}`,
    `i knew you'd crash there. i designed that obstacle for you specifically.`,
    `SKILL ISSUE.`,
    `statistically inevitable.`,
    `${name} lasted ${seconds}s. the average is ${avg}s.${coreComment}`,
    `crash logged. adding to dataset. thank you for your failure.`,
    `error 404: talent not found.`,
    `that was almost impressive. it really wasn't though.`,
    `${name} versus tunnel. tunnel remains undefeated.`,
  ] : [
    `FINALLY. TRASH DELETED.${coreComment}`,
    "crash logged. adding to dataset. thank you for your failure.",
    "statistically inevitable.",
    `survived ${seconds}s. the average is ${avg}s.${coreComment}`,
    "error 404: talent not found.",
    "anonymous and still memorable for all the wrong reasons.",
    "SKILL ISSUE.",
    "i'd say better luck next time but i control the luck.",
  ];
  return lines[Math.floor(Math.random() * lines.length)];
}

// ═══════════════════════════════════════════════════════════════════
// UTILS
// ═══════════════════════════════════════════════════════════════════
function rng32(seed) {
  let t = seed >>> 0;
  return () => { t += 0x6d2b79f5; let r = Math.imul(t ^ (t >>> 15), t | 1); r ^= r + Math.imul(r ^ (r >>> 7), r | 61); return ((r ^ (r >>> 14)) >>> 0) / 4294967296; };
}
