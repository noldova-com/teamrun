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

import "@noldova/context.core";

import { PackageException } from "../packages/package.exception.ts";
import type { ProcessResult } from "../processes/process-result.ts";
import type { ICheck } from "./interfaces/i-check.ts";

export class CopyListCheck implements ICheck {
  public static readonly LIST_ARGUMENTS: readonly string[] = ["run", "build", "--silent", "--", "--list-copies"];
  private static readonly END: string = "end of copies\n";
  private static readonly FIELD_SEPARATOR: string = "\t";
  private static readonly FIELD_COUNT: number = 3;
  private static readonly ARCHIVE_FOLDER: string = "package";

  private readonly root: string;
  private readonly list: () => Promise<ProcessResult>;
  private readonly readArchives: () => Promise<ReadonlyMap<string, ReadonlyMap<string, Buffer>>>;

  public readonly title: string = "Copy list";

  public constructor(root: string, list: () => Promise<ProcessResult>, readArchives: () => Promise<ReadonlyMap<string, ReadonlyMap<string, Buffer>>>) {
    this.root = root;
    this.list = list;
    this.readArchives = readArchives;
  }

  public async runAsync(output: Writable): Promise<boolean> {
    const result = await this.list();
    if (!result.isSuccessful) {
      output.write(`npm run build --silent -- --list-copies exited with ${result.exitCode}:\n${result.text}\n`);
      return false;
    }
    if (!result.output.endsWith(CopyListCheck.END)) {
      output.write(`npm run build --silent -- --list-copies didn't end with the line "${CopyListCheck.END.trim()}".\n`);
      return false;
    }
    const lines = result.output.slice(0, -CopyListCheck.END.length).split("\n").filter(t => t.length > 0);
    if (lines.length === 0) {
      output.write("npm run build --silent -- --list-copies listed no copies, though the build copies LICENSE into every package.\n");
      return false;
    }
    let archives: ReadonlyMap<string, ReadonlyMap<string, Buffer>>;
    try {
      archives = await this.readArchives();
    }
    catch (error) {
      if (!(error instanceof PackageException))
        throw error;
      output.write(`${error.message}\n`);
      return false;
    }
    const findings: string[] = [];
    for (const line of lines)
      findings.push(...await this.findLineProblemsAsync(line, archives));
    for (const finding of findings)
      output.write(`${finding}\n`);
    if (findings.length === 0)
      output.write(`Copies listed and found in their packages' archives: ${lines.length}.\n`);
    return findings.length === 0;
  }

  private async findLineProblemsAsync(line: string, archives: ReadonlyMap<string, ReadonlyMap<string, Buffer>>): Promise<readonly string[]> {
    const fields = line.split(CopyListCheck.FIELD_SEPARATOR);
    const [source, name, entry] = fields;
    if (fields.length !== CopyListCheck.FIELD_COUNT || Object.isUndefined(source) || Object.isUndefined(name) || Object.isUndefined(entry) || fields.some(t => t.length === 0))
      return [`"${line}" isn't a source, a package name and a path in the package, separated by tabs.`];
    const problems: string[] = [];
    for (const value of [source, entry])
      if (value.includes("\\") || path.posix.isAbsolute(value) || value.split("/").includes(".."))
        problems.push(`"${line}" holds ${value}, which isn't a relative path with / between folders.`);
    if (problems.length > 0)
      return problems;
    const file = path.join(this.root, ...source.split("/"));
    if (!existsSync(file))
      return [`"${line}" names ${source}, which isn't in the repository.`];
    const archive = archives.get(name);
    if (Object.isUndefined(archive))
      return [`"${line}" names ${name}, which isn't a package under src/.`];
    const copy = archive.get(`${CopyListCheck.ARCHIVE_FOLDER}/${entry}`);
    if (Object.isUndefined(copy))
      return [`${name}'s archive lacks ${entry}, the copy of ${source}.`];
    if (!copy.equals(await readFile(file)))
      return [`${name}'s archive holds a ${entry} that differs from ${source}.`];
    return [];
  }
}
