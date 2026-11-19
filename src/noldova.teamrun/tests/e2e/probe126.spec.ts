/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { readFileSync } from "node:fs";

import { expect } from "playwright/test";

import { CodexDouble } from "./fixtures/codex-double.ts";
import { TeamRunApp, test } from "./fixtures/teamrun-app.fixture.ts";
import { TerminalScreen } from "./fixtures/terminal-screen.ts";

const readTyped = (file: string): string => {
  try {
    return readFileSync(file, "utf8").trim();
  }
  catch {
    return "";
  }
};

const sizeOf = (): string => {
  const screen = document.querySelector("nol-teamrun-inline-terminal .xterm-screen")?.getBoundingClientRect();
  return `${innerWidth}x${innerHeight}/${document.querySelectorAll("nol-teamrun-inline-terminal .xterm-rows > div").length}r${Math.round(screen?.width ?? 0)}x${Math.round(screen?.height ?? 0)}`;
};

test("probe126 sizes while typing as the spec types", async ({ app }) => {
  const page = await app.openChatAsync();
  await page.setViewportSize({ width: 1440, height: 900 });
  const first = app.pidFile("probe-first");
  const second = app.pidFile("probe-second");
  const typed = app.pidFile("probe-typed");
  const slash = (file: string): string => file.replaceAll("\\", "/");
  await app.sendAsync(`${CodexDouble.REPLY_PREFIX}First:\n\n\`\`\`bash\necho $$ > '${slash(first)}'\n\`\`\`\n\nThen:\n\n\`\`\`bash\necho $$ > '${slash(second)}'\n\`\`\``);
  const runs = page.getByRole("button", { name: /^Run bash command/ });
  await expect(runs).toHaveCount(2, { timeout: 60_000 });
  const sizes: string[] = [await page.evaluate(sizeOf)];
  await runs.nth(1).click();
  await expect.poll(() => TeamRunApp.readPid(second), TeamRunApp.pollOf(60_000)).not.toBeNull();
  await expect.poll(() => page.evaluate(() => document.activeElement?.matches("nol-teamrun-inline-terminal .xterm-helper-textarea") === true), TeamRunApp.pollOf(30_000)).toBe(true);
  sizes.push(`focus:${await page.evaluate(sizeOf)}`);
  for (const key of `echo typed-$((6*7)) > '${slash(typed)}'`) {
    await page.keyboard.type(key);
    sizes.push(await page.evaluate(sizeOf));
  }
  await page.keyboard.press("Enter");
  await expect.poll(() => readTyped(typed), TeamRunApp.pollOf(15_000)).toBe("typed-42").catch(() => undefined);
  const changes = sizes.map((t, index) => index === 0 || t !== sizes[index - 1] ? `${index}:${t}` : "").filter(t => t !== "");
  const screen = await app.electronApp.evaluate(({ screen: shown }) => JSON.stringify(shown.getPrimaryDisplay().workArea)).catch(() => "?");
  console.log(`PROBE126 file="${readTyped(typed)}" workArea=${screen} sizes ${changes.join(" ")}\n${(await TerminalScreen.rowsAsync(page.locator("nol-teamrun-inline-terminal .xterm-rows"))).filter(t => t.trim() !== "").join("\n")}\nPROBE126-END`);
});
