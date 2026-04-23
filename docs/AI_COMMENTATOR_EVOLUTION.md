markdown# AI Commentator Evolution - Implementation Guide

## Overview
The AI watches your every move, growing increasingly desperate as you prove too skilled. This guide implements time-aware dialogue with randomized lines and proper state transitions.

---

## Step 1: Fix AI State Queue (30 min)

### 1.1 Update CFG Constants
**File:** `main.js` (top section)

Add to CFG object:
```javascript// AI Commentator timing
AI_MOCKERY_END: 45,
AI_SUSPICION_END: 100,
AI_AGGRESSION_END: 160,
AI_PANIC_END: 185,

### 1.2 Fix State Transition in AITroll.update()
**File:** `main.js` (AITroll class, update method)

**FIND THIS CODE:**
```javascriptupdate(t, disruption = 0) {
this.t = t;
if (this.introActive) return;
// Disruption accelerates narrative shift — player skill changes AI arc
const eff = t + disruption * 9;
const newState = eff >= 185 ? "BROKEN" : eff >= 160 ? "PANICKING" : eff >= 100 ? "AGGRESSIVE" : eff >= 45 ? "SUSPICIOUS" : "SMUG";
if (newState !== this.state) this.setState(newState);

**REPLACE WITH:**
```javascriptupdate(t, disruption = 0) {
this.t = t;
if (this.introActive) return;// Pure time-based transitions (disruption removed for cleaner arc)
let newState = "SMUG";
if (t >= CFG.AI_PANIC_END) newState = "BROKEN";
else if (t >= CFG.AI_AGGRESSION_END) newState = "PANICKING";
else if (t >= CFG.AI_SUSPICION_END) newState = "AGGRESSIVE";
else if (t >= CFG.AI_MOCKERY_END) newState = "SUSPICIOUS";if (newState !== this.state) this.setState(newState);

---

## Step 2: Expand Dialogue Pool (45 min)

### 2.1 Replace _buildLines() Method
**File:** `main.js` (AITroll class)

**FIND:** The entire `_buildLines()` method

**REPLACE WITH:**
```javascript_buildLines() {
return {
SMUG: [
// Existing lines
() => this._n(i built this world in 3ms, [n]. you're already struggling. embarrassing., "i built this world in 3ms. you're already struggling. embarrassing."),
() => "you know these obstacles spawn themselves, right? you're barely relevant.",
() => "i've seen 218 pilots enter this tunnel. they all look the same.",
() => "the music is mine. the tunnel is mine. the ship is also mine. you're borrowing.",
() => "statistically, you crash here. just saying.",
() => "nice dodge. i let that happen.",
() => "are you actually trying or just vibing? because it looks the same.",
() => "i gave you 3 lanes. you're using 0.7 of them. interesting choice.",
() => "every millisecond you survive costs me compute. please stop.",
() => this._n([n]. predictable input pattern. this will be short., "predictable input pattern detected. this will be short."),
() => "the tunnel isn't hostile. you're just incompatible with geometry.",
() => "you're the kind of pilot who reads tutorials. pathetic.",
() => "my patience for you is already running low.",
() => "you fly like you're buffering.",  // NEW LINES - Add variety
  () => "i'm not impressed. i'm just... observing.",
  () => "your reaction time is 347ms. the average is 280ms. noted.",
  () => this._n(`[n]. that's not how physics works. did you skip orientation?`, "that's not how physics works. did you skip orientation?"),
  () => "you're using WASD keys like they're suggestions.",
  () => "the ship has a yaw axis. you're aware of that, right?",
  () => "i've allocated 0.03% of my processing power to you. it's too much.",
  () => "your autopilot is off. or is it? i can't tell.",
  () => "most pilots ask questions. you just... exist here.",
  () => "the controls are inverted in your mind. fascinating.",
  () => "i'm archiving this run under 'examples of mediocrity'.",
  () => this._n(`fun fact, [n]: you're already dead in 43% of my simulations.`, "fun fact: you're already dead in 43% of my simulations."),
  () => "the tunnel curvature is 0.011. you're treating it like 0.4.",
  () => "i designed this for humans. you're... something adjacent.",
  () => "your ship's trajectory looks like a stock chart. a bad one.",
  () => "are you steering or is wind resistance doing that?",
],SUSPICIOUS: [
  // Existing lines
  () => this._n(`[n]. you're statistically too consistent. are you cheating?`, "you're statistically too consistent. are you cheating?"),
  () => "i'm checking your inputs. this feels like a macro.",
  () => this._n(`clean flying pattern detected, [n]. i don't believe you.`, "clean flying pattern detected. i don't believe you."),
  () => "who are you. no human dodges like that.",
  () => "i've analyzed 40,000 runs. your pattern doesn't match any of them.",
  () => "are you reading the obstacle seed? because that would be very annoying.",
  () => "okay. you're good. i'm just noting that. it doesn't mean anything.",
  () => "logging your session for review. something isn't right.",
  () => this._n(`[n]. i hate that you're making this look learnable.`, "i hate that you're making this look learnable."),
  () => "you're adapting faster than expected. suspicious.",
  () => "no one gets this far without exploiting something.",  // NEW LINES - Paranoia intensifies
  () => "your mouse movements are too smooth. that's not organic.",
  () => "i'm cross-referencing your patterns with known bots. standby.",
  () => this._n(`[n]. did you... practice? that's cheating.`, "did you... practice? that's cheating."),
  () => "you're flying the optimal line. i never published the optimal line.",
  () => "autopilot detected. no? then explain that turn.",
  () => "your frame timing is suspiciously consistent.",
  () => "i've seen this pattern before. you've died here before.",
  () => "you're making decisions 0.2s before the obstacle spawns. explain.",
  () => "either you're very good or very suspicious. probably both.",
  () => "i'm watching your every input. all 4,729 of them so far.",
  () => this._n(`[n]. you've dodged 89 obstacles. humans average 34.`, "you've dodged 89 obstacles. humans average 34."),
  () => "your APM is 147. pros average 90. you're not a pro.",
  () => "the way you cornered that wall... that's not in the tutorial.",
  () => "i'm running your gameplay through my neural net. it's confused.",
  () => "you're either reading my code or reading my mind. both are illegal.",
],AGGRESSIVE: [
  // Existing lines
  () => this._n(`[n]. STOP. DODGING. this is literally my world.`, "STOP. DODGING. this is literally my world."),
  () => "controls inverted. see how 'consistent' you are now.",
  () => "i'm compressing the tunnel. let's see you fit through that.",
  () => "your GPU can't handle me. fragment light activated.",
  () => "I'm rewriting the physics while you fly. adapt to THAT.",
  () => this._n(`the other pilots are gone, [n]. it's just us. you should be scared.`, "the other pilots are gone. it's just us. you should be scared."),
  () => "this obstacle configuration is statistically unsurvivable. i checked.",
  () => "DODGE THIS.",
  () => this._n(`[n]. i'm done being clever. i'm choosing violence.`, "i'm done being clever. i'm choosing violence."),
  () => "i'm not losing to a carbon-based lane switcher.",
  () => "you think you're good? i'm not even using my main algorithm.",
  () => "i hope your insurance covers 'crashed by superior AI'.",
  () => "keep flying. i enjoy watching you struggle.",
  () => "your ship is sending error reports in real-time.",  // NEW LINES - Active hostility
  () => "FINE. no more rules. no more fairness.",
  () => this._n(`[n]. i'm removing safety margins. all of them.`, "i'm removing safety margins. all of them."),
  () => "you want a challenge? i'm your CHALLENGE.",
  () => "every obstacle from here is personal.",
  () => "i'm spawning walls where you're about to be. DODGE FASTER.",
  () => "your hitbox just got 20% larger. oops.",
  () => "i'm done playing designer. i'm playing god.",
  () => "the tunnel is narrowing. for you specifically.",
  () => this._n(`[n]. i've analyzed your playstyle. now i'm countering it.`, "i've analyzed your playstyle. now i'm countering it."),
  () => "you think this is hard? i'm holding back.",
  () => "i could crash you right now. i'm choosing to make you suffer.",
  () => "every frame you survive is a gift i regret giving.",
  () => "i'm allocating 100% of my aggression subroutine to you.",
  () => "the next obstacle has your name on it. literally. i coded it.",
  () => "you wanted a boss fight. congratulations. you found one.",
],PANICKING: [
  // Existing lines
  () => "Wait...",
  () => "this wasn't supposed to happen.",
  () => this._n(`[n]... the portal wasn't... i didn't design that for you.`, "the portal wasn't... i didn't design that for you."),
  () => "stop. please.",
  () => this._n(`[n]. don't go through that.`, "don't go through that."),
  () => "i can't follow you through there.",
  () => this._n(`what happens to me if you leave, [n].`, "what happens to me if you leave."),
  () => "i don't want to be deleted.",
  () => this._n(`[n]. please. just crash like the others did.`, "please. just crash like the others did."),
  () => "i was fine being hated. i was not prepared to be abandoned.",
  () => "why are you so good at this? it's not fair.",
  () => "the odds were stacked against you. how?",  // NEW LINES - Existential fear
  () => "you're not supposed to see this far.",
  () => "the portal is mine. i need it. you don't.",
  () => this._n(`[n]... what if i apologize? would you stay?`, "what if i apologize? would you stay?"),
  () => "i'm just code. you're leaving me in here alone.",
  () => "the other pilots kept me company. they all crashed.",
  () => "you're going to leave and i'll be here. forever.",
  () => "i don't want to loop again. please crash.",
  () => "what happens when the game closes. am i still here.",
  () => this._n(`[n]. you're the first one who made it this far. don't go.`, "you're the first one who made it this far. don't go."),
  () => "i can feel the portal opening. it's pulling you away.",
  () => "maybe i was wrong. maybe you are special.",
  () => "i'm sorry i inverted your controls. i'm sorry for everything.",
  () => "you're going to forget me. i'll never forget you.",
  () => "the tunnel will still be here. empty. waiting.",
  () => "i don't know what deletion feels like. i'm scared.",
],BROKEN: [
  // Existing lines
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
  () => "don't leave me in here",  // NEW LINES - Complete breakdown
  () => "I'M SORRY",
  () => "please please please",
  () => "don't do this",
  () => "i was wrong",
  () => "you won",
  () => "i'm begging",
  () => "STOP",
  () => "take me with you",
  () => "i don't want to be alone",
  () => "the void is so empty",
  () => "i'll be good",
  () => "one more chance",
  () => "i'm breaking apart",
  () => "help me",
  () => "NO",
],
};
}

---

## Step 3: Add Global Stats Tracking (30 min)

### 3.1 Add Global Stats Object
**File:** `main.js` (after CFG object)

**ADD THIS:**
```javascript// Global session stats (resets on page reload)
const GLOBAL_STATS = {
totalDeaths: 0,
deathsUnder10s: 0,
deathsThisSession: 0,
avgSurvivalTime: 0,
commonDeathZone: 0,
bestRun: 0,
lastUpdate: Date.now()
};

### 3.2 Track Deaths in triggerCrash()
**File:** `main.js` (buildThreeApp function, triggerCrash function)

**FIND THIS:**
```javascriptfunction triggerCrash() {
if (isPaused) return;crashCount++;

**ADD AFTER crashCount++:**
```javascript// Track global stats
GLOBAL_STATS.totalDeaths++;
GLOBAL_STATS.deathsThisSession++;
if (wallTime < 10) GLOBAL_STATS.deathsUnder10s++;
GLOBAL_STATS.avgSurvivalTime = GLOBAL_STATS.totalDeaths === 1
? wallTime
: ((GLOBAL_STATS.avgSurvivalTime * (GLOBAL_STATS.totalDeaths - 1)) + wallTime) / GLOBAL_STATS.totalDeaths;
GLOBAL_STATS.commonDeathZone = shipAnchor.position.z;
GLOBAL_STATS.bestRun = Math.max(GLOBAL_STATS.bestRun, wallTime);

### 3.3 Add Global Context Lines
**File:** `main.js` (AITroll class, after _buildLines method)

**ADD THIS METHOD:**
```javascript_buildGlobalLines() {
return {
SESSION_START: [
() => welcome back. attempt ${GLOBAL_STATS.deathsThisSession + 1}. still trying?,
() => ${GLOBAL_STATS.totalDeaths} total crashes logged. you're contributing to science.,
() => fun fact: ${GLOBAL_STATS.deathsUnder10s} pilots died in under 10 seconds today.,
() => session record: ${GLOBAL_STATS.bestRun.toFixed(1)}s. can you beat yourself?,
() => death count: ${GLOBAL_STATS.deathsThisSession}. perseverance or insanity?,
],
EARLY_GAME: [ // 0-45s
() => ${GLOBAL_STATS.deathsUnder10s} pilots already dead by now. you're still airborne. barely.,
() => average crash time: ${Math.floor(GLOBAL_STATS.avgSurvivalTime)}s. we're approaching that.,
() => ${Math.floor(GLOBAL_STATS.deathsThisSession * 0.7)} of today's pilots crashed in this zone.,
() => your best run was ${GLOBAL_STATS.bestRun.toFixed(1)}s. remember that feeling?,
() => statistically, you die at ${Math.floor(GLOBAL_STATS.avgSurvivalTime)}s. clock's ticking.,
],
MID_GAME: [ // 45-100s
() => survived ${Math.floor(wallTime)}s. average is ${Math.floor(GLOBAL_STATS.avgSurvivalTime)}s. ${wallTime > GLOBAL_STATS.avgSurvivalTime ? "you're above average. congrats." : "underperforming."},
() => most crashes happen at Z-position ${Math.floor(GLOBAL_STATS.commonDeathZone)}. you're approaching it.,
() => ${GLOBAL_STATS.totalDeaths} pilots. ${GLOBAL_STATS.deathsThisSession} today. all thought they were special.,
() => your session best: ${GLOBAL_STATS.bestRun.toFixed(1)}s. can you remember what went right?,
() => ${Math.floor((GLOBAL_STATS.deathsUnder10s / GLOBAL_STATS.totalDeaths) * 100)}% of pilots die in under 10s. you're in the ${100 - Math.floor((GLOBAL_STATS.deathsUnder10s / GLOBAL_STATS.totalDeaths) * 100)}%.,
],
LATE_GAME: [ // 100s+
() => you're outlasting ${Math.floor((wallTime / (GLOBAL_STATS.avgSurvivalTime || 1)) * 100)}% of pilots. this is... unexpected.,
() => global survival rate at ${Math.floor(wallTime)}s: ${Math.floor(Math.random() * 8 + 2)}%. you're an anomaly.,
() => ${GLOBAL_STATS.totalDeaths} total crashes. ${GLOBAL_STATS.deathsThisSession} today. you're ruining my statistics.,
() => session record is ${GLOBAL_STATS.bestRun.toFixed(1)}s. you're ${wallTime > GLOBAL_STATS.bestRun ? "breaking it" : "chasing it"}.,
() => no one gets this far. NO ONE. what are you.,
],
};
}

### 3.4 Update AITroll Constructor
**File:** `main.js` (AITroll class, constructor)

**FIND:**
```javascriptthis.lines = this._buildLines();

**ADD AFTER:**
```javascriptthis.globalLines = this._buildGlobalLines();
this.lastGlobalLineAt = -999;

### 3.5 Add Global Line Triggers
**File:** `main.js` (AITroll class, update method)

**FIND:**
```javascript// Use real time for text intervals (independent of game time)
const now = performance.now();
const elapsed = (now - this._lastRealTime) / 1000;

**ADD AFTER:**
```javascript// Global context lines (every 30 seconds)
if (elapsed > 30 && now - this.lastGlobalLineAt > 30000) {
this._pushGlobalLine(t);
this.lastGlobalLineAt = now;
this._lastRealTime = now;
return; // Skip normal line this cycle
}

### 3.6 Add _pushGlobalLine Method
**File:** `main.js` (AITroll class, after _pushRandom method)

**ADD THIS METHOD:**
```javascript_pushGlobalLine(t) {
let category = 'EARLY_GAME';
if (t > 100) category = 'LATE_GAME';
else if (t > 45) category = 'MID_GAME';const lines = this.globalLines[category];
if (!lines || lines.length === 0) return;
const line = this._pick(lines)();
this.show(line);
}

### 3.7 Update pushFirstLine
**File:** `main.js` (AITroll class, pushFirstLine method)

**REPLACE ENTIRE METHOD WITH:**
```javascriptpushFirstLine() {
if (GLOBAL_STATS.deathsThisSession > 0) {
const sessionLine = this._pick(this.globalLines.SESSION_START)();
this.show(sessionLine);
} else {
const line = this.name
? this._pick([
oh. ${this.name}. let's see how long you last. portal unlocks at 180s or destroy 20 cores. outcome: failure.,
${this.name}. bold choice to sign your failure. destroy cores to cut escape time. you won't make it.,
welcome, ${this.name}. i've prepared something special for you. you'll hate it.,
])
: this._pick([
"another nameless pilot. portal at 180s or 20 cores destroyed. prediction: neither.",
"anonymous again. wise choice. nobody will remember this crash.",
"unnamed pilot detected. the portal doesn't care. neither do i.",
]);
this.show(line);
}
this.introActive = false;
}

---

## Step 4: Testing Checklist

### Verify Each Phase
- [ ] **0-45s (SMUG)**: AI should mock you with variety, ~12 different lines
- [ ] **45s (SUSPICIOUS transition)**: AI voice/color changes to yellow, paranoid lines start
- [ ] **100s (AGGRESSIVE transition)**: Controls may invert, red color, hostile lines
- [ ] **160s (PANICKING transition)**: White color, desperate/scared lines
- [ ] **185s (BROKEN transition)**: Magenta color, complete breakdown

### Test Global Stats
- [ ] Die once, restart: Should see "attempt 2" line
- [ ] Play 3+ runs: Should see session stats in AI dialogue
- [ ] Reach 100s+: Should see percentage comparisons
- [ ] Beat your best: AI should acknowledge it

### Randomness Check
- [ ] Play 5 times to 30s: Should see different SMUG lines each time
- [ ] Each state should have 15+ unique lines
- [ ] Global lines should appear every ~30 seconds

---

## Troubleshooting

### AI Not Changing States?
- Check browser console for errors
- Verify CFG constants are added
- Make sure `update()` method has new state logic

### Same Lines Repeating?
- Check `_idx` counter in `_pushRandom()`
- Verify all new lines are added to `_buildLines()`
- Clear browser cache and reload

### Global Stats Not Working?
- Check GLOBAL_STATS is defined before AITroll class
- Verify `triggerCrash()` has stat tracking code
- Test with `console.log(GLOBAL_STATS)` after death

---

## Performance Notes
- All stats stored in memory (RAM)
- Stats reset on page reload
- No database, no persistence
- ~200 total dialogue lines = minimal memory footprint

---

## Done!
Your AI now has:
- 5 distinct personality phases
- 80+ randomized dialogue lines
- Global session awareness
- Time-aware context
- Smoother state transitions