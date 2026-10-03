/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, signal } from "@angular/core";
import { type ComponentFixture, TestBed } from "@angular/core/testing";
import { userEvent } from "vitest/browser";

import { ToolbarItemDirective } from "../../../../src/app/components/toolbar/toolbar-item.directive";
import { ToolbarDirective } from "../../../../src/app/components/toolbar/toolbar.directive";
import { ToolbarOrientation } from "../../../../src/app/enums/toolbar-orientation";

@Component({
  imports: [ToolbarDirective, ToolbarItemDirective],
  template: `
    <button type="button" class="before">Before</button>
    <div trToolbar [trToolbarOrientation]="orientation()" [trToolbarLabel]="label()" [trToolbarWrap]="isWrapping()">
      @for (item of items(); track item) {
        @if (item === "|") {
          <span role="separator"></span>
        } @else {
          <button type="button" trToolbarItem [attr.data-item]="item" [attr.aria-disabled]="item === 'Locked' ? 'true' : null">{{ item }}</button>
        }
      }
      <span class="plain" tabindex="-1">Plain</span>
    </div>
    <button type="button" class="after">After</button>
  `
})
class ToolbarHostComponent {
  public readonly orientation = signal(ToolbarOrientation.Horizontal);
  public readonly label = signal<string | null>("Formatting");
  public readonly isWrapping = signal(false);
  public readonly items = signal<readonly string[]>(["Bold", "Italic", "|", "Locked", "Link"]);
}

describe("ToolbarDirective", () => {
  let fixture: ComponentFixture<ToolbarHostComponent>;
  let host: ToolbarHostComponent;

  beforeEach(async () => {
    fixture = TestBed.createComponent(ToolbarHostComponent);
    host = fixture.componentInstance;
    await fixture.whenStable();
  });

  afterEach(() => fixture.destroy());

  function toolbar(): HTMLElement {
    return fixture.nativeElement.querySelector("[trToolbar]");
  }

  function item(name: string): HTMLElement {
    return fixture.nativeElement.querySelector(`[data-item="${name}"]`);
  }

  function focused(): string | null {
    return (document.activeElement as HTMLElement | null)?.dataset["item"] ?? null;
  }

  function tabStops(): readonly string[] {
    return [...toolbar().querySelectorAll<HTMLElement>("[trToolbarItem]")].filter(t => t.tabIndex === 0).map(t => t.dataset["item"] ?? "");
  }

  async function updateAsync(change: () => void): Promise<void> {
    change();
    await fixture.whenStable();
  }

  async function pressAsync(keys: string): Promise<boolean> {
    let isPrevented = false;
    const listener = (event: KeyboardEvent): void => {
      isPrevented ||= event.defaultPrevented;
    };
    document.addEventListener("keydown", listener);
    await userEvent.keyboard(keys);
    document.removeEventListener("keydown", listener);
    await fixture.whenStable();
    return isPrevented;
  }

  it("is a labelled toolbar with its orientation and one tab stop, its first item", async () => {
    expect([toolbar().getAttribute("role"), toolbar().getAttribute("aria-orientation"), toolbar().getAttribute("aria-label")]).toEqual(["toolbar", "horizontal", "Formatting"]);
    expect(tabStops()).toEqual(["Bold"]);

    await updateAsync(() => {
      host.orientation.set(ToolbarOrientation.Vertical);
      host.label.set(null);
    });

    expect([toolbar().getAttribute("aria-orientation"), toolbar().hasAttribute("aria-label")]).toEqual(["vertical", false]);
  });

  it("moves along a horizontal strip with Left, Right, Home and End, past separators and onto disabled items, stopping at the ends", async () => {
    item("Bold").focus();
    const visited: (string | null)[] = [];
    for (const key of ["ArrowRight", "ArrowRight", "ArrowRight", "ArrowRight", "ArrowLeft", "Home", "ArrowLeft", "End"]) {
      expect(await pressAsync(`{${key}}`)).toBe(true);
      visited.push(focused());
    }

    expect(visited).toEqual(["Italic", "Locked", "Link", "Link", "Locked", "Bold", "Bold", "Link"]);
    expect(tabStops()).toEqual(["Link"]);
  });

  it("leaves the other axis, activation keys and modified keys to the item", async () => {
    item("Italic").focus();

    const left = [await pressAsync("{ArrowDown}"), await pressAsync("{ArrowUp}"), await pressAsync("{Enter}"), await pressAsync("[Space]"), await pressAsync("{Shift>}{ArrowRight}{/Shift}")];

    expect(left).toEqual([false, false, false, false, false]);
    expect(focused()).toBe("Italic");
  });

  it("moves along a vertical strip with Up and Down, wrapping at the ends when asked, and leaves Left and Right alone", async () => {
    await updateAsync(() => {
      host.orientation.set(ToolbarOrientation.Vertical);
      host.isWrapping.set(true);
    });
    item("Bold").focus();
    const visited: (string | null)[] = [];
    for (const key of ["ArrowUp", "ArrowDown", "ArrowRight"])
      visited.push(await pressAsync(`{${key}}`) ? focused() : "left alone");

    expect(visited).toEqual(["Link", "Bold", "left alone"]);
  });

  it("is tabbed into at the item last focused, by keys or by pointer", async () => {
    item("Bold").focus();
    await pressAsync("{ArrowRight}");
    (fixture.nativeElement.querySelector(".after") as HTMLElement).focus();
    await userEvent.keyboard("{Shift>}{Tab}{/Shift}");
    const byKeys = focused();
    await userEvent.click(item("Link"));
    (fixture.nativeElement.querySelector(".before") as HTMLElement).focus();
    await userEvent.keyboard("{Tab}");

    expect([byKeys, focused()]).toEqual(["Italic", "Link"]);
  });

  it("ignores keys and focus on anything inside it that is not an item", async () => {
    const plain = fixture.nativeElement.querySelector(".plain") as HTMLElement;
    plain.focus();
    await fixture.whenStable();

    const isPrevented = await pressAsync("{ArrowRight}");

    expect([isPrevented, document.activeElement, tabStops()]).toEqual([false, plain, ["Bold"]]);
  });

  it("follows items added and removed while it runs, falling back to the first when the remembered one goes", async () => {
    item("Locked").focus();
    await fixture.whenStable();

    await updateAsync(() => host.items.set(["Bold", "Italic", "|", "Link", "Code"]));
    const fallback = tabStops();
    item("Link").focus();
    await pressAsync("{ArrowRight}");
    await updateAsync(() => host.items.set([]));

    expect(fallback).toEqual(["Bold"]);
    expect(focused()).toBe(null);
    expect(tabStops()).toEqual([]);
    await updateAsync(() => host.items.set(["Undo"]));
    expect(tabStops()).toEqual(["Undo"]);
  });
});
