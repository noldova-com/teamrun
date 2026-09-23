/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import PackageOptions from "../../../packaging/package-options.ts";

export default class PackageOptionsFixture extends PackageOptions {
  public static host: NodeJS.Platform = "win32";
  public static current: PackageOptions | null = null;

  public constructor(args: readonly string[]) {
    super(args, PackageOptionsFixture.host, "x64");

    PackageOptionsFixture.current = this;
  }
}
