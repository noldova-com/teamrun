/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, signal } from "@angular/core";
import { type ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
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
      <div style="height: 20rem"><tr-select label="Mode" [options]="options()" [value]="value()" [disabled]="disabled()" (valueChange)="choose($event)" /></div>
    </div>
  `
})
class SelectHostComponent {
  public readonly options = signal<readonly SelectOption[]>([new SelectOption("Light", "Light"), new SelectOption("Dark", "Dark"), new SelectOption("System", "System")]);
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

  it("opens with no option marked while its value matches none, and reports the one chosen", async () => {
    render();
    fixture.componentInstance.value.set("Sepia");
    fixture.detectChanges();

    await openAsync();
    const marked = options().map(t => t.getAttribute("aria-selected"));
    await userEvent.click(page.getByRole("option", { name: "Dark" }));
    await expect.poll(() => list()).toBeNull();

    expect(marked).toEqual(["false", "false", "false"]);
    expect(fixture.componentInstance.changes).toEqual(["Dark"]);
  });

  it("takes focus on its button and tells whether its list is open", async () => {
    render();
    const select = fixture.debugElement.query(By.directive(SelectComponent)).componentInstance as SelectComponent;

    select.focus();
    const focused = document.activeElement;
    const closed = select.isExpanded();
    await openAsync();

    expect([focused, closed, select.isExpanded()]).toEqual([button(), false, true]);
  });

  it("shows an unknown value as itself and cannot open while disabled", () => {
    render();
    fixture.componentInstance.value.set("Sepia");
    fixture.componentInstance.disabled.set(true);
    fixture.detectChanges();

    button().click();

    expect([button().textContent?.includes("Sepia"), list(), getComputedStyle(button()).opacity]).toEqual([true, null, "0.5"]);
  });

  it("ends a value too long for its width with an ellipsis", () => {
    render();
    (fixture.nativeElement.querySelector(".scroller") as HTMLElement).style.width = "8rem";
    fixture.componentInstance.value.set("A theme whose name is far too long for the select");
    fixture.detectChanges();

    AppearanceFixture.expectTruncates(button().querySelector(".tr-select-value") as HTMLElement);
  });

  it("never scrolls its list sideways: an option too long for the window ends with an ellipsis, keeps its full text as its name and shows it in a tooltip, while a short one has none", async () => {
    const long = "An option whose title keeps going far past the width of any window this list could open in. ".repeat(6).trim();
    render();
    fixture.componentInstance.options.set([new SelectOption("Light", "Light"), new SelectOption("Long", long), new SelectOption("System", "System")]);
    fixture.detectChanges();
    await openAsync();
    const surface = list() as HTMLElement;
    const title = options()[1]?.querySelector<HTMLElement>(".tr-select-option-title") as HTMLElement;

    expect([getComputedStyle(surface).overflowX, surface.scrollWidth, surface.getBoundingClientRect().right <= window.innerWidth]).toEqual(["hidden", surface.clientWidth, true]);
    AppearanceFixture.expectTruncates(title);
    await expect.element(page.getByRole("option", { name: long })).toBeVisible();
    await userEvent.hover(options()[1] as HTMLElement);
    await expect.poll(() => document.querySelector(".cdk-overlay-container tr-tooltip")?.textContent?.trim(), { timeout: 3000 }).toBe(long);
    await userEvent.hover(options()[0] as HTMLElement);
    await expect.poll(() => document.querySelector(".cdk-overlay-container tr-tooltip"), { timeout: 3000 }).toBeNull();
  });

  it("shows its list's scrollbar thumb while the pointer is over the list", async () => {
    render(DefaultTheme.theme, ThemeMode.Dark);
    await openAsync();

    await AppearanceFixture.expectThumbRevealsOnHoverAsync(list() as HTMLElement);
  });

  for (const panelSize of AppearanceFixture.panelSizes)
    it(`writes its value and options in the panel text role at panel size ${panelSize}`, async () => {
      AppearanceFixture.apply(DefaultTheme.theme, ThemeMode.Light, panelSize);
      fixture = TestBed.createComponent(SelectHostComponent);
      fixture.detectChanges();
      await openAsync();

      for (const element of [button(), options()[0] as HTMLElement]) {
        AppearanceFixture.expectRem(getComputedStyle(element).fontSize, 0.8125, panelSize);
        AppearanceFixture.expectRem(getComputedStyle(element).lineHeight, 1.125, panelSize);
      }
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
        expect([surface.color, other.color]).toEqual([AppearanceFixture.readColor(theme, mode, "foreground"), AppearanceFixture.readColor(theme, mode, "input.foreground")]);
        AppearanceFixture.expectLook(other.minHeight, theme, "dropdown-row-height", "min-height");
        AppearanceFixture.expectLook(other.paddingLeft, theme, "dropdown-row-padding", "padding-left");
      });
});
