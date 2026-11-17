/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/context.exceptions";
import { JsonException } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import {
  SharedMcpServer, SharedMcpServerDefinition, SharedMcpServerListing, SharedMcpTransport, SharedMcpUnavailability, SharedMcpVariable, SharedMcpVariableSource
} from "@noldova/teamrun.protocol";

@TestClass
export class SharedMcpServerListingTests {
  private static readonly server = new SharedMcpServer("s1", new SharedMcpServerDefinition("search", SharedMcpTransport.Stdio, "npx", [], [], null, [], null),
    [], [], "2026-10-24T09:00:00.000Z", "2026-10-24T09:00:00.000Z");

  @TestMethod
  public listsAServerWithTheProvidersThatCantTakeItAndWhy(): void {
    const json = { server: SharedMcpServerListingTests.server.toJson(), unavailable: [{ providerId: "p1", reason: "Not yet confirmed.", short: "not confirmed yet" }],
      variables: [{ variable: "GITHUB_TOKEN", source: "Saved", set: false, updatedAt: null }], signingIn: true };
    const { variables: _variables, signingIn: _signingIn, ...older } = json;

    Assert.areEqual(JSON.stringify(json), JSON.stringify(SharedMcpServerListing.fromJson(json).toJson()));
    Assert.areEqual(JSON.stringify([0, false]), JSON.stringify([SharedMcpServerListing.fromJson(older).variables.length, SharedMcpServerListing.fromJson(older).signingIn]));
    Assert.areEqual("$.l.signingIn", Assert.throws(() => SharedMcpServerListing.fromJson({ ...json, signingIn: "yes" }, "$.l"), JsonException).path);
    Assert.areEqual("$.l.unavailable.0.providerId", Assert.throws(() => SharedMcpServerListing.fromJson(
      { ...json, unavailable: [{ reason: "Why." }] }, "$.l"), JsonException).path);
    Assert.areEqual("$.l.variables.0.source", Assert.throws(() => SharedMcpServerListing.fromJson(
      { ...json, variables: [{ variable: "GITHUB_TOKEN", source: "Keychain", set: true }] }, "$.l"), JsonException).path);
  }

  @TestMethod
  public namesEachProviderOnce(): void {
    const twice = [new SharedMcpUnavailability("p1", "One."), new SharedMcpUnavailability("p1", "Two.")];

    Assert.areEqual("unavailable", Assert.throws(() => new SharedMcpServerListing(SharedMcpServerListingTests.server, twice), ArgumentException).parameterName);
  }

  @TestMethod
  public namesEachVariableOnce(): void {
    const twice = [new SharedMcpVariable("A", SharedMcpVariableSource.Environment, true), new SharedMcpVariable("A", SharedMcpVariableSource.Saved, true)];

    Assert.areEqual("variables", Assert.throws(() => new SharedMcpServerListing(SharedMcpServerListingTests.server, [], twice), ArgumentException).parameterName);
  }
}
