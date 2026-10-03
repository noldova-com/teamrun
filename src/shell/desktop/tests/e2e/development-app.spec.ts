/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { readlinkSync } from "node:fs";
import path from "node:path";

import { DataDirectory, DiscoveryReader } from "@noldova/teamrun-shell-runtime";

import { expect, test } from "./fixtures/desktop-test.fixture.ts";
import ProcessListFixture from "./fixtures/process-list.fixture.ts";

test.describe("the development app", () => {
  const programs: Readonly<Record<string, string>> = { win32: "TeamRun.exe", darwin: "TeamRun", linux: "teamrun" };
  const processNames: Readonly<Record<string, RegExp>> = { win32: /^TeamRun\.exe$/, darwin: /^TeamRun(?: Helper(?: \([A-Za-z]+\))?)?$/, linux: /^teamrun$/ };

  test("TeamRun, its helpers and its runtime run from the development app as TeamRun, never as Electron", async ({ desktop }) => {
    await expect.poll(() => desktop.isVisibleAsync()).toBe(true);

    const program = await desktop.application.evaluate(() => process.execPath);
    const discovery = await DiscoveryReader.readAsync(new DataDirectory(desktop.dataDirectory));
    const runtime = discovery?.processId ?? 0;
    const processIds = [...new Set([...await desktop.application.evaluate(({ app }) => app.getAppMetrics().map(t => t.pid)), runtime])];
    const names = ProcessListFixture.readNames(processIds);

    expect(path.basename(program)).toBe(programs[process.platform]);
    expect(program).toContain(path.join("_build", "development-app"));
    expect(discovery?.executablePath).toBe(program);
    expect(await desktop.application.evaluate(({ app }) => [app.isPackaged, process.defaultApp === true])).toEqual([true, true]);
    expect([...names.keys()].sort((a, b) => a - b)).toEqual([...processIds].sort((a, b) => a - b));
    for (const name of names.values()) {
      expect(name.toLowerCase()).not.toContain("electron");
      expect(path.basename(name)).toMatch(processNames[process.platform] ?? /^$/);
    }
    if (process.platform === "linux")
      for (const processId of [desktop.application.process().pid ?? 0, runtime])
        expect(readlinkSync(`/proc/${processId}/exe`)).toBe(program);
  });
});
