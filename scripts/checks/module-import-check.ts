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
import type ModuleDeclaration from "../modules/module-declaration.ts";
import PackageNaming from "../packages/package-naming.ts";
import type SourceFile from "../structure/source-file.ts";
import type SourceLiteral from "../structure/source-literal.ts";
import SourceScanner from "../structure/source-scanner.ts";
import SourceTree from "../structure/source-tree.ts";
import type ICheck from "./interfaces/i-check.ts";

export default class ModuleImportCheck implements ICheck {
  private static readonly RELATIVE_PREFIX: string = ".";
  private static readonly ABSOLUTE_PREFIX: string = "/";
  private static readonly NOT_USABLE: string = "is not a TeamRun package a module may use";
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
    const modulePackages = new Map<string, ModuleDeclaration>(declarations.flatMap(t =>
      ModuleImportCheck.PART_NAMES.map(u => [PackageNaming.nameModulePackage(t.id, u, t.isFixture), t] as const)));
    const findings: string[] = [];
    for (const file of files)
      for (const literal of new SourceScanner(file.text).scan().imports) {
        const problem = ModuleImportCheck.findProblem(file, literal.value, dependencies.get(file.owner) ?? [], modulePackages);
        if (problem !== null)
          findings.push(ModuleImportCheck.formatFinding(file, literal, problem));
      }

    for (const finding of findings)
      output.write(`${finding}\n`);
    output.write(`Checked the imports of ${files.length} production script files of modules.\n`);
    return findings.length === 0;
  }

  private static findProblem(file: SourceFile, specifier: string, dependencies: readonly string[], modulePackages: ReadonlyMap<string, ModuleDeclaration>): string | null {
    if (specifier.startsWith(ModuleImportCheck.ABSOLUTE_PREFIX))
      return "is an absolute path";
    if (specifier.startsWith(ModuleImportCheck.RELATIVE_PREFIX))
      return ModuleImportCheck.isInside(path.posix.join(path.posix.dirname(file.path), specifier), file.packageRoot)
        ? null
        : `comes from outside its package ${file.packageRoot}`;
    if (!specifier.startsWith(PackageNaming.SCOPE))
      return null;

    const packageName = ModuleImportCheck.readPackageName(specifier);
    const module = modulePackages.get(packageName);
    if (module === undefined)
      return PackageNaming.isPublished(packageName) ? ModuleImportCheck.findApiProblem(specifier, packageName) : ModuleImportCheck.NOT_USABLE;
    if (module.isFixture)
      return ModuleImportCheck.NOT_USABLE;
    if (module.id === file.owner)
      return null;
    if (!dependencies.includes(module.id))
      return `belongs to module "${module.id}", but module "${file.owner}" declares no dependency on "${module.id}"`;
    return ModuleImportCheck.findApiProblem(specifier, packageName);
  }

  private static findApiProblem(specifier: string, packageName: string): string | null {
    return packageName === specifier ? null : `is not the published API of ${packageName}; import the package itself`;
  }

  private static isInside(target: string, folder: string): boolean {
    return target === folder || target.startsWith(`${folder}${ModuleImportCheck.SEPARATOR}`);
  }

  private static readPackageName(specifier: string): string {
    return specifier.split(ModuleImportCheck.SEPARATOR).slice(0, ModuleImportCheck.PACKAGE_NAME_SEGMENTS).join(ModuleImportCheck.SEPARATOR);
  }

  private static formatFinding(file: SourceFile, literal: SourceLiteral, problem: string): string {
    return `${file.formatLocation(literal.line)}: the import "${literal.value}" ${problem}; a module uses only its own packages, foundation, the shell's published APIs and the published APIs of the modules it declares.`;
  }
}
