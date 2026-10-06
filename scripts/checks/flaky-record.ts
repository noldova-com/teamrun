/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import { appendFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Writable } from "node:stream";

import FlakyRecordException from "./flaky-record.exception.ts";
import FlakyTest from "./flaky-test.ts";

export default class FlakyRecord {
  public static readonly RECORD_SEGMENTS: readonly string[] = ["_build", "flaky-tests.json"];
  public static readonly MAXIMUM_FAILURE_LINES: number = 20;
  public static readonly MAXIMUM_FAILURE_LENGTH: number = 2000;

  private static readonly ENCODING: BufferEncoding = "utf8";
  private static readonly SUMMARY_VARIABLE: string = "GITHUB_STEP_SUMMARY";
  private static readonly ELLIPSIS: string = "…";
  private static readonly FIELDS: readonly string[] = ["runner", "file", "name", "failure"];
  private static readonly MALFORMED: string = "The flaky test record is not a list of tests with a runner, a file, a name and a failure.";
  private static readonly SUMMARY_HEADER: string = "### Flaky tests\n\nThese tests failed, then passed when they ran again in the same job.\n\n| Runner | Test | File | Failure |\n|---|---|---|---|\n";

  private readonly file: string;
  private readonly environment: NodeJS.ProcessEnv;

  public constructor(root: string, environment: NodeJS.ProcessEnv) {
    this.file = path.join(root, ...FlakyRecord.RECORD_SEGMENTS);
    this.environment = environment;
  }

  public static parse(text: string): readonly FlakyTest[] {
    let value: unknown;
    try {
      value = JSON.parse(text);
    }
    catch (error) {
      throw new FlakyRecordException(FlakyRecord.MALFORMED, { cause: error });
    }
    if (!Array.isArray(value))
      throw new FlakyRecordException(FlakyRecord.MALFORMED);
    return value.map(t => {
      if (typeof t !== "object" || t === null || FlakyRecord.FIELDS.some(u => typeof (t as Record<string, unknown>)[u] !== "string"))
        throw new FlakyRecordException(FlakyRecord.MALFORMED);
      const fields = t as Record<string, string>;
      return new FlakyTest(String(fields["runner"]), String(fields["file"]), String(fields["name"]), String(fields["failure"]));
    });
  }

  public static cap(failure: string): string {
    const lines = failure.split("\n").slice(0, FlakyRecord.MAXIMUM_FAILURE_LINES).join("\n");
    return lines.length <= FlakyRecord.MAXIMUM_FAILURE_LENGTH ? lines : `${lines.slice(0, FlakyRecord.MAXIMUM_FAILURE_LENGTH - 1)}${FlakyRecord.ELLIPSIS}`;
  }

  public async clearAsync(): Promise<void> {
    await rm(this.file, { force: true });
  }

  public async readAsync(): Promise<readonly FlakyTest[]> {
    return existsSync(this.file) ? FlakyRecord.parse(await readFile(this.file, FlakyRecord.ENCODING)) : [];
  }

  public async addAsync(tests: readonly FlakyTest[], output: Writable): Promise<void> {
    if (tests.length === 0)
      return;
    const recorded = await this.readAsync();
    const added = tests.map(t => new FlakyTest(t.runner, t.file, t.name, FlakyRecord.cap(t.failure)));
    await mkdir(path.dirname(this.file), { recursive: true });
    await writeFile(this.file, `${JSON.stringify([...recorded, ...added], null, 2)}\n`);
    output.write(`Flaky, passed when run again: ${added.map(t => `${t.name} (${t.file})`).join(", ")}\n`);
    const summary = this.environment[FlakyRecord.SUMMARY_VARIABLE];
    if (summary !== undefined)
      await appendFile(summary, `${FlakyRecord.SUMMARY_HEADER}${added.map(t => `| ${FlakyRecord.escape(t.runner)} | ${FlakyRecord.escape(t.name)} | ${FlakyRecord.escape(t.file)} | ${FlakyRecord.escape(t.failure.split("\n", 1).join(""))} |\n`).join("")}\n`);
  }

  private static escape(text: string): string {
    return text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll("|", "&#124;").replaceAll("`", "&#96;").replaceAll("\n", " ");
  }
}
