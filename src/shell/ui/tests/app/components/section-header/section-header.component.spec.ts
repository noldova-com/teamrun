/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, signal } from "@angular/core";
import { type ComponentFixture, TestBed } from "@angular/core/testing";

import { SectionHeaderComponent } from "../../../../src/app/components/section-header/section-header.component";
import type { ThemeMode } from "../../../../src/app/enums/theme-mode";
import type { Theme } from "../../../../src/app/models/theme";
import { AppearanceFixture } from "../../../fixtures/appearance.fixture";

@Component({
  imports: [SectionHeaderComponent],
  template: `
    <div class="list">
      <tr-section-header class="first" [label]="label()" />
      <p class="row">Meeting notes</p>
      <tr-section-header class="later" [label]="laterLabel()" [level]="2" />
      <p class="row">Draft</p>
    </div>
  `,
  styles: [".list { width: 12rem; } .row { margin: 0; }"]
})
class SectionHeaderHostComponent {
  public readonly label = signal("Recent");
  public readonly laterLabel = signal("Older");
}

describe("SectionHeaderComponent", () => {
  let fixture: ComponentFixture<SectionHeaderHostComponent>;

  async function renderAsync(theme?: Theme, mode?: ThemeMode): Promise<void> {
    AppearanceFixture.apply(theme, mode);
    fixture = TestBed.createComponent(SectionHeaderHostComponent);
    await fixture.whenStable();
  }

  const header = (name: string): HTMLElement => fixture.nativeElement.querySelector(`.${name}`);

  function gaps(name: string): readonly number[] {
    const element = header(name);
    const range = document.createRange();
    range.selectNodeContents(element);
    const style = getComputedStyle(element);
    const lines = Math.round(range.getBoundingClientRect().height / Number.parseFloat(style.lineHeight));
    const box = element.getBoundingClientRect();
    const labelTop = box.top + Number.parseFloat(style.paddingTop);
    const labelBottom = labelTop + lines * Number.parseFloat(style.lineHeight);
    const before = element.previousElementSibling?.getBoundingClientRect().bottom ?? box.top;
    const after = (element.nextElementSibling as Element).getBoundingClientRect().top;
    return [labelTop - before, after - labelBottom, lines].map(t => Math.round(t * 100) / 100);
  }

  afterEach(() => AppearanceFixture.reset());

  it("is a heading of the level it is given, which is the third by default, showing its label", async () => {
    await renderAsync();
    fixture.componentInstance.label.set("Today");
    await fixture.whenStable();

    expect([header("first").getAttribute("role"), header("first").getAttribute("aria-level"), header("first").textContent, header("later").getAttribute("aria-level")])
      .toEqual(["heading", "3", "Today", "2"]);
  });

  it("has no fill and draws no line, before or after", async () => {
    await renderAsync();

    expect(["first", "later"].map(t => [getComputedStyle(header(t)).backgroundColor, getComputedStyle(header(t), "::before").content, getComputedStyle(header(t), "::after").content,
      getComputedStyle(header(t)).borderTopStyle, getComputedStyle(header(t)).borderBottomStyle]))
      .toEqual([["rgba(0, 0, 0, 0)", "none", "none", "none", "none"], ["rgba(0, 0, 0, 0)", "none", "none", "none", "none"]]);
  });

  for (const mode of AppearanceFixture.modes)
    for (const theme of AppearanceFixture.themes)
      it(`takes its height, inset, text and the space above a later header from the ${theme.id} theme in ${mode} mode`, async () => {
        await renderAsync(theme, mode);
        const first = getComputedStyle(header("first"));
        const later = getComputedStyle(header("later"));

        AppearanceFixture.expectLook(`${header("first").getBoundingClientRect().height}px`, theme, "section-header-height", "height");
        AppearanceFixture.expectLook(first.paddingLeft, theme, "section-header-inset", "padding-left");
        AppearanceFixture.expectLook(later.marginTop, theme, "space-3", "margin-top");
        expect(first.marginTop).toBe("0px");
        expect([first.fontWeight, first.color]).toEqual(["600", AppearanceFixture.readColor(theme, mode, "foreground")]);
      });

  it("keeps the same space above and below its label when the label wraps, and more space above a later header than below its label", async () => {
    await renderAsync();
    const short = gaps("later");
    fixture.componentInstance.laterLabel.set("A section name that is far too long to fit the width of the header it is in, so it wraps onto a second line and more");
    await fixture.whenStable();
    const wrapped = gaps("later");

    expect([short[2], wrapped[2] > 1]).toEqual([1, true]);
    expect(wrapped.slice(0, 2)).toEqual(short.slice(0, 2));
    expect(short[0]).toBeGreaterThan(short[1] * 2);
    expect(gaps("first")[1]).toBe(short[1]);
  });
});
