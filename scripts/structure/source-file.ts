/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import path from "node:path";

export class SourceFile {
  public static readonly SCRIPT_EXTENSIONS: ReadonlySet<string> = new Set([".ts", ".mts", ".cts", ".js", ".mjs", ".cjs"]);
  public static readonly STYLE_EXTENSIONS: ReadonlySet<string> = new Set([".css"]);
  private static readonly MANIFEST_NAME: string = "package.json";
  private static readonly QUOTES: readonly string[] = ["\"", "'", "`"];
  private static readonly ESCAPE: string = "\\";
  private static readonly LINE_SEPARATOR: string = "\n";

  public readonly path: string;
  public readonly isProduction: boolean;
  public readonly packageRoot: string;
  public readonly text: string;

  public constructor(filePath: string, isProduction: boolean, packageRoot: string, text: string) {
    this.path = filePath;
    this.isProduction = isProduction;
    this.packageRoot = packageRoot;
    this.text = text;
  }

  public static isInString(text: string, index: number): boolean {
    const lineStart = text.lastIndexOf(SourceFile.LINE_SEPARATOR, index - 1) + 1;
    let quote: string | null = null;
    for (let position = lineStart; position < index; position++) {
      const character = text[position] as string;
      if (quote === null) {
        if (SourceFile.QUOTES.includes(character))
          quote = character;
      }
      else if (character === SourceFile.ESCAPE)
        position++;
      else if (character === quote)
        quote = null;
    }
    return quote !== null;
  }

  public get isScript(): boolean {
    return SourceFile.SCRIPT_EXTENSIONS.has(path.posix.extname(this.path));
  }

  public get isManifest(): boolean {
    return path.posix.basename(this.path) === SourceFile.MANIFEST_NAME;
  }

  public formatLocation(line: number): string {
    return `${this.path}:${line}`;
  }
}
