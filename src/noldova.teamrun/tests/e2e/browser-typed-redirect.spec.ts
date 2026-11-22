/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { createServer, type Server } from "node:http";

import { expect } from "playwright/test";

import { LocalServer } from "./fixtures/local-server.ts";
import { test } from "./fixtures/teamrun-app.fixture.ts";

const FIRST_SITE: string = "first.localhost";
const SECOND_SITE: string = "second.localhost";
const UNNAMED_SITE: string = "third.localhost";
const BROWSER_BUTTON: string = "nol-window-row [data-nol-item=\"teamrun.chatPage\"]";
const LANDED_PAGE: string = "<!doctype html><title>Landed</title><h1>The second site</h1>";

const serveAsync = async (requests: string[]): Promise<Server> => {
  const server = createServer((request, response) => {
    const host = request.headers.host ?? "";
    requests.push(`${host}${request.url ?? ""}`);
    if (host.startsWith(`${FIRST_SITE}:`)) {
      const target = request.url === "/elsewhere" ? `http://${host.replace(FIRST_SITE, UNNAMED_SITE)}/` : `http://${host.replace(FIRST_SITE, SECOND_SITE)}/landed`;
      response.writeHead(302, { location: target });
      response.end();
      return;
    }
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end(LANDED_PAGE);
  });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  return server;
};

test("an address the person types on a site Settings names lands on the second named site it redirects to, and a redirect to a site Settings doesn't name shows why it isn't opened", async ({ app }, testInfo) => {
  const requests: string[] = [];
  const server = await serveAsync(requests);
  try {
    const address = server.address();
    const port = typeof address === "object" && address !== null ? address.port : 0;
    expect(port).toBeGreaterThan(0);
    const first = `http://${FIRST_SITE}:${port}`;
    const second = `http://${SECOND_SITE}:${port}`;
    const unnamed = `http://${UNNAMED_SITE}:${port}`;
    const page = await app.openChatAsync();
    await app.nameLocalSitesAsync(`${first}, ${second}`);
    await page.locator(BROWSER_BUTTON).click();
    await expect(page.getByRole("tab", { name: "New tab", exact: true })).toHaveAttribute("aria-selected", "true", { timeout: 60_000 });
    const field = page.locator(".nol-browser-toolbar-field");

    await field.fill(`${first}/`);
    await field.press("Enter");

    await expect(field).toHaveValue(`${second}/landed`, { timeout: 60_000 });
    await expect(page.getByRole("tab", { name: "Landed", exact: true })).toBeVisible({ timeout: 60_000 });
    await expect(page.getByRole("heading", { name: /^Can't reach / })).toHaveCount(0);
    expect(requests).toEqual(expect.arrayContaining([`${FIRST_SITE}:${port}/`, `${SECOND_SITE}:${port}/landed`]));
    await testInfo.attach("landed", { body: await page.screenshot(), contentType: "image/png" });

    await field.fill(`${first}/elsewhere`);
    await field.press("Enter");

    await expect(page.getByRole("heading", { name: `TeamRun's browser doesn't open ${unnamed}`, exact: true })).toBeVisible({ timeout: 60_000 });
    expect(requests).toContain(`${FIRST_SITE}:${port}/elsewhere`);
    expect(requests.filter(t => t.startsWith(`${UNNAMED_SITE}:`))).toEqual([]);
    await testInfo.attach("not-allowed", { body: await page.screenshot(), contentType: "image/png" });
    expect(app.unexpectedFailures).toEqual([]);
  }
  finally {
    await LocalServer.closeAsync(server);
  }
});
