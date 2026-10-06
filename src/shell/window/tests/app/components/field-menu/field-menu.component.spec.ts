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
import { DesktopBridgeFixture } from "../../../fixtures/desktop-bridge.fixture";

@Component({
  imports: [FieldMenuComponent],
  template: `
    <input class="field" type="text" value="Meeting notes" style="position: fixed; top: 100px; left: 100px; width: 200px;">
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
  let fixture: ComponentFixture<HostComponent>;
  let bridge: DesktopBridgeFixture;

  beforeEach(async () => {
    bridge = DesktopBridgeFixture.install();
    fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  afterEach(() => {
    fixture.destroy();
    DesktopBridgeFixture.remove();
  });

  function find<T extends HTMLElement>(selector: string): T {
    return fixture.nativeElement.querySelector(selector);
  }

  function menu(): HTMLElement | null {
    return document.querySelector<HTMLElement>(".cdk-overlay-container tr-menu[data-place=\"shell.field\"]");
  }

  function rows(): string[] {
    return [...menu()?.querySelectorAll<HTMLElement>(".tr-place-menu-item") ?? []]
      .map(t => `${t.dataset["command"]}${t.getAttribute("aria-disabled") === "true" ? " (disabled)" : ""}`);
  }

  async function settledAsync(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise(resolve => requestAnimationFrame(resolve));
  }

  async function rightClickAsync(element: HTMLElement, x: number, y: number): Promise<MouseEvent> {
    const event = new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 2 });
    element.dispatchEvent(event);
    await settledAsync();
    return event;
  }

  async function keyAsync(element: HTMLElement, init: KeyboardEventInit): Promise<KeyboardEvent> {
    const event = new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init });
    element.dispatchEvent(event);
    await settledAsync();
    return event;
  }

  async function closeAsync(): Promise<void> {
    await userEvent.keyboard("{Escape}");
    await settledAsync();
  }

  it("opens the text field menu at the pointer in an editable field, its rows enabled as the field allows", async () => {
    const field = find<HTMLInputElement>(".field");
    field.focus();
    field.setSelectionRange(0, 7);
    const opening = await rightClickAsync(field, 150, 110);
    const box = menu()?.getBoundingClientRect();
    const selected = rows();
    await closeAsync();
    const focusAfterEscape = document.activeElement;
    field.setSelectionRange(3, 3);
    await rightClickAsync(field, 150, 110);
    const collapsed = rows();
    await closeAsync();
    const locked = find<HTMLInputElement>(".locked");
    locked.focus();
    locked.setSelectionRange(0, 4);
    await rightClickAsync(locked, 150, 160);
    const readOnly = rows();

    expect(opening.defaultPrevented).toBe(true);
    expect([box?.left, box?.top]).toEqual([150, 110]);
    expect(selected).toEqual(["shell.cut", "shell.copy", "shell.paste", "shell.selectAll"]);
    expect(focusAfterEscape).toBe(field);
    expect(collapsed).toEqual(["shell.cut (disabled)", "shell.copy (disabled)", "shell.paste", "shell.selectAll"]);
    expect(readOnly).toEqual(["shell.cut (disabled)", "shell.copy", "shell.paste (disabled)", "shell.selectAll"]);
  });

  it("opens from the menu key and Shift+F10 below the field's start, and a row edits the field", async () => {
    const notes = find<HTMLTextAreaElement>(".notes");
    notes.focus();
    notes.setSelectionRange(0, 4);
    const other = await keyAsync(notes, { key: "F10" });
    const isOpenAfterOther = menu() !== null;
    const shifted = await keyAsync(notes, { key: "F10", shiftKey: true });
    const box = menu()?.getBoundingClientRect();
    const bounds = notes.getBoundingClientRect();
    await closeAsync();
    const menuKey = await keyAsync(notes, { key: "ContextMenu" });
    await userEvent.keyboard("{Enter}");
    await settledAsync();
    await vi.waitFor(() => expect(bridge.edits).toEqual(["Cut"]));

    expect([other.defaultPrevented, isOpenAfterOther]).toEqual([false, false]);
    expect([shifted.defaultPrevented, menuKey.defaultPrevented]).toEqual([true, true]);
    expect([box?.left, box?.top]).toEqual([bounds.left, bounds.bottom]);
    expect(menu()).toBeNull();
    expect(document.activeElement).toBe(notes);
  });

  it("opens inside rich text, but not on plain text, on a field whose own menu took the event, or in an overlay", async () => {
    find<HTMLElement>(".rich").focus();
    await rightClickAsync(find(".bold"), 120, 310);
    const isOpenInRichText = menu() !== null;
    await closeAsync();
    const focusAfterRichText = document.activeElement;
    const plain = await rightClickAsync(find(".plain"), 120, 360);
    const own = find<HTMLInputElement>(".own");
    own.focus();
    await rightClickAsync(own, 10, 10);
    await keyAsync(own, { key: "ContextMenu" });
    const overlaid = find<HTMLInputElement>(".overlaid");
    overlaid.focus();
    const inOverlay = await rightClickAsync(overlaid, 10, 10);

    expect(isOpenInRichText).toBe(true);
    expect(focusAfterRichText).toBe(find(".rich"));
    expect([plain.defaultPrevented, inOverlay.defaultPrevented]).toEqual([false, false]);
    expect(menu()).toBeNull();
  });
});
