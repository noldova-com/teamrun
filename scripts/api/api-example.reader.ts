/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ModifierFlags, type Project, type Symbol, SymbolFlags } from "typescript/unstable/async";
import type { Node } from "typescript/unstable/ast";

import ApiDocComment from "./api-doc-comment.ts";
import ApiExample from "./api-example.ts";
import ApiExamples from "./api-examples.ts";
import ApiValue from "./api-value.ts";
import ApiException from "./api.exception.ts";

export default class ApiExampleReader {
  private static readonly CALLABLE: number = SymbolFlags.Function | SymbolFlags.Method | SymbolFlags.Constructor;
  private static readonly CONTAINERS: number = SymbolFlags.Class | SymbolFlags.Interface | SymbolFlags.Module;
  private static readonly CONSTRUCTOR: string = "__constructor";
  private static readonly PROTOTYPE: string = "prototype";
  private static readonly CONSTRUCTOR_OWNER: string = "constructor";

  private readonly project: Project;

  public constructor(project: Project) {
    this.project = project;
  }

  public async readAsync(file: string): Promise<ApiExamples> {
    const source = await this.project.program.getSourceFile(file);
    const module = source === undefined ? undefined : await this.project.checker.getSymbolAtLocation(source);
    if (source === undefined || module === undefined)
      throw new ApiException(`${file} is not an ES module of the project.`);
    const examples: ApiExample[] = [];
    const undocumented: string[] = [];
    for (const [name, exported] of await module.getExports())
      await this.visitAsync(name, exported, source.fileName, examples, undocumented);
    return new ApiExamples(examples, undocumented);
  }

  private static collect(owner: string, declarations: readonly Node[], examples: ApiExample[], undocumented: string[]): void {
    const found = declarations.flatMap(t => (t.jsDoc ?? []).flatMap(doc => new ApiDocComment(doc.getText()).readExamples(owner)));
    if (found.length === 0)
      undocumented.push(owner);
    found.forEach((t, index) => examples.push(new ApiExample(owner, index + 1, t)));
  }

  private async visitAsync(path: string, exported: Symbol, fileName: string, examples: ApiExample[], undocumented: string[]): Promise<void> {
    const symbol = (exported.flags & SymbolFlags.Alias) === 0 ? exported : await this.project.checker.getAliasedSymbol(exported);
    const declarations = await Promise.all(symbol.declarations.map(async t => ApiValue.require(await t.resolve(this.project), "declaration")));
    const owned = declarations.filter(t => t.getSourceFile().fileName === fileName);
    if (owned.length === 0 || owned.some(t => (ApiValue.readModifierFlags(t) & ModifierFlags.Private) !== 0))
      return;
    if ((symbol.flags & ApiExampleReader.CALLABLE) !== 0)
      ApiExampleReader.collect(path, owned, examples, undocumented);
    if ((symbol.flags & ApiExampleReader.CONTAINERS) === 0)
      return;
    for (const [name, member] of await symbol.getMembers())
      if (name === ApiExampleReader.CONSTRUCTOR)
        await this.visitAsync(`${path}.${ApiExampleReader.CONSTRUCTOR_OWNER}`, member, fileName, examples, undocumented);
      else
        await this.visitAsync(`${path}#${name}`, member, fileName, examples, undocumented);
    for (const [name, member] of await symbol.getExports())
      if (name !== ApiExampleReader.PROTOTYPE)
        await this.visitAsync(`${path}.${name}`, member, fileName, examples, undocumented);
  }

}
