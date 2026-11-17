/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";

import ts from "typescript";

export class SyntaxTreeReader {
  private static readonly ENCODING: BufferEncoding = "utf8";

  private readonly root: string;

  public constructor(root: string) {
    this.root = root;
  }

  public async readAsync<T>(files: readonly string[], read: (file: string, source: ts.SourceFile) => readonly T[]): Promise<readonly T[]> {
    const results = await Promise.all(files.map(async t => read(t, await this.parseAsync(t))));
    return results.flat();
  }

  private async parseAsync(file: string): Promise<ts.SourceFile> {
    return ts.createSourceFile(file, await readFile(path.join(this.root, file), SyntaxTreeReader.ENCODING), ts.ScriptTarget.Latest, true);
  }
}
