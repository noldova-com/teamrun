/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { JsonReader } from "@noldova/teamrun-foundation-json";

import { Resources } from "../../resources";

export class BuildInfo {
  public readonly productVersion: string;
  public readonly fingerprint: string;

  public constructor(productVersion: string, fingerprint: string) {
    this.productVersion = productVersion;
    this.fingerprint = fingerprint;
  }

  public static fromJson(value: unknown): BuildInfo {
    const json = JsonReader.fromValue(value);
    return new BuildInfo(json.readString(Resources.productVersionField), json.readString(Resources.fingerprintField));
  }
}
