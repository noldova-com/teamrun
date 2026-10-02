/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import path from "node:path";

export default class SourceFile {
  private static readonly SCRIPT_EXTENSIONS: ReadonlySet<string> = new Set([".ts", ".mts", ".cts", ".js", ".mjs", ".cjs"]);
  private static readonly STYLE_EXTENSIONS: ReadonlySet<string> = new Set([".css", ".scss"]);
  private static readonly JSON_EXTENSION: string = ".json";
  private static readonly MANIFEST_NAME: string = "package.json";

  public readonly path: string;
  public readonly owner: string;
  public readonly isProduction: boolean;
  public readonly packageRoot: string;
  public readonly text: string;

  public constructor(filePath: string, owner: string, isProduction: boolean, packageRoot: string, text: string) {
    this.path = filePath;
    this.owner = owner;
    this.isProduction = isProduction;
    this.packageRoot = packageRoot;
    this.text = text;
  }

  public get isScript(): boolean {
    return SourceFile.SCRIPT_EXTENSIONS.has(path.posix.extname(this.path));
  }

  public get isStyle(): boolean {
    return SourceFile.STYLE_EXTENSIONS.has(path.posix.extname(this.path));
  }

  public get isJson(): boolean {
    return path.posix.extname(this.path) === SourceFile.JSON_EXTENSION;
  }

  public get isManifest(): boolean {
    return path.posix.basename(this.path) === SourceFile.MANIFEST_NAME;
  }

  public formatLocation(line: number): string {
    return `${this.path}:${line}`;
  }
}
