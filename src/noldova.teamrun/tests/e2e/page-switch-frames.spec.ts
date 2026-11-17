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
}

interface ISwitchRecorder {
  area: IRegion | null;
  width: number;
  page: Buffer | null;
  chat: Buffer | null;
  recent: readonly { readonly at: number; readonly bitmap: Buffer }[];
  tick: number;
  readonly frames: IFrame[];
  readonly others: string[];
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
  others: reader.readStringArray("others")
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
  await chatTab.click();
  await expect(panel.getByText(/^page: v1 made by \S/u)).toBeVisible({ timeout: 60_000 });
  await expect(panel.getByRole("button", { name: "Send", exact: true })).toBeVisible({ timeout: 60_000 });
  await pageTab.click();
  await expect(page.locator("nol-teamrun-page-document .nol-teamrun-page-authors")).toHaveText(/^v1 · Made by \S/u, { timeout: 60_000 });

  await app.electronApp.evaluate(async ({ webContents }, { address, style }) => {
    const window = webContents.getAllWebContents().find(t => t.getURL() === address);
    if (window === undefined)
      throw new Error(`No web contents shows ${address}.`);
    await window.insertCSS(style);
    const recorder: ISwitchRecorder = { area: null, width: 0, page: null, chat: null, recent: [], tick: 0, frames: [], others: [] };
    window.beginFrameSubscription(false, image => {
      const at = performance.timeOrigin + performance.now();
      if (recorder.area === null || recorder.width === 0)
        return;
      const scale = image.getSize().width / recorder.width;
      const inset = 2;
      const region = {
        x: Math.ceil((recorder.area.x + inset) * scale), y: Math.ceil((recorder.area.y + inset) * scale),
        width: Math.floor((recorder.area.width - 2 * inset) * scale), height: Math.floor((recorder.area.height - 2 * inset) * scale)
      };
      const bitmap = image.crop(region).toBitmap();
      recorder.recent = [...recorder.recent.slice(-1), { at, bitmap }];
      if (recorder.page === null || recorder.chat === null)
        return;
      const kind = bitmap.equals(recorder.page) ? "page" : bitmap.equals(recorder.chat) ? "chat" : "other";
      recorder.frames.push({ at, kind });
      if (kind === "other" && recorder.others.length < 5)
        recorder.others.push(image.crop(region).toPNG().toString("base64"));
    });
    globalThis.nolSwitchRecorder = recorder;
  }, { address: page.url(), style: STILL_STYLE });
  await page.evaluate(selector => {
    const view = document.querySelector(selector);
    if (!(view instanceof HTMLElement))
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

  const placeholder = page.locator("nol-teamrun-page-document .nol-teamrun-page-view");
  const lastCallShown = (): Promise<boolean | null> => page.evaluate(() => globalThis.nolViewCalls?.at(-1)?.isVisible ?? null);
  const viewShown = (): Promise<boolean | null> => page.evaluate(selector => {
    const view = document.querySelector(selector);
    return view === null ? null : getComputedStyle(view).visibility === "visible";
  }, VIEW);
  const nowOf = (): Promise<number> => app.electronApp.evaluate(() => performance.timeOrigin + performance.now());
  const repaintAsync = (): Promise<void> => app.electronApp.evaluate(async ({ webContents }, address) => {
    const recorder = globalThis.nolSwitchRecorder;
    if (recorder === undefined)
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
      if (recorder === undefined || first === undefined || second === undefined || !first.bitmap.equals(second.bitmap))
        return false;
      recorder[name] = second.bitmap;
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
      return JSON.stringify({ calls: shown, frames: recorder?.frames ?? [], others: recorder?.others ?? [] });
    }, calls)));
  };
  const switchToAsync = async (tab: Locator): Promise<void> => {
    await tab.dispatchEvent("click");
    await expect(tab).toHaveAttribute("aria-selected", "true");
  };

  const marks: { readonly start: number; readonly end: number }[] = [];
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
      if (recorder === undefined)
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
      marks.push({ start, end });
      await switchToAsync(chatTab);
      await expect.poll(lastCallShown, { message: `switch ${String(index)} back to the chat: the view's last call hides it`, ...TeamRunApp.pollOf(30_000) }).toBe(false);
      await expect.poll(() => presentedOtherThan("page", end),
        { message: `switch ${String(index)} back to the chat: the window presents a frame that isn't the page's`, ...TeamRunApp.pollOf(30_000) }).toBe(true);
    }
  } finally {
    const kept = await readRecordAsync().catch((error: unknown) => String(error));
    await testInfo.attach("switch-record.json", { body: JSON.stringify({ area, marks, record: kept }, null, 2), contentType: "application/json" });
    if (typeof kept !== "string") {
      for (const [index, other] of kept.others.entries())
        await testInfo.attach(`unmatched-frame-${String(index + 1)}`, { body: Buffer.from(other, "base64"), contentType: "image/png" });
    }
  }

  const record = await readRecordAsync();
  const bounds = area;
  expect(bounds, "the placeholder's measured area").not.toBeNull();
  const switches = marks.map(({ start, end }) => {
    const calls = record.calls.filter(t => t.at >= start && t.at <= end);
    const shown = calls.find(t => t.isVisible);
    const firstOfPage = record.frames.find(t => t.at >= start && t.at <= end && t.kind !== "chat");
    return {
      hides: calls.filter(t => !t.isVisible).length,
      isShownFirst: shown !== undefined && firstOfPage !== undefined && shown.at < firstOfPage.at,
      bounds: shown?.bounds ?? null
    };
  });

  expect(record.frames.filter(t => t.kind === "other").length, "frames that match neither the page's tab nor the chat's at rest").toBe(0);
  expect(switches).toEqual(Array.from({ length: SWITCHES }, () => ({ hides: 0, isShownFirst: true, bounds })));
  expect(app.unexpectedFailures).toEqual([]);
});
