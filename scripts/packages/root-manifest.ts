/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";

import { PackageException } from "./package.exception.ts";

export class RootManifest {
  private static readonly FILE_NAME: string = "package.json";
  private static readonly VERSION_PATTERN: RegExp = /^\d+\.\d+\.\d+(-(0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(\.(0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*)?$/;
  private static readonly SECTION: string = "teamrun";
  private static readonly PROTOCOL_FIELD: string = "protocolVersion";
  private static readonly PROTOCOL_PATTERN: RegExp = /^[0-9]+\.[0-9]+$/;
  private static readonly INVALID_PROTOCOL: string = "The root package.json's teamrun.protocolVersion must be two whole numbers separated by a dot, such as 0.1; the build stamps it into the protocol package.";
  private static readonly INVALID: string = "The root package.json must declare a version of the form major.minor.patch, with an optional prerelease such as -rc.1.";

  public readonly productVersion: string;
  public readonly protocolVersion: string;

  public constructor(productVersion: string, protocolVersion: string) {
    if (!RootManifest.VERSION_PATTERN.test(productVersion))
      throw new PackageException(RootManifest.INVALID);
    if (!RootManifest.PROTOCOL_PATTERN.test(protocolVersion))
      throw new PackageException(RootManifest.INVALID_PROTOCOL);

    this.productVersion = productVersion;
    this.protocolVersion = protocolVersion;
  }

  public static async readAsync(root: string): Promise<RootManifest> {
    let text: string;
    try {
      text = await readFile(path.join(root, RootManifest.FILE_NAME), "utf8");
    }
    catch (error) {
      throw new PackageException(RootManifest.INVALID, { cause: error });
    }
    return RootManifest.parse(text);
  }

  public static parse(text: string): RootManifest {
    let manifest: unknown;
    try {
      manifest = JSON.parse(text);
    }
    catch (error) {
      throw new PackageException(RootManifest.INVALID, { cause: error });
    }
    if (!RootManifest.isRecord(manifest) || typeof manifest["version"] !== "string")
      throw new PackageException(RootManifest.INVALID);
    const section = manifest[RootManifest.SECTION];
    const protocolVersion = RootManifest.isRecord(section) ? section[RootManifest.PROTOCOL_FIELD] : undefined;
    if (typeof protocolVersion !== "string")
      throw new PackageException(RootManifest.INVALID_PROTOCOL);
    return new RootManifest(manifest["version"], protocolVersion);
  }

  private static isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }
}
