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

import { PopoverDirective } from "../../../../src/app/components/popover/popover.directive";
import { AppearanceFixture } from "../../../fixtures/appearance.fixture";

@Component({
  imports: [PopoverDirective],
  template: `
    <div trPopover class="static" label="Static" style="margin-top: 20rem">
      <span class="child">Static content</span>
    </div>
  `
})
class StaticPopoverHostComponent {
}

describe("PopoverDirective", () => {
  let fixture: ComponentFixture<StaticPopoverHostComponent>;

  afterEach(() => {
    AppearanceFixture.reset();
  });

  it("is a named dialog no wider than the window less a margin, and shows no outline when focused", async () => {
    AppearanceFixture.apply();
    fixture = TestBed.createComponent(StaticPopoverHostComponent);
    await fixture.whenStable();
    const popover = fixture.nativeElement.querySelector(".static") as HTMLElement;
    popover.style.setProperty("--tr-popover-width", "500vw");
    await userEvent.keyboard("{Shift}");
    popover.focus();

    expect([popover.getAttribute("role"), popover.getAttribute("aria-label"), popover.tabIndex]).toEqual(["dialog", "Static", -1]);
    expect(popover.getBoundingClientRect().width).toBeLessThanOrEqual(window.innerWidth);
    expect([document.activeElement, getComputedStyle(popover).outlineStyle]).toEqual([popover, "none"]);
  });
});
