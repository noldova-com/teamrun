/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type PackageDigest from "./package-digest.ts";

export default class ReleaseFile {
  public readonly name: string;
  public readonly digest: PackageDigest;

  public constructor(name: string, digest: PackageDigest) {
    this.name = name;
    this.digest = digest;
  }
}
