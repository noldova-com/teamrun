/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import type { Locator, Page } from "@playwright/test";

export default class TabRowFixture {
  public static async setDirectionAsync(window: Page, direction: "ltr" | "rtl"): Promise<void> {
    await window.evaluate(t => document.documentElement.setAttribute("dir", t), direction);
  }

  public static insetsOf(group: Locator): Promise<Readonly<Record<"rem" | "firstTab" | "lastAction" | "content", number>>> {
    return group.evaluate(t => {
      const isReversed = getComputedStyle(t).direction === "rtl";
      const card = t.querySelector("tr-panel-card");
      const box = card?.getBoundingClientRect() ?? new DOMRect(Number.NaN, Number.NaN);
      const border = card?.clientLeft ?? 0;
      const first = t.querySelector("tr-tab")?.getBoundingClientRect() ?? new DOMRect(Number.NaN, Number.NaN);
      const last = [...t.querySelectorAll(".tr-tab-group-actions button")].at(-1)?.getBoundingClientRect() ?? new DOMRect(Number.NaN, Number.NaN);
      const content = t.querySelector(".tr-tab-pill, .tr-tab-group-title");
      const text = content?.getBoundingClientRect() ?? new DOMRect(Number.NaN, Number.NaN);
      const padding = Number.parseFloat(content === null ? "" : getComputedStyle(content).paddingInlineStart);
      return {
        rem: Number.parseFloat(getComputedStyle(document.documentElement).fontSize),
        firstTab: isReversed ? box.right - border - first.right : first.left - box.left - border,
        lastAction: isReversed ? last.left - box.left - border : box.right - border - last.right,
        content: isReversed ? box.right - border - text.right + padding : text.left + padding - box.left - border
      };
    });
  }
}
