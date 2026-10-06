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
import { TreeComponent } from "../../../../src/app/components/tree/tree.component";
import type { ThemeMode } from "../../../../src/app/enums/theme-mode";
import type { Theme } from "../../../../src/app/models/theme";
import { TreeNode } from "../../../../src/app/models/tree.node";
import { AppearanceFixture } from "../../../fixtures/appearance.fixture";

@Component({
  imports: [SectionHeaderComponent, TreeComponent],
  template: `
    <div class="list">
      <tr-section-header class="first" [label]="label()" />
      <tr-tree label="Recent" [nodes]="rows" />
      <tr-section-header class="later" [label]="laterLabel()" [level]="2" />
      <tr-tree label="Older" [nodes]="rows" />
    </div>
  `,
  styles: [".list { width: 12rem; }"]
})
class SectionHeaderHostComponent {
  public readonly label = signal("Recent");
  public readonly laterLabel = signal("Older");
  public readonly rows: readonly TreeNode[] = [new TreeNode("notes", "Meeting notes", "description"), new TreeNode("draft", "Draft", "description")];
}

describe("SectionHeaderComponent", () => {
  let fixture: ComponentFixture<SectionHeaderHostComponent>;

  async function renderAsync(theme?: Theme, mode?: ThemeMode): Promise<void> {
    AppearanceFixture.apply(theme, mode);
    fixture = TestBed.createComponent(SectionHeaderHostComponent);
    await fixture.whenStable();
  }

  const header = (name: string): HTMLElement => fixture.nativeElement.querySelector(`.${name}`);
  const rounded = (value: number): number => Math.round(value * 100) / 100;

  function label(name: string): DOMRect {
    const range = document.createRange();
    range.selectNodeContents(header(name));
    return range.getBoundingClientRect();
  }

  function lineCount(name: string): number {
    return Math.round(label(name).height / Number.parseFloat(getComputedStyle(header(name)).lineHeight));
  }

  function gaps(name: string): readonly [number, number] {
    const element = header(name);
    const style = getComputedStyle(element);
    const labelTop = element.getBoundingClientRect().top + Number.parseFloat(style.paddingTop);
    const labelBottom = labelTop + lineCount(name) * Number.parseFloat(style.lineHeight);
    const before = [...element.previousElementSibling?.querySelectorAll("[role=treeitem]") ?? []].at(-1)?.getBoundingClientRect().bottom ?? element.getBoundingClientRect().top;
    const after = (element.nextElementSibling?.querySelector("[role=treeitem]") as Element).getBoundingClientRect().top;
    return [rounded(labelTop - before), rounded(after - labelBottom)];
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
      it(`takes its height, text and the space above a later header from the ${theme.id} theme in ${mode} mode, with its label where a tree row's icon starts`, async () => {
        await renderAsync(theme, mode);
        const first = getComputedStyle(header("first"));
        const later = getComputedStyle(header("later"));
        const icon = (header("first").nextElementSibling?.querySelector(".tr-tree-icon") as Element).getBoundingClientRect();

        AppearanceFixture.expectLook(`${header("first").getBoundingClientRect().height}px`, theme, "section-header-height", "height");
        AppearanceFixture.expectLook(first.paddingLeft, theme, "space-2", "padding-left");
        AppearanceFixture.expectPixels(label("first").left, icon.left);
        AppearanceFixture.expectLook(later.marginTop, theme, "space-3", "margin-top");
        expect(first.marginTop).toBe("0px");
        expect([first.fontWeight, first.color]).toEqual(["600", AppearanceFixture.readColor(theme, mode, "foreground")]);
      });

  it("has as much space above its label as below it, within the header", async () => {
    await renderAsync();
    const style = getComputedStyle(header("first"));

    const [above, below] = gaps("first");

    expect([lineCount("first"), style.paddingTop]).toEqual([1, style.paddingBottom]);
    expect(above).toBe(below);
  });

  it("keeps the same space above and below its label when the label wraps, and more than twice the space below its label above a later header", async () => {
    await renderAsync();
    const short = gaps("later");
    fixture.componentInstance.laterLabel.set("A section name that is far too long to fit the width of the header it is in, so it wraps onto a second line and more");
    await fixture.whenStable();
    const wrapped = gaps("later");

    expect(lineCount("later")).toBeGreaterThan(1);
    const [above, below] = short;
    const [, firstBelow] = gaps("first");

    expect(wrapped).toEqual(short);
    expect(above).toBeGreaterThan(below * 2);
    expect(firstBelow).toBe(below);
  });
});
