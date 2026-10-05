/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import PackagingException from "./packaging.exception.ts";

export default class PackageTarget {
  private static readonly PLATFORMS: ReadonlyMap<string, string> = new Map([["win32", "windows"], ["darwin", "macos"], ["linux", "linux"]]);
  private static readonly ARCHITECTURES: readonly string[] = ["x64", "arm64"];
  private static readonly FORMATS: ReadonlyMap<string, ReadonlyMap<string, string>> = new Map([
    ["windows", new Map([["nsis", "exe"]])],
    ["macos", new Map([["dmg", "dmg"], ["zip", "zip"]])],
    ["linux", new Map([["AppImage", "AppImage"]])]
  ]);
  private static readonly UPDATE_EXTENSIONS: ReadonlyMap<string, string> = new Map([["windows", "exe"], ["macos", "zip"], ["linux", "AppImage"]]);

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
