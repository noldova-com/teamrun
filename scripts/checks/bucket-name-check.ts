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
import type ICheck from "./interfaces/check.ts";

export default class BucketNameCheck implements ICheck {
  private static readonly BUCKETS: ReadonlySet<string> = new Set(["helper", "helpers", "util", "utils", "utility", "common", "shared", "misc"]);
  private static readonly TYPE: RegExp = /^\s*(?:export\s+)?(?:default\s+)?(?:declare\s+)?(?:abstract\s+)?(?:class|interface|type|enum)\s+([A-Za-z_$][\w$]*)/;
  private static readonly BEFORE_LAST_WORD: RegExp = /^.*(?=[A-Z])/;
  private static readonly SEGMENT_SEPARATOR: string = "/";
  private static readonly PART_SEPARATOR: string = ".";
  private static readonly WORD_SEPARATOR: string = "-";
  private static readonly LINE_FEED: string = "\n";
  private static readonly RULE: string = "CODING-STANDARDS.md section 1 asks for a named concept instead of a helper, util, utility, common, shared or misc bucket.";

  private readonly root: string;
  private readonly files: RepositoryFiles;

  public readonly title: string = "Bucket names";

  public constructor(root: string, files: RepositoryFiles) {
    this.root = root;
    this.files = files;
  }

  public async runAsync(output: Writable): Promise<boolean> {
    const files = await this.files.listAsync();
    const scripts = files.filter(t => SourceFile.SCRIPT_EXTENSIONS.has(path.posix.extname(t)));
    const findings = files.flatMap(t => BucketNameCheck.findPathBuckets(t));
    for (const file of scripts)
      findings.push(...BucketNameCheck.findTypeBuckets(file, await readFile(path.join(this.root, file), "utf8")));

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

  private static findTypeBuckets(file: string, text: string): readonly string[] {
    const findings: string[] = [];
    for (const [index, line] of text.split(BucketNameCheck.LINE_FEED).entries()) {
      const name = BucketNameCheck.TYPE.exec(line)?.[1];
      if (name !== undefined && BucketNameCheck.BUCKETS.has(name.replace(BucketNameCheck.BEFORE_LAST_WORD, "").toLowerCase()))
        findings.push(`${file}:${index + 1}: the type ${name} ends in a bucket word; ${BucketNameCheck.RULE}`);
    }
    return findings;
  }
}
