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

import { MenuItemComponent } from "../../../../src/app/components/menu/menu-item.component";
import { MenuTriggerDirective } from "../../../../src/app/components/menu/menu-trigger.directive";
import { MenuComponent } from "../../../../src/app/components/menu/menu.component";
import { OverlayAlignment } from "../../../../src/app/enums/overlay-alignment";
import { AppearanceFixture } from "../../../fixtures/appearance.fixture";

@Component({
  imports: [MenuComponent, MenuItemComponent, MenuTriggerDirective],
  template: `
    <div class="scroller" style="position: fixed; overflow: auto;" [style.top.px]="top()" [style.left.px]="left()">
      <button type="button" class="trigger" [trMenuTriggerFor]="root" [trMenuAlignment]="alignment()">Open</button>
    </div>
    <button type="button" class="outside" style="position: fixed; top: 300px; left: 600px;">Outside</button>
    <ng-template #root>
      <tr-menu class="root">
        <button tr-menu-item class="alpha" label="Alpha" icon="add" (triggered)="chosen.push('alpha')"></button>
        <button tr-menu-item class="beta" label="Beta" [trMenuTriggerFor]="submenu"></button>
        <button tr-menu-item class="gamma" label="Gamma" [disabled]="true" (triggered)="chosen.push('gamma')"></button>
        <button tr-menu-item class="delta" label="Delta" (triggered)="chosen.push('delta')"></button>
      </tr-menu>
    </ng-template>
    <ng-template #submenu>
      <tr-menu class="submenu">
        <button tr-menu-item class="one" label="One" (triggered)="chosen.push('one')"></button>
        <button tr-menu-item class="two" label="Two"></button>
      </tr-menu>
    </ng-template>
  `
})
class MenuHostComponent {
  public readonly top = signal(100);
  public readonly left = signal(100);
  public readonly alignment = signal(OverlayAlignment.Start);
  public readonly chosen: string[] = [];
}

describe("MenuTriggerDirective", () => {
  let fixture: ComponentFixture<MenuHostComponent>;

  beforeEach(async () => {
    AppearanceFixture.apply();
    fixture = TestBed.createComponent(MenuHostComponent);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  afterEach(() => {
    fixture.destroy();
    AppearanceFixture.reset();
  });

  function trigger(): HTMLButtonElement {
    return fixture.nativeElement.querySelector(".trigger");
  }

  function menu(name: string): HTMLElement | null {
    return document.querySelector<HTMLElement>(`.cdk-overlay-container tr-menu.${name}`);
  }

  function row(name: string): HTMLButtonElement {
    const found = document.querySelector<HTMLButtonElement>(`.cdk-overlay-container .${name}`);
    if (found === null)
      throw new Error(`No ${name} row is shown.`);
    return found;
  }

  function focused(): string | undefined {
    return [...document.activeElement?.classList ?? []].find(t => ["alpha", "beta", "gamma", "delta", "one", "two", "trigger"].includes(t));
  }

  async function settledAsync(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise(resolve => requestAnimationFrame(resolve));
  }

  async function openFromKeyboardAsync(): Promise<void> {
    trigger().focus();
    await userEvent.keyboard("{Enter}");
    await settledAsync();
  }

  it("opens below its trigger in the kit's own pane, not in a connected one, and marks the trigger expanded", async () => {
    trigger().click();
    await settledAsync();
    const panel = menu("root");
    const pane = panel?.parentElement;

    expect(pane?.classList.contains("tr-menu-pane")).toBe(true);
    expect(pane?.parentElement?.classList.contains("cdk-global-overlay-wrapper")).toBe(true);
    expect(document.querySelector(".cdk-overlay-connected-position-bounding-box")).toBeNull();
    expect(panel?.getBoundingClientRect().left).toBeCloseTo(trigger().getBoundingClientRect().left, 0);
    expect(panel?.getBoundingClientRect().top).toBeCloseTo(trigger().getBoundingClientRect().bottom, 0);
    expect(trigger().getAttribute("aria-haspopup")).toBe("menu");
    expect(trigger().getAttribute("aria-expanded")).toBe("true");
    expect(panel?.getAttribute("role")).toBe("menu");
  });

  it("aligns its end with the trigger's end when asked", async () => {
    fixture.componentInstance.left.set(400);
    fixture.componentInstance.alignment.set(OverlayAlignment.End);
    fixture.detectChanges();
    trigger().click();
    await settledAsync();

    await vi.waitFor(() => expect(menu("root")?.getBoundingClientRect().right).toBeCloseTo(trigger().getBoundingClientRect().right, 0));
  });

  it("moves through its rows with the arrow keys, Home, End and type-ahead, skipping nothing", async () => {
    await openFromKeyboardAsync();
    const visited = [focused()];
    for (const key of ["{ArrowDown}", "{ArrowDown}", "{ArrowDown}", "{ArrowDown}", "{ArrowUp}", "{Home}", "{End}"]) {
      await userEvent.keyboard(key);
      visited.push(focused());
    }
    await userEvent.keyboard("g");
    await vi.waitFor(() => expect(focused()).toBe("gamma"));

    expect(visited).toEqual(["alpha", "beta", "gamma", "delta", "alpha", "delta", "alpha", "delta"]);
  });

  it("runs a row with Enter, closes and returns focus to its trigger, and keeps a disabled row inert", async () => {
    await openFromKeyboardAsync();
    await userEvent.keyboard("{ArrowDown}{ArrowDown}{Enter}");
    await settledAsync();
    const isOpenAfterDisabled = menu("root") !== null;
    await userEvent.keyboard("{ArrowDown}{Enter}");
    await settledAsync();

    expect(isOpenAfterDisabled).toBe(true);
    expect(fixture.componentInstance.chosen).toEqual(["delta"]);
    expect(menu("root")).toBeNull();
    expect(focused()).toBe("trigger");
    expect(trigger().getAttribute("aria-expanded")).toBe("false");
  });

  it("closes with Escape and returns focus to its trigger", async () => {
    await openFromKeyboardAsync();
    await userEvent.keyboard("{Escape}");
    await settledAsync();

    expect(menu("root")).toBeNull();
    expect(focused()).toBe("trigger");
  });

  it("closes on a click outside, but not on a click inside", async () => {
    trigger().click();
    await settledAsync();
    row("gamma").click();
    const isOpenAfterInside = menu("root") !== null;
    await userEvent.click(fixture.nativeElement.querySelector(".outside"));
    await settledAsync();

    expect(isOpenAfterInside).toBe(true);
    expect(menu("root")).toBeNull();
  });

  it("opens a submenu with Right, its first row focused, and leaves it with Left back on its row", async () => {
    await openFromKeyboardAsync();
    await userEvent.keyboard("{ArrowDown}");
    expect(row("beta").querySelector(".tr-menu-item-chevron")?.textContent).toBe("chevron_right");
    await userEvent.keyboard("{ArrowRight}");
    await settledAsync();
    const focusedInSubmenu = focused();
    await userEvent.keyboard("{ArrowLeft}");
    await settledAsync();

    expect(focusedInSubmenu).toBe("one");
    expect(menu("submenu")).toBeNull();
    expect(menu("root")).not.toBeNull();
    expect(focused()).toBe("beta");
  });

  it("opens a submenu on hover flush against its menu, its first row level with the trigger row, keeps it open when its row is clicked or chosen again, and runs a row in it", async () => {
    await userEvent.click(trigger());
    await settledAsync();
    await userEvent.hover(row("beta"));
    await vi.waitFor(() => expect(menu("submenu")).not.toBeNull());
    await settledAsync();
    const parent = menu("root")?.getBoundingClientRect();
    const child = menu("submenu")?.getBoundingClientRect();

    expect(child?.left).toBeCloseTo(parent?.right ?? 0, 0);
    expect(row("one").getBoundingClientRect().top).toBeCloseTo(row("beta").getBoundingClientRect().top, 0);
    expect(row("beta").getAttribute("aria-expanded")).toBe("true");
    await userEvent.click(row("beta"));
    await settledAsync();
    expect(menu("submenu")).not.toBeNull();
    row("beta").focus();
    await userEvent.keyboard("{Enter}");
    await settledAsync();
    expect(menu("submenu")).not.toBeNull();
    await userEvent.click(row("one"));
    await settledAsync();
    expect(fixture.componentInstance.chosen).toEqual(["one"]);
    expect(menu("root")).toBeNull();
  });

  it("flips a submenu to its menu's start side at the window's right edge", async () => {
    fixture.componentInstance.left.set(document.documentElement.clientWidth - 60);
    fixture.componentInstance.alignment.set(OverlayAlignment.End);
    fixture.detectChanges();
    trigger().click();
    await settledAsync();
    row("beta").click();
    await settledAsync();

    expect(menu("submenu")?.getBoundingClientRect().right).toBeCloseTo(menu("root")?.getBoundingClientRect().left ?? 0, 0);
  });

  it("closes every menu when something around its trigger scrolls", async () => {
    trigger().click();
    await settledAsync();
    row("beta").click();
    await settledAsync();

    fixture.componentInstance.top.set(140);
    fixture.detectChanges();
    fixture.nativeElement.querySelector(".scroller").dispatchEvent(new Event("scroll"));
    await settledAsync();

    expect(menu("submenu")).toBeNull();
    expect(menu("root")).toBeNull();
  });

  it("keeps its menu open when opened again, and closes it when toggled", async () => {
    trigger().click();
    await settledAsync();
    const directive = fixture.debugElement.query(t => t.nativeElement === trigger()).injector.get(MenuTriggerDirective);
    directive.open();
    const isOpenAfterAgain = menu("root") !== null;
    trigger().click();
    await settledAsync();

    expect(isOpenAfterAgain).toBe(true);
    expect(menu("root")).toBeNull();
  });

  it("opens its menu with the focus on the first item when asked to focus", async () => {
    const directive = fixture.debugElement.query(t => t.nativeElement === trigger()).injector.get(MenuTriggerDirective);

    directive.openFocusing("keyboard");
    await settledAsync();

    expect(document.activeElement).toBe(row("alpha"));
  });
});
