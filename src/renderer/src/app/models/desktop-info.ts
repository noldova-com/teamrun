/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";

import { Resources } from "../resources";

export class DesktopInfo {
  public readonly dataDirectory: string;
  public readonly productVersion: string;
  public readonly platform: string;

  public constructor(dataDirectory: string, productVersion: string, platform: string) {
    this.dataDirectory = dataDirectory;
    this.productVersion = productVersion;
    this.platform = platform;
  }

  public static fromJson(value: unknown): DesktopInfo | null {
    if (!Object.isObject(value) || Array.isArray(value))
      return null;
    const record: Record<string, unknown> = { ...value };
    const dataDirectory = record[Resources.dataDirectoryField];
    const productVersion = record[Resources.productVersionField];
    const platform = record[Resources.platformField];
    if (!Object.isString(dataDirectory) || !Object.isString(productVersion) || !Object.isString(platform))
      return null;

    return new DesktopInfo(dataDirectory, productVersion, platform);
  }
}
