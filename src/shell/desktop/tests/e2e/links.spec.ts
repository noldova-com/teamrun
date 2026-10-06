/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { expect, test } from "./fixtures/desktop-test.fixture.ts";

test.describe("links", () => {
  test("a link clicked or middle-clicked in a note and a link a window part opens reach the system's opener, and the window stays on its page", async ({ desktop }) => {
    await desktop.application.evaluate(({ shell }) => {
      const opened: string[] = [];
      Reflect.set(globalThis, "openedLinks", opened);
      shell.openExternal = (url: string): Promise<void> => {
        opened.push(url);
        return Promise.resolve();
      };
    });
    const window = desktop.window;
    const page = window.url();
    await window.locator("tr-tab[data-tab-key=\"document/notes.note/1\"]").click();
    const link = window.locator("[data-fixture-content=notes-link-1]:visible");

    await link.click();
    await link.click({ button: "middle" });
    await window.locator("[data-fixture-content=notes-help-1]:visible").click();

    await expect.poll(() => desktop.application.evaluate(() => Reflect.get(globalThis, "openedLinks")))
      .toEqual(["https://example.com/notes", "https://example.com/notes", "https://example.com/help"]);
    expect([window.url(), desktop.application.windows().length]).toEqual([page, 1]);
    await desktop.checkpointAsync("links-opened");
  });
});
