/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import { chmod, readdir, stat } from "node:fs/promises";
import path from "node:path";

import type ProductIdentity from "../packages/product-identity.ts";
import type ProcessRunner from "../processes/process-runner.ts";
import ProcessTimeoutException from "../processes/process-timeout.exception.ts";
import InstalledPackage from "./installed-package.ts";
import PackageLayout from "./package-layout.ts";
import PackageTarget from "./package-target.ts";
import PackagingException from "./packaging.exception.ts";

export default class PackageInstaller {
  private static readonly LIMIT: number = 120_000;
  private static readonly LOCAL_APP_DATA: string = "LOCALAPPDATA";
  private static readonly PROGRAMS_FOLDER: string = "Programs";
  private static readonly WINDOWS_PROGRAM_EXTENSION: string = ".exe";
  private static readonly WINDOWS_LIBRARY_EXTENSION: string = ".dll";
  private static readonly RESOURCES_FOLDER: string = "resources";
  private static readonly SILENT_INSTALL: readonly string[] = ["/S"];
  private static readonly MODULE_PATH: string = "PSModulePath";
  private static readonly SYSTEM_ROOT: string = "SystemRoot";
  private static readonly WINDOWS_POWERSHELL_MODULES: readonly string[] = ["System32", "WindowsPowerShell", "v1.0", "Modules"];
  private static readonly DISK_IMAGES: string = "hdiutil";
  private static readonly ATTACH: string = "attach";
  private static readonly ATTACH_OPTIONS: readonly string[] = ["-nobrowse", "-readonly", "-mountpoint"];
  private static readonly DETACH: readonly string[] = ["detach", "-force"];
  private static readonly COPY: string = "ditto";
  private static readonly MOUNT_FOLDER: string = "mount";
  private static readonly APPLICATION_EXTENSION: string = ".app";
  private static readonly BUNDLE_SEGMENTS: readonly string[] = ["Contents", "MacOS"];
  private static readonly BUNDLE_RESOURCES_SEGMENTS: readonly string[] = ["Contents", "Resources"];
  private static readonly EXECUTABLE_MODE: number = 0o755;
  private static readonly EXTRACT: readonly string[] = ["--appimage-extract"];
  private static readonly EXTRACTED_FOLDER: string = "squashfs-root";

  private readonly root: string;
  private readonly runner: ProcessRunner;
  private readonly environment: NodeJS.ProcessEnv;

  public constructor(root: string, runner: ProcessRunner, environment: NodeJS.ProcessEnv) {
    this.root = root;
    this.runner = runner;
    this.environment = environment;
  }

  public async installAsync(target: PackageTarget, product: ProductIdentity, folder: string): Promise<InstalledPackage> {
    const output = new PackageLayout(this.root).output;
    const locate = (extension: string): string => path.join(output, target.formatFileName(product.name, extension));
    switch (target.platform) {
      case PackageTarget.WINDOWS:
        return this.installWindowsAsync(locate(PackageTarget.INSTALLER), product, folder);
      case PackageTarget.MACOS:
        return this.copyFromDiskImageAsync(locate(PackageTarget.DISK_IMAGE), product, folder);
      default:
        return this.unpackAppImageAsync(locate(PackageTarget.APP_IMAGE), product, folder);
    }
  }

  private static async describeAsync(installFolder: string): Promise<string> {
    if (!existsSync(installFolder))
      return `The installer had not created ${installFolder}.`;
    const files = (await readdir(installFolder, { recursive: true, withFileTypes: true }))
      .filter(t => t.isFile())
      .map(t => path.join(t.parentPath, t.name))
      .sort();
    const lines: string[] = [];
    for (const file of files)
      lines.push(`${path.relative(installFolder, file)}: ${(await stat(file)).size} bytes`);
    return [`${installFolder} held ${files.length} files when the installer was stopped:`, ...lines].join("\n");
  }

  private static requireFiles(files: readonly string[]): void {
    const missing = files.filter(t => !existsSync(t));
    if (missing.length > 0)
      throw new PackagingException(`The installed package has no ${missing.join(", ")}.`);
  }

  private static isNamed(variable: string, name: string): boolean {
    return variable.toUpperCase() === name.toUpperCase();
  }

  private findVariable(name: string): string | undefined {
    return Object.entries(this.environment).find(([variable]) => PackageInstaller.isNamed(variable, name))?.[1];
  }

  private createInstallerEnvironment(): NodeJS.ProcessEnv {
    const systemRoot = this.findVariable(PackageInstaller.SYSTEM_ROOT) ?? "";
    if (systemRoot.length === 0)
      throw new PackagingException(`${PackageInstaller.SYSTEM_ROOT} must name the Windows folder, whose PowerShell modules the installer's checks search first.`);
    const modules = [path.win32.join(systemRoot, ...PackageInstaller.WINDOWS_POWERSHELL_MODULES), this.findVariable(PackageInstaller.MODULE_PATH) ?? ""]
      .filter(t => t.length > 0)
      .join(path.win32.delimiter);
    const others = Object.entries(this.environment).filter(([variable]) => !PackageInstaller.isNamed(variable, PackageInstaller.MODULE_PATH));
    return { ...Object.fromEntries(others), [PackageInstaller.MODULE_PATH]: modules };
  }

  private async installWindowsAsync(installer: string, product: ProductIdentity, folder: string): Promise<InstalledPackage> {
    const localAppData = this.environment[PackageInstaller.LOCAL_APP_DATA] ?? "";
    if (localAppData.length === 0)
      throw new PackagingException(`${PackageInstaller.LOCAL_APP_DATA} must name the folder the installer installs into for the user.`);
    const installFolder = path.join(localAppData, PackageInstaller.PROGRAMS_FOLDER, product.slug);
    const environment = this.createInstallerEnvironment();
    try {
      await this.runner.requireAsync(installer, PackageInstaller.SILENT_INSTALL, folder, PackageInstaller.LIMIT, environment);
    }
    catch (error) {
      if (!(error instanceof ProcessTimeoutException))
        throw error;
      throw new PackagingException(`${error.message}\n${await PackageInstaller.describeAsync(installFolder)}`, { cause: error });
    }
    const program = path.join(installFolder, `${product.name}${PackageInstaller.WINDOWS_PROGRAM_EXTENSION}`);
    const libraries = (await readdir(new PackageLayout(this.root).electron))
      .filter(t => path.extname(t).toLowerCase() === PackageInstaller.WINDOWS_LIBRARY_EXTENSION)
      .map(t => path.join(installFolder, t));
    PackageInstaller.requireFiles([program, ...libraries]);
    return new InstalledPackage(program, program, path.join(path.dirname(program), PackageInstaller.RESOURCES_FOLDER));
  }

  private async copyFromDiskImageAsync(image: string, product: ProductIdentity, folder: string): Promise<InstalledPackage> {
    const mount = path.join(folder, PackageInstaller.MOUNT_FOLDER);
    const bundle = `${product.name}${PackageInstaller.APPLICATION_EXTENSION}`;
    const application = path.join(folder, bundle);
    await this.requireAsync(PackageInstaller.DISK_IMAGES, [PackageInstaller.ATTACH, image, ...PackageInstaller.ATTACH_OPTIONS, mount], folder);
    try {
      await this.requireAsync(PackageInstaller.COPY, [path.join(mount, bundle), application], folder);
    }
    catch (error) {
      try {
        await this.requireAsync(PackageInstaller.DISK_IMAGES, [...PackageInstaller.DETACH, mount], folder);
      }
      catch (detachError) {
        throw new PackagingException(`${String(error)}\nDetaching the disk image after the failed copy failed too: ${String(detachError)}`, { cause: error });
      }
      throw error;
    }
    await this.requireAsync(PackageInstaller.DISK_IMAGES, [...PackageInstaller.DETACH, mount], folder);
    const program = path.join(application, ...PackageInstaller.BUNDLE_SEGMENTS, product.name);
    PackageInstaller.requireFiles([program]);
    return new InstalledPackage(program, program, path.join(application, ...PackageInstaller.BUNDLE_RESOURCES_SEGMENTS));
  }

  private async unpackAppImageAsync(file: string, product: ProductIdentity, folder: string): Promise<InstalledPackage> {
    await chmod(file, PackageInstaller.EXECUTABLE_MODE);
    await this.requireAsync(file, PackageInstaller.EXTRACT, folder);
    const extracted = path.join(folder, PackageInstaller.EXTRACTED_FOLDER);
    const program = path.join(extracted, product.slug);
    PackageInstaller.requireFiles([program]);
    return new InstalledPackage(file, program, path.join(extracted, PackageInstaller.RESOURCES_FOLDER));
  }

  private requireAsync(command: string, commandArguments: readonly string[], folder: string): Promise<void> {
    return this.runner.requireAsync(command, commandArguments, folder, PackageInstaller.LIMIT);
  }
}
