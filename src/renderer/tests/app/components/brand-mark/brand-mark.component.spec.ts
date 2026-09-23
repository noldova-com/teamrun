/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TestBed } from "@angular/core/testing";

import { MemoryStorage } from "../../../fixtures/memory-storage";
import { SampleData } from "../../../fixtures/sample-data";
import { Resources } from "../../../../src/app/resources";
import { TEAMRUN_BRIDGE } from "../../../../src/app/services/bridge.service";
import { PreferencesService } from "../../../../src/app/services/preferences.service";
import { BrandMarkComponent } from "../../../../src/app/components/brand-mark/brand-mark.component";

describe("BrandMarkComponent", () => {
  it("selects the matching mark for dark and light themes", () => {
    MemoryStorage.install(window);
    TestBed.configureTestingModule({ imports: [BrandMarkComponent], providers: [{ provide: TEAMRUN_BRIDGE, useValue: SampleData.createBridge() }] });
    const fixture = TestBed.createComponent(BrandMarkComponent);
    fixture.detectChanges();
    const image = (fixture.nativeElement as HTMLElement).querySelector("img")!;

    expect(image.getAttribute("src")).toBe(Resources.markDarkPath);
    TestBed.inject(PreferencesService).setTheme(Resources.lightModernThemeId);
    fixture.detectChanges();
    expect(image.getAttribute("src")).toBe(Resources.markLightPath);
    TestBed.inject(PreferencesService).setTheme(Resources.darkModernThemeId);
    fixture.detectChanges();
    expect(image.getAttribute("src")).toBe(Resources.markDarkPath);
  });
});
