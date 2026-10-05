/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type ComponentFixture, TestBed } from "@angular/core/testing";
import { userEvent } from "vitest/browser";

import type { ThemeMode } from "../../../../src/app/enums/theme-mode";
import type { Theme } from "../../../../src/app/models/theme";
import { AppearanceFixture } from "../../../fixtures/appearance.fixture";
import { ConfigurationTableHostComponent } from "../../../fixtures/configuration-table-host.component";

describe("ConfigurationTableComponent", () => {
  let fixture: ComponentFixture<ConfigurationTableHostComponent>;

  async function renderAsync(theme?: Theme, mode?: ThemeMode): Promise<void> {
    AppearanceFixture.apply(theme, mode);
    fixture = TestBed.createComponent(ConfigurationTableHostComponent);
    await fixture.whenStable();
  }

  async function changeAsync(change: (host: ConfigurationTableHostComponent) => void): Promise<void> {
    change(fixture.componentInstance);
    await fixture.whenStable();
  }

  const find = (selector: string): HTMLElement => fixture.nativeElement.querySelector(selector);
  const box = (selector: string): DOMRect => find(selector).getBoundingClientRect();
  const cells = (): HTMLElement[] => [...fixture.nativeElement.querySelectorAll("th, td")];
  const scroll = (): HTMLElement => find(".tr-configuration-table-scroll");
  const lines = (cell: Element): number => {
    const range = document.createRange();
    range.selectNodeContents(cell);
    return range.getClientRects().length;
  };

  afterEach(() => AppearanceFixture.reset());

  it("shows its heading as a heading of the level it is given, the third by default, and names the table with it", async () => {
    await renderAsync();
    const heading = find(".tr-configuration-table-heading");

    expect([heading.getAttribute("role"), heading.getAttribute("aria-level"), heading.textContent, find("table").getAttribute("aria-label")])
      .toEqual(["heading", "3", "Environment variables", "Environment variables"]);

    await changeAsync(t => t.level.set(2));

    expect(heading.getAttribute("aria-level")).toBe("2");
  });

  it("puts its actions at the end of the heading's row, then the explanation, then the table, with the third space step between them", async () => {
    await renderAsync();
    const host = box("tr-configuration-table");
    const heading = box(".tr-configuration-table-heading");
    const add = box(".add");
    const explanation = box(".tr-configuration-table-explanation");
    const space = AppearanceFixture.measureLook("space-3");

    expect([heading.left, add.right]).toEqual([host.left, host.right]);
    expect(Math.abs((add.top + add.bottom) / 2 - (heading.top + heading.bottom) / 2)).toBeLessThanOrEqual(0.5);
    AppearanceFixture.expectPixels(explanation.top - Math.max(heading.bottom, add.bottom), space);
    AppearanceFixture.expectPixels(box("table").top - explanation.bottom, space);
    expect([explanation.left, box("table").left, box("table").right]).toEqual([host.left, host.left, host.right]);
  });

  it("shows its actions without a heading at the end of their row, and leaves out the row and the explanation when it has neither", async () => {
    await renderAsync();
    await changeAsync(t => {
      t.heading.set("");
      t.explanation.set("");
    });

    expect([find(".tr-configuration-table-explanation"), box(".add").right]).toEqual([null, box("tr-configuration-table").right]);

    await changeAsync(t => t.hasAction.set(false));

    expect([find(".tr-configuration-table-header"), box("table").top]).toEqual([null, box("tr-configuration-table").top]);
  });

  for (const mode of AppearanceFixture.modes)
    for (const theme of AppearanceFixture.themes)
      it(`takes its cell padding, separators and text from the ${theme.id} theme in ${mode} mode`, async () => {
        await renderAsync(theme, mode);

        for (const cell of cells()) {
          const style = getComputedStyle(cell);
          const sides = ["top", "bottom", ...cell.previousElementSibling === null ? [] : ["left"], ...cell.nextElementSibling === null ? [] : ["right"]];
          for (const side of sides)
            AppearanceFixture.expectLook(style.getPropertyValue(`padding-${side}`), theme, "space-2", `padding-${side}`);
          AppearanceFixture.expectLook(style.borderBottomWidth, theme, "border-width", "border-bottom-width");
          expect([style.borderBottomStyle, style.borderBottomColor, style.borderTopStyle, style.textAlign, style.verticalAlign])
            .toEqual(["solid", AppearanceFixture.readColor(theme, mode, "surface.border"), "none", "start", "baseline"]);
        }
        expect([...fixture.nativeElement.querySelectorAll("th")].map((t: HTMLElement) => getComputedStyle(t).fontWeight)).toEqual(["600", "600", "600", "600"]);
        expect(getComputedStyle(find("td")).fontWeight).toBe("400");
        AppearanceFixture.expectLook(getComputedStyle(find("td.tr-configuration-table-fill")).minWidth, theme, "text-field-width", "min-width");
        const heading = getComputedStyle(find(".tr-configuration-table-heading"));
        expect([heading.fontWeight, heading.color, getComputedStyle(find(".tr-configuration-table-explanation")).color])
          .toEqual(["600", AppearanceFixture.readColor(theme, mode, "foreground"), AppearanceFixture.readColor(theme, mode, "foreground")]);
      });

  it("puts the first cell's text and the last cell's button on the ends of the lines, with no outer padding", async () => {
    await renderAsync();
    const name = document.createRange();
    name.selectNodeContents(find(".short td"));
    const line = box(".short td");

    expect([...fixture.nativeElement.querySelectorAll("tr")].map((row: HTMLElement) => [getComputedStyle(row.firstElementChild as Element).paddingLeft, getComputedStyle(row.lastElementChild as Element).paddingRight]))
      .toEqual([["0px", "0px"], ["0px", "0px"], ["0px", "0px"]]);
    AppearanceFixture.expectPixels(name.getBoundingClientRect().left, box("table").left);
    AppearanceFixture.expectPixels(line.left, box("table").left);
    AppearanceFixture.expectPixels(box(".remove").right, box("table").right);
  });

  it("keeps every column but the free-text one on one line, and gives the free-text column the rest of the width", async () => {
    await renderAsync();
    const short = [...fixture.nativeElement.querySelectorAll(".short td:not(.tr-configuration-table-fill):not(:last-child)")].map(t => [getComputedStyle(t).whiteSpace, lines(t)]);
    const others = [...fixture.nativeElement.querySelectorAll(".short td:not(.tr-configuration-table-fill)")].reduce((sum: number, t: Element) => sum + t.getBoundingClientRect().width, 0);

    expect(short).toEqual([["nowrap", 1], ["nowrap", 1]]);
    expect(getComputedStyle(find(".short td:last-child")).whiteSpace).toBe("nowrap");
    expect(lines(find(".long .tr-configuration-table-fill"))).toBeGreaterThan(1);
    AppearanceFixture.expectPixels(box(".short .tr-configuration-table-fill").width + others, box("table").width);
  });

  it("lines each cell's first line up with the label of the button in its row", async () => {
    await renderAsync();
    const baseline = (host: Element): number => {
      const probe = document.createElement("span");
      probe.style.display = "inline-block";
      host.prepend(probe);
      const bottom = probe.getBoundingClientRect().bottom;
      probe.remove();
      return bottom;
    };
    const label = baseline(find(".remove [data-truncates]"));

    expect([...fixture.nativeElement.querySelectorAll(".short td:not(:last-child)")].map(t => Math.round(baseline(t) - label))).toEqual([0, 0, 0]);
  });

  it("grows a row to hold text that wraps, without scrolling sideways", async () => {
    await renderAsync();
    const value = find(".long .tr-configuration-table-fill");
    const wrapped = lines(value);
    const style = getComputedStyle(value);

    expect(wrapped).toBeGreaterThan(1);
    expect(box(".long").height).toBeGreaterThan(box(".short").height);
    expect(box(".long").height).toBeGreaterThanOrEqual(wrapped * Number.parseFloat(style.lineHeight) + 2 * Number.parseFloat(style.paddingTop));
    expect(scroll().scrollWidth - scroll().clientWidth).toBeLessThanOrEqual(0);
  });

  it("scrolls sideways only once the table can shrink no further, keeping the free-text column a text field wide and leaving room for a focus outline at its edges", async () => {
    await renderAsync();
    const remove = find(".remove");
    for (let step = 0; step < 3 && document.activeElement !== remove; step++)
      await userEvent.tab();
    const outline = Number.parseFloat(getComputedStyle(remove).outlineWidth) + Number.parseFloat(getComputedStyle(remove).outlineOffset);
    const room = box(".tr-configuration-table-scroll").right - box(".remove").right;

    expect(document.activeElement).toBe(remove);
    expect(getComputedStyle(scroll()).overflowX).toBe("auto");
    expect(scroll().scrollWidth - scroll().clientWidth).toBeLessThanOrEqual(0);
    expect(outline).toBeGreaterThan(0);
    expect(room).toBeGreaterThanOrEqual(outline);
    AppearanceFixture.expectPixels(box("table").left - box(".tr-configuration-table-scroll").left, room);

    await changeAsync(t => t.width.set("12rem"));

    expect(scroll().scrollWidth - scroll().clientWidth).toBeGreaterThan(0);
    expect(box("table").width).toBeGreaterThan(box("tr-configuration-table").width);
    expect(box(".short .tr-configuration-table-fill").width).toBeGreaterThanOrEqual(AppearanceFixture.measureLook("text-field-width") - 0.5);
  });
});
