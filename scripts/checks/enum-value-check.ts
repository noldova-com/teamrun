/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Writable } from "node:stream";

import type { Node, SourceFile } from "typescript/unstable/ast";
import { isEnumDeclaration, isIdentifier, isNoSubstitutionTemplateLiteral, isStringLiteral } from "typescript/unstable/ast/is";

import ApiException from "../api/api.exception.ts";
import type RepositoryFiles from "../repository/repository-files.ts";
import SourceTree from "../structure/source-tree.ts";
import type SyntaxTreeReader from "../structure/syntax-tree.reader.ts";
import type ICheck from "./interfaces/i-check.ts";

export default class EnumValueCheck implements ICheck {
  private static readonly SCRIPT_EXTENSION: string = ".ts";
  private static readonly SEGMENT_SEPARATOR: string = "/";
  private static readonly ROOTS: readonly string[] = ["src/", "scripts/"];
  private static readonly PURPOSE: string = "enum-values";
  private static readonly RULE: string = "CODING-STANDARDS.md section 10 has a string enum value match its member name, with a spelling fixed outside TeamRun mapped in the package's resources; tests and fixtures follow section 13.";

  private readonly files: RepositoryFiles;
  private readonly syntax: SyntaxTreeReader;

  public readonly title: string = "Enum values";

  public constructor(files: RepositoryFiles, syntax: SyntaxTreeReader) {
    this.files = files;
    this.syntax = syntax;
  }

  public async runAsync(output: Writable): Promise<boolean> {
    const files = (await this.files.listAsync()).filter(t => EnumValueCheck.isProductionScript(t));
    let findings: readonly string[];
    try {
      findings = await this.syntax.readAsync(EnumValueCheck.PURPOSE, files, (t, u) => EnumValueCheck.inspect(t, u));
    }
    catch (error) {
      if (!(error instanceof ApiException))
        throw error;
      findings = [error.message];
    }

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

  private static inspect(file: string, source: SourceFile): readonly string[] {
    const findings: string[] = [];
    const visit = (node: Node): void => {
      if (isEnumDeclaration(node))
        for (const member of node.members) {
          const value = member.initializer;
          if ((isIdentifier(member.name) || isStringLiteral(member.name)) && value !== undefined && (isStringLiteral(value) || isNoSubstitutionTemplateLiteral(value)) && value.text !== member.name.text)
            findings.push(`${file}:${source.getLineAndCharacterOfPosition(member.getStart(source)).line + 1}: ${node.name.text}.${member.name.text} has the value "${value.text}" instead of its name; ${EnumValueCheck.RULE}`);
        }
      node.forEachChild(visit);
    };
    source.forEachChild(visit);
    return findings;
  }
}
