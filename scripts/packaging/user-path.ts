/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type ProcessRunner from "../processes/process-runner.ts";
import PackagingException from "./packaging.exception.ts";

export default class UserPath {
  private static readonly REGISTRY: string = "reg.exe";
  private static readonly QUERY: readonly string[] = ["query", "HKCU\\Environment", "/v", "Path"];
  private static readonly MISSING_EXIT_CODE: number = 1;
  private static readonly LIMIT: number = 30_000;
  private static readonly VALUE: RegExp = /^ {4}Path {4}REG_(?:EXPAND_)?SZ {4}([^\r\n]*)$/im;
  private static readonly SEPARATOR: string = ";";

  private readonly runner: ProcessRunner;
  private readonly folder: string;

  public constructor(runner: ProcessRunner, folder: string) {
    this.runner = runner;
    this.folder = folder;
  }

  public static count(value: string | null, entry: string): number {
    return (value ?? "").split(UserPath.SEPARATOR).filter(t => t.toLowerCase() === entry.toLowerCase()).length;
  }

  public async readAsync(): Promise<string | null> {
    const result = await this.runner.captureAsync(UserPath.REGISTRY, UserPath.QUERY, this.folder, UserPath.LIMIT);
    if (result.exitCode === UserPath.MISSING_EXIT_CODE)
      return null;
    const [, value] = UserPath.VALUE.exec(result.output) ?? [];
    if (!result.isSuccessful || value === undefined)
      throw new PackagingException(`${UserPath.REGISTRY} ${UserPath.QUERY.join(" ")} did not answer with the user's Path; it exited with ${result.exitCode}:\n${result.text}`);
    return value;
  }
}
