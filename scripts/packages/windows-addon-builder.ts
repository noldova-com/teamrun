/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { copyFile, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import type NodeGyp from "../toolchain/node-gyp.ts";
import type BuildLayout from "./build-layout.ts";
import type PackageManifest from "./package-manifest.ts";
import PackageException from "./package.exception.ts";

export default class WindowsAddonBuilder {
  public static readonly OUTPUT_FOLDER: string = "native";
  public static readonly ADDON_EXTENSION: string = ".node";
  private static readonly WINDOWS: string = "win32";
  private static readonly SOURCE_SEGMENTS: readonly string[] = ["src", "native"];
  private static readonly SOURCE_EXTENSION: string = ".c";
  private static readonly PROJECT_FILE: string = "binding.gyp";
  private static readonly BUILT_SEGMENTS: readonly string[] = ["build", "Release"];
  private static readonly NODE_API_VERSION: number = 8;
  private static readonly REBUILD_ARGUMENTS: readonly string[] = ["rebuild", "--loglevel=error", "--enable-lto=false", "--enable-thin-lto=false", "--devdir"];
  private static readonly NO_TOOLCHAIN: string = "Could not find any Visual Studio installation to use";
  private static readonly NAME_SEPARATOR: string = "-";
  private static readonly TARGET_SEPARATOR: string = "_";
  private static readonly ARM64: string = "arm64";

  private readonly layout: BuildLayout;
  private readonly nodeGyp: NodeGyp;
  private readonly platform: string;
  private readonly architecture: string;

  public constructor(layout: BuildLayout, nodeGyp: NodeGyp, platform: string, architecture: string) {
    this.layout = layout;
    this.nodeGyp = nodeGyp;
    this.platform = platform;
    this.architecture = architecture;
  }

  public async buildAsync(manifest: PackageManifest, output: string): Promise<void> {
    if (this.platform !== WindowsAddonBuilder.WINDOWS)
      return;
    for (const addon of manifest.windowsAddons)
      await this.buildAddonAsync(manifest, addon, output);
  }

  private async buildAddonAsync(manifest: PackageManifest, addon: string, output: string): Promise<void> {
    const work = this.layout.locateAddonWork(manifest, addon);
    const source = `${addon}${WindowsAddonBuilder.SOURCE_EXTENSION}`;
    const target = addon.replaceAll(WindowsAddonBuilder.NAME_SEPARATOR, WindowsAddonBuilder.TARGET_SEPARATOR);
    await rm(work, { recursive: true, force: true });
    await mkdir(work, { recursive: true });
    await copyFile(this.layout.locateSource(manifest, ...WindowsAddonBuilder.SOURCE_SEGMENTS, source), path.join(work, source));
    await writeFile(path.join(work, WindowsAddonBuilder.PROJECT_FILE), `${JSON.stringify({
      targets: [{ target_name: target, sources: [source], defines: [`NAPI_VERSION=${WindowsAddonBuilder.NODE_API_VERSION}`] }]
    }, null, 2)}\n`);

    const result = await this.nodeGyp.runAsync([...WindowsAddonBuilder.REBUILD_ARGUMENTS, this.layout.nodeGypFolder], work);
    if (!result.isSuccessful)
      throw new PackageException(result.text.includes(WindowsAddonBuilder.NO_TOOLCHAIN)
        ? `Building ${manifest.name}'s Windows addon ${addon} needs ${this.describeToolchain()}, and node-gyp found no Visual Studio with it. Install it and run npm run build again.`
        : `Building ${manifest.name}'s Windows addon ${addon} failed with exit code ${result.exitCode}:\n${result.text}`);

    await mkdir(path.join(output, WindowsAddonBuilder.OUTPUT_FOLDER), { recursive: true });
    await copyFile(
      path.join(work, ...WindowsAddonBuilder.BUILT_SEGMENTS, `${target}${WindowsAddonBuilder.ADDON_EXTENSION}`),
      path.join(output, WindowsAddonBuilder.OUTPUT_FOLDER, `${addon}${WindowsAddonBuilder.ADDON_EXTENSION}`));
  }

  private describeToolchain(): string {
    const workload = "the \"Desktop development with C++\" workload of Visual Studio or the Visual Studio Build Tools, 2022 or later";
    return this.architecture === WindowsAddonBuilder.ARM64 ? `${workload}, with its C++ ARM64 build tools component` : workload;
  }
}
