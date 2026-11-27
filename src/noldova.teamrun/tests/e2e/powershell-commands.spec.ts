/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import "@noldova/context.core";
import { expect, test } from "playwright/test";

import { PowershellCommands } from "./fixtures/powershell-commands.ts";
import { SystemContrast } from "./fixtures/system-contrast.ts";

const MODULES = "modules ";
const NO_MODULES = `${MODULES}0`;
const SAID = "e2e-ran";
const ON = 1;
const CONTRAST_KEY = "HKCU\\Control Panel\\Accessibility\\HighContrast";
const FLAGS_LINE = /^\s*Flags\s+REG_SZ\s+(\d+)\s*$/m;
const LINE_BREAK = /\r?\n/;

const answerOf = (script: string, environment: NodeJS.ProcessEnv = process.env): readonly [number | null, readonly string[]] => {
  const result = spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", `${script}; '${MODULES}' + @(Get-Module).Count`],
    { encoding: "utf8", env: environment });
  return [result.status, result.stdout.split(LINE_BREAK).filter(t => t !== "")];
};

const registryFlags = (): number => Number(FLAGS_LINE.exec(spawnSync("reg", ["query", CONTRAST_KEY, "/v", "Flags"], { encoding: "utf8" }).stdout)?.[1]);

test.describe("PowerShell the specs type and run", () => {
  test.skip(process.platform !== "win32", "The specs run this PowerShell on Windows only.");

  test("the terminal specs' commands say, write, move and pause without loading a PowerShell module", () => {
    const folder = mkdtempSync(join(tmpdir(), "tre-powershell-"));
    try {
      const [pidFile, beat] = [join(folder, "program.pid"), join(folder, "program.beat")];
      const part = `${beat}.tmp`;
      const script = [PowershellCommands.say(SAID), PowershellCommands.write(pidFile, "$PID"), PowershellCommands.write(part, "1"), PowershellCommands.move(part, beat),
        PowershellCommands.write(part, "'typed-' + 42"), PowershellCommands.move(part, beat), PowershellCommands.pause(1)].join("; ");

      const [status, lines] = answerOf(script);

      expect([status, lines, /^\d+$/.test(readFileSync(pidFile, "utf8")), readFileSync(beat, "utf8"), existsSync(part)])
        .toEqual([0, [SAID, NO_MODULES], true, "typed-42", false]);
    }
    finally {
      rmSync(folder, { recursive: true, force: true });
    }
  });

  test("the High Contrast spec reads and writes the system's contrast setting without loading a PowerShell module", () => {
    const [readStatus, read] = answerOf(SystemContrast.SCRIPT, SystemContrast.environmentOf(null));
    const before = SystemContrast.of(read[0] ?? String.empty);

    const [writtenStatus, written] = answerOf(SystemContrast.SCRIPT, SystemContrast.environmentOf(before));

    expect([readStatus, read.length, read.at(-1), before.flags & ON, writtenStatus, written]).toEqual([0, 2, NO_MODULES, registryFlags() & ON, 0, read]);
  });
});
