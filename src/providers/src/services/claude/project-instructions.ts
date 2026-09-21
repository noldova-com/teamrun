/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { readFileSync, realpathSync } from "node:fs";
import { isAbsolute, join, relative, resolve, sep } from "node:path";

import "@noldova/teamrun-foundation-core";

import { Resources } from "../../resources.js";

export class ProjectInstructions {
  public static read(workingDirectory: string): string | null {
    const root = resolve(workingDirectory);
    const content = ProjectInstructions.readFile(root, join(root, Resources.projectInstructionsFileName));
    if (Object.isNull(content))
      return null;
    const lines = content.split(Resources.lineSeparator).map(line => ProjectInstructions.expand(root, line));

    return Resources.formatProjectInstructions(lines.join(Resources.lineSeparator).slice(0, Resources.maximumInstructionsLength));
  }

  private static expand(root: string, line: string): string {
    const trimmed = line.trim();
    if (!trimmed.startsWith(Resources.importPrefix) || trimmed.includes(Resources.space))
      return line;
    const target = resolve(root, trimmed.slice(Resources.importPrefix.length));
    const inside = relative(root, target);
    if (String.isNullOrWhitespace(inside) || inside.startsWith(Resources.parentDirectory) || isAbsolute(inside))
      return line;

    return ProjectInstructions.readFile(root, target) ?? line;
  }

  private static readFile(root: string, path: string): string | null {
    try {
      const canonicalPath = realpathSync(path);
      const inside = relative(realpathSync(root), canonicalPath);
      if (inside === Resources.parentDirectory || inside.startsWith(Resources.parentDirectory + sep) || isAbsolute(inside))
        return null;

      return readFileSync(canonicalPath, Resources.utf8Encoding);
    }
    catch {
      return null;
    }
  }
}
