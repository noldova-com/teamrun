/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import PackagingException from "./packaging.exception.ts";

export default class PackageTarget {
  public static readonly WINDOWS: string = "windows";
  public static readonly MACOS: string = "macos";
  public static readonly LINUX: string = "linux";
  public static readonly INSTALLER: string = "exe";
  public static readonly DISK_IMAGE: string = "dmg";
  public static readonly APP_IMAGE: string = "AppImage";
  private static readonly ARCHIVE: string = "zip";
  private static readonly PLATFORMS: ReadonlyMap<string, string> = new Map([["win32", PackageTarget.WINDOWS], ["darwin", PackageTarget.MACOS], ["linux", PackageTarget.LINUX]]);
  private static readonly ARCHITECTURES: readonly string[] = ["x64", "arm64"];
  private static readonly FORMATS: ReadonlyMap<string, ReadonlyMap<string, string>> = new Map([
    [PackageTarget.WINDOWS, new Map([["nsis", PackageTarget.INSTALLER]])],
    [PackageTarget.MACOS, new Map([["dmg", PackageTarget.DISK_IMAGE], ["zip", PackageTarget.ARCHIVE]])],
    [PackageTarget.LINUX, new Map([["AppImage", PackageTarget.APP_IMAGE]])]
  ]);
  private static readonly UPDATE_EXTENSIONS: ReadonlyMap<string, string> = new Map([
    [PackageTarget.WINDOWS, PackageTarget.INSTALLER], [PackageTarget.MACOS, PackageTarget.ARCHIVE], [PackageTarget.LINUX, PackageTarget.APP_IMAGE]
  ]);

  public readonly platform: string;
  public readonly architecture: string;
  public readonly formats: readonly string[];
  public readonly extensions: readonly string[];
  public readonly updateExtension: string;

  public constructor(platform: string, architecture: string) {
    const formats = PackageTarget.FORMATS.get(platform);
    const updateExtension = PackageTarget.UPDATE_EXTENSIONS.get(platform);
    if (formats === undefined || updateExtension === undefined || !PackageTarget.ARCHITECTURES.includes(architecture))
      throw new PackagingException(`Packages are made for windows, macos and linux on x64 and arm64, not for ${platform} on ${architecture}.`);

    this.platform = platform;
    this.architecture = architecture;
    this.formats = [...formats.keys()];
    this.extensions = [...formats.values()];
    this.updateExtension = updateExtension;
  }

  public static fromProcess(platform: string, architecture: string): PackageTarget {
    return new PackageTarget(PackageTarget.PLATFORMS.get(platform) ?? platform, architecture);
  }

  public static listAll(): readonly PackageTarget[] {
    return [...PackageTarget.FORMATS.keys()].flatMap(t => PackageTarget.ARCHITECTURES.map(architecture => new PackageTarget(t, architecture)));
  }

  public formatFileName(productName: string, extension: string): string {
    return `${productName}-${this.platform}-${this.architecture}.${extension}`;
  }

  public listFileNames(productName: string): readonly string[] {
    return this.extensions.map(t => this.formatFileName(productName, t));
  }
}
