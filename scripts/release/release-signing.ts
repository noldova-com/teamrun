/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type ProductIdentity from "../packages/product-identity.ts";
import PackageTarget from "../packaging/package-target.ts";
import ReleaseException from "./release.exception.ts";
import ReleaseSettings from "./release-settings.ts";

export default class ReleaseSigning {
  public static readonly SIGNABLE_PLATFORMS: readonly string[] = [PackageTarget.WINDOWS, PackageTarget.MACOS];

  private readonly platforms: readonly string[];

  private constructor(platforms: readonly string[]) {
    this.platforms = platforms;
  }

  public static async readAsync(root: string): Promise<ReleaseSigning> {
    const settings = await ReleaseSettings.readAsync(root, ReleaseSigning.formatInvalid());
    const value: unknown = "signedPlatforms" in settings ? settings.signedPlatforms : [];
    if (!Array.isArray(value))
      throw new ReleaseException(ReleaseSigning.formatInvalid());
    const platforms: readonly unknown[] = value;
    if (new Set(platforms).size !== platforms.length || !platforms.every(t => typeof t === "string" && ReleaseSigning.SIGNABLE_PLATFORMS.includes(t)))
      throw new ReleaseException(ReleaseSigning.formatInvalid());
    return new ReleaseSigning(ReleaseSigning.SIGNABLE_PLATFORMS.filter(t => platforms.includes(t)));
  }

  public listSignedPlatforms(product: ProductIdentity, repository: string): readonly string[] {
    if (!product.isReleaseRepository(repository))
      return [];
    const unsigned = ReleaseSigning.SIGNABLE_PLATFORMS.filter(t => !this.platforms.includes(t));
    if (unsigned.length > 0)
      throw new ReleaseException(`${repository} is ${product.name}'s update feed, which gets only signed ${ReleaseSigning.SIGNABLE_PLATFORMS.join(" and ")} packages, `
        + `but teamrun.signedPlatforms leaves out ${unsigned.join(" and ")}.`);
    return this.platforms;
  }

  private static formatInvalid(): string {
    return `The root ${ReleaseSettings.FILE_NAME}'s teamrun.signedPlatforms must list distinct platforms among ${ReleaseSigning.SIGNABLE_PLATFORMS.join(", ")}.`;
  }
}
