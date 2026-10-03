/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TestBed } from "@angular/core/testing";

import { MenuSeparatorComponent } from "../../../../src/app/components/menu/menu-separator.component";
import { AppearanceFixture } from "../../../fixtures/appearance.fixture";

describe("MenuSeparatorComponent", () => {
  afterEach(() => {
    AppearanceFixture.reset();
  });

  it("is an empty separator line a border thick, spaced from the rows around it", () => {
    AppearanceFixture.apply();
    const fixture = TestBed.createComponent(MenuSeparatorComponent);
    fixture.detectChanges();
    const separator: HTMLElement = fixture.nativeElement;
    const style = getComputedStyle(separator);

    expect(separator.getAttribute("role")).toBe("separator");
    expect(separator.childNodes.length).toBe(0);
    expect(style.display).toBe("block");
    expect(Number.parseFloat(style.height)).toBeGreaterThan(0);
    expect(style.marginTop).toBe(style.marginBottom);
    expect(Number.parseFloat(style.marginTop)).toBeGreaterThan(0);
  });
});
