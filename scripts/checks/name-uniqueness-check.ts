/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Writable } from "node:stream";

import type ModuleCatalog from "../modules/module-catalog.ts";
import type ModuleDeclaration from "../modules/module-declaration.ts";
import type SourceFile from "../structure/source-file.ts";
import SourceScanner from "../structure/source-scanner.ts";
import SourceTree from "../structure/source-tree.ts";
import type ICheck from "./interfaces/i-check.ts";

export default class NameUniquenessCheck implements ICheck {
  private static readonly LINE_SEPARATOR: string = "\n";
  private static readonly SELECTOR_SEPARATOR: string = ",";
  private static readonly ELEMENT_SELECTOR: RegExp = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
  private static readonly SELECTOR_PREFIX: string = "tr-";
  private static readonly TOKEN_DEFINITION: RegExp = /--tr-[a-z0-9-]+(?=\s*:)/g;
  private static readonly TOKEN_PREFIX: string = "--tr-";
  private static readonly LIST_SEPARATOR: string = ", ";

  private readonly tree: SourceTree;
  private readonly modules: ModuleCatalog;

  public readonly title: string = "Unique names";

  public constructor(tree: SourceTree, modules: ModuleCatalog) {
    this.tree = tree;
    this.modules = modules;
  }

  public async runAsync(output: Writable): Promise<boolean> {
    const inventory = await this.tree.readAsync();
    const files = inventory.files.filter(t => t.isProduction);
    const declarations = (await this.modules.readAllAsync()).declarations;
    const findings = [
      ...NameUniquenessCheck.checkSelectors(files.filter(t => t.isScript)),
      ...NameUniquenessCheck.checkTokens(files.filter(t => t.isStyle)),
      ...NameUniquenessCheck.checkPackageNames(files.filter(t => t.isManifest)),
      ...NameUniquenessCheck.checkModuleNames(declarations)
    ];
    for (const finding of findings)
      output.write(`${finding}\n`);
    output.write(
      `Checked the selectors, style tokens and package names of ${files.length} production files and the names in ${declarations.length} module declarations.\n`);
    return findings.length === 0;
  }

  private static checkSelectors(files: readonly SourceFile[]): readonly string[] {
    const findings: string[] = [];
    const locations = new Map<string, string[]>();
    for (const file of files)
      for (const literal of new SourceScanner(file.text).scan().selectors)
        for (const selector of literal.value.split(NameUniquenessCheck.SELECTOR_SEPARATOR).map(t => t.trim())) {
          const location = file.formatLocation(literal.line);
          const prefix = NameUniquenessCheck.formatPrefix(NameUniquenessCheck.SELECTOR_PREFIX, file.owner);
          if (NameUniquenessCheck.ELEMENT_SELECTOR.test(selector) && !selector.startsWith(prefix))
            findings.push(`${location}: the selector "${selector}" does not start with "${prefix}".`);
          locations.set(selector, [...locations.get(selector) ?? [], location]);
        }

    for (const [selector, places] of locations)
      if (places.length > 1)
        findings.push(`The selector "${selector}" is declared more than once: ${places.join(NameUniquenessCheck.LIST_SEPARATOR)}.`);
    return findings;
  }

  private static checkTokens(files: readonly SourceFile[]): readonly string[] {
    const findings: string[] = [];
    const owners = new Map<string, Map<string, string>>();
    for (const file of files)
      file.text.split(NameUniquenessCheck.LINE_SEPARATOR).forEach((line, index) => {
        const location = file.formatLocation(index + 1);
        for (const [token] of line.matchAll(NameUniquenessCheck.TOKEN_DEFINITION)) {
          const prefix = NameUniquenessCheck.formatPrefix(NameUniquenessCheck.TOKEN_PREFIX, file.owner);
          if (!token.startsWith(prefix))
            findings.push(`${location}: the style token "${token}" does not start with "${prefix}".`);
          const definitions = owners.get(token) ?? new Map<string, string>();
          if (!definitions.has(file.owner))
            definitions.set(file.owner, location);
          owners.set(token, definitions);
        }
      });

    for (const [token, definitions] of owners)
      if (definitions.size > 1) {
        const places = [...definitions].map(([owner, location]) => `${NameUniquenessCheck.formatOwner(owner)} (${location})`);
        findings.push(`The style token "${token}" is defined by more than one owner: ${places.join(NameUniquenessCheck.LIST_SEPARATOR)}.`);
      }
    return findings;
  }

  private static checkPackageNames(files: readonly SourceFile[]): readonly string[] {
    const findings: string[] = [];
    const manifests = new Map<string, string[]>();
    for (const file of files) {
      let manifest: unknown;
      try {
        manifest = JSON.parse(file.text);
      } catch {
        findings.push(`${file.path}: the manifest is not valid JSON.`);
        continue;
      }
      const name = NameUniquenessCheck.readPackageName(manifest);
      if (name !== undefined)
        manifests.set(name, [...manifests.get(name) ?? [], file.path]);
    }

    for (const [name, places] of manifests)
      if (places.length > 1)
        findings.push(`The package name "${name}" is used by more than one manifest: ${places.join(NameUniquenessCheck.LIST_SEPARATOR)}.`);
    return findings;
  }

  private static checkModuleNames(declarations: readonly ModuleDeclaration[]): readonly string[] {
    const findings: string[] = [];
    const ids = new Map<string, string[]>();
    const names = new Map<string, string[]>();
    for (const declaration of declarations) {
      ids.set(declaration.id, [...ids.get(declaration.id) ?? [], declaration.file]);
      for (const [kind, contributed] of declaration.contributions)
        for (const name of contributed)
          names.set(name, [...names.get(name) ?? [], `${declaration.file} (${kind})`]);
    }

    for (const [id, places] of ids)
      if (places.length > 1)
        findings.push(`The module id "${id}" is declared more than once: ${places.join(NameUniquenessCheck.LIST_SEPARATOR)}.`);
    for (const [name, places] of names)
      if (places.length > 1)
        findings.push(`The contributed name "${name}" is declared more than once: ${places.join(NameUniquenessCheck.LIST_SEPARATOR)}.`);
    return findings;
  }

  private static readPackageName(manifest: unknown): string | undefined {
    if (typeof manifest !== "object" || manifest === null || !("name" in manifest) || typeof manifest.name !== "string")
      return undefined;
    return manifest.name;
  }

  private static formatPrefix(prefix: string, owner: string): string {
    return owner === SourceTree.SHELL_OWNER ? prefix : `${prefix}${owner}-`;
  }

  private static formatOwner(owner: string): string {
    return owner === SourceTree.SHELL_OWNER ? "the shell" : `module "${owner}"`;
  }
}
