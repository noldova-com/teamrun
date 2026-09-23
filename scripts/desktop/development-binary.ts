/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { cp, mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import { Data, NtExecutable, NtExecutableResource, Resource } from "resedit";

import Config from "../config.ts";

export default class DevelopmentBinary {
  private static readonly OUTPUT: string = "_build/electron-dev";
  private static readonly STAMP: string = "teamrun-dev.sha256";
  private static readonly DISTRIBUTION: string = "node_modules/electron/dist";
  private static readonly MANIFEST: string = "node_modules/electron/package.json";
  private static readonly WINDOWS_ICON: string = "assets/icons/icon-dark.ico";
  private static readonly WINDOWS_EXECUTABLE: string = "TeamRun.exe";
  private static readonly MAC_BUNDLE: string = "TeamRun.app";
  private static readonly LINUX_EXECUTABLE: string = "teamrun";
  private static readonly BUNDLE_IDENTIFIER: string = "com.noldova.teamrun";
  private static readonly MAC_HELPER_PREFIX: string = "Electron Helper";
  private static readonly BUNDLE_SUFFIX: string = ".app";
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
  private static readonly HELPER_IDENTIFIER_SUFFIX: string = ".helper";
  private static readonly COMPANY_NAME: string = "Noldova";
  private static readonly COPYRIGHT: string = "Copyright (c) Noldova.";
  private static readonly HASH_ALGORITHM: string = "sha256";
  private static readonly UTF8_ENCODING: BufferEncoding = "utf8";
  private static readonly HASH_ENCODING: "hex" = "hex";
  private static readonly PREPARING: string = "Preparing the TeamRun development binary...\n";
  private static readonly UNSUPPORTED_PLATFORM: string = "The development binary is supported on Windows, macOS and Linux only.";
  private static readonly NO_VERSION_INFO: string = "The Electron executable carries no version information to relabel.";
  private static readonly ICON_GROUP: number = 1;
  private static readonly PLIST_TIMEOUT: number = 30_000;
  private static readonly EXECUTE = promisify(execFile);

  public async prepare(): Promise<string> {
    const output = path.resolve(DevelopmentBinary.OUTPUT);
    const binary = this.binaryPath(output);
    const stamp = createHash(DevelopmentBinary.HASH_ALGORITHM)
      .update(await readFile(DevelopmentBinary.MANIFEST))
      .update(Config.VERSION).update(Config.PRODUCT_NAME).update(process.platform).update(process.arch)
      .update(await readFile(import.meta.filename))
      .update(await readFile(DevelopmentBinary.WINDOWS_ICON)).digest(DevelopmentBinary.HASH_ENCODING);
    const stampPath = path.join(output, DevelopmentBinary.STAMP);
    if (existsSync(stampPath) && await readFile(stampPath, DevelopmentBinary.UTF8_ENCODING) === stamp && existsSync(binary))
      return binary;

    process.stdout.write(DevelopmentBinary.PREPARING);
    await rm(output, { recursive: true, force: true });
    await mkdir(path.dirname(output), { recursive: true });
    await cp(path.resolve(DevelopmentBinary.DISTRIBUTION), output, { recursive: true, verbatimSymlinks: true });
    if (process.platform === DevelopmentBinary.WINDOWS_PLATFORM)
      await this.relabelWindows(output);
    else if (process.platform === DevelopmentBinary.MAC_PLATFORM)
      await this.relabelMac(output);
    else
      await rename(path.join(output, DevelopmentBinary.ELECTRON_LINUX_EXECUTABLE), binary);
    await writeFile(stampPath, stamp, DevelopmentBinary.UTF8_ENCODING);
    return binary;
  }

  private binaryPath(output: string): string {
    switch (process.platform) {
      case DevelopmentBinary.WINDOWS_PLATFORM: return path.join(output, DevelopmentBinary.WINDOWS_EXECUTABLE);
      case DevelopmentBinary.MAC_PLATFORM: return path.join(output, DevelopmentBinary.MAC_BUNDLE, ...DevelopmentBinary.MAC_EXECUTABLE_SEGMENTS, Config.PRODUCT_NAME);
      case DevelopmentBinary.LINUX_PLATFORM: return path.join(output, DevelopmentBinary.LINUX_EXECUTABLE);
      default: throw new Error(DevelopmentBinary.UNSUPPORTED_PLATFORM);
    }
  }

  private async relabelWindows(output: string): Promise<void> {
    const source = path.join(output, DevelopmentBinary.ELECTRON_EXECUTABLE);
    const executable = NtExecutable.from(await readFile(source), { ignoreCert: true });
    const resource = NtExecutableResource.from(executable);
    const [info] = Resource.VersionInfo.fromEntries(resource.entries);
    const [language] = info?.getAllLanguagesForStringValues() ?? [];
    if (info === undefined || language === undefined)
      throw new Error(DevelopmentBinary.NO_VERSION_INFO);
    info.setStringValues(language, {
      CompanyName: DevelopmentBinary.COMPANY_NAME,
      FileDescription: Config.PRODUCT_NAME,
      ProductName: Config.PRODUCT_NAME,
      InternalName: DevelopmentBinary.WINDOWS_EXECUTABLE,
      OriginalFilename: DevelopmentBinary.WINDOWS_EXECUTABLE,
      LegalCopyright: DevelopmentBinary.COPYRIGHT,
      FileVersion: Config.VERSION,
      ProductVersion: Config.VERSION
    });
    info.setFileVersion(Config.VERSION, language.lang);
    info.setProductVersion(Config.VERSION, language.lang);
    info.outputToResourceEntries(resource.entries);
    const icon = Data.IconFile.from(await readFile(DevelopmentBinary.WINDOWS_ICON));
    Resource.IconGroupEntry.replaceIconsForResource(resource.entries, DevelopmentBinary.ICON_GROUP, language.lang, icon.icons.map(t => t.data));
    resource.outputResource(executable);
    await writeFile(path.join(output, DevelopmentBinary.WINDOWS_EXECUTABLE), Buffer.from(executable.generate()));
    await rm(source);
  }

  private async relabelMac(output: string): Promise<void> {
    const bundle = path.join(output, DevelopmentBinary.MAC_BUNDLE);
    await rename(path.join(output, DevelopmentBinary.ELECTRON_BUNDLE), bundle);
    await this.relabelMacBundle(bundle, DevelopmentBinary.ELECTRON_NAME, Config.PRODUCT_NAME, DevelopmentBinary.BUNDLE_IDENTIFIER);
    const frameworks = path.join(bundle, ...DevelopmentBinary.MAC_FRAMEWORKS_SEGMENTS);
    for (const entry of await readdir(frameworks)) {
      if (!entry.startsWith(DevelopmentBinary.MAC_HELPER_PREFIX) || !entry.endsWith(DevelopmentBinary.BUNDLE_SUFFIX))
        continue;
      const oldName = entry.slice(0, -DevelopmentBinary.BUNDLE_SUFFIX.length);
      const newName = oldName.replace(DevelopmentBinary.ELECTRON_NAME, Config.PRODUCT_NAME);
      const helper = path.join(frameworks, newName + DevelopmentBinary.BUNDLE_SUFFIX);
      await rename(path.join(frameworks, entry), helper);
      const suffix = oldName.slice(DevelopmentBinary.MAC_HELPER_PREFIX.length).trim().replace(/[()]/g, "").toLowerCase();
      const identifier = DevelopmentBinary.BUNDLE_IDENTIFIER + DevelopmentBinary.HELPER_IDENTIFIER_SUFFIX + (suffix.length === 0 ? "" : "." + suffix);
      await this.relabelMacBundle(helper, oldName, newName, identifier);
    }
  }

  private async relabelMacBundle(bundle: string, oldName: string, newName: string, identifier: string): Promise<void> {
    const executables = path.join(bundle, ...DevelopmentBinary.MAC_EXECUTABLE_SEGMENTS);
    await rename(path.join(executables, oldName), path.join(executables, newName));
    const plist = path.join(bundle, ...DevelopmentBinary.MAC_PLIST_SEGMENTS);
    for (const [key, value] of Object.entries({
      CFBundleExecutable: newName, CFBundleName: newName, CFBundleDisplayName: newName, CFBundleIdentifier: identifier
    }))
      await DevelopmentBinary.EXECUTE("plutil", ["-replace", key, "-string", value, plist], { timeout: DevelopmentBinary.PLIST_TIMEOUT });
  }
}
