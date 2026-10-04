/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, signal } from "@angular/core";
import { type ComponentFixture, TestBed } from "@angular/core/testing";

import { MenuBarItemComponent } from "../../../../src/app/components/menu-bar/menu-bar-item.component";
import { MenuBarComponent } from "../../../../src/app/components/menu-bar/menu-bar.component";
import { MenuItemComponent } from "../../../../src/app/components/menu/menu-item.component";
import { MenuTriggerDirective } from "../../../../src/app/components/menu/menu-trigger.directive";
import { MenuComponent } from "../../../../src/app/components/menu/menu.component";
import { ThemeMode } from "../../../../src/app/enums/theme-mode";
import { DefaultTheme } from "../../../../src/app/themes/default-theme";
import { AppearanceFixture } from "../../../fixtures/appearance.fixture";

@Component({
  imports: [MenuBarComponent, MenuBarItemComponent, MenuComponent, MenuItemComponent, MenuTriggerDirective],
  template: `
    <div style="position: fixed; top: 200px; left: 200px">
    <tr-menu-bar label="Menus">
      <button tr-menu-bar-item class="file" [label]="fileLabel()" [trMenuTriggerFor]="file"></button>
      <button tr-menu-bar-item class="edit" label="Edit" [trMenuTriggerFor]="edit"></button>
      <button tr-menu-bar-item class="view" label="View" [disabled]="true" [trMenuTriggerFor]="edit"></button>
    </tr-menu-bar>
    </div>
    <ng-template #file>
      <tr-menu class="file-menu">
        <button tr-menu-item label="New note" (triggered)="chosen.push('new')"></button>
      </tr-menu>
    </ng-template>
    <ng-template #edit>
      <tr-menu class="edit-menu">
        <button tr-menu-item label="Copy"></button>
      </tr-menu>
    </ng-template>
  `
})
class BarHostComponent {
  public readonly fileLabel = signal("File");
  public readonly chosen: string[] = [];
}

describe("MenuBarComponent", () => {
  let fixture: ComponentFixture<BarHostComponent>;

  beforeEach(async () => {
    AppearanceFixture.apply();
    fixture = TestBed.createComponent(BarHostComponent);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  afterEach(() => {
    fixture.destroy();
    AppearanceFixture.reset();
  });

  function item(name: string): HTMLButtonElement {
    return fixture.nativeElement.querySelector(`.${name}`);
  }

  function key(target: Element, name: string, keyCode: number): void {
    target.dispatchEvent(new KeyboardEvent("keydown", { key: name, keyCode, bubbles: true, cancelable: true }));
  }

  function open(name: string): HTMLElement | null {
    return document.querySelector(`.${name}-menu`);
  }

  it("is a labelled menu bar of menu items named by their labels, each one a menu trigger", () => {
    const bar = fixture.nativeElement.querySelector("tr-menu-bar") as HTMLElement;

    expect([bar.getAttribute("role"), bar.getAttribute("aria-label"), bar.getAttribute("aria-orientation")]).toEqual(["menubar", "Menus", "horizontal"]);
    expect([...bar.querySelectorAll("button")].map(t => [t.getAttribute("role"), t.textContent, t.getAttribute("aria-haspopup")])).toEqual([
      ["menuitem", "File", "menu"], ["menuitem", "Edit", "menu"], ["menuitem", "View", "menu"]
    ]);
  });

  it("opens a menu below its item, aligned with the item's start, and closes it on a second click", async () => {
    item("file").click();
    await fixture.whenStable();
    const opened = [item("file").getAttribute("aria-expanded"), open("file")?.isConnected];
    const anchor = item("file").getBoundingClientRect();
    await vi.waitFor(() => expect(open("file")?.getBoundingClientRect().top).toBeCloseTo(anchor.bottom, 0));
    const panel = open("file")?.getBoundingClientRect() ?? anchor;

    item("file").click();
    await fixture.whenStable();

    expect(opened).toEqual(["true", true]);
    expect(panel.left).toBeCloseTo(anchor.left, 0);
    expect(open("file")).toBeNull();
    expect(item("file").getAttribute("aria-expanded")).toBe("false");
  });

  it("moves between its items with the arrow keys, and between open menus with the arrows inside a menu", async () => {
    item("file").focus();
    key(item("file"), "ArrowRight", 39);
    const afterRight = document.activeElement;
    key(item("edit"), "ArrowDown", 40);
    await fixture.whenStable();
    const editOpen = open("edit") !== null;
    key(document.activeElement as Element, "ArrowLeft", 37);
    await fixture.whenStable();

    expect(afterRight).toBe(item("edit"));
    expect(editOpen).toBe(true);
    expect(open("edit")).toBeNull();
    expect(open("file")).not.toBeNull();
    expect(item("file").getAttribute("aria-expanded")).toBe("true");
  });

  it("opens the menu of an item the pointer enters while another menu is open", async () => {
    item("file").click();
    await fixture.whenStable();

    item("edit").dispatchEvent(new MouseEvent("mouseenter"));
    await fixture.whenStable();

    expect(open("file")).toBeNull();
    expect(open("edit")).not.toBeNull();
  });

  it("shows its hover and open fills, keeps a disabled item inert, and follows a changed label", async () => {
    const style = (name: string): string => getComputedStyle(item(name), "::before").backgroundColor;
    const resting = style("edit");
    item("file").click();
    await fixture.whenStable();
    const opened = style("file");
    item("view").click();
    fixture.componentInstance.fileLabel.set("Files");
    await fixture.whenStable();

    expect(opened).not.toBe(resting);
    expect(item("view").getAttribute("aria-disabled")).toBe("true");
    expect(item("file").textContent).toBe("Files");
    expect(getComputedStyle(item("view")).opacity).toBe("0.5");
  });

  for (const panelSize of AppearanceFixture.panelSizes)
    it(`writes its items in the panel text role at weight 400 inside bolder, larger text, at panel size ${panelSize}`, () => {
      AppearanceFixture.apply(DefaultTheme.theme, ThemeMode.Light, panelSize);
      const parent = fixture.nativeElement.firstElementChild as HTMLElement;
      parent.style.fontWeight = "600";
      parent.style.fontSize = "2rem";
      parent.style.lineHeight = "3rem";
      const style = getComputedStyle(item("file"));

      expect(style.fontWeight).toBe("400");
      AppearanceFixture.expectRem(style.fontSize, 0.8125, panelSize);
      AppearanceFixture.expectRem(style.lineHeight, 1.125, panelSize);
    });
});
