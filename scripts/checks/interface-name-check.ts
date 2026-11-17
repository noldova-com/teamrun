/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import path from "node:path";
import type { Writable } from "node:stream";

import ts from "typescript";

import type { RepositoryFiles } from "../repository/repository-files.ts";
import { SourceFile as ScriptFile } from "../structure/source-file.ts";
import type { SyntaxTreeReader } from "../structure/syntax-tree.reader.ts";
import type { ICheck } from "./interfaces/i-check.ts";

export class InterfaceNameCheck implements ICheck {
  private static readonly PREFIXED: RegExp = /^I[A-Z]/;
  private static readonly PREFIX: string = "I";
  private static readonly GLOBAL_SCOPE: string = "global";
  private static readonly RULE: string = "https://github.com/noldova-com/.github/blob/main/standards/stacks/TYPESCRIPT.md, Names, names an interface I plus PascalCase, as in IProviderAdapter, in production code, scripts and tests; an interface in declare global or declare module augments an existing type and keeps its name.";

  private readonly files: RepositoryFiles;
  private readonly syntax: SyntaxTreeReader;

  public readonly title: string = "Interface names";

  public constructor(files: RepositoryFiles, syntax: SyntaxTreeReader) {
    this.files = files;
    this.syntax = syntax;
  }

  public async runAsync(output: Writable): Promise<boolean> {
    const scripts = (await this.files.listAsync()).filter(t => ScriptFile.SCRIPT_EXTENSIONS.has(path.posix.extname(t)));
    const findings = await this.syntax.readAsync(scripts, (t, u) => InterfaceNameCheck.inspect(t, u));

    for (const finding of findings)
      output.write(`${finding}\n`);
    output.write(`Checked the interface names of ${scripts.length} scripts.\n`);
    return findings.length === 0;
  }

  private static inspect(file: string, source: ts.SourceFile): readonly string[] {
    const findings: string[] = [];
    const visit = (node: ts.Node): void => {
      if (ts.isModuleDeclaration(node) && (ts.isStringLiteral(node.name) || node.name.text === InterfaceNameCheck.GLOBAL_SCOPE))
        return;
      if (ts.isInterfaceDeclaration(node) && !InterfaceNameCheck.PREFIXED.test(node.name.text)) {
        const name = node.name.text;
        const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
        findings.push(`${file}:${line}: the interface ${name} does not start with ${InterfaceNameCheck.PREFIX} and a capital letter; name it ${InterfaceNameCheck.PREFIX}${name}; ${InterfaceNameCheck.RULE}`);
      }
      node.forEachChild(visit);
    };
    source.forEachChild(visit);
    return findings;
  }
}
