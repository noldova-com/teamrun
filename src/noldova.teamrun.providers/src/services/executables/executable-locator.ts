/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { accessSync, constants, existsSync, readdirSync, readFileSync, realpathSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { delimiter, dirname, extname, join } from "node:path";

import "@noldova/context.core";
import { ProviderKindVersions } from "@noldova/teamrun.core";

import { ExecutableSource } from "../../enums/executable-source.js";
import { AntigravityServer } from "../../models/antigravity-server.js";
import { LocatedExecutable } from "../../models/located-executable.js";
import { Resources } from "../../resources.js";

export class ExecutableLocator {
  private readonly platform: string;
  private readonly architecture: string;
  private readonly pathEntries: readonly string[];
  private readonly homeDirectory: string;
  private readonly localAppDataDirectory: string;
  private readonly systemRootDirectory: string;
  private readonly macTarPath: string;

  public constructor(platform: string, architecture: string, pathEntries: readonly string[], homeDirectory: string,
    localAppDataDirectory: string = join(homeDirectory, ...Resources.localAppDataSegments), systemRootDirectory: string = Resources.windowsSystemRoot,
    macTarPath: string = Resources.tarMacPath) {
    this.platform = platform;
    this.architecture = architecture;
    this.pathEntries = [...pathEntries];
    this.homeDirectory = homeDirectory;
    this.localAppDataDirectory = localAppDataDirectory;
    this.systemRootDirectory = systemRootDirectory;
    this.macTarPath = macTarPath;
  }

  public static fromProcess(): ExecutableLocator {
    return new ExecutableLocator(process.platform, process.arch, ExecutableLocator.splitPath(process.env[Resources.pathVariable]), homedir(),
      process.env[Resources.localAppDataVariable], process.env[Resources.systemRootVariable]);
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
      return ExecutableLocator.installed(join(this.codexInstallDirectory(), this.isWindows ? Resources.codexWindowsExecutableName : Resources.codexExecutableName));

    const native = this.findCodexNativeBinary(dirname(shim.path));
    return Object.isNull(native) ? shim : native;
  }

  public codexInstallDirectory(): string {
    return this.isWindows
      ? join(this.localAppDataDirectory, ...Resources.codexWindowsInstallSegments)
      : join(this.homeDirectory, Resources.localDirectoryName, Resources.binDirectoryName);
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
    const candidate = join(this.grokInstallDirectory(), Resources.binDirectoryName, names[0]!);
    if (!Object.isNull(onPath))
      return ExecutableLocator.isSameFile(onPath.path, candidate) ? new LocatedExecutable(onPath.path, ExecutableSource.LocalBin) : onPath;
    return existsSync(candidate) ? new LocatedExecutable(candidate, ExecutableSource.LocalBin) : null;
  }

  public locateOpencode(override: string | null): LocatedExecutable | null {
    if (!Object.isNull(override))
      return ExecutableLocator.fromOverride(override);
    const native = this.findOnPath([this.isWindows ? Resources.opencodeWindowsExecutableName : Resources.opencodeExecutableName]);
    if (!Object.isNull(native))
      return native;
    const shim = this.isWindows ? this.findOnPath([Resources.opencodeWindowsShimName]) : null;
    if (!Object.isNull(shim)) {
      const modules = join(dirname(shim.path), Resources.nodeModulesDirectoryName);
      const packages = [`${Resources.opencodeWindowsPackagePrefix}${this.architecture}`,
        `${Resources.opencodeWindowsPackagePrefix}${this.architecture}${Resources.opencodeBaselineSuffix}`];
      const found = packages.flatMap(t => [join(modules, Resources.opencodePackageName, Resources.nodeModulesDirectoryName, t), join(modules, t)])
        .map(t => join(t, Resources.binDirectoryName, Resources.opencodeWindowsExecutableName)).find(t => existsSync(t));
      if (!Object.isUndefined(found))
        return new LocatedExecutable(found, ExecutableSource.GlobalNpm);
    }
    const name = this.isWindows ? Resources.opencodeWindowsExecutableName : Resources.opencodeExecutableName;
    return ExecutableLocator.installed(join(this.homeDirectory, Resources.opencodeDirectoryName, Resources.binDirectoryName, name));
  }

  public locateCursor(override: string | null, installDirectory: string | null = null): LocatedExecutable | null {
    if (!Object.isNull(override))
      return this.isWindows && extname(override).toLowerCase() === Resources.cursorWindowsScriptExtension
        ? ExecutableLocator.cursorBehind(ExecutableLocator.fromOverride(override)) : ExecutableLocator.fromOverride(override);
    const own = this.isWindows ? ExecutableLocator.cursorBehind(this.findOnPath([Resources.cursorWindowsLauncherName]))
      ?? ExecutableLocator.cursorBehind(ExecutableLocator.installed(join(this.localAppDataDirectory, Resources.cursorWindowsInstallDirectoryName,
        Resources.cursorWindowsLauncherName)))
      : this.findOnPath([Resources.cursorExecutableName])
        ?? ExecutableLocator.installed(join(this.homeDirectory, Resources.localDirectoryName, Resources.binDirectoryName, Resources.cursorExecutableName));
    if (!Object.isNull(own) || Object.isNull(installDirectory))
      return own;
    const managed = join(installDirectory, Resources.cursorVersion, Resources.cursorPackageDirectoryName,
      this.isWindows ? Resources.cursorWindowsLauncherName : Resources.cursorExecutableName);
    if (!existsSync(managed))
      return null;
    const launcher = new LocatedExecutable(managed, ExecutableSource.Managed);
    return this.isWindows ? ExecutableLocator.cursorBehind(launcher) : launcher;
  }

  public locateFx(override: string | null, installDirectory: string | null = null): LocatedExecutable | null {
    if (!Object.isNull(override))
      return ExecutableLocator.fromOverride(override);
    const name = this.isWindows ? Resources.fxWindowsExecutableName : Resources.fxExecutableName;
    return this.findOnPath([name])
      ?? (Object.isNull(installDirectory) || String.isNullOrWhitespace(installDirectory) ? null : ExecutableLocator.installed(join(installDirectory, name)))
      ?? ExecutableLocator.installed(join(this.homeDirectory, Resources.localDirectoryName, Resources.binDirectoryName, name));
  }

  public grokInstallDirectory(): string {
    return join(this.homeDirectory, Resources.grokDirectoryName);
  }

  public locateCopilot(override: string | null, installDirectory: string | null = null): LocatedExecutable | null {
    if (!Object.isNull(override))
      return ExecutableLocator.fromOverride(override);
    return this.findCopilot() ?? (this.isWindows && !Object.isNull(installDirectory) ? ExecutableLocator.newestCopilot(installDirectory) : null);
  }

  public copilotInstallDirectory(windowsDirectory: string): string {
    return this.isWindows ? windowsDirectory : join(this.homeDirectory, Resources.localDirectoryName, Resources.binDirectoryName);
  }

  private findCopilot(): LocatedExecutable | null {
    if (!this.isWindows) {
      const local = join(this.homeDirectory, Resources.localDirectoryName, Resources.binDirectoryName, Resources.copilotExecutableName);
      const onPath = this.findOnPath([Resources.copilotExecutableName]);
      return Object.isNull(onPath) || ExecutableLocator.isSameFile(onPath.path, local) ? ExecutableLocator.installed(local) : onPath;
    }
    const onPath = this.findOnPath([Resources.copilotWindowsExecutableName]);
    if (!Object.isNull(onPath))
      return onPath;
    const shim = this.findOnPath([Resources.copilotWindowsShimName]);
    if (Object.isNull(shim))
      return ExecutableLocator.installed(join(this.localAppDataDirectory, ...Resources.wingetLinksSegments, Resources.copilotWindowsExecutableName));
    const modules = join(dirname(shim.path), Resources.nodeModulesDirectoryName);
    const platformPackage = [Resources.githubScopeName,
      `${Resources.copilotPlatformPackagePrefix}${this.platform}${Resources.platformArchitectureSeparator}${this.architecture}`, Resources.copilotWindowsExecutableName];
    const native = [join(modules, Resources.githubScopeName, Resources.copilotPackageName, Resources.nodeModulesDirectoryName, ...platformPackage),
      join(modules, ...platformPackage)].find(t => existsSync(t));
    return Object.isUndefined(native) ? null : new LocatedExecutable(native, ExecutableSource.GlobalNpm);
  }

  public locateAntigravity(installDirectory: string): LocatedExecutable | null {
    const name = this.isWindows ? Resources.antigravityWindowsExecutableName : Resources.antigravityExecutableName;
    const candidate = join(installDirectory, Resources.antigravityVersion, name);
    return existsSync(candidate) && existsSync(this.antigravityHarness(candidate)) ? new LocatedExecutable(candidate, ExecutableSource.Managed) : null;
  }

  public locatePi(override: string | null): LocatedExecutable | null {
    if (!Object.isNull(override))
      return ExecutableLocator.fromOverride(override);
    if (!this.isWindows)
      return this.findOnPath([Resources.piExecutableName]) ?? ExecutableLocator.installed(join(this.homeDirectory, ...Resources.piLauncherSegments));
    const shim = this.findOnPath([Resources.piWindowsShimName]);
    if (Object.isNull(shim))
      return null;
    const script = join(dirname(shim.path), Resources.nodeModulesDirectoryName, ...Resources.piScriptSegments);
    const beside = join(dirname(shim.path), Resources.piWindowsNodeName);
    const node = existsSync(beside) ? beside : this.findOnPath([Resources.piWindowsNodeName])?.path;
    return existsSync(script) && !Object.isUndefined(node) ? new LocatedExecutable(node, ExecutableSource.GlobalNpm, [script]) : null;
  }

  public locateMuse(override: string | null, installDirectory: string | null = null): LocatedExecutable | null {
    if (!Object.isNull(override))
      return ExecutableLocator.fromOverride(override);
    const usual = this.isWindows ? join(this.localAppDataDirectory, ...Resources.museWindowsInstallSegments) : join(this.homeDirectory, ...Resources.museUnixInstallSegments);
    const launcher = this.isWindows ? null : this.findOnPath([Resources.museExecutableName]) ?? ExecutableLocator.installed(join(usual, Resources.museExecutableName));
    if (!Object.isNull(launcher))
      return launcher;
    const shim = this.isWindows ? this.findOnPath([Resources.museWindowsShimName]) : null;
    const folders = [installDirectory, Object.isNull(shim) ? null : dirname(shim.path), usual].filter(t => !Object.isNull(t));
    return folders.map(t => this.museBinaryIn(t)).find(t => !Object.isNull(t))
      ?? (this.isWindows ? this.findOnPath([`${Resources.museExecutableName}${Resources.museWindowsBinarySuffix}`]) : null);
  }

  public locateUnzip(): LocatedExecutable | null {
    return this.isWindows
      ? this.findOnPath([Resources.unzipWindowsExecutableName]) ?? this.windowsTar()
      : this.findOnPath([Resources.unzipExecutableName]);
  }

  public locateNpm(): LocatedExecutable | null {
    return this.findOnPath([this.isWindows ? Resources.npmWindowsExecutableName : Resources.npmExecutableName]);
  }

  public locateTar(): LocatedExecutable | null {
    if (this.isWindows)
      return this.windowsTar();
    return this.platform === Resources.macPlatform ? ExecutableLocator.installed(this.macTarPath) : this.findOnPath([Resources.tarCommandName]);
  }

  private museBinaryIn(folder: string): LocatedExecutable | null {
    let version: string;
    try {
      version = readFileSync(join(folder, Resources.museVersionFile), Resources.utf8Encoding).trim();
    }
    catch {
      return null;
    }
    return ExecutableLocator.installed(join(folder, `${Resources.museBinaryPrefix}${version}${this.isWindows ? Resources.museWindowsBinarySuffix : String.empty}`));
  }

  public locateAntigravityServer(installDirectory: string, chosen: string | null = null): AntigravityServer | null {
    const server = Object.isNull(chosen) ? this.locateAntigravity(installDirectory) ?? this.antigravityOnPath() : this.antigravityAt(chosen);
    return Object.isNull(server) ? null : new AntigravityServer(server.toCommand(), this.antigravityHarness(server.path), server.source);
  }

  private antigravityAt(path: string): LocatedExecutable | null {
    return this.isRunnable(path) && existsSync(this.antigravityHarness(path)) ? new LocatedExecutable(path, ExecutableSource.Override) : null;
  }

  private antigravityOnPath(): LocatedExecutable | null {
    const name = this.isWindows ? Resources.antigravityWindowsExecutableName : Resources.antigravityExecutableName;
    const directory = this.pathEntries.find(t => this.isRunnable(join(t, name)) && existsSync(this.antigravityHarness(join(t, name))));
    return Object.isUndefined(directory) ? null : new LocatedExecutable(join(directory, name), ExecutableSource.Path);
  }

  private isRunnable(path: string): boolean {
    try {
      accessSync(path, this.isWindows ? constants.F_OK : constants.X_OK);
      return statSync(path).isFile();
    }
    catch {
      return false;
    }
  }

  public antigravityHarness(server: string): string {
    return join(dirname(server), this.isWindows ? Resources.antigravityWindowsHarnessName : Resources.antigravityHarnessName);
  }

  private windowsTar(): LocatedExecutable | null {
    return ExecutableLocator.installed(join(this.systemRootDirectory, Resources.windowsSystemFolderName, Resources.tarWindowsExecutableName));
  }

  private static newestCopilot(directory: string): LocatedExecutable | null {
    const versions = existsSync(directory) ? readdirSync(directory)
      .filter(t => Resources.releaseVersionPattern.test(t) && existsSync(join(directory, t, Resources.copilotWindowsExecutableName))) : [];
    const newest = versions.reduce<string | null>((t, u) => Object.isNull(t) || !Object.isNull(new ProviderKindVersions(t, u).update) ? u : t, null);
    return Object.isNull(newest) ? null : new LocatedExecutable(join(directory, newest, Resources.copilotWindowsExecutableName), ExecutableSource.Managed);
  }

  private static cursorBehind(launcher: LocatedExecutable | null): LocatedExecutable | null {
    if (Object.isNull(launcher))
      return null;
    const directory = dirname(launcher.path);
    const versions = join(directory, Resources.cursorVersionsDirectoryName);
    const dated = (t: string): string => t.replace(Resources.cursorVersionPattern,
      (_, year: string, month: string, day: string, hour: string | undefined, minute: string | undefined, second: string | undefined) =>
        `${year}${month.padStart(2, "0")}${day.padStart(2, "0")}${hour ?? "00"}${minute ?? "00"}${second ?? "00"}`);
    const newest = existsSync(versions) ? readdirSync(versions).filter(t => Resources.cursorVersionPattern.test(t))
      .sort((t, u) => dated(t).localeCompare(dated(u)) || t.localeCompare(u)).at(-1) : undefined;
    const folder = existsSync(join(directory, Resources.cursorWindowsNodeName)) || Object.isUndefined(newest) ? directory : join(versions, newest);
    const node = join(folder, Resources.cursorWindowsNodeName);
    const script = join(folder, Resources.cursorScriptName);
    return existsSync(node) && existsSync(script) ? new LocatedExecutable(node, launcher.source, [script]) : null;
  }

  private static installed(path: string): LocatedExecutable | null {
    return existsSync(path) ? new LocatedExecutable(path, ExecutableSource.LocalBin) : null;
  }

  private static isSameFile(found: string, installed: string): boolean {
    try {
      return realpathSync.native(found) === realpathSync.native(installed);
    }
    catch {
      return false;
    }
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
