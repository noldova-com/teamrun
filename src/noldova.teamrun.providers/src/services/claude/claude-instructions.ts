/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync, realpathSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";

import "@noldova/context.core";

import { InstructionFile } from "../../models/instruction-file.js";
import { Resources } from "../../resources.js";
import { PersonInstructions } from "../person-instructions.js";

export class ClaudeInstructions {
  public static read(workingDirectory: string, configFolder: string, managedFile: string | null, homeDirectory: string): string | null {
    const root = PersonInstructions.repositoryRoot(workingDirectory);
    const folders = PersonInstructions.foldersOf(workingDirectory);
    const files: InstructionFile[] = [];
    const loaded = new Set<string>();
    const load = (path: string, boundary: string | null, rule: boolean = false): void =>
      ClaudeInstructions.load(path, boundary, rule, homeDirectory, 0, loaded, files);
    const loadRules = (folder: string, boundary: string | null): void =>
      PersonInstructions.markdownFiles(folder, boundary, true).forEach(t => load(t, boundary, true));
    if (!Object.isNull(managedFile))
      load(managedFile, null);
    load(join(configFolder, Resources.projectInstructionsFileName), null);
    loadRules(join(configFolder, Resources.claudeRulesFolder), null);
    const agents = !folders.some(folder => Resources.claudeProjectInstructionFiles.some(t => existsSync(join(folder, t))));
    for (const folder of folders) {
      load(join(folder, Resources.projectInstructionsFileName), root);
      load(join(folder, Resources.claudeHomeFolderName, Resources.projectInstructionsFileName), root);
      loadRules(join(folder, Resources.claudeHomeFolderName, Resources.claudeRulesFolder), root);
      load(join(folder, Resources.claudeLocalInstructionsFile), root);
      if (agents) {
        load(join(folder, Resources.agentsInstructionsFile), root);
        load(join(folder, Resources.claudeHomeFolderName, Resources.agentsInstructionsFile), root);
      }
    }
    if (files.length === 0)
      return null;

    const kept = PersonInstructions.fit(files, Resources.maximumInstructionsTotalLength);
    const left = files.slice(kept.length).map(t => t.path);
    return Resources.formatPersonInstructions([...kept.map(t => Resources.formatInstructionFile(t.path, t.content)),
      ...left.length === 0 ? [] : [Resources.formatInstructionsLeftOut(left)]].join(Resources.lineSeparator + Resources.lineSeparator));
  }

  public static managedFile(platform: NodeJS.Platform): string {
    if (platform === Resources.macPlatform)
      return Resources.claudeMacManagedInstructionsFile;
    return platform === Resources.windowsPlatform ? Resources.claudeWindowsManagedInstructionsFile : Resources.claudeLinuxManagedInstructionsFile;
  }

  private static load(path: string, boundary: string | null, rule: boolean, homeDirectory: string, depth: number, loaded: Set<string>,
    files: InstructionFile[]): void {
    const file = PersonInstructions.read(path, boundary);
    const key = ClaudeInstructions.canonicalOf(path);
    if (Object.isNull(file) || Object.isNull(key) || loaded.has(key) || (rule && ClaudeInstructions.isConditional(file.content)))
      return;
    loaded.add(key);
    const content = ClaudeInstructions.withoutComments(file.content);
    files.push(new InstructionFile(file.path, content));
    if (depth < Resources.maximumImportDepth)
      ClaudeInstructions.importsOf(content).forEach(t => ClaudeInstructions.load(ClaudeInstructions.resolveImport(t, path, homeDirectory), boundary, false,
        homeDirectory, depth + 1, loaded, files));
  }

  private static canonicalOf(path: string): string | null {
    try {
      return realpathSync(path);
    }
    catch {
      return null;
    }
  }

  private static isConditional(content: string): boolean {
    const lines = content.split(Resources.lineSeparator).map(t => t.trim());
    const end = lines.indexOf(Resources.frontMatterFence, 1);
    return lines[0] === Resources.frontMatterFence && end > 0 && lines.slice(1, end).some(t => t.startsWith(Resources.rulePathsKey));
  }

  private static withoutComments(content: string): string {
    const kept: string[] = [];
    let fenced = false;
    let comment = false;
    for (const line of content.split(Resources.lineSeparator)) {
      const trimmed = line.trimStart();
      if (!comment && Resources.codeFencePattern.test(trimmed))
        fenced = !fenced;
      if (!fenced && !comment && trimmed.startsWith(Resources.commentOpening))
        comment = true;
      if (!comment) {
        kept.push(line);
        continue;
      }
      const end = line.indexOf(Resources.commentClosing);
      if (end < 0)
        continue;
      comment = false;
      const rest = line.slice(end + Resources.commentClosing.length);
      if (!String.isNullOrWhitespace(rest))
        kept.push(rest);
    }
    return kept.join(Resources.lineSeparator);
  }

  private static importsOf(content: string): readonly string[] {
    const imports: string[] = [];
    let fenced = false;
    for (const line of content.split(Resources.lineSeparator)) {
      if (Resources.codeFencePattern.test(line.trimStart())) {
        fenced = !fenced;
        continue;
      }
      if (fenced)
        continue;
      for (const match of line.replace(Resources.codeSpanPattern, t => Resources.space.repeat(t.length)).matchAll(Resources.claudeImportPattern)) {
        const path = match[1]!;
        if (!Resources.quotes.includes(path[0]!))
          imports.push(path.replaceAll(Resources.escapedSpace, Resources.space));
      }
    }
    return imports;
  }

  private static resolveImport(path: string, importer: string, homeDirectory: string): string {
    if (path.startsWith(Resources.homePrefix))
      return join(homeDirectory, path.slice(Resources.homePrefix.length));
    return isAbsolute(path) ? path : resolve(dirname(importer), path);
  }
}
