/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import "@noldova/context.core";
import { expect, test } from "playwright/test";

import { PowershellCommands } from "./fixtures/powershell-commands.ts";
import { SystemContrast } from "./fixtures/system-contrast.ts";
import { WindowsScriptChecks } from "./fixtures/windows-script-checks.ts";

const SAID = "e2e-ran";
const ON = 1;
const DIGITS = /^\d+$/;

test.describe("PowerShell the specs type and run", () => {
  test.skip(process.platform !== "win32", "The specs run this PowerShell on Windows only.");

  test("the terminal specs' commands say, write, move and pause without loading a PowerShell module", () => {
    const folder = mkdtempSync(join(tmpdir(), "tre-powershell-"));
    try {
      const [pidFile, beat] = [join(folder, "program.pid"), join(folder, "program.beat")];
      const part = `${beat}.tmp`;
      const script = [PowershellCommands.say(SAID), PowershellCommands.write(pidFile, "$PID"), PowershellCommands.write(part, "1"), PowershellCommands.move(part, beat),
        PowershellCommands.write(part, "'typed-' + 42"), PowershellCommands.move(part, beat), PowershellCommands.pause(1)].join("; ");

      const answer = WindowsScriptChecks.answerOf(script);

      expect([answer.status, answer.lines, DIGITS.test(readFileSync(pidFile, "utf8")), readFileSync(beat, "utf8"), existsSync(part)])
        .toEqual([0, [SAID, WindowsScriptChecks.NO_MODULES], true, "typed-42", false]);
    }
    finally {
      rmSync(folder, { recursive: true, force: true });
    }
  });

  test("the High Contrast spec reads and writes the system's contrast setting without loading a PowerShell module", () => {
    const read = WindowsScriptChecks.answerOf(SystemContrast.SCRIPT, SystemContrast.environmentOf(null));
    const before = SystemContrast.of(read.lines[0] ?? String.empty);

    const written = WindowsScriptChecks.answerOf(SystemContrast.SCRIPT, SystemContrast.environmentOf(before));

    expect([read.status, read.lines.length, read.lines.at(-1), before.flags & ON, written.status, written.lines])
      .toEqual([0, 2, WindowsScriptChecks.NO_MODULES, SystemContrast.registeredFlags() & ON, 0, read.lines]);
  });
});
