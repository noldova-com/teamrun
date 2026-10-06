/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Locator, Page } from "@playwright/test";

export default class LayoutFixture {
  public static readonly OVERLAY_INSET: number = 8;

  private static readonly CONTROLS: string = "button, a[href], input, select, textarea, [role=tab], [role=menuitem], [role=treeitem], [role=option], [tabindex=\"0\"]";
  private static readonly SCROLLING_CONTENT: string = "pre, table, tr-code-block";
  private static readonly TOLERANCE: number = 0.5;

  public static async findProblemsAsync(regions: Locator, inset: number = 0): Promise<string[]> {
    return await regions.evaluateAll((roots, [controls, scrollingContent, tolerance, margin]) => {
      const describe = (t: Element): string => `${t.tagName.toLowerCase()} "${(t.getAttribute("aria-label") ?? t.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 40)}"`;
      const isOutside = (box: DOMRect, area: { left: number; top: number; right: number; bottom: number }): boolean =>
        box.left < area.left - tolerance || box.top < area.top - tolerance || box.right > area.right + tolerance || box.bottom > area.bottom + tolerance;
      const area = { left: margin, top: margin, right: innerWidth - margin, bottom: innerHeight - margin };
      const problems: string[] = [];
      for (const root of roots) {
        if (isOutside(root.getBoundingClientRect(), area))
          problems.push(`${describe(root)} reaches outside the window.`);
        for (const element of [root, ...root.querySelectorAll("*")])
          if (element.scrollWidth > element.clientWidth + 1 && /auto|scroll/.test(getComputedStyle(element).overflowX) && element.closest(scrollingContent) === null)
            problems.push(`${describe(element)} scrolls sideways.`);
        let checked = 0;
        for (const item of root.querySelectorAll(controls)) {
          const box = item.getBoundingClientRect();
          if (box.width === 0 || box.height === 0 || getComputedStyle(item).visibility === "hidden")
            continue;
          checked++;
          let clip: Element | null = null;
          for (let parent = item.parentElement; parent !== null && parent !== document.body && clip === null; parent = parent.parentElement)
            if (isOutside(box, parent.getBoundingClientRect()) && !/visible/.test(getComputedStyle(parent).overflow))
              clip = parent;
          if (clip !== null && /auto|scroll/.test(getComputedStyle(clip).overflow))
            continue;
          if (clip !== null)
            problems.push(`${describe(item)} is cut off by ${describe(clip)}.`);
          else if (isOutside(box, area))
            problems.push(`${describe(item)} is outside the window.`);
          else {
            const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
            if (hit === null || !item.contains(hit))
              problems.push(`${describe(item)} is covered by ${hit === null ? "nothing" : describe(hit)}.`);
          }
        }
        if (checked === 0)
          problems.push(`${describe(root)} shows no control.`);
      }
      return problems;
    }, [LayoutFixture.CONTROLS, LayoutFixture.SCROLLING_CONTENT, LayoutFixture.TOLERANCE, inset] as const);
  }

  public static async findFocusProblemsAsync(window: Page, key: string, presses: number): Promise<string[]> {
    const problems: string[] = [];
    for (let index = 0; index < presses; index++) {
      await window.keyboard.press(key);
      const problem = await window.evaluate(tolerance => {
        const item = document.activeElement;
        if (item === null || item === document.body)
          return "Nothing has the focus.";
        const box = item.getBoundingClientRect();
        const name = `${item.tagName.toLowerCase()} "${(item.getAttribute("aria-label") ?? item.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 40)}"`;
        const areas = [{ left: 0, top: 0, right: innerWidth, bottom: innerHeight }];
        for (let parent = item.parentElement; parent !== null && parent !== document.body; parent = parent.parentElement)
          if (!/visible/.test(getComputedStyle(parent).overflow))
            areas.push(parent.getBoundingClientRect());
        return areas.some(t => box.left < t.left - tolerance || box.top < t.top - tolerance || box.right > t.right + tolerance || box.bottom > t.bottom + tolerance)
          ? `${name} has the focus out of view.`
          : null;
      }, LayoutFixture.TOLERANCE);
      if (problem !== null)
        problems.push(`${key} ${index + 1}: ${problem}`);
    }
    return problems;
  }
}
