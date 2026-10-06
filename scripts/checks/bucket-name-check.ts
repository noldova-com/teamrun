/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import path from "node:path";
import type { Writable } from "node:stream";

import type { Node, SourceFile } from "typescript/unstable/ast";
import { isClassDeclaration, isClassExpression, isEnumDeclaration, isExportSpecifier, isInterfaceDeclaration, isTypeAliasDeclaration } from "typescript/unstable/ast/is";

import ApiException from "../api/api.exception.ts";
import type RepositoryFiles from "../repository/repository-files.ts";
import ScriptFile from "../structure/source-file.ts";
import type SyntaxTreeReader from "../structure/syntax-tree.reader.ts";
import type ICheck from "./interfaces/i-check.ts";

export default class BucketNameCheck implements ICheck {
  private static readonly BUCKETS: ReadonlySet<string> = new Set(["helper", "helpers", "util", "utils", "utility", "common", "shared", "misc"]);
  private static readonly BEFORE_LAST_WORD: RegExp = /^.*(?=[A-Z])/;
  private static readonly SEGMENT_SEPARATOR: string = "/";
  private static readonly PART_SEPARATOR: string = ".";
  private static readonly WORD_SEPARATOR: string = "-";
  private static readonly PURPOSE: string = "bucket-names";
  private static readonly RULE: string = "CODING-STANDARDS.md section 1 asks for a named concept instead of a helper, util, utility, common, shared or misc bucket.";

  private readonly files: RepositoryFiles;
  private readonly syntax: SyntaxTreeReader;

  public readonly title: string = "Bucket names";

  public constructor(files: RepositoryFiles, syntax: SyntaxTreeReader) {
    this.files = files;
    this.syntax = syntax;
  }

  public async runAsync(output: Writable): Promise<boolean> {
    const files = await this.files.listAsync();
    const scripts = files.filter(t => ScriptFile.SCRIPT_EXTENSIONS.has(path.posix.extname(t)));
    const findings = files.flatMap(t => BucketNameCheck.findPathBuckets(t));
    try {
      findings.push(...await this.syntax.readAsync(BucketNameCheck.PURPOSE, scripts, (t, u) => BucketNameCheck.findTypeBuckets(t, u)));
    }
    catch (error) {
      if (!(error instanceof ApiException))
        throw error;
      findings.push(error.message);
    }

    for (const finding of findings)
      output.write(`${finding}\n`);
    output.write(`Checked the paths of ${files.length} files and the types of ${scripts.length} scripts for bucket names.\n`);
    return findings.length === 0;
  }

  private static findPathBuckets(file: string): readonly string[] {
    return file.split(BucketNameCheck.SEGMENT_SEPARATOR)
      .filter(t => t.split(BucketNameCheck.PART_SEPARATOR).some(u => BucketNameCheck.BUCKETS.has(u.slice(u.lastIndexOf(BucketNameCheck.WORD_SEPARATOR) + 1).toLowerCase())))
      .map(t => `${file}: the name "${t}" ends in a bucket word; ${BucketNameCheck.RULE}`);
  }

  private static findTypeBuckets(file: string, source: SourceFile): readonly string[] {
    const findings: string[] = [];
    const visit = (node: Node): void => {
      const name = BucketNameCheck.readName(node);
      if (name !== null && BucketNameCheck.BUCKETS.has(name.replace(BucketNameCheck.BEFORE_LAST_WORD, "").toLowerCase()))
        findings.push(`${file}:${source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1}: the name ${name} ends in a bucket word; ${BucketNameCheck.RULE}`);
      node.forEachChild(visit);
    };
    source.forEachChild(visit);
    return findings;
  }

  private static readName(node: Node): string | null {
    if (isClassDeclaration(node) || isClassExpression(node))
      return node.name?.text ?? null;
    if (isInterfaceDeclaration(node) || isTypeAliasDeclaration(node) || isEnumDeclaration(node) || isExportSpecifier(node))
      return node.name.text;
    return null;
  }
}
