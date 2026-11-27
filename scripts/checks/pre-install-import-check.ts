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

import "@noldova/context.core";

import type { ICheck } from "./interfaces/i-check.ts";

export class PreInstallImportCheck implements ICheck {
  public static readonly ENTRY_POINTS: readonly string[] = ["scripts/set-version.ts", "scripts/installs/root-install.ts"];
  private static readonly STATIC_IMPORT: RegExp = /^\s*(?:import|export)\s(?:[^"';]*?\sfrom\s)?["']([^"']+)["']/gm;
  private static readonly DYNAMIC_IMPORT: RegExp = /\bimport\(\s*["']([^"']+)["']\s*\)/g;

  private readonly root: string;
  private readonly entryPoints: readonly string[];

  public readonly title: string = "Pre-install imports";

  public constructor(root: string, entryPoints: readonly string[] = PreInstallImportCheck.ENTRY_POINTS) {
    this.root = root;
    this.entryPoints = entryPoints;
  }

  public async runAsync(output: Writable): Promise<boolean> {
    const seen = new Set<string>();
    let passed = true;
    for (const entryPoint of this.entryPoints)
      passed = await this.visitAsync(entryPoint, entryPoint, seen, output) && passed;
    if (passed)
      output.write(`${this.entryPoints.join(" and ")}, which run before npm ci, and the ${seen.size - this.entryPoints.length} files they import load only Node's own modules.\n`);
    return passed;
  }

  private async visitAsync(file: string, entryPoint: string, seen: Set<string>, output: Writable): Promise<boolean> {
    if (seen.has(file))
      return true;
    seen.add(file);
    let text: string;
    try {
      text = await readFile(path.join(this.root, file), "utf8");
    }
    catch (error) {
      output.write(`${file}, which ${entryPoint} loads, can't be read: ${error instanceof Error ? error.message : String(error)}\n`);
      return false;
    }
    let passed = true;
    for (const specifier of PreInstallImportCheck.specifiers(text)) {
      if (specifier.startsWith("."))
        passed = await this.visitAsync(path.posix.join(path.posix.dirname(file), specifier), entryPoint, seen, output) && passed;
      else if (!specifier.startsWith("node:")) {
        output.write(`${file} imports ${specifier}, but ${entryPoint} runs before npm ci installs any package, so it and every file it imports load only Node's own modules, named with node:, and their own files.\n`);
        passed = false;
      }
    }
    return passed;
  }

  private static specifiers(text: string): readonly string[] {
    return [...text.matchAll(PreInstallImportCheck.STATIC_IMPORT), ...text.matchAll(PreInstallImportCheck.DYNAMIC_IMPORT)].map(t => t[1] ?? "");
  }
}
