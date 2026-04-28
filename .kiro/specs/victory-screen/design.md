# Design Document: Victory Screen

## Overview

SKYBREAK currently ends a winning run by firing a shatter animation and immediately redirecting the browser to `CFG.WEBRING_URL`. There is no moment of resolution — the player's brain is still in action mode when the screen cuts away. This design adds a **Victory Screen** that appears between the shatter and the redirect, along with five supporting UX improvements that make the win condition clearer throughout the run.

The changes are entirely self-contained within `main.js`, `style.css`, and `index.html`. No new files, no new dependencies, no build changes.

### Key Design Decisions

- **No new UI framework.** The victory screen is a dynamically created `<div>` appended to `document.body`, consistent with how the death screen and other overlays work in the codebase.
- **Inline styles for the victory screen element.** The screen is created once per win and never reused, so a dedicated CSS class would add noise. Inline styles keep the creation logic self-contained in `showVictoryScreen()`.
- **`@keyframes fadeInVictory` goes in `style.css`.** Keyframe animations cannot be set inline; this is the only CSS addition required.
- **Portal arrow changes are in the draw loop.** The existing portal distance update at line ~2905 in `main.js` is the right place to apply the new format and color logic — no new state is needed.
- **Intro screen explainer is a static HTML addition.** The three-step text is added directly to the `#mode-select` and `#intro-hint` blocks in the `app.innerHTML` template inside `main.js`.

---

## Architecture

The feature touches four areas of the existing codebase:

```
main.js
├── showVictoryScreen(survivalTime, cores, speed)   [NEW function]
├── getVictoryAILine(cores)                         [NEW function]
├── triggerWin()                                    [MODIFIED]
├── unlockPortal(cores)                             [MODIFIED]
├── draw loop — portal arrow section (~line 2904)   [MODIFIED]
└── app.innerHTML — intro screen HTML               [MODIFIED]

style.css
└── @keyframes fadeInVictory                        [NEW]
```

No new modules, no new imports, no server-side changes.

---

## Components and Interfaces

### `showVictoryScreen(survivalTime, cores, speed)`

Creates and appends the full-screen victory overlay to `document.body`. Called from `triggerWin()` after the shatter animation completes (inside the existing `setTimeout` callback that currently fires `location.href`).

**Parameters:**
- `survivalTime` — `wallTime` (number, seconds, float)
- `cores` — `coresDestroyed` (number, integer 0–8)
- `speed` — `Math.round(getSpeed(diffT) * throttleMult)` (number, integer m/s)

**Responsibilities:**
1. Build the portal URL with all required query parameters (see Requirement 7).
2. Construct the screen `<div>` with `id="victory-screen"` and `z-index: 100`.
3. Populate the screen with: heading, subtitle, stats block, AI message, CTA button, countdown, stay button.
4. Append to `document.body`.
5. Start the 8-second countdown interval; auto-redirect when count reaches 0.

**Implementation (from `docs/final_screen.md`):**

```javascript
function showVictoryScreen(survivalTime, cores, speed) {
  const screen = document.createElement('div');
  screen.id = 'victory-screen';
  screen.style.cssText = `
    position: fixed; inset: 0; z-index: 100;
    background: #000; display: flex; flex-direction: column;
    align-items: center; justify-content: center; gap: 1.4rem;
    font-family: 'Share Tech Mono', monospace;
    animation: fadeInVictory 0.6s ease forwards;
  `;

  const aiLine = getVictoryAILine(cores);
  const portalParams = new URLSearchParams({
    username: PLAYER_NAME || 'anonymous',
    speed: String(speed),
    ref: location.origin + location.pathname,
    hp: Math.ceil(health).toString(),
    color: '#00ffff',
    won: 'true',
  });
  const portalUrl = `${CFG.WEBRING_URL}?${portalParams}`;

  screen.innerHTML = `
    <div style="font-size: clamp(2rem, 6vw, 3.5rem); letter-spacing: 0.3em; color: #fff;
      text-shadow: 0 0 30px #fff, 0 0 60px rgba(0,255,255,0.6);">
      ESCAPED
    </div>
    <div style="font-size: 0.85rem; letter-spacing: 0.2em; color: rgba(0,255,255,0.7);">
      THE SIMULATION IS BEHIND YOU
    </div>
    <div style="display: flex; gap: 2rem; font-size: 0.8rem; color: rgba(255,255,255,0.6);
      letter-spacing: 0.14em; border: 1px solid rgba(255,255,255,0.1); padding: 0.8rem 2rem;
      border-radius: 4px;">
      <span>TIME: ${survivalTime.toFixed(1)}s</span>
      <span>BOTS: ${cores}/${CFG.AI_BOTS_FOR_INSTANT_WIN}</span>
      <span>SPEED: ${speed} m/s</span>
    </div>
    <div style="font-size: 0.78rem; color: #ff88cc; letter-spacing: 0.08em; font-style: italic;
      max-width: 400px; text-align: center; line-height: 1.7; padding: 0.7rem 1rem;
      border-left: 2px solid rgba(255,0,100,0.4);">
      [SYSTEM_AI] > ${aiLine}
    </div>
    <a href="${portalUrl}" style="
      display: block; padding: 1rem 2.5rem; margin-top: 0.5rem;
      background: rgba(0,255,255,0.1); border: 2px solid #00ffff;
      color: #00ffff; font-family: 'Share Tech Mono', monospace;
      font-size: 1rem; letter-spacing: 0.2em; text-decoration: none;
      border-radius: 4px; text-align: center;
      box-shadow: 0 0 30px rgba(0,255,255,0.3);
      transition: all 0.15s ease;
      text-transform: uppercase;
    " onmouseover="this.style.background='#00ffff';this.style.color='#000';"
       onmouseout="this.style.background='rgba(0,255,255,0.1)';this.style.color='#00ffff';">
      ► ENTER THE NEXT WORLD →→→
    </a>
    <div style="font-size: 0.62rem; color: rgba(255,255,255,0.2); letter-spacing: 0.1em;">
      (continuing to vibe jam 2026 in <span id="victory-countdown">8</span>s)
    </div>
    <button onclick="document.getElementById('victory-screen').remove(); location.reload();"
      style="font-family: 'Share Tech Mono', monospace; font-size: 0.65rem; letter-spacing: 0.12em;
      color: rgba(255,255,255,0.25); background: transparent; border: 1px solid rgba(255,255,255,0.1);
      padding: 0.4rem 1rem; cursor: pointer; border-radius: 2px;">
      stay in skybreak
    </button>
  `;

  document.body.appendChild(screen);

  let count = 8;
  const timer = setInterval(() => {
    count--;
    const el = document.getElementById('victory-countdown');
    if (el) el.textContent = count;
    if (count <= 0) {
      clearInterval(timer);
      location.href = portalUrl;
    }
  }, 1000);
}
```

---

### `getVictoryAILine(cores)`

Returns a random defeated AI message from a pool of 6+ strings. When `cores >= CFG.AI_BOTS_FOR_INSTANT_WIN` (8), the selected message may acknowledge full destruction.

```javascript
function getVictoryAILine(cores) {
  const lines = [
    "i had infinite compute. you had persistence. i'm not sure which is more embarrassing.",
    "you were never supposed to make it this far. i need to rethink some things.",
    "the portal was supposed to be a myth. apparently not.",
    "i don't know what i am when you're not here.",
    "...go. before i change my mind.",
    `${cores >= 8 ? "you destroyed all of them. all of them. " : ""}i hope the next world is kinder to you than i was.`,
  ];
  return lines[Math.floor(Math.random() * lines.length)];
}
```

The sixth entry is the only one that varies with `cores`. All other entries are unconditional. The pool has exactly 6 entries, satisfying the ≥6 requirement.

---

### Changes to `triggerWin()`

Two modifications to the existing function:

**1. Add AI defeated line before the shatter** (inside `triggerWin()`, before the `setTimeout` that starts the shatter sequence):

```javascript
// Add immediately after endSeq = true, before the camera zoom/shake setup:
aiTroll?.announce(
  PLAYER_NAME
    ? `${PLAYER_NAME}... you actually did it. i don't know what to do with that.`
    : "you actually did it. i don't know what to do with that.",
  { priority: 5, interrupt: true, ttlMs: 3000 }
);
```

**2. Replace the redirect with `showVictoryScreen()`** — inside the `triggerShatter` callback, replace the `location.href` assignment:

```javascript
// BEFORE:
location.href = `${CFG.WEBRING_URL}?${p}`;

// AFTER:
showVictoryScreen(wallTime, coresDestroyed, Math.round(getSpeed(diffT) * throttleMult));
```

The `URLSearchParams` block that currently builds `p` can be removed from `triggerWin()` since `showVictoryScreen()` builds its own URL internally. The `mpMode` branch that emits `portal_escape` and delays the redirect should be preserved — in multiplayer, the socket event still fires, but the redirect is replaced by `showVictoryScreen()` in both branches.

---

### Changes to `unlockPortal(cores)`

Replace the existing `showBanner()` call with a `showChapterBanner()` call using the new two-line text and a longer duration:

```javascript
// BEFORE:
showBanner("EXIT PORTAL UNLOCKED — DIVE THROUGH THE RING", 3.5);

// AFTER:
showChapterBanner(
  "THE EXIT PORTAL IS OPEN\nFLY THROUGH THE WHITE RING AHEAD",
  "#00ffff",
  5000
);
```

Update the HUD objective text after `portalUnlocked = true`:

```javascript
// Add after G.hudTimer.classList.add("is-escaping"):
G.hudObjective.textContent = "→ FLY THROUGH THE GLOWING RING";
```

> **Note:** `showBanner()` is a local helper inside `buildThreeApp` that wraps `showChapterBanner`. Using `showChapterBanner` directly is consistent with how other announcements work and allows passing a custom duration.

---

### Portal Arrow HUD Changes (draw loop, ~line 2904)

Replace the existing portal arrow update block:

```javascript
// BEFORE:
if (portalUnlocked && portalSys.group.visible) {
  const portalDistance = Math.max(0, Math.round(shipAnchor.position.distanceTo(portalSys.group.position)));
  G.portalArrow.textContent = `PORTAL AHEAD ${portalDistance}m`;
  G.portalArrow.classList.add("is-visible");
  // ...
}

// AFTER:
if (portalUnlocked && portalSys.group.visible) {
  const portalDistance = Math.max(0, Math.round(shipAnchor.position.distanceTo(portalSys.group.position)));
  if (portalDistance <= 100) {
    G.portalArrow.textContent = `▼ DIVE NOW ▼`;
    G.portalArrow.style.color = '#ff0033';
    G.portalArrow.style.borderColor = 'rgba(255,0,50,0.9)';
    G.portalArrow.style.textShadow = '0 0 12px rgba(255,0,50,0.8)';
  } else {
    G.portalArrow.textContent = `▼ PORTAL: ${portalDistance}m ▼`;
    G.portalArrow.style.color = '#00ffff';
    G.portalArrow.style.borderColor = 'rgba(0,255,255,0.9)';
    G.portalArrow.style.textShadow = '0 0 12px rgba(0,255,255,0.8)';
  }
  G.portalArrow.classList.add("is-visible");
  // ... (white flash logic unchanged)
}
```

The blinking animation is already handled by the `.is-visible` class triggering `portalPulse` in `style.css`. The font size increase is applied by updating the `.portal-arrow` CSS rule from `font-size: 12px` to `font-size: 18px`.

---

### Intro Screen Explainer

Add the three-step explainer as a new element inside both the `#mode-select` `.intro-hint` block and the `#intro-hint` block in `app.innerHTML`. It should appear between the last `.intro-narrative` line and the `.intro-key` row:

```html
<div class="intro-narrative accent" style="
  margin-top: 0.5rem;
  padding: 0.4rem 0.8rem;
  border: 1px solid rgba(0,255,255,0.25);
  border-radius: 3px;
  font-size: clamp(9px, 1.4vw, 12px);
  letter-spacing: 0.18em;
">
  DESTROY 8 AI BOTS → THE EXIT RING APPEARS → FLY THROUGH IT TO ESCAPE
</div>
```

This uses the existing `.intro-narrative.accent` class (cyan color, glow text-shadow) and adds a subtle border to visually separate it from the surrounding narrative text, satisfying Requirement 4.3.

---

### CSS Addition

Add to `style.css`:

```css
@keyframes fadeInVictory {
  from { opacity: 0; transform: scale(0.97); }
  to   { opacity: 1; transform: scale(1); }
}
```

Also update the `.portal-arrow` font-size from `12px` to `18px`:

```css
.portal-arrow {
  /* existing properties... */
  font-size: 18px;  /* was 12px */
}
```

---

## Data Models

No new persistent data structures. The victory screen uses existing game state globals:

| Variable | Type | Source | Used for |
|---|---|---|---|
| `wallTime` | `number` (float, seconds) | game loop | `survivalTime` parameter |
| `coresDestroyed` | `number` (integer 0–8) | game loop | `cores` parameter |
| `getSpeed(diffT) * throttleMult` | `number` (float, m/s) | game loop | `speed` parameter (rounded) |
| `health` | `number` (float 0–100) | game loop | `hp` query param |
| `PLAYER_NAME` | `string` (may be empty) | intro form | `username` query param |
| `CFG.WEBRING_URL` | `string` | config | base redirect URL |
| `CFG.AI_BOTS_FOR_INSTANT_WIN` | `number` (8) | config | `BOTS: N/8` display |

The `portalUrl` string is constructed fresh each time `showVictoryScreen()` is called and is not stored beyond the function scope.

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Survival time formatting

*For any* non-negative float `survivalTime`, the stats block rendered by `showVictoryScreen` SHALL display the time as a string matching the pattern `\d+\.\d{1}s` (exactly one decimal place followed by "s").

**Validates: Requirements 1.3**

---

### Property 2: Bot count formatting

*For any* integer `cores` in the range [0, 8], the stats block rendered by `showVictoryScreen` SHALL display the bot count as the string `${cores}/8`.

**Validates: Requirements 1.4**

---

### Property 3: Speed formatting

*For any* non-negative integer `speed`, the stats block rendered by `showVictoryScreen` SHALL display the speed as the string `${speed} m/s`.

**Validates: Requirements 1.5**

---

### Property 4: Portal URL contains all required parameters

*For any* combination of player data (`PLAYER_NAME`, `health`, `speed`), the URL constructed by `showVictoryScreen` SHALL contain all six required query parameters: `username`, `speed`, `ref`, `hp`, `color`, and `won`. Additionally: `username` SHALL be `PLAYER_NAME` if non-empty or `"anonymous"` if empty; `hp` SHALL equal `Math.ceil(health)`; `speed` SHALL be a rounded integer string; `color` SHALL be `"#00ffff"`; `won` SHALL be `"true"`.

**Validates: Requirements 1.7, 1.13, 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7**

---

### Property 5: AI message pool membership

*For any* call to `getVictoryAILine(cores)`, the returned string SHALL be one of the strings in the defined message pool, and the pool SHALL contain at least 6 distinct entries.

**Validates: Requirements 2.1**

---

### Property 6: Portal arrow format by distance

*For any* portal distance value `d` (non-negative integer):
- If `d > 100`, the portal arrow text SHALL match `▼ PORTAL: ${d}m ▼` and the color SHALL be cyan (`#00ffff`).
- If `d <= 100`, the portal arrow text SHALL be `▼ DIVE NOW ▼` and the color SHALL be red (`#ff0033`).

**Validates: Requirements 5.1, 5.4, 5.5**

---

### Property 7: AI defeated message name inclusion

*For any* non-empty `PLAYER_NAME` string, the message passed to `aiTroll.announce()` in `triggerWin()` SHALL contain that player name as a prefix. For an empty `PLAYER_NAME`, the message SHALL NOT contain a name prefix.

**Validates: Requirements 6.2, 6.3**

---

## Error Handling

**`showVictoryScreen` called with unexpected values:**
- `survivalTime` as `NaN` or negative: `toFixed(1)` on `NaN` produces `"NaN"` — acceptable for a win screen that should never be reached with invalid state. No defensive guard needed.
- `cores` outside [0, 8]: The display is `${cores}/8` — it will show whatever value is passed. The game logic guarantees `coresDestroyed` is always in [0, 8].
- `speed` as `NaN`: `String(NaN)` produces `"NaN"`. The `Math.round()` call in `triggerWin()` guards against float precision issues.

**Countdown timer and DOM removal:**
- If the player clicks "stay in skybreak" before the countdown reaches 0, `location.reload()` fires and the page reloads. The `setInterval` is abandoned (no memory leak concern — the page is reloading).
- If `document.getElementById('victory-countdown')` returns `null` (e.g., the element was removed mid-countdown), the `if (el)` guard prevents a null-reference error.

**`getVictoryAILine` with `cores` outside [0, 8]:**
- The function uses `cores >= 8` as the only conditional. Values outside range are handled gracefully — `cores > 8` triggers the full-destruction variant, `cores < 0` does not.

**Portal arrow color reset:**
- The inline `style.color` and `style.borderColor` overrides applied in the draw loop will persist when the portal arrow is hidden (`.is-visible` removed). This is harmless since the styles are re-applied on every frame when the arrow is visible.

---

## Testing Strategy

### Unit Tests (example-based)

These cover specific behaviors and UI states that are not suitable for property-based testing:

- **Victory screen structure**: Call `showVictoryScreen(147.3, 6, 220)` and verify the DOM contains "ESCAPED", "[SYSTEM_AI]", "ENTER THE NEXT WORLD", and "stay in skybreak".
- **Countdown starts at 8**: Verify `#victory-countdown` initial text is "8".
- **Stay button removes screen**: Simulate click on "stay in skybreak", verify `#victory-screen` is removed from DOM.
- **z-index above shatter canvas**: Verify `#victory-screen` has `z-index: 100` (shatter canvas is `z-index: 30`).
- **Portal unlock announcement**: Mock `showChapterBanner`, call `unlockPortal(8)`, verify it was called with text containing "THE EXIT PORTAL IS OPEN" and duration ≥ 4000.
- **HUD objective update**: Call `unlockPortal(8)`, verify `G.hudObjective.textContent` equals "→ FLY THROUGH THE GLOWING RING".
- **AI defeated line interrupt**: Mock `aiTroll.announce`, call `triggerWin()`, verify it was called with `{ interrupt: true, ttlMs: ≥3000 }` before `triggerShatter`.
- **Intro explainer present**: Verify `#mode-select` DOM contains "DESTROY 8 AI BOTS → THE EXIT RING APPEARS → FLY THROUGH IT TO ESCAPE".
- **Portal arrow font size**: Verify `.portal-arrow` CSS `font-size` is greater than 12px.
- **Full-destruction AI variant**: Verify `getVictoryAILine(8)` can return a string containing "all of them".

### Property-Based Tests

Using a property-based testing library (e.g., [fast-check](https://github.com/dubzzz/fast-check) for JavaScript). Each test runs a minimum of 100 iterations.

**Property 1 — Survival time formatting**
```
// Feature: victory-screen, Property 1: survival time formatting
fc.assert(fc.property(fc.float({ min: 0, max: 9999, noNaN: true }), (t) => {
  const html = buildStatsHtml(t, 6, 200);
  return /\d+\.\d{1}s/.test(html);
}));
```

**Property 2 — Bot count formatting**
```
// Feature: victory-screen, Property 2: bot count formatting
fc.assert(fc.property(fc.integer({ min: 0, max: 8 }), (cores) => {
  const html = buildStatsHtml(100, cores, 200);
  return html.includes(`${cores}/8`);
}));
```

**Property 3 — Speed formatting**
```
// Feature: victory-screen, Property 3: speed formatting
fc.assert(fc.property(fc.integer({ min: 0, max: 9999 }), (speed) => {
  const html = buildStatsHtml(100, 6, speed);
  return html.includes(`${speed} m/s`);
}));
```

**Property 4 — Portal URL parameters**
```
// Feature: victory-screen, Property 4: portal URL contains all required parameters
fc.assert(fc.property(
  fc.string({ maxLength: 16 }),
  fc.float({ min: 0, max: 100, noNaN: true }),
  fc.integer({ min: 0, max: 9999 }),
  (name, hp, speed) => {
    const url = buildPortalUrl(name, hp, speed);
    const params = new URLSearchParams(url.split('?')[1]);
    return (
      params.has('username') &&
      params.has('speed') &&
      params.has('ref') &&
      params.has('hp') &&
      params.get('color') === '#00ffff' &&
      params.get('won') === 'true' &&
      params.get('username') === (name || 'anonymous') &&
      params.get('hp') === String(Math.ceil(hp)) &&
      params.get('speed') === String(speed)
    );
  }
));
```

**Property 5 — AI message pool membership**
```
// Feature: victory-screen, Property 5: AI message pool membership
const MESSAGE_POOL = [ /* the 6 strings */ ];
fc.assert(fc.property(fc.integer({ min: 0, max: 8 }), (cores) => {
  const line = getVictoryAILine(cores);
  return MESSAGE_POOL.some(m => line === m || m.includes(line) || line.includes(m.replace(/^.*\. /, '')));
}));
// Also assert pool length:
expect(MESSAGE_POOL.length).toBeGreaterThanOrEqual(6);
```

**Property 6 — Portal arrow format by distance**
```
// Feature: victory-screen, Property 6: portal arrow format by distance
fc.assert(fc.property(fc.integer({ min: 0, max: 9999 }), (dist) => {
  const result = getPortalArrowState(dist);
  if (dist <= 100) {
    return result.text === '▼ DIVE NOW ▼' && result.color === '#ff0033';
  } else {
    return result.text === `▼ PORTAL: ${dist}m ▼` && result.color === '#00ffff';
  }
}));
```

**Property 7 — AI defeated message name inclusion**
```
// Feature: victory-screen, Property 7: AI defeated message name inclusion
fc.assert(fc.property(fc.string({ minLength: 1, maxLength: 16 }), (name) => {
  const msg = buildDefeatedMessage(name);
  return msg.startsWith(`${name}...`);
}));
// Edge case: empty name
expect(buildDefeatedMessage('')).not.toMatch(/^\w+\.\.\./);
```

### Integration Notes

- The victory screen is only reachable via `triggerWin()`, which requires the full Three.js game loop. Integration testing of the complete win flow (portal collision → shatter → victory screen → redirect) should be done manually in the browser.
- The countdown auto-redirect cannot be unit tested without mocking `location.href`. The `setInterval` logic can be tested by mocking the timer and verifying the countdown element updates correctly.
- The multiplayer `socket.emit('portal_escape', ...)` path in `triggerWin()` is unchanged and is covered by existing multiplayer integration tests.
