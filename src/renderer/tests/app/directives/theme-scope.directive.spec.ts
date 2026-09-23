/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, input } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import "@noldova/teamrun-foundation-core";
import { MemoryStorage } from "../../fixtures/memory-storage";
import { PreferencesService } from "../../../src/app/services/preferences.service";
import { Theme } from "../../../src/app/models/theme";
import { Resources } from "../../../src/app/resources";
import { ThemeService } from "../../../src/app/services/theme.service";
import { ThemeScopeDirective } from "../../../src/app/directives/theme-scope.directive";

@Component({
  imports: [ThemeScopeDirective],
  template: `<div class="scope" [trThemeScope]="theme()"></div>`
})
class HostComponent {
  public readonly theme = input.required<Theme>();
}

describe("ThemeScopeDirective", () => {
  let previousStyle: string | null;
  let previousStorage: PropertyDescriptor | undefined;

  beforeEach(() => {
    previousStyle = document.documentElement.getAttribute("style");
    previousStorage = Object.getOwnPropertyDescriptor(window, "localStorage");
    MemoryStorage.install(window);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    if (Object.isNull(previousStyle))
      document.documentElement.removeAttribute("style");
    else
      document.documentElement.setAttribute("style", previousStyle);
    if (Object.isUndefined(previousStorage))
      delete (window as { localStorage?: Storage }).localStorage;
    else
      Object.defineProperty(window, "localStorage", previousStorage);
  });

  it.each([
    [Resources.darkModernThemeId, Resources.lightModernThemeId, "#181818", "#F8F8F8", "#FFFFFF", Resources.lightScheme],
    [Resources.lightModernThemeId, Resources.darkModernThemeId, "#F8F8F8", "#181818", "#1F1F1F", Resources.darkScheme]
  ])("paints a scoped theme without changing the %s document theme", async (documentTheme, scopeTheme, windowColor, scopeColor, panelColor, scheme) => {
    TestBed.inject(PreferencesService).setTheme(documentTheme);
    const themes = TestBed.inject(ThemeService);
    TestBed.tick();
    expect(document.documentElement.style.getPropertyValue("--tr-window")).toBe(windowColor);
    const appliedStyle = document.documentElement.style.cssText;
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentRef.setInput("theme", themes.themes.find(t => t.id === scopeTheme)!);
    await fixture.whenStable();
    const scope = fixture.nativeElement.querySelector(".scope") as HTMLElement;

    expect(scope.style.colorScheme).toBe(scheme);
    expect(scope.style.getPropertyValue("--tr-window")).toBe(scopeColor);
    expect(scope.style.getPropertyValue("--tr-panel")).toBe(panelColor);
    expect(document.documentElement.style.cssText).toBe(appliedStyle);
  });
});
