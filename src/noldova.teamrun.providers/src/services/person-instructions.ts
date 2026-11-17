/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync, readdirSync, readFileSync, realpathSync, type Stats, statSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";

import "@noldova/context.core";

import { InstructionFile } from "../models/instruction-file.js";
import { Resources } from "../resources.js";

export class PersonInstructions {
  public static repositoryRoot(workingDirectory: string): string {
    const start = resolve(workingDirectory);
    for (let folder = start; ; folder = dirname(folder)) {
      if (existsSync(join(folder, Resources.gitDirectoryName)))
        return folder;
      if (dirname(folder) === folder)
        return start;
    }
  }

  public static foldersOf(workingDirectory: string): readonly string[] {
    const root = PersonInstructions.repositoryRoot(workingDirectory);
    const folders: string[] = [];
    for (let folder = resolve(workingDirectory); folder !== root; folder = dirname(folder))
      folders.unshift(folder);
    return [root, ...folders];
  }

  public static read(path: string, boundary: string | null): InstructionFile | null {
    try {
      const canonicalPath = realpathSync(path);
      if (!PersonInstructions.isInside(boundary, canonicalPath))
        return null;

      return new InstructionFile(path, readFileSync(canonicalPath, Resources.utf8Encoding).slice(0, Resources.maximumInstructionsLength));
    }
    catch {
      return null;
    }
  }

  public static markdownFiles(folder: string, boundary: string | null, recursive: boolean): readonly string[] {
    return PersonInstructions.walk(folder, boundary, recursive, new Set());
  }

  public static fit(files: readonly InstructionFile[], maximum: number): readonly InstructionFile[] {
    const kept: InstructionFile[] = [];
    let total = 0;
    for (const file of files) {
      total += file.content.length;
      if (total > maximum)
        break;
      kept.push(file);
    }
    return kept;
  }

  private static walk(folder: string, boundary: string | null, recursive: boolean, seen: Set<string>): readonly string[] {
    try {
      const canonicalFolder = realpathSync(folder);
      if (seen.has(canonicalFolder) || !PersonInstructions.isInside(boundary, canonicalFolder))
        return [];
      seen.add(canonicalFolder);
      return readdirSync(folder).sort().flatMap(name => {
        const path = join(folder, name);
        const stats = PersonInstructions.statInside(path, boundary);
        if (stats?.isDirectory() === true)
          return recursive ? PersonInstructions.walk(path, boundary, recursive, seen) : [];
        return stats?.isFile() === true && name.endsWith(Resources.markdownExtension) ? [path] : [];
      });
    }
    catch {
      return [];
    }
  }

  private static statInside(path: string, boundary: string | null): Stats | null {
    try {
      return PersonInstructions.isInside(boundary, realpathSync(path)) ? statSync(path) : null;
    }
    catch {
      return null;
    }
  }

  private static isInside(boundary: string | null, canonicalPath: string): boolean {
    if (Object.isNull(boundary))
      return true;
    const inside = relative(realpathSync(boundary), canonicalPath);
    return inside !== Resources.parentDirectory && !inside.startsWith(Resources.parentDirectory + sep) && !isAbsolute(inside);
  }
}
