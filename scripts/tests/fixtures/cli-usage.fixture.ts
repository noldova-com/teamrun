/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";

import TeamRunCommand from "../../desktop/teamrun.ts";
import SourceTreeFixture from "./source-tree.fixture.ts";

export default class CliUsageFixture {
  private static readonly COMMAND_ROW: RegExp = /^ {2}([a-z]+)\b/;
  private static readonly OPTION_ROW: RegExp = /^ {2}--([a-z-]+)\b/;
  private static readonly TIME_LIMIT: number = 30_000;

  public static readOwnCommands(): readonly string[] {
    return CliUsageFixture.readSection("Commands:", CliUsageFixture.COMMAND_ROW);
  }

  public static readGlobalOptions(): readonly string[] {
    return CliUsageFixture.readSection("Options:", CliUsageFixture.OPTION_ROW);
  }

  private static readSection(title: string, row: RegExp): readonly string[] {
    const result = spawnSync(process.execPath, [path.join(SourceTreeFixture.root, ...TeamRunCommand.ENTRY_SEGMENTS), "help"],
      { cwd: SourceTreeFixture.root, encoding: "utf8", timeout: CliUsageFixture.TIME_LIMIT });
    assert.equal(result.status, 0, result.stderr);
    const lines = result.stdout.replaceAll("\r\n", "\n").split("\n");
    const start = lines.indexOf(title) + 1;
    assert.ok(start > 0, result.stdout);
    const end = lines.indexOf("", start);
    return lines.slice(start, end).map(t => row.exec(t)?.[1]).filter(t => t !== undefined);
  }
}
