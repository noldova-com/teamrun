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

import type RepositoryFiles from "../repository/repository-files.ts";
import SourceFile from "../structure/source-file.ts";
import SourceTree from "../structure/source-tree.ts";
import type ICheck from "./interfaces/check.ts";

export default class TestWaitCheck implements ICheck {
  private static readonly CONTRACT_FILE: string = "docs/TESTING.md";
  private static readonly LIST_HEADER: string = "| Test file | Why it pauses |";
  private static readonly LIST_ROW: RegExp = /^\| `([^`]+)` \| .+ \|$/;
  private static readonly TABLE_ROW_PREFIX: string = "|";
  private static readonly SCRIPT_TESTS_FOLDER: string = "scripts/tests/";
  private static readonly SOURCE_FOLDER: string = "src/";
  private static readonly PAUSES: readonly RegExp[] = [
    /\bimport\s*(?:\{[^}]*\b(?:setTimeout|scheduler)\b[^}]*\}|\*\s*as\s+[\w$]+|[\w$]+)\s*from\s*["'](?:node:)?timers\/promises["']/g,
    /\bscheduler\.wait\s*\(/g,
    /\bAtomics\.wait(?:Async)?\s*\(/g,
    /\bwaitForTimeout\s*\(/g,
    /(?<![.\w$])setTimeout\(\s*[A-Za-z_$][\w$]*\s*,/g,
    /(?<![.\w$])setTimeout\([^\n]*,\s*\d[\d_]*\s*\)/g,
    /\bnew\s+Promise\b(?:<[^>\n]*>)?\(\s*\(?\s*[A-Za-z_$][\w$]*\s*\)?\s*=>\s*\{?\s*setTimeout\s*\(/g
  ];
  private static readonly QUOTES: readonly string[] = ["\"", "'", "`"];
  private static readonly ESCAPE: string = "\\";
  private static readonly LINE_SEPARATOR: string = "\n";

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
      const lines = TestWaitCheck.findPauses(await readFile(path.join(this.root, file), "utf8"));
      if (lines.length > 0)
        pausing.add(file);
      if (!listed.has(file))
        findings.push(...lines.map(t => `${file}:${t}: pauses for a fixed time; wait for the condition with Wait.untilAsync from @noldova/teamrun-foundation-testing, or list the file with its reason in TESTING.md section 3.`));
    }
    for (const [file, line] of listed)
      if (!pausing.has(file))
        findings.push(`${TestWaitCheck.CONTRACT_FILE}:${line}: lists ${file}, which no longer pauses for a fixed time; remove its row.`);

    for (const finding of findings)
      output.write(`${finding}\n`);
    output.write(`Checked ${testFiles.length} test files for fixed pauses; ${listed.size} may pause.\n`);
    return findings.length === 0;
  }

  private static isTestFile(file: string): boolean {
    if (!SourceFile.SCRIPT_EXTENSIONS.has(path.posix.extname(file)))
      return false;
    return file.startsWith(TestWaitCheck.SCRIPT_TESTS_FOLDER)
      || file.startsWith(TestWaitCheck.SOURCE_FOLDER) && file.split("/").some(t => SourceTree.TEST_FOLDERS.has(t));
  }

  private static findPauses(text: string): readonly number[] {
    const lines = new Set<number>();
    for (const pattern of TestWaitCheck.PAUSES)
      for (const match of text.matchAll(pattern))
        if (!TestWaitCheck.isInString(text, match.index))
          lines.add(text.slice(0, match.index).split(TestWaitCheck.LINE_SEPARATOR).length);
    return [...lines].sort((a, b) => a - b);
  }

  private static isInString(text: string, index: number): boolean {
    const lineStart = text.lastIndexOf(TestWaitCheck.LINE_SEPARATOR, index - 1) + 1;
    let quote: string | null = null;
    for (let position = lineStart; position < index; position++) {
      const character = text[position] as string;
      if (quote === null) {
        if (TestWaitCheck.QUOTES.includes(character))
          quote = character;
      }
      else if (character === TestWaitCheck.ESCAPE)
        position++;
      else if (character === quote)
        quote = null;
    }
    return quote !== null;
  }

  private async readListAsync(): Promise<ReadonlyMap<string, number>> {
    const lines = (await readFile(path.join(this.root, TestWaitCheck.CONTRACT_FILE), "utf8")).split(TestWaitCheck.LINE_SEPARATOR);
    const start = lines.indexOf(TestWaitCheck.LIST_HEADER);
    const files = new Map<string, number>();
    if (start === -1)
      return files;
    for (let index = start + 2; index < lines.length && (lines[index] as string).startsWith(TestWaitCheck.TABLE_ROW_PREFIX); index++) {
      const file = TestWaitCheck.LIST_ROW.exec(lines[index] as string)?.[1];
      if (file !== undefined)
        files.set(file, index + 1);
    }
    return files;
  }
}
