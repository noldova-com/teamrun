/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Writable } from "node:stream";

import type { ClassDeclaration, EnumDeclaration, InterfaceDeclaration, SourceFile, Statement, TypeAliasDeclaration } from "typescript/unstable/ast";
import { isClassDeclaration, isEnumDeclaration, isInterfaceDeclaration, isTypeAliasDeclaration } from "typescript/unstable/ast/is";

import ApiException from "../api/api.exception.ts";
import type RepositoryFiles from "../repository/repository-files.ts";
import SourceTree from "../structure/source-tree.ts";
import type SyntaxTreeReader from "../structure/syntax-tree.reader.ts";
import type ICheck from "./interfaces/i-check.ts";

export default class ConceptFileCheck implements ICheck {
  private static readonly SCRIPT_FILE: RegExp = /^(?:src|scripts)\/.+\.[cm]?ts$/;
  private static readonly WORD_START: RegExp = /(?<=[a-z0-9])(?=[A-Z])|(?<=[A-Z])(?=[A-Z][a-z])/g;
  private static readonly COMMAND_SEPARATOR: RegExp = /\s+/;
  private static readonly DECLARATIONS: string = ".d.ts";
  private static readonly MANIFEST: string = "package.json";
  private static readonly MANIFEST_ENCODING: BufferEncoding = "utf8";
  private static readonly PRODUCT_NAMES: readonly string[] = ["GitHub", "TypeScript", "TeamRun"];
  private static readonly ROLE_WORDS: ReadonlySet<string> = new Set(["node", "parser", "lexer", "reader", "validator", "exception", "service", "component", "directive"]);
  private static readonly WORD_SEPARATOR: string = "-";
  private static readonly ROLE_SEPARATOR: string = ".";
  private static readonly SEGMENT_SEPARATOR: string = "/";
  private static readonly ANONYMOUS: string = "(anonymous)";
  private static readonly PURPOSE: string = "concept-files";
  private static readonly RULE: string = "CODING-STANDARDS.md sections 5 and 10 give each implementation file one named concept and name the file for it.";

  private readonly root: string;
  private readonly files: RepositoryFiles;
  private readonly syntax: SyntaxTreeReader;

  public readonly title: string = "Concept files";

  public constructor(root: string, files: RepositoryFiles, syntax: SyntaxTreeReader) {
    this.root = root;
    this.files = files;
    this.syntax = syntax;
  }

  public async runAsync(output: Writable): Promise<boolean> {
    const commands = await this.readCommandsAsync();
    if (commands === null) {
      output.write(`${ConceptFileCheck.MANIFEST}: is not a JSON object whose scripts, if any, are an object, which name the files that keep their own names; ${ConceptFileCheck.RULE}\n`);
      return false;
    }

    const entries = new Set(commands.flatMap(t => t.split(ConceptFileCheck.COMMAND_SEPARATOR)));
    const files = (await this.files.listAsync()).filter(t => ConceptFileCheck.isProductionScript(t) && !entries.has(t));
    let findings: readonly string[];
    try {
      findings = await this.syntax.readAsync(ConceptFileCheck.PURPOSE, files, (t, u) => ConceptFileCheck.inspect(t, u));
    }
    catch (error) {
      if (!(error instanceof ApiException))
        throw error;
      findings = [error.message];
    }

    for (const finding of findings)
      output.write(`${finding}\n`);
    output.write(`Checked the concepts and file names of ${files.length} production scripts.\n`);
    return findings.length === 0;
  }

  private static isProductionScript(file: string): boolean {
    return ConceptFileCheck.SCRIPT_FILE.test(file)
      && !file.endsWith(ConceptFileCheck.DECLARATIONS)
      && !file.split(ConceptFileCheck.SEGMENT_SEPARATOR).some(t => SourceTree.TEST_FOLDERS.has(t));
  }

  private static inspect(file: string, source: SourceFile): readonly string[] {
    const concepts = source.statements.filter(t => ConceptFileCheck.isConcept(t));
    const [concept, ...others] = concepts;
    if (concept === undefined)
      return [];
    if (others.length > 0)
      return [`${file}: declares ${concepts.length} concepts, ${concepts.map(t => ConceptFileCheck.readName(t) ?? ConceptFileCheck.ANONYMOUS).join(", ")}; ${ConceptFileCheck.RULE}`];

    const name = ConceptFileCheck.readName(concept);
    const location = `${file}:${source.getLineAndCharacterOfPosition(concept.getStart(source)).line + 1}`;
    if (name === null)
      return [`${location}: declares a class without a name to name the file for; ${ConceptFileCheck.RULE}`];
    const expected = ConceptFileCheck.formatFileName(name, path.posix.extname(file));
    return path.posix.basename(file) === expected ? [] : [`${location}: ${name} is not in its file ${expected}; ${ConceptFileCheck.RULE}`];
  }

  private static isConcept(statement: Statement): statement is ClassDeclaration | InterfaceDeclaration | TypeAliasDeclaration | EnumDeclaration {
    return isClassDeclaration(statement) || isInterfaceDeclaration(statement) || isTypeAliasDeclaration(statement) || isEnumDeclaration(statement);
  }

  private static readName(concept: ClassDeclaration | InterfaceDeclaration | TypeAliasDeclaration | EnumDeclaration): string | null {
    return isClassDeclaration(concept) ? concept.name?.text ?? null : concept.name.text;
  }

  private static formatFileName(name: string, extension: string): string {
    const spelled = ConceptFileCheck.PRODUCT_NAMES.reduce((t, u) => t.replaceAll(u, `${u.charAt(0)}${u.slice(1).toLowerCase()}`), name);
    const words = spelled.split(ConceptFileCheck.WORD_START).join(ConceptFileCheck.WORD_SEPARATOR).toLowerCase();
    const end = words.lastIndexOf(ConceptFileCheck.WORD_SEPARATOR);
    const role = words.slice(end + 1);
    if (end !== -1 && ConceptFileCheck.ROLE_WORDS.has(role))
      return `${words.slice(0, end)}${ConceptFileCheck.ROLE_SEPARATOR}${role}${extension}`;
    return `${words}${extension}`;
  }

  private async readCommandsAsync(): Promise<readonly string[] | null> {
    let manifest: unknown;
    try {
      manifest = JSON.parse(await readFile(path.join(this.root, ConceptFileCheck.MANIFEST), ConceptFileCheck.MANIFEST_ENCODING));
    }
    catch {
      return null;
    }
    if (typeof manifest !== "object" || manifest === null || Array.isArray(manifest))
      return null;
    if (!("scripts" in manifest))
      return [];
    const scripts = manifest.scripts;
    if (typeof scripts !== "object" || scripts === null || Array.isArray(scripts))
      return null;
    return Object.values(scripts).filter(t => typeof t === "string").map(t => String(t));
  }
}
