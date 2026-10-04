/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, signal } from "@angular/core";
import { type ComponentFixture, TestBed } from "@angular/core/testing";
import { userEvent } from "vitest/browser";

import { ChoicePillsComponent } from "../../../../src/app/components/choice-pills/choice-pills.component";
import { SelectOption } from "../../../../src/app/models/select-option";
import { AppearanceFixture } from "../../../fixtures/appearance.fixture";

@Component({
  imports: [ChoicePillsComponent],
  template: `
    <button type="button" class="before">Before</button>
    <div class="row" style="background: var(--tr-hover); width: 20rem"><tr-choice-pills label="Mode" [options]="options()" [value]="value()" (valueChange)="choose($event)" /></div>
    <button type="button" class="after">After</button>
  `
})
class ChoicePillsHostComponent {
  public readonly options = signal<readonly SelectOption[]>([new SelectOption("system", "System"), new SelectOption("light", "Light"), new SelectOption("dark", "Dark")]);
  public readonly value = signal("light");
  public readonly changes: string[] = [];

  public choose(value: string): void {
    this.changes.push(value);
    this.value.set(value);
  }
}

describe("ChoicePillsComponent", () => {
  let fixture: ComponentFixture<ChoicePillsHostComponent>;
  let host: ChoicePillsHostComponent;

  function render(theme = AppearanceFixture.themes[0], mode = AppearanceFixture.modes[0]): void {
    AppearanceFixture.apply(theme, mode);
    fixture = TestBed.createComponent(ChoicePillsHostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
  }

  const pills = (): HTMLButtonElement[] => [...fixture.nativeElement.querySelectorAll(".tr-choice-pill")];
  const group = (): HTMLElement => fixture.nativeElement.querySelector("[role=radiogroup]");
  const selected = (): string[] => pills().filter(t => t.getAttribute("aria-checked") === "true").map(t => t.textContent?.trim() ?? "");

  function blend(over: string, ground: string): string {
    const [red = 0, green = 0, blue = 0, alpha = 1] = (over.match(/[\d.]+/gu) ?? []).map(Number);
    const base = (ground.match(/[\d.]+/gu) ?? []).map(Number);
    return `rgb(${[red, green, blue].map((t, i) => t * alpha + (base[i] ?? 0) * (1 - alpha)).join(", ")})`;
  }

  afterEach(() => AppearanceFixture.reset());

  it("is a named radio group of radios, one checked, with no check mark and no border", () => {
    render();

    expect(group().getAttribute("aria-label")).toBe("Mode");
    expect(pills().map(t => [t.getAttribute("role"), t.textContent?.trim(), t.getAttribute("aria-checked")])).toEqual([["radio", "System", "false"], ["radio", "Light", "true"], ["radio", "Dark", "false"]]);
    expect(pills().every(t => getComputedStyle(t).borderTopWidth === "0px")).toBe(true);
    expect(pills().every(t => t.querySelector("svg, .tr-icon") === null)).toBe(true);
  });

  it("has one tab stop: the checked pill, or the first when nothing is checked", () => {
    render();
    const stops = (): string[] => pills().filter(t => t.tabIndex === 0).map(t => t.textContent?.trim() ?? "");

    expect(stops()).toEqual(["Light"]);
    host.value.set("missing");
    fixture.detectChanges();
    expect(stops()).toEqual(["System"]);
    host.options.set([]);
    fixture.detectChanges();
    expect(pills()).toEqual([]);
  });

  it("chooses a pill with the pointer, and says nothing when the checked one is clicked again", async () => {
    render();

    pills()[2]?.click();
    fixture.detectChanges();
    pills()[2]?.click();
    fixture.detectChanges();

    expect(host.changes).toEqual(["dark"]);
    expect(selected()).toEqual(["Dark"]);
  });

  it("moves the check and the focus with the arrow keys, wrapping at both ends, and with Home and End", async () => {
    render();
    pills()[1]?.focus();

    await userEvent.keyboard("{ArrowRight}");
    expect(document.activeElement).toBe(pills()[2]);
    await userEvent.keyboard("{ArrowRight}");
    expect(document.activeElement).toBe(pills()[0]);
    await userEvent.keyboard("{ArrowLeft}");
    expect(document.activeElement).toBe(pills()[2]);
    await userEvent.keyboard("{ArrowDown}");
    expect(document.activeElement).toBe(pills()[0]);
    await userEvent.keyboard("{ArrowUp}");
    expect(document.activeElement).toBe(pills()[2]);
    await userEvent.keyboard("{ArrowUp}");
    expect(document.activeElement).toBe(pills()[1]);
    await userEvent.keyboard("{ArrowDown}");
    expect(document.activeElement).toBe(pills()[2]);
    await userEvent.keyboard("{Home}");
    expect(document.activeElement).toBe(pills()[0]);
    await userEvent.keyboard("{End}");
    expect(document.activeElement).toBe(pills()[2]);

    expect(host.changes).toEqual(["dark", "system", "dark", "system", "dark", "light", "dark", "system", "dark"]);
    expect(selected()).toEqual(["Dark"]);
  });

  it("leaves other keys alone and takes the group as a single stop of Tab", async () => {
    render();
    pills()[1]?.focus();

    await userEvent.keyboard("a");
    expect(host.changes).toEqual([]);
    await userEvent.tab();
    expect(document.activeElement).toBe(fixture.nativeElement.querySelector(".after"));
    await userEvent.tab({ shift: true });
    expect(document.activeElement).toBe(pills()[1]);
    await userEvent.tab({ shift: true });
    expect(document.activeElement).toBe(fixture.nativeElement.querySelector(".before"));
  });

  it("shows the keyboard focus as an outline inside the pill", async () => {
    render();
    pills()[1]?.focus();
    await userEvent.keyboard("{ArrowRight}");

    expect(pills()[2]?.matches(":focus-visible")).toBe(true);
    expect(getComputedStyle(pills()[2] as HTMLElement).outlineStyle).toBe("solid");
    expect(getComputedStyle(pills()[0] as HTMLElement).outlineStyle).toBe("none");
  });

  for (const mode of AppearanceFixture.modes)
    for (const theme of AppearanceFixture.themes)
      it(`takes its height, padding, gaps, weight and radius from the ${theme.id} theme in ${mode} mode`, () => {
        render(theme, mode);
        const first = getComputedStyle(pills()[0] as HTMLElement);
        const [left, right] = [(pills()[0] as HTMLElement).getBoundingClientRect(), (pills()[1] as HTMLElement).getBoundingClientRect()];

        AppearanceFixture.expectLook(first.minHeight, theme, "choice-pill", "min-height");
        expect((pills()[0] as HTMLElement).getBoundingClientRect().height).toBeGreaterThanOrEqual(Number.parseFloat(first.minHeight) - 1 / 32);
        AppearanceFixture.expectLook(first.paddingLeft, theme, "choice-pill-padding", "padding-left");
        AppearanceFixture.expectLook(first.paddingRight, theme, "choice-pill-padding", "padding-right");
        AppearanceFixture.expectLook(first.borderRadius, theme, "radius-small", "border-radius");
        AppearanceFixture.expectLook(getComputedStyle(group()).columnGap, theme, "choice-pill-gap", "column-gap");
        AppearanceFixture.expectPixels(right.left - left.right, Number.parseFloat(getComputedStyle(group()).columnGap));
        expect(first.fontWeight).toBe("600");
      });

  it("is at least 1.375rem high, 0.5rem padded and 0.25rem apart in the default theme", () => {
    render();
    const [left, right] = [(pills()[0] as HTMLElement).getBoundingClientRect(), (pills()[1] as HTMLElement).getBoundingClientRect()];

    expect(left.height).toBeGreaterThanOrEqual(AppearanceFixture.toPixels(1.375) - 1 / 32);
    AppearanceFixture.expectRem(getComputedStyle(pills()[0] as HTMLElement).paddingLeft, 0.5);
    AppearanceFixture.expectPixels(right.left - left.right, AppearanceFixture.toPixels(0.25));
  });

  for (const mode of AppearanceFixture.modes)
    for (const theme of AppearanceFixture.themes)
      it(`fills the checked pill with the ${theme.id} theme's selection color and no other in ${mode} mode`, () => {
        render(theme, mode);
        const colors = pills().map(t => getComputedStyle(t).backgroundColor);

        expect(colors[1]).toBe(AppearanceFixture.readColor(theme, mode, "list.inactiveSelectionBackground"));
        expect([colors[0], colors[2]]).toEqual(["rgba(0, 0, 0, 0)", "rgba(0, 0, 0, 0)"]);
      });

  for (const mode of AppearanceFixture.modes)
    it(`keeps its text at least 4.5:1 against its fill, checked or not, in ${mode} mode`, () => {
      render(AppearanceFixture.themes[0], mode);
      const ground = getComputedStyle(document.body).backgroundColor;

      expect(AppearanceFixture.contrast(getComputedStyle(pills()[1] as HTMLElement).color, getComputedStyle(pills()[1] as HTMLElement).backgroundColor)).toBeGreaterThanOrEqual(4.5);
      expect(AppearanceFixture.contrast(getComputedStyle(pills()[0] as HTMLElement).color, ground)).toBeGreaterThanOrEqual(4.5);
    });

  const channels = (color: string): string[] => (color.match(/[\d.]+/gu) ?? []).slice(0, 3);

  for (const mode of AppearanceFixture.modes)
    for (const theme of AppearanceFixture.themes)
      it(`fills a hovered pill with the ${theme.id} theme's toolbar hover color, not the list hover color a row hovers with, in ${mode} mode`, async () => {
        render(theme, mode);
        const before = getComputedStyle(pills()[2] as HTMLElement).backgroundColor;

        await userEvent.hover(pills()[2] as HTMLElement);
        const after = getComputedStyle(pills()[2] as HTMLElement).backgroundColor;

        expect(before).toBe("rgba(0, 0, 0, 0)");
        expect(channels(after)).toEqual(channels(AppearanceFixture.readColor(theme, mode, "toolbar.hoverBackground")));
        expect(channels(after)).not.toEqual(channels(AppearanceFixture.readColor(theme, mode, "list.hoverBackground")));
      });

  for (const mode of AppearanceFixture.modes)
    it(`shows a hovered pill on a hovered row as a visibly different fill in the default theme in ${mode} mode`, async () => {
      render(AppearanceFixture.themes[0], mode);
      const row = getComputedStyle(fixture.nativeElement.querySelector(".row") as HTMLElement).backgroundColor;

      await userEvent.hover(pills()[2] as HTMLElement);

      expect(AppearanceFixture.contrast(blend(getComputedStyle(pills()[2] as HTMLElement).backgroundColor, row), row)).toBeGreaterThanOrEqual(1.05);
    });

  it("keeps a pill with a long title inside its group, wrapping the title instead of overflowing", () => {
    render();
    host.options.set([new SelectOption("short", "Short"), new SelectOption("long", "An option whose title is far too long to fit the width its group gives it")]);
    host.value.set("long");
    fixture.nativeElement.querySelector("tr-choice-pills").style.width = "12rem";
    fixture.detectChanges();
    const bounds = group().getBoundingClientRect();
    const [short, long] = pills().map(t => t.getBoundingClientRect()) as [DOMRect, DOMRect];

    expect(long.right).toBeLessThanOrEqual(bounds.right + 1 / 32);
    expect(long.left).toBeGreaterThanOrEqual(bounds.left - 1 / 32);
    expect(long.height).toBeGreaterThan(short.height * 1.5);
  });

  it("wraps its pills onto further lines when they do not fit, and none leaves the group", () => {
    render();
    host.options.set([new SelectOption("one", "A long first title"), new SelectOption("two", "A long second title"), new SelectOption("three", "A long third title")]);
    fixture.nativeElement.querySelector("tr-choice-pills").style.width = "9rem";
    fixture.detectChanges();
    const bounds = group().getBoundingClientRect();

    expect(new Set(pills().map(t => t.getBoundingClientRect().top)).size).toBeGreaterThan(1);
    expect(pills().every(t => t.getBoundingClientRect().right <= bounds.right + 1)).toBe(true);
  });
});
