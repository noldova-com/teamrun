/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { join } from "node:path";

import "@noldova/context.core";

import type { InstructionFile } from "../../models/instruction-file.js";
import { Resources } from "../../resources.js";
import { HomeInstructions } from "../home-instructions.js";
import { PersonInstructions } from "../person-instructions.js";
import { UsualFolder } from "../usual-folder.js";

export class AntigravityInstructions {
  public static read(environment: NodeJS.ProcessEnv, platform: string = process.platform, workingDirectory: string | null = null): string | null {
    const geminiHome = AntigravityInstructions.home(environment, platform);
    const config = join(geminiHome, Resources.antigravityConfigFolder);
    return HomeInstructions.format(Resources.antigravityDisplayName, [
      ...HomeInstructions.readAll([geminiHome, config].flatMap(folder => Resources.antigravityInstructionFiles.map(t => join(folder, t)))),
      ...AntigravityInstructions.applying(HomeInstructions.readAll(PersonInstructions.markdownFiles(join(config, Resources.antigravityRulesFolder), null, false))),
      ...AntigravityInstructions.readProject(workingDirectory)]);
  }

  public static home(environment: NodeJS.ProcessEnv, platform: string = process.platform): string {
    return UsualFolder.of(environment, Resources.antigravityHomeVariable, Resources.antigravityDirectoryName, UsualFolder.home(environment, platform));
  }

  private static readProject(workingDirectory: string | null): readonly InstructionFile[] {
    if (Object.isNull(workingDirectory))
      return [];
    const root = PersonInstructions.repositoryRoot(workingDirectory);
    return PersonInstructions.foldersOf(workingDirectory).flatMap(folder => [
      ...AntigravityInstructions.readInside(Resources.antigravityInstructionFiles.map(t => join(folder, t)), root),
      ...AntigravityInstructions.applying(AntigravityInstructions.readInside(
        Resources.antigravityProjectRulesFolders.flatMap(t => PersonInstructions.markdownFiles(join(folder, ...t), root, false)), root))]);
  }

  private static readInside(paths: readonly string[], root: string): readonly InstructionFile[] {
    return paths.map(t => PersonInstructions.read(t, root)).filter((t): t is InstructionFile => !Object.isNull(t));
  }

  private static applying(rules: readonly InstructionFile[]): readonly InstructionFile[] {
    return rules.filter(t => !Resources.antigravityManualRule.test(t.content));
  }
}
