/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component } from "@angular/core";
import { type ComponentFixture, TestBed } from "@angular/core/testing";

import { MenuItemComponent } from "../../../../src/app/components/menu/menu-item.component";
import { MenuSeparatorComponent } from "../../../../src/app/components/menu/menu-separator.component";
import { MenuTriggerDirective } from "../../../../src/app/components/menu/menu-trigger.directive";
import { MenuComponent } from "../../../../src/app/components/menu/menu.component";
import { AppearanceFixture } from "../../../fixtures/appearance.fixture";

@Component({
  imports: [MenuComponent, MenuItemComponent, MenuSeparatorComponent, MenuTriggerDirective],
  template: `
    <tr-menu class="with-icons">
      <button tr-menu-item class="a" label="Close" icon="close" shortcut="Ctrl+W"></button>
      <button tr-menu-item class="b" label="Close to the right" icon="close" shortcut="Ctrl+Alt+Shift+K"></button>
      <tr-menu-separator />
      <button tr-menu-item class="c" label="Wrap lines" [checked]="true" [checkbox]="true"></button>
      <button tr-menu-item class="d" label="Move to" [trMenuTriggerFor]="submenu"></button>
      <button tr-menu-item class="e" label="Wrap and key" shortcut="Ctrl+L" [checked]="true" [checkbox]="true"></button>
    </tr-menu>
    <ng-template #submenu><tr-menu><button tr-menu-item label="Left"></button></tr-menu></ng-template>
  `
})
class ColumnHostComponent {}

describe("a menu's trailing column", () => {
  let fixture: ComponentFixture<ColumnHostComponent>;

  beforeEach(async () => {
    AppearanceFixture.apply();
    fixture = TestBed.createComponent(ColumnHostComponent);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  afterEach(() => {
    fixture.destroy();
    AppearanceFixture.reset();
  });

  function box(selector: string): DOMRect {
    return (fixture.nativeElement.querySelector(selector) as HTMLElement).getBoundingClientRect();
  }

  it("ends every row's shortcut, check mark and chevron at the same right edge", () => {
    const edges = [".a .tr-menu-item-shortcut", ".b .tr-menu-item-shortcut", ".c .tr-menu-item-check", ".d .tr-menu-item-chevron", ".e .tr-menu-item-check"].map(t => Math.round(box(t).right));

    expect(new Set(edges).size).toBe(1);
  });

  it("keeps at least 2rem between the widest label and the trailing column", () => {
    const rem = Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
    const widest = Math.max(...[".a", ".b", ".c", ".d", ".e"].map(t => box(`${t} .tr-menu-item-label`).right));
    const trailing = Math.min(...[".a .tr-menu-item-shortcut", ".b .tr-menu-item-shortcut", ".e .tr-menu-item-shortcut"].map(t => box(t).left));

    expect(trailing - widest).toBeGreaterThanOrEqual(2 * rem - 1);
  });

  it("lines every label up after the icon column, with or without an icon, and keeps shortcuts muted", () => {
    const lefts = [".a", ".b", ".c", ".d"].map(t => Math.round(box(`${t} .tr-menu-item-label`).left));

    expect(new Set(lefts).size).toBe(1);
    expect(getComputedStyle(fixture.nativeElement.querySelector(".a .tr-menu-item-shortcut")).color).not.toBe(getComputedStyle(fixture.nativeElement.querySelector(".a .tr-menu-item-label")).color);
  });
});
