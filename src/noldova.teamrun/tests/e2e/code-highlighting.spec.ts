/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type Locator, type Page, type Worker, expect } from "playwright/test";

import { CodexDouble } from "./fixtures/codex-double.ts";
import { TeamRunApp, test } from "./fixtures/teamrun-app.fixture.ts";

const FIRST: string = "const first = 1;";
const SECOND: string = "const second = 2;";

const highlightingWorkersOf = (page: Page): Worker[] => page.workers().filter(t => /\/[^/]*worker[^/]*\.js$/.test(t.url()));

async function tokensOf(code: Locator): Promise<string[]> {
  return code.evaluate((element: HTMLElement) => {
    const box = element.getBoundingClientRect();
    const tokenOf = (name: string, text: string, token: DOMRect): string => {
      const isInside = token.width > 0 && token.left >= box.left && token.right <= box.right && token.top >= box.top && token.bottom <= box.bottom;
      return `${name}=${text}${isInside ? "" : " outside its code"}`;
    };
    const lengthOf = (node: Node): number => node instanceof CharacterData ? node.length : node.childNodes.length;
    const ranges = [...CSS.highlights].flatMap(([name, highlight]) => [...highlight]
      .filter((t): t is StaticRange => t instanceof StaticRange && element.contains(t.startContainer))
      .flatMap(t => {
        const range = document.createRange();
        range.setStart(t.startContainer, Math.min(t.startOffset, lengthOf(t.startContainer)));
        range.setEnd(t.endContainer, Math.min(t.endOffset, lengthOf(t.endContainer)));
        return range.collapsed ? [] : [tokenOf(name, range.toString(), range.getBoundingClientRect())];
      }));
    const spans = [...element.querySelectorAll<HTMLElement>("span[class^='nol-code-']:not(.nol-code-line)")]
      .map(t => tokenOf(t.className, t.textContent ?? "", t.getBoundingClientRect()));
    return [...ranges, ...spans];
  });
}

test.describe("a reply's code", () => {
  test("is highlighted by the window's worker, and on the page once that worker fails", async ({ app }) => {
    const page = await app.openChatAsync();

    await app.sendAsync(`${CodexDouble.CODE_PREFIX}${FIRST}`);

    const first = page.locator(".nol-code-block-body code", { hasText: FIRST });
    await expect(first).toBeVisible({ timeout: 30_000 });
    await expect.poll(() => tokensOf(first), TeamRunApp.pollOf(30_000)).toContain("nol-code-number=1");
    expect((await tokensOf(first)).filter(t => t.endsWith(" outside its code"))).toEqual([]);
    const workers = highlightingWorkersOf(page);
    expect(workers).toHaveLength(1);

    await workers[0]?.evaluate(() => setTimeout(() => {
      throw new Error("The end-to-end test fails the highlighting worker.");
    }));
    await expect.poll(() => highlightingWorkersOf(page).length, TeamRunApp.pollOf(30_000)).toBe(0);
    await app.sendAsync(`${CodexDouble.CODE_PREFIX}${SECOND}`);

    const second = page.locator(".nol-code-block-body code", { hasText: SECOND });
    await expect(second).toBeVisible({ timeout: 30_000 });
    await expect.poll(() => tokensOf(second), TeamRunApp.pollOf(30_000)).toContain("nol-code-number=2");
    expect((await tokensOf(second)).filter(t => t.endsWith(" outside its code"))).toEqual([]);
    expect(highlightingWorkersOf(page)).toEqual([]);
    expect(app.unexpectedFailures).toEqual([]);
  });
});
