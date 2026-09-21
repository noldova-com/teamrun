/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { delimiter, dirname, join } from "node:path";

import "@noldova/teamrun-foundation-core";

import { ExecutableSource } from "../../enums/executable-source.js";
import { LocatedExecutable } from "../../models/located-executable.js";
import { Resources } from "../../resources.js";

export class ExecutableLocator {
  private readonly platform: string;
  private readonly architecture: string;
  private readonly pathEntries: readonly string[];
  private readonly homeDirectory: string;

  public constructor(platform: string, architecture: string, pathEntries: readonly string[], homeDirectory: string) {
    this.platform = platform;
    this.architecture = architecture;
    this.pathEntries = [...pathEntries];
    this.homeDirectory = homeDirectory;
  }

  public static fromProcess(): ExecutableLocator {
    return new ExecutableLocator(process.platform, process.arch, ExecutableLocator.splitPath(process.env[Resources.pathVariable]), homedir());
  }

  public static splitPath(value: string | undefined): readonly string[] {
    if (Object.isUndefined(value))
      return [];

    return value.split(delimiter).filter(t => !String.isNullOrWhitespace(t));
  }

  private get isWindows(): boolean {
    return this.platform === Resources.windowsPlatform;
  }

  public locateCodex(override: string | null): LocatedExecutable | null {
    if (!Object.isNull(override))
      return ExecutableLocator.fromOverride(override);

    const names = this.isWindows ? [Resources.codexWindowsShimName, Resources.codexExecutableName] : [Resources.codexExecutableName];
    const shim = this.findOnPath(names);
    if (Object.isNull(shim))
      return null;

    const native = this.findCodexNativeBinary(dirname(shim.path));
    return Object.isNull(native) ? shim : native;
  }

  public locateClaude(override: string | null): LocatedExecutable | null {
    if (!Object.isNull(override))
      return ExecutableLocator.fromOverride(override);

    const executableName = this.isWindows ? Resources.claudeWindowsExecutableName : Resources.claudeExecutableName;
    const local = join(this.homeDirectory, Resources.localDirectoryName, Resources.binDirectoryName, executableName);
    if (existsSync(local))
      return new LocatedExecutable(local, ExecutableSource.LocalBin);

    const names = this.isWindows
      ? [Resources.claudeWindowsExecutableName, Resources.claudeWindowsShimName, Resources.claudeExecutableName]
      : [Resources.claudeExecutableName];
    return this.findOnPath(names);
  }

  public locateGrok(override: string | null): LocatedExecutable | null {
    if (!Object.isNull(override))
      return ExecutableLocator.fromOverride(override);
    const names = this.isWindows ? [Resources.grokWindowsExecutableName, Resources.grokExecutableName] : [Resources.grokExecutableName];
    const onPath = this.findOnPath(names);
    if (!Object.isNull(onPath))
      return onPath;
    const candidate = join(this.homeDirectory, Resources.grokDirectoryName, Resources.binDirectoryName, names[0]!);
    return existsSync(candidate) ? new LocatedExecutable(candidate, ExecutableSource.LocalBin) : null;
  }

  private static fromOverride(override: string): LocatedExecutable | null {
    return existsSync(override) ? new LocatedExecutable(override, ExecutableSource.Override) : null;
  }

  private findOnPath(names: readonly string[]): LocatedExecutable | null {
    for (const directory of this.pathEntries)
      for (const name of names) {
        const candidate = join(directory, name);
        if (existsSync(candidate))
          return new LocatedExecutable(candidate, ExecutableSource.Path);
      }

    return null;
  }

  private findCodexNativeBinary(prefix: string): LocatedExecutable | null {
    const target = `${this.platform}${Resources.platformArchitectureSeparator}${this.architecture}`;
    const triple = Resources.codexTargetTriples.get(target);
    if (Object.isUndefined(triple))
      return null;

    const platformPackage = `${Resources.codexPlatformPackagePrefix}${target}`;
    const executableName = this.isWindows ? Resources.codexWindowsExecutableName : Resources.codexExecutableName;
    const binaryPath = [Resources.vendorDirectoryName, triple, Resources.binDirectoryName, executableName];
    const siblingRoot = join(prefix, Resources.parentDirectory, Resources.libDirectoryName, Resources.nodeModulesDirectoryName);
    const roots = [join(prefix, Resources.nodeModulesDirectoryName), siblingRoot];
    for (const root of roots) {
      const codexPackage = join(root, Resources.openAiScopeName, Resources.codexPackageName);
      const candidates = [
        join(codexPackage, Resources.nodeModulesDirectoryName, Resources.openAiScopeName, platformPackage, ...binaryPath),
        join(root, Resources.openAiScopeName, platformPackage, ...binaryPath),
        join(codexPackage, ...binaryPath)
      ];
      for (const candidate of candidates)
        if (existsSync(candidate))
          return new LocatedExecutable(candidate, ExecutableSource.GlobalNpm);
    }

    return null;
  }
}
