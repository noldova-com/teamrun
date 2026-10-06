/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";

import type RepositoryFiles from "../repository/repository-files.ts";
import SourceTree from "../structure/source-tree.ts";
import TestMirror from "../structure/test-mirror.ts";
import RepeatSelection from "./repeat-selection.ts";
import RepeatException from "./repeat.exception.ts";

export default class RepeatSelector {
  private static readonly SCRIPT_TESTS: string = "scripts/tests/";
  private static readonly FIXTURES_FOLDER: string = "fixtures";
  private static readonly SCRIPT_EXTENSION: string = ".ts";
  private static readonly TEST_SUFFIXES: readonly string[] = [TestMirror.TEST_SUFFIX, TestMirror.SPEC_SUFFIX];
  private static readonly IMPORT_PATTERN: RegExp = /(?:\bfrom\s+|\bimport\s*\(?\s*)["'](\.{1,2}\/[^"']+)["']/g;
  private static readonly RESOLVED_SUFFIXES: readonly string[] = ["", ".ts", "/index.ts"];

  private readonly root: string;
  private readonly files: RepositoryFiles;

  public constructor(root: string, files: RepositoryFiles) {
    this.root = root;
    this.files = files;
  }

  public async selectAsync(changed: readonly string[], named: readonly string[]): Promise<RepeatSelection> {
    const listed = new Set(await this.files.listAsync());
    const unknown = named.filter(t => !listed.has(t) || !RepeatSelector.isTest(t));
    if (unknown.length > 0)
      throw new RepeatException(`The Repeat line names files that are not test or UI workflow files of this revision: ${unknown.join(", ")}. It names files by their path from the repository's root.`);

    const selected = new Set(named);
    const support: string[] = [];
    for (const file of changed.filter(t => listed.has(t))) {
      if (RepeatSelector.isTest(file))
        selected.add(file);
      else if (RepeatSelector.isTestTree(file))
        support.push(file);
      else
        for (const mirror of TestMirror.locate(file).filter(t => listed.has(t)))
          selected.add(mirror);
    }

    const importers = await this.readImportersAsync([...listed].filter(t => RepeatSelector.isTestTree(t) && t.endsWith(RepeatSelector.SCRIPT_EXTENSION)), listed);
    const visited = new Set(support);
    for (let file = support.shift(); file !== undefined; file = support.shift())
      for (const importer of importers.get(file) ?? []) {
        if (RepeatSelector.isTest(importer))
          selected.add(importer);
        else if (!visited.has(importer)) {
          visited.add(importer);
          support.push(importer);
        }
      }

    return new RepeatSelection([...selected].filter(t => !TestMirror.isWorkflow(t)), [...selected].filter(t => TestMirror.isWorkflow(t)));
  }

  private static isTestTree(file: string): boolean {
    return file.startsWith(RepeatSelector.SCRIPT_TESTS) || file.startsWith(`${TestMirror.SOURCE_FOLDER}/`) && file.split("/").some(t => SourceTree.TEST_FOLDERS.has(t));
  }

  private static isTest(file: string): boolean {
    return RepeatSelector.isTestTree(file) && RepeatSelector.TEST_SUFFIXES.some(t => file.endsWith(t)) && !file.split("/").includes(RepeatSelector.FIXTURES_FOLDER);
  }

  private async readImportersAsync(files: readonly string[], listed: ReadonlySet<string>): Promise<ReadonlyMap<string, readonly string[]>> {
    const importers = new Map<string, string[]>();
    for (const file of files) {
      const text = await readFile(path.join(this.root, file), "utf8");
      for (const match of text.matchAll(RepeatSelector.IMPORT_PATTERN)) {
        const target = path.posix.join(path.posix.dirname(file), match[1] ?? "");
        const imported = RepeatSelector.RESOLVED_SUFFIXES.map(t => `${target}${t}`).find(t => listed.has(t));
        if (imported !== undefined)
          importers.set(imported, [...importers.get(imported) ?? [], file]);
      }
    }
    return importers;
  }
}
