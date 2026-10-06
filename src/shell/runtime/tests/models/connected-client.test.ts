/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { ConnectedClient } from "@noldova/teamrun-shell-runtime";

@TestClass
export class ConnectedClientTests {
  @TestMethod
  public carriesTheConnectionAndTheClient(): void {
    const client = new ConnectedClient(3, "cli");

    Assert.areEqual("3 cli", `${client.connection} ${client.client}`);
  }
}
