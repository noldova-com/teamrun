/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ModifierFlags, NodeBuilderFlags, type Project, type Signature, SignatureKind, type Symbol, SymbolFlags, type Type } from "typescript/unstable/async";
import type { Node, ParameterDeclaration, TypeNode, TypeParameterDeclaration } from "typescript/unstable/ast";
import {
  isClassDeclaration,
  isInterfaceDeclaration,
  isSignatureDeclaration,
  isTypeAliasDeclaration,
  isTypePredicateNode
} from "typescript/unstable/ast/is";

import ApiSurface from "./api-surface.ts";
import ApiValue from "./api-value.ts";
import type ApiVisibility from "./api-visibility.ts";
import ApiException from "./api.exception.ts";

export default class ApiSurfaceReader {
  private static readonly TYPE_FLAGS: number = NodeBuilderFlags.NoTruncation | NodeBuilderFlags.InTypeAlias;
  private static readonly KINDS: ReadonlyMap<number, string> = new Map([
    [SymbolFlags.Class, "class"],
    [SymbolFlags.Interface, "interface"],
    [SymbolFlags.TypeAlias, "type"],
    [SymbolFlags.Function, "function"],
    [SymbolFlags.Variable, "variable"],
    [SymbolFlags.Property, "property"],
    [SymbolFlags.Method, "method"],
    [SymbolFlags.GetAccessor, "get"],
    [SymbolFlags.SetAccessor, "set"],
    [SymbolFlags.RegularEnum, "enum"],
    [SymbolFlags.ConstEnum, "const enum"],
    [SymbolFlags.EnumMember, "member"],
    [SymbolFlags.Module, "namespace"],
    [SymbolFlags.Optional, "optional"]
  ]);
  private static readonly MODIFIERS: ReadonlyMap<number, string> = new Map([
    [ModifierFlags.Protected, "protected"],
    [ModifierFlags.Static, "static"],
    [ModifierFlags.Abstract, "abstract"],
    [ModifierFlags.Readonly, "readonly"],
    [ModifierFlags.Accessor, "accessor"]
  ]);
  private static readonly HIDDEN_MEMBERS: ReadonlySet<string> = new Set(["prototype", "__constructor"]);
  private static readonly VALUE_KINDS: number = SymbolFlags.Variable | SymbolFlags.Property | SymbolFlags.Accessor;
  private static readonly CALLABLE_KINDS: number = SymbolFlags.Function | SymbolFlags.Method;
  private static readonly CONSTRUCTOR_PATH: string = "constructor";
  private static readonly IMPLICIT_CONSTRUCTOR: string = "()";

  private readonly project: Project;
  private readonly hidden: number;

  public constructor(project: Project, visibility: ApiVisibility) {
    this.project = project;
    this.hidden = visibility.includesProtected ? ModifierFlags.Private : ModifierFlags.Private | ModifierFlags.Protected;
  }

  public async readAsync(file: string): Promise<ApiSurface> {
    const source = await this.project.program.getSourceFile(file);
    const module = source === undefined ? undefined : await this.project.checker.getSymbolAtLocation(source);
    if (module === undefined)
      throw new ApiException(`${file} is not an ES module of the project.`);
    const entries = new Map<string, string>();
    for (const [name, exported] of await module.getExports())
      await this.describeAsync(name, exported, entries);
    return new ApiSurface(entries);
  }

  private async describeAsync(path: string, exported: Symbol, entries: Map<string, string>): Promise<void> {
    const symbol = (exported.flags & SymbolFlags.Alias) === 0 ? exported : await this.project.checker.getAliasedSymbol(exported);
    const declarations = await this.resolveAsync(symbol);
    const flags = declarations.reduce((all, t) => all | ApiValue.readModifierFlags(t), ModifierFlags.None);
    if ((flags & this.hidden) !== 0 || (symbol.flags & SymbolFlags.TypeParameter) !== 0)
      return;
    const kinds = [...ApiSurfaceReader.KINDS].filter(([flag]) => (symbol.flags & flag) !== 0).map(([, name]) => name);
    const modifiers = [...ApiSurfaceReader.MODIFIERS].filter(([flag]) => (flags & flag) !== 0).map(([, name]) => name);
    entries.set(path, [...kinds, ...modifiers, await this.describeDetailAsync(symbol, declarations)].filter(t => t !== "").join(" "));
    if ((symbol.flags & ApiSurfaceReader.CALLABLE_KINDS) !== 0)
      await this.describeSignaturesAsync(path, symbol, SignatureKind.Call, entries);
    if ((symbol.flags & SymbolFlags.Class) !== 0)
      await this.describeSignaturesAsync(`${path}.${ApiSurfaceReader.CONSTRUCTOR_PATH}`, symbol, SignatureKind.Construct, entries);
    if ((symbol.flags & (SymbolFlags.Class | SymbolFlags.Enum | SymbolFlags.Module)) !== 0)
      for (const [name, member] of await symbol.getExports())
        if (!ApiSurfaceReader.HIDDEN_MEMBERS.has(name))
          await this.describeAsync(`${path}.${name}`, member, entries);
    if ((symbol.flags & (SymbolFlags.Class | SymbolFlags.Interface)) !== 0)
      for (const [name, member] of await symbol.getMembers())
        if (!ApiSurfaceReader.HIDDEN_MEMBERS.has(name))
          await this.describeAsync(`${path}#${name}`, member, entries);
  }

  private async describeDetailAsync(symbol: Symbol, declarations: readonly Node[]): Promise<string> {
    const checker = this.project.checker;
    if ((symbol.flags & ApiSurfaceReader.VALUE_KINDS) !== 0)
      return `: ${await this.printAsync(ApiValue.require(await checker.getTypeOfSymbol(symbol), "type"))}`;
    if ((symbol.flags & SymbolFlags.EnumMember) !== 0)
      return `= ${JSON.stringify(await checker.getConstantValue(ApiValue.require(declarations[0], "declaration")))}`;
    if ((symbol.flags & ApiSurfaceReader.CALLABLE_KINDS) !== 0)
      return "";
    const parameters = await this.describeTypeParametersAsync(declarations.flatMap(t =>
      isClassDeclaration(t) || isInterfaceDeclaration(t) || isTypeAliasDeclaration(t) ? t.typeParameters ?? [] : []));
    const declared = await checker.getDeclaredTypeOfSymbol(symbol);
    if ((symbol.flags & SymbolFlags.TypeAlias) !== 0)
      return `${parameters} = ${await this.printAsync(declared)}`;
    const bases = declared.isClassOrInterface() ? ApiValue.require(await declared.getBaseTypes(), "base types") : [];
    const names = await Promise.all(bases.map(t => this.printAsync(t)));
    return [parameters, names.length === 0 ? "" : `extends ${names.join(", ")}`].filter(t => t !== "").join(" ");
  }

  private async describeSignaturesAsync(path: string, symbol: Symbol, kind: SignatureKind, entries: Map<string, string>): Promise<void> {
    const type = ApiValue.require(await this.project.checker.getTypeOfSymbol(symbol), "type");
    for (const [index, signature] of (await this.project.checker.getSignaturesOfType(type, kind)).entries())
      entries.set(`${path}(${index})`, await this.describeSignatureAsync(signature));
  }

  private async describeSignatureAsync(signature: Signature): Promise<string> {
    const prefix = signature.isAbstract ? "abstract new " : signature.isConstruct ? "new " : "";
    const declaration = signature.declaration === undefined ? undefined : ApiValue.require(await signature.declaration.resolve(this.project), "declaration");
    if (declaration === undefined || !isSignatureDeclaration(declaration))
      return `${prefix}${ApiSurfaceReader.IMPLICIT_CONSTRUCTOR}`;
    const flags = ApiValue.readModifierFlags(declaration);
    if ((flags & ModifierFlags.Private) !== 0)
      return `private ${prefix}${ApiSurfaceReader.IMPLICIT_CONSTRUCTOR}`;
    const visibility = (flags & ModifierFlags.Protected) === 0 ? "" : "protected ";
    const parameters = await Promise.all(declaration.parameters.map(t => this.describeParameterAsync(t)));
    const returned = declaration.type !== undefined && isTypePredicateNode(declaration.type)
      ? await this.project.emitter.printNode(declaration.type)
      : await this.printAsync(ApiValue.require(await this.project.checker.getReturnTypeOfSignature(signature), "return type"));
    return `${visibility}${prefix}${await this.describeTypeParametersAsync(declaration.typeParameters ?? [])}(${parameters.join(", ")}): ${returned}`;
  }

  private async describeParameterAsync(parameter: ParameterDeclaration): Promise<string> {
    const checker = this.project.checker;
    const type = parameter.type === undefined ? await checker.getTypeAtLocation(parameter) : await checker.getTypeFromTypeNode(parameter.type);
    const isOptional = parameter.questionToken !== undefined || parameter.initializer !== undefined;
    return [
      parameter.dotDotDotToken === undefined ? "" : "...",
      await this.project.emitter.printNode(parameter.name),
      isOptional ? "?" : "",
      `: ${await this.printAsync(ApiValue.require(type, "parameter type"))}`
    ].join("");
  }

  private async describeTypeParametersAsync(parameters: readonly TypeParameterDeclaration[]): Promise<string> {
    const descriptions: string[] = [];
    for (const parameter of parameters) {
      const constraint = parameter.constraint === undefined ? "" : ` extends ${await this.printNodeTypeAsync(parameter.constraint)}`;
      const fallback = parameter.defaultType === undefined ? "" : ` = ${await this.printNodeTypeAsync(parameter.defaultType)}`;
      descriptions.push(`${parameter.name.text}${constraint}${fallback}`);
    }
    return descriptions.length === 0 ? "" : `<${descriptions.join(", ")}>`;
  }

  private async printNodeTypeAsync(node: TypeNode): Promise<string> {
    return await this.printAsync(ApiValue.require(await this.project.checker.getTypeFromTypeNode(node), "type"));
  }

  private async printAsync(type: Type): Promise<string> {
    return await this.project.checker.typeToString(type, undefined, ApiSurfaceReader.TYPE_FLAGS);
  }

  private async resolveAsync(symbol: Symbol): Promise<readonly Node[]> {
    const nodes = await Promise.all(symbol.declarations.map(t => t.resolve(this.project)));
    return nodes.map(t => ApiValue.require(t, "declaration"));
  }
}
