/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Writable } from "node:stream";

import { type Node, type SourceFile, SyntaxKind } from "typescript/unstable/ast";
import { isBinaryExpression, isEqualityOperator, isIdentifier, isImportDeclaration, isLiteralTypeNode, isNoSubstitutionTemplateLiteral, isNullLiteral, isPropertyAccessExpression, isStringLiteral, isTypeOfExpression } from "typescript/unstable/ast/is";

import ApiException from "../api/api.exception.ts";
import type PackageCatalog from "../packages/package-catalog.ts";
import type PackageManifest from "../packages/package-manifest.ts";
import PackageException from "../packages/package.exception.ts";
import type RepositoryFiles from "../repository/repository-files.ts";
import type SyntaxTreeReader from "../structure/syntax-tree.reader.ts";
import type ICheck from "./interfaces/i-check.ts";

export default class FoundationValueCheck implements ICheck {
  private static readonly CORE: string = "@noldova/teamrun-foundation-core";
  private static readonly EXTENSIONS: ReadonlyMap<string, ReadonlySet<string>> = new Map([
    ["Object", new Set(["isUndefined", "isNull", "isNullOrUndefined", "isString", "isNumber", "isBoolean", "isObject", "isFunction"])],
    ["String", new Set(["empty", "isNullOrEmpty", "isNullOrWhitespace"])]
  ]);
  private static readonly SOURCE_FOLDER: string = "src";
  private static readonly SCRIPT_EXTENSION: string = ".ts";
  private static readonly DECLARATIONS: string = ".d.ts";
  private static readonly UNDEFINED: string = "undefined";
  private static readonly NULL: string = "null";
  private static readonly PURPOSE: string = "foundation-value-checks";
  private static readonly RULE: string = "CODING-STANDARDS.md section 3 has production packages use foundation's Object and String value checks and String.empty, importing @noldova/teamrun-foundation-core; foundation's core implements them natively.";

  private readonly files: RepositoryFiles;
  private readonly catalog: PackageCatalog;
  private readonly syntax: SyntaxTreeReader;

  public readonly title: string = "Foundation value checks";

  public constructor(files: RepositoryFiles, catalog: PackageCatalog, syntax: SyntaxTreeReader) {
    this.files = files;
    this.catalog = catalog;
    this.syntax = syntax;
  }

  public async runAsync(output: Writable): Promise<boolean> {
    let packages: readonly PackageManifest[];
    try {
      packages = await this.catalog.listPackagesAsync(false);
    }
    catch (error) {
      if (!(error instanceof PackageException))
        throw error;
      output.write(`${error.message}\n`);
      return false;
    }

    const sources = packages.filter(t => t.name !== FoundationValueCheck.CORE).map(t => `${t.directory}/${FoundationValueCheck.SOURCE_FOLDER}/`);
    const files = (await this.files.listAsync()).filter(t => t.endsWith(FoundationValueCheck.SCRIPT_EXTENSION) && !t.endsWith(FoundationValueCheck.DECLARATIONS) && sources.some(u => t.startsWith(u)));
    let findings: readonly string[];
    try {
      findings = await this.syntax.readAsync(FoundationValueCheck.PURPOSE, files, (t, u) => FoundationValueCheck.inspect(t, u));
    }
    catch (error) {
      if (!(error instanceof ApiException))
        throw error;
      findings = [error.message];
    }

    for (const finding of findings)
      output.write(`${finding}\n`);
    output.write(`Checked the value checks of ${files.length} production scripts in ${sources.length} packages.\n`);
    return findings.length === 0;
  }

  private static inspect(file: string, source: SourceFile): readonly string[] {
    const findings: string[] = [];
    let usesExtensions = false;
    const visit = (node: Node): void => {
      if (isLiteralTypeNode(node))
        return;
      const problem = FoundationValueCheck.describe(node, source);
      if (problem !== null)
        findings.push(`${file}:${source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1}: ${problem}; ${FoundationValueCheck.RULE}`);
      usesExtensions ||= FoundationValueCheck.isExtension(node);
      node.forEachChild(visit);
    };
    source.forEachChild(visit);
    if (usesExtensions && !source.statements.some(t => isImportDeclaration(t) && isStringLiteral(t.moduleSpecifier) && t.moduleSpecifier.text === FoundationValueCheck.CORE && t.importClause?.phaseModifier !== SyntaxKind.TypeKeyword))
      findings.push(`${file}: uses foundation's value checks without importing ${FoundationValueCheck.CORE}; ${FoundationValueCheck.RULE}`);
    return findings;
  }

  private static describe(node: Node, source: SourceFile): string | null {
    if ((isStringLiteral(node) || isNoSubstitutionTemplateLiteral(node)) && node.text.length === 0)
      return `${node.getText(source)} is an empty string literal`;
    if (!isBinaryExpression(node) || !isEqualityOperator(node.operatorToken.kind))
      return null;
    const operands = [node.left, node.right];
    if (operands.some(t => isNullLiteral(t)))
      return `${node.getText(source)} compares with ${FoundationValueCheck.NULL} natively`;
    if (operands.some(t => isIdentifier(t) && t.text === FoundationValueCheck.UNDEFINED))
      return `${node.getText(source)} compares with ${FoundationValueCheck.UNDEFINED} natively`;
    if (operands.some(t => isTypeOfExpression(t)))
      return `${node.getText(source)} compares a typeof result`;
    return null;
  }

  private static isExtension(node: Node): boolean {
    return isPropertyAccessExpression(node) && isIdentifier(node.expression) && isIdentifier(node.name)
      && FoundationValueCheck.EXTENSIONS.get(node.expression.text)?.has(node.name.text) === true;
  }
}
