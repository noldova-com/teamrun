/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import path from "node:path";
import type { Writable } from "node:stream";

import type ModuleCatalog from "../modules/module-catalog.ts";
import type SourceFile from "../structure/source-file.ts";
import type SourceLiteral from "../structure/source-literal.ts";
import SourceScanner from "../structure/source-scanner.ts";
import SourceTree from "../structure/source-tree.ts";
import type ICheck from "./interfaces/i-check.ts";

export default class ModuleImportCheck implements ICheck {
  private static readonly RELATIVE_PREFIX: string = ".";
  private static readonly ABSOLUTE_PREFIX: string = "/";
  private static readonly TEAMRUN_PREFIX: string = "@noldova/teamrun-";
  private static readonly PUBLISHED_PREFIXES: readonly string[] = ["@noldova/teamrun-foundation-", "@noldova/teamrun-shell-"];
  private static readonly MODULE_PREFIX: string = "@noldova/teamrun-modules-";
  private static readonly PART_NAMES: readonly string[] = ["protocol", "runtime", "window", "cli"];
  private static readonly PACKAGE_NAME_SEGMENTS: number = 2;
  private static readonly SEPARATOR: string = "/";

  private readonly tree: SourceTree;
  private readonly modules: ModuleCatalog;

  public readonly title: string = "Module imports";

  public constructor(tree: SourceTree, modules: ModuleCatalog) {
    this.tree = tree;
    this.modules = modules;
  }

  public async runAsync(output: Writable): Promise<boolean> {
    const inventory = await this.tree.readAsync();
    const files = inventory.files.filter(t => t.owner !== SourceTree.SHELL_OWNER && t.isProduction && t.isScript);
    const declarations = (await this.modules.readAllAsync()).declarations;
    const dependencies = new Map<string, readonly string[]>(declarations.filter(t => !t.isFixture).map(t => [t.id, t.dependencies]));
    const findings: string[] = [];
    for (const file of files)
      for (const literal of new SourceScanner(file.text).scan().imports) {
        const problem = ModuleImportCheck.findProblem(file, literal.value, dependencies.get(file.owner) ?? []);
        if (problem !== null)
          findings.push(ModuleImportCheck.formatFinding(file, literal, problem));
      }

    for (const finding of findings)
      output.write(`${finding}\n`);
    output.write(`Checked the imports of ${files.length} production script files of modules.\n`);
    return findings.length === 0;
  }

  private static findProblem(file: SourceFile, specifier: string, dependencies: readonly string[]): string | null {
    if (specifier.startsWith(ModuleImportCheck.ABSOLUTE_PREFIX))
      return "is an absolute path";
    if (specifier.startsWith(ModuleImportCheck.RELATIVE_PREFIX))
      return ModuleImportCheck.isInside(path.posix.join(path.posix.dirname(file.path), specifier), file.packageRoot)
        ? null
        : `comes from outside its package ${file.packageRoot}`;
    if (!specifier.startsWith(ModuleImportCheck.TEAMRUN_PREFIX))
      return null;

    const packageName = ModuleImportCheck.readPackageName(specifier);
    if (ModuleImportCheck.PUBLISHED_PREFIXES.some(t => packageName.startsWith(t)))
      return packageName === specifier ? null : `is not the published API of ${packageName}; import the package itself`;

    const moduleId = ModuleImportCheck.readModuleId(packageName);
    if (moduleId === null)
      return "is not a TeamRun package a module may use";
    if (moduleId === file.owner)
      return null;
    if (!dependencies.includes(moduleId))
      return `belongs to module "${moduleId}", but module "${file.owner}" declares no dependency on "${moduleId}"`;
    return packageName === specifier ? null : `is not the published API of ${packageName}; import the package itself`;
  }

  private static isInside(target: string, folder: string): boolean {
    return target === folder || target.startsWith(`${folder}${ModuleImportCheck.SEPARATOR}`);
  }

  private static readPackageName(specifier: string): string {
    return specifier.split(ModuleImportCheck.SEPARATOR).slice(0, ModuleImportCheck.PACKAGE_NAME_SEGMENTS).join(ModuleImportCheck.SEPARATOR);
  }

  private static readModuleId(packageName: string): string | null {
    if (!packageName.startsWith(ModuleImportCheck.MODULE_PREFIX))
      return null;

    const rest = packageName.slice(ModuleImportCheck.MODULE_PREFIX.length);
    const part = ModuleImportCheck.PART_NAMES.find(t => rest.endsWith(`-${t}`));
    return part === undefined ? null : rest.slice(0, -part.length - 1);
  }

  private static formatFinding(file: SourceFile, literal: SourceLiteral, problem: string): string {
    return `${file.formatLocation(literal.line)}: the import "${literal.value}" ${problem}; a module uses only its own packages, foundation, the shell's published APIs and the published APIs of the modules it declares.`;
  }
}
