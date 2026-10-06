/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import path from "node:path";
import { Transform, type TransformCallback } from "node:stream";
import type { TestEvent } from "node:test/reporters";

import type IRunnerSkip from "./interfaces/runner-skip.ts";
import TestNames from "./test-names.ts";

export default class ScriptTestReporter extends Transform {
  private static readonly CANCELLED: string = "cancelledByParent";
  private static readonly SUITE: string = "suite";
  private static readonly NO_REASON: string = "No reason given.";
  private static readonly TODO: string = "To do";

  private readonly root: string;
  private readonly names: Map<string, string[]> = new Map();
  private readonly files: Set<string> = new Set();
  private readonly tested: Set<string> = new Set();
  private readonly tests: TestNames = new TestNames();
  private readonly skips: IRunnerSkip[] = [];
  private passed: number = 0;
  private failed: number = 0;
  private skipped: number = 0;
  private unreached: number = 0;

  public constructor(root: string = process.cwd()) {
    super({ writableObjectMode: true });
    this.root = root;
  }

  public override _transform(event: TestEvent, _encoding: BufferEncoding, done: TransformCallback): void {
    if (event.type === "test:start" && event.data.file !== undefined) {
      const file = this.relate(event.data.file);
      const names = this.names.get(file) ?? [];
      names.length = event.data.nesting;
      names.push(event.data.name);
      this.names.set(file, names);
      this.files.add(file);
    }
    else if ((event.type === "test:pass" || event.type === "test:fail") && event.data.file !== undefined && event.data.details.type !== ScriptTestReporter.SUITE)
      this.count(event, this.relate(event.data.file));
    done();
  }

  public override _flush(done: TransformCallback): void {
    this.push(JSON.stringify({ passed: this.passed, failed: this.failed, skipped: this.skipped, unreached: this.unreached, skips: this.skips, files: [...this.files].sort(), duplicates: this.tests.duplicates, empty: [...this.files].filter(t => !this.tested.has(t)).sort() }));
    done();
  }

  private count(event: TestEvent & { type: "test:pass" | "test:fail" }, file: string): void {
    const data = event.data;
    if (event.type === "test:pass" && data.nesting === 0 && data.name === file)
      return;
    const names = [...(this.names.get(file) ?? []).slice(0, data.nesting), data.name];
    this.tests.add(file, names);
    this.tested.add(file);
    if (data.todo !== undefined)
      this.skip(file, names, data.todo === true ? `${ScriptTestReporter.TODO}.` : `${ScriptTestReporter.TODO}: ${String(data.todo)}`);
    else if (data.skip !== undefined)
      this.skip(file, names, data.skip === true ? ScriptTestReporter.NO_REASON : String(data.skip));
    else if (event.type === "test:pass")
      this.passed++;
    else if ("failureType" in event.data.details.error && event.data.details.error.failureType === ScriptTestReporter.CANCELLED)
      this.unreached++;
    else
      this.failed++;
  }

  private skip(file: string, names: readonly string[], reason: string): void {
    this.skipped++;
    this.skips.push({ file, names, reason });
  }

  private relate(file: string): string {
    return path.relative(this.root, file).split(path.sep).join(path.posix.sep);
  }
}
