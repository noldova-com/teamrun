/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Writable } from "node:stream";

import ts from "typescript";

import type { RepositoryFiles } from "../repository/repository-files.ts";
import { SourceTree } from "../structure/source-tree.ts";
import type { SyntaxTreeReader } from "../structure/syntax-tree.reader.ts";
import type { ICheck } from "./interfaces/i-check.ts";

export class EnumValueCheck implements ICheck {
  private static readonly SCRIPT_EXTENSION: string = ".ts";
  private static readonly SEGMENT_SEPARATOR: string = "/";
  private static readonly ROOTS: readonly string[] = ["src/", "scripts/"];
  private static readonly RULE: string = "https://github.com/noldova-com/.github/blob/main/standards/CODE.md, Naming, has a string enum value match its member name, with a spelling fixed outside Noldova mapped in the package's resources; tests and fixtures follow https://github.com/noldova-com/.github/blob/main/standards/TESTING.md, Tests and production code.";

  private readonly files: RepositoryFiles;
  private readonly syntax: SyntaxTreeReader;

  public readonly title: string = "Enum values";

  public constructor(files: RepositoryFiles, syntax: SyntaxTreeReader) {
    this.files = files;
    this.syntax = syntax;
  }

  public async runAsync(output: Writable): Promise<boolean> {
    const files = (await this.files.listAsync()).filter(t => EnumValueCheck.isProductionScript(t));
    const findings = await this.syntax.readAsync(files, (t, u) => EnumValueCheck.inspect(t, u));

    for (const finding of findings)
      output.write(`${finding}\n`);
    output.write(`Checked the enum values of ${files.length} production scripts.\n`);
    return findings.length === 0;
  }

  private static isProductionScript(file: string): boolean {
    return file.endsWith(EnumValueCheck.SCRIPT_EXTENSION)
      && EnumValueCheck.ROOTS.some(t => file.startsWith(t))
      && !file.split(EnumValueCheck.SEGMENT_SEPARATOR).some(t => SourceTree.TEST_FOLDERS.has(t));
  }

  private static inspect(file: string, source: ts.SourceFile): readonly string[] {
    const findings: string[] = [];
    const visit = (node: ts.Node): void => {
      if (ts.isEnumDeclaration(node))
        for (const member of node.members) {
          const value = member.initializer;
          if ((ts.isIdentifier(member.name) || ts.isStringLiteral(member.name)) && value !== undefined && (ts.isStringLiteral(value) || ts.isNoSubstitutionTemplateLiteral(value)) && value.text !== member.name.text)
            findings.push(`${file}:${source.getLineAndCharacterOfPosition(member.getStart(source)).line + 1}: ${node.name.text}.${member.name.text} has the value "${value.text}" instead of its name; ${EnumValueCheck.RULE}`);
        }
      node.forEachChild(visit);
    };
    source.forEachChild(visit);
    return findings;
  }
}
