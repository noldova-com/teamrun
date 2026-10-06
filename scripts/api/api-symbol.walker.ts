/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ModifierFlags, type Project, type Symbol, SymbolFlags } from "typescript/unstable/async";

import ApiValue from "./api-value.ts";
import type ApiVisibility from "./api-visibility.ts";
import ApiException from "./api.exception.ts";
import type IApiSymbolVisitor from "./interfaces/api-symbol-visitor.ts";

export default class ApiSymbolWalker {
  private static readonly CONTAINERS: number = SymbolFlags.Class | SymbolFlags.Interface | SymbolFlags.Module | SymbolFlags.Enum;
  private static readonly PROTOTYPE: string = "prototype";
  private static readonly MEMBER_NAMES: ReadonlyMap<string, string> = new Map([
    ["__constructor", ".constructor"],
    ["__call", " call signature"],
    ["__new", " construct signature"],
    ["__index", " index signature"]
  ]);

  private readonly project: Project;
  private readonly hidden: number;

  public constructor(project: Project, visibility: ApiVisibility) {
    this.project = project;
    this.hidden = visibility.includesProtected ? ModifierFlags.Private : ModifierFlags.Private | ModifierFlags.Protected;
  }

  public async walkAsync(file: string, visit: IApiSymbolVisitor): Promise<void> {
    const source = await this.project.program.getSourceFile(file);
    const module = source === undefined ? undefined : await this.project.checker.getSymbolAtLocation(source);
    if (source === undefined || module === undefined)
      throw new ApiException(`${file} is not an ES module of the project.`);
    for (const [name, exported] of await module.getExports())
      await this.visitAsync(name, exported, source.fileName, visit);
  }

  private static nameMember(path: string, name: string): string {
    const special = ApiSymbolWalker.MEMBER_NAMES.get(name);
    return special === undefined ? `${path}#${name}` : `${path}${special}`;
  }

  private async visitAsync(path: string, exported: Symbol, fileName: string, visit: IApiSymbolVisitor): Promise<void> {
    const symbol = (exported.flags & SymbolFlags.Alias) === 0 ? exported : await this.project.checker.getAliasedSymbol(exported);
    if ((symbol.flags & SymbolFlags.TypeParameter) !== 0)
      return;
    const declarations = await Promise.all(symbol.declarations.map(async t => ApiValue.require(await t.resolve(this.project), "declaration")));
    const owned = declarations.filter(t => t.getSourceFile().fileName === fileName);
    if (owned.length === 0 || owned.some(t => (ApiValue.readModifierFlags(t) & this.hidden) !== 0))
      return;
    await visit(path, symbol, owned);
    if ((symbol.flags & ApiSymbolWalker.CONTAINERS) === 0)
      return;
    for (const [name, member] of await symbol.getMembers())
      await this.visitAsync(ApiSymbolWalker.nameMember(path, name), member, fileName, visit);
    for (const [name, member] of await symbol.getExports())
      if (name !== ApiSymbolWalker.PROTOTYPE)
        await this.visitAsync(`${path}.${name}`, member, fileName, visit);
  }
}
