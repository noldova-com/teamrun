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
  let runs: number;

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
    fixture.componentInstance.run.subscribe(() => runs++);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  beforeEach(() => {
    changes = [];
    resets = 0;
    runs = 0;
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
    expect(getComputedStyle(marker).fontVariationSettings).toBe("\"FILL\" 1");
    expect(getComputedStyle(row.querySelector(".tr-setting-row-title") as Element).fontWeight).toBe("600");
    expect(resets).toBe(1);
  });

  it("shows an action as its title and description with a button that runs it from the keyboard, never as modified", async () => {
    const row = render(SettingsFixture.alarms, undefined, false, "alarm");
    fixture.componentRef.setInput("canRun", true);
    fixture.detectChanges();

    row.querySelector<HTMLButtonElement>(".tr-setting-row-control button")?.focus();
    await userEvent.keyboard("{Enter}");

    expect([row.querySelector(".tr-setting-row-title")?.textContent, row.querySelector(".tr-setting-row-description")?.textContent]).toEqual(["Alarms", "The times the clock rings, in a tab of their own."]);
    expect([...row.querySelectorAll("mark")].map(t => t.textContent)).toEqual(["Alarm", "alarm", "alarm"]);
    expect([row.querySelector(".tr-setting-row-marker"), row.querySelector(".tr-setting-row-reset")]).toEqual([null, null]);
    expect([runs, changes]).toEqual([1, []]);
  });

  it("disables an action while its command cannot run", () => {
    const row = render(SettingsFixture.alarms);
    const button = row.querySelector<HTMLButtonElement>(".tr-setting-row-control button");

    button?.click();

    expect([button?.disabled, runs]).toEqual([true, 0]);
  });

  it("changes a boolean with its checkbox, labelled by the description", async () => {
    render(SettingsFixture.doNotDisturb, false);

    await page.getByRole("checkbox", { name: "Holds back notifications on this device." }).click();

    expect(changes).toEqual([true]);
  });

  it("shows a choice of few options as choice pills, and changes it with the pointer and the arrow keys", async () => {
    const row = render(SettingsFixture.mode, "System");
    const pills = (): string[] => [...row.querySelectorAll("[role=radio]")].filter(t => t.getAttribute("aria-checked") === "true").map(t => t.textContent?.trim() ?? "");

    expect(row.querySelector("tr-select")).toBeNull();
    expect(row.querySelector("[role=radiogroup]")?.getAttribute("aria-label")).toBe("Mode");
    expect(pills()).toEqual(["System"]);
    await page.getByRole("radio", { name: "Dark" }).click();
    fixture.componentRef.setInput("value", "Dark");
    fixture.detectChanges();
    (row.querySelector("[role=radio][aria-checked=true]") as HTMLElement).focus();
    await userEvent.keyboard("{ArrowLeft}");

    expect(changes).toEqual(["Dark", "Light"]);
  });

  it("shows a choice of more than four options, or of a single one, as a select", async () => {
    const lone = render(SettingsFixture.theme, "Default");
    const isLoneSelect = [lone.querySelector("[role=radiogroup]"), lone.querySelector("tr-select")?.tagName];
    const row = render(SettingsFixture.accent, "Blue");

    expect(isLoneSelect).toEqual([null, "TR-SELECT"]);
    expect([row.querySelector("[role=radiogroup]"), row.querySelector("tr-select")?.tagName]).toEqual([null, "TR-SELECT"]);
    await page.getByRole("button", { name: "Accent, Blue" }).click();
    await page.getByRole("option", { name: "Violet" }).click();

    expect(changes).toEqual(["Violet"]);
  });

  it("keeps a number outside its range or step as typed, marked invalid and explained, until it is corrected", () => {
    const row = render(SettingsFixture.panelSize, 14);
    const field = row.querySelector("input") as HTMLInputElement;
    const shown: string[][] = [];

    for (const value of ["20", "13.5", "", "16"]) {
      field.value = value;
      field.dispatchEvent(new Event("change"));
      fixture.detectChanges();
      const alert = row.querySelector("[role=alert]");
      shown.push([field.value, alert?.textContent?.trim() ?? "", String(field.getAttribute("aria-invalid")), String(field.getAttribute("aria-describedby") === alert?.id)]);
    }

    expect(shown).toEqual([
      ["20", "Enter a whole number from 12 to 18.", "true", "true"],
      ["13.5", "Enter a whole number from 12 to 18.", "true", "true"],
      ["", "Enter a whole number from 12 to 18.", "true", "true"],
      ["16", "", "null", "false"]
    ]);
    expect(changes).toEqual([16]);
  });

  it("puts the stored number back with Escape, and lets Escape through when there is nothing to put back", async () => {
    const row = render(SettingsFixture.panelSize, 14);
    const field = row.querySelector("input") as HTMLInputElement;
    const passed: string[] = [];
    const listen = (event: KeyboardEvent): number => passed.push(event.key);
    document.addEventListener("keydown", listen);
    let reverted: unknown[] = [];

    try {
      field.focus();
      await userEvent.keyboard("{Escape}");
      field.value = "20";
      field.dispatchEvent(new Event("change"));
      fixture.detectChanges();
      await userEvent.keyboard("{Escape}");
      fixture.detectChanges();
      reverted = [field.value, row.querySelector("[role=alert]"), field.getAttribute("aria-invalid")];
      field.value = "17";
      await userEvent.keyboard("{Escape}");
    } finally {
      document.removeEventListener("keydown", listen);
    }

    expect(reverted).toEqual(["14", null, null]);
    expect([field.value, passed, changes]).toEqual(["14", ["Escape"], []]);
  });

  it("drops a rejected entry and its error when the stored number changes, by Reset or from elsewhere", () => {
    const row = render(SettingsFixture.panelSize, 14, true);
    const field = row.querySelector("input") as HTMLInputElement;
    const shown: string[][] = [];

    for (const value of [undefined, 16]) {
      field.value = "20";
      field.dispatchEvent(new Event("change"));
      fixture.detectChanges();
      fixture.componentRef.setInput("value", value);
      fixture.detectChanges();
      shown.push([field.value, String(row.querySelector("[role=alert]")), String(field.getAttribute("aria-invalid"))]);
    }

    expect(shown).toEqual([["13", "null", "null"], ["16", "null", "null"]]);
    expect(changes).toEqual([]);
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

  it("checks the modules not chosen when inverse, so unchecking one chooses it", async () => {
    const row = render(SettingsFixture.mutedModules, ["notes"]);
    fixture.componentRef.setInput("isInverse", true);
    fixture.detectChanges();
    const checked = [...row.querySelectorAll<HTMLInputElement>("input[type=checkbox]")].map(t => t.checked);

    await page.getByRole("checkbox", { name: "Clock" }).click();
    fixture.componentRef.setInput("value", ["clock", "notes"]);
    fixture.detectChanges();
    await page.getByRole("checkbox", { name: "Notes" }).click();

    expect(checked).toEqual([true, false]);
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
