/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { KitStylesheetFixture } from "./fixtures/kit-stylesheet.fixture";

describe("KitStylesheetFixture", () => {
  let page: HTMLLinkElement[];
  let added: HTMLLinkElement[];

  beforeEach(() => {
    page = [...document.querySelectorAll<HTMLLinkElement>(KitStylesheetFixture.SELECTOR)];
    page.forEach(t => t.media = "not all");
    added = [];
  });

  afterEach(() => {
    vi.useRealTimers();
    [...document.querySelectorAll<HTMLLinkElement>(KitStylesheetFixture.SELECTOR), ...added].filter(t => !page.includes(t)).forEach(t => t.remove());
    page.forEach(t => t.media = "");
  });

  function link(rel: string | null): HTMLLinkElement {
    const created = document.createElement("link");
    if (rel !== null)
      created.rel = rel;
    created.href = KitStylesheetFixture.HREF;
    added.push(created);
    return document.head.appendChild(created);
  }

  function count(): number {
    return document.querySelectorAll(KitStylesheetFixture.SELECTOR).length;
  }

  it("waits for the page's own stylesheet that is still loading, adding no copy", async () => {
    const loading = link("stylesheet");
    const before = count();

    await KitStylesheetFixture.ensureAsync(loading);

    expect([KitStylesheetFixture.isApplied, count()]).toEqual([true, before]);
  });

  it("adds the stylesheet and waits for it when the page has none", async () => {
    const before = count();

    await KitStylesheetFixture.ensureAsync(null);

    expect([KitStylesheetFixture.isApplied, count()]).toEqual([true, before + 1]);
  });

  it("waits for nothing while the stylesheet is applied", async () => {
    page.forEach(t => t.media = "");

    await expect(KitStylesheetFixture.ensureAsync(link(null))).resolves.toBeUndefined();
  });

  it("fails when the stylesheet does not load, and when it does not finish loading in time", async () => {
    const failing = link(null);
    const failed = KitStylesheetFixture.ensureAsync(failing);
    failing.dispatchEvent(new Event("error"));
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const stalled = KitStylesheetFixture.ensureAsync(link(null));
    const outcome = expect(stalled).rejects.toThrow(`The kit stylesheet styles.css did not finish loading within ${KitStylesheetFixture.LOAD_LIMIT} ms.`);
    vi.advanceTimersByTime(KitStylesheetFixture.LOAD_LIMIT);

    await expect(failed).rejects.toThrow("The kit stylesheet styles.css did not load.");
    await outcome;
  });
});
