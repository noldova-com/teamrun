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
import { AppearanceFixture } from "../../../fixtures/appearance.fixture";

@Component({
  imports: [MenuBarComponent, MenuBarItemComponent, MenuComponent, MenuItemComponent, MenuTriggerDirective],
  template: `
    <tr-menu-bar label="Menus">
      <button tr-menu-bar-item class="file" [label]="fileLabel()" [trMenuTriggerFor]="menu"></button>
      <button tr-menu-bar-item class="edit" label="Edit" [trMenuTriggerFor]="menu"></button>
      <button tr-menu-bar-item class="view" label="View" [disabled]="true" [trMenuTriggerFor]="menu"></button>
    </tr-menu-bar>
    <ng-template #menu>
      <tr-menu>
        <button tr-menu-item label="Copy"></button>
      </tr-menu>
    </ng-template>
  `
})
class ItemHostComponent {
  public readonly fileLabel = signal("File");
}

describe("MenuBarItemComponent", () => {
  let fixture: ComponentFixture<ItemHostComponent>;

  beforeEach(async () => {
    AppearanceFixture.apply();
    fixture = TestBed.createComponent(ItemHostComponent);
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
});
