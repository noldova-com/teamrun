/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Writable } from "node:stream";

import AngularProject from "./angular/angular-project.ts";
import GalleryFile from "./angular/gallery-file.ts";
import ModuleException from "./modules/module.exception.ts";
import PackageException from "./packages/package.exception.ts";
import RootManifest from "./packages/root-manifest.ts";
import WindowsAddonBuilder from "./packages/windows-addon-builder.ts";
import AuthenticodeCheck from "./packaging/authenticode-check.ts";
import ElectronDistribution from "./packaging/electron-distribution.ts";
import type ModulePackage from "./packaging/module-package.ts";
import PackageConfiguration from "./packaging/package-configuration.ts";
import PackageLayout from "./packaging/package-layout.ts";
import PackageStage from "./packaging/package-stage.ts";
import PackageTarget from "./packaging/package-target.ts";
import PackagedBuild from "./packaging/packaged-build.ts";
import PackagingException from "./packaging/packaging.exception.ts";
import TrustedSigningModule from "./packaging/trusted-signing-module.ts";
import ProcessRunner from "./processes/process-runner.ts";
import ProcessException from "./processes/process.exception.ts";
import NpmCommand from "./toolchain/npm-command.ts";

export default class Package {
  private static readonly USAGE: string = "Usage: npm run package [-- --signed]\n";
  private static readonly SIGNED_OPTION: string = "--signed";
  private static readonly SIGN_HOOK_SEGMENTS: readonly string[] = ["scripts", "packaging", "windows-sign-hook.ts"];
  private static readonly WINDOWS_FOLDER_PREFIX: string = "win";
  private static readonly UNPACKED_FOLDER_SUFFIX: string = "unpacked";
  private static readonly X64: string = "x64";
  private static readonly RESOURCES_SEGMENTS: readonly string[] = ["resources", "app.asar.unpacked"];
  private static readonly PROGRAM_EXTENSION: string = ".exe";
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
  private readonly signingPackage: ModulePackage;

  public constructor(root: string, platform: string, architecture: string, stage: PackageStage, runner: ProcessRunner, environment: NodeJS.ProcessEnv, output: Writable,
    signingPackage: ModulePackage) {
    this.root = root;
    this.platform = platform;
    this.architecture = architecture;
    this.stage = stage;
    this.runner = runner;
    this.environment = environment;
    this.output = output;
    this.signingPackage = signingPackage;
  }

  public async runAsync(packageArguments: readonly string[]): Promise<number> {
    if (packageArguments.length > 1 || packageArguments.some(t => t !== Package.SIGNED_OPTION)) {
      this.output.write(Package.USAGE);
      return Package.USAGE_EXIT_CODE;
    }

    try {
      const target = PackageTarget.fromProcess(this.platform, this.architecture);
      const layout = new PackageLayout(this.root);
      const signing = packageArguments.length === 0 ? null : this.createSigning(target, layout);
      const signingEnvironment = signing?.describeEnvironment() ?? {};
      await this.stage.stageAsync(this.output);
      await rm(layout.output, { recursive: true, force: true });
      const electron = new ElectronDistribution(this.root, layout.electron);
      await electron.copyAsync();
      await signing?.prepareAsync(this.signingPackage);
      const manifest = await RootManifest.readAsync(this.root);
      const configuration = new PackageConfiguration(this.root, manifest, target, this.stage.folder, layout.output, electron.folder, await electron.readVersionAsync(),
        signing === null ? null : path.join(this.root, ...Package.SIGN_HOOK_SEGMENTS));
      await configuration.writeAsync(layout.configuration);
      await mkdir(layout.toolCache, { recursive: true });
      await writeFile(path.join(layout.toolCache, Package.TOOL_CACHE_MANIFEST), Package.COMMONJS_SCOPE);
      const exitCode = await this.runner.runAsync(process.execPath, [path.join(this.root, ...Package.BUILDER_SEGMENTS), ...Package.BUILDER_OPTIONS, layout.configuration], this.root,
        { ...this.createBuilderEnvironment(layout, target), ...signingEnvironment });
      if (exitCode !== 0)
        throw new PackagingException(`electron-builder failed with exit code ${exitCode}.`);
      const files = configuration.fileNames.map(t => path.join(layout.output, t));
      const missing = files.filter(t => !existsSync(t));
      if (missing.length > 0)
        throw new PackagingException(`electron-builder finished without making ${missing.join(", ")}.`);
      this.output.write(`Packages made:\n${files.map(t => `  ${t}\n`).join("")}`);
      if (signing !== null)
        this.output.write(`Signatures:\n${await this.verifySignaturesAsync(files, layout, target, manifest.product.name, manifest.product.windowsPublisher)}\n`);
      return 0;
    }
    catch (error) {
      if (!(error instanceof PackagingException || error instanceof PackageException || error instanceof ProcessException || error instanceof ModuleException))
        throw error;
      this.output.write(`${error.message}\n`);
      return 1;
    }
  }

  private createSigning(target: PackageTarget, layout: PackageLayout): TrustedSigningModule {
    if (target.platform !== PackageTarget.WINDOWS)
      throw new PackagingException(`${Package.SIGNED_OPTION} signs Windows packages only, so it cannot sign the ${target.id} package.`);
    return new TrustedSigningModule(this.runner, layout.signing, this.environment);
  }

  private async verifySignaturesAsync(packages: readonly string[], layout: PackageLayout, target: PackageTarget, productName: string, publisher: string): Promise<string> {
    const folder = [Package.WINDOWS_FOLDER_PREFIX, ...(target.architecture === Package.X64 ? [] : [target.architecture]), Package.UNPACKED_FOLDER_SUFFIX].join("-");
    const program = path.join(layout.output, folder, `${productName}${Package.PROGRAM_EXTENSION}`);
    if (!existsSync(program))
      throw new PackagingException(`electron-builder finished without the unpacked program ${program}, whose signature the check reads.`);
    const resources = path.join(layout.output, folder, ...Package.RESOURCES_SEGMENTS);
    const addons = existsSync(resources)
      ? (await readdir(resources, { recursive: true, withFileTypes: true }))
        .filter(t => t.isFile() && path.extname(t.name) === WindowsAddonBuilder.ADDON_EXTENSION)
        .map(t => path.join(t.parentPath, t.name))
        .sort()
      : [];
    return new AuthenticodeCheck(this.runner, this.root, this.environment).verifyAsync([...packages, program, ...addons], publisher);
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
  process.exitCode = await new Package(root, process.platform, process.arch, stage, runner, process.env, process.stdout, TrustedSigningModule.GALLERY_PACKAGE)
    .runAsync(process.argv.slice(2));
}
