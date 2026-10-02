/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, signal } from "@angular/core";
import { type ComponentFixture, TestBed } from "@angular/core/testing";

import { DockingPlateComponent } from "../../../../src/app/components/docking-plate/docking-plate.component";
import { DockingDirection } from "../../../../src/app/enums/docking-direction";
import { ThemeMode } from "../../../../src/app/enums/theme-mode";
import { DefaultTheme } from "../../../../src/app/themes/default-theme";
import { AppearanceFixture } from "../../../fixtures/appearance.fixture";

@Component({
  imports: [DockingPlateComponent],
  template: `<tr-docking-plate [chosen]="chosen()" />`
})
class DockingPlateHostComponent {
  public readonly chosen = signal<DockingDirection | null>(null);
}

describe("DockingPlateComponent", () => {
  let fixture: ComponentFixture<DockingPlateHostComponent>;

  beforeEach(() => {
    AppearanceFixture.apply();
    fixture = TestBed.createComponent(DockingPlateHostComponent);
    fixture.detectChanges();
  });

  afterEach(() => AppearanceFixture.reset());

  function plate(): HTMLElement {
    return fixture.nativeElement.querySelector("tr-docking-plate");
  }

  function guide(direction: DockingDirection): HTMLElement {
    return plate().querySelector<HTMLElement>(`[data-direction="${direction}"]`) ?? plate();
  }

  it("arranges the center target with its four split arrows around it", () => {
    const center = guide(DockingDirection.Center).getBoundingClientRect();

    expect(plate().querySelectorAll("tr-docking-guide").length).toBe(5);
    expect(guide(DockingDirection.Top).getBoundingClientRect().bottom).toBeLessThan(center.top);
    expect(guide(DockingDirection.Bottom).getBoundingClientRect().top).toBeGreaterThan(center.bottom);
    expect(guide(DockingDirection.Left).getBoundingClientRect().right).toBeLessThan(center.left);
    expect(guide(DockingDirection.Right).getBoundingClientRect().left).toBeGreaterThan(center.right);
    AppearanceFixture.expectPixels(guide(DockingDirection.Top).getBoundingClientRect().left, center.left);
    AppearanceFixture.expectPixels(guide(DockingDirection.Left).getBoundingClientRect().top, center.top);
  });

  it("marks only the chosen target", () => {
    fixture.componentInstance.chosen.set(DockingDirection.Right);
    fixture.detectChanges();

    expect(plate().querySelectorAll(".tr-docking-guide-chosen").length).toBe(1);
    expect(guide(DockingDirection.Right).classList.contains("tr-docking-guide-chosen")).toBe(true);
  });

  for (const mode of AppearanceFixture.modes)
    for (const theme of AppearanceFixture.themes)
      it(`takes its plate surface, gaps and radius from the ${theme.id} theme in ${mode} mode`, () => {
        AppearanceFixture.apply(theme, mode);
        const style = getComputedStyle(plate());

        expect(style.backgroundColor).toBe(AppearanceFixture.readColor(theme, mode, "teamrun.raisedBackground"));
        AppearanceFixture.expectLook(style.rowGap, theme, "docking-plate-gap", "row-gap");
        AppearanceFixture.expectLook(style.paddingTop, theme, "docking-plate-gap", "padding-top");
        AppearanceFixture.expectLook(style.borderTopLeftRadius, theme, "radius-medium", "border-top-left-radius");
        AppearanceFixture.expectLook(style.boxShadow, theme, "shadow-large", "box-shadow");
      });

  for (const panelSize of AppearanceFixture.panelSizes)
    it(`scales its gaps with panel size ${panelSize}`, () => {
      AppearanceFixture.apply(DefaultTheme.theme, ThemeMode.Light, panelSize);
      const top = guide(DockingDirection.Top).getBoundingClientRect();
      const center = guide(DockingDirection.Center).getBoundingClientRect();

      AppearanceFixture.expectPixels(center.top - top.bottom, AppearanceFixture.toPixels(0.125, panelSize));
    });
});
