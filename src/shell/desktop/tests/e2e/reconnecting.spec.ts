/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Locator, Page } from "@playwright/test";

import DesktopApplicationFixture from "./fixtures/desktop-application.fixture.ts";
import { expect, test } from "./fixtures/desktop-test.fixture.ts";
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

interface IBridge {
  request(method: string, payload: unknown): Promise<unknown>;
  onStartup(listener: (state: unknown) => void): () => void;
}

interface IKeptRecord {
  readonly note: Element | null;
  readonly clock: Element | null;
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
  return window.evaluate(async name => {
    const answer = await (Reflect.get(globalThis, "teamrun") as IBridge).request("shell.notifications", {}) as { payload: { notifications: { id: string; post: { kind: string } }[] } };
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
    await window.evaluate(() => {
      const states: string[] = [];
      (Reflect.get(globalThis, "teamrun") as IBridge).onStartup(t => states.push((t as { kind: string }).kind));
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

  test("a connection that ends again as soon as the runtime is ready, while the window reads it again, leaves no window error and its parts in place", async ({ desktop }) => {
    const window = desktop.window;
    const runtime = window.locator("tr-notes-note", { has: window.locator("[data-fixture-content=notes-note-2]") }).locator("[data-fixture-content=notes-runtime]");
    await expect(runtime).toHaveText(/^Runtime \S+$/);
    const first = await runtime.textContent() ?? "";
    await window.evaluate(() => {
      const states: string[] = [];
      (Reflect.get(globalThis, "teamrun") as IBridge).onStartup(t => states.push((t as { kind: string }).kind));
      Reflect.set(globalThis, "startups", states);
    });
    const readyCountAsync = (): Promise<number> => window.evaluate(() => (Reflect.get(globalThis, "startups") as string[]).filter(t => t === "Ready").length);

    for (let end = 1; end <= 3; end++) {
      await desktop.breakRuntimeConnectionAsync();
      await expect.poll(readyCountAsync).toBe(end);
    }

    await expect(runtime).toHaveAttribute("data-continued", /^[1-3]$/);
    await expect(runtime).toHaveText(first);
    await expect(window.locator("tr-workspace")).not.toHaveAttribute("inert");
  });
});
