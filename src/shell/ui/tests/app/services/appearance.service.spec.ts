/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TestBed } from "@angular/core/testing";

import { FontChoice } from "../../../src/app/enums/font-choice";
import { ModePreference } from "../../../src/app/enums/mode-preference";
import { ThemeMode } from "../../../src/app/enums/theme-mode";
import { Typography } from "../../../src/app/models/typography";
import { AppearanceService } from "../../../src/app/services/appearance.service";
import { DefaultTheme } from "../../../src/app/themes/default-theme";
import { AppearanceFixture } from "../../fixtures/appearance.fixture";
import { FixtureTheme } from "../../fixtures/fixture-theme";

class SystemSchemeFixture extends EventTarget implements MediaQueryList {
  public matches: boolean;
  public readonly media: string;
  public onchange: ((this: MediaQueryList, event: MediaQueryListEvent) => unknown) | null = null;

  public constructor(matches: boolean, media: string) {
    super();

    this.matches = matches;
    this.media = media;
  }

  public change(matches: boolean): void {
    this.matches = matches;
    this.dispatchEvent(new MediaQueryListEvent("change", { matches, media: this.media }));
  }

  public addListener(): void {
    throw new Error("The service must listen through addEventListener.");
  }

  public removeListener(): void {
    throw new Error("The service must stop listening through removeEventListener.");
  }
}

describe("AppearanceService", () => {
  let scheme: SystemSchemeFixture;
  let queries: string[];

  beforeEach(() => {
    queries = [];
    scheme = new SystemSchemeFixture(true, "(prefers-color-scheme: dark)");
    vi.spyOn(window, "matchMedia").mockImplementation(query => {
      queries.push(query);
      return scheme;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    AppearanceFixture.reset();
  });

  function variable(name: string): string {
    return document.documentElement.style.getPropertyValue(name);
  }

  it("starts with the default theme and the default typography, following the system's dark mode", () => {
    const service = TestBed.inject(AppearanceService);
    TestBed.tick();

    expect(queries).toEqual(["(prefers-color-scheme: dark)"]);
    expect(service.theme()).toBe(DefaultTheme.theme);
    expect(service.modePreference()).toBe(ModePreference.System);
    expect(service.mode()).toBe(ThemeMode.Dark);
    expect(service.typography().panelSize).toBe(13);
    expect(variable("--tr-window")).toBe("#181818");
    expect(variable("--tr-text-message")).toBe("14px");
    expect(document.documentElement.getAttribute("data-tr-tab-shape")).toBe("pill");
  });

  it("follows the system when it changes, and stops listening when destroyed", () => {
    const service = TestBed.inject(AppearanceService);
    TestBed.tick();

    scheme.change(false);
    TestBed.tick();

    expect(service.mode()).toBe(ThemeMode.Light);
    expect(variable("--tr-window")).toBe("#F8F8F8");

    TestBed.resetTestingModule();
    scheme.change(true);

    expect(variable("--tr-window")).toBe("#F8F8F8");
  });

  it("uses a chosen mode regardless of the system", () => {
    const service = TestBed.inject(AppearanceService);

    service.setModePreference(ModePreference.Light);
    TestBed.tick();
    expect(service.mode()).toBe(ThemeMode.Light);
    expect(variable("color-scheme")).toBe("light");

    service.setModePreference(ModePreference.Dark);
    scheme.change(false);
    TestBed.tick();
    expect(service.modePreference()).toBe(ModePreference.Dark);
    expect(service.mode()).toBe(ThemeMode.Dark);
    expect(variable("color-scheme")).toBe("dark");
  });

  it("repaints the root for a new theme and new typography", () => {
    const service = TestBed.inject(AppearanceService);

    service.setTheme(FixtureTheme.theme);
    service.setTypography(new Typography(18, 12, 16, FontChoice.System));
    TestBed.tick();

    expect(service.theme()).toBe(FixtureTheme.theme);
    expect(variable("--tr-window")).toBe("#2001A0");
    expect(variable("--tr-text-message")).toBe("12px");
    expect(variable("--tr-font-sans")).toBe("system-ui, \"Segoe UI\", Roboto, sans-serif");
    expect(Number.parseFloat(getComputedStyle(document.documentElement).fontSize)).toBeCloseTo(16 * 18 / 13, 3);
  });
});
