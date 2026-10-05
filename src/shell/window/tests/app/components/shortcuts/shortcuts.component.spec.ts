/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ErrorHandler, type Signal, type WritableSignal, computed, signal } from "@angular/core";
import { type ComponentFixture, TestBed } from "@angular/core/testing";
import { page, userEvent } from "vitest/browser";

import type { JsonValue } from "@noldova/teamrun-foundation-json";
import type { SettingDefinition } from "@noldova/teamrun-shell-protocol";

import { SettingsComponent } from "../../../../src/app/components/settings/settings.component";
import { CommandContribution } from "../../../../src/app/models/command-contribution";
import { CommandService } from "../../../../src/app/services/command.service";
import { SettingsService } from "../../../../src/app/services/settings.service";
import { DesktopBridgeFixture } from "../../../fixtures/desktop-bridge.fixture";

class FakeSettingsService {
  public readonly definitions: WritableSignal<readonly SettingDefinition[]> = signal([]);
  public readonly values: WritableSignal<ReadonlyMap<string, JsonValue>> = signal(new Map());
  public readonly sets: WritableSignal<ReadonlySet<string>> = signal(new Set());
  public readonly calls: string[] = [];
  public readonly late: (() => void)[] = [];
  public failure: Error | null = null;
  public isLate: boolean = false;

  public isSet(name: string): Signal<boolean> {
    return computed(() => this.sets().has(name));
  }

  public setAsync(name: string, value: JsonValue): Promise<void> {
    this.calls.push(`set ${name} ${JSON.stringify(value)}`);
    if (!Object.is(this.failure, null))
      return Promise.reject(this.failure);
    const apply = (): void => {
      const isSet = JSON.stringify(value) !== "{}";
      this.values.update(t => new Map([...t, [name, value]]));
      this.sets.update(t => new Set([...[...t].filter(u => u !== name), ...isSet ? [name] : []]));
    };
    if (this.isLate)
      this.late.push(apply);
    else
      apply();
    return Promise.resolve();
  }

  public deliver(): void {
    for (const apply of this.late.splice(0))
      apply();
  }

  public resetAsync(name: string): Promise<void> {
    this.calls.push(`reset ${name}`);
    if (!Object.is(this.failure, null))
      return Promise.reject(this.failure);
    this.values.update(t => new Map([...t, [name, {}]]));
    this.sets.update(t => new Set([...t].filter(u => u !== name)));
    return Promise.resolve();
  }
}

describe("ShortcutsComponent", () => {
  let fixture: ComponentFixture<SettingsComponent>;
  let settings: FakeSettingsService;
  let errors: unknown[];
  let runs: string[];

  const element = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const row = (command: string): HTMLElement => element().querySelector(`[data-command='${command}']`) as HTMLElement;
  const keyOf = (command: string): HTMLButtonElement => row(command).querySelector(".tr-shortcut-key") as HTMLButtonElement;
  const cells = (command: string): readonly string[] => [...row(command).querySelectorAll("td")].map(t => t.textContent?.trim() ?? "");
  const notice = (command: string): string | null => row(command).querySelector(".tr-shortcut-notice-text")?.textContent ?? null;

  async function renderAsync(platform: string = "linux", bindings: JsonValue = {}): Promise<void> {
    DesktopBridgeFixture.install(platform);
    settings.values.set(new Map([["shell.keyBindings", bindings]]));
    if (JSON.stringify(bindings) !== "{}")
      settings.sets.set(new Set(["shell.keyBindings"]));
    TestBed.inject(CommandService).setCommands([
      new CommandContribution("clock.tick", "Tick the clock", null, "Ctrl+Alt+T", () => Promise.resolve(null)),
      new CommandContribution("notes.newNote", "New note", null, "Mod+Alt+N", async () => {
        runs.push("notes.newNote");
        return null;
      })
    ]);
    fixture = TestBed.createComponent(SettingsComponent);
    fixture.detectChanges();
    await page.getByRole("treeitem", { name: "Keyboard shortcuts" }).click();
    await settleAsync();
  }

  async function settleAsync(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function recordAsync(command: string): Promise<void> {
    keyOf(command).click();
    keyOf(command).focus();
    await settleAsync();
  }

  async function pressAsync(command: string, init: KeyboardEventInit, type: string = "keydown"): Promise<KeyboardEvent> {
    const event = new KeyboardEvent(type, { bubbles: true, cancelable: true, ...init });
    keyOf(command).dispatchEvent(event);
    await settleAsync();
    return event;
  }

  beforeEach(() => {
    settings = new FakeSettingsService();
    errors = [];
    runs = [];
    TestBed.configureTestingModule({
      providers: [
        { provide: SettingsService, useValue: settings },
        { provide: ErrorHandler, useValue: { handleError: (error: unknown) => errors.push(error) } }
      ]
    });
  });

  afterEach(async () => {
    await userEvent.keyboard("{Escape}");
    DesktopBridgeFixture.remove();
  });

  it("shows each command's id under its title, muted in the label size like a setting's id, with From and Key on the title's line", async () => {
    await renderAsync();
    const probe = document.createElement("span");
    probe.style.cssText = "color: var(--tr-text-muted); font-size: var(--tr-text-label); line-height: var(--tr-line-label)";
    row("clock.tick").append(probe);
    const look = (element: Element): readonly string[] => [getComputedStyle(element).color, getComputedStyle(element).fontSize, getComputedStyle(element).lineHeight];
    const name = row("clock.tick").querySelector(".tr-shortcut-name") as HTMLElement;
    const title = (row("clock.tick").querySelector(".tr-shortcut-title") as HTMLElement).getBoundingClientRect();
    const owner = row("clock.tick").querySelector(".tr-shortcut-owner") as HTMLElement;
    const ownerLine = owner.getBoundingClientRect().top + Number.parseFloat(getComputedStyle(owner).paddingTop);
    const key = keyOf("clock.tick").getBoundingClientRect();

    expect([...element().querySelectorAll("tbody tr")].every(t => t.querySelector(".tr-shortcut-name")?.textContent === t.getAttribute("data-command"))).toBe(true);
    expect(look(name)).toEqual(look(probe));
    expect(name.getBoundingClientRect().top).toBeCloseTo(title.bottom, 0);
    expect([ownerLine, key.top].map(t => Math.abs(t - title.top) <= 1)).toEqual([true, true]);
    expect(key.height).toBeCloseTo(title.height, 0);
    probe.remove();
  });

  it("records a new key from the first key pressed after the modifiers, without running the command it would run, and keeps the focus", async () => {
    await renderAsync();

    await recordAsync("clock.tick");
    const recording = [keyOf("clock.tick").textContent?.trim(), keyOf("clock.tick").getAttribute("aria-label")];
    await pressAsync("clock.tick", { key: "Control", code: "ControlLeft", ctrlKey: true });
    await pressAsync("clock.tick", { key: "Shift", code: "ShiftLeft", ctrlKey: true, shiftKey: true });
    const held = keyOf("clock.tick").textContent?.trim();
    await pressAsync("clock.tick", { key: "Shift", code: "ShiftLeft", ctrlKey: true }, "keyup");
    const released = keyOf("clock.tick").textContent?.trim();
    await pressAsync("clock.tick", { key: "Control", code: "ControlLeft" }, "keyup");
    const none = keyOf("clock.tick").textContent?.trim();
    const pressed = await pressAsync("clock.tick", { key: "K", code: "KeyK", ctrlKey: true, shiftKey: true });

    expect(recording).toEqual(["Press the new key", "Press the new key for Tick the clock"]);
    expect([held, released, none]).toEqual(["Ctrl+Shift+…", "Ctrl+…", "Press the new key"]);
    expect(pressed.defaultPrevented).toBe(true);
    expect(settings.calls).toEqual(["set shell.keyBindings {\"clock.tick\":\"Mod+Shift+K\"}"]);
    expect(cells("clock.tick").slice(1)).toEqual(["clock", "Ctrl+Shift+K", "RemoveReset"]);
    expect(row("clock.tick").querySelector(".tr-shortcut-marker")?.getAttribute("aria-label")).toBe("Modified");
    expect(getComputedStyle(row("clock.tick").querySelector(".tr-shortcut-marker") as Element).fontVariationSettings).toBe("\"FILL\" 1");
    expect(keyOf("clock.tick").getAttribute("aria-label")).toBe("Change the key of Tick the clock, now Ctrl+Shift+K");
    expect(document.activeElement).toBe(keyOf("clock.tick"));
  });

  it("shows a key another command holds and moves it on Use it here, leaving that command without a key", async () => {
    await renderAsync();

    await recordAsync("clock.tick");
    await pressAsync("clock.tick", { key: "n", code: "KeyN", ctrlKey: true, altKey: true });
    const used = notice("clock.tick");
    await page.getByRole("button", { name: "Use it here" }).click();
    await settleAsync();

    expect(used).toBe("Ctrl+Alt+N is used by New note");
    expect(runs).toEqual([]);
    expect(settings.calls).toEqual(["set shell.keyBindings {\"clock.tick\":\"Mod+Alt+N\",\"notes.newNote\":null}"]);
    expect([cells("clock.tick")[2], cells("notes.newNote").slice(2)]).toEqual(["Ctrl+Alt+N", ["No key", "Reset"]]);
    expect(notice("clock.tick")).toBeNull();
    expect(document.activeElement).toBe(keyOf("clock.tick"));
  });

  for (const [platform, taken, stroke, kept, binding] of [
    ["linux", "Ctrl+PageDown", { key: "PageDown", code: "PageDown", ctrlKey: true }, "Ctrl+Tab", "Mod+PageDown"],
    ["darwin", "⌃⇥", { key: "Tab", code: "Tab", ctrlKey: true }, "⌥⌘→", "Ctrl+Tab"]
  ] as const) {
    it(`leaves Show the next tab only its other default key ${kept}, wherever its key shows, when Use it here takes ${taken} on ${platform}`, async () => {
      await renderAsync(platform);

      await recordAsync("clock.tick");
      await pressAsync("clock.tick", stroke);
      const used = notice("clock.tick");
      await page.getByRole("button", { name: "Use it here" }).click();
      await settleAsync();

      expect(used).toBe(`${taken} is used by Show the next tab`);
      expect(settings.calls).toEqual([`set shell.keyBindings {"clock.tick":"${binding}"}`]);
      expect(cells("shell.nextTab").slice(2)).toEqual([`${kept}${taken} is taken by Tick the clock`, "Remove"]);
      expect(TestBed.inject(CommandService).keyLabel("shell.nextTab")).toBe(kept);
    });
  }

  it("keeps both keys when the person cancels a collision", async () => {
    await renderAsync();

    await recordAsync("clock.tick");
    await pressAsync("clock.tick", { key: "n", code: "KeyN", ctrlKey: true, altKey: true });
    await page.getByRole("button", { name: "Cancel" }).click();
    await settleAsync();

    expect([settings.calls, notice("clock.tick"), cells("clock.tick")[2], cells("notes.newNote")[2]]).toEqual([[], null, "Ctrl+Alt+T", "Ctrl+Alt+N"]);
    expect(document.activeElement).toBe(keyOf("clock.tick"));
  });

  it("refuses a key that takes typing, one editing or the system owns, the Super key and a key no shortcut names, with the reason", async () => {
    await renderAsync();
    const reasons: (string | null)[] = [];

    for (const init of [
      { key: "k", code: "KeyK" },
      { key: "c", code: "KeyC", ctrlKey: true },
      { key: "F4", code: "F4", altKey: true },
      { key: "w", code: "KeyW", ctrlKey: true },
      { key: "k", code: "KeyK", metaKey: true },
      { key: "Unidentified", code: "IntlRo", ctrlKey: true }
    ]) {
      await recordAsync("clock.tick");
      await pressAsync("clock.tick", init);
      reasons.push(notice("clock.tick"));
    }

    expect(reasons).toEqual([
      "A key needs Ctrl, Alt or a function key.",
      "Ctrl+C belongs to editing",
      "Alt+F4 belongs to Windows and Linux",
      "Ctrl+W belongs to macOS",
      "The Super key can't be part of a shortcut.",
      "This key can't be part of a shortcut."
    ]);
    expect(settings.calls).toEqual([]);
    expect(keyOf("clock.tick").textContent?.trim()).toBe("Ctrl+Alt+T");
  });

  it("lets a shell command take the keys the shell handles itself", async () => {
    await renderAsync();

    await recordAsync("shell.toggleLeftDock");
    await pressAsync("shell.toggleLeftDock", { key: "w", code: "KeyW", ctrlKey: true });
    const used = notice("shell.toggleLeftDock");
    await page.getByRole("button", { name: "Use it here" }).click();
    await settleAsync();

    expect(used).toBe("Ctrl+W is used by Close the tab");
    expect(settings.calls).toEqual(["set shell.keyBindings {\"shell.toggleLeftDock\":\"Mod+W\",\"shell.closeTab\":null}"]);
  });

  it("changes nothing for any key the command has, before refusing a key the rules would refuse elsewhere", async () => {
    await renderAsync();

    await recordAsync("shell.nextTab");
    await pressAsync("shell.nextTab", { key: "Tab", code: "Tab", ctrlKey: true });
    await recordAsync("shell.nextTab");
    await pressAsync("shell.nextTab", { key: "PageDown", code: "PageDown", ctrlKey: true });

    expect([settings.calls, notice("shell.nextTab"), cells("shell.nextTab")[2]]).toEqual([[], null, "Ctrl+Tab"]);
  });

  it("builds each change on the last one written until the setting reports it", async () => {
    await renderAsync();
    settings.isLate = true;

    await page.getByRole("button", { name: "Remove the key of Tick the clock" }).click();
    await page.getByRole("button", { name: "Remove the key of New note" }).click();
    await settleAsync();
    const before = cells("clock.tick")[2];
    settings.deliver();
    await settleAsync();
    settings.isLate = false;
    await page.getByRole("button", { name: "Reset Tick the clock" }).click();
    await settleAsync();

    expect(before).toBe("Ctrl+Alt+T");
    expect(settings.calls).toEqual([
      "set shell.keyBindings {\"clock.tick\":null}",
      "set shell.keyBindings {\"clock.tick\":null,\"notes.newNote\":null}",
      "set shell.keyBindings {\"notes.newNote\":null}"
    ]);
    expect([cells("clock.tick")[2], cells("notes.newNote")[2]]).toEqual(["Ctrl+Alt+T", "No key"]);
  });

  it("builds on the setting again after the writes fail", async () => {
    await renderAsync();
    settings.failure = new Error("The runtime refused the value.");

    keyOf("clock.tick").closest("tr")?.querySelector<HTMLButtonElement>(".tr-shortcut-actions button")?.click();
    keyOf("notes.newNote").closest("tr")?.querySelector<HTMLButtonElement>(".tr-shortcut-actions button")?.click();
    await expect.poll(() => errors.length).toBe(2);
    settings.failure = null;
    await page.getByRole("button", { name: "Remove the key of Tick the clock" }).click();
    await settleAsync();

    expect(settings.calls).toEqual([
      "set shell.keyBindings {\"clock.tick\":null}",
      "set shell.keyBindings {\"clock.tick\":null,\"notes.newNote\":null}",
      "set shell.keyBindings {\"clock.tick\":null}"
    ]);
  });

  it("changes nothing for the key the command has, and stops recording on Escape, on leaving the key and on another row", async () => {
    await renderAsync();

    await recordAsync("clock.tick");
    await pressAsync("clock.tick", { key: "t", code: "KeyT", ctrlKey: true, altKey: true });
    await recordAsync("clock.tick");
    const escape = await pressAsync("clock.tick", { key: "Escape", code: "Escape" });
    const afterEscape = keyOf("clock.tick").textContent?.trim();
    await recordAsync("clock.tick");
    keyOf("clock.tick").blur();
    await settleAsync();
    const afterBlur = keyOf("clock.tick").textContent?.trim();
    await recordAsync("clock.tick");
    const elsewhere = await pressAsync("notes.newNote", { key: "k", code: "KeyK", ctrlKey: true });

    expect([escape.defaultPrevented, afterEscape, afterBlur, elsewhere.defaultPrevented]).toEqual([true, "Ctrl+Alt+T", "Ctrl+Alt+T", false]);
    expect([settings.calls, notice("clock.tick")]).toEqual([[], null]);
  });

  it("leaves Tab to move the focus while recording", async () => {
    await renderAsync();

    await recordAsync("clock.tick");
    const tab = await pressAsync("clock.tick", { key: "Tab", code: "Tab", shiftKey: true });
    const keyup = await pressAsync("clock.tick", { key: "k", code: "KeyK" }, "keyup");

    expect([tab.defaultPrevented, keyup.defaultPrevented, keyOf("clock.tick").textContent?.trim()]).toEqual([false, false, "Press the new key"]);
  });

  it("removes a key, resets a command to its default, resets every shortcut, and reports a write that fails", async () => {
    await renderAsync("linux", { "notes.newNote": "F6" });

    const resetAll = page.getByRole("button", { name: "Reset all shortcuts" });
    await page.getByRole("button", { name: "Remove the key of Tick the clock" }).click();
    await settleAsync();
    const removed = cells("clock.tick").slice(2);
    await page.getByRole("button", { name: "Reset Tick the clock" }).click();
    await settleAsync();
    await resetAll.click();
    await settleAsync();
    const isDisabled = (resetAll.element() as HTMLButtonElement).disabled;
    settings.sets.set(new Set(["shell.keyBindings"]));
    settings.failure = new Error("The runtime refused the value.");
    await settleAsync();
    await resetAll.click();
    await page.getByRole("button", { name: "Remove the key of New note" }).click();
    await expect.poll(() => errors.length).toBe(2);

    expect(removed).toEqual(["No key", "Reset"]);
    expect(isDisabled).toBe(true);
    expect(settings.calls).toEqual([
      "set shell.keyBindings {\"notes.newNote\":\"F6\",\"clock.tick\":null}",
      "set shell.keyBindings {\"notes.newNote\":\"F6\"}",
      "reset shell.keyBindings",
      "reset shell.keyBindings",
      "set shell.keyBindings {\"notes.newNote\":null}"
    ]);
    expect(errors.map(t => (t as Error).message)).toEqual(["The runtime refused the value.", "The runtime refused the value."]);
  });

  it("records Cmd as Mod and Control as Ctrl on macOS, with the held modifiers as symbols and its own reasons", async () => {
    await renderAsync("darwin");

    await recordAsync("clock.tick");
    await pressAsync("clock.tick", { key: "Meta", code: "MetaLeft", metaKey: true, ctrlKey: true, altKey: true, shiftKey: true });
    const held = keyOf("clock.tick").textContent?.trim();
    await pressAsync("clock.tick", { key: "k", code: "KeyK", metaKey: true, altKey: true });
    await recordAsync("notes.newNote");
    await pressAsync("notes.newNote", { key: "Enter", code: "Enter", shiftKey: true });

    expect(held).toBe("⌃⌥⇧⌘…");
    expect(settings.calls).toEqual(["set shell.keyBindings {\"clock.tick\":\"Mod+Alt+K\"}"]);
    expect(cells("clock.tick")[2]).toBe("⌥⌘K");
    expect(notice("notes.newNote")).toBe("A key needs Command, Control, Option or a function key.");
  });

  it("names the Windows key on Windows", async () => {
    await renderAsync("win32");

    await recordAsync("clock.tick");
    await pressAsync("clock.tick", { key: "k", code: "KeyK", metaKey: true });

    expect(notice("clock.tick")).toBe("The Windows key can't be part of a shortcut.");
  });
});
