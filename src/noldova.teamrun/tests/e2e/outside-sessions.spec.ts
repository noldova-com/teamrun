/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { closeSync, openSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { type Locator, type Page, expect } from "playwright/test";

import { test } from "./fixtures/teamrun-app.fixture.ts";

const SETTING_TEXT: RegExp = /^Lets a coding agent running outside TeamRun/;
const MESSAGE: string = "A message from outside after a restart";
const PORT_LOW: number = 20_000;
const PORT_HIGH: number = 32_767;
const PORT_ATTEMPTS: number = 20;

const isFreeAsync = (port: number): Promise<boolean> => new Promise(resolve => {
  const server = createServer();
  server.once("error", () => resolve(false));
  server.listen(port, "127.0.0.1", () => server.close(() => resolve(true)));
});

interface IPortReservation {
  readonly port: number;
  readonly lock: string;
}

const createsLock = (lock: string): boolean => {
  try {
    closeSync(openSync(lock, "wx"));
    return true;
  }
  catch (error: unknown) {
    if (error instanceof Error && "code" in error && error.code === "EEXIST")
      return false;
    throw error;
  }
};

const reservePortAsync = async (): Promise<IPortReservation> => {
  for (let attempt = 0; attempt < PORT_ATTEMPTS; attempt++) {
    const port = PORT_LOW + Math.floor(Math.random() * (PORT_HIGH - PORT_LOW + 1));
    const lock = join(tmpdir(), `teamrun-e2e-outside-port-${port}.lock`);
    if (!createsLock(lock))
      continue;
    if (await isFreeAsync(port))
      return { port, lock };
    rmSync(lock, { force: true });
  }
  throw new Error(`No free port in ${PORT_LOW}-${PORT_HIGH} after ${PORT_ATTEMPTS} attempts.`);
};

const settingsSearchAsync = async (page: Page, name: string): Promise<void> => {
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("searchbox", { name: "Search settings", exact: true }).fill(name);
};

const connectionOfAsync = async (page: Page): Promise<Locator> => {
  await settingsSearchAsync(page, "teamrun.connectOutsideAgents");
  await page.getByRole("button", { name: "Connect outside agents", exact: true }).click();
  const connection = page.locator("nol-teamrun-outside-connection-view");
  await expect(connection.locator(".nol-teamrun-show-token")).toBeVisible({ timeout: 180_000 });
  await connection.locator(".nol-teamrun-show-token").click();
  await expect(connection.locator(".nol-teamrun-show-token")).toHaveAttribute("aria-pressed", "true");
  return connection;
};

const callAsync = async (url: string, token: string, name: string, input: object): Promise<string> => {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json, text/event-stream", authorization: `Bearer ${token}` },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: input } })
  });
  const body = await response.text();
  expect(response.status).toBe(200);
  expect(body).not.toContain("\"isError\":true");
  return body;
};

test("an outside agent sends a teammate a message with the kept token after a restart, and the page shows no failure",
  async ({ app }, testInfo) => {
    const page = await app.openChatAsync();
    const { port, lock } = await reservePortAsync();
    try {
      await settingsSearchAsync(page, "teamrun.outsidePort");
      const portField = page.getByRole("spinbutton", { name: "Outside port", exact: true });
      await portField.fill(String(port));
      await portField.blur();
      await expect(portField).toHaveValue(String(port));
      await settingsSearchAsync(page, "teamrun.outsideSessions");
      await page.getByRole("checkbox", { name: SETTING_TEXT }).click();
      await expect(page.getByRole("checkbox", { name: SETTING_TEXT })).toBeChecked();
      const before = await connectionOfAsync(page);
      await expect(before.locator(".nol-teamrun-outside-state td").first()).toHaveText("On", { timeout: 180_000 });
      await expect(before.locator(".nol-teamrun-outside-token code")).toHaveText(/^[A-Za-z0-9_-]{43}$/);
      const token = (await before.locator(".nol-teamrun-outside-token code").textContent())?.trim() ?? "";
      await expect(before.locator(".nol-teamrun-outside-address code")).toHaveText(`http://127.0.0.1:${port}/mcp`);

      const runtimes = (): string => `${new Date().toISOString()} ${app.runtimeProcesses().map(t => t.pid).join(" ")}`;
      const notes = [`before quit: ${runtimes()}`];
      const quit = app.quit();
      notes.push(`quit: ${quit}`, `after quit: ${runtimes()}`);
      const exit = await app.waitForExitAsync();
      notes.push(`app exit ${exit}: ${runtimes()}`);
      const restarted = await app.startAsync();
      notes.push(`started again: ${runtimes()}`);
      process.stdout.write(`runtimes:\n${notes.join("\n")}\n`);
      await testInfo.attach("runtimes.txt", { body: notes.join("\n"), contentType: "text/plain" });
      for (const seconds of [5, 15, 60])
        setTimeout(() => process.stdout.write(`runtimes ${seconds} s after the start: ${runtimes()}\n`), seconds * 1_000).unref();
      expect(quit).toContain("\"outcome\":\"Quit\"");
      expect(exit).toBe(0);
      const after = await connectionOfAsync(restarted);

      await expect(after.locator(".nol-teamrun-outside-state td").first()).toHaveText("On", { timeout: 180_000 });
      await expect(after.locator(".nol-teamrun-outside-token code")).toHaveText(token);
      const url = (await after.locator(".nol-teamrun-outside-address code").textContent())?.trim() ?? "";
      expect(url).toBe(`http://127.0.0.1:${port}/mcp`);
      await testInfo.attach("outside-after-restart", { body: await restarted.screenshot(), contentType: "image/png" });
      const teammate = /\\"id\\":\\"([^\\"]+)\\"/.exec(await callAsync(url, token, "teamrun_list_teammates", {}))?.[1];
      expect(teammate).toBeDefined();
      const sent = await callAsync(url, token, "teamrun_send_message", { teammate_id: teammate, text: MESSAGE, from: "Live check" });
      expect(sent).toMatch(/\\"message_id\\":\\"[A-Za-z0-9_-]{22}\\"/);
      await app.snapshotAsync(testInfo, "after-send");
      expect(app.unexpectedFailures).toEqual([]);
    }
    finally {
      rmSync(lock, { force: true });
    }
  });
