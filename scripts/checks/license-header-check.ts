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
import LicenseHeader from "../structure/license-header.ts";
import SourceFile from "../structure/source-file.ts";
import type ICheck from "./interfaces/check.ts";

export default class LicenseHeaderCheck implements ICheck {
  private static readonly HEADERS: ReadonlyMap<string, string> = new Map([
    ...[...SourceFile.SCRIPT_EXTENSIONS, ...SourceFile.STYLE_EXTENSIONS].map(t => [t, LicenseHeader.BLOCK] as const),
    [".html", LicenseHeader.MARKUP],
    ...[".yml", ".yaml"].map(t => [t, LicenseHeader.YAML] as const)
  ]);

  private readonly root: string;
  private readonly files: RepositoryFiles;

  public readonly title: string = "License headers";

  public constructor(root: string, files: RepositoryFiles) {
    this.root = root;
    this.files = files;
  }

  public async runAsync(output: Writable): Promise<boolean> {
    let checked = 0;
    let failures = 0;
    for (const file of await this.files.listAsync()) {
      const header = LicenseHeaderCheck.HEADERS.get(path.posix.extname(file));
      if (header === undefined)
        continue;
      checked++;
      if ((await readFile(path.join(this.root, file), "utf8")).startsWith(header))
        continue;
      output.write(`${file}: does not start with the license header that CODING-STANDARDS.md section 12 gives for its format.\n`);
      failures++;
    }
    output.write(`Checked the license headers of ${checked} files.\n`);
    return failures === 0;
  }
}
