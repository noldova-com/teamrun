/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TestBed } from "@angular/core/testing";

import { ModuleState } from "@noldova/teamrun-shell-protocol";

import { ModuleFailureCardComponent } from "../../../../src/app/components/module-failure-card/module-failure-card.component";
import { ModuleFailure } from "../../../../src/app/models/module-failure";
import { AppearanceFixture } from "../../../../../ui/tests/fixtures/appearance.fixture";

describe("ModuleFailureCardComponent", () => {
  afterEach(() => AppearanceFixture.reset());

  function render(cause: string | null): HTMLElement {
    const fixture = TestBed.createComponent(ModuleFailureCardComponent);
    fixture.componentRef.setInput("failure", new ModuleFailure("clock", "Clock", ModuleState.Blocked, cause, ["clock.face"]));
    fixture.detectChanges();
    return fixture.nativeElement;
  }

  it("names the module that didn't start and says why, with an error icon", () => {
    const card = render("It depends on tasks, which is not active.");

    expect(card.querySelector("h2")?.textContent).toMatch(/^\s*error\s*Clock didn't start\s*$/);
    expect(card.querySelector(".tr-module-failure-card-icon")?.getAttribute("aria-hidden")).toBe("true");
    expect(card.querySelector(".tr-module-failure-card-cause")?.textContent).toBe("It depends on tasks, which is not active.");
  });

  for (const mode of AppearanceFixture.modes)
    for (const theme of AppearanceFixture.themes)
      it(`takes its colors and geometry from the ${theme.id} theme in ${mode} mode`, () => {
        AppearanceFixture.apply(theme, mode);

        const card = render("Its runtime part failed to activate.");
        const surface = getComputedStyle(card.querySelector(".tr-module-failure-card") as Element);
        const icon = getComputedStyle(card.querySelector(".tr-module-failure-card-icon") as Element);

        expect(surface.backgroundColor).toBe(AppearanceFixture.readColor(theme, mode, "teamrun.raisedBackground"));
        expect(surface.borderTopColor).toBe(AppearanceFixture.readColor(theme, mode, "surface.border"));
        expect(icon.color).toBe(AppearanceFixture.readColor(theme, mode, "errorForeground"));
        AppearanceFixture.expectLook(surface.borderTopLeftRadius, theme, "radius-medium", "border-top-left-radius");
        AppearanceFixture.expectLook(surface.borderTopWidth, theme, "border-width", "border-top-width");
        AppearanceFixture.expectLook(surface.paddingTop, theme, "space-3", "padding-top");
        AppearanceFixture.expectLook(getComputedStyle(card).paddingTop, theme, "space-2", "padding-top");
      });
});
