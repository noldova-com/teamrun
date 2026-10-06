/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import ProductIdentity from "../packages/product-identity.ts";
import type RootManifest from "../packages/root-manifest.ts";
import PackageTarget from "./package-target.ts";

export default class PackageConfiguration {
  private static readonly LICENSE_FILE: string = "LICENSE";
  private static readonly FONTS_FOLDER: string = "assets/fonts";
  private static readonly FONT_LICENSE_FILTER: readonly string[] = ["*.txt"];
  private static readonly WINDOW_LICENSES_SEGMENTS: readonly string[] = ["_build", "window", "3rdpartylicenses.txt"];
  private static readonly LICENSES_FOLDER: string = "licenses";
  private static readonly WINDOW_LICENSES_FILE: string = "window-third-party.txt";
  private static readonly EXTENSION_MACRO: string = "${ext}";
  private static readonly MAC_CATEGORY: string = "public.app-category.developer-tools";
  private static readonly LINUX_CATEGORY: string = "Development";
  private static readonly APPIMAGE_TOOLSET: string = "1.0.3";
  private static readonly FUSES: Readonly<Record<string, boolean>> = {
    runAsNode: true,
    enableCookieEncryption: false,
    enableNodeOptionsEnvironmentVariable: false,
    enableNodeCliInspectArguments: false,
    enableEmbeddedAsarIntegrityValidation: true,
    onlyLoadAppFromAsar: true,
    loadBrowserProcessSpecificV8Snapshot: false,
    grantFileProtocolExtraPrivileges: true
  };

  private readonly root: string;
  private readonly manifest: RootManifest;
  private readonly target: PackageTarget;
  private readonly stage: string;
  private readonly output: string;
  private readonly electronDistribution: string;
  private readonly electronVersion: string;

  public constructor(root: string, manifest: RootManifest, target: PackageTarget, stage: string, output: string, electronDistribution: string, electronVersion: string) {
    this.root = root;
    this.manifest = manifest;
    this.target = target;
    this.stage = stage;
    this.output = output;
    this.electronDistribution = electronDistribution;
    this.electronVersion = electronVersion;
  }

  public get fileNames(): readonly string[] {
    return this.target.listFileNames(this.manifest.product.name);
  }

  public toJson(): Record<string, unknown> {
    const product = this.manifest.product;
    return {
      appId: product.applicationId,
      productName: product.name,
      copyright: `Copyright (c) ${product.publisher}`,
      directories: { app: this.stage, output: this.output },
      electronDist: this.electronDistribution,
      electronVersion: this.electronVersion,
      asar: { smartUnpack: false },
      npmRebuild: false,
      nodeGypRebuild: false,
      buildDependenciesFromSource: false,
      electronFuses: this.target.platform === PackageTarget.MACOS ? { ...PackageConfiguration.FUSES, resetAdHocDarwinSignature: true } : PackageConfiguration.FUSES,
      extraResources: this.listLicenses(),
      publish: null,
      ...this.describePlatform()
    };
  }

  public async writeAsync(file: string): Promise<void> {
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, `${JSON.stringify(this.toJson(), null, 2)}\n`);
  }

  private describePlatform(): Record<string, unknown> {
    const product = this.manifest.product;
    const icons = path.join(this.root, product.icons);
    const target = this.target.formats.map(t => ({ target: t, arch: [this.target.architecture] }));
    const artifactName = this.target.formatFileName(product.name, PackageConfiguration.EXTENSION_MACRO);
    switch (this.target.platform) {
      case PackageTarget.WINDOWS:
        return {
          win: { target, icon: path.join(icons, ProductIdentity.WINDOWS_ICON_FILE), artifactName },
          nsis: { oneClick: true, perMachine: false, deleteAppDataOnUninstall: false, shortcutName: product.name, uninstallDisplayName: product.name, artifactName }
        };
      case PackageTarget.MACOS:
        return { mac: { target, icon: path.join(icons, ProductIdentity.MAC_ICON_FILE), category: PackageConfiguration.MAC_CATEGORY, artifactName } };
      default:
        return {
          toolsets: { appimage: PackageConfiguration.APPIMAGE_TOOLSET },
          linux: {
            target,
            icon: path.join(icons, ProductIdentity.LINUX_ICON_FILE),
            executableName: product.slug,
            syncDesktopName: true,
            category: PackageConfiguration.LINUX_CATEGORY,
            artifactName,
            desktop: { entry: { Name: product.name, StartupWMClass: product.applicationId } }
          }
        };
    }
  }

  private listLicenses(): readonly Record<string, unknown>[] {
    return [
      { from: path.join(this.root, PackageConfiguration.LICENSE_FILE), to: `${PackageConfiguration.LICENSES_FOLDER}/${PackageConfiguration.LICENSE_FILE}` },
      { from: path.join(this.root, PackageConfiguration.FONTS_FOLDER), to: PackageConfiguration.LICENSES_FOLDER, filter: PackageConfiguration.FONT_LICENSE_FILTER },
      { from: path.join(this.stage, ...PackageConfiguration.WINDOW_LICENSES_SEGMENTS), to: `${PackageConfiguration.LICENSES_FOLDER}/${PackageConfiguration.WINDOW_LICENSES_FILE}` }
    ];
  }
}
