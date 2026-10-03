/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TestBed } from "@angular/core/testing";

import { TooltipComponent } from "../../../../src/app/components/tooltip/tooltip.component";
import { AppearanceFixture } from "../../../fixtures/appearance.fixture";

describe("TooltipComponent", () => {
  afterEach(() => {
    AppearanceFixture.reset();
  });

  for (const mode of AppearanceFixture.modes)
    for (const theme of AppearanceFixture.themes)
      it(`shows its text as a tooltip with the ${theme.id} theme's look in ${mode} mode`, async () => {
        AppearanceFixture.apply(theme, mode);
        const fixture = TestBed.createComponent(TooltipComponent);
        fixture.componentRef.setInput("text", "Split the group to the right");
        fixture.detectChanges();
        await fixture.whenStable();
        const element: HTMLElement = fixture.nativeElement;
        const style = getComputedStyle(element);

        expect(element.textContent?.trim()).toBe("Split the group to the right");
        expect(element.getAttribute("role")).toBe("tooltip");
        expect(style.backgroundColor).toBe(AppearanceFixture.readColor(theme, mode, "editorHoverWidget.background"));
        const probe = document.createElement("div");
        probe.style.color = "var(--tr-hover-widget-border)";
        document.body.append(probe);
        expect(style.borderTopColor).toBe(getComputedStyle(probe).color);
        probe.remove();
        expect(style.boxShadow).not.toBe("none");
        AppearanceFixture.expectLook(style.paddingLeft, theme, "tooltip-padding", "padding-left", "padding");
        AppearanceFixture.expectLook(style.borderTopLeftRadius, theme, "radius-hover", "border-top-left-radius");
      });
});
