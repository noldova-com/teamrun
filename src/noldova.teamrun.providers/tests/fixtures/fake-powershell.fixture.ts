/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { writeFileSync } from "node:fs";
import { join } from "node:path";

export class FakePowershell {
  private static readonly SCRIPT: string = `const readline = require("node:readline");
const eol = String.fromCharCode(10);
const answer = line => {
  if (line === "hang")
    return new Promise(() => undefined);
  if (line === "exit")
    process.exit(0);
  if (line === "pid")
    process.stdout.write(String(process.pid) + eol);
  else if (line === "noise")
    process.stderr.write("x".repeat(1048576));
  else if (line === "many")
    process.stdout.write(Array.from({ length: 20000 }, (_, index) => "line " + index).join(eol) + eol);
  else if (line.startsWith("env "))
    process.stdout.write((process.env[line.slice(4)] ?? "") + eol);
  else if (line.startsWith("'") && line.endsWith("'"))
    process.stdout.write(line.slice(1, -1) + eol);
  else
    process.stdout.write("ran " + line + eol);
  return Promise.resolve();
};
let answered = Promise.resolve();
readline.createInterface({ input: process.stdin }).on("line", line => { answered = answered.then(() => answer(line)); });
`;

  public static create(directory: string): string {
    const script = join(directory, "fake-powershell.cjs");
    writeFileSync(script, FakePowershell.SCRIPT);
    return script;
  }
}
