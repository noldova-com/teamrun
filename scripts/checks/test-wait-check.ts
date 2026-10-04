/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Writable } from "node:stream";

import type RepositoryFiles from "../repository/repository-files.ts";
import type ICheck from "./interfaces/check.ts";

export default class TestWaitCheck implements ICheck {
  private static readonly CONTRACT_FILE: string = "docs/TESTING.md";
  private static readonly LIST_HEADER: string = "| Test file | Why it pauses |";
  private static readonly LIST_ROW: RegExp = /^\| `([^`]+)` \| .+ \|$/;
  private static readonly TABLE_ROW_PREFIX: string = "|";
  private static readonly TEST_FILE: RegExp = /^(?:scripts\/tests\/|src\/(?:.+\/)?(?:tests|e2e)\/).+\.(?:ts|mts|cts|js|mjs|cjs)$/;
  private static readonly PAUSES: readonly RegExp[] = [
    /\bsetTimeout\b[^;\n]*\bfrom\s+["']node:timers\/promises["']/,
    /\bscheduler\.wait\s*\(/,
    /(?<![.\w$])setTimeout\(\s*[A-Za-z_$][\w$]*\s*,/,
    /\bwaitForTimeout\s*\(/
  ];
  private static readonly LINE_SEPARATOR: string = "\n";

  private readonly root: string;
  private readonly files: RepositoryFiles;

  public readonly title: string = "Test waits";

  public constructor(root: string, files: RepositoryFiles) {
    this.root = root;
    this.files = files;
  }

  public async runAsync(output: Writable): Promise<boolean> {
    const listed = await this.readListAsync();
    const testFiles = (await this.files.listAsync()).filter(t => TestWaitCheck.TEST_FILE.test(t));
    const pausing = new Set<string>();
    const findings: string[] = [];
    for (const file of testFiles) {
      const lines = (await readFile(path.join(this.root, file), "utf8")).split(TestWaitCheck.LINE_SEPARATOR);
      lines.forEach((line, index) => {
        if (!TestWaitCheck.PAUSES.some(t => t.test(line)))
          return;
        pausing.add(file);
        if (!listed.includes(file))
          findings.push(`${file}:${index + 1}: pauses for a fixed time; a test waits for a condition, and only the files that TESTING.md section 3 lists may pause.`);
      });
    }
    for (const file of listed.filter(t => !pausing.has(t)))
      findings.push(`${TestWaitCheck.CONTRACT_FILE}: lists ${file}, which no longer pauses for a fixed time; remove it from the list.`);

    for (const finding of findings)
      output.write(`${finding}\n`);
    output.write(`Checked ${testFiles.length} test files for fixed pauses; ${listed.length} may pause.\n`);
    return findings.length === 0;
  }

  private async readListAsync(): Promise<readonly string[]> {
    const contract = path.join(this.root, TestWaitCheck.CONTRACT_FILE);
    if (!existsSync(contract))
      return [];
    const lines = (await readFile(contract, "utf8")).split(TestWaitCheck.LINE_SEPARATOR);
    const start = lines.indexOf(TestWaitCheck.LIST_HEADER);
    if (start === -1)
      return [];
    const files: string[] = [];
    for (const line of lines.slice(start + 2)) {
      if (!line.startsWith(TestWaitCheck.TABLE_ROW_PREFIX))
        break;
      const file = TestWaitCheck.LIST_ROW.exec(line)?.[1];
      if (file !== undefined)
        files.push(file);
    }
    return files;
  }
}
