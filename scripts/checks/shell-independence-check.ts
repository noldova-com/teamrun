/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Writable } from "node:stream";

import ModuleNameMatcher from "../structure/module-name-matcher.ts";
import type SourceFile from "../structure/source-file.ts";
import SourceScanner from "../structure/source-scanner.ts";
import SourceTree from "../structure/source-tree.ts";
import type ICheck from "./interfaces/check.ts";

export default class ShellIndependenceCheck implements ICheck {
  private static readonly LINE_SEPARATOR: string = "\n";

  private readonly tree: SourceTree;

  public readonly title: string = "Shell names no module";

  public constructor(tree: SourceTree) {
    this.tree = tree;
  }

  public async runAsync(output: Writable): Promise<boolean> {
    const inventory = await this.tree.readAsync();
    const matcher = new ModuleNameMatcher(inventory.moduleIds);
    const files = inventory.files.filter(t => t.owner === SourceTree.SHELL_OWNER && t.isProduction);
    const findings = files.flatMap(t => ShellIndependenceCheck.findModuleNames(t, matcher));
    for (const finding of findings)
      output.write(`${finding}\n`);
    output.write(`Checked ${files.length} production files of the shell against ${inventory.moduleIds.length} modules.\n`);
    return findings.length === 0;
  }

  private static findModuleNames(file: SourceFile, matcher: ModuleNameMatcher): readonly string[] {
    const findings: string[] = [];
    if (file.isScript || file.isJson) {
      const source = new SourceScanner(file.text).scan();
      for (const literal of [...source.imports, ...source.selectors, ...source.texts].sort((first, second) => first.line - second.line)) {
        const name = matcher.findInLiteral(literal.value);
        if (name !== null)
          findings.push(ShellIndependenceCheck.formatFinding(file, literal.line, name));
      }
      return findings;
    }

    file.text.split(ShellIndependenceCheck.LINE_SEPARATOR).forEach((line, index) => {
      const name = matcher.findInText(line);
      if (name !== null)
        findings.push(ShellIndependenceCheck.formatFinding(file, index + 1, name));
    });
    return findings;
  }

  private static formatFinding(file: SourceFile, line: number, name: string): string {
    return `${file.formatLocation(line)}: names ${name}; the shell's production source names no module.`;
  }
}
