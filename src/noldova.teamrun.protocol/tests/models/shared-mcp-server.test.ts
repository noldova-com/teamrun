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
  SharedMcpSecret, SharedMcpServer, SharedMcpServerDefinition, SharedMcpSetting, SharedMcpSignIn, SharedMcpTeammateSetting, SharedMcpTransport
} from "@noldova/teamrun.protocol";

@TestClass
export class SharedMcpServerTests {
  private static readonly reference = "teamrun.mcpSecret0123456789abcdef0123456789abcdef";
  private static readonly definition = new SharedMcpServerDefinition("search", SharedMcpTransport.Stdio, "npx", [], [], null, [], null);

  @TestMethod
  public keepsItsDefinitionAndSwitches(): void {
    const json = {
      id: "s1", definition: SharedMcpServerTests.definition.toJson(), providerIds: ["p1"], teammates: [{ teammateId: "t1", setting: "Off" }],
      createdAt: "2026-10-24T09:00:00.000Z", updatedAt: "2026-10-24T09:05:00.000Z", secrets: [], signIn: null
    };

    Assert.areEqual(JSON.stringify(json), JSON.stringify(SharedMcpServer.fromJson(json).toJson()));
    Assert.areEqual("$.s.definition.name", Assert.throws(() => SharedMcpServer.fromJson({ ...json, definition: { ...json.definition, name: 1 } }, "$.s"),
      JsonException).path);
    Assert.areEqual("$.s.teammates.0.setting", Assert.throws(() => SharedMcpServer.fromJson(
      { ...json, teammates: [{ teammateId: "t1", setting: "Sometimes" }] }, "$.s"), JsonException).path);
  }

  @TestMethod
  public keepsEachSavedSecretByItsReferenceAndReadsARowWithoutThemAsNone(): void {
    const definition = new SharedMcpServerDefinition("search", SharedMcpTransport.Stdio, "npx", [], ["GITHUB_TOKEN", "SEARCH_KEY"], null, [], null);
    const secret = new SharedMcpSecret("GITHUB_TOKEN", SharedMcpServerTests.reference);
    const server = new SharedMcpServer("s1", definition, [], [], "a", "b", [secret]);
    const older = { id: "s1", definition: definition.toJson(), providerIds: [], teammates: [], createdAt: "a", updatedAt: "b" };

    Assert.areEqual(JSON.stringify([{ variable: "GITHUB_TOKEN", reference: SharedMcpServerTests.reference, updatedAt: null }]), JSON.stringify(server.toJson()["secrets"]));
    Assert.areEqual(JSON.stringify(server.toJson()), JSON.stringify(SharedMcpServer.fromJson(server.toJson()).toJson()));
    Assert.areEqual(SharedMcpServerTests.reference, server.referenceOf("GITHUB_TOKEN"));
    Assert.isNull(server.referenceOf("SEARCH_KEY"));
    Assert.areEqual(0, SharedMcpServer.fromJson(older).secrets.length);
  }

  @TestMethod
  public keepsTheSignInOfAServerThatSignsInAndReadsARowWithoutOneAsNone(): void {
    const definition = new SharedMcpServerDefinition("docs", SharedMcpTransport.Http, null, [], [], "https://docs.example.com/mcp", [], null, true);
    const signIn = new SharedMcpSignIn("teamrun.mcpSignIn0123456789abcdef0123456789abcdef", "2026-11-02T10:00:00.000Z", null, "2026-11-02T09:00:00.000Z");
    const server = new SharedMcpServer("s1", definition, [], [], "a", "b", [], signIn);
    const older = { id: "s1", definition: definition.toJson(), providerIds: [], teammates: [], createdAt: "a", updatedAt: "b" };

    Assert.areEqual(JSON.stringify(signIn.toJson()), JSON.stringify(server.toJson()["signIn"]));
    Assert.areEqual(JSON.stringify(server.toJson()), JSON.stringify(SharedMcpServer.fromJson(server.toJson()).toJson()));
    Assert.isNull(SharedMcpServer.fromJson(older).signIn);
    Assert.isNull(SharedMcpServer.fromJson({ ...older, signIn: null }).signIn);
    Assert.areEqual("signIn", Assert.throws(() => new SharedMcpServer("s1", SharedMcpServerTests.definition, [], [], "a", "b", [], signIn),
      ArgumentException).parameterName);
    Assert.areEqual("$.s.signIn.reference", Assert.throws(() => SharedMcpServer.fromJson({ ...older, signIn: { ...signIn.toJson(), reference: 1 } }, "$.s"),
      JsonException).path);
  }

  @TestMethod
  public refusesASecretSavedTwiceOrForAVariableItDoesntName(): void {
    const definition = new SharedMcpServerDefinition("search", SharedMcpTransport.Stdio, "npx", [], ["A", "B"], null, [], null);
    const other = "teamrun.mcpSecretfedcba9876543210fedcba9876543210";
    const serverWith = (secrets: SharedMcpSecret[]): SharedMcpServer => new SharedMcpServer("s1", definition, [], [], "a", "b", secrets);

    Assert.areEqual(2, serverWith([new SharedMcpSecret("A", SharedMcpServerTests.reference), new SharedMcpSecret("B", other)]).secrets.length);
    Assert.areEqual("secrets", Assert.throws(() => serverWith([new SharedMcpSecret("A", SharedMcpServerTests.reference), new SharedMcpSecret("A", other)]),
      ArgumentException).parameterName);
    Assert.areEqual("secrets", Assert.throws(() => serverWith([new SharedMcpSecret("A", SharedMcpServerTests.reference),
      new SharedMcpSecret("B", SharedMcpServerTests.reference)]), ArgumentException).parameterName);
    Assert.areEqual("secrets", Assert.throws(() => serverWith([new SharedMcpSecret("C", other)]), ArgumentException).parameterName);
  }

  @TestMethod
  public reachesATeammateThatIsOnOrFollowsAProviderItIsOnFor(): void {
    const server = SharedMcpServerTests.server(["p1"], [new SharedMcpTeammateSetting("on", SharedMcpSetting.On),
      new SharedMcpTeammateSetting("off", SharedMcpSetting.Off)]);

    Assert.isTrue(server.reaches("p1", "follows"));
    Assert.isFalse(server.reaches("p2", "follows"));
    Assert.isTrue(server.reaches("p2", "on"));
    Assert.isFalse(server.reaches("p1", "off"));
    Assert.isTrue(server.reaches("p1", null));
    Assert.isFalse(server.reaches("p2", null));
    Assert.areEqual(SharedMcpSetting.AsProvider, server.settingOf("follows"));
    Assert.areEqual(SharedMcpSetting.On, server.settingOf("on"));
    Assert.areEqual(SharedMcpSetting.AsProvider, server.settingOf(null));
  }

  @TestMethod
  public refusesBlankOrRepeatedProvidersAndTeammates(): void {
    Assert.throws(() => new SharedMcpServer(" ", SharedMcpServerTests.definition, [], [], "a", "b"), ArgumentException);
    Assert.areEqual("providerIds", Assert.throws(() => SharedMcpServerTests.server(["p1", "p1"], []), ArgumentException).parameterName);
    Assert.areEqual("providerIds", Assert.throws(() => SharedMcpServerTests.server([" "], []), ArgumentException).parameterName);
    Assert.areEqual("teammates", Assert.throws(() => SharedMcpServerTests.server([], [new SharedMcpTeammateSetting("t1", SharedMcpSetting.On),
      new SharedMcpTeammateSetting("t1", SharedMcpSetting.Off)]), ArgumentException).parameterName);
    Assert.throws(() => new SharedMcpServer("s1", SharedMcpServerTests.definition, [], [], " ", "b"), ArgumentException);
    Assert.throws(() => new SharedMcpServer("s1", SharedMcpServerTests.definition, [], [], "a", " "), ArgumentException);
  }

  private static server(providerIds: string[], teammates: SharedMcpTeammateSetting[]): SharedMcpServer {
    return new SharedMcpServer("s1", SharedMcpServerTests.definition, providerIds, teammates, "2026-10-24T09:00:00.000Z", "2026-10-24T09:00:00.000Z");
  }
}
