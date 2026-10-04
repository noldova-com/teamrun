/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type Type } from "@angular/core";
import { type ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { userEvent } from "vitest/browser";

import * as kit from "../../../../src/api/index";
import { GalleryComponent } from "../../../../src/app/components/gallery/gallery.component";
import { AppearanceFixture } from "../../../fixtures/appearance.fixture";

describe("GalleryComponent", () => {
  let fixture: ComponentFixture<GalleryComponent>;

  async function showAsync(): Promise<void> {
    fixture = TestBed.createComponent(GalleryComponent);
    fixture.componentRef.setInput("themes", AppearanceFixture.themes);
    fixture.detectChanges();
    await fixture.whenStable();
  }

  function frames(): readonly HTMLElement[] {
    return [...fixture.nativeElement.querySelectorAll(".tr-gallery-scope-frame")];
  }

  function colorOf(parent: HTMLElement, property: string, value: string): string {
    const probe = document.createElement("span");
    probe.style.setProperty(property, value);
    parent.append(probe);
    const color = getComputedStyle(probe).getPropertyValue(property);
    probe.remove();
    return color;
  }

  afterEach(() => {
    AppearanceFixture.reset();
  });

  it("shows the controls once for each theme in light and in dark, each scope named for them", async () => {
    await showAsync();

    expect(frames().map(t => t.getAttribute("aria-label"))).toEqual(["Default, light mode", "Default, dark mode", "Fixture, light mode", "Fixture, dark mode"]);
    expect(frames().map(t => [t.dataset["theme"], t.dataset["mode"]])).toEqual([
      ["shell.default", "Light"], ["shell.default", "Dark"], ["fixture.contrast", "Light"], ["fixture.contrast", "Dark"]
    ]);
    expect(frames().every(t => t.querySelector("tr-gallery-forms") !== null && t.querySelector("tr-gallery-navigation") !== null && t.querySelector("tr-gallery-overlays") !== null)).toBe(true);
  });

  it("shows the default theme alone when it is given no others", async () => {
    fixture = TestBed.createComponent(GalleryComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(frames().map(t => t.getAttribute("aria-label"))).toEqual(["Default, light mode", "Default, dark mode"]);
  });

  it("paints each scope with its own theme and mode, and derives colors from them within the scope", async () => {
    await showAsync();
    const [defaultLight, defaultDark, fixtureLight, fixtureDark] = frames() as [HTMLElement, HTMLElement, HTMLElement, HTMLElement];

    expect(colorOf(defaultLight, "color", "var(--tr-text)")).toBe(colorOf(defaultLight, "color", "#3B3B3B"));
    expect(colorOf(defaultDark, "color", "var(--tr-text)")).toBe(colorOf(defaultDark, "color", "#CCCCCC"));
    expect(colorOf(fixtureLight, "color", "var(--tr-text)")).toBe(colorOf(fixtureLight, "color", "#A00610"));
    expect(colorOf(fixtureDark, "color", "var(--tr-text)")).toBe(colorOf(fixtureDark, "color", "#2006A0"));
    expect(colorOf(fixtureLight, "background-color", "var(--tr-inline-code)")).toBe(colorOf(fixtureLight, "background-color", "color-mix(in srgb, #A00610 12%, transparent)"));
    expect(colorOf(fixtureDark, "background-color", "var(--tr-inline-code)")).toBe(colorOf(fixtureDark, "background-color", "color-mix(in srgb, #2006A0 12%, transparent)"));
    expect(colorOf(document.body, "background-color", "var(--tr-inline-code)")).not.toBe(colorOf(fixtureLight, "background-color", "var(--tr-inline-code)"));
  });

  it("shows the keyboard focus on the first control of a scope when its button is pressed from the keyboard, and not before", async () => {
    await showAsync();
    const frame = frames()[2] as HTMLElement;
    const button = frame.querySelector<HTMLButtonElement>("[data-gallery-walk]") as HTMLButtonElement;
    const first = frame.querySelector("tr-gallery-forms button:not(:disabled)");

    expect(document.activeElement).not.toBe(first);
    button.focus();
    await userEvent.keyboard("{Enter}");

    expect(document.activeElement).toBe(first);
    expect(first?.matches(":focus-visible")).toBe(true);
  });

  it("lets the sample controls be used: a toggle button, a checkbox, a select and a checkbox row of a menu", async () => {
    await showAsync();
    const forms = fixture.nativeElement.querySelector("tr-gallery-forms") as HTMLElement;
    const toggle = forms.querySelector<HTMLButtonElement>("[aria-pressed]") as HTMLButtonElement;
    const checkbox = forms.querySelector<HTMLInputElement>("tr-checkbox input") as HTMLInputElement;
    const select = forms.querySelector<HTMLButtonElement>(".tr-select-button") as HTMLButtonElement;
    const row = fixture.nativeElement.querySelector("tr-gallery-overlays [role='menuitemcheckbox']") as HTMLElement;

    toggle.click();
    checkbox.click();
    select.click();
    await fixture.whenStable();
    (document.querySelector(".tr-select-option[data-value='two']") as HTMLElement).click();
    row.click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(toggle.getAttribute("aria-pressed")).toBe("false");
    expect(checkbox.checked).toBe(false);
    expect(select.textContent).toContain("Second option");
    expect(row.getAttribute("aria-checked")).toBe("false");
  });

  it("shows every component and directive the kit exports, so a new control that is not shown here fails this test", async () => {
    await showAsync();
    const own = new Set<unknown>([kit.GalleryComponent]);
    const controls = Object.entries(kit).filter(([, value]) => !own.has(value) && typeof value === "function" && ("ɵcmp" in value || "ɵdir" in value));

    const missing = controls.filter(([, value]) => fixture.debugElement.queryAll(By.directive(value as Type<unknown>)).length === 0).map(([name]) => name);

    expect(controls.length).toBeGreaterThan(20);
    expect(missing).toEqual([]);
  });
});
