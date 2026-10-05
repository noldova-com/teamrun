/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { readFile } from "node:fs/promises";

export default class DesktopLogFixture {
  private static readonly ENTRY: RegExp = /^\d{4}-\d{2}-\d{2}T\S+ /;
  private static readonly MAIN_PROCESS_FAILURE: RegExp = /^\S+ The desktop(?:'s main process failed| could not ask what to do after its main process failed)/;

  public static async describeMainProcessFailuresAsync(file: string): Promise<string> {
    let log: string;
    try {
      log = await readFile(file, "utf8");
    }
    catch (error) {
      return `The desktop log could not be read (${(error as NodeJS.ErrnoException).code ?? "no error code"}).`;
    }
    const failures = DesktopLogFixture.readEntries(log).filter(t => DesktopLogFixture.MAIN_PROCESS_FAILURE.test(t));
    if (failures.length === 0)
      return "The desktop log shows no main-process failure.";
    return `The desktop log shows ${failures.length === 1 ? "this main-process failure" : "these main-process failures"}:\n${failures.join("\n")}`;
  }

  private static readEntries(log: string): string[] {
    const entries: string[] = [];
    for (const line of log.split("\n"))
      if (DesktopLogFixture.ENTRY.test(line))
        entries.push(line);
      else if (entries.length > 0)
        entries[entries.length - 1] += `\n${line}`;
    return entries.map(t => t.trimEnd());
  }
}
