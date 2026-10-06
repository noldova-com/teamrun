/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component } from "@angular/core";
import { TestBed } from "@angular/core/testing";

import { PanelCardComponent } from "../../../../src/app/components/panel-card/panel-card.component";
import { PanelSurface } from "../../../../src/app/enums/panel-surface";
import { ThemeMode } from "../../../../src/app/enums/theme-mode";
import { DefaultTheme } from "../../../../src/app/models/default-theme";
import { AppearanceFixture } from "../../../fixtures/appearance.fixture";

@Component({
  imports: [PanelCardComponent],
  template: `
    <tr-panel-card class="panel"><p>Content</p></tr-panel-card>
    <tr-panel-card class="shell" [surface]="shellSurface">Dock</tr-panel-card>
  `
})
class PanelCardHostComponent {
  protected readonly shellSurface: PanelSurface = PanelSurface.Shell;
}

describe("PanelCardComponent", () => {
  afterEach(() => AppearanceFixture.reset());

  function render(): readonly [HTMLElement, HTMLElement] {
    const fixture = TestBed.createComponent(PanelCardHostComponent);
    fixture.detectChanges();
    const root: HTMLElement = fixture.nativeElement;
    return [root.querySelector<HTMLElement>("tr-panel-card.panel") ?? root, root.querySelector<HTMLElement>("tr-panel-card.shell") ?? root];
  }

  it("projects its content", () => {
    const [panel, shell] = render();

    expect(panel.textContent).toBe("Content");
    expect(shell.textContent).toBe("Dock");
  });

  for (const mode of AppearanceFixture.modes)
    for (const theme of AppearanceFixture.themes)
      it(`takes its surfaces, border and radius from the ${theme.id} theme in ${mode} mode`, () => {
        AppearanceFixture.apply(theme, mode);

        const [panel, shell] = render().map(t => getComputedStyle(t));

        expect(panel?.backgroundColor).toBe(AppearanceFixture.readColor(theme, mode, "editor.background"));
        expect(shell?.backgroundColor).toBe(AppearanceFixture.readColor(theme, mode, "sideBar.background"));
        expect(panel?.borderTopColor).toBe(AppearanceFixture.readColor(theme, mode, "surface.border"));
        expect(panel?.color).toBe(AppearanceFixture.readColor(theme, mode, "foreground"));
        AppearanceFixture.expectLook(panel?.borderTopWidth ?? "", theme, "border-width", "border-top-width");
        AppearanceFixture.expectLook(panel?.borderTopLeftRadius ?? "", theme, "radius-large", "border-top-left-radius");
      });

  for (const panelSize of AppearanceFixture.panelSizes)
    it(`scales its radius with panel size ${panelSize} while its border keeps one pixel`, () => {
      AppearanceFixture.apply(DefaultTheme.theme, ThemeMode.Light, panelSize);

      const [panel] = render().map(t => getComputedStyle(t));

      AppearanceFixture.expectRem(panel?.borderTopLeftRadius ?? "", 0.5, panelSize);
      expect(panel?.borderTopWidth).toBe("1px");
    });
});
