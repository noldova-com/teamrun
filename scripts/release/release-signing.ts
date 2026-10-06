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

  private static readonly SETTING: string = "signedPlatforms";

  private readonly platforms: readonly string[];

  private constructor(platforms: readonly string[]) {
    this.platforms = platforms;
  }

  public static async readAsync(root: string): Promise<ReleaseSigning> {
    const value = await ReleaseSettings.readAsync(root, ReleaseSigning.SETTING, ReleaseSigning.formatInvalid());
    if (!Array.isArray(value) || new Set(value).size !== value.length || !value.every(t => ReleaseSigning.SIGNABLE_PLATFORMS.includes(t)))
      throw new ReleaseException(ReleaseSigning.formatInvalid());
    return new ReleaseSigning(ReleaseSigning.SIGNABLE_PLATFORMS.filter(t => value.includes(t)));
  }

  public listSignedPlatforms(product: ProductIdentity, repository: string): readonly string[] {
    if (!product.isReleaseRepository(repository))
      return [];
    const unsigned = ReleaseSigning.SIGNABLE_PLATFORMS.filter(t => !this.platforms.includes(t));
    if (unsigned.length > 0)
      throw new ReleaseException(`${repository} is ${product.name}'s update feed, which gets only signed ${ReleaseSigning.SIGNABLE_PLATFORMS.join(" and ")} packages, `
        + `but teamrun.${ReleaseSigning.SETTING} leaves out ${unsigned.join(" and ")}.`);
    return this.platforms;
  }

  private static formatInvalid(): string {
    return `The root ${ReleaseSettings.FILE_NAME}'s teamrun.${ReleaseSigning.SETTING} must list distinct platforms among ${ReleaseSigning.SIGNABLE_PLATFORMS.join(", ")}.`;
  }
}
