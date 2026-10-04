/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import path from "node:path";
import type { Writable } from "node:stream";

import type SourceFile from "../structure/source-file.ts";
import SourceScanner from "../structure/source-scanner.ts";
import type SourceTree from "../structure/source-tree.ts";
import type ICheck from "./interfaces/check.ts";

export default class WindowImportCheck implements ICheck {
  private static readonly PART_PATTERNS: readonly RegExp[] = [
    /^src\/shell\/desktop\/tests\/e2e\/fixtures\/modules\/[^/]+\/([^/]+)\//,
    /^src\/modules\/[^/]+\/([^/]+)\//,
    /^src\/shell\/([^/]+)\//
  ];
  private static readonly WINDOW_PARTS: ReadonlySet<string> = new Set(["window", "ui"]);
  private static readonly FORBIDDEN_PARTS: ReadonlySet<string> = new Set(["runtime", "desktop", "cli"]);
  private static readonly FORBIDDEN_PACKAGE: RegExp = /^(?:(?:@noldova\/teamrun-(?:shell-(?:runtime|desktop|cli)|(?:modules|fixture)-.+-(?:runtime|cli))|electron)(?:\/|$)|node:)/;
  private static readonly RELATIVE_PREFIX: string = ".";

  private readonly tree: SourceTree;

  public readonly title: string = "Window imports";

  public constructor(tree: SourceTree) {
    this.tree = tree;
  }

  public async runAsync(output: Writable): Promise<boolean> {
    const files = (await this.tree.readAsync()).files.filter(t => t.isScript && WindowImportCheck.WINDOW_PARTS.has(WindowImportCheck.findPart(t.path) ?? ""));
    const findings: string[] = [];
    for (const file of files)
      for (const literal of new SourceScanner(file.text).scan().imports)
        if (WindowImportCheck.isForbidden(file, literal.value))
          findings.push(`${file.formatLocation(literal.line)}: imports "${literal.value}"; ARCHITECTURE.md section 2 keeps the window, the kit and modules' window parts browser-safe, so they import no runtime, desktop or command-line package, Electron or Node.js module, and reach the runtime through @noldova/teamrun-shell-protocol and the preload bridge.`);

    for (const finding of findings)
      output.write(`${finding}\n`);
    output.write(`Checked the imports of ${files.length} script files of the window, the kit and modules' window parts.\n`);
    return findings.length === 0;
  }

  private static isForbidden(file: SourceFile, specifier: string): boolean {
    if (!specifier.startsWith(WindowImportCheck.RELATIVE_PREFIX))
      return WindowImportCheck.FORBIDDEN_PACKAGE.test(specifier);
    const part = WindowImportCheck.findPart(`${path.posix.join(path.posix.dirname(file.path), specifier)}/`);
    return part !== null && WindowImportCheck.FORBIDDEN_PARTS.has(part);
  }

  private static findPart(filePath: string): string | null {
    for (const pattern of WindowImportCheck.PART_PATTERNS) {
      const part = pattern.exec(filePath)?.[1];
      if (part !== undefined)
        return part;
    }
    return null;
  }
}
