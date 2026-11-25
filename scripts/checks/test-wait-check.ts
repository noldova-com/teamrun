/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Writable } from "node:stream";

import "@noldova/context.core";

import type { RepositoryFiles } from "../repository/repository-files.ts";
import { SourceFile } from "../structure/source-file.ts";
import { SourceTree } from "../structure/source-tree.ts";
import type { ICheck } from "./interfaces/i-check.ts";

export class TestWaitCheck implements ICheck {
  private static readonly CONTRACT_FILE: string = "README.md";
  private static readonly LIST_HEADER: string = "| Test file | Why it pauses |";
  private static readonly LIST_ROW: RegExp = /^\| `([^`]+)` \| .+ \|$/;
  private static readonly TABLE_ROW_PREFIX: string = "|";
  private static readonly SOURCE_FOLDER: string = "src/";
  private static readonly SOURCE_PATH: string = "scripts/checks/test-wait-check.ts";
  private static readonly PAUSES: readonly RegExp[] = [
    /\bimport\s*(?:\{[^}]*\b(?:setTimeout|scheduler)\b[^}]*\}|\*\s*as\s+[\w$]+|[\w$]+)\s*from\s*["'](?:node:)?timers\/promises["']/g,
    /\bscheduler\.wait\s*\(/g,
    /\bAtomics\.wait(?:Async)?\s*\(/g,
    /\bwaitForTimeout\s*\(/g,
    /(?<![.\w$])setTimeout\(\s*[A-Za-z_$][\w$]*\s*,/g,
    /(?<![.\w$])setTimeout\([^\n]*,\s*\d[\d_]*\s*\)/g,
    /\bnew\s+Promise\b(?:<[^>\n]*>)?\(\s*\(?\s*[A-Za-z_$][\w$]*\s*\)?\s*=>\s*\{?\s*setTimeout\s*\(/g
  ];
  private static readonly WINDOW_TESTS: string = "src/noldova.teamrun.window/tests/";
  private static readonly WAIT_FIXTURE: string = "src/noldova.teamrun.window/tests/fixtures/wait.fixture.ts";
  private static readonly VITEST_WAITS: readonly RegExp[] = [/(?<![\w$])waitFor(?![\w$])/g, /\[\s*(["'`])waitFor\1\s*\]/g];
  private static readonly SAMPLE_SPEC: string = "src/noldova.teamrun.window/tests/app/sample.spec.ts";
  private static readonly SAMPLES: readonly { readonly expectation: string; readonly file: string; readonly text: string; readonly lines: readonly number[] }[] = [
    { expectation: "it refuses vi.waitFor in a Window spec", file: TestWaitCheck.SAMPLE_SPEC, text: "const ready = 1;\nawait vi.waitFor(() => expect(ready).toBe(1));\n", lines: [2] },
    { expectation: `it allows vi.waitFor in ${TestWaitCheck.WAIT_FIXTURE}`, file: TestWaitCheck.WAIT_FIXTURE, text: "return vi.waitFor(check, { interval: 1 });\n", lines: [] },
    { expectation: "it allows vi.waitFor inside a string", file: TestWaitCheck.SAMPLE_SPEC, text: "const text = \"await vi.waitFor(check)\";\n", lines: [] },
    { expectation: "it refuses a waitFor taken from vi", file: TestWaitCheck.SAMPLE_SPEC, text: "const { waitFor } = vi;\nawait waitFor(check);\n", lines: [1, 2] },
    { expectation: "it refuses vi[\"waitFor\"]", file: TestWaitCheck.SAMPLE_SPEC, text: "await vi[\"waitFor\"](check);\n", lines: [1] },
    { expectation: "it allows vi.waitFor inside a comment", file: TestWaitCheck.SAMPLE_SPEC, text: "// await vi.waitFor(check);\n/*\nawait vi.waitFor(check);\n*/\n", lines: [] }
  ];
  private static readonly LINE_SEPARATOR: string = "\n";
  private static readonly LINE_COMMENT: string = "//";
  private static readonly BLOCK_COMMENT_START: string = "/*";
  private static readonly BLOCK_COMMENT_END: string = "*/";

  private readonly root: string;
  private readonly files: RepositoryFiles;

  public readonly title: string = "Test waits";

  public constructor(root: string, files: RepositoryFiles) {
    this.root = root;
    this.files = files;
  }

  public async runAsync(output: Writable): Promise<boolean> {
    const files = await this.files.listAsync();
    const listed = files.includes(TestWaitCheck.CONTRACT_FILE) ? await this.readListAsync() : new Map<string, number>();
    const testFiles = files.filter(t => TestWaitCheck.isTestFile(t));
    const pausing = new Set<string>();
    const findings: string[] = [];
    for (const file of testFiles) {
      const text = await readFile(path.join(this.root, file), "utf8");
      const lines = TestWaitCheck.findLines(text, TestWaitCheck.PAUSES);
      if (lines.length > 0)
        pausing.add(file);
      if (!listed.has(file))
        findings.push(...lines.map(t => `${file}:${t}: pauses for a fixed time; wait for the event or the condition instead, with the wait that README.md, Fixed pauses, names for this kind of test, or list the file there with its reason.`));
      findings.push(...TestWaitCheck.findVitestWaits(file, text).map(t =>
        `${file}:${t}: uses vi.waitFor, which checks every 50 ms; wait with Wait.until from ${TestWaitCheck.WAIT_FIXTURE}, which checks every millisecond, as README.md, Fixed pauses, says.`));
    }
    if (!files.includes(TestWaitCheck.WAIT_FIXTURE))
      findings.push(`${TestWaitCheck.SOURCE_PATH}: ${TestWaitCheck.WAIT_FIXTURE} is missing; move the rule on vi.waitFor to where the Window specs' wait now is.`);
    if (!testFiles.some(t => t.startsWith(TestWaitCheck.WINDOW_TESTS) && t !== TestWaitCheck.WAIT_FIXTURE))
      findings.push(`${TestWaitCheck.SOURCE_PATH}: no test files are under ${TestWaitCheck.WINDOW_TESTS}, so the rule on vi.waitFor checks nothing; move it to where the Window specs now are.`);
    for (const sample of TestWaitCheck.SAMPLES)
      if (TestWaitCheck.findVitestWaits(sample.file, sample.text).join() !== sample.lines.join())
        findings.push(`${TestWaitCheck.SOURCE_PATH}: the rule on vi.waitFor no longer holds on its own sample: ${sample.expectation}.`);
    for (const [file, line] of listed)
      if (!pausing.has(file))
        findings.push(`${TestWaitCheck.CONTRACT_FILE}:${line}: lists ${file}, which no longer pauses for a fixed time; remove its row.`);

    for (const finding of findings)
      output.write(`${finding}\n`);
    output.write(`Checked ${testFiles.length} test files for fixed pauses, and the Window specs for vi.waitFor; ${listed.size} may pause.\n`);
    return findings.length === 0;
  }

  private static isTestFile(file: string): boolean {
    if (!SourceFile.SCRIPT_EXTENSIONS.has(path.posix.extname(file)))
      return false;
    return file.startsWith(TestWaitCheck.SOURCE_FOLDER) && file.split("/").some(t => SourceTree.TEST_FOLDERS.has(t));
  }

  private static findVitestWaits(file: string, text: string): readonly number[] {
    return file.startsWith(TestWaitCheck.WINDOW_TESTS) && file !== TestWaitCheck.WAIT_FIXTURE ? TestWaitCheck.findLines(text, TestWaitCheck.VITEST_WAITS, (t, index) => SourceFile.isInString(t, index) || TestWaitCheck.isInComment(t, index)) : [];
  }

  private static findLines(text: string, patterns: readonly RegExp[], isSkipped: (text: string, index: number) => boolean = SourceFile.isInString): readonly number[] {
    const lines = new Set<number>();
    for (const pattern of patterns)
      for (const match of text.matchAll(pattern))
        if (!isSkipped(text, match.index))
          lines.add(text.slice(0, match.index).split(TestWaitCheck.LINE_SEPARATOR).length);
    return [...lines].sort((a, b) => a - b);
  }

  private static isInComment(text: string, index: number): boolean {
    const lineStart = text.lastIndexOf(TestWaitCheck.LINE_SEPARATOR, index - 1) + 1;
    for (let position = text.indexOf(TestWaitCheck.LINE_COMMENT, lineStart); position >= 0 && position < index; position = text.indexOf(TestWaitCheck.LINE_COMMENT, position + 1))
      if (!SourceFile.isInString(text, position))
        return true;
    const blockStart = text.lastIndexOf(TestWaitCheck.BLOCK_COMMENT_START, index);
    return blockStart >= 0 && !SourceFile.isInString(text, blockStart) && !text.slice(blockStart, index).includes(TestWaitCheck.BLOCK_COMMENT_END);
  }

  private async readListAsync(): Promise<ReadonlyMap<string, number>> {
    const lines = (await readFile(path.join(this.root, TestWaitCheck.CONTRACT_FILE), "utf8")).split(TestWaitCheck.LINE_SEPARATOR);
    const start = lines.indexOf(TestWaitCheck.LIST_HEADER);
    const files = new Map<string, number>();
    if (start === -1)
      return files;
    for (let index = start + 2; index < lines.length && (lines[index] as string).startsWith(TestWaitCheck.TABLE_ROW_PREFIX); index++) {
      const file = TestWaitCheck.LIST_ROW.exec(lines[index] as string)?.[1];
      if (!Object.isUndefined(file))
        files.set(file, index + 1);
    }
    return files;
  }
}
