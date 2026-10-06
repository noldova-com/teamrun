/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type Locator, type Page, expect } from "@playwright/test";

export default class ScrollAreaFixture {
  private static readonly HIDDEN: string = "rgba(0, 0, 0, 0)";
  private static readonly HOVER_POSITION: Readonly<Record<"x" | "y", number>> = { x: 20, y: 10 };
  private static readonly DRAG_STEPS: number = 5;
  private static readonly FRAME: number = 16;

  public static scrollbarSizesAsync(area: Locator): Promise<Readonly<Record<"vertical" | "horizontal" | "rem", number>>> {
    return ScrollAreaFixture.measureOneAsync("scrollbar sizes", () => area.evaluateAll(all => all.map(t => {
      const element = t as HTMLElement;
      const style = getComputedStyle(element);
      return {
        vertical: element.offsetWidth - element.clientWidth - Number.parseFloat(style.borderLeftWidth) - Number.parseFloat(style.borderRightWidth),
        horizontal: element.offsetHeight - element.clientHeight - Number.parseFloat(style.borderTopWidth) - Number.parseFloat(style.borderBottomWidth),
        rem: Number.parseFloat(getComputedStyle(document.documentElement).fontSize)
      };
    })));
  }

  public static async revealThumbColorAsync(window: Page, area: Locator): Promise<void> {
    await ScrollAreaFixture.restPointerAsync(window, area);
    await ScrollAreaFixture.hoverAsync(area);
  }

  public static async thumbChangesOnHoverAsync(window: Page, area: Locator, axis: "vertical" | "horizontal"): Promise<boolean> {
    await ScrollAreaFixture.restPointerAsync(window, area);
    const rest = await ScrollAreaFixture.scrollbarImageAsync(window, area, axis);
    await ScrollAreaFixture.hoverAsync(area);
    return !rest.equals(await ScrollAreaFixture.scrollbarImageAsync(window, area, axis));
  }

  public static async scrollbarImageAsync(window: Page, area: Locator, axis: "vertical" | "horizontal"): Promise<Buffer> {
    const clip = await area.evaluate((t, direction) => {
      const element = t as HTMLElement;
      const box = element.getBoundingClientRect();
      const left = box.left + element.clientLeft;
      const top = box.top + element.clientTop;
      return direction === "vertical"
        ? { x: left + element.clientWidth, y: top, width: element.offsetWidth - element.clientWidth - element.clientLeft * 2, height: element.clientHeight }
        : { x: left, y: top + element.clientHeight, width: element.clientWidth, height: element.offsetHeight - element.clientHeight - element.clientTop * 2 };
    }, axis);
    return window.screenshot({ clip });
  }

  public static panelEdgeGapAsync(area: Locator): Promise<number> {
    return ScrollAreaFixture.measureOneAsync("gap to the panel's edge", () => area.evaluateAll(all => all.map(t => {
      const panel = t.closest<HTMLElement>("tr-panel-card");
      if (panel === null) {
        const ancestors: string[] = [];
        for (let element: Element | null = t; element !== null; element = element.parentElement)
          ancestors.push([element.localName, ...element.classList].join("."));
        const where = t.isConnected ? "on the page" : "off the page";
        throw new Error(`1 of ${all.length} matching scroll areas has no panel card around it, ${where}, under ${t.getRootNode().nodeName}: ${ancestors.join(" < ")}.`);
      }
      const panelEnd = panel.getBoundingClientRect().right - Number.parseFloat(getComputedStyle(panel).borderRightWidth);
      const areaEnd = t.getBoundingClientRect().right - Number.parseFloat(getComputedStyle(t).borderRightWidth);
      return panelEnd - areaEnd;
    })));
  }

  public static scrollTopAsync(area: Locator): Promise<number> {
    return area.evaluate(t => t.scrollTop);
  }

  public static async dragVerticalThumbAsync(window: Page, area: Locator, distance: number): Promise<Readonly<Record<"start" | "distance", number>>> {
    const thumb = await area.evaluate(t => {
      const element = t as HTMLElement;
      const box = element.getBoundingClientRect();
      const length = element.clientHeight * element.clientHeight / element.scrollHeight;
      return {
        x: box.left + element.clientLeft + element.clientWidth + (element.offsetWidth - element.clientWidth - element.clientLeft * 2) / 2,
        y: box.top + element.clientTop + element.scrollTop * element.clientHeight / element.scrollHeight + length / 2,
        ratio: element.scrollHeight / element.clientHeight,
        start: element.scrollTop
      };
    });
    await window.mouse.move(thumb.x, thumb.y);
    await window.mouse.down();
    await window.mouse.move(thumb.x, thumb.y + distance, { steps: ScrollAreaFixture.DRAG_STEPS });
    await window.mouse.up();
    return { start: thumb.start, distance: distance * thumb.ratio };
  }

  public static async restPointerAsync(window: Page, area: Locator): Promise<void> {
    await window.mouse.move(1, 1);
    await ScrollAreaFixture.expectThumbShownAsync(area, false);
  }

  public static async expectThumbShownAsync(area: Locator, isShown: boolean): Promise<void> {
    const expected = isShown ? await ScrollAreaFixture.readShownColorAsync(area) : ScrollAreaFixture.HIDDEN;
    await expect.poll(() => ScrollAreaFixture.thumbColorAsync(area), { message: `the thumb's color, ${isShown ? "shown" : "hidden"}`, intervals: [ScrollAreaFixture.FRAME] }).toBe(expected);
  }

  private static async measureOneAsync<T>(what: string, measureAllAsync: () => Promise<T[]>): Promise<T> {
    let measured: T[] = [];
    await expect.poll(async () => (measured = await measureAllAsync()).length, { message: `the scroll areas that match, to measure their ${what}` }).toBe(1);
    return measured[0] as T;
  }

  private static thumbColorAsync(area: Locator): Promise<string> {
    return area.evaluate(t => getComputedStyle(t).getPropertyValue("--tr-scroll-thumb"));
  }

  private static readShownColorAsync(area: Locator): Promise<string> {
    return area.evaluate(t => {
      const probe = (t.parentElement ?? document.body).appendChild(document.createElement("div"));
      probe.style.color = "var(--tr-scrollbar)";
      const color = getComputedStyle(probe).color;
      probe.remove();
      return color;
    });
  }

  private static async hoverAsync(area: Locator): Promise<void> {
    await area.hover({ position: ScrollAreaFixture.HOVER_POSITION });
    await ScrollAreaFixture.expectThumbShownAsync(area, true);
  }
}
