/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type ComponentFixture, TestBed } from "@angular/core/testing";

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
          for (const side of ["top", "right", "bottom", "left"])
            AppearanceFixture.expectLook(style.getPropertyValue(`padding-${side}`), theme, "space-2", `padding-${side}`);
          AppearanceFixture.expectLook(style.borderBottomWidth, theme, "border-width", "border-bottom-width");
          expect([style.borderBottomStyle, style.borderBottomColor, style.borderTopStyle, style.textAlign, style.verticalAlign])
            .toEqual(["solid", AppearanceFixture.readColor(theme, mode, "surface.border"), "none", "start", "top"]);
        }
        expect([...fixture.nativeElement.querySelectorAll("th")].map((t: HTMLElement) => getComputedStyle(t).fontWeight)).toEqual(["600", "600", "600"]);
        expect(getComputedStyle(find("td")).fontWeight).toBe("400");
        const heading = getComputedStyle(find(".tr-configuration-table-heading"));
        expect([heading.fontWeight, heading.color, getComputedStyle(find(".tr-configuration-table-explanation")).color])
          .toEqual(["600", AppearanceFixture.readColor(theme, mode, "foreground"), AppearanceFixture.readColor(theme, mode, "foreground")]);
      });

  it("drops the outer padding of the first and last cells when flush, keeping the rest", async () => {
    await renderAsync();
    const padding = (): string[][] => [...fixture.nativeElement.querySelectorAll("tr")].map((row: HTMLElement) => [...row.children]
      .map(t => `${getComputedStyle(t).paddingLeft} ${getComputedStyle(t).paddingRight}`));
    const space = getComputedStyle(find("td")).paddingTop;
    const full = `${space} ${space}`;

    expect(padding()).toEqual([[full, full, full], [full, full, full], [full, full, full]]);

    await changeAsync(t => t.flush.set(true));

    expect(padding()).toEqual([[`0px ${space}`, full, `${space} 0px`], [`0px ${space}`, full, `${space} 0px`], [`0px ${space}`, full, `${space} 0px`]]);
    expect(getComputedStyle(find("td")).paddingTop).toBe(space);
  });

  it("grows a row to hold text that wraps, without scrolling sideways", async () => {
    await renderAsync();
    const value = find(".long td:nth-child(2)");
    const range = document.createRange();
    range.selectNodeContents(value);
    const lines = range.getClientRects().length;
    const style = getComputedStyle(value);

    expect(lines).toBeGreaterThan(1);
    AppearanceFixture.expectPixels(box(".long").height, lines * Number.parseFloat(style.lineHeight) + 2 * Number.parseFloat(style.paddingTop) + Number.parseFloat(style.borderBottomWidth));
    expect(box(".long").height).toBeGreaterThan(box(".short").height);
    expect(scroll().scrollWidth).toBeLessThanOrEqual(scroll().clientWidth);
  });

  it("scrolls sideways only once the table can shrink no further, leaving room for a focus outline at its edges", async () => {
    await renderAsync();
    await changeAsync(t => t.flush.set(true));
    const room = 3 * Number.parseFloat(getComputedStyle(find("td")).borderBottomWidth);

    expect([getComputedStyle(scroll()).overflowX, scroll().scrollWidth <= scroll().clientWidth]).toEqual(["auto", true]);
    AppearanceFixture.expectPixels(box("tr-configuration-table").right - box(".remove").right, 0);
    AppearanceFixture.expectPixels(box(".tr-configuration-table-scroll").right - box(".remove").right, room);
    AppearanceFixture.expectPixels(box("table").left - box(".tr-configuration-table-scroll").left, room);

    await changeAsync(t => t.width.set("6rem"));

    expect(scroll().scrollWidth).toBeGreaterThan(scroll().clientWidth);
    expect(box("table").width).toBeGreaterThan(box("tr-configuration-table").width);
  });
});
