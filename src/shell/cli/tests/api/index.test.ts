/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import * as api from "@noldova/teamrun-shell-cli";

@TestClass
export class CliApiTests {
  @TestMethod
  public exportsTheCompleteCatalog(): void {
    Assert.areEqual("Cli,CliContext,CliEntry,DesktopOpener,ExitCode", Object.keys(api).sort().join(","));
  }
}
