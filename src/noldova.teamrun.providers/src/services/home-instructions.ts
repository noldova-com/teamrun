/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import type { InstructionFile } from "../models/instruction-file.js";
import { Resources } from "../resources.js";
import { PersonInstructions } from "./person-instructions.js";

export class HomeInstructions {
  public static format(kind: string, files: readonly InstructionFile[]): string | null {
    if (files.length === 0)
      return null;
    const kept = PersonInstructions.fit(files, Resources.maximumInstructionsTotalLength);
    const left = files.slice(kept.length).map(t => t.path);
    return Resources.formatHomeInstructions(kind, [...kept.map(t => Resources.formatInstructionFile(t.path, t.content)),
      ...left.length === 0 ? [] : [Resources.formatInstructionsLeftOut(left)]].join(Resources.lineSeparator + Resources.lineSeparator));
  }

  public static readAll(paths: readonly string[]): readonly InstructionFile[] {
    return paths.map(t => PersonInstructions.read(t, null)).filter((t): t is InstructionFile => !Object.isNull(t));
  }
}
