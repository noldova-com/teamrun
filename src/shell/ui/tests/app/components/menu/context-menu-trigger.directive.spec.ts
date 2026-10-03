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

import { ContextMenuTriggerDirective } from "../../../../src/app/components/menu/context-menu-trigger.directive";
import { MenuItemComponent } from "../../../../src/app/components/menu/menu-item.component";
import { MenuTriggerDirective } from "../../../../src/app/components/menu/menu-trigger.directive";
import { MenuComponent } from "../../../../src/app/components/menu/menu.component";
import { ThemeMode } from "../../../../src/app/enums/theme-mode";
import { DefaultTheme } from "../../../../src/app/themes/default-theme";
import { AppearanceFixture } from "../../../fixtures/appearance.fixture";

@Component({
  imports: [ContextMenuTriggerDirective, MenuComponent, MenuItemComponent, MenuTriggerDirective],
  template: `
    <div class="area" tabindex="0" style="position: fixed; top: 100px; left: 100px; width: 200px; height: 100px;"
      [trContextMenuTriggerFor]="isEnabled() ? context : null"></div>
    <button type="button" class="other" style="position: fixed; top: 300px; left: 600px;" [trMenuTriggerFor]="otherMenu">Other</button>
    <ng-template #context>
      <tr-menu class="context">
        <button tr-menu-item class="alpha" label="Alpha" (triggered)="chosen.push('alpha')"></button>
        <button tr-menu-item class="beta" label="Beta"></button>
        <button tr-menu-item class="more" label="More" [trMenuTriggerFor]="submenu"></button>
      </tr-menu>
    </ng-template>
    <ng-template #submenu>
      <tr-menu class="submenu">
        <button tr-menu-item label="Nested"></button>
      </tr-menu>
    </ng-template>
    <ng-template #otherMenu>
      <tr-menu class="other-menu">
        <button tr-menu-item label="Other row"></button>
      </tr-menu>
    </ng-template>
  `
})
class ContextHostComponent {
  public readonly isEnabled = signal(true);
  public readonly chosen: string[] = [];
}

describe("ContextMenuTriggerDirective", () => {
  let fixture: ComponentFixture<ContextHostComponent>;

  beforeEach(async () => {
    AppearanceFixture.apply();
    fixture = TestBed.createComponent(ContextHostComponent);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  afterEach(() => {
    fixture.destroy();
    AppearanceFixture.reset();
  });

  function area(): HTMLElement {
    return fixture.nativeElement.querySelector(".area");
  }

  function menu(name: string = "context"): HTMLElement | null {
    return document.querySelector<HTMLElement>(`.cdk-overlay-container tr-menu.${name}`);
  }

  async function settledAsync(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise(resolve => requestAnimationFrame(resolve));
  }

  function contextMenu(x: number, y: number, init: MouseEventInit = {}): MouseEvent {
    const event = new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 2, ...init });
    area().dispatchEvent(event);
    return event;
  }

  function key(init: KeyboardEventInit): KeyboardEvent {
    const event = new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init });
    area().dispatchEvent(event);
    return event;
  }

  it("opens at the pointer on a right click, in the kit's pane, and ignores the click that ends the press", async () => {
    await userEvent.click(area(), { button: "right", position: { x: 40, y: 30 } });
    await settledAsync();
    const box = menu()?.getBoundingClientRect();

    expect(menu()?.parentElement?.classList.contains("tr-menu-pane")).toBe(true);
    expect([box?.left, box?.top]).toEqual([140, 130]);
    expect(document.activeElement?.classList.contains("alpha")).toBe(true);
  });

  it("ignores the click that ends a Control press and closes on the next click outside, but not on a click inside", async () => {
    const opening = contextMenu(150, 120, { ctrlKey: true, button: 0 });
    await settledAsync();
    document.body.dispatchEvent(new MouseEvent("click", { bubbles: true, ctrlKey: true }));
    const isOpenAfterEcho = menu() !== null;
    menu()?.click();
    const isOpenAfterInside = menu() !== null;
    document.body.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await settledAsync();

    expect(opening.defaultPrevented).toBe(true);
    expect([isOpenAfterEcho, isOpenAfterInside]).toEqual([true, true]);
    expect(menu()).toBeNull();
  });

  it("opens from Shift+F10 and the menu key below its host's start, ignoring other keys", async () => {
    const keys = [key({ key: "F10" }), key({ key: "a" })];
    await settledAsync();
    const isOpenAfterOthers = menu() !== null;
    const shifted = key({ key: "F10", shiftKey: true });
    await settledAsync();
    const box = menu()?.getBoundingClientRect();
    const host = area().getBoundingClientRect();
    await userEvent.keyboard("{Escape}");
    await settledAsync();
    const menuKey = key({ key: "ContextMenu" });
    await settledAsync();

    expect(keys.map(t => t.defaultPrevented)).toEqual([false, false]);
    expect(isOpenAfterOthers).toBe(false);
    expect([shifted.defaultPrevented, menuKey.defaultPrevented]).toEqual([true, true]);
    expect([box?.left, box?.top]).toEqual([host.left, host.bottom]);
    expect(menu()).not.toBeNull();
  });

  it("opens no submenu and shows no hover for a pointer resting where its menu opens, until the pointer moves", async () => {
    key({ key: "ContextMenu" });
    await settledAsync();
    const measured = menu()?.querySelector(".more")?.getBoundingClientRect() as DOMRect;
    await userEvent.keyboard("{Escape}");
    await settledAsync();
    await userEvent.hover(document.documentElement, { position: { x: measured.left + measured.width / 2, y: measured.top + measured.height / 2 } });
    key({ key: "ContextMenu" });
    await settledAsync();
    const more = menu()?.querySelector(".more") as HTMLElement;
    await vi.waitFor(() => expect(more.matches(":hover")).toBe(true));
    await settledAsync();
    const stillBackground = getComputedStyle(more, "::before").backgroundColor;
    const isSubmenuOpenWhileStill = menu("submenu") !== null;

    await userEvent.hover(more, { position: { x: 8, y: 4 } });
    await vi.waitFor(() => expect(menu("submenu")).not.toBeNull());

    expect(isSubmenuOpenWhileStill).toBe(false);
    expect(stillBackground).toBe("rgba(0, 0, 0, 0)");
    expect(getComputedStyle(more, "::before").backgroundColor).toBe(AppearanceFixture.readColor(DefaultTheme.theme, ThemeMode.Light, "list.hoverBackground"));
  });

  it("leaves the row the pointer rested on alone when the pointer moves to another row", async () => {
    key({ key: "ContextMenu" });
    await settledAsync();
    const measured = menu()?.querySelector(".more")?.getBoundingClientRect() as DOMRect;
    await userEvent.keyboard("{Escape}");
    await settledAsync();
    await userEvent.hover(document.documentElement, { position: { x: measured.left + measured.width / 2, y: measured.top + measured.height / 2 } });
    key({ key: "ContextMenu" });
    await settledAsync();
    await vi.waitFor(() => expect(menu()?.querySelector(".more")?.matches(":hover")).toBe(true));
    const alpha = menu()?.querySelector(".alpha") as HTMLElement;

    await userEvent.hover(alpha);
    await vi.waitFor(() => expect(getComputedStyle(alpha, "::before").backgroundColor).toBe(AppearanceFixture.readColor(DefaultTheme.theme, ThemeMode.Light, "list.hoverBackground")));
    await settledAsync();

    expect(menu("submenu")).toBeNull();
  });

  it("closes with Escape and after running a row, returning focus to its host", async () => {
    key({ key: "ContextMenu" });
    await settledAsync();
    await userEvent.keyboard("{Escape}");
    await settledAsync();
    const focusAfterEscape = document.activeElement;
    key({ key: "ContextMenu" });
    await settledAsync();
    await userEvent.keyboard("{Enter}");
    await settledAsync();

    expect(focusAfterEscape).toBe(area());
    expect(fixture.componentInstance.chosen).toEqual(["alpha"]);
    expect(menu()).toBeNull();
    expect(document.activeElement).toBe(area());
  });

  it("moves to a new point when opened again and closes another open menu", async () => {
    const other: HTMLButtonElement = fixture.nativeElement.querySelector(".other");
    other.click();
    await settledAsync();
    const isOtherOpen = menu("other-menu") !== null;
    contextMenu(110, 110);
    await settledAsync();
    contextMenu(250, 150);
    await settledAsync();

    expect(isOtherOpen).toBe(true);
    expect(menu("other-menu")).toBeNull();
    expect(document.querySelectorAll(".cdk-overlay-container tr-menu.context").length).toBe(1);
    expect(menu()?.getBoundingClientRect().left).toBe(250);
  });

  it("closes when focus leaves its menus and when something around its host scrolls", async () => {
    key({ key: "ContextMenu" });
    await settledAsync();
    fixture.nativeElement.querySelector(".other").focus();
    await vi.waitFor(() => expect(menu()).toBeNull());
    key({ key: "ContextMenu" });
    await settledAsync();

    area().style.top = "140px";
    fixture.nativeElement.dispatchEvent(new Event("scroll"));
    await settledAsync();

    expect(menu()).toBeNull();
  });

  it("stays open for a click in its submenu, and Escape there closes only the submenu", async () => {
    key({ key: "ContextMenu" });
    await settledAsync();
    await userEvent.keyboard("{End}{ArrowRight}");
    await settledAsync();
    menu("submenu")?.click();
    await settledAsync();
    const isOpenAfterClick = [menu(), menu("submenu")].every(t => t !== null);
    await userEvent.keyboard("{Escape}");
    await settledAsync();

    expect(isOpenAfterClick).toBe(true);
    expect(menu("submenu")).toBeNull();
    expect(menu()).not.toBeNull();
    expect(document.activeElement?.classList.contains("more")).toBe(true);
  });

  it("opens nothing without a menu", async () => {
    fixture.componentInstance.isEnabled.set(false);
    fixture.detectChanges();

    contextMenu(150, 150);
    await settledAsync();

    expect(document.querySelector(".cdk-overlay-container tr-menu")).toBeNull();
  });
});
