/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import TeamRunCommand from "../desktop/teamrun.ts";
import ProductIdentity from "../packages/product-identity.ts";
import WindowsAddonBuilder from "../packages/windows-addon-builder.ts";
import type RootManifest from "../packages/root-manifest.ts";
import PackageLayout from "./package-layout.ts";
import PackageTarget from "./package-target.ts";

export default class PackageConfiguration {
  public static readonly COMMAND_FOLDER: string = "bin";
  public static readonly WINDOWS_COMMAND_EXTENSION: string = ".cmd";
  private static readonly LICENSE_FILE: string = "LICENSE";
  private static readonly FONTS_FOLDER: string = "assets/fonts";
  private static readonly FONT_LICENSE_FILTER: readonly string[] = ["*.txt"];
  private static readonly DICTIONARIES_FOLDER: string = "assets/dictionaries";
  private static readonly WINDOW_LICENSES_SEGMENTS: readonly string[] = ["_build", "window", "3rdpartylicenses.txt"];
  private static readonly LICENSES_FOLDER: string = "licenses";
  private static readonly WINDOW_LICENSES_FILE: string = "window-third-party.txt";
  private static readonly EXTENSION_MACRO: string = "${ext}";
  private static readonly ADDONS_PATTERN: string = `**/*${WindowsAddonBuilder.ADDON_EXTENSION}`;
  private static readonly MAC_CATEGORY: string = "public.app-category.developer-tools";
  private static readonly LINUX_CATEGORY: string = "Development";
  private static readonly APPIMAGE_TOOLSET: string = "1.0.3";
  private static readonly INSTALLER_INCLUDE_SEGMENTS: readonly string[] = ["assets", "installer", "installer.nsh"];
  private static readonly WINDOWS_PROGRAM_EXTENSION: string = ".exe";
  private static readonly WINDOWS_COMMAND_FOLDER: string = "%~dp0..";
  private static readonly RESOURCES_FOLDER: string = "resources";
  private static readonly ARCHIVE: string = "app.asar";
  private static readonly WINDOWS_LINE_SEPARATOR: string = "\r\n";
  private static readonly MAC_RESOURCES_VARIABLE: string = "$resources";
  private static readonly MAC_PROGRAM_SEGMENTS: readonly string[] = ["..", "MacOS"];
  private static readonly EXECUTABLE_MODE: number = 0o755;
  private static readonly SIGNING_HASH: string = "sha256";
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
  private readonly signHook: string | null;

  public constructor(root: string, manifest: RootManifest, target: PackageTarget, stage: string, output: string, electronDistribution: string, electronVersion: string,
    signHook: string | null) {
    this.root = root;
    this.manifest = manifest;
    this.target = target;
    this.stage = stage;
    this.output = output;
    this.electronDistribution = electronDistribution;
    this.electronVersion = electronVersion;
    this.signHook = signHook;
  }

  public get fileNames(): readonly string[] {
    return this.target.listFileNames(this.manifest.product.name);
  }

  private get windowsCommandName(): string {
    return `${this.manifest.product.slug}${PackageConfiguration.WINDOWS_COMMAND_EXTENSION}`;
  }

  private get macCommand(): string {
    return path.join(new PackageLayout(this.root).command, this.manifest.product.slug);
  }

  private get windowsCommand(): string {
    return path.join(new PackageLayout(this.root).command, this.windowsCommandName);
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
      asarUnpack: [PackageConfiguration.ADDONS_PATTERN],
      npmRebuild: false,
      nodeGypRebuild: false,
      buildDependenciesFromSource: false,
      electronFuses: this.target.platform === PackageTarget.MACOS ? { ...PackageConfiguration.FUSES, resetAdHocDarwinSignature: true } : PackageConfiguration.FUSES,
      extraResources: this.listLicenses(),
      publish: null,
      ...(this.signHook === null ? {} : { forceCodeSigning: true }),
      ...this.describePlatform()
    };
  }

  public async writeAsync(file: string): Promise<void> {
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, `${JSON.stringify(this.toJson(), null, 2)}\n`);
    if (this.target.platform === PackageTarget.WINDOWS) {
      await mkdir(path.dirname(this.windowsCommand), { recursive: true });
      await writeFile(this.windowsCommand, this.describeWindowsCommand());
    }
    if (this.target.platform === PackageTarget.MACOS) {
      await mkdir(path.dirname(this.macCommand), { recursive: true });
      await writeFile(this.macCommand, this.describeMacCommand(), { mode: PackageConfiguration.EXECUTABLE_MODE });
    }
  }

  private describePlatform(): Record<string, unknown> {
    const product = this.manifest.product;
    const icons = path.join(this.root, product.icons);
    const target = this.target.formats.map(t => ({ target: t, arch: [this.target.architecture] }));
    const artifactName = this.target.formatFileName(product.name, PackageConfiguration.EXTENSION_MACRO);
    switch (this.target.platform) {
      case PackageTarget.WINDOWS:
        return {
          win: {
            target,
            icon: path.join(icons, ProductIdentity.WINDOWS_ICON_FILE),
            artifactName,
            extraFiles: [{ from: this.windowsCommand, to: `${PackageConfiguration.COMMAND_FOLDER}/${this.windowsCommandName}` }],
            ...(this.signHook === null ? {} : {
              signtoolOptions: { sign: this.signHook, signingHashAlgorithms: [PackageConfiguration.SIGNING_HASH], publisherName: product.windowsPublisher },
              signExts: [WindowsAddonBuilder.ADDON_EXTENSION]
            })
          },
          nsis: {
            oneClick: true,
            perMachine: false,
            deleteAppDataOnUninstall: false,
            shortcutName: product.name,
            uninstallDisplayName: product.name,
            artifactName,
            include: path.join(this.root, ...PackageConfiguration.INSTALLER_INCLUDE_SEGMENTS)
          }
        };
      case PackageTarget.MACOS:
        return {
          mac: {
            target,
            icon: path.join(icons, ProductIdentity.MAC_ICON_FILE),
            category: PackageConfiguration.MAC_CATEGORY,
            artifactName,
            extraResources: [{ from: this.macCommand, to: `${PackageConfiguration.COMMAND_FOLDER}/${product.slug}` }]
          }
        };
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

  private describeWindowsCommand(): string {
    const folder = PackageConfiguration.WINDOWS_COMMAND_FOLDER;
    const program = path.win32.join(folder, `${this.manifest.product.name}${PackageConfiguration.WINDOWS_PROGRAM_EXTENSION}`);
    const entry = path.win32.join(folder, PackageConfiguration.RESOURCES_FOLDER, PackageConfiguration.ARCHIVE, ...TeamRunCommand.ENTRY_SEGMENTS);
    return [
      "@echo off",
      "setlocal",
      `set ${TeamRunCommand.RUN_AS_NODE_VARIABLE}=${TeamRunCommand.RUN_AS_NODE_VALUE}`,
      `"${program}" "${entry}" %*`,
      "exit /b %ERRORLEVEL%"
    ].map(t => `${t}${PackageConfiguration.WINDOWS_LINE_SEPARATOR}`).join("");
  }

  private describeMacCommand(): string {
    const resources = PackageConfiguration.MAC_RESOURCES_VARIABLE;
    const program = [resources, ...PackageConfiguration.MAC_PROGRAM_SEGMENTS, this.manifest.product.name].join(path.posix.sep);
    const entry = path.posix.join(resources, PackageConfiguration.ARCHIVE, ...TeamRunCommand.ENTRY_SEGMENTS);
    return [
      "#!/bin/sh",
      "link=\"$0\"",
      "while [ -h \"$link\" ]; do",
      "  target=$(readlink \"$link\")",
      "  case \"$target\" in",
      "    /*) link=\"$target\" ;;",
      "    *) link=\"$(dirname \"$link\")/$target\" ;;",
      "  esac",
      "done",
      "resources=$(cd -P \"$(dirname \"$link\")/..\" && pwd)",
      `export ${TeamRunCommand.RUN_AS_NODE_VARIABLE}=${TeamRunCommand.RUN_AS_NODE_VALUE}`,
      `exec "${program}" "${entry}" "$@"`
    ].map(t => `${t}\n`).join("");
  }

  private listLicenses(): readonly Record<string, unknown>[] {
    return [
      { from: path.join(this.root, PackageConfiguration.LICENSE_FILE), to: `${PackageConfiguration.LICENSES_FOLDER}/${PackageConfiguration.LICENSE_FILE}` },
      { from: path.join(this.root, PackageConfiguration.FONTS_FOLDER), to: PackageConfiguration.LICENSES_FOLDER, filter: PackageConfiguration.FONT_LICENSE_FILTER },
      { from: path.join(this.root, PackageConfiguration.DICTIONARIES_FOLDER), to: PackageConfiguration.LICENSES_FOLDER, filter: PackageConfiguration.FONT_LICENSE_FILTER },
      { from: path.join(this.stage, ...PackageConfiguration.WINDOW_LICENSES_SEGMENTS), to: `${PackageConfiguration.LICENSES_FOLDER}/${PackageConfiguration.WINDOW_LICENSES_FILE}` }
    ];
  }
}
