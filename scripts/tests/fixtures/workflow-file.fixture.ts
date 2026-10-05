/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import SourceTreeFixture from "./source-tree.fixture.ts";

export default class WorkflowFileFixture {
  private static readonly FOLDER: string = ".github/workflows";
  private static readonly ACTIONS_FOLDER: string = ".github/actions";
  private static readonly ACTION_FILE: string = "action.yml";
  private static readonly STEP_PATTERN: RegExp = /^( *)- name: (.+)$/;
  private static readonly INDENTATION_PATTERN: RegExp = /^ */;
  private static readonly BLOCK_INDICATOR: string = "|";

  private readonly lines: readonly string[];

  public readonly text: string;

  private constructor(text: string) {
    this.lines = text.split("\n");
    this.text = text;
  }

  public static async readAsync(name: string): Promise<WorkflowFileFixture> {
    return new WorkflowFileFixture(await readFile(path.join(SourceTreeFixture.root, WorkflowFileFixture.FOLDER, name), "utf8"));
  }

  public static async readAllAsync(): Promise<readonly WorkflowFileFixture[]> {
    const names = (await readdir(path.join(SourceTreeFixture.root, WorkflowFileFixture.FOLDER))).filter(t => t.endsWith(".yml"));
    return await Promise.all(names.map(t => WorkflowFileFixture.readAsync(t)));
  }

  public static async readActionAsync(name: string): Promise<WorkflowFileFixture> {
    return new WorkflowFileFixture(await readFile(path.join(SourceTreeFixture.root, WorkflowFileFixture.ACTIONS_FOLDER, name, WorkflowFileFixture.ACTION_FILE), "utf8"));
  }

  public readStepScript(stepName: string): string {
    const starts = this.lines.flatMap((line, index) => WorkflowFileFixture.STEP_PATTERN.exec(line)?.[2] === stepName ? [index] : []);
    assert.equal(starts.length, 1, `Expected one step named "${stepName}".`);
    const start = starts[0] ?? 0;
    const keyIndentation = WorkflowFileFixture.measureIndentation(this.lines[start] ?? "") + 2;
    const runPattern = new RegExp(`^ {${keyIndentation}}run: (.*)$`);
    for (let index = start + 1; index < this.lines.length; index++) {
      const line = this.lines[index] ?? "";
      if (line.trim().length > 0 && WorkflowFileFixture.measureIndentation(line) < keyIndentation)
        break;
      const value = runPattern.exec(line)?.[1];
      if (value === undefined)
        continue;
      return value === WorkflowFileFixture.BLOCK_INDICATOR ? this.readBlock(index + 1, keyIndentation) : `${value}\n`;
    }
    assert.fail(`The step "${stepName}" has no run script.`);
  }

  private static measureIndentation(line: string): number {
    return WorkflowFileFixture.INDENTATION_PATTERN.exec(line)?.[0].length ?? 0;
  }

  private readBlock(start: number, keyIndentation: number): string {
    const block: string[] = [];
    for (const line of this.lines.slice(start)) {
      if (line.trim().length > 0 && WorkflowFileFixture.measureIndentation(line) <= keyIndentation)
        break;
      block.push(line);
    }
    while (block.length > 0 && block.at(-1)?.trim().length === 0)
      block.pop();
    const blockIndentation = Math.min(...block.filter(t => t.trim().length > 0).map(t => WorkflowFileFixture.measureIndentation(t)));
    return `${block.map(t => t.slice(blockIndentation)).join("\n")}\n`;
  }
}
