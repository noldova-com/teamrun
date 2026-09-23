/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TestBed } from "@angular/core/testing";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import "@noldova/teamrun-foundation-core";

import { Resources } from "../../../../src/app/resources";
import { TEAMRUN_BRIDGE } from "../../../../src/app/services/bridge.service";
import { SearchLauncher } from "../../../../src/app/services/search-launcher.service";
import { ThemeService } from "../../../../src/app/services/theme.service";
import { SampleData } from "../../../fixtures/sample-data";
import { MemoryStorage } from "../../../fixtures/memory-storage";
import { SettingsGalleryComponent } from "../../../../src/app/components/settings-gallery/settings-gallery.component";

describe("SettingsGalleryComponent", () => {
  let previousStyle: string | null;
  let previousStorage: PropertyDescriptor | undefined;
  let storage: MemoryStorage;

  beforeEach(() => {
    previousStyle = document.documentElement.getAttribute("style");
    previousStorage = Object.getOwnPropertyDescriptor(window, "localStorage");
    storage = MemoryStorage.install(window);
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
    [Resources.darkModernThemeId, "Dark Modern", "Light Modern", "#181818", "#F8F8F8", Resources.lightScheme],
    [Resources.lightModernThemeId, "Light Modern", "Dark Modern", "#F8F8F8", "#181818", Resources.darkScheme]
  ])("shows every control in both themes with saved preference %s", async (themeId, name, otherName, documentColor, scopeColor, scopeScheme) => {
    storage.setItem(Resources.preferencesStorageKey, JSON.stringify({ theme: themeId }));
    TestBed.configureTestingModule({ imports: [SettingsGalleryComponent], providers: [{ provide: TEAMRUN_BRIDGE, useValue: SampleData.createBridge() }] });
    const fixture = TestBed.createComponent(SettingsGalleryComponent);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    const themes = TestBed.inject(ThemeService);
    const scopes = Array.from(element.querySelectorAll<HTMLElement>(".tr-gallery-scope"));

    const [current, other] = scopes;
    expect(scopes.length).toBe(2);
    if (Object.isUndefined(current) || Object.isUndefined(other))
      return;

    expect(themes.active().id).toBe(themeId);
    expect(current.textContent).toContain(name);
    expect(document.documentElement.style.getPropertyValue("--tr-window")).toBe(documentColor);
    expect(current.style.getPropertyValue("--tr-window")).toBe("");
    expect(other.textContent).toContain(otherName);
    expect(other.style.colorScheme).toBe(scopeScheme);
    expect(other.style.getPropertyValue("--tr-window")).toBe(scopeColor);
    for (const scope of scopes) {
      expect(Array.from(scope.querySelectorAll(".tr-gallery-avatar-colors [data-avatar-color]"))
        .map(t => t.getAttribute("data-avatar-color"))).toEqual(["Default", ...Resources.avatarColors]);
      expect(scope.querySelectorAll("button.mat-mdc-unelevated-button").length).toBe(5);
      expect(scope.querySelectorAll("tr-app-updates").length).toBe(4);
      expect(scope.textContent).toContain(Resources.retryDownloadLabel);
      expect(scope.querySelectorAll("mat-checkbox").length).toBe(4);
      expect(scope.querySelectorAll("mat-button-toggle-group").length).toBe(3);
      expect(scope.querySelector('mat-button-toggle-group[aria-label="Open images"]')?.textContent).toContain("Popup");
      expect(scope.querySelectorAll("mat-select").length).toBe(2);
      expect(scope.querySelectorAll(".tr-tab").length).toBe(2);
      expect(scope.querySelectorAll(".tr-attachment").length).toBe(2);
      expect(scope.querySelectorAll(".tr-attachment button:disabled").length).toBe(1);
      expect(scope.querySelectorAll('tr-image-actions button[aria-label="Copy Image"]').length).toBe(2);
      expect(scope.querySelectorAll('tr-image-actions button[aria-label="Copy Image"]:disabled').length).toBe(1);
      expect(scope.querySelectorAll('tr-image-actions a[aria-label="Download Image"]').length).toBe(2);
      expect(scope.textContent).toContain(Resources.attachmentLimitExceeded);
      expect(scope.textContent).toContain(Resources.galleryMenuLabel);
      expect(scope.textContent).toContain(Resources.galleryDialogLabel);
    }
  });

  it("opens the search from its button", () => {
    TestBed.configureTestingModule({ imports: [SettingsGalleryComponent], providers: [{ provide: TEAMRUN_BRIDGE, useValue: SampleData.createBridge() }] });
    const fixture = TestBed.createComponent(SettingsGalleryComponent);
    fixture.detectChanges();
    const search = TestBed.inject(SearchLauncher);
    let opened = 0;
    search.open = () => { opened++; };

    const element = fixture.nativeElement as HTMLElement;
    const button = Array.from(element.querySelectorAll<HTMLButtonElement>("button")).find(b => b.textContent?.trim() === Resources.gallerySearchLabel);
    button?.click();
    expect(opened).toBe(1);
  });
});
