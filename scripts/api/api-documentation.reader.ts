/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import path from "node:path";

import type { Project } from "typescript/unstable/async";
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
  isJSDocThrowsTag,
  isMethodDeclaration,
  isMethodSignatureDeclaration,
  isTypePredicateNode,
  isVariableDeclaration
} from "typescript/unstable/ast/is";

import ApiSymbolWalker from "./api-symbol.walker.ts";
import type ApiVisibility from "./api-visibility.ts";

export default class ApiDocumentationReader {
  private static readonly THIS_PARAMETER: string = "this";
  private static readonly HYPHEN: string = "-";
  private static readonly LICENSE_TAG: string = "license";

  private readonly project: Project;
  private readonly walker: ApiSymbolWalker;
  private readonly root: string;

  public constructor(project: Project, visibility: ApiVisibility, root: string) {
    this.project = project;
    this.walker = new ApiSymbolWalker(project, visibility);
    this.root = root;
  }

  public async readAsync(file: string): Promise<readonly string[]> {
    const problems: string[] = [];
    await this.walker.walkAsync(file, (owner, _symbol, declarations) => this.inspectAsync(owner, declarations, problems));
    return problems;
  }

  private static isCallable(node: Node): node is SignatureDeclaration {
    return isFunctionDeclaration(node) || isMethodDeclaration(node) || isMethodSignatureDeclaration(node) || isConstructorDeclaration(node)
      || isCallSignatureDeclaration(node) || isConstructSignatureDeclaration(node);
  }

  private static readDocs(node: Node): readonly JSDoc[] {
    const owner = isVariableDeclaration(node) ? node.parent.parent : node;
    return (owner.jsDoc ?? []).filter(t => isJSDoc(t)).filter(t => !(t.tags ?? []).some(u => u.tagName.text ===ApiDocumentationReader.LICENSE_TAG));
  }

  private static isEmpty(comment: NodeArray<JSDocComment> | undefined): boolean {
    return comment === undefined || comment.every(t => isJSDocText(t) && t.text.trim() === "");
  }

  private static isThrowing(result: Node | undefined): boolean {
    return result !== undefined && (result.kind === SyntaxKind.NeverKeyword || isTypePredicateNode(result) && result.assertsModifier !== undefined);
  }

  private locate(node: Node): string {
    const file = node.getSourceFile();
    const line = file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1;
    return `${path.relative(this.root, file.fileName).split(path.sep).join("/")}:${line}`;
  }

  private async inspectAsync(owner: string, declarations: readonly Node[], problems: string[]): Promise<void> {
    const callables = declarations.filter(t => ApiDocumentationReader.isCallable(t));
    for (const [index, declaration] of callables.entries()) {
      const name = callables.length === 1 ? owner : `${owner} overload ${index + 1}`;
      const docs = ApiDocumentationReader.readDocs(declaration);
      if (docs.length === 0)
        problems.push(`${this.locate(declaration)}: ${name} has no JSDoc`);
      else
        this.inspectSignature(name, declaration, docs, problems);
      await this.inspectDocsAsync(name, docs, problems);
    }
    const others = declarations.filter(t => !ApiDocumentationReader.isCallable(t));
    const first = others[0];
    if (first !== undefined && others.every(t => ApiDocumentationReader.readDocs(t).length === 0))
      problems.push(`${this.locate(first)}: ${owner} has no JSDoc`);
    for (const declaration of others)
      await this.inspectDocsAsync(owner, ApiDocumentationReader.readDocs(declaration), problems);
  }

  private inspectSignature(name: string, declaration: SignatureDeclaration, docs: readonly JSDoc[], problems: string[]): void {
    const at = this.locate(declaration);
    const tags = docs.flatMap(t => [...t.tags ?? []]);
    const documented = tags.filter(t => isJSDocParameterTag(t)).map(t => t.name.getText());
    const parameters = declaration.parameters.map(t => t.name.getText()).filter(t => t !== ApiDocumentationReader.THIS_PARAMETER);
    for (const parameter of parameters.filter(t => !documented.includes(t)))
      problems.push(`${at}: ${name} has no @param for ${parameter}`);
    for (const parameter of documented.filter(t => !parameters.includes(t)))
      problems.push(`${at}: ${name} has a @param for ${parameter}, which is not a parameter`);
    if (ApiDocumentationReader.isThrowing(declaration.type)) {
      if (!tags.some(t => isJSDocThrowsTag(t)))
        problems.push(`${at}: ${name} has no @throws, which its never or asserts result needs`);
      return;
    }
    const hasResult = declaration.type !== undefined && declaration.type.kind !== SyntaxKind.VoidKeyword;
    const hasReturns = tags.some(t => isJSDocReturnTag(t));
    if (hasResult && !hasReturns)
      problems.push(`${at}: ${name} has no @returns`);
    if (!hasResult && hasReturns)
      problems.push(`${at}: ${name} has a @returns, but no result`);
  }

  private async inspectDocsAsync(name: string, docs: readonly JSDoc[], problems: string[]): Promise<void> {
    for (const doc of docs) {
      const file = doc.getSourceFile();
      if (file.getLineAndCharacterOfPosition(doc.getStart(file)).line === file.getLineAndCharacterOfPosition(doc.end).line)
        problems.push(`${this.locate(doc)}: ${name} has a single-line JSDoc`);
      const comments: JSDocComment[] = [...doc.comment];
      for (const tag of doc.tags ?? []) {
        const first = tag.comment?.[0];
        if (ApiDocumentationReader.isEmpty(tag.comment))
          problems.push(`${this.locate(tag)}: ${name} has an empty @${tag.tagName.text}`);
        else if (isJSDocParameterTag(tag) && first !== undefined && isJSDocText(first) && first.text.startsWith(ApiDocumentationReader.HYPHEN))
          problems.push(`${this.locate(tag)}: ${name} has a hyphen after @param ${tag.name.getText()}`);
        comments.push(...tag.comment ?? []);
      }
      for (const link of comments)
        await this.inspectLinkAsync(name, link, problems);
    }
  }

  private async inspectLinkAsync(name: string, comment: JSDocComment, problems: string[]): Promise<void> {
    if (!isJSDocLink(comment) && !isJSDocLinkCode(comment) && !isJSDocLinkPlain(comment))
      return;
    if (comment.name === undefined || await this.project.checker.getSymbolAtLocation(comment.name) === undefined)
      problems.push(`${this.locate(comment)}: ${name} has a link that does not resolve: ${comment.getText()}`);
  }
}
