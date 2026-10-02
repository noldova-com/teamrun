/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component } from "@angular/core";
import { TestBed } from "@angular/core/testing";

import { MenuItemComponent } from "../../../../src/app/components/menu/menu-item.component";
import { MenuSeparatorComponent } from "../../../../src/app/components/menu/menu-separator.component";
import { MenuComponent } from "../../../../src/app/components/menu/menu.component";
import { AppearanceFixture } from "../../../fixtures/appearance.fixture";

@Component({
  imports: [MenuComponent, MenuItemComponent, MenuSeparatorComponent],
  template: `
    <div style="display: flex; height: 80px;">
      <tr-menu>
        <button tr-menu-item label="A label long enough to set the menu's width"></button>
        <tr-menu-separator />
        @for (index of rows; track index) {
          <button tr-menu-item [label]="'Row ' + index"></button>
        }
      </tr-menu>
    </div>
  `
})
class MenuHostComponent {
  public readonly rows: readonly number[] = Array.from({ length: 10 }, (_, index) => index);
}

describe("MenuComponent", () => {
  afterEach(() => {
    AppearanceFixture.reset();
  });

  it("is a menu sized to its rows that scrolls when it is bounded, and reveals its scrollbar on hover", async () => {
    AppearanceFixture.apply();
    const fixture = TestBed.createComponent(MenuHostComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    const menu: HTMLElement = fixture.nativeElement.querySelector("tr-menu");
    const rows = [...menu.querySelectorAll<HTMLElement>("[tr-menu-item]")];
    const separator = menu.querySelector("tr-menu-separator");

    expect(menu.getAttribute("role")).toBe("menu");
    expect(menu.classList.contains("tr-scroll-reveal")).toBe(true);
    expect(separator?.getAttribute("role")).toBe("separator");
    expect(menu.scrollHeight).toBeGreaterThan(menu.clientHeight);
    expect(getComputedStyle(menu).overflowX).toBe("hidden");
    expect(rows.every(t => t.getBoundingClientRect().width === rows[0]?.getBoundingClientRect().width)).toBe(true);
    expect(menu.scrollWidth).toBe(menu.clientWidth);
  });
});
