/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import { chmod } from "node:fs/promises";
import path from "node:path";

import type ProductIdentity from "../packages/product-identity.ts";
import type ProcessRunner from "../processes/process-runner.ts";
import InstalledPackage from "./installed-package.ts";
import PackageLayout from "./package-layout.ts";
import PackageTarget from "./package-target.ts";
import PackagingException from "./packaging.exception.ts";

export default class PackageInstaller {
  private static readonly LIMIT: number = 120_000;
  private static readonly LOCAL_APP_DATA: string = "LOCALAPPDATA";
  private static readonly PROGRAMS_FOLDER: string = "Programs";
  private static readonly WINDOWS_PROGRAM_EXTENSION: string = ".exe";
  private static readonly RESOURCES_FOLDER: string = "resources";
  private static readonly SILENT_INSTALL: readonly string[] = ["/S"];
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

  private static requireFile(file: string): void {
    if (!existsSync(file))
      throw new PackagingException(`The installed package has no ${file}.`);
  }

  private async installWindowsAsync(installer: string, product: ProductIdentity, folder: string): Promise<InstalledPackage> {
    const localAppData = this.environment[PackageInstaller.LOCAL_APP_DATA] ?? "";
    if (localAppData.length === 0)
      throw new PackagingException(`${PackageInstaller.LOCAL_APP_DATA} must name the folder the installer installs into for the user.`);
    await this.requireAsync(installer, PackageInstaller.SILENT_INSTALL, folder);
    const program = path.join(localAppData, PackageInstaller.PROGRAMS_FOLDER, product.slug, `${product.name}${PackageInstaller.WINDOWS_PROGRAM_EXTENSION}`);
    PackageInstaller.requireFile(program);
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
      await Promise.allSettled([this.runner.captureAsync(PackageInstaller.DISK_IMAGES, [...PackageInstaller.DETACH, mount], folder, PackageInstaller.LIMIT)]);
      throw error;
    }
    await this.requireAsync(PackageInstaller.DISK_IMAGES, [...PackageInstaller.DETACH, mount], folder);
    const program = path.join(application, ...PackageInstaller.BUNDLE_SEGMENTS, product.name);
    PackageInstaller.requireFile(program);
    return new InstalledPackage(program, program, path.join(application, ...PackageInstaller.BUNDLE_RESOURCES_SEGMENTS));
  }

  private async unpackAppImageAsync(file: string, product: ProductIdentity, folder: string): Promise<InstalledPackage> {
    await chmod(file, PackageInstaller.EXECUTABLE_MODE);
    await this.requireAsync(file, PackageInstaller.EXTRACT, folder);
    const extracted = path.join(folder, PackageInstaller.EXTRACTED_FOLDER);
    const program = path.join(extracted, product.slug);
    PackageInstaller.requireFile(program);
    return new InstalledPackage(file, program, path.join(extracted, PackageInstaller.RESOURCES_FOLDER));
  }

  private async requireAsync(command: string, commandArguments: readonly string[], folder: string): Promise<void> {
    const result = await this.runner.captureAsync(command, commandArguments, folder, PackageInstaller.LIMIT);
    if (!result.isSuccessful)
      throw new PackagingException(`${path.basename(command)} ${commandArguments.join(" ")} failed with exit code ${result.exitCode}:\n${result.text}`);
  }
}
