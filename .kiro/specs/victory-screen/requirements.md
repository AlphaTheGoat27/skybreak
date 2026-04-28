# Requirements Document

## Introduction

SKYBREAK is a browser-based space shooter where the player escapes an AI-controlled simulation by destroying 8 AI bots and flying through an exit portal. Currently, when the player wins, the game immediately redirects to the webring URL after the shatter animation — with no moment of resolution. This leaves players confused rather than victorious.

This feature adds a **Victory Screen** and a set of supporting UX improvements that make winning feel earned and intentional. The changes span five areas: a post-shatter victory screen with stats and a redirect button, a more prominent portal-unlock announcement, a clearer intro explainer, an improved portal distance indicator, and a final AI "defeated" message before the shatter.

## Glossary

- **Victory_Screen**: The full-screen overlay shown after the shatter animation completes, before the player is redirected to the webring.
- **Shatter**: The existing screen-shatter animation triggered when the player flies through the exit portal.
- **Portal**: The white ring the player must fly through to win the game.
- **Webring_URL**: The external URL (`CFG.WEBRING_URL`) the player is redirected to after winning.
- **Portal_Arrow**: The HUD element that shows the player's distance to the portal once it is unlocked.
- **Portal_Unlock_Announcement**: The in-game message shown when the exit portal becomes available.
- **AI_Troll**: The in-game AI commentator that delivers narrative lines throughout the run.
- **Survival_Time**: The number of seconds the player survived during the run (`wallTime`).
- **Bots_Destroyed**: The number of AI bots the player destroyed during the run (`coresDestroyed`).
- **Player_Speed**: The player's current speed in m/s at the moment of portal entry.
- **PLAYER_NAME**: The pilot name entered by the player on the intro screen (may be empty).
- **Countdown_Timer**: The 8-second auto-redirect countdown displayed on the Victory_Screen.
- **Intro_Screen**: The pre-game screen where the player enters their pilot name and starts the game.
- **Chapter_Banner**: The existing center-screen overlay used for in-game announcements (`showChapterBanner()`).

---

## Requirements

### Requirement 1: Victory Screen Display

**User Story:** As a player who has just won SKYBREAK, I want to see a dedicated victory screen after the shatter animation, so that I feel a clear sense of accomplishment before being redirected to the webring.

#### Acceptance Criteria

1. WHEN the shatter animation completes, THE Victory_Screen SHALL appear with a fade-in animation lasting no more than 700ms.
2. THE Victory_Screen SHALL display the text "ESCAPED" as the primary heading with a white glow effect.
3. THE Victory_Screen SHALL display the player's Survival_Time formatted to one decimal place (e.g., `147.3s`).
4. THE Victory_Screen SHALL display the player's Bots_Destroyed count in the format `N/8`.
5. THE Victory_Screen SHALL display the player's Player_Speed in the format `N m/s`.
6. THE Victory_Screen SHALL display a randomized defeated AI message attributed to `[SYSTEM_AI]`.
7. THE Victory_Screen SHALL display a primary call-to-action button labelled "ENTER THE NEXT WORLD" that navigates to the Webring_URL with player parameters appended as query string values.
8. THE Victory_Screen SHALL display a Countdown_Timer counting down from 8 to 0, visible to the player.
9. WHEN the Countdown_Timer reaches 0, THE Victory_Screen SHALL automatically navigate the browser to the Webring_URL with player parameters.
10. THE Victory_Screen SHALL display a secondary "stay in skybreak" button.
11. WHEN the player clicks "stay in skybreak", THE Victory_Screen SHALL be removed from the DOM and the game SHALL reload to the intro screen.
12. THE Victory_Screen SHALL cover the full viewport and render above all other game elements (z-index above the shatter canvas).
13. WHERE the player has no PLAYER_NAME set, THE Victory_Screen SHALL use "anonymous" as the username parameter in the Webring_URL.

---

### Requirement 2: Victory Screen AI Message Pool

**User Story:** As a player, I want the AI's final defeated message to feel personal and varied across runs, so that replaying the game feels fresh.

#### Acceptance Criteria

1. THE Victory_Screen SHALL select one message at random from a pool of at least 6 distinct defeated AI lines each time it is shown.
2. WHERE the player has destroyed all 8 AI bots, THE Victory_Screen SHALL include a message variant that acknowledges the full destruction (e.g., referencing that all bots were destroyed).
3. THE Victory_Screen SHALL display the selected message in a visually distinct style (e.g., italic, pink/magenta color) that differentiates it from the stats block.

---

### Requirement 3: Portal Unlock Announcement

**User Story:** As a player in the middle of combat, I want an unmissable announcement when the exit portal opens, so that I know the win condition has changed and I can act on it immediately.

#### Acceptance Criteria

1. WHEN the portal is unlocked, THE Portal_Unlock_Announcement SHALL display two lines of text: "THE EXIT PORTAL IS OPEN" and "FLY THROUGH THE WHITE RING AHEAD".
2. THE Portal_Unlock_Announcement SHALL be displayed at the center of the screen using the Chapter_Banner system.
3. THE Portal_Unlock_Announcement SHALL remain visible for at least 4000ms.
4. THE Portal_Unlock_Announcement SHALL use a font size or visual weight that is noticeably larger or more prominent than the standard Chapter_Banner text.
5. WHEN the portal is unlocked, THE HUD objective text SHALL update to "→ FLY THROUGH THE GLOWING RING".

---

### Requirement 4: Intro Screen Explainer

**User Story:** As a new player on the intro screen, I want a concise three-step summary of how to win, so that I understand the full game loop before I start.

#### Acceptance Criteria

1. THE Intro_Screen SHALL display the text "DESTROY 8 AI BOTS → THE EXIT RING APPEARS → FLY THROUGH IT TO ESCAPE" as a single line or short block.
2. THE Intro_Screen explainer SHALL be positioned above the "ENTER THE VOID" button and below the existing narrative text.
3. THE Intro_Screen explainer SHALL be visually distinct from the surrounding narrative text (e.g., using the accent/cyan color or a separator).

---

### Requirement 5: Portal Distance Indicator Improvements

**User Story:** As a player navigating toward the portal, I want the distance indicator to be large, attention-grabbing, and context-sensitive, so that I always know how far away the portal is and when to commit to the dive.

#### Acceptance Criteria

1. WHILE the portal is unlocked and visible, THE Portal_Arrow SHALL display the distance in the format `▼ PORTAL: Nm ▼`.
2. WHILE the portal is unlocked and visible, THE Portal_Arrow SHALL use a blinking animation to draw the player's attention.
3. WHILE the portal is unlocked and visible, THE Portal_Arrow SHALL be displayed in cyan color.
4. WHILE the portal distance is greater than 100m, THE Portal_Arrow SHALL display in cyan with the standard blinking animation.
5. WHEN the portal distance drops to 100m or less, THE Portal_Arrow SHALL change its color to red and display the text `▼ DIVE NOW ▼` in place of the distance.
6. THE Portal_Arrow SHALL be rendered at a font size that is noticeably larger than the current 12px default.

---

### Requirement 6: AI Defeated Line Before Shatter

**User Story:** As a player flying through the portal, I want the AI to deliver one final acknowledgment of defeat before the shatter, so that the narrative arc feels complete and emotionally satisfying.

#### Acceptance Criteria

1. WHEN the player triggers a win by flying through the portal, THE AI_Troll SHALL announce a final defeated message before the shatter animation begins.
2. WHERE PLAYER_NAME is set, THE AI_Troll SHALL include the player's name in the defeated message (e.g., `"[name]... you actually did it. i don't know what to do with that."`).
3. WHERE PLAYER_NAME is not set, THE AI_Troll SHALL deliver the defeated message without a name prefix (e.g., `"you actually did it. i don't know what to do with that."`).
4. THE AI_Troll defeated message SHALL be announced with interrupt priority so it is not blocked by any queued speech.
5. THE AI_Troll defeated message SHALL have a display duration of at least 3000ms.

---

### Requirement 7: Webring Redirect Parameters

**User Story:** As the webring operator, I want the redirect from SKYBREAK to carry structured player data as URL parameters, so that the receiving game can personalise the experience for the incoming player.

#### Acceptance Criteria

1. WHEN the player is redirected to the Webring_URL (via button click or auto-countdown), THE Victory_Screen SHALL append the following query parameters: `username`, `speed`, `ref`, `hp`, `color`, `won`.
2. THE `username` parameter SHALL contain the player's PLAYER_NAME, or `"anonymous"` if no name was set.
3. THE `speed` parameter SHALL contain the player's Player_Speed as a rounded integer string.
4. THE `ref` parameter SHALL contain the current page's origin and pathname.
5. THE `hp` parameter SHALL contain the player's remaining health as a rounded-up integer string.
6. THE `color` parameter SHALL be set to `"#00ffff"`.
7. THE `won` parameter SHALL be set to `"true"`.
