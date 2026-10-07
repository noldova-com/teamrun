/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { ShellClients } from "@noldova/teamrun-shell-protocol";

@TestClass
export class ShellClientsTests {
  @TestMethod
  public namesTheShellsOwnClients(): void {
    Assert.areEqual("desktop|cli", [ShellClients.desktop, ShellClients.commandLine].join("|"));
  }
}
