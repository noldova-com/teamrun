/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { CdkMenuItem } from "@angular/cdk/menu";
import { Component, signal } from "@angular/core";
import { type ComponentFixture, TestBed } from "@angular/core/testing";

import { MenuItemComponent } from "../../../../src/app/components/menu/menu-item.component";
import { MenuTriggerDirective } from "../../../../src/app/components/menu/menu-trigger.directive";
import { MenuComponent } from "../../../../src/app/components/menu/menu.component";
import { AppearanceFixture } from "../../../fixtures/appearance.fixture";

@Component({
  imports: [MenuComponent, MenuItemComponent, MenuTriggerDirective],
  template: `
    <tr-menu>
      <button tr-menu-item class="plain" [label]="label()" (triggered)="chosen.push('plain')"></button>
      <button tr-menu-item class="iconic" label="Close all" icon="clear_all" [disabled]="isDisabled()" (triggered)="chosen.push('iconic')"></button>
      <button tr-menu-item class="parent" label="Move to" [trMenuTriggerFor]="submenu"></button>
      <button tr-menu-item class="on" label="Full width" [checked]="true"></button>
      <button tr-menu-item class="off" label="Between the docks" [checked]="false"></button>
    </tr-menu>
    <ng-template #submenu>
      <tr-menu>
        <button tr-menu-item label="Left"></button>
      </tr-menu>
    </ng-template>
  `
})
class ItemHostComponent {
  public readonly label = signal("Rename");
  public readonly isDisabled = signal(true);
  public readonly chosen: string[] = [];
}

describe("MenuItemComponent", () => {
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

  function row(name: string): HTMLButtonElement {
    return fixture.nativeElement.querySelector(`.${name}`);
  }

  function parts(name: string): (string | null)[] {
    return [...row(name).children].map(t => t.className.split(" ")[0] ?? null);
  }

  it("shows its icon, its label marked for truncation, and a chevron only when it opens a submenu", () => {
    expect(parts("plain")).toEqual(["tr-menu-item-label"]);
    expect(parts("iconic")).toEqual(["tr-menu-item-icon", "tr-menu-item-label"]);
    expect(parts("parent")).toEqual(["tr-menu-item-label", "tr-menu-item-chevron"]);
    expect(row("iconic").querySelector(".tr-menu-item-icon")?.textContent).toBe("clear_all");
    expect(row("plain").querySelector(".tr-menu-item-label")?.hasAttribute("data-truncates")).toBe(true);
    expect(row("plain").getAttribute("role")).toBe("menuitem");
    expect(row("plain").type).toBe("button");
  });

  it("is a radio row with a check mark at its end while checked, and a plain item otherwise", () => {
    expect([row("on").getAttribute("role"), row("on").getAttribute("aria-checked"), parts("on")]).toEqual(["menuitemradio", "true", ["tr-menu-item-label", "tr-menu-item-check"]]);
    expect(row("on").querySelector(".tr-menu-item-check")?.textContent).toBe("check");
    expect([row("off").getAttribute("role"), row("off").getAttribute("aria-checked"), parts("off")]).toEqual(["menuitemradio", "false", ["tr-menu-item-label"]]);
    expect([row("plain").getAttribute("role"), row("plain").hasAttribute("aria-checked")]).toEqual(["menuitem", false]);
  });

  it("is found by type-ahead under its label as the label changes, not under its icon", () => {
    const item = fixture.debugElement.query(t => t.nativeElement === row("iconic")).injector.get(CdkMenuItem);
    const plain = fixture.debugElement.query(t => t.nativeElement === row("plain")).injector.get(CdkMenuItem);
    fixture.componentInstance.label.set("Rename the note");
    fixture.detectChanges();

    expect(item.getLabel()).toBe("Close all");
    expect(plain.getLabel()).toBe("Rename the note");
  });

  it("runs when chosen, and stays inert and dimmed while disabled", () => {
    row("iconic").click();
    row("plain").click();
    const dimmed = getComputedStyle(row("iconic")).opacity;
    fixture.componentInstance.isDisabled.set(false);
    fixture.detectChanges();
    row("iconic").click();

    expect(fixture.componentInstance.chosen).toEqual(["plain", "iconic"]);
    expect(dimmed).toBe("0.5");
    expect(row("iconic").hasAttribute("aria-disabled")).toBe(false);
  });

  it("fills its row inside the menu's inset and keeps the label from wrapping", () => {
    const style = getComputedStyle(row("plain"));
    const fill = getComputedStyle(row("plain"), "::before");

    expect(style.whiteSpace).toBe("nowrap");
    expect(fill.position).toBe("absolute");
    expect(Number.parseFloat(fill.left)).toBeGreaterThan(0);
    expect(fill.left).toBe(fill.right);
  });
});
