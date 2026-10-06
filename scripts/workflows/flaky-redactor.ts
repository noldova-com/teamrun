/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export default class FlakyRedactor {
  public static readonly RUNNER_HOMES: readonly string[] = ["C:\\Users\\runneradmin", "/home/runner", "/Users/runner"];

  private static readonly PATH_SEPARATOR: RegExp = /[\\/]/;
  private static readonly PATH_SEPARATOR_SOURCE: string = "[\\\\/]";
  private static readonly SYNTAX: RegExp = /[.*+?^${}()|[\]\\]/g;
  private static readonly OPAQUE_VALUE: RegExp = /[A-Za-z0-9+_=-]{32,}/g;
  private static readonly HOME: string = "~";
  private static readonly REDACTED: string = "[redacted]";

  private readonly homeFolders: readonly RegExp[];

  public constructor(homeFolders: readonly string[]) {
    this.homeFolders = homeFolders.map(t => new RegExp(t.split(FlakyRedactor.PATH_SEPARATOR).map(u => u.replace(FlakyRedactor.SYNTAX, "\\$&")).join(FlakyRedactor.PATH_SEPARATOR_SOURCE), "gi"));
  }

  public redact(text: string): string {
    return this.homeFolders.reduce((result, t) => result.replace(t, FlakyRedactor.HOME), text).replace(FlakyRedactor.OPAQUE_VALUE, FlakyRedactor.REDACTED);
  }
}
