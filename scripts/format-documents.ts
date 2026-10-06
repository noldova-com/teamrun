/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Writable } from "node:stream";

import SentenceBreaker from "./documents/sentence-breaker.ts";
import ProcessRunner from "./processes/process-runner.ts";
import Git from "./repository/git.ts";
import RepositoryFiles from "./repository/repository-files.ts";

export default class FormatDocuments {
  private static readonly USAGE: string = "Usage: npm run format:documents\n";
  private static readonly USAGE_EXIT_CODE: number = 2;
  private static readonly MARKDOWN_EXTENSION: string = ".md";

  private readonly root: string;
  private readonly files: RepositoryFiles;
  private readonly output: Writable;

  public constructor(root: string, files: RepositoryFiles, output: Writable) {
    this.root = root;
    this.files = files;
    this.output = output;
  }

  public async runAsync(args: readonly string[]): Promise<number> {
    if (args.length > 0) {
      this.output.write(FormatDocuments.USAGE);
      return FormatDocuments.USAGE_EXIT_CODE;
    }

    const breaker = new SentenceBreaker();
    const documents = (await this.files.listAsync()).filter(t => t.endsWith(FormatDocuments.MARKDOWN_EXTENSION));
    const changed: string[] = [];
    for (const document of documents) {
      const file = path.join(this.root, document);
      const text = await readFile(file, "utf8");
      const formatted = breaker.format(text);
      if (formatted !== text) {
        await writeFile(file, formatted);
        changed.push(document);
      }
    }
    for (const document of changed)
      this.output.write(`${document}\n`);
    this.output.write(`Put each sentence on its own line in ${changed.length} of ${documents.length} documents.\n`);
    return 0;
  }
}

if (import.meta.main) {
  const root = process.cwd();
  process.exitCode = await new FormatDocuments(root, new RepositoryFiles(root, new Git(root, new ProcessRunner())), process.stdout).runAsync(process.argv.slice(2));
}
