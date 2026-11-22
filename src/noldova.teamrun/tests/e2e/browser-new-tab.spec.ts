/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { expect } from "playwright/test";

import { LinkedSite } from "./fixtures/linked-site.ts";
import { TeamRunApp, test } from "./fixtures/teamrun-app.fixture.ts";

test("a link a page opens in a new tab, by target=\"_blank\", window.open or a middle click, loads in that tab, its address shown", async ({ app }, testInfo) => {
  const site = await LinkedSite.startAsync();
  try {
    const page = await app.openChatAsync();
    await app.nameLocalSitesAsync(site.origin);
    await site.openFirstAsync(page);

    for (const step of LinkedSite.STEPS) {
      await site.pressAsync(app.electronApp, step);
      if (step.button === "middle") {
        const behind = TeamRunApp.tabOf(page, site.behindNameOf(step));
        await expect(behind, `${step.to} opens behind ${step.from}, named by its address until it shows`).toHaveAttribute("aria-selected", "false", { timeout: 30_000 });
        await expect(page.locator(`${LinkedSite.FIELD}:visible`), `${step.from} stays shown`).toHaveValue(site.urlOf(step.from));
        await TeamRunApp.selectTabAsync(page, site.behindNameOf(step), site.urlOf(step.to));
      }
      await site.expectShownAsync(app.electronApp, page, step.to, LinkedSite.openedNameOf(step));
      await testInfo.attach(`new-tab-${step.to.toLowerCase()}`, { body: await page.screenshot(), contentType: "image/png" });
    }

    expect(app.quit()).toContain("\"outcome\":\"Quit\"");
    expect(await app.waitForExitAsync()).toBe(0);
  }
  finally {
    await site.closeAsync();
  }
});
