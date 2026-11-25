/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdir, readFile, rm } from "node:fs/promises";
import path from "node:path";
import type { Writable } from "node:stream";

import "@noldova/context.core";

import type { ProcessEnd } from "../processes/process-end.ts";
import type { ProcessRunner } from "../processes/process-runner.ts";
import { ProcessTimeoutException } from "../processes/process-timeout.exception.ts";

export class ChildStage {
  private readonly root: string;
  private readonly runner: ProcessRunner;
  private readonly script: string;
  private readonly results: string;
  private readonly log: string;
  private readonly limit: number;

  public constructor(root: string, runner: ProcessRunner, script: string, results: string, log: string, limit: number) {
    this.root = root;
    this.runner = runner;
    this.script = script;
    this.results = results;
    this.log = log;
    this.limit = limit;
  }

  public async runAsync(titles: readonly string[], output: Writable): Promise<readonly boolean[]> {
    await rm(this.results, { force: true });
    await mkdir(path.dirname(this.results), { recursive: true });
    await mkdir(path.dirname(this.log), { recursive: true });
    const end = await this.runner.runLoggedToEndAsync(process.execPath, [this.script, this.results], this.root, this.log, output, output, process.env, this.limit)
      .catch((t: unknown): null => {
        if (t instanceof ProcessTimeoutException)
          return null;
        throw t;
      });
    const results = end?.isSuccessful === true ? await this.readAsync(titles.length) : null;
    if (!Object.isNull(results))
      return results;
    output.write(`The ${titles.length} checks ran in a process of their own, which ${ChildStage.describe(end, this.limit)}; its output is above and in ${path.relative(this.root, this.log)}.\n`);
    return titles.map(() => false);
  }

  private static describe(end: ProcessEnd | null, limit: number): string {
    if (Object.isNull(end))
      return `was stopped at its limit of ${limit / 1000} s`;
    return end.isSuccessful ? `ended ${end.describe()} without their results` : `ended ${end.describe()}, so their results don't count`;
  }

  private async readAsync(count: number): Promise<readonly boolean[] | null> {
    let parsed: unknown;
    try {
      parsed = JSON.parse(await readFile(this.results, "utf8"));
    }
    catch {
      return null;
    }
    if (!Array.isArray(parsed))
      return null;
    const listed: readonly unknown[] = parsed;
    return listed.length === count && listed.every((t): t is boolean => Object.isBoolean(t)) ? listed : null;
  }
}
