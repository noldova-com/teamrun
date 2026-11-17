/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ArgumentException } from "@noldova/context.exceptions";
import { JsonException } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { OwnMcpServer, OwnMcpServerState } from "@noldova/teamrun.protocol";

@TestClass
export class OwnMcpServerTests {
  @TestMethod
  public roundTripsEachStateThroughJson(): void {
    for (const state of Object.values(OwnMcpServerState)) {
      const server = OwnMcpServer.fromJson({ name: "docs", state });

      Assert.areEqual("docs", server.name);
      Assert.areEqual(state, server.state);
      Assert.areEqual(JSON.stringify({ name: "docs", state }), JSON.stringify(server.toJson()));
    }
  }

  @TestMethod
  public rejectsABlankNameAndAStateItDoesNotKnow(): void {
    Assert.throws(() => new OwnMcpServer(" ", OwnMcpServerState.Configured), ArgumentException);
    Assert.areEqual("$.name", Assert.throws(() => OwnMcpServer.fromJson({ name: " ", state: "Configured" }), JsonException).path);
    Assert.areEqual("$.state", Assert.throws(() => OwnMcpServer.fromJson({ name: "docs", state: "Connected" }), JsonException).path);
  }
}
