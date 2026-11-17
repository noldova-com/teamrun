/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Writable } from "node:stream";

import ts from "typescript";

import { PackageNaming } from "../packages/package-naming.ts";
import type { RepositoryFiles } from "../repository/repository-files.ts";
import { SourceTree } from "../structure/source-tree.ts";
import type { SyntaxTreeReader } from "../structure/syntax-tree.reader.ts";
import type { ICheck } from "./interfaces/i-check.ts";

export class ConceptFolderCheck implements ICheck {
  private static readonly SCRIPT_FILE: RegExp = /^(?:src|scripts)\/.+\.[cm]?ts$/;
  private static readonly KEBAB_CASE: RegExp = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  private static readonly DECLARATIONS: string = ".d.ts";
  private static readonly SOURCE_FOLDER: string = "src";
  private static readonly APP_FOLDER: string = "app";
  private static readonly SOURCE_TREES: ReadonlySet<string> = new Set([ConceptFolderCheck.APP_FOLDER, "testing"]);
  private static readonly EXCEPTION_SUFFIX: string = "Exception";
  private static readonly CATEGORIES: ReadonlySet<string> = new Set(["api", "decorators", "enums", "exceptions", "extensions", "interfaces", "intrinsics", "models", "services", "types"]);
  private static readonly ANGULAR_FOLDERS: ReadonlySet<string> = new Set(["components", "directives"]);
  private static readonly INTERFACES: readonly [folder: string, kind: string] = ["interfaces", "an interface"];
  private static readonly ENUMS: readonly [folder: string, kind: string] = ["enums", "an enum"];
  private static readonly EXCEPTIONS: readonly [folder: string, kind: string] = ["exceptions", "an exception class"];
  private static readonly TYPES: readonly [folder: string, kind: string] = ["types", "a type alias"];
  private static readonly KINDS: readonly (readonly [folder: string, kind: string])[] = [ConceptFolderCheck.INTERFACES, ConceptFolderCheck.ENUMS, ConceptFolderCheck.EXCEPTIONS, ConceptFolderCheck.TYPES];
  private static readonly SEGMENT_SEPARATOR: string = "/";
  private static readonly ANONYMOUS: string = "(anonymous)";
  private static readonly RULE: string = "https://github.com/noldova-com/.github/blob/main/standards/stacks/TYPESCRIPT.md, Files and folders, puts each concept in its category folder, which holds only its kind, and its Names section names folders in lowercase kebab-case.";

  private readonly files: RepositoryFiles;
  private readonly syntax: SyntaxTreeReader;

  public readonly title: string = "Concept folders";

  public constructor(files: RepositoryFiles, syntax: SyntaxTreeReader) {
    this.files = files;
    this.syntax = syntax;
  }

  public async runAsync(output: Writable): Promise<boolean> {
    const files = (await this.files.listAsync()).filter(t => ConceptFolderCheck.isProductionScript(t));
    const findings = [...ConceptFolderCheck.inspectFolders(files)];
    findings.push(...await this.syntax.readAsync(files, (t, u) => ConceptFolderCheck.inspect(t, u)));

    for (const finding of findings)
      output.write(`${finding}\n`);
    output.write(`Checked the folders of ${files.length} production scripts.\n`);
    return findings.length === 0;
  }

  private static isProductionScript(file: string): boolean {
    return ConceptFolderCheck.SCRIPT_FILE.test(file)
      && !file.endsWith(ConceptFolderCheck.DECLARATIONS)
      && !file.split(ConceptFolderCheck.SEGMENT_SEPARATOR).some(t => SourceTree.TEST_FOLDERS.has(t));
  }

  private static inspectFolders(files: readonly string[]): ReadonlySet<string> {
    const findings = new Set<string>();
    for (const file of files) {
      const folders = file.split(ConceptFolderCheck.SEGMENT_SEPARATOR).slice(0, -1);
      const packageFolder = PackageNaming.locatePackageFolder(file);
      for (const [index, folder] of folders.entries()) {
        const location = folders.slice(0, index + 1).join(ConceptFolderCheck.SEGMENT_SEPARATOR);
        if (location !== packageFolder && !ConceptFolderCheck.KEBAB_CASE.test(folder))
          findings.add(`${location}: is not lowercase kebab-case; ${ConceptFolderCheck.RULE}`);
      }
      const [root, category] = ConceptFolderCheck.locate(file);
      if (root !== null && category !== undefined && !ConceptFolderCheck.CATEGORIES.has(category)
        && !(root.endsWith(`${ConceptFolderCheck.SEGMENT_SEPARATOR}${ConceptFolderCheck.APP_FOLDER}`) && ConceptFolderCheck.ANGULAR_FOLDERS.has(category)))
        findings.add(`${root}/${category}: is not a concept category of its source tree; ${ConceptFolderCheck.RULE}`);
    }
    return findings;
  }

  private static locate(file: string): readonly [root: string | null, category: string | undefined] {
    const segments = file.split(ConceptFolderCheck.SEGMENT_SEPARATOR);
    const source = segments.indexOf(ConceptFolderCheck.SOURCE_FOLDER, 1);
    if (segments[0] !== ConceptFolderCheck.SOURCE_FOLDER || source === -1)
      return [null, undefined];
    const start = segments.slice(source + 1, source + 2).some(t => ConceptFolderCheck.SOURCE_TREES.has(t)) ? source + 2 : source + 1;
    const [category] = segments.slice(start, -1);
    return [segments.slice(0, start).join(ConceptFolderCheck.SEGMENT_SEPARATOR), category];
  }

  private static inspect(file: string, source: ts.SourceFile): readonly string[] {
    const [root, category] = ConceptFolderCheck.locate(file);
    const isScript = root === null;
    const folders = file.split(ConceptFolderCheck.SEGMENT_SEPARATOR).slice(0, -1);
    const holder = ConceptFolderCheck.KINDS.find(t => isScript ? t === ConceptFolderCheck.INTERFACES && folders.includes(t[0]) : t[0] === category) ?? null;
    const concepts = source.statements.filter(t => ConceptFolderCheck.isConcept(t));
    if (holder !== null && concepts.length === 0)
      return [`${file}: is in ${holder[0]}/ but declares no concept; ${ConceptFolderCheck.RULE}`];

    const findings: string[] = [];
    for (const concept of concepts) {
      const kind = ConceptFolderCheck.findKind(concept, isScript);
      const location = `${file}:${source.getLineAndCharacterOfPosition(concept.getStart(source)).line + 1}`;
      const name = concept.name?.text ?? ConceptFolderCheck.ANONYMOUS;
      if (kind !== null && kind !== holder)
        findings.push(`${location}: ${name} is ${kind[1]} outside ${kind[0]}/; ${ConceptFolderCheck.RULE}`);
      else if (holder !== null && kind !== holder)
        findings.push(`${location}: ${name} is in ${holder[0]}/ but is not ${holder[1]}; ${ConceptFolderCheck.RULE}`);
    }
    return findings;
  }

  private static isConcept(statement: ts.Statement): statement is ts.ClassDeclaration | ts.InterfaceDeclaration | ts.TypeAliasDeclaration | ts.EnumDeclaration {
    return ts.isClassDeclaration(statement) || ts.isInterfaceDeclaration(statement) || ts.isTypeAliasDeclaration(statement) || ts.isEnumDeclaration(statement);
  }

  private static findKind(concept: ts.ClassDeclaration | ts.InterfaceDeclaration | ts.TypeAliasDeclaration | ts.EnumDeclaration, isScript: boolean): readonly [folder: string, kind: string] | null {
    if (ts.isInterfaceDeclaration(concept))
      return ConceptFolderCheck.INTERFACES;
    if (isScript)
      return null;
    if (ts.isEnumDeclaration(concept))
      return ConceptFolderCheck.ENUMS;
    if (ts.isTypeAliasDeclaration(concept))
      return ConceptFolderCheck.TYPES;
    return concept.name?.text.endsWith(ConceptFolderCheck.EXCEPTION_SUFFIX) === true ? ConceptFolderCheck.EXCEPTIONS : null;
  }
}
