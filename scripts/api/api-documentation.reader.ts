/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ModifierFlags, type Project, type Symbol, SymbolFlags } from "typescript/unstable/async";
import { type JSDoc, type JSDocComment, type Node, type NodeArray, type SignatureDeclaration, SyntaxKind } from "typescript/unstable/ast";
import {
  isCallSignatureDeclaration,
  isConstructSignatureDeclaration,
  isConstructorDeclaration,
  isFunctionDeclaration,
  isJSDoc,
  isJSDocLink,
  isJSDocLinkCode,
  isJSDocLinkPlain,
  isJSDocParameterTag,
  isJSDocReturnTag,
  isJSDocText,
  isMethodDeclaration,
  isMethodSignatureDeclaration,
  isTypePredicateNode,
  isVariableDeclaration
} from "typescript/unstable/ast/is";

import ApiValue from "./api-value.ts";
import type ApiVisibility from "./api-visibility.ts";
import ApiException from "./api.exception.ts";

export default class ApiDocumentationReader {
  private static readonly CONTAINERS: number = SymbolFlags.Class | SymbolFlags.Interface | SymbolFlags.Module | SymbolFlags.Enum;
  private static readonly CONSTRUCTOR: string = "__constructor";
  private static readonly PROTOTYPE: string = "prototype";
  private static readonly CONSTRUCTOR_OWNER: string = "constructor";
  private static readonly THIS_PARAMETER: string = "this";
  private static readonly HYPHEN: string = "-";
  private static readonly LICENSE_TAG: string = "license";

  private readonly project: Project;
  private readonly hidden: number;

  public constructor(project: Project, visibility: ApiVisibility) {
    this.project = project;
    this.hidden = visibility.includesProtected ? ModifierFlags.Private : ModifierFlags.Private | ModifierFlags.Protected;
  }

  public async readAsync(file: string): Promise<readonly string[]> {
    const source = await this.project.program.getSourceFile(file);
    const module = source === undefined ? undefined : await this.project.checker.getSymbolAtLocation(source);
    if (source === undefined || module === undefined)
      throw new ApiException(`${file} is not an ES module of the project.`);
    const problems: string[] = [];
    for (const [name, exported] of await module.getExports())
      await this.visitAsync(name, exported, source.fileName, problems);
    return problems;
  }

  private static isCallable(node: Node): node is SignatureDeclaration {
    return isFunctionDeclaration(node) || isMethodDeclaration(node) || isMethodSignatureDeclaration(node) || isConstructorDeclaration(node)
      || isCallSignatureDeclaration(node) || isConstructSignatureDeclaration(node);
  }

  private static readDocs(node: Node): readonly JSDoc[] {
    const owner = isVariableDeclaration(node) ? node.parent.parent : node;
    return (owner.jsDoc ?? []).filter(t => isJSDoc(t)).filter(t => !(t.tags ?? []).some(tag => tag.tagName.text === ApiDocumentationReader.LICENSE_TAG));
  }

  private static isEmpty(comment: NodeArray<JSDocComment> | undefined): boolean {
    return comment === undefined || comment.every(t => isJSDocText(t) && t.text.trim() === "");
  }

  private static inspectSignature(path: string, declaration: SignatureDeclaration, docs: readonly JSDoc[], problems: string[]): void {
    const tags = docs.flatMap(t => [...t.tags ?? []]);
    const documented = tags.filter(t => isJSDocParameterTag(t)).map(t => t.name.getText());
    const parameters = declaration.parameters.map(t => t.name.getText()).filter(t => t !== ApiDocumentationReader.THIS_PARAMETER);
    for (const name of parameters.filter(t => !documented.includes(t)))
      problems.push(`${path} has no @param for ${name}`);
    for (const name of documented.filter(t => !parameters.includes(t)))
      problems.push(`${path} has a @param for ${name}, which is not a parameter`);
    const result = declaration.type;
    if (result !== undefined && (result.kind === SyntaxKind.NeverKeyword || isTypePredicateNode(result) && result.assertsModifier !== undefined))
      return;
    const hasResult = result !== undefined && result.kind !== SyntaxKind.VoidKeyword;
    const hasReturns = tags.some(t => isJSDocReturnTag(t));
    if (hasResult && !hasReturns)
      problems.push(`${path} has no @returns`);
    if (!hasResult && hasReturns)
      problems.push(`${path} has a @returns, but no result`);
  }

  private async visitAsync(path: string, exported: Symbol, fileName: string, problems: string[]): Promise<void> {
    const symbol = (exported.flags & SymbolFlags.Alias) === 0 ? exported : await this.project.checker.getAliasedSymbol(exported);
    if ((symbol.flags & SymbolFlags.TypeParameter) !== 0)
      return;
    const declarations = await Promise.all(symbol.declarations.map(async t => ApiValue.require(await t.resolve(this.project), "declaration")));
    const owned = declarations.filter(t => t.getSourceFile().fileName === fileName);
    if (owned.length === 0 || owned.some(t => (ApiValue.readModifierFlags(t) & this.hidden) !== 0))
      return;
    const callables = owned.filter(t => ApiDocumentationReader.isCallable(t));
    for (const [index, declaration] of callables.entries()) {
      const owner = callables.length === 1 ? path : `${path} overload ${index + 1}`;
      const docs = ApiDocumentationReader.readDocs(declaration);
      if (docs.length === 0)
        problems.push(`${owner} has no JSDoc`);
      else
        ApiDocumentationReader.inspectSignature(owner, declaration, docs, problems);
      await this.inspectDocsAsync(owner, docs, problems);
    }
    const others = owned.filter(t => !ApiDocumentationReader.isCallable(t));
    if (others.length > 0 && others.every(t => ApiDocumentationReader.readDocs(t).length === 0))
      problems.push(`${path} has no JSDoc`);
    for (const declaration of others)
      await this.inspectDocsAsync(path, ApiDocumentationReader.readDocs(declaration), problems);
    if ((symbol.flags & ApiDocumentationReader.CONTAINERS) === 0)
      return;
    for (const [name, member] of await symbol.getMembers())
      await this.visitAsync(name === ApiDocumentationReader.CONSTRUCTOR ? `${path}.${ApiDocumentationReader.CONSTRUCTOR_OWNER}` : `${path}#${name}`, member, fileName, problems);
    for (const [name, member] of await symbol.getExports())
      if (name !== ApiDocumentationReader.PROTOTYPE)
        await this.visitAsync(`${path}.${name}`, member, fileName, problems);
  }

  private async inspectDocsAsync(path: string, docs: readonly JSDoc[], problems: string[]): Promise<void> {
    for (const doc of docs) {
      const file = doc.getSourceFile();
      if (file.getLineAndCharacterOfPosition(doc.getStart(file)).line === file.getLineAndCharacterOfPosition(doc.end).line)
        problems.push(`${path} has a single-line JSDoc`);
      const comments: JSDocComment[] = [...doc.comment];
      for (const tag of doc.tags ?? []) {
        const first = tag.comment?.[0];
        if (ApiDocumentationReader.isEmpty(tag.comment))
          problems.push(`${path} has an empty @${tag.tagName.text}`);
        else if (isJSDocParameterTag(tag) && first !== undefined && isJSDocText(first) && first.text.startsWith(ApiDocumentationReader.HYPHEN))
          problems.push(`${path} has a hyphen after @param ${tag.name.getText()}`);
        comments.push(...tag.comment ?? []);
      }
      for (const link of comments)
        await this.inspectLinkAsync(path, link, problems);
    }
  }

  private async inspectLinkAsync(path: string, comment: JSDocComment, problems: string[]): Promise<void> {
    if (!isJSDocLink(comment) && !isJSDocLinkCode(comment) && !isJSDocLinkPlain(comment))
      return;
    if (comment.name === undefined || await this.project.checker.getSymbolAtLocation(comment.name) === undefined)
      problems.push(`${path} has a link that does not resolve: ${comment.getText()}`);
  }
}
