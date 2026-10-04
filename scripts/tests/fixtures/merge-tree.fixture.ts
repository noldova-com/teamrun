/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import path from "node:path";

import ProcessResult from "../../processes/process-result.ts";
import ProcessRunner from "../../processes/process-runner.ts";

export default class MergeTreeFixture extends ProcessRunner {
  private static readonly TREE: string = "a".repeat(40);
  private static readonly PULL_PATTERN: RegExp = /^\+refs\/pull\/(\d+)\/head:/;

  private readonly conflicts: Map<number, readonly string[]> = new Map<number, readonly string[]>();
  private readonly failures: Map<number, Error | null> = new Map<number, Error | null>();
  private fetched: number = 0;

  public readonly commands: string[] = [];

  public conflict(number: number, files: readonly string[]): void {
    this.conflicts.set(number, files);
  }

  public fail(number: number, error: Error | null = null): void {
    this.failures.set(number, error);
  }

  public override async captureAsync(command: string, commandArguments: readonly string[]): Promise<ProcessResult> {
    if (path.parse(command).name !== "git")
      throw new Error(`Unexpected command ${command} ${commandArguments.join(" ")}.`);
    this.commands.push(commandArguments.join(" "));
    const pull = commandArguments.map(t => MergeTreeFixture.PULL_PATTERN.exec(t)?.[1]).find(t => t !== undefined);
    if (pull !== undefined) {
      this.fetched = Number(pull);
      const failure = this.failures.get(this.fetched);
      if (failure !== undefined && failure !== null)
        throw failure;
      return failure === null ? new ProcessResult(128, "", "fatal: couldn't find remote ref\n") : new ProcessResult(0, "", "");
    }
    const files = this.conflicts.get(this.fetched) ?? [];
    return new ProcessResult(files.length === 0 ? 0 : 1, `${MergeTreeFixture.TREE}\0${files.map(t => `${t}\0`).join("")}`, "");
  }
}
