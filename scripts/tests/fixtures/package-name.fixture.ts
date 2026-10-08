/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import ModuleCatalog from "../../modules/module-catalog.ts";
import PackageManifest from "../../packages/package-manifest.ts";

export default class PackageNameFixture {
  private static readonly FIXTURE_ID_PREFIX: string = "fixture-";

  public static forId(id: string): string {
    return id.startsWith(PackageNameFixture.FIXTURE_ID_PREFIX)
      ? PackageManifest.formatName(`${ModuleCatalog.FIXTURE_FOLDER}/${id.slice(PackageNameFixture.FIXTURE_ID_PREFIX.length)}`)
      : PackageManifest.formatName(`src/${id.replace("-", "/")}`);
  }
}
