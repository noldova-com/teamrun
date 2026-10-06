/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import path from "node:path";
import type { Writable } from "node:stream";

import type SourceFile from "../structure/source-file.ts";
import SourceScanner from "../structure/source-scanner.ts";
import type SourceTree from "../structure/source-tree.ts";
import type ICheck from "./interfaces/i-check.ts";

export default class DeclaredDependencyCheck implements ICheck {
  private static readonly RELATIVE_PREFIXES: readonly string[] = [".", "/"];
  private static readonly BUILT_IN_PREFIX: string = "node:";
  private static readonly SCOPE_MARKER: string = "@";
  private static readonly SEPARATOR: string = "/";
  private static readonly DEPENDENCY_FIELDS: readonly string[] = ["dependencies", "peerDependencies", "optionalDependencies"];
  private static readonly NAME_FIELD: string = "name";

  private readonly tree: SourceTree;

  public readonly title: string = "Declared dependencies";

  public constructor(tree: SourceTree) {
    this.tree = tree;
  }

  public async runAsync(output: Writable): Promise<boolean> {
    const inventory = await this.tree.readAsync();
    const manifests = new Map<string, ReadonlySet<string>>();
    for (const file of inventory.files.filter(t => t.isManifest && t.isProduction)) {
      const declared = DeclaredDependencyCheck.readDeclared(file.text);
      if (declared !== null)
        manifests.set(path.posix.dirname(file.path), declared);
    }

    const findings: string[] = [];
    let checked = 0;
    for (const file of inventory.files.filter(t => t.isProduction && t.isScript)) {
      const declared = manifests.get(file.packageRoot);
      if (declared === undefined)
        continue;
      checked++;
      for (const literal of new SourceScanner(file.text).scan().imports) {
        const packageName = DeclaredDependencyCheck.readPackageName(literal.value);
        if (packageName !== null && !declared.has(packageName))
          findings.push(DeclaredDependencyCheck.formatFinding(file, literal.line, literal.value, packageName));
      }
    }

    for (const finding of findings)
      output.write(`${finding}\n`);
    output.write(`Checked the imports of ${checked} production script files of ${manifests.size} packages.\n`);
    return findings.length === 0;
  }

  private static readDeclared(text: string): ReadonlySet<string> | null {
    let manifest: unknown;
    try {
      manifest = JSON.parse(text);
    } catch {
      return null;
    }
    if (typeof manifest !== "object" || manifest === null || Array.isArray(manifest))
      return null;

    const declared = new Set<string>();
    const record = new Map(Object.entries(manifest));
    const name = record.get(DeclaredDependencyCheck.NAME_FIELD);
    if (typeof name === "string")
      declared.add(name);
    for (const field of DeclaredDependencyCheck.DEPENDENCY_FIELDS) {
      const dependencies = record.get(field);
      if (typeof dependencies === "object" && dependencies !== null)
        for (const dependency of Object.keys(dependencies))
          declared.add(dependency);
    }
    return declared;
  }

  private static readPackageName(specifier: string): string | null {
    if (DeclaredDependencyCheck.RELATIVE_PREFIXES.some(t => specifier.startsWith(t)) || specifier.startsWith(DeclaredDependencyCheck.BUILT_IN_PREFIX))
      return null;
    const segments = specifier.split(DeclaredDependencyCheck.SEPARATOR);
    return segments.slice(0, specifier.startsWith(DeclaredDependencyCheck.SCOPE_MARKER) ? 2 : 1).join(DeclaredDependencyCheck.SEPARATOR);
  }

  private static formatFinding(file: SourceFile, line: number, specifier: string, packageName: string): string {
    return `${file.formatLocation(line)}: the import "${specifier}" uses "${packageName}", which ${file.packageRoot}/package.json does not declare; a package imports only what its manifest declares.`;
  }
}
