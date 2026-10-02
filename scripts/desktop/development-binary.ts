/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { cp, mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Writable } from "node:stream";

import { Data, NtExecutable, NtExecutableResource, Resource } from "resedit";

import type ProductIdentity from "../packages/product-identity.ts";
import RootManifest from "../packages/root-manifest.ts";
import ProcessRunner from "../processes/process-runner.ts";
import DesktopException from "./desktop.exception.ts";

export default class DevelopmentBinary {
  public static readonly OUTPUT_SEGMENTS: readonly string[] = ["_build", "development-app"];
  public static readonly PATH_FILE: string = "path.txt";

  private static readonly STAMP_FILE: string = "development-app.sha256";
  private static readonly DISTRIBUTION_SEGMENTS: readonly string[] = ["node_modules", "electron", "dist"];
  private static readonly MANIFEST_SEGMENTS: readonly string[] = ["node_modules", "electron", "package.json"];
  private static readonly INSTALLER_SEGMENTS: readonly string[] = ["node_modules", "electron", "install.js"];
  private static readonly INSTALL_TIMEOUT: number = 600_000;
  private static readonly WINDOWS_ICON_FILE: string = "icon-dark.ico";
  private static readonly MAC_ICON_SOURCE_FILE: string = "icon-dock-512.png";
  private static readonly MAC_ICON_EXTENSION: string = ".icns";
  private static readonly ELECTRON_ICON_FILE: string = "electron.icns";
  private static readonly ICONSET_EXTENSION: string = ".iconset";
  private static readonly ICONSET: readonly (readonly [string, number])[] = [
    ["icon_16x16.png", 16], ["icon_16x16@2x.png", 32], ["icon_32x32.png", 32], ["icon_32x32@2x.png", 64], ["icon_128x128.png", 128],
    ["icon_128x128@2x.png", 256], ["icon_256x256.png", 256], ["icon_256x256@2x.png", 512], ["icon_512x512.png", 512]
  ];
  private static readonly MAC_RESOURCES_SEGMENTS: readonly string[] = ["Contents", "Resources"];
  private static readonly RESIZE_COMMAND: string = "sips";
  private static readonly ICONSET_COMMAND: string = "iconutil";
  private static readonly WINDOWS_EXTENSION: string = ".exe";
  private static readonly BUNDLE_SUFFIX: string = ".app";
  private static readonly HELPER_SUFFIX: string = ".helper";
  private static readonly MAC_HELPER_PREFIX: string = "Electron Helper";
  private static readonly WINDOWS_PLATFORM: string = "win32";
  private static readonly MAC_PLATFORM: string = "darwin";
  private static readonly LINUX_PLATFORM: string = "linux";
  private static readonly ELECTRON_NAME: string = "Electron";
  private static readonly ELECTRON_EXECUTABLE: string = "electron.exe";
  private static readonly ELECTRON_BUNDLE: string = "Electron.app";
  private static readonly ELECTRON_LINUX_EXECUTABLE: string = "electron";
  private static readonly MAC_EXECUTABLE_SEGMENTS: readonly string[] = ["Contents", "MacOS"];
  private static readonly MAC_FRAMEWORKS_SEGMENTS: readonly string[] = ["Contents", "Frameworks"];
  private static readonly MAC_PLIST_SEGMENTS: readonly string[] = ["Contents", "Info.plist"];
  private static readonly PLIST_COMMAND: string = "plutil";
  private static readonly SIGN_COMMAND: string = "codesign";
  private static readonly SIGN_ARGUMENTS: readonly string[] = ["--force", "--deep", "--sign", "-"];
  private static readonly ICON_GROUP: number = 1;
  private static readonly COMMAND_TIMEOUT: number = 60_000;
  private static readonly UNSUPPORTED_PLATFORM: string = "The development binary is supported on Windows, macOS and Linux only.";
  private static readonly NO_VERSION_INFO: string = "Electron's executable carries no version information to relabel.";

  private readonly root: string;
  private readonly runner: ProcessRunner;
  private readonly platform: string;
  private readonly architecture: string;

  public constructor(root: string, runner: ProcessRunner, platform: string = process.platform, architecture: string = process.arch) {
    this.root = root;
    this.runner = runner;
    this.platform = platform;
    this.architecture = architecture;
  }

  public get output(): string {
    return path.join(this.root, ...DevelopmentBinary.OUTPUT_SEGMENTS);
  }

  public async prepareAsync(report: Writable): Promise<string> {
    const manifest = await RootManifest.readAsync(this.root);
    const product = manifest.product;
    const output = this.output;
    const binary = this.locateBinary(output, product);
    const icons = path.join(this.root, product.icons);
    const stamp = createHash("sha256")
      .update(await readFile(path.join(this.root, ...DevelopmentBinary.MANIFEST_SEGMENTS)))
      .update(JSON.stringify([manifest.productVersion, product, product.formatDevelopmentApplicationId(this.root), this.platform, this.architecture]))
      .update(await readFile(import.meta.filename))
      .update(await readFile(path.join(icons, DevelopmentBinary.WINDOWS_ICON_FILE)))
      .update(await readFile(path.join(icons, DevelopmentBinary.MAC_ICON_SOURCE_FILE)))
      .digest("hex");
    const stampPath = path.join(output, DevelopmentBinary.STAMP_FILE);
    if (!existsSync(stampPath) || await readFile(stampPath, "utf8") !== stamp || !existsSync(binary)) {
      report.write(`Preparing the ${product.name} development binary...\n`);
      const distribution = path.join(this.root, ...DevelopmentBinary.DISTRIBUTION_SEGMENTS);
      if (!existsSync(distribution))
        await this.runAsync(process.execPath, [path.join(this.root, ...DevelopmentBinary.INSTALLER_SEGMENTS)], DevelopmentBinary.INSTALL_TIMEOUT);
      await rm(output, { recursive: true, force: true });
      await mkdir(path.dirname(output), { recursive: true });
      await cp(distribution, output, { recursive: true, verbatimSymlinks: true });
      if (this.platform === DevelopmentBinary.WINDOWS_PLATFORM)
        await this.relabelWindowsAsync(output, binary, product, manifest.productVersion, icons);
      else if (this.platform === DevelopmentBinary.MAC_PLATFORM)
        await this.relabelMacAsync(output, product, icons);
      else
        await rename(path.join(output, DevelopmentBinary.ELECTRON_LINUX_EXECUTABLE), binary);
      await writeFile(stampPath, stamp, "utf8");
    }
    await writeFile(path.join(output, DevelopmentBinary.PATH_FILE), binary, "utf8");
    return binary;
  }

  private locateBinary(output: string, product: ProductIdentity): string {
    switch (this.platform) {
      case DevelopmentBinary.WINDOWS_PLATFORM: return path.join(output, `${product.name}${DevelopmentBinary.WINDOWS_EXTENSION}`);
      case DevelopmentBinary.MAC_PLATFORM: return path.join(output, `${product.name}${DevelopmentBinary.BUNDLE_SUFFIX}`, ...DevelopmentBinary.MAC_EXECUTABLE_SEGMENTS, product.name);
      case DevelopmentBinary.LINUX_PLATFORM: return path.join(output, product.slug);
      default: throw new DesktopException(DevelopmentBinary.UNSUPPORTED_PLATFORM);
    }
  }

  private async relabelWindowsAsync(output: string, binary: string, product: ProductIdentity, version: string, icons: string): Promise<void> {
    const source = path.join(output, DevelopmentBinary.ELECTRON_EXECUTABLE);
    const executable = NtExecutable.from(await readFile(source), { ignoreCert: true });
    const resource = NtExecutableResource.from(executable);
    const [info] = Resource.VersionInfo.fromEntries(resource.entries);
    const [language] = info?.getAllLanguagesForStringValues() ?? [];
    if (info === undefined || language === undefined)
      throw new DesktopException(DevelopmentBinary.NO_VERSION_INFO);
    const fileName = path.basename(binary);
    info.setStringValues(language, {
      CompanyName: product.publisher,
      FileDescription: product.name,
      ProductName: product.name,
      InternalName: fileName,
      OriginalFilename: fileName,
      LegalCopyright: `Copyright (c) ${product.publisher}.`,
      FileVersion: version,
      ProductVersion: version
    });
    info.setFileVersion(version, language.lang);
    info.setProductVersion(version, language.lang);
    info.outputToResourceEntries(resource.entries);
    const icon = Data.IconFile.from(await readFile(path.join(icons, DevelopmentBinary.WINDOWS_ICON_FILE)));
    Resource.IconGroupEntry.replaceIconsForResource(resource.entries, DevelopmentBinary.ICON_GROUP, language.lang, icon.icons.map(t => t.data));
    resource.outputResource(executable);
    await writeFile(binary, Buffer.from(executable.generate()));
    await rm(source);
  }

  private async relabelMacAsync(output: string, product: ProductIdentity, icons: string): Promise<void> {
    const bundle = path.join(output, `${product.name}${DevelopmentBinary.BUNDLE_SUFFIX}`);
    await rename(path.join(output, DevelopmentBinary.ELECTRON_BUNDLE), bundle);
    const identifier = product.formatDevelopmentApplicationId(this.root);
    await this.relabelMacBundleAsync(bundle, DevelopmentBinary.ELECTRON_NAME, product.name, identifier);
    await this.replaceMacIconAsync(output, bundle, product, icons);
    const frameworks = path.join(bundle, ...DevelopmentBinary.MAC_FRAMEWORKS_SEGMENTS);
    const helperIdentifier = `${identifier}${DevelopmentBinary.HELPER_SUFFIX}`;
    for (const entry of await readdir(frameworks)) {
      if (!entry.startsWith(DevelopmentBinary.MAC_HELPER_PREFIX) || !entry.endsWith(DevelopmentBinary.BUNDLE_SUFFIX))
        continue;
      const oldName = entry.slice(0, -DevelopmentBinary.BUNDLE_SUFFIX.length);
      const newName = oldName.replace(DevelopmentBinary.ELECTRON_NAME, product.name);
      const helper = path.join(frameworks, newName + DevelopmentBinary.BUNDLE_SUFFIX);
      await rename(path.join(frameworks, entry), helper);
      const role = oldName.slice(DevelopmentBinary.MAC_HELPER_PREFIX.length).trim().replace(/[()]/g, "").toLowerCase();
      await this.relabelMacBundleAsync(helper, oldName, newName, role.length === 0 ? helperIdentifier : `${helperIdentifier}.${role}`);
    }
    await this.runAsync(DevelopmentBinary.SIGN_COMMAND, [...DevelopmentBinary.SIGN_ARGUMENTS, bundle]);
  }

  private async replaceMacIconAsync(output: string, bundle: string, product: ProductIdentity, icons: string): Promise<void> {
    const iconset = path.join(output, `${product.name}${DevelopmentBinary.ICONSET_EXTENSION}`);
    const source = path.join(icons, DevelopmentBinary.MAC_ICON_SOURCE_FILE);
    const iconFile = `${product.slug}${DevelopmentBinary.MAC_ICON_EXTENSION}`;
    await mkdir(iconset, { recursive: true });
    for (const [name, size] of DevelopmentBinary.ICONSET)
      await this.runAsync(DevelopmentBinary.RESIZE_COMMAND, ["-z", String(size), String(size), source, "--out", path.join(iconset, name)]);
    const resources = path.join(bundle, ...DevelopmentBinary.MAC_RESOURCES_SEGMENTS);
    await this.runAsync(DevelopmentBinary.ICONSET_COMMAND, ["--convert", "icns", "--output", path.join(resources, iconFile), iconset]);
    await rm(iconset, { recursive: true, force: true });
    await rm(path.join(resources, DevelopmentBinary.ELECTRON_ICON_FILE), { force: true });
    await this.runAsync(DevelopmentBinary.PLIST_COMMAND, ["-replace", "CFBundleIconFile", "-string", iconFile, path.join(bundle, ...DevelopmentBinary.MAC_PLIST_SEGMENTS)]);
  }

  private async relabelMacBundleAsync(bundle: string, oldName: string, newName: string, identifier: string): Promise<void> {
    const executables = path.join(bundle, ...DevelopmentBinary.MAC_EXECUTABLE_SEGMENTS);
    await rename(path.join(executables, oldName), path.join(executables, newName));
    const plist = path.join(bundle, ...DevelopmentBinary.MAC_PLIST_SEGMENTS);
    for (const [key, value] of Object.entries({ CFBundleExecutable: newName, CFBundleName: newName, CFBundleDisplayName: newName, CFBundleIdentifier: identifier }))
      await this.runAsync(DevelopmentBinary.PLIST_COMMAND, ["-replace", key, "-string", value, plist]);
  }

  private async runAsync(command: string, commandArguments: readonly string[], timeout: number = DevelopmentBinary.COMMAND_TIMEOUT): Promise<void> {
    const result = await this.runner.captureAsync(command, commandArguments, this.root, timeout);
    if (!result.isSuccessful)
      throw new DesktopException(`"${command} ${commandArguments.join(" ")}" failed with ${result.exitCode}: ${result.errorOutput.trim()}`);
  }
}

if (import.meta.main)
  await new DevelopmentBinary(process.cwd(), new ProcessRunner()).prepareAsync(process.stdout);
