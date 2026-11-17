/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync, readFileSync, realpathSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";

import "@noldova/context.core";
import type { JsonObject, JsonValue } from "@noldova/context.json";

import { Resources } from "../../resources.js";
import { UsualFolder } from "../usual-folder.js";

export class GeminiFolderTrust {
  public static isUntrusted(environment: NodeJS.ProcessEnv, folder: string, args: readonly string[] = [], platform: string = process.platform): boolean {
    const workspace = environment[Resources.geminiCliTrustWorkspaceVariable];
    if (environment[Resources.geminiRestrictedModeVariable] === Resources.geminiTrueValue || workspace === Resources.geminiFalseValue)
      return true;
    if (workspace === Resources.geminiTrueValue || args.includes(Resources.geminiCliSkipTrustArgument))
      return false;
    const home = GeminiFolderTrust.homeOf(environment, platform);
    const settings = GeminiFolderTrust.settingsPathsOf(environment, home, platform).map(t => GeminiFolderTrust.readObject(t));
    const read = settings.filter((t): t is JsonObject => !Object.isNull(t));
    if (read.length < settings.length || !read.reduce((enabled, t) => GeminiFolderTrust.booleanAt(t, Resources.geminiFolderTrustPath) ?? enabled, true)
      || read.some(t => GeminiFolderTrust.booleanAt(t, Resources.geminiIdeEnabledPath) === true))
      return false;
    const rules = GeminiFolderTrust.readObject(GeminiFolderTrust.trustedFoldersPathOf(environment, home));
    return !Object.isNull(rules) && GeminiFolderTrust.isUntrustedBy(rules, folder, platform);
  }

  private static isUntrustedBy(rules: JsonObject, folder: string, platform: string): boolean {
    const levels = Object.entries(rules);
    if (!levels.every(([, level]) => Object.isString(level) && Resources.geminiTrustLevels.includes(level)))
      return false;
    const location = GeminiFolderTrust.normalized(folder, platform);
    let longest = -1;
    let matched: JsonValue | null = null;
    for (const [path, level] of levels) {
      const effective = GeminiFolderTrust.normalized(level === Resources.geminiTrustParentLevel ? dirname(path) : path, platform);
      if (GeminiFolderTrust.isWithin(effective, location) && path.length > longest) {
        longest = path.length;
        matched = level;
      }
    }
    return Object.isNull(matched) || matched === Resources.geminiDoNotTrustLevel;
  }

  private static isWithin(parent: string, child: string): boolean {
    const path = relative(parent, child);
    return path !== Resources.parentSegment && !path.startsWith(Resources.parentSegment + sep) && !isAbsolute(path);
  }

  private static normalized(path: string, platform: string): string {
    const real = GeminiFolderTrust.realOf(resolve(path));
    return platform === Resources.windowsPlatform || platform === Resources.macPlatform ? real.toLowerCase() : real;
  }

  private static realOf(path: string): string {
    try {
      return realpathSync(path);
    }
    catch {
      return path;
    }
  }

  private static homeOf(environment: NodeJS.ProcessEnv, platform: string): string {
    const named = environment[Resources.geminiCliHomeVariable];
    return Object.isUndefined(named) || named.length === 0 ? UsualFolder.home(environment, platform) : named;
  }

  private static settingsPathsOf(environment: NodeJS.ProcessEnv, home: string, platform: string): readonly string[] {
    const system = GeminiFolderTrust.variableOr(environment, Resources.geminiSystemSettingsVariable,
      platform === Resources.macPlatform ? Resources.geminiMacSystemSettings : platform === Resources.windowsPlatform ? Resources.geminiWindowsSystemSettings
        : Resources.geminiLinuxSystemSettings);
    const defaults = GeminiFolderTrust.variableOr(environment, Resources.geminiSystemDefaultsVariable, join(dirname(system), Resources.geminiSystemDefaultsFile));
    return [defaults, join(home, Resources.geminiDirectoryName, Resources.geminiSettingsFile), system];
  }

  private static trustedFoldersPathOf(environment: NodeJS.ProcessEnv, home: string): string {
    const runtime = environment[Resources.sandboxVariable] === Resources.geminiSeatbeltSandbox ? join(home, Resources.cacheDirectoryName, Resources.geminiDirectoryName)
      : join(home, Resources.geminiDirectoryName);
    return GeminiFolderTrust.variableOr(environment, Resources.geminiTrustedFoldersVariable, join(runtime, Resources.geminiTrustedFoldersFile));
  }

  private static variableOr(environment: NodeJS.ProcessEnv, variable: string, fallback: string): string {
    const named = environment[variable];
    return Object.isUndefined(named) || named.length === 0 ? fallback : named;
  }

  private static readObject(path: string): JsonObject | null {
    if (!existsSync(path))
      return {};
    try {
      const value: JsonValue = JSON.parse(readFileSync(path, Resources.utf8Encoding));
      return GeminiFolderTrust.isObject(value) ? value : null;
    }
    catch {
      return null;
    }
  }

  private static booleanAt(settings: JsonObject, path: readonly string[]): boolean | null {
    let value: JsonValue | undefined = settings;
    for (const field of path)
      value = GeminiFolderTrust.isObject(value) ? value[field] : undefined;
    return typeof value === "boolean" ? value : null;
  }

  private static isObject(value: JsonValue | undefined): value is JsonObject {
    return typeof value === "object" && !Object.isNull(value) && !Array.isArray(value);
  }
}
