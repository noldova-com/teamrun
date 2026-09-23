/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export default class PlistCommandFixture {
  public static readonly calls: string[][] = [];
  public static fail: boolean = false;

  public static execute(command: string, args: string[], options: { timeout: number }, callback: (error: Error | null, stdout: string) => void): void {
    if (command !== "plutil" || options.timeout !== 30_000)
      throw new Error("Unexpected plist command.");
    PlistCommandFixture.calls.push(args);
    callback(PlistCommandFixture.fail ? new Error("fixture plist failure") : null, "");
  }
}
