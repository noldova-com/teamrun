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
    Assert.areEqual("Cli,CliCommandException,CliCommandResult,CliContext,CliEntry,DesktopOpener,ExitCode,UsageException", Object.keys(api).sort().join(","));
  }
}
