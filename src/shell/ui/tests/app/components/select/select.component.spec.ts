/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, signal } from "@angular/core";
import { type ComponentFixture, TestBed } from "@angular/core/testing";
import { page, userEvent } from "vitest/browser";

import { SelectComponent } from "../../../../src/app/components/select/select.component";
import { ThemeMode } from "../../../../src/app/enums/theme-mode";
import { SelectOption } from "../../../../src/app/models/select-option";
import { DefaultTheme } from "../../../../src/app/themes/default-theme";
import { AppearanceFixture } from "../../../fixtures/appearance.fixture";

@Component({
  imports: [SelectComponent],
  template: `
    <button type="button" class="outside">Outside</button>
    <div class="scroller" style="height: 6rem; overflow: auto">
      <div style="height: 20rem"><tr-select label="Mode" [options]="options" [value]="value()" [disabled]="disabled()" (valueChange)="choose($event)" /></div>
    </div>
  `
})
class SelectHostComponent {
  public readonly options: readonly SelectOption[] = [new SelectOption("Light", "Light"), new SelectOption("Dark", "Dark"), new SelectOption("System", "System")];
  public readonly value = signal("System");
  public readonly disabled = signal(false);
  public readonly changes: string[] = [];

  public choose(value: string): void {
    this.changes.push(value);
    this.value.set(value);
  }
}

describe("SelectComponent", () => {
  let fixture: ComponentFixture<SelectHostComponent>;

  function render(theme = DefaultTheme.theme, mode = ThemeMode.Light): void {
    AppearanceFixture.apply(theme, mode);
    fixture = TestBed.createComponent(SelectHostComponent);
    fixture.detectChanges();
  }

  const button = (): HTMLButtonElement => fixture.nativeElement.querySelector(".tr-select-button");
  const list = (): HTMLElement | null => document.querySelector<HTMLElement>(".tr-select-list");
  const options = (): HTMLElement[] => [...document.querySelectorAll<HTMLElement>(".tr-select-option")];

  function resolve(token: string): string {
    const probe = document.body.appendChild(document.createElement("div"));
    probe.style.color = `var(${token})`;
    const color = getComputedStyle(probe).color;
    probe.remove();
    return color;
  }

  async function openAsync(): Promise<void> {
    button().click();
    fixture.detectChanges();
    await expect.poll(() => options().length).toBe(3);
  }

  afterEach(async () => {
    await userEvent.keyboard("{Escape}");
    AppearanceFixture.reset();
  });

  it("shows its value's title and opens a focused listbox marking the value, then reports a different choice and returns focus", async () => {
    render();

    await page.getByRole("button", { name: "Mode, System" }).click();
    await expect.poll(() => options().length).toBe(3);
    const opened = {
      expanded: button().getAttribute("aria-expanded"), focused: document.activeElement?.textContent?.trim(), role: list()?.getAttribute("role"),
      options: options().map(t => `${t.textContent?.trim()}:${t.getAttribute("role")}:${t.getAttribute("aria-selected")}`)
    };
    options()[1]?.click();
    fixture.detectChanges();

    expect(opened).toEqual({ expanded: "true", focused: "System", role: "listbox", options: ["Light:option:false", "Dark:option:false", "System:option:true"] });
    expect(fixture.componentInstance.changes).toEqual(["Dark"]);
    expect([list(), document.activeElement, button().getAttribute("aria-expanded"), button().getAttribute("aria-label")]).toEqual([null, button(), "false", "Mode, Dark"]);
  });

  it("chooses from the keyboard and reports nothing when the value is chosen again", async () => {
    render();

    await openAsync();
    await userEvent.keyboard("{ArrowUp}{Enter}");
    await expect.poll(() => list()).toBeNull();
    await openAsync();
    await userEvent.keyboard("{Enter}");
    await expect.poll(() => list()).toBeNull();
    await openAsync();
    await userEvent.keyboard("{ArrowDown}{a}");
    const stillOpen = list() !== null;
    await userEvent.keyboard("{ArrowUp} ");
    await expect.poll(() => list()).toBeNull();
    await openAsync();
    await userEvent.click(page.getByRole("option", { name: "Dark" }));
    await expect.poll(() => list()).toBeNull();

    expect(stillOpen).toBe(true);
    expect(fixture.componentInstance.changes).toEqual(["Dark"]);
  });

  it("closes without a choice on Escape, Tab, a second press or a press outside", async () => {
    render();

    for (const close of [() => userEvent.keyboard("{Escape}"), () => userEvent.keyboard("{Tab}"), () => Promise.resolve(button().click()), () => userEvent.click(page.getByRole("button", { name: "Outside" }))]) {
      await openAsync();
      await close();
      fixture.detectChanges();
      await expect.poll(() => list()).toBeNull();
    }

    expect(fixture.componentInstance.changes).toEqual([]);
  });

  it("closes when the content around it scrolls", async () => {
    render();
    await openAsync();
    const scroller = fixture.nativeElement.querySelector(".scroller") as HTMLElement;

    scroller.scrollTop = 40;
    scroller.dispatchEvent(new Event("scroll"));

    await expect.poll(() => list()).toBeNull();
    expect(fixture.componentInstance.changes).toEqual([]);
  });

  it("shows an unknown value as itself and cannot open while disabled", () => {
    render();
    fixture.componentInstance.value.set("Sepia");
    fixture.componentInstance.disabled.set(true);
    fixture.detectChanges();

    button().click();

    expect([button().textContent?.includes("Sepia"), list(), getComputedStyle(button()).opacity]).toEqual([true, null, "0.5"]);
  });

  for (const mode of AppearanceFixture.modes)
    for (const theme of AppearanceFixture.themes)
      it(`takes its colors and geometry from the ${theme.id} theme in ${mode} mode`, async () => {
        render(theme, mode);
        const style = getComputedStyle(button());
        const field = { backgroundColor: style.backgroundColor, borderTopColor: style.borderTopColor, minHeight: style.minHeight, paddingLeft: style.paddingLeft };
        await openAsync();
        const surface = getComputedStyle(list() as Element);
        const chosen = getComputedStyle(options()[2] as Element);
        const other = getComputedStyle(options()[0] as Element);

        expect(field.backgroundColor).toBe(AppearanceFixture.readColor(theme, mode, "dropdown.background"));
        expect(field.borderTopColor).toBe(AppearanceFixture.readColor(theme, mode, "dropdown.border"));
        AppearanceFixture.expectLook(field.minHeight, theme, "field-height", "min-height");
        AppearanceFixture.expectLook(field.paddingLeft, theme, "field-padding", "padding-left");
        AppearanceFixture.expectLook(getComputedStyle(fixture.nativeElement.querySelector("tr-select")).width, theme, "select-width", "width");
        expect(surface.backgroundColor).toBe(AppearanceFixture.readColor(theme, mode, "dropdown.listBackground"));
        expect(surface.borderTopColor).toBe(AppearanceFixture.readColor(theme, mode, "dropdown.border"));
        expect(surface.boxShadow).toBe(`${resolve("--tr-widget-shadow")} 0px 2px 8px 0px`);
        AppearanceFixture.expectLook(surface.paddingTop, theme, "dropdown-padding", "padding-top");
        expect([chosen.backgroundColor, chosen.color]).toEqual([AppearanceFixture.readColor(theme, mode, "list.activeSelectionBackground"), AppearanceFixture.readColor(theme, mode, "list.activeSelectionForeground")]);
        expect(other.backgroundColor).toBe("rgba(0, 0, 0, 0)");
        AppearanceFixture.expectLook(other.minHeight, theme, "dropdown-row-height", "min-height");
        AppearanceFixture.expectLook(other.paddingLeft, theme, "dropdown-row-padding", "padding-left");
      });
});
