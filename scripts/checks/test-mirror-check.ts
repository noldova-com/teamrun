/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import path from "node:path";
import type { Writable } from "node:stream";

import PackageManifest from "../packages/package-manifest.ts";
import type SourceFile from "../structure/source-file.ts";
import SourceScanner from "../structure/source-scanner.ts";
import type SourceTree from "../structure/source-tree.ts";
import TypeStripException from "../structure/type-strip.exception.ts";
import TypeStripper from "../structure/type-stripper.ts";
import type ICheck from "./interfaces/check.ts";

export default class TestMirrorCheck implements ICheck {
  private static readonly SOURCE_FOLDER: string = "src";
  private static readonly TESTS_FOLDER: string = "tests";
  private static readonly EXEMPT_FOLDERS: ReadonlySet<string> = new Set(["fixtures", "e2e"]);
  private static readonly SOURCE_EXTENSIONS: readonly string[] = [".ts", ".mts", ".cts"];
  private static readonly STYLE_EXTENSION: string = ".scss";
  private static readonly DECLARATION: RegExp = /\.d\.[cm]?ts$/;
  private static readonly TEST_SUFFIX: string = ".test.ts";
  private static readonly SPEC_SUFFIX: string = ".spec.ts";
  private static readonly ANGULAR_PACKAGE: RegExp = /^src\/(?:shell\/(?:ui|window)|modules\/[^/]+\/window)$/;
  private static readonly RULE: string = "CODING-STANDARDS.md section 13";
  private static readonly MANIFEST_NAME: string = "package.json";
  private static readonly NESTED_SOURCE: string = "/src/";

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
    const packages = [...new Set(files.filter(t => t.isProduction && t.isScript).flatMap(t => TestMirrorCheck.findPackage(t.path)))].sort();
    const findings: string[] = [];
    let sourceCount = 0;
    let testCount = 0;
    try {
      for (const folder of packages) {
        const suffix = TestMirrorCheck.ANGULAR_PACKAGE.test(folder) ? TestMirrorCheck.SPEC_SUFFIX : TestMirrorCheck.TEST_SUFFIX;
        const sourcePrefix = `${folder}/${TestMirrorCheck.SOURCE_FOLDER}/`;
        const testPrefix = `${folder}/${TestMirrorCheck.TESTS_FOLDER}/`;
        const excluded = paths.has(`${folder}/${TestMirrorCheck.MANIFEST_NAME}`) ? await this.readExclusionsAsync(folder, sourcePrefix) : new Set<string>();
        for (const file of files.filter(t => t.path.startsWith(sourcePrefix) && TestMirrorCheck.isSource(t.path) && !excluded.has(t.path))) {
          sourceCount++;
          const mirror = `${testPrefix}${TestMirrorCheck.removeExtension(file.path.slice(sourcePrefix.length))}${suffix}`;
          if (!paths.has(mirror) && this.isExecutable(file))
            findings.push(`${file.path}: has a function body but no mirrored test ${mirror}; ${TestMirrorCheck.RULE} gives every executable production file one.`);
        }
        for (const file of files.filter(t => t.path.startsWith(testPrefix) && t.path.endsWith(suffix))) {
          const relative = file.path.slice(testPrefix.length);
          if ([...TestMirrorCheck.EXEMPT_FOLDERS].some(t => relative.startsWith(`${t}/`)))
            continue;
          testCount++;
          const base = `${sourcePrefix}${relative.slice(0, -suffix.length)}`;
          const sources = [...TestMirrorCheck.SOURCE_EXTENSIONS, ...suffix === TestMirrorCheck.SPEC_SUFFIX ? [TestMirrorCheck.STYLE_EXTENSION] : []].map(t => `${base}${t}`);
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

  private static findPackage(filePath: string): string[] {
    const index = filePath.indexOf(TestMirrorCheck.NESTED_SOURCE, TestMirrorCheck.SOURCE_FOLDER.length);
    return index < 0 ? [] : [filePath.slice(0, index)];
  }

  private static isSource(filePath: string): boolean {
    return TestMirrorCheck.SOURCE_EXTENSIONS.includes(path.posix.extname(filePath)) && !TestMirrorCheck.DECLARATION.test(filePath);
  }

  private static removeExtension(filePath: string): string {
    return filePath.slice(0, -path.posix.extname(filePath).length);
  }
}
