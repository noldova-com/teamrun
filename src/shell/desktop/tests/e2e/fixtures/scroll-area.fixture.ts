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

  public static scrollbarSizesAsync(area: Locator): Promise<Readonly<Record<"vertical" | "horizontal" | "rem", number>>> {
    return area.evaluate(t => {
      const element = t as HTMLElement;
      const style = getComputedStyle(element);
      return {
        vertical: element.offsetWidth - element.clientWidth - Number.parseFloat(style.borderLeftWidth) - Number.parseFloat(style.borderRightWidth),
        horizontal: element.offsetHeight - element.clientHeight - Number.parseFloat(style.borderTopWidth) - Number.parseFloat(style.borderBottomWidth),
        rem: Number.parseFloat(getComputedStyle(document.documentElement).fontSize)
      };
    });
  }

  public static async revealThumbColorAsync(window: Page, area: Locator): Promise<void> {
    await ScrollAreaFixture.restAsync(window, area);
    await ScrollAreaFixture.hoverAsync(area);
  }

  public static async thumbChangesOnHoverAsync(window: Page, area: Locator, axis: "vertical" | "horizontal"): Promise<boolean> {
    const clip = await area.evaluate((t, direction) => {
      const element = t as HTMLElement;
      const box = element.getBoundingClientRect();
      const left = box.left + element.clientLeft;
      const top = box.top + element.clientTop;
      return direction === "vertical"
        ? { x: left + element.clientWidth, y: top, width: element.offsetWidth - element.clientWidth - element.clientLeft * 2, height: element.clientHeight }
        : { x: left, y: top + element.clientHeight, width: element.clientWidth, height: element.offsetHeight - element.clientHeight - element.clientTop * 2 };
    }, axis);
    await ScrollAreaFixture.restAsync(window, area);
    const rest = await window.screenshot({ clip });
    await ScrollAreaFixture.hoverAsync(area);
    return !rest.equals(await window.screenshot({ clip }));
  }

  public static edgeGapAsync(area: Locator): Promise<Readonly<Record<"gap" | "scrollbar", number>>> {
    return area.evaluate(t => {
      const element = t as HTMLElement;
      const panel = element.closest("tr-panel-card") as HTMLElement;
      const end = panel.getBoundingClientRect().right - Number.parseFloat(getComputedStyle(panel).borderRightWidth);
      const thumbEnd = element.getBoundingClientRect().right - Number.parseFloat(getComputedStyle(element).borderRightWidth);
      return { gap: end - thumbEnd, scrollbar: element.offsetWidth - element.clientWidth - element.clientLeft * 2 };
    });
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

  private static thumbColorAsync(area: Locator): Promise<string> {
    return area.evaluate(t => getComputedStyle(t).color);
  }

  private static async restAsync(window: Page, area: Locator): Promise<void> {
    await window.mouse.move(1, 1);
    await expect.poll(() => ScrollAreaFixture.thumbColorAsync(area)).toBe(ScrollAreaFixture.HIDDEN);
  }

  private static async hoverAsync(area: Locator): Promise<void> {
    const shown = await area.evaluate(t => {
      const probe = (t.parentElement ?? document.body).appendChild(document.createElement("div"));
      probe.style.color = "var(--tr-scrollbar)";
      const color = getComputedStyle(probe).color;
      probe.remove();
      return color;
    });
    await area.hover({ position: ScrollAreaFixture.HOVER_POSITION });
    await expect.poll(() => ScrollAreaFixture.thumbColorAsync(area)).toBe(shown);
  }
}
