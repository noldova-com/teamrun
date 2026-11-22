/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { readFile } from "node:fs/promises";
import { builtinModules } from "node:module";
import path from "node:path";
import type { Writable } from "node:stream";

import { PackageCatalog } from "../packages/package-catalog.ts";
import type { PackageManifest } from "../packages/package-manifest.ts";
import { PackageException } from "../packages/package.exception.ts";
import type { RepositoryFiles } from "../repository/repository-files.ts";
import { SourceFile } from "../structure/source-file.ts";
import { SourceTree } from "../structure/source-tree.ts";
import { FoundMock } from "./found-mock.ts";
import type { ICheck } from "./interfaces/i-check.ts";

export class GlobalMockCheck implements ICheck {
  private static readonly GLOBALS: readonly string[] = [
    "globalThis", "global", "window", "self", "process", "console", "Date", "Math", "JSON", "Reflect", "Intl", "performance", "crypto", "navigator",
    "Buffer", "Promise", "Object", "Array", "Number", "String", "Symbol", "Error", "URL", "AbortController", "AbortSignal", "EventTarget", "WebAssembly"
  ];
  private static readonly FOLDERS: readonly string[] = ["src/", "scripts/"];
  private static readonly MOCK_NAME: string = "mock";
  private static readonly MOCK_BINDINGS: readonly RegExp[] = [
    /\bimport\s*(?:\s[\w$]+\s*,\s*)?\{[^}]*\bmock\s+as\s+([\w$]+)[^}]*\}\s*from\s*["'](?:node:)?test["']/g,
    /\{(?:[^{}]*,)?\s*mock\s*:\s*([\w$]+)[^{}]*\}/g,
    /(?<![\w$.])([\w$]+)\s*(?::\s*[\w$.<>[\]| ]+?\s*)?=(?![=>])\s*(?:[\w$]+\s*\.\s*)*mock(?![\w$]|\s*[.([])/g
  ];
  private static readonly KINDS: readonly string[] = ["method", "property", "getter", "setter"];
  private static readonly IMPORT_FROM: RegExp = /\bimport\s+(?!type\s)([^;'"`]*?)\s*from\s*["']([^"']+)["']/g;
  private static readonly REQUIRE_OR_IMPORT: RegExp = /\b(?:const|let|var)\s+(\{[^}]*\}|[\w$]+)\s*=\s*(?:await\s+import|require)\s*\(\s*["'`]([^"'`]+)["'`]\s*\)/g;
  private static readonly NAMED_BINDINGS: RegExp = /\{([^}]*)\}/;
  private static readonly NAMESPACE_BINDING: RegExp = /^\*\s*as\s+([\w$]+)$/;
  private static readonly IDENTIFIER: RegExp = /^[A-Za-z_$][\w$]*$/;
  private static readonly SPECIFIER_RENAME: RegExp = /\s+as\s+|\s*:\s*/;
  private static readonly NODE_PREFIX: string = "node:";
  private static readonly FILE_SYSTEM_MODULES: ReadonlySet<string> = new Set(["fs", "fs/promises"]);
  private static readonly TESTS_FOLDER: string = "tests";
  private static readonly LINE_SEPARATOR: string = "\n";

  private readonly root: string;
  private readonly files: RepositoryFiles;

  public readonly title: string = "Global mocks";

  public constructor(root: string, files: RepositoryFiles) {
    this.root = root;
    this.files = files;
  }

  public async runAsync(output: Writable): Promise<boolean> {
    const testFiles = (await this.files.listAsync()).filter(t => GlobalMockCheck.isTestFile(t));
    if (testFiles.length === 0) {
      output.write("Found no test file under src/ or scripts/, so the check read nothing.\n");
      return false;
    }
    let packages: readonly PackageManifest[];
    try {
      packages = await new PackageCatalog(this.root).listPackagesAsync();
    }
    catch (error) {
      if (!(error instanceof PackageException))
        throw error;
      output.write(`${error.message}\n`);
      return false;
    }
    const isolated = new Set(packages.flatMap(t => t.isolatedTests.map(u => `${t.directory}/${GlobalMockCheck.TESTS_FOLDER}/${u}`)));
    const findings: string[] = [...isolated].filter(t => !testFiles.includes(t))
      .map(t => `${t}: is listed in its package's isolatedTests, but is no test file; take it off the list, as README.md, Global mocks, says.`);
    for (const file of testFiles) {
      const text = await readFile(path.join(this.root, file), "utf8");
      const mocks = GlobalMockCheck.findMocks(text);
      const isListed = isolated.has(file);
      if (isListed && !mocks.some(t => GlobalMockCheck.isFileSystem(t.module)))
        findings.push(`${file}: is listed in its package's isolatedTests, but mocks no node:fs function; take it off the list, as README.md, Global mocks, says.`);
      for (const mock of mocks.filter(t => !isListed || !GlobalMockCheck.isFileSystem(t.module)))
        findings.push(`${file}:${text.slice(0, mock.index).split(GlobalMockCheck.LINE_SEPARATOR).length}: mocks ${mock.form}, which every test running alongside it shares; inject the timing or the function instead, as README.md, Global mocks, says.`);
    }

    for (const finding of findings)
      output.write(`${finding}\n`);
    output.write(`Checked ${testFiles.length} test files for global mocks.\n`);
    return findings.length === 0;
  }

  private static isTestFile(file: string): boolean {
    if (!SourceFile.SCRIPT_EXTENSIONS.has(path.posix.extname(file)))
      return false;
    return GlobalMockCheck.FOLDERS.some(t => file.startsWith(t)) && file.split("/").some(t => SourceTree.TEST_FOLDERS.has(t));
  }

  private static isFileSystem(module: string | null): boolean {
    return module !== null && GlobalMockCheck.FILE_SYSTEM_MODULES.has(module.replace(GlobalMockCheck.NODE_PREFIX, ""));
  }

  private static findMocks(text: string): readonly FoundMock[] {
    const names = new Set<string>([GlobalMockCheck.MOCK_NAME]);
    for (const regex of GlobalMockCheck.MOCK_BINDINGS)
      for (const match of text.matchAll(regex))
        if (!SourceFile.isInString(text, match.index))
          names.add(match[1] as string);
    const globals = GlobalMockCheck.GLOBALS.join("|");
    const builtIns = GlobalMockCheck.findBuiltInBindings(text);
    const loads = `(?:\\(\\s*)?(?:await\\s+)?(?:import|require)\\s*\\(\\s*["'\`]((?:node:)?[\\w/]+)["'\`]`;
    const mocks: FoundMock[] = [];
    for (const name of names) {
      const mock = GlobalMockCheck.escape(name);
      for (const match of text.matchAll(new RegExp(`(?<![\\w$])${mock}\\s*\\.\\s*timers\\b|\\{(?:[^{}]*,)?\\s*timers\\b[^{}]*\\}\\s*=\\s*(?:[\\w$]+\\s*\\.\\s*)*${mock}(?![\\w$]|\\s*[.([])`, "g")))
        mocks.push(new FoundMock(match.index, "the timers with mock.timers", null));
      for (const match of text.matchAll(new RegExp(`(?<![\\w$])${mock}\\s*\\.\\s*(${GlobalMockCheck.KINDS.join("|")})\\s*\\(\\s*(?:globalThis\\s*\\.\\s*)?(${globals})\\b`, "g")))
        mocks.push(new FoundMock(match.index, `a ${match[1] as string} of ${match[2] as string} with mock.${match[1] as string}`, null));
      for (const [binding, module] of builtIns)
        for (const match of text.matchAll(new RegExp(`(?<![\\w$])${mock}\\s*\\.\\s*method\\s*\\(\\s*${GlobalMockCheck.escape(binding)}(?![\\w$])`, "g")))
          mocks.push(new FoundMock(match.index, `a method of ${module} with mock.method`, module));
      for (const match of text.matchAll(new RegExp(`(?<![\\w$])${mock}\\s*\\.\\s*method\\s*\\(\\s*${loads}`, "g")))
        if (GlobalMockCheck.isBuiltIn(match[1] as string))
          mocks.push(new FoundMock(match.index, `a method of ${match[1] as string} with mock.method`, match[1] as string));
    }
    return mocks
      .filter(t => !SourceFile.isInString(text, t.index))
      .sort((a, b) => a.index - b.index);
  }

  private static findBuiltInBindings(text: string): ReadonlyMap<string, string> {
    const bindings = new Map<string, string>();
    for (const regex of [GlobalMockCheck.IMPORT_FROM, GlobalMockCheck.REQUIRE_OR_IMPORT])
      for (const match of text.matchAll(regex)) {
        const module = match[2] as string;
        if (SourceFile.isInString(text, match.index) || !GlobalMockCheck.isBuiltIn(module))
          continue;
        for (const name of GlobalMockCheck.readBindings(match[1] as string))
          bindings.set(name, module);
      }
    return bindings;
  }

  private static readBindings(clause: string): readonly string[] {
    const names: string[] = [];
    const named = GlobalMockCheck.NAMED_BINDINGS.exec(clause)?.[1];
    for (const specifier of named?.split(",") ?? []) {
      const parts = specifier.trim().split(GlobalMockCheck.SPECIFIER_RENAME);
      const name = (parts[parts.length - 1] as string).trim();
      if (GlobalMockCheck.IDENTIFIER.test(name))
        names.push(name);
    }
    for (const part of clause.replace(GlobalMockCheck.NAMED_BINDINGS, "").split(",")) {
      const binding = part.trim();
      const name = GlobalMockCheck.NAMESPACE_BINDING.exec(binding)?.[1] ?? binding;
      if (GlobalMockCheck.IDENTIFIER.test(name))
        names.push(name);
    }
    return names;
  }

  private static isBuiltIn(module: string): boolean {
    return module.startsWith(GlobalMockCheck.NODE_PREFIX) || builtinModules.includes(module);
  }

  private static escape(name: string): string {
    return name.replace(/\$/g, "\\$");
  }
}
