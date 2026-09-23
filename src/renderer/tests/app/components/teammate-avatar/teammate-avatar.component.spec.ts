/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TestBed } from "@angular/core/testing";
import { Resources } from "../../../../src/app/resources";
import lightTheme from "../../../../src/app/themes/light-modern.json";
import darkTheme from "../../../../src/app/themes/dark-modern.json";
import { TeammateAvatarComponent } from "../../../../src/app/components/teammate-avatar/teammate-avatar.component";

describe("TeammateAvatarComponent", () => {
  it("keeps identity colors across renaming, unavailable state and remounts while reserving the default", () => {
    const fixture = TestBed.createComponent(TeammateAvatarComponent);
    const element = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
    expect(element.querySelector("[data-avatar-color]")?.getAttribute("data-avatar-color")).toBe("Default");
    fixture.componentRef.setInput("teammateId", "alice");
    fixture.componentRef.setInput("name", "Alice");
    fixture.detectChanges();
    expect(element.querySelector("[data-avatar-color]")?.getAttribute("data-avatar-color")).toBe("Cyan");
    fixture.componentRef.setInput("name", "Renamed teammate");
    fixture.componentRef.setInput("unavailable", true);
    fixture.detectChanges();
    expect(element.querySelector("[data-avatar-color]")?.getAttribute("data-avatar-color")).toBe("Cyan");
    fixture.destroy();
    const reopened = TestBed.createComponent(TeammateAvatarComponent);
    reopened.componentRef.setInput("teammateId", "alice");
    reopened.componentRef.setInput("name", "Renamed teammate");
    reopened.detectChanges();
    const next = reopened.nativeElement as HTMLElement;
    expect(next.querySelector("[data-avatar-color]")?.getAttribute("data-avatar-color")).toBe("Cyan");
    reopened.componentRef.setInput("teammateId", "bob");
    reopened.detectChanges();
    expect(next.querySelector("[data-avatar-color]")?.getAttribute("data-avatar-color")).toBe("Purple");
  });

  it("provides distinct palette entries with readable initials in both built-in themes", () => {
    const colors = ["Default", ...Resources.avatarColors];
    expect(new Set(colors).size).toBe(13);
    for (const theme of [lightTheme, darkTheme]) {
      const values = new Map(Object.entries(theme.colors));
      for (const entry of colors) {
        const color = entry.toLowerCase();
        const background = values.get(`teamrun.avatar.${color}.background`);
        const foreground = values.get(`teamrun.avatar.${color}.foreground`);
        expect(background).toMatch(/^#[0-9a-f]{6}$/i);
        expect(foreground).toMatch(/^#[0-9a-f]{6}$/i);
        if (!background || !foreground)
          throw new Error("Missing avatar color pair");
        const luminance = (hex: string): number => [0.2126, 0.7152, 0.0722].reduce((total, weight, index) => {
          const value = parseInt(hex.slice(1 + index * 2, 3 + index * 2), 16) / 255;
          return total + weight * (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
        }, 0);
        const first = luminance(background);
        const second = luminance(foreground);
        expect((Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05)).toBeGreaterThanOrEqual(4.5);
        expect(Resources.themeTokens.find(t => t.variable === `--tr-avatar-${color}-background`)?.key).toBe(`teamrun.avatar.${color}.background`);
      }
    }
  });

  it("shows default and Unicode initials with accessible identity and unavailable state", () => {
    const fixture = TestBed.createComponent(TeammateAvatarComponent);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent?.trim()).toBe("D");
    fixture.componentRef.setInput("name", "𐐨lice");
    fixture.componentRef.setInput("description", "Historical teammate");
    fixture.componentRef.setInput("unavailable", true);
    fixture.detectChanges();
    expect(Array.from(element.textContent!.trim())).toHaveLength(1);
    expect(element.querySelector('[role="img"]')?.getAttribute("aria-label")).toBe("Historical teammate");
    expect(element.querySelector(".tr-teammate-unavailable")).not.toBeNull();
  });
});
