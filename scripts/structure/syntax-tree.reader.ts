/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import type { SourceFile } from "typescript/unstable/ast";
import type { Project } from "typescript/unstable/async";

import ApiServer from "../api/api-server.ts";
import ApiException from "../api/api.exception.ts";

export default class SyntaxTreeReader {
  private static readonly BUILD_FOLDER: string = "_build";
  private static readonly PURPOSE_FOLDER: string = "syntax-trees";
  private static readonly PROJECT_NAME: string = "tsconfig.json";
  private static readonly COMPILER_OPTIONS: Readonly<Record<string, unknown>> = { noEmit: true, allowJs: true, noResolve: true, noLib: true, types: [] };

  private readonly root: string;
  private readonly server: readonly string[];
  private readonly timeout: number;

  public constructor(root: string, server: readonly string[], timeout: number) {
    this.root = root;
    this.server = [...server];
    this.timeout = timeout;
  }

  public async readAsync<T>(purpose: string, files: readonly string[], read: (file: string, source: SourceFile) => readonly T[]): Promise<readonly T[]> {
    if (files.length === 0)
      return [];
    const folder = path.join(this.root, SyntaxTreeReader.BUILD_FOLDER, SyntaxTreeReader.PURPOSE_FOLDER, purpose);
    const project = path.join(folder, SyntaxTreeReader.PROJECT_NAME);
    await mkdir(folder, { recursive: true });
    await writeFile(project, `${JSON.stringify({ compilerOptions: { ...SyntaxTreeReader.COMPILER_OPTIONS, rootDir: this.root }, files: files.map(t => path.join(this.root, t)) }, null, 2)}\n`);
    return await ApiServer.useAsync(this.server, this.root, project, this.timeout, async t => {
      const results = await Promise.all(files.map(async u => read(u, await this.findSourceAsync(t, u))));
      return results.flat();
    });
  }

  private async findSourceAsync(project: Project, file: string): Promise<SourceFile> {
    const source = await project.program.getSourceFile(path.join(this.root, file));
    if (source === undefined)
      throw new ApiException(`The TypeScript API has no syntax tree for ${file}.`);
    return source;
  }
}
