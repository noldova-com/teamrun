/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ProcessCommand } from "@noldova/teamrun.providers";

export class FakeCodesign {
  private readonly log: string;

  public readonly command: ProcessCommand;

  private constructor(log: string, command: ProcessCommand) {
    this.log = log;
    this.command = command;
  }

  public get calls(): readonly { readonly args: readonly string[]; readonly entitlements: string; readonly server: string }[] {
    return existsSync(this.log) ? readFileSync(this.log, "utf8").trim().split("\n").map(t => JSON.parse(t)) : [];
  }

  public static create(directory: string, exitCode: number = 0): FakeCodesign {
    const log = join(directory, "codesign-calls.jsonl");
    const script = join(directory, "fake-codesign.cjs");
    writeFileSync(script, `const fs = require("node:fs");
const args = process.argv.slice(2);
const server = args.at(-1);
fs.appendFileSync(${JSON.stringify(log)}, JSON.stringify({ args, entitlements: fs.readFileSync(args.at(-2), "utf8"), server: fs.readFileSync(server, "utf8") }) + "\\n");
fs.appendFileSync(server, "+signed");
process.exit(${exitCode});
`);
    return new FakeCodesign(log, new ProcessCommand(process.execPath, [script]));
  }
}
