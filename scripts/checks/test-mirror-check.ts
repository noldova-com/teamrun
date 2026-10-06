/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Writable } from "node:stream";

import PackageManifest from "../packages/package-manifest.ts";
import type SourceFile from "../structure/source-file.ts";
import SourceScanner from "../structure/source-scanner.ts";
import type SourceTree from "../structure/source-tree.ts";
import TestMirror from "../structure/test-mirror.ts";
import TypeStripException from "../structure/type-strip.exception.ts";
import TypeStripper from "../structure/type-stripper.ts";
import type ICheck from "./interfaces/i-check.ts";

export default class TestMirrorCheck implements ICheck {
  private static readonly FIXTURES_FOLDER: string = "fixtures";
  private static readonly RULE: string = "CODING-STANDARDS.md section 13";
  private static readonly MANIFEST_NAME: string = "package.json";

  private readonly root: string;
  private readonly tree: SourceTree;
  private readonly stripper: TypeStripper;

  public readonly title: string = "Test mirrors";

  public constructor(root: string, tree: SourceTree, stripper: TypeStripper = new TypeStripper()) {
    this.root = root;
    this.tree = tree;
    this.stripper = stripper;
  }

  public async runAsync(output: Writable): Promise<boolean> {
    const files = (await this.tree.readAsync()).files;
    const paths = new Set(files.map(t => t.path));
    const packages = [...new Set(files.filter(t => t.isProduction && t.isScript).flatMap(t => TestMirror.findPackage(t.path)))].sort();
    const findings: string[] = [];
    let sourceCount = 0;
    let testCount = 0;
    try {
      for (const folder of packages) {
        const suffix = TestMirror.suffixOf(folder);
        const sourcePrefix = `${folder}/${TestMirror.SOURCE_FOLDER}/`;
        const testPrefix = `${folder}/${TestMirror.TESTS_FOLDER}/`;
        const excluded = paths.has(`${folder}/${TestMirrorCheck.MANIFEST_NAME}`) ? await this.readExclusionsAsync(folder, sourcePrefix) : new Set<string>();
        for (const file of files.filter(t => t.path.startsWith(sourcePrefix) && TestMirror.isSource(t.path) && !excluded.has(t.path))) {
          sourceCount++;
          const mirror = TestMirror.mirrorOf(folder, file.path);
          if (!paths.has(mirror) && this.isExecutable(file))
            findings.push(`${file.path}: has a function body but no mirrored test ${mirror}; ${TestMirrorCheck.RULE} gives every executable production file one.`);
        }
        for (const file of files.filter(t => t.path.startsWith(testPrefix) && t.path.endsWith(suffix))) {
          const relative = file.path.slice(testPrefix.length);
          if (relative.startsWith(`${TestMirrorCheck.FIXTURES_FOLDER}/`) || TestMirror.isWorkflow(file.path))
            continue;
          testCount++;
          const base = `${sourcePrefix}${relative.slice(0, -suffix.length)}`;
          const sources = [...TestMirror.SOURCE_EXTENSIONS, ...suffix === TestMirror.SPEC_SUFFIX ? [TestMirror.STYLE_EXTENSION] : []].map(t => `${base}${t}`);
          if (!sources.some(t => paths.has(t)))
            findings.push(`${file.path}: mirrors no production file; ${TestMirrorCheck.RULE} has each test mirror one of ${sources.join(", ")}.`);
        }
      }
    }
    catch (error) {
      if (!(error instanceof TypeStripException))
        throw error;
      output.write(`${error.message}\n`);
      return false;
    }

    for (const finding of findings)
      output.write(`${finding}\n`);
    output.write(`Checked ${sourceCount} production files and ${testCount} tests in ${packages.length} packages.\n`);
    return findings.length === 0;
  }

  private async readExclusionsAsync(folder: string, sourcePrefix: string): Promise<ReadonlySet<string>> {
    const entries: unknown[] = JSON.parse((await PackageManifest.readAsync(this.root, folder)).coverageExclusions);
    return new Set(entries.flatMap(t =>
      typeof t === "object" && t !== null && "file" in t && typeof t.file === "string" ? [`${sourcePrefix}${t.file}`] : []));
  }

  private isExecutable(file: SourceFile): boolean {
    return new SourceScanner(this.stripper.strip(file.path, file.text)).scan().hasFunctionBody;
  }

}
