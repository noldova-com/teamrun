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

import type RepositoryFiles from "../repository/repository-files.ts";
import SourceFile from "../structure/source-file.ts";
import type ICheck from "./interfaces/i-check.ts";

export default class FieldOrderCheck implements ICheck {
  private static readonly FOLDERS: readonly string[] = ["src/", "scripts/"];
  private static readonly DECLARATIONS: string = ".d.ts";
  private static readonly CLASS: RegExp = /^(?:export\s+)?(?:default\s+)?(?:abstract\s+)?class\s+([A-Za-z_$][\w$]*)/;
  private static readonly FIELD: RegExp = /^ {2}(?:(public|private|protected)\s+)?(?:(static)\s+)?(?:(?:readonly|override|declare)\s+)*(#?[\w$]+)[?!]?\s*[:=;]/;
  private static readonly MEMBER_START: RegExp = /^(?: {0,2}[^\s\])}]|})/;
  private static readonly CLASS_END: string = "}";
  private static readonly PUBLIC: string = "public";
  private static readonly STATIC: string = "static";
  private static readonly LINE_SEPARATOR: string = "\n";

  private readonly root: string;
  private readonly files: RepositoryFiles;

  public readonly title: string = "Field order";

  public constructor(root: string, files: RepositoryFiles) {
    this.root = root;
    this.files = files;
  }

  public async runAsync(output: Writable): Promise<boolean> {
    const sources = (await this.files.listAsync()).filter(t => FieldOrderCheck.isSource(t));
    const findings: string[] = [];
    for (const file of sources)
      findings.push(...FieldOrderCheck.findMisplaced(file, await readFile(path.join(this.root, file), "utf8")));

    for (const finding of findings)
      output.write(`${finding}\n`);
    output.write(`Checked ${sources.length} files for the order of class fields.\n`);
    return findings.length === 0;
  }

  private static isSource(file: string): boolean {
    return SourceFile.SCRIPT_EXTENSIONS.has(path.posix.extname(file))
      && !file.endsWith(FieldOrderCheck.DECLARATIONS)
      && FieldOrderCheck.FOLDERS.some(t => file.startsWith(t));
  }

  private static findMisplaced(file: string, text: string): readonly string[] {
    const lines = text.split(FieldOrderCheck.LINE_SEPARATOR);
    const findings: string[] = [];
    let className: string | null = null;
    let hasEarlierField = false;
    lines.forEach((line, index) => {
      const declared = FieldOrderCheck.CLASS.exec(line)?.[1];
      if (declared !== undefined) {
        className = declared;
        hasEarlierField = false;
        return;
      }
      if (line === FieldOrderCheck.CLASS_END)
        className = null;
      const field = className === null ? null : FieldOrderCheck.FIELD.exec(line);
      if (field === null || className === null)
        return;
      const isPublicStatic = (field[1] ?? FieldOrderCheck.PUBLIC) === FieldOrderCheck.PUBLIC && field[2] === FieldOrderCheck.STATIC;
      if (!isPublicStatic)
        hasEarlierField = true;
      else if (hasEarlierField && !FieldOrderCheck.usesClass(lines, index, className))
        findings.push(`${file}:${index + 1}: ${field[3]} is a public static field after another field; declare public static fields first, unless its initializer uses ${className}, as CODING-STANDARDS.md section 10 says.`);
    });
    return findings;
  }

  private static usesClass(lines: readonly string[], start: number, className: string): boolean {
    let end = start + 1;
    while (end < lines.length && !FieldOrderCheck.MEMBER_START.test(lines[end] as string))
      end++;
    const declaration = lines.slice(start, end).join(FieldOrderCheck.LINE_SEPARATOR);
    return declaration.includes(`${className}.`) || declaration.includes(`new ${className}(`);
  }
}
