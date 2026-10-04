/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import type { Locator, Page } from "@playwright/test";

export default class TabDragFixture {
  public static tab(window: Page, key: string): Locator {
    return window.locator(`tr-tab[data-tab-key="${key}"]`);
  }

  public static groupOf(window: Page, key: string): Locator {
    return window.locator("tr-tab-group").filter({ has: TabDragFixture.tab(window, key) });
  }

  public static tabKeysOf(group: Locator): Promise<readonly (string | null)[]> {
    return group.locator("tr-tab").evaluateAll(tabs => tabs.map(t => t.getAttribute("data-tab-key")));
  }

  public static async centerOfAsync(locator: Locator): Promise<{ readonly x: number; readonly y: number }> {
    const box = await locator.boundingBox();
    if (box === null)
      throw new Error("The element is not visible.");
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  }

  public static async startAsync(window: Page, key: string): Promise<void> {
    const start = await TabDragFixture.centerOfAsync(TabDragFixture.tab(window, key));
    await window.mouse.move(start.x, start.y);
    await window.mouse.down();
    await window.mouse.move(start.x + 12, start.y + 12, { steps: 3 });
  }

  public static async moveOverAsync(window: Page, target: Locator, offsetX: number = 0): Promise<void> {
    const point = await TabDragFixture.centerOfAsync(target);
    await window.mouse.move(point.x + offsetX, point.y, { steps: 6 });
  }

  public static async dragOntoPlateAsync(window: Page, key: string, groupKey: string, direction: string): Promise<void> {
    await TabDragFixture.startAsync(window, key);
    await TabDragFixture.moveOverAsync(window, TabDragFixture.groupOf(window, groupKey).locator("[role=tabpanel]"));
    await TabDragFixture.moveOverAsync(window, window.locator(`tr-docking-plate [data-direction=${direction}]`));
  }
}
