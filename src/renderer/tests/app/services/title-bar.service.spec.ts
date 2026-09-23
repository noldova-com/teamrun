/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TestBed } from "@angular/core/testing";

import { MemoryStorage } from "../../fixtures/memory-storage";
import { SampleData } from "../../fixtures/sample-data";
import { Resources } from "../../../src/app/resources";
import { TEAMRUN_BRIDGE } from "../../../src/app/services/bridge.service";
import { PreferencesService } from "../../../src/app/services/preferences.service";
import { TitleBarService } from "../../../src/app/services/title-bar.service";

describe("TitleBarService", () => {
  const originalMatchMedia = window.matchMedia;
  const originalStorage = Object.getOwnPropertyDescriptor(window, "localStorage");
  afterEach(() => {
    window.matchMedia = originalMatchMedia;
    if (originalStorage)
      Object.defineProperty(window, "localStorage", originalStorage);
  });

  it("follows the system scheme while the theme is System and recolours the window controls in the theme's colours", () => {
    MemoryStorage.install(window);
    let matches = false;
    let listener: ((event: MediaQueryListEvent) => void) | null = null;
    const query = {
      get matches(): boolean { return matches; },
      addEventListener: (_type: string, handler: (event: MediaQueryListEvent) => void): void => { listener = handler; }
    } as unknown as MediaQueryList;
    window.matchMedia = (): MediaQueryList => query;
    const bridge = SampleData.createBridge();
    TestBed.configureTestingModule({ providers: [{ provide: TEAMRUN_BRIDGE, useValue: bridge }] });
    const service = TestBed.inject(TitleBarService);
    TestBed.tick();

    expect(service.dark()).toBe(false);
    expect(bridge.titleBars.at(-1)).toEqual({ color: "#F8F8F8", symbolColor: "#1E1E1E" });
    matches = true;
    listener!({ matches } as MediaQueryListEvent);
    TestBed.tick();
    expect(service.dark()).toBe(true);
    expect(bridge.titleBars.at(-1)).toEqual({ color: "#181818", symbolColor: "#CCCCCC" });
    TestBed.inject(PreferencesService).setTheme(Resources.lightModernThemeId);
    TestBed.tick();
    expect(service.dark()).toBe(false);
    expect(bridge.titleBars.at(-1)).toEqual({ color: "#F8F8F8", symbolColor: "#1E1E1E" });
  });
});
