/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, type Signal, viewChild } from "@angular/core";
import { type ComponentFixture, TestBed } from "@angular/core/testing";

import { ToolbarItemDirective } from "../../../../src/app/components/toolbar/toolbar-item.directive";

@Component({
  imports: [ToolbarItemDirective],
  template: `<button type="button" trToolbarItem>Bold</button>`
})
class ItemHostComponent {
  public readonly item: Signal<ToolbarItemDirective | undefined> = viewChild(ToolbarItemDirective);
}

describe("ToolbarItemDirective", () => {
  let fixture: ComponentFixture<ItemHostComponent>;

  beforeEach(() => {
    fixture = TestBed.createComponent(ItemHostComponent);
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.destroy();
  });

  it("is out of the tab order until it is made the tab stop, and back out when it stops being one", () => {
    const item = fixture.componentInstance.item() as ToolbarItemDirective;
    const button = fixture.nativeElement.querySelector("button") as HTMLButtonElement;
    const initial = button.getAttribute("tabindex");
    item.setTabStop(true);
    fixture.detectChanges();
    const stop = button.getAttribute("tabindex");
    item.setTabStop(false);
    fixture.detectChanges();

    expect([initial, stop, button.getAttribute("tabindex"), item.element]).toEqual(["-1", "0", "-1", button]);
  });

  it("takes focus when asked", () => {
    const item = fixture.componentInstance.item() as ToolbarItemDirective;

    item.focus();

    expect(document.activeElement).toBe(item.element);
  });
});
