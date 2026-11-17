/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { setTimeout as delay } from "node:timers/promises";

import type { Frame, Locator, Page } from "playwright";

export class ProfileScenarios {
  public static readonly STRESS_TITLE: RegExp = /\d[\d,]* messages/;
  private static readonly TYPED: number = 40;
  private static readonly TYPE_PAUSE: number = 60;
  private static readonly SCROLL_STEPS: number = 60;
  private static readonly SCROLL_DELTA: number = -400;
  private static readonly SCROLL_PAUSE: number = 25;
  private static readonly IDLE: number = 5000;
  private static readonly LONG_IDLE: number = 8000;
  private static readonly NEW_CHATS: number = 3;
  private static readonly TAB_ROUNDS: number = 3;
  private static readonly SETTLE: number = 1500;
  private static readonly SHORT_SETTLE: number = 300;
  private static readonly OPEN_LIMIT: number = 60_000;
  private static readonly IMAGE_LIMIT: number = 30_000;
  private static readonly WRITTEN_IMAGE_LIMIT: number = 90_000;
  private static readonly MENU_STEPS: number = 12;
  private static readonly SUBMENU_STEPS: number = 6;
  private static readonly REVEAL_STEPS: number = 80;
  private static readonly REVEAL_SCROLL: number = 500;
  private static readonly STABLE_FRAMES: number = 10;
  private static readonly SETTLE_FRAMES: number = 600;
  private static readonly SETTLE_LIMIT: number = 15_000;
  private static readonly TAB_GROUP: string = "nol-tab-group";
  private static readonly IMAGE_FRAME: string = ".nol-teamrun-image-frame:visible";
  private static readonly VIEWER_IMAGE: string = "nol-teamrun-image-viewer img, .nol-teamrun-image-viewer img";
  private static readonly VIEWPORT: string = "nol-teamrun-history .nol-virtual-list-viewport:visible";

  public readonly names: readonly string[];
  private readonly page: Page;
  private readonly frame: Frame;
  private readonly log: (text: string) => void;
  private readonly all: ReadonlyMap<string, () => Promise<void>>;

  public constructor(page: Page, frame: Frame, log: (text: string) => void) {
    this.page = page;
    this.frame = frame;
    this.log = log;
    this.all = new Map<string, () => Promise<void>>([
      ["idle-start", () => delay(ProfileScenarios.IDLE)],
      ["open-stress", () => this.openStressAsync()],
      ["type-stress", () => this.typeAsync()],
      ["scroll-stress", () => this.scrollAsync()],
      ["idle-stress", () => delay(ProfileScenarios.IDLE)],
      ["new-chats", () => this.newChatsAsync()],
      ["type-short", () => this.typeAsync()],
      ["split-stress", () => this.splitAsync()],
      ["type-all-open", () => this.typeAsync()],
      ["scroll-all-open", () => this.scrollAsync()],
      ["switch-tabs", () => this.switchTabsAsync()],
      ["idle-all-open", () => delay(ProfileScenarios.LONG_IDLE)],
      ["open-image", () => this.openImageAsync(t => t.first(), ProfileScenarios.IMAGE_LIMIT)],
      ["open-written-image-again", () => this.openImageAsync(t => t.last(), ProfileScenarios.WRITTEN_IMAGE_LIMIT)]
    ]);
    this.names = [...this.all.keys()];
  }

  public static async settleFramesAsync(t: { readonly scrollTop: number; readonly scrollHeight: number; querySelectorAll(selectors: string): { readonly length: number } },
    [stable, limit, milliseconds]: readonly [number, number, number], frame: (callback: () => void) => number = requestAnimationFrame,
    cancelFrame: (handle: number) => void = cancelAnimationFrame, wait: (callback: () => void, after: number) => number = setTimeout,
    cancelWait: (handle: number) => void = clearTimeout): Promise<boolean> {
    const deadline = performance.now() + milliseconds;
    let last = "";
    let same = 0;
    for (let count = 0; count < limit && same < stable && performance.now() < deadline; count++) {
      await new Promise<void>(resolve => {
        const next = frame(() => {
          cancelWait(late);
          resolve();
        });
        const late = wait(() => {
          cancelFrame(next);
          resolve();
        }, Math.max(0, deadline - performance.now()));
      });
      const now = `${t.scrollTop}/${t.scrollHeight}/${t.querySelectorAll(".nol-virtual-list-slot").length}`;
      same = now === last ? same + 1 : 0;
      last = now;
    }
    return same >= stable;
  }

  public workOf(name: string): () => Promise<void> {
    return this.all.get(name)!;
  }

  public async revealImageAsync(): Promise<void> {
    const viewport = this.frame.locator(ProfileScenarios.VIEWPORT).first();
    const frames = this.frame.locator(ProfileScenarios.IMAGE_FRAME);
    let atBottom = false;
    for (let i = 0; i < ProfileScenarios.REVEAL_STEPS && !atBottom; i++) {
      await viewport.evaluate((t: HTMLElement) => t.scrollTop = t.scrollHeight);
      await this.settleAsync(viewport);
      atBottom = await viewport.evaluate((t: HTMLElement) => t.scrollTop + t.clientHeight >= t.scrollHeight - 1);
    }
    let atTop = false;
    for (let i = 0; i < ProfileScenarios.REVEAL_STEPS && !atTop && await frames.count() === 0; i++) {
      atTop = await viewport.evaluate((t: HTMLElement, step: number) => {
        t.scrollTop -= step;
        return t.scrollTop === 0;
      }, ProfileScenarios.REVEAL_SCROLL);
      await this.settleAsync(viewport);
    }
    const count = await frames.count();
    if (count === 0)
      throw new Error(`No image preview showed in the history, scrolled ${atBottom ? "from its end" : "without reaching its end"} ${atTop ? "to its start" : `for ${ProfileScenarios.REVEAL_STEPS} steps`}.`);
    this.log(`revealed image previews: ${count}`);
  }

  private get titles(): Locator {
    return this.frame.locator(".nol-teamrun-conversation-title");
  }

  private get tabs(): Locator {
    return this.frame.locator("nol-tab[data-tab-key^='document/']");
  }

  private async openStressAsync(): Promise<void> {
    const row = this.titles.filter({ hasText: ProfileScenarios.STRESS_TITLE }).first();
    if (await row.count() === 0)
      throw new Error("No stress chat in the explorer; run with --seed.");
    await row.dblclick();
    await this.frame.locator(".nol-virtual-list-slot:visible, .empty:visible").first().waitFor({ timeout: ProfileScenarios.OPEN_LIMIT });
    await delay(ProfileScenarios.SETTLE);
  }

  private async typeAsync(): Promise<void> {
    await this.frame.locator("textarea.nol-teamrun-composer-text:visible").first().click();
    for (let i = 0; i < ProfileScenarios.TYPED; i++) {
      await this.page.keyboard.type(String.fromCharCode(97 + i % 26));
      await delay(ProfileScenarios.TYPE_PAUSE);
    }
    await delay(ProfileScenarios.SHORT_SETTLE);
    await this.page.keyboard.press("Control+A");
    await this.page.keyboard.press("Backspace");
    await delay(ProfileScenarios.SHORT_SETTLE);
  }

  private async scrollAsync(): Promise<void> {
    const box = await this.frame.locator(ProfileScenarios.VIEWPORT).first().boundingBox();
    if (box === null)
      throw new Error("No visible history viewport.");
    await this.page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    for (let i = 0; i < ProfileScenarios.SCROLL_STEPS; i++) {
      await this.page.mouse.wheel(0, ProfileScenarios.SCROLL_DELTA);
      await delay(ProfileScenarios.SCROLL_PAUSE);
    }
    await delay(500);
  }

  private async newChatsAsync(): Promise<void> {
    for (let i = 0; i < ProfileScenarios.NEW_CHATS; i++) {
      await this.frame.locator("button.nol-teamrun-action").first().click();
      await delay(ProfileScenarios.SETTLE);
    }
    this.log(`tabs after new chats: ${await this.tabs.count()}`);
  }

  private async splitAsync(): Promise<void> {
    const groups = this.frame.locator(ProfileScenarios.TAB_GROUP);
    const before = await groups.count();
    await this.tabs.filter({ hasText: ProfileScenarios.STRESS_TITLE }).first().focus();
    await this.page.keyboard.press("Shift+F10");
    await this.frame.getByRole("menu").first().waitFor();
    await this.moveToAsync("Split", ProfileScenarios.MENU_STEPS, "ArrowRight");
    await this.frame.getByRole("menuitem", { name: "Split right" }).waitFor();
    await this.moveToAsync("Split right", ProfileScenarios.SUBMENU_STEPS, "Enter");
    await this.frame.waitForFunction(([selector, count]) => document.querySelectorAll(selector).length > count, [ProfileScenarios.TAB_GROUP, before] as const);
    await groups.first().click({ position: { x: 5, y: 5 } });
    await this.openStressAsync();
    this.log(`tabs after split: ${await this.tabs.count()}, groups: ${await groups.count()}`);
  }

  private async moveToAsync(label: string, steps: number, then: string): Promise<void> {
    for (let i = 0; i < steps; i++) {
      if ((await this.frame.evaluate(() => document.activeElement?.textContent ?? "")).includes(label)) {
        await this.page.keyboard.press(then);
        return;
      }
      await this.page.keyboard.press("ArrowDown");
    }
    throw new Error(`The menu didn't reach "${label}" in ${steps} steps.`);
  }

  private async settleAsync(viewport: Locator): Promise<void> {
    const settled = await viewport.evaluate(ProfileScenarios.settleFramesAsync, [ProfileScenarios.STABLE_FRAMES, ProfileScenarios.SETTLE_FRAMES, ProfileScenarios.SETTLE_LIMIT] as const);
    if (!settled)
      throw new Error(`The history didn't settle within ${ProfileScenarios.SETTLE_FRAMES} frames or ${ProfileScenarios.SETTLE_LIMIT / 1000} s.`);
  }

  private async switchTabsAsync(): Promise<void> {
    const count = await this.tabs.count();
    for (let round = 0; round < ProfileScenarios.TAB_ROUNDS; round++)
      for (let i = 0; i < count; i++) {
        await this.tabs.nth(i).click();
        await delay(400);
      }
  }

  private async openImageAsync(pick: (frames: Locator) => Locator, limit: number): Promise<void> {
    const frames = this.frame.locator(ProfileScenarios.IMAGE_FRAME);
    if (await frames.count() === 0)
      throw new Error("No visible image.");
    const started = Date.now();
    await pick(frames).click();
    await this.frame.locator(ProfileScenarios.VIEWER_IMAGE).first().waitFor({ timeout: limit });
    this.log(`the image viewer showed its image after ${Date.now() - started} ms`);
    await this.page.keyboard.press("Escape");
    await delay(500);
  }
}
