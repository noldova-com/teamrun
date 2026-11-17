/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Writable } from "node:stream";

import { ProcessRunner } from "../../../processes/process-runner.ts";
import { Git } from "../../../repository/git.ts";
import { RepositoryFiles } from "../../../repository/repository-files.ts";
import { SyntaxTreeReader } from "../../../structure/syntax-tree.reader.ts";
import type { ICheck } from "../../interfaces/i-check.ts";

export class CheckRepository {
  private static readonly PREFIX: string = "syntax-check-";
  private static readonly NEW_LINE: string = "\n";
  private static readonly RULE_START: string = ";";

  public readonly root: string;
  public readonly files: RepositoryFiles;
  public readonly syntax: SyntaxTreeReader;

  private constructor(root: string) {
    this.root = root;
    this.files = new RepositoryFiles(root, new Git(root, new ProcessRunner()));
    this.syntax = new SyntaxTreeReader(root);
  }

  public static async createAsync(sources: Readonly<Record<string, string>>): Promise<CheckRepository> {
    const root = await mkdtemp(path.join(tmpdir(), CheckRepository.PREFIX));
    await new Git(root, new ProcessRunner()).readOutputAsync(["init", "--quiet"]);
    for (const [file, text] of Object.entries(sources)) {
      await mkdir(path.dirname(path.join(root, file)), { recursive: true });
      await writeFile(path.join(root, file), text);
    }
    return new CheckRepository(root);
  }

  public async runAsync(check: ICheck): Promise<{ passed: boolean; lines: readonly string[] }> {
    let text = "";
    const output = new Writable({ write: (chunk, _encoding, done): void => { text += String(chunk); done(); } });
    const passed = await check.runAsync(output);
    const lines = text.split(CheckRepository.NEW_LINE).filter(t => t.length > 0);
    return { passed, lines: lines.map(t => t.includes(CheckRepository.RULE_START) ? t.slice(0, t.indexOf(CheckRepository.RULE_START)) : t) };
  }

  public async removeAsync(): Promise<void> {
    await rm(this.root, { recursive: true, force: true });
  }
}
