# Implementation Plan: Victory Screen

## Overview

Implement the victory screen and supporting UX improvements in `main.js`, `style.css`, and `index.html` only. Tasks follow the priority order from `docs/final_screen.md`: victory screen first, then portal unlock announcement, intro explainer, portal arrow improvements, AI defeated line, and CSS additions.

## Tasks

- [x] 1. Add `getVictoryAILine` and `showVictoryScreen` functions to `main.js`
  - Add `getVictoryAILine(cores)` above `triggerWin()` — returns a random string from a pool of exactly 6 defeated AI lines; the sixth entry conditionally prepends "you destroyed all of them. all of them. " when `cores >= CFG.AI_BOTS_FOR_INSTANT_WIN`
  - Add `showVictoryScreen(survivalTime, cores, speed)` above `triggerWin()` — creates a `<div id="victory-screen">` with `z-index: 100`, appends it to `document.body`, and populates it with: "ESCAPED" heading, subtitle, stats block (`TIME: Xs`, `BOTS: N/8`, `SPEED: N m/s`), AI message block, "ENTER THE NEXT WORLD" anchor, countdown line with `<span id="victory-countdown">8</span>`, and "stay in skybreak" button
  - Build `portalUrl` inside `showVictoryScreen` using `URLSearchParams` with all six required fields: `username` (`PLAYER_NAME || 'anonymous'`), `speed` (rounded integer string), `ref` (`location.origin + location.pathname`), `hp` (`Math.ceil(health).toString()`), `color` (`'#00ffff'`), `won` (`'true'`)
  - Start an 8-second `setInterval` countdown that decrements `count`, updates `#victory-countdown`, and navigates to `portalUrl` when `count <= 0`; guard the element lookup with `if (el)`
  - Wire the "stay in skybreak" button: `document.getElementById('victory-screen').remove(); location.reload();`
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 1.10, 1.11, 1.12, 1.13, 2.1, 2.2, 2.3, 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7_

  - [ ]* 1.1 Write property test for survival time formatting (Property 1)
    - **Property 1: Survival time formatting** — for any non-negative float `t`, `buildStatsHtml(t, 6, 200)` output SHALL match `/\d+\.\d{1}s/`
    - **Validates: Requirements 1.3**

  - [ ]* 1.2 Write property test for bot count formatting (Property 2)
    - **Property 2: Bot count formatting** — for any integer `cores` in [0, 8], `buildStatsHtml(100, cores, 200)` output SHALL include `${cores}/8`
    - **Validates: Requirements 1.4**

  - [ ]* 1.3 Write property test for speed formatting (Property 3)
    - **Property 3: Speed formatting** — for any non-negative integer `speed`, `buildStatsHtml(100, 6, speed)` output SHALL include `${speed} m/s`
    - **Validates: Requirements 1.5**

  - [ ]* 1.4 Write property test for portal URL parameters (Property 4)
    - **Property 4: Portal URL contains all required parameters** — for any combination of `name`, `hp`, `speed`, `buildPortalUrl(name, hp, speed)` SHALL contain all six params with correct values; `username` SHALL be `name || 'anonymous'`; `hp` SHALL equal `String(Math.ceil(hp))`; `color` SHALL be `'#00ffff'`; `won` SHALL be `'true'`
    - **Validates: Requirements 1.7, 1.13, 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7**

  - [ ]* 1.5 Write property test for AI message pool membership (Property 5)
    - **Property 5: AI message pool membership** — for any `cores` in [0, 8], `getVictoryAILine(cores)` SHALL return a string that is a member of (or derived from) the defined 6-entry pool; also assert `MESSAGE_POOL.length >= 6`
    - **Validates: Requirements 2.1**

  - [ ]* 1.6 Write unit tests for victory screen structure and behavior
    - Call `showVictoryScreen(147.3, 6, 220)` and verify DOM contains "ESCAPED", "[SYSTEM_AI]", "ENTER THE NEXT WORLD", and "stay in skybreak"
    - Verify `#victory-countdown` initial text is "8"
    - Simulate click on "stay in skybreak" and verify `#victory-screen` is removed from DOM
    - Verify `#victory-screen` has `z-index: 100` (above shatter canvas at `z-index: 30`)
    - Verify `getVictoryAILine(8)` can return a string containing "all of them"
    - _Requirements: 1.1, 1.2, 1.6, 1.8, 1.10, 1.11, 1.12, 2.2_

- [x] 2. Modify `triggerWin()` to call `showVictoryScreen` instead of redirecting
  - Inside the `triggerShatter` callback, in the `setTimeout(() => { ... }, 650)` block, replace the `location.href = \`${CFG.WEBRING_URL}?${p}\`` assignment (and the `mpMode` branch that also sets `location.href`) with a call to `showVictoryScreen(wallTime, coresDestroyed, Math.round(getSpeed(diffT) * throttleMult))`
  - Remove the `URLSearchParams` block that builds `p` from `triggerWin()` since `showVictoryScreen` builds its own URL internally
  - Preserve the `mpMode` branch: the `socket.emit('portal_escape', ...)` and `clearInterval(posInterval)` calls must still fire before `showVictoryScreen` is called in the multiplayer path
  - _Requirements: 1.1, 1.7, 1.9_

- [x] 3. Checkpoint — verify victory screen end-to-end
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Improve portal unlock announcement in `unlockPortal()` and update HUD objective
  - In `unlockPortal()`, replace the `showBanner("EXIT PORTAL UNLOCKED — DIVE THROUGH THE RING", 3.5)` call with `showChapterBanner("THE EXIT PORTAL IS OPEN\nFLY THROUGH THE WHITE RING AHEAD", "#00ffff", 5000)`
  - Immediately after `G.hudTimer.classList.add("is-escaping")`, add `G.hudObjective.textContent = "→ FLY THROUGH THE GLOWING RING";`
  - In `updateHUD()`, update the `portalUnlocked` branch of the objective text from `"OBJECTIVE: REACH THE PORTAL"` to `"→ FLY THROUGH THE GLOWING RING"` so the text persists across HUD refreshes
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [ ]* 4.1 Write unit tests for portal unlock announcement
    - Mock `showChapterBanner`, call `unlockPortal(8)`, verify it was called with text containing "THE EXIT PORTAL IS OPEN" and duration `>= 4000`
    - Call `unlockPortal(8)`, verify `G.hudObjective.textContent` equals "→ FLY THROUGH THE GLOWING RING"
    - _Requirements: 3.1, 3.2, 3.3, 3.5_

- [x] 5. Add three-step explainer to the intro screen in `main.js`
  - In the `app.innerHTML` template, inside the `#mode-select` `.intro-hint` block, insert the explainer `<div>` between the last `.intro-narrative` line (`REACH THE PORTAL BEFORE THE VOID TAKES YOU`) and the `.intro-key` row
  - Apply the same insertion to the `#intro-hint` block (the solo form step) so both views show the explainer
  - Use the `.intro-narrative.accent` class with an added inline border style as specified in the design: `border: 1px solid rgba(0,255,255,0.25); border-radius: 3px; font-size: clamp(9px, 1.4vw, 12px); letter-spacing: 0.18em; margin-top: 0.5rem; padding: 0.4rem 0.8rem;`
  - Text content: `DESTROY 8 AI BOTS → THE EXIT RING APPEARS → FLY THROUGH IT TO ESCAPE`
  - _Requirements: 4.1, 4.2, 4.3_

  - [ ]* 5.1 Write unit test for intro explainer presence
    - Verify `#mode-select` DOM contains the text "DESTROY 8 AI BOTS → THE EXIT RING APPEARS → FLY THROUGH IT TO ESCAPE"
    - _Requirements: 4.1_

- [x] 6. Update portal arrow format and color logic in the draw loop
  - Locate the portal arrow update block at ~line 2904 in `main.js` (inside the `if (portalUnlocked && portalSys.group.visible)` branch)
  - Replace `G.portalArrow.textContent = \`PORTAL AHEAD ${portalDistance}m\`` with a conditional:
    - If `portalDistance <= 100`: set `textContent` to `▼ DIVE NOW ▼`, `style.color` to `'#ff0033'`, `style.borderColor` to `'rgba(255,0,50,0.9)'`, `style.textShadow` to `'0 0 12px rgba(255,0,50,0.8)'`
    - Else: set `textContent` to `` `▼ PORTAL: ${portalDistance}m ▼` ``, `style.color` to `'#00ffff'`, `style.borderColor` to `'rgba(0,255,255,0.9)'`, `style.textShadow` to `'0 0 12px rgba(0,255,255,0.8)'`
  - Leave the `G.portalArrow.classList.add("is-visible")` call and the white flash proximity logic unchanged
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

  - [ ]* 6.1 Write property test for portal arrow format by distance (Property 6)
    - **Property 6: Portal arrow format by distance** — for any non-negative integer `d`, `getPortalArrowState(d)` SHALL return `{ text: '▼ DIVE NOW ▼', color: '#ff0033' }` when `d <= 100`, and `{ text: \`▼ PORTAL: ${d}m ▼\`, color: '#00ffff' }` when `d > 100`
    - **Validates: Requirements 5.1, 5.4, 5.5**

- [x] 7. Add AI defeated line before shatter in `triggerWin()`
  - Immediately after `endSeq = true; endSeqTimer = 0;` at the top of `triggerWin()`, add an `aiTroll?.announce(...)` call with `{ priority: 5, interrupt: true, ttlMs: 3000 }`
  - Message: `PLAYER_NAME ? \`${PLAYER_NAME}... you actually did it. i don't know what to do with that.\` : "you actually did it. i don't know what to do with that."`
  - This must fire before the `setTimeout(..., 4200)` that starts the camera zoom and shatter sequence
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

  - [ ]* 7.1 Write property test for AI defeated message name inclusion (Property 7)
    - **Property 7: AI defeated message name inclusion** — for any non-empty `name` string, `buildDefeatedMessage(name)` SHALL start with `${name}...`; for an empty string, the result SHALL NOT match `/^\w+\.\.\./`
    - **Validates: Requirements 6.2, 6.3**

  - [ ]* 7.2 Write unit test for AI defeated line announce call
    - Mock `aiTroll.announce`, call `triggerWin()`, verify it was called with `{ interrupt: true, ttlMs: >= 3000 }` before `triggerShatter` fires
    - _Requirements: 6.1, 6.4, 6.5_

- [x] 8. Add CSS to `style.css`
  - Add `@keyframes fadeInVictory` at the end of the animations section: `from { opacity: 0; transform: scale(0.97); } to { opacity: 1; transform: scale(1); }`
  - Update `.portal-arrow` `font-size` from `12px` to `18px`
  - _Requirements: 1.1, 5.6_

  - [ ]* 8.1 Write unit test for portal arrow font size
    - Verify `.portal-arrow` computed or declared `font-size` is greater than `12px`
    - _Requirements: 5.6_

- [x] 9. Final checkpoint — ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- The `buildStatsHtml`, `buildPortalUrl`, `getPortalArrowState`, and `buildDefeatedMessage` helpers referenced in property tests are thin pure-function extractions of the relevant logic — extract them from `showVictoryScreen` and the draw loop to make them unit-testable without a DOM
- Property tests use [fast-check](https://github.com/dubzzz/fast-check); run with `vitest --run` for single execution
- The multiplayer `socket.emit('portal_escape', ...)` path in `triggerWin()` is unchanged — only the `location.href` assignment is replaced
