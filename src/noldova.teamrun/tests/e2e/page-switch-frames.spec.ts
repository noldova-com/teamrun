/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { JsonReader } from "@noldova/context.json";
import { expect, type Locator } from "playwright/test";

import { CodexDouble } from "./fixtures/codex-double.ts";
import { TeamRunApp, test } from "./fixtures/teamrun-app.fixture.ts";

interface IRegion {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

interface ICall {
  readonly at: number;
  readonly isVisible: boolean;
  readonly bounds: IRegion;
}

interface IFrame {
  readonly at: number;
  readonly kind: "page" | "chat" | "other";
}

interface IRecord {
  readonly calls: readonly ICall[];
  readonly frames: readonly IFrame[];
  readonly others: readonly string[];
  readonly differences: readonly string[];
  readonly atRest: readonly string[];
}

interface IRecentFrame {
  readonly at: number;
  readonly bitmap: Buffer;
  readonly png: () => Buffer;
}

interface IUnmatchedFrame {
  readonly bitmap: Buffer;
  readonly width: number;
  readonly png: () => Buffer;
}

interface ISwitchRecorder {
  area: IRegion | null;
  width: number;
  page: Buffer | null;
  chat: Buffer | null;
  recent: readonly IRecentFrame[];
  tick: number;
  readonly frames: IFrame[];
  readonly unmatched: IUnmatchedFrame[];
  readonly atRest: string[];
}

class SwitchMark {
  public readonly start: number;
  public readonly end: number;

  public constructor(start: number, end: number) {
    this.start = start;
    this.end = end;
  }
}

class SwitchResult {
  public readonly hides: number;
  public readonly isShownFirst: boolean;
  public readonly bounds: IRegion | null;

  public constructor(hides: number, isShownFirst: boolean, bounds: IRegion | null) {
    this.hides = hides;
    this.isShownFirst = isShownFirst;
    this.bounds = bounds;
  }
}

declare global {
  var nolSwitchRecorder: ISwitchRecorder | undefined;
  var nolViewCalls: ICall[] | undefined;
}

const regionOf = (reader: JsonReader): IRegion => ({
  x: reader.readNumber("x"), y: reader.readNumber("y"), width: reader.readNumber("width"), height: reader.readNumber("height")
});
const recordOf = (reader: JsonReader): IRecord => ({
  calls: reader.readObjectArray("calls").map(t => ({ at: t.readNumber("at"), isVisible: t.readBoolean("isVisible"), bounds: regionOf(t.readObject("bounds")) })),
  frames: reader.readObjectArray("frames").map(t => ({ at: t.readNumber("at"), kind: t.readOneOf("kind", ["page", "chat", "other"]) })),
  others: reader.readStringArray("others"),
  differences: reader.readStringArray("differences"),
  atRest: reader.readStringArray("atRest")
});

const SWITCHES: number = 10;
const VIEW: string = "nol-teamrun-page-document .nol-teamrun-page-view > .nol-web-view";
const STILL_STYLE: string = "*, *::before, *::after { animation: none !important; transition: none !important; caret-color: transparent !important; "
  + "scroll-behavior: auto !important; scrollbar-width: none !important; } nol-teamrun-page-card .meta, nol-teamrun-pages-view .meta { visibility: hidden !important; }";

test("a switch from a chat's tab to its page's tab shows the page's view before the window presents a frame of the page's tab, at the placeholder's bounds, "
  + "with no hide, over 10 switches", async ({ app }, testInfo) => {
  const page = await app.openChatAsync();
  const folder = path.join(app.work, "site");
  mkdirSync(folder);
  writeFileSync(path.join(folder, "options.html"), "<!doctype html><title>Options</title><h1>Draft</h1>");
  const opened = app.run(["teamrun", "open-folder", folder, "--json"]);
  const projectId = /"id":"([0-9a-f-]{36})"/.exec(opened)?.[1];
  expect(projectId, opened).toBeDefined();
  const created = app.run(["teamrun", "new-chat", String(projectId), "--title", "Onboarding", "--json"]);
  const chatId = /"id":"([0-9a-f-]{36})"/.exec(created)?.[1];
  expect(chatId, created).toBeDefined();
  await page.getByRole("treeitem", { name: /Onboarding/ }).first().click({ timeout: 60_000 });
  const panel = page.getByRole("tabpanel", { name: "Onboarding", exact: true });
  await expect(panel.getByRole("combobox", { name: "Message", exact: true })).toBeEditable({ timeout: 60_000 });
  await app.submitAsync(`${CodexDouble.PAGE_PREFIX}options.html`);
  const pageTab = page.getByRole("tab", { name: CodexDouble.PAGE_TITLE, exact: true });
  const chatTab = page.getByRole("tab", { name: "Onboarding", exact: true });
  await expect(pageTab).toBeVisible({ timeout: 60_000 });
  for (const name of ["Providers", "New chat"]) {
    await TeamRunApp.showTabAsync(page, name);
    await page.getByRole("button", { name: `Close ${name}`, exact: true }).click();
    await expect(TeamRunApp.tabOf(page, name)).toHaveCount(0);
  }
  await expect(chatTab).toBeVisible();
  await chatTab.click();
  await expect(panel.getByText(/^page: v1 made by \S/u)).toBeVisible({ timeout: 60_000 });
  await expect(panel.getByRole("button", { name: "Send", exact: true })).toBeVisible({ timeout: 60_000 });
  await pageTab.click();
  await expect(page.locator("nol-teamrun-page-document .nol-teamrun-page-authors")).toHaveText(/^v1 · Made by \S/u, { timeout: 60_000 });

  await app.electronApp.evaluate(async ({ webContents }, { address, style }) => {
    const window = webContents.getAllWebContents().find(t => t.getURL() === address);
    if (Object.isUndefined(window))
      throw new Error(`No web contents shows ${address}.`);
    await window.insertCSS(style);
    const recorder: ISwitchRecorder = { area: null, width: 0, page: null, chat: null, recent: [], tick: 0, frames: [], unmatched: [], atRest: [] };
    window.beginFrameSubscription(false, image => {
      const at = performance.timeOrigin + performance.now();
      if (Object.isNull(recorder.area) || recorder.width === 0)
        return;
      const scale = image.getSize().width / recorder.width;
      const inset = 2;
      const region = {
        x: Math.ceil((recorder.area.x + inset) * scale), y: Math.ceil((recorder.area.y + inset) * scale),
        width: Math.floor((recorder.area.width - 2 * inset) * scale), height: Math.floor((recorder.area.height - 2 * inset) * scale)
      };
      const cropped = image.crop(region);
      const bitmap = cropped.toBitmap();
      recorder.recent = [...recorder.recent.slice(-1), { at, bitmap, png: () => cropped.toPNG() }];
      if (Object.isNull(recorder.page) || Object.isNull(recorder.chat))
        return;
      const kind = bitmap.equals(recorder.page) ? "page" : bitmap.equals(recorder.chat) ? "chat" : "other";
      recorder.frames.push({ at, kind });
      if (kind === "other" && recorder.unmatched.length < 5)
        recorder.unmatched.push({ bitmap, width: cropped.getSize().width, png: () => cropped.toPNG() });
    });
    globalThis.nolSwitchRecorder = recorder;
  }, { address: page.url(), style: STILL_STYLE });
  await page.evaluate(selector => {
    const view = document.querySelector<HTMLElement>(selector);
    if (Object.isNull(view))
      throw new Error(`No element matches ${selector}.`);
    const calls: ICall[] = [];
    new MutationObserver(() => {
      const isVisible = view.style.visibility !== "hidden";
      if (calls.at(-1)?.isVisible === isVisible)
        return;
      const box = view.getBoundingClientRect();
      calls.push({ at: performance.timeOrigin + performance.now(), isVisible,
        bounds: { x: Math.round(box.x), y: Math.round(box.y), width: Math.round(box.width), height: Math.round(box.height) } });
    }).observe(view, { attributes: true, attributeFilter: ["style"] });
    globalThis.nolViewCalls = calls;
  }, VIEW);

  const clock = await app.electronApp.evaluate(async ({ webContents }, address) => {
    const window = webContents.getAllWebContents().find(t => t.getURL() === address);
    if (Object.isUndefined(window))
      throw new Error(`No web contents shows ${address}.`);
    let low = Number.NEGATIVE_INFINITY;
    for (let index = 0; index < 50; index++) {
      const at = Number(await window.executeJavaScript("performance.timeOrigin + performance.now()"));
      const after = performance.timeOrigin + performance.now();
      low = Math.max(low, at - after);
    }
    return { low };
  }, page.url());

  const placeholder = page.locator("nol-teamrun-page-document .nol-teamrun-page-view");
  const lastCallShown = (): Promise<boolean | null> => page.evaluate(() => globalThis.nolViewCalls?.at(-1)?.isVisible ?? null);
  const viewShown = (): Promise<boolean | null> => page.evaluate(selector => {
    const view = document.querySelector(selector);
    return Object.isNull(view) ? null : getComputedStyle(view).visibility === "visible";
  }, VIEW);
  const nowOf = (): Promise<number> => app.electronApp.evaluate(() => performance.timeOrigin + performance.now());
  const repaintAsync = (): Promise<void> => app.electronApp.evaluate(async ({ webContents }, address) => {
    const recorder = globalThis.nolSwitchRecorder;
    if (Object.isUndefined(recorder))
      throw new Error("The switch recorder isn't started.");
    recorder.tick++;
    await webContents.getAllWebContents().find(t => t.getURL() === address)?.executeJavaScript(
      `document.documentElement.style.outline = "1px solid rgb(${String(recorder.tick % 2)}, 0, 0)"; document.documentElement.style.outlineOffset = "-1px"; true`);
  }, page.url());
  const presentedOtherThan = async (kind: "page" | "chat", since: number): Promise<boolean> => {
    const isPresented = await app.electronApp.evaluate((_electron, { left, from }) =>
      (globalThis.nolSwitchRecorder?.frames ?? []).some(t => t.at >= from && t.kind !== left), { left: kind, from: since });
    if (!isPresented)
      await repaintAsync();
    return isPresented;
  };
  const capturedAsync = async (kind: "page" | "chat", since: number): Promise<boolean> => {
    const isCaptured = await app.electronApp.evaluate((_electron, { name, from }) => {
      const recorder = globalThis.nolSwitchRecorder;
      const [first, second] = recorder?.recent.filter(t => t.at >= from) ?? [];
      if (Object.isUndefined(recorder) || Object.isUndefined(first) || Object.isUndefined(second) || !first.bitmap.equals(second.bitmap))
        return false;
      recorder[name] = second.bitmap;
      recorder.atRest.push(second.png().toString("base64"));
      return true;
    }, { name: kind, from: since });
    if (!isCaptured)
      await repaintAsync();
    return isCaptured;
  };
  const readRecordAsync = async (): Promise<IRecord> => {
    const calls = await page.evaluate(() => globalThis.nolViewCalls ?? []);
    return recordOf(JsonReader.parse(await app.electronApp.evaluate((_electron, shown) => {
      const recorder = globalThis.nolSwitchRecorder;
      const differenceOf = (name: string, frame: Buffer, rest: Buffer, width: number): string => {
        if (frame.length !== rest.length)
          return `${name}: ${String(frame.length)} bytes against ${String(rest.length)}`;
        let count = 0;
        let largest = 0;
        const box = { left: width, top: Number.MAX_SAFE_INTEGER, right: -1, bottom: -1 };
        for (let index = 0; index < frame.length; index += 4) {
          const delta = Math.max(...[0, 1, 2, 3].map(t => Math.abs((frame[index + t] ?? 0) - (rest[index + t] ?? 0))));
          if (delta === 0)
            continue;
          const pixel = index / 4;
          const x = pixel % width;
          const y = Math.floor(pixel / width);
          count++;
          largest = Math.max(largest, delta);
          box.left = Math.min(box.left, x);
          box.top = Math.min(box.top, y);
          box.right = Math.max(box.right, x);
          box.bottom = Math.max(box.bottom, y);
        }
        if (count === 0)
          return `${name}: no pixel differs`;
        return `${name}: ${String(count)} pixels differ, in x ${String(box.left)} to ${String(box.right)} and y ${String(box.top)} to ${String(box.bottom)} `
          + `of ${String(width)} by ${String(frame.length / 4 / width)}, by up to ${String(largest)} in a channel`;
      };
      const unmatched = recorder?.unmatched ?? [];
      const { page: atRestPage, chat: atRestChat } = recorder ?? { page: null, chat: null };
      const differences = Object.isNull(atRestPage) || Object.isNull(atRestChat) ? []
        : unmatched.map(t => `${differenceOf("page", t.bitmap, atRestPage, t.width)}; ${differenceOf("chat", t.bitmap, atRestChat, t.width)}`);
      return JSON.stringify({ calls: shown, frames: recorder?.frames ?? [], others: unmatched.map(t => t.png().toString("base64")), differences, atRest: recorder?.atRest ?? [] });
    }, calls)));
  };
  const switchToAsync = async (tab: Locator): Promise<void> => {
    await tab.dispatchEvent("click");
    await expect(tab).toHaveAttribute("aria-selected", "true");
  };

  const marks: SwitchMark[] = [];
  let area: IRegion | null = null;
  try {
    await switchToAsync(pageTab);
    await expect.poll(viewShown, { message: "the page's view is shown on its tab", ...TeamRunApp.pollOf(30_000) }).toBe(true);
    const tabBox = await pageTab.boundingBox();
    expect(tabBox).not.toBeNull();
    await page.mouse.move((tabBox?.x ?? 0) + (tabBox?.width ?? 0) + 24, (tabBox?.y ?? 0) + (tabBox?.height ?? 0) / 2);
    const box = await placeholder.boundingBox();
    expect(box).not.toBeNull();
    area = { x: Math.round(box?.x ?? 0), y: Math.round(box?.y ?? 0), width: Math.round(box?.width ?? 0), height: Math.round(box?.height ?? 0) };
    const width = await page.evaluate(() => window.innerWidth);
    await app.electronApp.evaluate((_electron, { placed, inner }) => {
      const recorder = globalThis.nolSwitchRecorder;
      if (Object.isUndefined(recorder))
        throw new Error("The switch recorder isn't started.");
      recorder.width = inner;
      recorder.area = placed;
    }, { placed: area, inner: width });
    const pageSince = await nowOf();
    await expect.poll(() => capturedAsync("page", pageSince), { message: "two frames of the page's tab at rest are the same", ...TeamRunApp.pollOf(30_000) }).toBe(true);
    await switchToAsync(chatTab);
    await expect.poll(viewShown, { message: "the page's view is hidden on the chat's tab", ...TeamRunApp.pollOf(30_000) }).toBe(false);
    const chatSince = await nowOf();
    await expect.poll(() => capturedAsync("chat", chatSince), { message: "two frames of the chat's tab at rest are the same", ...TeamRunApp.pollOf(30_000) }).toBe(true);

    for (let index = 1; index <= SWITCHES; index++) {
      const start = await nowOf();
      await switchToAsync(pageTab);
      await expect.poll(lastCallShown, { message: `switch ${String(index)} to the page: the view's last call shows it`, ...TeamRunApp.pollOf(30_000) }).toBe(true);
      await expect.poll(() => presentedOtherThan("chat", start),
        { message: `switch ${String(index)} to the page: the window presents a frame that isn't the chat's`, ...TeamRunApp.pollOf(30_000) }).toBe(true);
      const end = await nowOf();
      marks.push(new SwitchMark(start, end));
      await switchToAsync(chatTab);
      await expect.poll(lastCallShown, { message: `switch ${String(index)} back to the chat: the view's last call hides it`, ...TeamRunApp.pollOf(30_000) }).toBe(false);
      await expect.poll(() => presentedOtherThan("page", end),
        { message: `switch ${String(index)} back to the chat: the window presents a frame that isn't the page's`, ...TeamRunApp.pollOf(30_000) }).toBe(true);
    }
  } finally {
    const kept = await readRecordAsync().catch((error: unknown) => String(error));
    const summary = Object.isString(kept) ? kept : { calls: kept.calls, frames: kept.frames, differences: kept.differences };
    await testInfo.attach("switch-record.json", { body: JSON.stringify({ area, clock, marks, record: summary }, null, 2), contentType: "application/json" });
    if (!Object.isString(kept)) {
      if (kept.differences.length > 0)
        await testInfo.attach("unmatched-frames.txt", { body: kept.differences.map((t, index) => `${String(index + 1)}. ${t}`).join("\n"), contentType: "text/plain" });
      for (const [index, rest] of kept.atRest.entries())
        await testInfo.attach(`${index === 0 ? "page" : "chat"}-at-rest`, { body: Buffer.from(rest, "base64"), contentType: "image/png" });
      for (const [index, other] of kept.others.entries())
        await testInfo.attach(`unmatched-frame-${String(index + 1)}`, { body: Buffer.from(other, "base64"), contentType: "image/png" });
    }
  }

  const record = await readRecordAsync();
  const bounds = area;
  expect(bounds, "the placeholder's measured area").not.toBeNull();
  const switches = marks.map(({ start, end }) => {
    const calls = record.calls.filter(t => t.at - clock.low >= start && t.at - clock.low <= end);
    const shown = calls.find(t => t.isVisible);
    const firstOfPage = record.frames.find(t => t.at >= start && t.at <= end && t.kind !== "chat");
    return new SwitchResult(calls.filter(t => !t.isVisible).length,
      !Object.isUndefined(shown) && !Object.isUndefined(firstOfPage) && shown.at - clock.low < firstOfPage.at, shown?.bounds ?? null);
  });

  expect(record.frames.filter(t => t.kind === "other").length, "frames that match neither the page's tab nor the chat's at rest").toBe(0);
  expect(switches).toEqual(Array.from({ length: SWITCHES }, () => new SwitchResult(0, true, bounds)));
  expect(app.unexpectedFailures).toEqual([]);
});
