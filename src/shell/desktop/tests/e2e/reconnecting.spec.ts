/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Locator, Page } from "@playwright/test";

import BuildVariantFixture from "./fixtures/build-variant.fixture.ts";
import DesktopApplicationFixture from "./fixtures/desktop-application.fixture.ts";
import { expect, test } from "./fixtures/desktop-test.fixture.ts";
import NotesOptionsFixture from "./fixtures/notes-options.fixture.ts";
import PageBridgeFixture from "./fixtures/page-bridge.fixture.ts";
import SettingsFixture from "./fixtures/settings.fixture.ts";

interface IReconnectRecord {
  readonly workspace: Element | null;
  wasInert: boolean;
  card: string;
}

interface IReconnectResult {
  readonly isSameWorkspace: boolean;
  readonly card: string;
}

interface IKeptRecord {
  readonly note: Element | null;
  readonly clock: Element | null;
}

interface IStartupRecord {
  readonly kind: string;
  readonly at: number;
}

function scrollAsync(content: Locator): Promise<number> {
  return content.evaluate(async t => {
    t.scrollTop += 60;
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    return t.scrollTop;
  });
}

async function watchAsync(window: Page): Promise<void> {
  await window.evaluate(() => {
    const record: IReconnectRecord = { workspace: document.querySelector("tr-workspace"), wasInert: false, card: "" };
    new MutationObserver(() => {
      record.wasInert ||= record.workspace?.hasAttribute("inert") === true;
      record.card ||= document.querySelector(".tr-window-reconnecting [role=status]")?.textContent?.trim() ?? "";
    }).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["inert"] });
    Reflect.set(globalThis, "reconnecting", record);
  });
}

function notificationIdsAsync(window: Page, kind: string): Promise<string[]> {
  return PageBridgeFixture.evaluateAsync(window, async (t, name) => {
    const answer = await t.request("shell.notifications", {}) as { payload: { notifications: { id: string; post: { kind: string } }[] } };
    return answer.payload.notifications.filter(t => t.post.kind === name).map(t => t.id);
  }, kind);
}

async function reconnectAsync(window: Page, dataDirectory: string): Promise<IReconnectResult> {
  await DesktopApplicationFixture.stopRuntimeAsync(dataDirectory);
  await expect.poll(() => window.evaluate(() => (Reflect.get(globalThis, "reconnecting") as IReconnectRecord).wasInert)).toBe(true);
  await expect(window.locator(".tr-window-reconnecting")).toHaveCount(0);
  await expect(window.locator("tr-workspace")).not.toHaveAttribute("inert");
  return window.evaluate(() => {
    const record = Reflect.get(globalThis, "reconnecting") as IReconnectRecord;
    return { isSameWorkspace: record.workspace === document.querySelector("tr-workspace"), card: record.card };
  });
}

test.describe("reconnecting", () => {
  test("the workspace stays under the startup card while the runtime starts again and keeps a document's focus, scroll position and typed text", async ({ desktop }) => {
    const window = desktop.window;
    await expect(window.locator("[data-fixture-content=clock-face]")).toBeVisible();
    await SettingsFixture.openGalleryAsync(window);
    const content = window.locator(".tr-settings-content");
    const field = content.locator("input[tr-text-field][type=text]").first();
    await field.fill("A draft not saved yet");
    const top = await scrollAsync(content);
    expect(top).toBeGreaterThan(0);
    await expect(field).toBeFocused();
    await watchAsync(window);

    const record = await reconnectAsync(window, desktop.dataDirectory);

    expect(record).toEqual({ isSameWorkspace: true, card: expect.stringMatching(/^Starting .+…$/) });
    await expect(field).toBeFocused();
    await expect(field).toHaveValue("A draft not saved yet");
    expect(await content.evaluate(t => t.scrollTop)).toBe(top);
    await desktop.checkpointAsync("reconnecting-kept");
  });

  test("a module's document whose part continues keeps its focus, scroll position and typed text and shows the new runtime's state, while a part that asks to be rebuilt is rebuilt", async ({ desktop }) => {
    const window = desktop.window;
    const note = window.locator("tr-notes-note", { has: window.locator("[data-fixture-content=notes-note-2]") });
    const runtime = note.locator("[data-fixture-content=notes-runtime]");
    await expect(runtime).toHaveText(/^Runtime \S+$/);
    await expect(window.locator("[data-fixture-content=clock-face]")).toBeVisible();
    const first = await runtime.textContent() ?? "";
    const posted = await notificationIdsAsync(window, "notes.saveFailed");
    const summary = note.locator("textarea");
    await summary.fill("A summary not saved yet");
    const content = window.locator("tr-tab-content", { has: note });
    const top = await scrollAsync(content);
    expect(top).toBeGreaterThan(0);
    await expect(summary).toBeFocused();
    await watchAsync(window);
    await window.evaluate(() => {
      const record: IKeptRecord = {
        note: document.querySelector("tr-notes-note:has([data-fixture-content=notes-note-2])"),
        clock: document.querySelector("[data-fixture-content=clock-face]")
      };
      Reflect.set(globalThis, "kept", record);
    });

    const record = await reconnectAsync(window, desktop.dataDirectory);

    expect(record.isSameWorkspace).toBe(true);
    await expect(runtime).toHaveText(/^Runtime \S+$/);
    await expect(runtime).not.toHaveText(first);
    await expect(runtime).toHaveAttribute("data-continued", "1");
    const reposted = await notificationIdsAsync(window, "notes.saveFailed");
    expect([posted.length, reposted.length, reposted[0] === posted[0]]).toEqual([1, 1, false]);
    await expect.poll(() => window.evaluate(() => {
      const kept = Reflect.get(globalThis, "kept") as IKeptRecord;
      return [kept.note?.isConnected, kept.clock?.isConnected, document.querySelector("[data-fixture-content=clock-face]") !== null];
    })).toEqual([true, false, true]);
    await expect(summary).toBeFocused();
    await expect(summary).toHaveValue("A summary not saved yet");
    expect(await content.evaluate(t => t.scrollTop)).toBe(top);
    await desktop.checkpointAsync("reconnecting-module-kept");
  });

  test("a part that continues after a broken connection to the same runtime keeps its notification and posts it no second time", async ({ desktop }) => {
    const window = desktop.window;
    const runtime = window.locator("tr-notes-note", { has: window.locator("[data-fixture-content=notes-note-2]") }).locator("[data-fixture-content=notes-runtime]");
    await expect(runtime).toHaveText(/^Runtime \S+$/);
    const first = await runtime.textContent() ?? "";
    const processId = await desktop.readRuntimeProcessIdAsync();
    const posted = await notificationIdsAsync(window, "notes.saveFailed");
    await PageBridgeFixture.evaluateAsync(window, t => {
      const states: string[] = [];
      t.onStartup(u => states.push((u as { kind: string }).kind));
      Reflect.set(globalThis, "startups", states);
    });

    await desktop.breakRuntimeConnectionAsync();

    await expect.poll(() => window.evaluate(() => Reflect.get(globalThis, "startups") as string[])).toEqual(["Connecting", "Ready"]);
    await expect(runtime).toHaveAttribute("data-continued", "1");
    expect(await desktop.readRuntimeProcessIdAsync()).toBe(processId);
    await expect(runtime).toHaveText(first);
    expect(posted).toHaveLength(1);
    expect(await notificationIdsAsync(window, "notes.saveFailed")).toEqual(posted);
  });

  test("a connection that ends while a part reads the runtime again leaves no window error and the part in place, and the part reads it again once ready", async ({ desktop }) => {
    const window = desktop.window;
    const runtime = window.locator("tr-notes-note", { has: window.locator("[data-fixture-content=notes-note-2]") }).locator("[data-fixture-content=notes-runtime]");
    await expect(runtime).toHaveText(/^Runtime \S+$/);
    await expect(window.locator("[data-fixture-content=clock-face]")).toBeVisible();
    const first = await runtime.textContent() ?? "";
    await PageBridgeFixture.evaluateAsync(window, t => {
      const states: string[] = [];
      t.onStartup(u => states.push((u as { kind: string }).kind));
      Reflect.set(globalThis, "startups", states);
      Reflect.set(globalThis, "clock", document.querySelector("[data-fixture-content=clock-face]"));
    });
    const readyCountAsync = (): Promise<number> => window.evaluate(() => (Reflect.get(globalThis, "startups") as string[]).filter(t => t === "Ready").length);
    await NotesOptionsFixture.holdAsync(window);

    await desktop.breakRuntimeConnectionAsync();
    await expect.poll(() => NotesOptionsFixture.heldAsync(window)).toBe(1);
    await desktop.breakRuntimeConnectionAsync();
    await expect.poll(readyCountAsync).toBe(2);
    await NotesOptionsFixture.releaseAsync(window);

    await expect.poll(() => window.evaluate(() => [(Reflect.get(globalThis, "clock") as Element).isConnected, document.querySelector("[data-fixture-content=clock-face]") !== null]))
      .toEqual([false, true]);
    await expect(runtime).toHaveAttribute("data-continued", "1");
    await expect(runtime).toHaveText(first);
    await expect(window.locator("tr-workspace")).not.toHaveAttribute("inert");
  });
});

test.describe("reconnecting backoff", () => {
  test.use({ desktopVariant: BuildVariantFixture.noModules });

  test("a connection that receives an invalid frame each time it is ready ends, after waits that grow, in the start failure with its cause, and trying again connects", async ({ desktop }) => {
    const window = desktop.window;
    await PageBridgeFixture.evaluateAsync(window, t => {
      const states: IStartupRecord[] = [];
      t.onStartup(u => states.push({ kind: (u as { kind: string }).kind, at: performance.now() }));
      Reflect.set(globalThis, "startups", states);
    });
    const readAsync = (): Promise<IStartupRecord[]> => window.evaluate(() => Reflect.get(globalThis, "startups") as IStartupRecord[]);
    const reconnections = (count: number): string[] => Array.from({ length: count }, () => ["Connecting", "Ready"]).flat();

    for (let end = 1; end < 6; end++) {
      await desktop.receiveInvalidFrameAsync();
      await expect.poll(async () => (await readAsync()).map(t => t.kind)).toEqual(reconnections(end));
    }
    await desktop.receiveInvalidFrameAsync();

    const card = window.locator(".tr-startup-card");
    await expect(card.locator(".tr-startup-detail")).toHaveText(/^The connection to the runtime ended 6 times in a row, .* The last time, the desktop ended it \(InvalidMessage\): .+/);
    const stopped = await readAsync();
    expect(stopped.map(t => t.kind)).toEqual([...reconnections(5), "Failed"]);
    const waited = (stopped.at(-1)?.at ?? 0) - (stopped[0]?.at ?? 0);
    expect(waited).toBeGreaterThanOrEqual(14_900);
    expect(waited).toBeLessThan(30_000);
    await card.getByRole("button", { name: "Try again" }).click();
    await expect.poll(async () => (await readAsync()).map(t => t.kind)).toEqual([...reconnections(5), "Failed", "Connecting", "Ready"]);
    await expect(window.locator("tr-workspace")).not.toHaveAttribute("inert");
    const logged = desktop.acceptFailures(/The desktop ended its connection to the runtime|The runtime could not be started or reached/);
    expect(logged).toHaveLength(6);
    expect(logged.slice(0, 5).every(t => t.includes("so it connects again (InvalidMessage): "))).toBe(true);
    expect(logged[5]).toContain("so the desktop stopped connecting again. The last time, the desktop ended it (InvalidMessage): ");
  });
});
