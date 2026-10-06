/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Writable } from "node:stream";

import { type ClassDeclaration, type Node, type SourceFile, SyntaxKind } from "typescript/unstable/ast";
import { isClassDeclaration, isIdentifier, isNoSubstitutionTemplateLiteral, isPropertyAccessExpression, isPropertyDeclaration, isStringLiteral } from "typescript/unstable/ast/is";

import ApiException from "../api/api.exception.ts";
import type RepositoryFiles from "../repository/repository-files.ts";
import SourceTree from "../structure/source-tree.ts";
import type SyntaxTreeReader from "../structure/syntax-tree.reader.ts";
import type ICheck from "./interfaces/i-check.ts";

export default class ExceptionNameCheck implements ICheck {
  private static readonly SCRIPT_EXTENSION: string = ".ts";
  private static readonly DECLARATIONS: string = ".d.ts";
  private static readonly SEGMENT_SEPARATOR: string = "/";
  private static readonly ROOT: string = "src/";
  private static readonly EXCEPTION_SUFFIX: string = "Exception";
  private static readonly NAME_MEMBER: string = "name";
  private static readonly PURPOSE: string = "exception-names";
  private static readonly RULE: string = "CODING-STANDARDS.md section 10 has each exception class set name to its own class name, written out, because a minified build renames classes.";

  private readonly files: RepositoryFiles;
  private readonly syntax: SyntaxTreeReader;

  public readonly title: string = "Exception names";

  public constructor(files: RepositoryFiles, syntax: SyntaxTreeReader) {
    this.files = files;
    this.syntax = syntax;
  }

  public async runAsync(output: Writable): Promise<boolean> {
    const files = (await this.files.listAsync()).filter(t => ExceptionNameCheck.isProductionSource(t));
    let findings: readonly string[];
    try {
      findings = await this.syntax.readAsync(ExceptionNameCheck.PURPOSE, files, (t, u) => ExceptionNameCheck.inspect(t, u));
    }
    catch (error) {
      if (!(error instanceof ApiException))
        throw error;
      findings = [error.message];
    }

    for (const finding of findings)
      output.write(`${finding}\n`);
    output.write(`Checked the exception names of ${files.length} production sources.\n`);
    return findings.length === 0;
  }

  private static isProductionSource(file: string): boolean {
    return file.endsWith(ExceptionNameCheck.SCRIPT_EXTENSION)
      && !file.endsWith(ExceptionNameCheck.DECLARATIONS)
      && file.startsWith(ExceptionNameCheck.ROOT)
      && !file.split(ExceptionNameCheck.SEGMENT_SEPARATOR).some(t => SourceTree.TEST_FOLDERS.has(t));
  }

  private static inspect(file: string, source: SourceFile): readonly string[] {
    const findings: string[] = [];
    const visit = (node: Node): void => {
      if (isClassDeclaration(node) && node.name !== undefined && ExceptionNameCheck.isConcreteException(node)) {
        const className = node.name.text;
        const found = ExceptionNameCheck.readName(node);
        const location = `${file}:${source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1}`;
        if (found === undefined)
          findings.push(`${location}: ${className} does not set its name; declare public override readonly name: string = "${className}"; ${ExceptionNameCheck.RULE}`);
        else if (found !== className)
          findings.push(`${location}: ${className} sets its name to ${found === null ? "a value other than a string" : `"${found}"`} instead of "${className}"; ${ExceptionNameCheck.RULE}`);
      }
      node.forEachChild(visit);
    };
    source.forEachChild(visit);
    return findings;
  }

  private static isConcreteException(declaration: ClassDeclaration): boolean {
    if ((declaration.modifiers ?? []).some(t => t.kind === SyntaxKind.AbstractKeyword))
      return false;
    const base = declaration.heritageClauses?.find(t => t.token === SyntaxKind.ExtendsKeyword)?.types.at(0)?.expression;
    const baseName = base === undefined ? null : isIdentifier(base) ? base.text : isPropertyAccessExpression(base) ? base.name.text : null;
    return baseName !== null && baseName.endsWith(ExceptionNameCheck.EXCEPTION_SUFFIX);
  }

  private static readName(declaration: ClassDeclaration): string | null | undefined {
    const member = declaration.members.filter(t => isPropertyDeclaration(t)).find(t => isIdentifier(t.name) && t.name.text === ExceptionNameCheck.NAME_MEMBER);
    if (member === undefined)
      return undefined;
    const value = member.initializer;
    return value !== undefined && (isStringLiteral(value) || isNoSubstitutionTemplateLiteral(value)) ? value.text : null;
  }
}
