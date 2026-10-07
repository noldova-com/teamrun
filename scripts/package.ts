/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Writable } from "node:stream";

import AngularProject from "./angular/angular-project.ts";
import GalleryFile from "./angular/gallery-file.ts";
import ModuleException from "./modules/module.exception.ts";
import PackageException from "./packages/package.exception.ts";
import RootManifest from "./packages/root-manifest.ts";
import ElectronDistribution from "./packaging/electron-distribution.ts";
import type IPackageSigning from "./packaging/interfaces/i-package-signing.ts";
import MacSigning from "./packaging/mac-signing.ts";
import PackageConfiguration from "./packaging/package-configuration.ts";
import PackageLayout from "./packaging/package-layout.ts";
import PackageReport from "./packaging/package-report.ts";
import PackageStage from "./packaging/package-stage.ts";
import PackageTarget from "./packaging/package-target.ts";
import PackagedBuild from "./packaging/packaged-build.ts";
import PackagingException from "./packaging/packaging.exception.ts";
import type PinnedPackage from "./packaging/pinned-package.ts";
import SigningCredentials from "./packaging/signing-credentials.ts";
import TrustedSigningModule from "./packaging/trusted-signing-module.ts";
import WindowsSigning from "./packaging/windows-signing.ts";
import ProcessRunner from "./processes/process-runner.ts";
import ProcessException from "./processes/process.exception.ts";
import NpmCommand from "./toolchain/npm-command.ts";

export default class Package {
  private static readonly USAGE: string = "Usage: npm run package [-- --signed]\n";
  private static readonly SIGNED_OPTION: string = "--signed";
  private static readonly USAGE_EXIT_CODE: number = 2;
  private static readonly TOOL_CACHE_MANIFEST: string = "package.json";
  private static readonly COMMONJS_SCOPE: string = `${JSON.stringify({ type: "commonjs" })}\n`;
  private static readonly BUILDER_SEGMENTS: readonly string[] = ["node_modules", "electron-builder", "cli.js"];
  private static readonly BUILDER_OPTIONS: readonly string[] = ["--publish", "never", "--config"];
  private static readonly BUILDER_VARIABLES: ReadonlySet<string> = new Set([
    "PATH", "PATHEXT", "COMSPEC", "SYSTEMROOT", "SYSTEMDRIVE", "WINDIR", "PROCESSOR_ARCHITECTURE", "NUMBER_OF_PROCESSORS",
    "HOME", "USERPROFILE", "HOMEDRIVE", "HOMEPATH", "APPDATA", "LOCALAPPDATA", "USER", "USERNAME", "LOGNAME",
    "TEMP", "TMP", "TMPDIR", "LANG", "LC_ALL", "LC_CTYPE", "HTTP_PROXY", "HTTPS_PROXY", "NO_PROXY"
  ]);
  private static readonly ARM64: string = "arm64";
  private static readonly COMPRESSION_FILTER: string = "ELECTRON_BUILDER_7Z_FILTER";
  private static readonly X86_FILTER: string = "BCJ";

  private readonly root: string;
  private readonly platform: string;
  private readonly architecture: string;
  private readonly stage: PackageStage;
  private readonly runner: ProcessRunner;
  private readonly environment: NodeJS.ProcessEnv;
  private readonly output: Writable;
  private readonly signingPackages: readonly PinnedPackage[];

  public constructor(root: string, platform: string, architecture: string, stage: PackageStage, runner: ProcessRunner, environment: NodeJS.ProcessEnv, output: Writable,
    signingPackages: readonly PinnedPackage[]) {
    this.root = root;
    this.platform = platform;
    this.architecture = architecture;
    this.stage = stage;
    this.runner = runner;
    this.environment = environment;
    this.output = output;
    this.signingPackages = signingPackages;
  }

  public async runAsync(packageArguments: readonly string[]): Promise<number> {
    const credentials = SigningCredentials.take(this.environment);
    const layout = new PackageLayout(this.root);
    await rm(layout.report, { force: true });
    if (packageArguments.length > 1 || packageArguments.some(t => t !== Package.SIGNED_OPTION)) {
      this.output.write(Package.USAGE);
      return Package.USAGE_EXIT_CODE;
    }

    try {
      const target = PackageTarget.fromProcess(this.platform, this.architecture);
      const signing = packageArguments.length === 0 ? null : this.createSigning(target, layout, credentials);
      await this.stage.stageAsync(target, this.output);
      await rm(layout.output, { recursive: true, force: true });
      const electron = new ElectronDistribution(this.root, layout.electron);
      await electron.copyAsync();
      try {
        await signing?.prepareAsync();
        await this.buildAsync(target, layout, electron, signing);
      }
      finally {
        await signing?.disposeAsync();
      }
      return 0;
    }
    catch (error) {
      if (!(error instanceof PackagingException || error instanceof PackageException || error instanceof ProcessException || error instanceof ModuleException))
        throw error;
      this.output.write(`${error.message}\n`);
      return 1;
    }
  }

  private createSigning(target: PackageTarget, layout: PackageLayout, credentials: NodeJS.ProcessEnv): IPackageSigning {
    switch (target.platform) {
      case PackageTarget.WINDOWS:
        return new WindowsSigning(this.runner, this.root, layout.signing, layout.output, target, this.environment, credentials, this.signingPackages);
      case PackageTarget.MACOS:
        return new MacSigning(this.runner, layout.signing, this.environment, credentials);
      default:
        throw new PackagingException(`${Package.SIGNED_OPTION} signs Windows and macOS packages only, so it cannot sign the ${target.id} package.`);
    }
  }

  private async buildAsync(target: PackageTarget, layout: PackageLayout, electron: ElectronDistribution, signing: IPackageSigning | null): Promise<void> {
    const manifest = await RootManifest.readAsync(this.root);
    const configuration = new PackageConfiguration(this.root, manifest, target, this.stage.folder, layout.output, electron.folder, await electron.readVersionAsync(),
      signing !== null);
    await configuration.writeAsync(layout.configuration);
    await mkdir(layout.toolCache, { recursive: true });
    await writeFile(path.join(layout.toolCache, Package.TOOL_CACHE_MANIFEST), Package.COMMONJS_SCOPE);
    const exitCode = await this.runner.runAsync(process.execPath, [path.join(this.root, ...Package.BUILDER_SEGMENTS), ...Package.BUILDER_OPTIONS, layout.configuration], this.root,
      { ...this.createBuilderEnvironment(layout, target), ...signing?.builderEnvironment });
    if (exitCode !== 0)
      throw new PackagingException(`electron-builder failed with exit code ${exitCode}.`);
    const files = configuration.fileNames.map(t => path.join(layout.output, t));
    const missing = files.filter(t => !existsSync(t));
    if (missing.length > 0)
      throw new PackagingException(`electron-builder finished without making ${missing.join(", ")}.`);
    this.output.write(`Packages made:\n${files.map(t => `  ${t}\n`).join("")}`);
    if (signing !== null)
      this.output.write(`Signatures:\n${await signing.verifyAsync(files, manifest.product)}\n`);
    await new PackageReport(target.id, signing !== null, signing !== null).writeAsync(layout.report);
  }

  private createBuilderEnvironment(layout: PackageLayout, target: PackageTarget): NodeJS.ProcessEnv {
    const isWindowsArm64 = target.platform === PackageTarget.WINDOWS && target.architecture === Package.ARM64;
    return {
      ...Object.fromEntries(Object.entries(this.environment).filter(([name]) => Package.BUILDER_VARIABLES.has(name.toUpperCase()))),
      ELECTRON_BUILDER_CACHE: layout.toolCache,
      CSC_IDENTITY_AUTO_DISCOVERY: "false",
      ...(isWindowsArm64 ? { [Package.COMPRESSION_FILTER]: Package.X86_FILTER } : {})
    };
  }
}

if (import.meta.main) {
  const runner = new ProcessRunner();
  const root = process.cwd();
  const npm = new NpmCommand(runner, process.env);
  const angular = new AngularProject(root, runner, npm);
  const stage = new PackageStage(root, npm, new PackagedBuild(root, runner, new GalleryFile(root), angular));
  process.exitCode = await new Package(root, process.platform, process.arch, stage, runner, process.env, process.stdout, TrustedSigningModule.PACKAGES)
    .runAsync(process.argv.slice(2));
}
