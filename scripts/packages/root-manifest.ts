/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";

import PackageException from "./package.exception.ts";

export default class RootManifest {
  private static readonly FILE_NAME: string = "package.json";
  private static readonly VERSION_PATTERN: RegExp = /^\d+\.\d+\.\d+$/;
  private static readonly INVALID: string = "The root package.json must declare a numbered version and a positive whole teamrun.protocolVersion.";

  public readonly productVersion: string;
  public readonly protocolVersion: number;

  public constructor(productVersion: string, protocolVersion: number) {
    if (!RootManifest.VERSION_PATTERN.test(productVersion) || !Number.isSafeInteger(protocolVersion) || protocolVersion < 1)
      throw new PackageException(RootManifest.INVALID);

    this.productVersion = productVersion;
    this.protocolVersion = protocolVersion;
  }

  public static async readAsync(root: string): Promise<RootManifest> {
    let manifest: unknown;
    try {
      manifest = JSON.parse(await readFile(path.join(root, RootManifest.FILE_NAME), "utf8"));
    }
    catch (error) {
      throw new PackageException(RootManifest.INVALID, { cause: error });
    }
    if (typeof manifest !== "object" || manifest === null || !("version" in manifest) || !("teamrun" in manifest))
      throw new PackageException(RootManifest.INVALID);
    const settings = manifest.teamrun;
    if (typeof manifest.version !== "string" || typeof settings !== "object" || settings === null || !("protocolVersion" in settings))
      throw new PackageException(RootManifest.INVALID);
    if (typeof settings.protocolVersion !== "number")
      throw new PackageException(RootManifest.INVALID);
    return new RootManifest(manifest.version, settings.protocolVersion);
  }
}
