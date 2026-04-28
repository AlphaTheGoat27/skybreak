/**
 * Victory Screen Tests — Task 5: Intro Explainer
 *
 * Validates that the three-step explainer is present in both intro screen
 * locations (#mode-select and #intro-hint) in main.js.
 *
 * Validates: Requirements 4.1, 4.2, 4.3
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

// Read main.js source to verify the static HTML template
const mainJsSrc = readFileSync(resolve(process.cwd(), "main.js"), "utf-8");

const EXPLAINER_TEXT = "DESTROY 8 AI BOTS → THE EXIT RING APPEARS → FLY THROUGH IT TO ESCAPE";

// ─────────────────────────────────────────────────────────────────────────────
// Task 5.1 — Intro Explainer Presence
// ─────────────────────────────────────────────────────────────────────────────

describe("Task 5.1 — Intro explainer presence in main.js HTML template", () => {
  /**
   * Validates: Requirements 4.1
   *
   * The three-step explainer must appear in the #mode-select block.
   */
  it("#mode-select block contains the three-step explainer text", () => {
    // Find the #mode-select section
    const modeSelectStart = mainJsSrc.indexOf('id="mode-select"');
    expect(modeSelectStart).toBeGreaterThan(-1);

    // Find the end of the mode-select div (next major section)
    const modeSelectEnd = mainJsSrc.indexOf('id="intro-hint"', modeSelectStart);
    expect(modeSelectEnd).toBeGreaterThan(modeSelectStart);

    const modeSelectBlock = mainJsSrc.slice(modeSelectStart, modeSelectEnd);
    expect(modeSelectBlock).toContain(EXPLAINER_TEXT);
  });

  /**
   * Validates: Requirements 4.2
   *
   * The three-step explainer must also appear in the #intro-hint block (solo form step).
   */
  it("#intro-hint block contains the three-step explainer text", () => {
    // Find the #intro-hint section
    const introHintStart = mainJsSrc.indexOf('id="intro-hint"');
    expect(introHintStart).toBeGreaterThan(-1);

    // Find the end of the intro-hint div (next major section: intro-form)
    const introHintEnd = mainJsSrc.indexOf('id="intro-form"', introHintStart);
    expect(introHintEnd).toBeGreaterThan(introHintStart);

    const introHintBlock = mainJsSrc.slice(introHintStart, introHintEnd);
    expect(introHintBlock).toContain(EXPLAINER_TEXT);
  });

  /**
   * Validates: Requirements 4.3
   *
   * The explainer div must use the .intro-narrative.accent class and appear
   * after the "REACH THE PORTAL BEFORE THE VOID TAKES YOU" line.
   */
  it("explainer appears after the REACH THE PORTAL narrative line in #mode-select", () => {
    const modeSelectStart = mainJsSrc.indexOf('id="mode-select"');
    const modeSelectEnd = mainJsSrc.indexOf('id="intro-hint"', modeSelectStart);
    const modeSelectBlock = mainJsSrc.slice(modeSelectStart, modeSelectEnd);

    const reachPortalIdx = modeSelectBlock.indexOf("REACH THE PORTAL BEFORE THE VOID TAKES YOU");
    const explainerIdx = modeSelectBlock.indexOf(EXPLAINER_TEXT);

    expect(reachPortalIdx).toBeGreaterThan(-1);
    expect(explainerIdx).toBeGreaterThan(reachPortalIdx);
  });

  it("explainer appears after the REACH THE PORTAL narrative line in #intro-hint", () => {
    const introHintStart = mainJsSrc.indexOf('id="intro-hint"');
    const introHintEnd = mainJsSrc.indexOf('id="intro-form"', introHintStart);
    const introHintBlock = mainJsSrc.slice(introHintStart, introHintEnd);

    const reachPortalIdx = introHintBlock.indexOf("REACH THE PORTAL BEFORE THE VOID TAKES YOU");
    const explainerIdx = introHintBlock.indexOf(EXPLAINER_TEXT);

    expect(reachPortalIdx).toBeGreaterThan(-1);
    expect(explainerIdx).toBeGreaterThan(reachPortalIdx);
  });

  it("explainer div uses intro-narrative accent class", () => {
    const occurrences = [];
    let searchFrom = 0;
    while (true) {
      const idx = mainJsSrc.indexOf(EXPLAINER_TEXT, searchFrom);
      if (idx === -1) break;
      // Look back ~200 chars for the opening tag
      const snippet = mainJsSrc.slice(Math.max(0, idx - 200), idx);
      occurrences.push(snippet);
      searchFrom = idx + 1;
    }

    // Should appear exactly twice (once in #mode-select, once in #intro-hint)
    expect(occurrences.length).toBe(2);

    // Each occurrence should be preceded by a div with intro-narrative accent class
    for (const snippet of occurrences) {
      expect(snippet).toMatch(/intro-narrative accent/);
    }
  });
});
