/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { appendFileSync } from "node:fs";

export class ProbeLog {
  public static async timed<T>(what: string, work: () => Promise<T>): Promise<T> {
    const begun = performance.now();
    const at = new Date().toISOString();
    try {
      const result = await work();
      ProbeLog.write(`${at} pid=${String(process.pid)} ${what} ${String(Math.round(performance.now() - begun))}ms ok ${ProbeLog.describe(result)}`);
      return result;
    }
    catch (error: unknown) {
      ProbeLog.write(`${at} pid=${String(process.pid)} ${what} ${String(Math.round(performance.now() - begun))}ms failed ${error instanceof Error ? `${error.name}: ${error.message}` : String(error)}`);
      throw error;
    }
  }

  private static describe(result: unknown): string {
    if (typeof result === "boolean")
      return String(result);
    if (typeof result === "string")
      return `${String(result.length)} chars`;
    if (result instanceof Map)
      return `${String(result.size)} rows`;
    return "";
  }

  private static write(line: string): void {
    const file = process.env["TEAMRUN_PROBE_TREE"];
    if (!Object.isUndefined(file) && file !== "")
      appendFileSync(file, line + "\n");
  }
}
