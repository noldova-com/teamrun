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
import { OwnMcpServer, OwnMcpServerState, ProviderMcpServerList } from "@noldova/teamrun.protocol";

@TestClass
export class ProviderMcpServerListTests {
  private static readonly json: object = { providerId: "a1", servers: [{ name: "docs", state: "Enabled" }, { name: "github", state: "Disabled" }] };

  @TestMethod
  public roundTripsThroughJson(): void {
    const list = ProviderMcpServerList.fromJson(ProviderMcpServerListTests.json);

    Assert.areEqual("a1", list.providerId);
    Assert.areEqual(OwnMcpServerState.Disabled, list.servers![1]!.state);
    Assert.areEqual(JSON.stringify(ProviderMcpServerListTests.json), JSON.stringify(list.toJson()));
  }

  @TestMethod
  public roundTripsAProviderThatOffersNoList(): void {
    const list = ProviderMcpServerList.fromJson({ providerId: "a1", servers: null });

    Assert.isNull(list.servers);
    Assert.areEqual(JSON.stringify({ providerId: "a1", servers: null }), JSON.stringify(list.toJson()));
  }

  @TestMethod
  public keepsItsOwnCopyOfTheServers(): void {
    const servers = [new OwnMcpServer("docs", OwnMcpServerState.Configured)];
    const list = new ProviderMcpServerList("a1", servers);
    servers.push(new OwnMcpServer("github", OwnMcpServerState.Configured));

    Assert.areEqual(1, list.servers!.length);
  }

  @TestMethod
  public rejectsABlankIdAndServersThatAreNotAListOrNull(): void {
    Assert.throws(() => new ProviderMcpServerList(" ", []), ArgumentException);
    Assert.areEqual("$.servers", Assert.throws(() => ProviderMcpServerList.fromJson({ providerId: "a1", servers: "docs" }), JsonException).path);
    Assert.areEqual("$.servers", Assert.throws(() => ProviderMcpServerList.fromJson({ providerId: "a1" }), JsonException).path);
    Assert.areEqual("$.servers.0.state",
      Assert.throws(() => ProviderMcpServerList.fromJson({ providerId: "a1", servers: [{ name: "docs", state: "Connected" }] }), JsonException).path);
  }
}
