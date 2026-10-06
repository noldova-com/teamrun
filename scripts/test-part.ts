/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export default class TestPart {
  public static readonly PACKAGES: string = "packages";
  public static readonly SCRIPTS: string = "scripts";
  public static readonly ANGULAR_AND_CHECKS: string = "angular-and-checks";
  public static readonly ALL: readonly string[] = [TestPart.PACKAGES, TestPart.SCRIPTS, TestPart.ANGULAR_AND_CHECKS];
}
