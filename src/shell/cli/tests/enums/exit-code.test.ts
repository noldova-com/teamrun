/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { ExitCode } from "@noldova/teamrun-shell-cli";

@TestClass
export class ExitCodeTests {
  @TestMethod
  public keepsTheDocumentedNumbers(): void {
    Assert.areEqual(
      "0,1,2,3,4,5,6,7,8,9",
      [
        ExitCode.Success, ExitCode.Failed, ExitCode.Usage, ExitCode.NoRuntime, ExitCode.BuildMismatch, ExitCode.DataDirectoryUnusable, ExitCode.Stopped, ExitCode.ModuleNotActive,
        ExitCode.Updating, ExitCode.PartNotStopped
      ].join(","));
  }
}
