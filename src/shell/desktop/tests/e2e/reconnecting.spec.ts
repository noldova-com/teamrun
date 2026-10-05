/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import DesktopApplicationFixture from "./fixtures/desktop-application.fixture.ts";
import { expect, test } from "./fixtures/desktop-test.fixture.ts";
import SettingsFixture from "./fixtures/settings.fixture.ts";

interface IReconnectRecord {
  readonly workspace: Element | null;
  wasInert: boolean;
  card: string;
}

interface IKeptRecord {
  readonly workspace: Element | null;
  readonly note: Element | null;
  readonly clock: Element | null;
  wasInert: boolean;
}

test.describe("reconnecting", () => {
  test("the workspace stays under the startup card while the runtime starts again and keeps a document's focus, scroll position and typed text", async ({ desktop }) => {
    const window = desktop.window;
    await expect(window.locator("[data-fixture-content=clock-face]")).toBeVisible();
    await SettingsFixture.openGalleryAsync(window);
    const content = window.locator(".tr-settings-content");
    const field = content.locator("input[tr-text-field][type=text]").first();
    await field.fill("A draft not saved yet");
    const top = await content.evaluate(async t => {
      t.scrollTop += 60;
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      return t.scrollTop;
    });
    expect(top).toBeGreaterThan(0);
    await expect(field).toBeFocused();
    await window.evaluate(() => {
      const record: IReconnectRecord = { workspace: document.querySelector("tr-workspace"), wasInert: false, card: "" };
      new MutationObserver(() => {
        record.wasInert ||= record.workspace?.hasAttribute("inert") === true;
        record.card ||= document.querySelector(".tr-window-reconnecting [role=status]")?.textContent?.trim() ?? "";
      }).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["inert"] });
      Reflect.set(globalThis, "reconnecting", record);
    });

    await DesktopApplicationFixture.stopRuntimeAsync(desktop.dataDirectory);

    await expect.poll(() => window.evaluate(() => (Reflect.get(globalThis, "reconnecting") as IReconnectRecord).wasInert)).toBe(true);
    await expect(window.locator(".tr-window-reconnecting")).toHaveCount(0);
    await expect(window.locator("tr-workspace")).not.toHaveAttribute("inert");
    const record = await window.evaluate(() => {
      const kept = Reflect.get(globalThis, "reconnecting") as IReconnectRecord;
      return [kept.workspace === document.querySelector("tr-workspace"), kept.card];
    });
    expect(record).toEqual([true, expect.stringMatching(/^Starting .+…$/)]);
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
    const summary = note.locator("textarea");
    await summary.fill("A summary not saved yet");
    const content = window.locator("tr-tab-content", { has: note });
    const top = await content.evaluate(async t => {
      t.scrollTop += 60;
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      return t.scrollTop;
    });
    expect(top).toBeGreaterThan(0);
    await expect(summary).toBeFocused();
    await window.evaluate(() => {
      const record: IKeptRecord = {
        workspace: document.querySelector("tr-workspace"),
        note: document.querySelector("tr-notes-note:has([data-fixture-content=notes-note-2])"),
        clock: document.querySelector("[data-fixture-content=clock-face]"),
        wasInert: false
      };
      new MutationObserver(() => {
        record.wasInert ||= record.workspace?.hasAttribute("inert") === true;
      }).observe(document.body, { subtree: true, attributes: true, attributeFilter: ["inert"] });
      Reflect.set(globalThis, "kept", record);
    });

    await DesktopApplicationFixture.stopRuntimeAsync(desktop.dataDirectory);

    await expect.poll(() => window.evaluate(() => (Reflect.get(globalThis, "kept") as IKeptRecord).wasInert)).toBe(true);
    await expect(window.locator(".tr-window-reconnecting")).toHaveCount(0);
    await expect(runtime).toHaveText(/^Runtime \S+$/);
    await expect(runtime).not.toHaveText(first);
    await expect.poll(() => window.evaluate(() => {
      const kept = Reflect.get(globalThis, "kept") as IKeptRecord;
      return [kept.note?.isConnected, kept.clock?.isConnected, document.querySelector("[data-fixture-content=clock-face]") !== null];
    })).toEqual([true, false, true]);
    await expect(summary).toBeFocused();
    await expect(summary).toHaveValue("A summary not saved yet");
    expect(await content.evaluate(t => t.scrollTop)).toBe(top);
    await desktop.checkpointAsync("reconnecting-module-kept");
  });
});
