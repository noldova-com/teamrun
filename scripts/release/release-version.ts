/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import PackageException from "../packaging/package.exception.ts";

export default class ReleaseVersion {
  private static readonly PATTERN: RegExp = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
  private static readonly INVALID_VERSION: string = "Use a numbered version such as 0.0.1, without a suffix or build metadata.";

  private readonly parts: readonly bigint[];

  public readonly value: string;

  public constructor(value: string) {
    const match = ReleaseVersion.PATTERN.exec(value);
    if (!match)
      throw new PackageException(ReleaseVersion.INVALID_VERSION);

    this.value = value;
    this.parts = match.slice(1, 4).map(t => BigInt(t));
  }

  public compare(other: ReleaseVersion): number {
    for (let index = 0; index < this.parts.length; index++) {
      const first = this.parts[index];
      const second = other.parts[index];
      if (first !== undefined && second !== undefined && first !== second)
        return first > second ? 1 : -1;
    }
    return 0;
  }
}
