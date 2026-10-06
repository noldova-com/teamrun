/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component } from "@angular/core";
import { type ComponentFixture, TestBed } from "@angular/core/testing";
import { userEvent } from "vitest/browser";

import { FieldMenuComponent } from "../../../../src/app/components/field-menu/field-menu.component";
import { SpellingService } from "../../../../src/app/services/spelling.service";
import { DesktopBridgeFixture } from "../../../fixtures/desktop-bridge.fixture";

@Component({
  imports: [FieldMenuComponent],
  template: `
    <input class="field" type="text" value="Meetng notes" style="position: fixed; top: 100px; left: 100px; width: 200px;">
    <input class="locked" type="text" value="Read only" readonly style="position: fixed; top: 150px; left: 100px; width: 200px;">
    <textarea class="notes" style="position: fixed; top: 200px; left: 100px; width: 200px; height: 60px;">Week 3</textarea>
    <div class="rich" contenteditable="true" style="position: fixed; top: 300px; left: 100px; width: 200px;"><b class="bold">Rich</b> text</div>
    <div class="plain" style="position: fixed; top: 350px; left: 100px;">Plain text</div>
    <input class="own" type="text" value="Own menu" (contextmenu)="$event.preventDefault()" (keydown)="$event.preventDefault()">
    <div class="cdk-overlay-container"><input class="overlaid" type="text" value="Search"></div>
    <tr-field-menu />
  `
})
class HostComponent {
}

describe("FieldMenuComponent", () => {
  const WAIT = 300;

  let fixture: ComponentFixture<HostComponent>;
  let bridge: DesktopBridgeFixture;

  async function startAsync(platform: string = "win32"): Promise<void> {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    bridge = DesktopBridgeFixture.install(platform);
    bridge.spelling = Promise.resolve({ languages: ["en-US"], fallback: null });
    TestBed.inject(SpellingService);
    fixture = TestBed.createComponent(HostComponent);
    await settledAsync();
  }

  afterEach(() => {
    fixture.destroy();
    vi.useRealTimers();
    DesktopBridgeFixture.remove();
  });

  function find<T extends HTMLElement>(selector: string): T {
    return fixture.nativeElement.querySelector(selector);
  }

  function menu(): HTMLElement | null {
    return document.querySelector<HTMLElement>(".cdk-overlay-container tr-menu[data-place=\"shell.field\"]");
  }

  function row(label: string): HTMLElement | undefined {
    return [...menu()?.querySelectorAll<HTMLElement>(".tr-place-menu-item") ?? []].find(t => t.querySelector(".tr-menu-item-label")?.textContent === label);
  }

  function rows(): string[] {
    return [...menu()?.querySelectorAll<HTMLElement>(".tr-place-menu-item") ?? []]
      .map(t => `${t.dataset["command"] === "shell.replaceMisspelling" ? t.querySelector(".tr-menu-item-label")?.textContent : t.dataset["command"]}`
        + `${t.getAttribute("aria-disabled") === "true" ? " (disabled)" : ""}`);
  }

  async function settledAsync(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise(resolve => requestAnimationFrame(resolve));
  }

  async function rightClickAsync(element: HTMLElement, x: number, y: number): Promise<boolean> {
    const event = new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 2 });
    element.dispatchEvent(event);
    const isPrevented = event.defaultPrevented;
    await settledAsync();
    return isPrevented;
  }

  async function keyAsync(element: HTMLElement, init: KeyboardEventInit): Promise<boolean> {
    const event = new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init });
    element.dispatchEvent(event);
    const isPrevented = event.defaultPrevented;
    await settledAsync();
    return isPrevented;
  }

  async function answerAsync(x: number, y: number, isKeyboard: boolean, word: string = "", suggestions: string[] = []): Promise<void> {
    bridge.publishFieldMenu({ x, y, isKeyboard, word, suggestions });
    await settledAsync();
  }

  async function closeAsync(): Promise<void> {
    await userEvent.keyboard("{Escape}");
    await settledAsync();
  }

  it("leaves the click to the desktop and opens at the pointer with its suggestions when the desktop's message arrives", async () => {
    await startAsync();
    const field = find<HTMLInputElement>(".field");
    field.focus();
    field.setSelectionRange(0, 6);
    const isPrevented = await rightClickAsync(field, 150, 110);
    const isOpenBeforeAnswer = menu() !== null;
    await answerAsync(150, 110, false, "Meetng", ["Meeting", "Meting"]);
    const box = menu()?.getBoundingClientRect();
    const misspelled = rows();
    await userEvent.click(row("Meeting") ?? document.body);
    await settledAsync();
    await vi.waitFor(() => expect(bridge.replacements).toEqual(["Meeting"]));
    const focusAfterReplace = document.activeElement;
    field.setSelectionRange(3, 3);
    await rightClickAsync(field, 150, 110);
    await answerAsync(150.5, 109.5, false, "Meetng", []);
    const unknown = rows();
    await closeAsync();
    const locked = find<HTMLInputElement>(".locked");
    locked.focus();
    locked.setSelectionRange(0, 4);
    await rightClickAsync(locked, 150, 160);
    await answerAsync(150, 160, false);
    const readOnly = rows();

    expect([isPrevented, isOpenBeforeAnswer]).toEqual([false, false]);
    expect([box?.left, box?.top]).toEqual([150, 110]);
    expect(misspelled).toEqual(["Meeting", "Meting", "shell.addToDictionary", "shell.cut", "shell.copy", "shell.paste", "shell.selectAll"]);
    expect(focusAfterReplace).toBe(field);
    expect(unknown).toEqual(["No suggestions (disabled)", "shell.addToDictionary", "shell.cut (disabled)", "shell.copy (disabled)", "shell.paste", "shell.selectAll"]);
    expect(readOnly).toEqual(["shell.cut (disabled)", "shell.copy", "shell.paste (disabled)", "shell.selectAll"]);
  });

  it("opens the plain menu after a short wait when no message arrives, and drops a message for another click or a late one", async () => {
    await startAsync();
    const field = find<HTMLInputElement>(".field");
    field.focus();
    await rightClickAsync(field, 150, 110);
    await answerAsync(152, 110, false, "Meetng", ["Meeting"]);
    await answerAsync(150, 112, false, "Meetng", ["Meeting"]);
    await answerAsync(150, 110, true, "Meetng", ["Meeting"]);
    const isOpenAfterOthers = menu() !== null;
    vi.advanceTimersByTime(WAIT - 1);
    const isOpenBeforeWait = menu() !== null;
    vi.advanceTimersByTime(1);
    await settledAsync();
    const plain = rows();
    await closeAsync();
    await answerAsync(150, 110, false, "Meetng", ["Meeting"]);
    const isOpenAfterLate = menu() !== null;
    await rightClickAsync(field, 150, 110);
    field.remove();
    await answerAsync(150, 110, false);
    const isOpenAfterRemoval = menu() !== null;

    expect([isOpenAfterOthers, isOpenBeforeWait]).toEqual([false, false]);
    expect(plain).toEqual(["shell.cut (disabled)", "shell.copy (disabled)", "shell.paste", "shell.selectAll"]);
    expect([isOpenAfterLate, isOpenAfterRemoval]).toEqual([false, false]);
  });

  it("opens from the menu key and Shift+F10 below the field's start, ignoring the click those keys make, and a row edits the field", async () => {
    await startAsync();
    const notes = find<HTMLTextAreaElement>(".notes");
    notes.focus();
    notes.setSelectionRange(0, 4);
    const other = await keyAsync(notes, { key: "F10" });
    await answerAsync(0, 0, true);
    const isOpenAfterOther = menu() !== null;
    const shifted = await keyAsync(notes, { key: "F10", shiftKey: true });
    await rightClickAsync(notes, 0, 0);
    await answerAsync(0, 0, false);
    const isOpenAfterClick = menu() !== null;
    await answerAsync(0, 0, true);
    const box = menu()?.getBoundingClientRect();
    const bounds = notes.getBoundingClientRect();
    await closeAsync();
    const menuKey = await keyAsync(notes, { key: "ContextMenu" });
    vi.advanceTimersByTime(WAIT);
    await settledAsync();
    await userEvent.keyboard("{Enter}");
    await settledAsync();
    await vi.waitFor(() => expect(bridge.edits).toEqual(["Cut"]));

    expect([other, isOpenAfterOther]).toEqual([false, false]);
    expect([shifted, menuKey, isOpenAfterClick]).toEqual([false, false, false]);
    expect([box?.left, box?.top]).toEqual([bounds.left, bounds.bottom]);
    expect(menu()).toBeNull();
    expect(document.activeElement).toBe(notes);
  });

  it("opens from the keyboard at once on macOS, where those keys bring no message", async () => {
    await startAsync("darwin");
    const notes = find<HTMLTextAreaElement>(".notes");
    notes.focus();

    await keyAsync(notes, { key: "F10", shiftKey: true });

    expect(rows()).toEqual(["shell.cut (disabled)", "shell.copy (disabled)", "shell.paste", "shell.selectAll"]);
  });

  it("opens inside rich text, but not on plain text, on a field whose own menu took the event, or in an overlay", async () => {
    await startAsync();
    find<HTMLElement>(".rich").focus();
    await rightClickAsync(find(".bold"), 120, 310);
    await answerAsync(120, 310, false);
    const isOpenInRichText = menu() !== null;
    await closeAsync();
    const focusAfterRichText = document.activeElement;
    await rightClickAsync(find(".plain"), 120, 360);
    await answerAsync(120, 360, false);
    const own = find<HTMLInputElement>(".own");
    own.focus();
    await rightClickAsync(own, 10, 10);
    await answerAsync(10, 10, false);
    await keyAsync(own, { key: "ContextMenu" });
    await answerAsync(10, 10, true);
    const overlaid = find<HTMLInputElement>(".overlaid");
    overlaid.focus();
    await rightClickAsync(overlaid, 10, 10);
    await answerAsync(10, 10, false);

    expect(isOpenInRichText).toBe(true);
    expect(focusAfterRichText).toBe(find(".rich"));
    expect(menu()).toBeNull();
  });

  it("stops listening for the desktop's messages and its wait when it goes", async () => {
    await startAsync();
    const field = find<HTMLInputElement>(".field");
    field.focus();
    await rightClickAsync(field, 150, 110);
    const listening = bridge.fieldMenuListenerCount;

    fixture.destroy();
    vi.advanceTimersByTime(WAIT);

    expect([listening, bridge.fieldMenuListenerCount]).toEqual([1, 0]);
    expect(menu()).toBeNull();
  });
});
