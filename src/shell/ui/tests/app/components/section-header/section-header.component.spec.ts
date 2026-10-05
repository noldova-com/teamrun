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
    <tr-section-header class="plain" [label]="label()" />
    <tr-section-header class="separated" label="Older" [isSeparated]="true" [level]="2" />
  `
})
class SectionHeaderHostComponent {
  public readonly label = signal("Recent");
}

describe("SectionHeaderComponent", () => {
  let fixture: ComponentFixture<SectionHeaderHostComponent>;

  async function renderAsync(theme?: Theme, mode?: ThemeMode): Promise<void> {
    AppearanceFixture.apply(theme, mode);
    fixture = TestBed.createComponent(SectionHeaderHostComponent);
    await fixture.whenStable();
  }

  const header = (name: string): HTMLElement => fixture.nativeElement.querySelector(`.${name}`);

  afterEach(() => AppearanceFixture.reset());

  it("is a heading of the level it is given, which is the third by default, showing its label", async () => {
    await renderAsync();
    fixture.componentInstance.label.set("Today");
    await fixture.whenStable();

    expect([header("plain").getAttribute("role"), header("plain").getAttribute("aria-level"), header("plain").textContent, header("separated").getAttribute("aria-level")])
      .toEqual(["heading", "3", "Today", "2"]);
  });

  it("draws its separator above only when it is separated, inside the header and without any fill", async () => {
    await renderAsync();

    expect([header("plain").classList.contains("tr-section-header-separated"), getComputedStyle(header("plain"), "::before").content, getComputedStyle(header("separated"), "::before").content])
      .toEqual([false, "none", "\"\""]);
    expect([getComputedStyle(header("plain")).backgroundColor, getComputedStyle(header("separated")).backgroundColor]).toEqual(["rgba(0, 0, 0, 0)", "rgba(0, 0, 0, 0)"]);
  });

  for (const mode of AppearanceFixture.modes)
    for (const theme of AppearanceFixture.themes)
      it(`takes its height, inset, text and separator, which runs from where its text starts to where it ends, from the ${theme.id} theme in ${mode} mode`, async () => {
        await renderAsync(theme, mode);
        const plain = getComputedStyle(header("plain"));
        const separator = getComputedStyle(header("separated"), "::before");
        const separated = getComputedStyle(header("separated"));

        AppearanceFixture.expectLook(`${header("plain").getBoundingClientRect().height}px`, theme, "section-header-height", "height");
        AppearanceFixture.expectLook(plain.paddingLeft, theme, "section-header-inset", "padding-left");
        const text = document.createRange();
        text.selectNodeContents(header("separated"));
        const textBox = text.getBoundingClientRect();
        const headerLeft = header("separated").getBoundingClientRect().left;
        expect([headerLeft + Number.parseFloat(separator.left), headerLeft + Number.parseFloat(separator.left) + Number.parseFloat(separator.width)].map(Math.round)).toEqual([textBox.left, textBox.right].map(Math.round));
        expect([plain.fontWeight, plain.color, separator.borderTopColor, separator.borderTopStyle, Number.parseFloat(separator.borderTopWidth)]).toEqual([
          "600", AppearanceFixture.readColor(theme, mode, "foreground"), AppearanceFixture.readColor(theme, mode, "sideBarSectionHeader.border"), "solid",
          Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--tr-border-width"))]);
        expect(separated.position).toBe("relative");
      });

  it("grows past its height when its label wraps", async () => {
    await renderAsync();
    fixture.componentInstance.label.set("A section name that is far too long to fit the width of the header it is in, so it wraps onto a second line and more");
    header("plain").style.width = "12rem";
    await fixture.whenStable();

    expect(header("plain").getBoundingClientRect().height).toBeGreaterThan(Number.parseFloat(getComputedStyle(header("plain")).minHeight));
  });
});
