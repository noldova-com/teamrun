/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { expect, type Page } from "playwright/test";

import { TeamRunApp, test } from "./fixtures/teamrun-app.fixture.ts";

const TOLERANCE_REM: number = 0.01;

interface IMeasuredChat {
  readonly chat: number;
  readonly members: number;
  readonly memberControl: number;
  readonly memberMargin: number;
  readonly history: number;
  readonly composer: number;
  readonly composerEnd: number;
  readonly textMinimum: number;
  readonly textMaximum: number;
  readonly line: number;
  readonly space1: number;
  readonly space2: number;
  readonly space3: number;
  readonly space6: number;
}

async function measureAsync(page: Page, width: number, height: number): Promise<IMeasuredChat> {
  await page.setViewportSize({ width, height });
  let previous = String.empty;
  const unsettled = async (): Promise<string> => {
    const shown = JSON.stringify([await page.evaluate(() => `${innerWidth}×${innerHeight}`), await readAsync(page)]);
    const isSettled = shown === previous && shown.startsWith(`["${width}×${height}"`);
    previous = shown;
    return isSettled ? String.empty : shown;
  };
  await expect.poll(unsettled, { message: `the chat laid out again in a ${width}×${height} window`, ...TeamRunApp.pollOf(30_000) }).toBe(String.empty);
  return readAsync(page);
}

function readAsync(page: Page): Promise<IMeasuredChat> {
  return page.evaluate(() => {
    const rem = Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
    const one = (selector: string): Element => {
      const found = document.querySelector(selector);
      if (Object.isNull(found))
        throw new Error(`The chat has no ${selector} to measure.`);
      return found;
    };
    const height = (selector: string): number => one(selector).getBoundingClientRect().height / rem;
    const length = (value: string): number => Number.parseFloat(value) / rem;
    const space = (step: number): number => {
      const probe = document.createElement("div");
      probe.style.height = `var(--nol-space-${step})`;
      document.body.append(probe);
      const measured = probe.getBoundingClientRect().height / rem;
      probe.remove();
      return measured;
    };
    const text = getComputedStyle(one(".nol-teamrun-composer-text"));
    return {
      chat: height("nol-teamrun-conversation"),
      members: height("nol-teamrun-conversation-members"),
      memberControl: height("nol-teamrun-conversation-members .nol-teamrun-add-member"),
      memberMargin: length(getComputedStyle(one("nol-teamrun-conversation-members .nol-teamrun-add-member")).marginTop),
      history: height("nol-teamrun-conversation .history"),
      composer: height("nol-teamrun-composer"),
      composerEnd: length(getComputedStyle(one("form.nol-teamrun-composer")).paddingBottom),
      textMinimum: length(text.minHeight),
      textMaximum: length(text.maxHeight),
      line: length(text.lineHeight),
      space1: space(1),
      space2: space(2),
      space3: space(3),
      space6: space(6)
    };
  });
}

function expectRem(actual: number, expected: number, what: string): void {
  expect(Math.abs(actual - expected), `${what}: ${actual} rem against ${expected} rem`).toBeLessThan(TOLERANCE_REM);
}

test("a chat keeps its members bar and composer at their size on Desktop's default 1280×800 window, and on a 905×616 window they give way so the history is the chat's largest part",
  async ({ app }) => {
    const page = await app.openChatAsync();

    const wide = await measureAsync(page, 1280, 800);
    const small = await measureAsync(page, 905, 616);

    expect([wide.chat >= 25, small.chat < 25], `the chat's ${wide.chat} rem at 1280×800 and ${small.chat} rem at 905×616: ${JSON.stringify([wide, small])}`)
      .toEqual([true, true]);
    expectRem(wide.members, wide.memberControl + 2 * wide.space2, "the members bar at 1280×800");
    expectRem(wide.composerEnd, wide.space6, "the composer's end padding at 1280×800");
    expectRem(wide.textMinimum, 2 * wide.line + wide.space3, "the message box's least height at 1280×800");
    expectRem(wide.textMaximum, 10 * wide.line + wide.space3, "the message box's greatest height at 1280×800");
    expectRem(small.members, small.memberControl + 2 * small.space1, "the members bar at 905×616");
    expectRem(small.composerEnd, small.space2, "the composer's end padding at 905×616");
    expectRem(small.textMinimum, small.line + small.space3, "the message box's least height at 905×616");
    expectRem(small.textMaximum, 4 * small.line + small.space3, "the message box's greatest height at 905×616");
    expectRem(small.history, small.chat - small.members - small.composer, "the history at 905×616");
    expect(small.history, `the history's ${small.history} rem against the members bar's and composer's ${small.members + small.composer} rem`)
      .toBeGreaterThan(small.members + small.composer);
  });

test("with a larger text size, a 19.2 px root, the members bar and composer give way on a chat under 25 rem, though it is taller than the 400 px where they give way with the default 16 px root",
  async ({ app }) => {
    const page = await app.openChatAsync();
    const root = await page.evaluate(() => {
      const plain = Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
      document.documentElement.style.fontSize = "19.2px";
      return plain;
    });
    const wide = await measureAsync(page, 1280, 800);
    const short = await measureAsync(page, 1280, 700);
    const windowFor = (chat: number): number => 700 + Math.round((chat - short.chat) * 100 / (wide.chat - short.chat));

    const kept = await measureAsync(page, 1280, windowFor(25.5));
    const small = await measureAsync(page, 1280, windowFor(24.5));

    expect([root, kept.chat >= 25, small.chat < 25, small.chat * 19.2 > 25 * root],
      `the chat's ${kept.chat} rem at 1280×${windowFor(25.5)} and ${small.chat} rem at 1280×${windowFor(24.5)} with a 19.2 px root`)
      .toEqual([16, true, true, true]);
    expectRem(kept.memberMargin, kept.space2, `the members bar's margin on a ${kept.chat} rem chat`);
    expectRem(kept.composerEnd, kept.space6, `the composer's end padding on a ${kept.chat} rem chat`);
    expectRem(kept.textMaximum, 10 * kept.line + kept.space3, `the message box's greatest height on a ${kept.chat} rem chat`);
    expectRem(small.memberMargin, small.space1, `the members bar's margin on a ${small.chat} rem chat`);
    expectRem(small.composerEnd, small.space2, `the composer's end padding on a ${small.chat} rem chat`);
    expectRem(small.textMaximum, 4 * small.line + small.space3, `the message box's greatest height on a ${small.chat} rem chat`);
  });
