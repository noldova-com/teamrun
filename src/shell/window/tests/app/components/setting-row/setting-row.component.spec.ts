/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type ComponentFixture, TestBed } from "@angular/core/testing";
import { page, userEvent } from "vitest/browser";

import type { JsonValue } from "@noldova/teamrun-foundation-json";
import { type SettingDefinition, SettingType } from "@noldova/teamrun-shell-protocol";
import { DefaultTheme, SelectOption, ThemeMode } from "@noldova/teamrun-shell-ui";

import { SettingRowComponent } from "../../../../src/app/components/setting-row/setting-row.component";
import { AppearanceFixture } from "../../../../../ui/tests/fixtures/appearance.fixture";
import { SettingsFixture } from "../../../fixtures/settings.fixture";

describe("SettingRowComponent", () => {
  let fixture: ComponentFixture<SettingRowComponent>;
  let changes: JsonValue[];
  let resets: number;

  function render(definition: SettingDefinition, value?: JsonValue, isSet: boolean = false, query: string = "", theme = DefaultTheme.theme, mode = ThemeMode.Light): HTMLElement {
    AppearanceFixture.apply(theme, mode);
    fixture = TestBed.createComponent(SettingRowComponent);
    fixture.componentRef.setInput("definition", definition);
    fixture.componentRef.setInput("value", value);
    fixture.componentRef.setInput("isSet", isSet);
    fixture.componentRef.setInput("query", query);
    fixture.componentRef.setInput("modules", [new SelectOption("clock", "Clock"), new SelectOption("notes", "Notes")]);
    fixture.componentInstance.changed.subscribe(t => changes.push(t));
    fixture.componentInstance.reset.subscribe(() => resets++);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  beforeEach(() => {
    changes = [];
    resets = 0;
  });

  afterEach(async () => {
    await userEvent.keyboard("{Escape}");
    AppearanceFixture.reset();
  });

  it("shows the title, name and description with the query's matches marked, and no marker or Reset while the value is not set", () => {
    const row = render(SettingsFixture.panelSize, undefined, false, "size");

    expect(row.getAttribute("data-setting")).toBe("shell.panelSize");
    expect(row.querySelector(".tr-setting-row-title")?.textContent).toBe("Interface text size");
    expect(row.querySelector(".tr-setting-row-name")?.textContent).toBe("shell.panelSize");
    expect([...row.querySelectorAll("mark")].map(t => t.textContent)).toEqual(["size", "Size", "size"]);
    expect([row.querySelector(".tr-setting-row-marker"), row.querySelector(".tr-setting-row-reset")]).toEqual([null, null]);
    expect((row.querySelector("input") as HTMLInputElement).value).toBe("13");
  });

  it("marks a set value with a named marker that is not color alone, and resets it", async () => {
    const row = render(SettingsFixture.mode, "Dark", true);
    const marker = row.querySelector(".tr-setting-row-marker") as HTMLElement;

    await page.getByRole("button", { name: "Reset Mode" }).click();

    expect([marker.getAttribute("role"), marker.getAttribute("aria-label"), marker.textContent]).toEqual(["img", "Modified", "circle"]);
    expect(getComputedStyle(marker).color).toBe(AppearanceFixture.readColor(DefaultTheme.theme, ThemeMode.Light, "focusBorder"));
    expect(getComputedStyle(row.querySelector(".tr-setting-row-title") as Element).fontWeight).toBe("600");
    expect(resets).toBe(1);
  });

  it("changes a boolean with its checkbox, labelled by the description", async () => {
    render(SettingsFixture.doNotDisturb, false);

    await page.getByRole("checkbox", { name: "Holds back notifications on this device." }).click();

    expect(changes).toEqual([true]);
  });

  it("changes a choice through its select", async () => {
    render(SettingsFixture.mode, "System");

    await page.getByRole("button", { name: "Mode, System" }).click();
    await page.getByRole("option", { name: "Dark" }).click();

    expect(changes).toEqual(["Dark"]);
  });

  it("accepts a number within its range and step, and explains and restores one outside it", async () => {
    const row = render(SettingsFixture.panelSize, 14);
    const field = row.querySelector("input") as HTMLInputElement;

    for (const value of ["20", "13.5", "", "16"]) {
      field.value = value;
      field.dispatchEvent(new Event("change"));
      fixture.detectChanges();
      if (value === "20") {
        expect(row.querySelector("[role=alert]")?.textContent?.trim()).toBe("Enter a whole number from 12 to 18.");
        expect(field.value).toBe("14");
      }
    }

    expect(changes).toEqual([16]);
    expect(row.querySelector("[role=alert]")).toBeNull();
  });

  it("explains a range with another step in its words", () => {
    const row = render(SettingsFixture.define("clock.ratio", "Ratio", "A ratio.", SettingType.number(0, 1, 0.25), 0.5, "Clock", "Ticks"));
    const field = row.querySelector("input") as HTMLInputElement;

    field.value = "0.3";
    field.dispatchEvent(new Event("change"));
    fixture.detectChanges();

    expect(row.querySelector("[role=alert]")?.textContent?.trim()).toBe("Enter a number from 0 to 1 in steps of 0.25.");
  });

  it("changes text when the field is committed", () => {
    const row = render(SettingsFixture.greeting);
    const field = row.querySelector("input") as HTMLInputElement;

    field.value = "Midday";
    field.dispatchEvent(new Event("change"));

    expect([field.maxLength, changes]).toEqual([20, ["Midday"]]);
  });

  it("chooses modules with a checkbox each, keeping their order", async () => {
    render(SettingsFixture.mutedModules, ["notes"]);

    await page.getByRole("checkbox", { name: "Clock" }).click();
    fixture.componentRef.setInput("value", ["clock", "notes"]);
    fixture.detectChanges();
    await page.getByRole("checkbox", { name: "Notes" }).click();

    expect(changes).toEqual([["clock", "notes"], ["clock"]]);
  });

  for (const mode of AppearanceFixture.modes)
    for (const theme of AppearanceFixture.themes)
      it(`follows the component table in the ${theme.id} theme in ${mode} mode`, async () => {
        const row = render(SettingsFixture.mode, "Dark", true, "", theme, mode);
        const style = getComputedStyle(row);
        const look = { top: style.paddingTop, side: style.paddingLeft, bottom: style.paddingBottom, radius: style.borderTopLeftRadius };
        const description = getComputedStyle(row.querySelector(".tr-setting-row-description") as Element).marginTop;
        const control = getComputedStyle(row.querySelector(".tr-setting-row-control") as Element).marginTop;
        await userEvent.hover(row);

        AppearanceFixture.expectLook(look.top, theme, "settings-item-padding", "padding-top", "padding");
        AppearanceFixture.expectLook(look.side, theme, "settings-item-padding", "padding-left", "padding");
        AppearanceFixture.expectLook(look.bottom, theme, "settings-item-padding", "padding-bottom", "padding");
        AppearanceFixture.expectLook(look.radius, theme, "radius-medium", "border-top-left-radius");
        AppearanceFixture.expectLook(description, theme, "settings-item-description-gap", "margin-top");
        AppearanceFixture.expectLook(control, theme, "settings-item-control-gap", "margin-top");
        expect(getComputedStyle(row).backgroundColor).toBe(AppearanceFixture.readColor(theme, mode, "list.hoverBackground"));
        expect(getComputedStyle(row.querySelector(".tr-setting-row-title") as Element).color).toBe(AppearanceFixture.readColor(theme, mode, "settings.headerForeground"));
      });

  it("treats a value that is not a list of names as no modules", () => {
    const row = render(SettingsFixture.mutedModules, "clock");

    expect([...row.querySelectorAll<HTMLInputElement>("input[type=checkbox]")].map(t => t.checked)).toEqual([false, false]);
  });
});
