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
import { ProviderKindInstallation, ProviderKindInstallState } from "@noldova/teamrun.protocol";

@TestClass
export class ProviderKindInstallationTests {
  private static readonly json: object = { kind: "claude", state: "Installing", reason: null, received: 420, total: 1000, version: "2.1.211", update: null, cancellable: false,
    missingTool: null, foundPath: null, notice: null };

  @TestMethod
  public roundTripsThroughJson(): void {
    const value = ProviderKindInstallation.fromJson(ProviderKindInstallationTests.json);

    Assert.areEqual(ProviderKindInstallState.Installing, value.state);
    Assert.isFalse(value.cancellable);
    Assert.areEqual(JSON.stringify(ProviderKindInstallationTests.json), JSON.stringify(value.toJson()));
  }

  @TestMethod
  public carriesTheInstalledVersionAndTheUpdateWithTheReasonTheLastUpdateFailed(): void {
    const json = { kind: "claude", state: "Installed", reason: "The download failed.", received: 0, total: 0, version: "2.1.211", update: "2.1.212", cancellable: true,
      missingTool: null, foundPath: null, notice: null };
    const value = ProviderKindInstallation.fromJson(json);

    Assert.areEqual("2.1.211", value.version);
    Assert.areEqual("2.1.212", value.update);
    Assert.areEqual("The download failed.", value.reason);
    Assert.areEqual(JSON.stringify(json), JSON.stringify(value.toJson()));
  }

  @TestMethod
  public carriesTheToolAnUnavailableInstallLacks(): void {
    const json = { kind: "antigravity", state: "Unavailable", reason: "Installing Antigravity needs unzip, which this computer does not have.", received: 0, total: 0,
      version: null, update: null, cancellable: true, missingTool: "unzip", foundPath: null, notice: null };
    const value = ProviderKindInstallation.fromJson(json);

    Assert.areEqual("unzip", value.missingTool);
    Assert.areEqual(JSON.stringify(json), JSON.stringify(value.toJson()));
    Assert.areEqual("unzip", new ProviderKindInstallation("antigravity", ProviderKindInstallState.Unavailable, json.reason, 0, 0, null, null, true, "unzip").missingTool);
  }

  @TestMethod
  public readsAnInstallationWithoutTheMissingToolFoundPathOrNoticeKeyAsNamingNone(): void {
    const { missingTool: _missingTool, foundPath: _foundPath, notice: _notice, ...older } = new ProviderKindInstallation("claude", ProviderKindInstallState.NotInstalled).toJson();
    const value = ProviderKindInstallation.fromJson(older);

    Assert.isNull(value.missingTool);
    Assert.isNull(value.foundPath);
    Assert.isNull(value.notice);
    Assert.areEqual(JSON.stringify({ ...older, missingTool: null, foundPath: null, notice: null }), JSON.stringify(value.toJson()));
  }

  @TestMethod
  public carriesTheNoticeAboutHowTeamRunRunsTheKind(): void {
    const json = { kind: "codex", state: "Installed", reason: null, received: 0, total: 0, version: "0.171.0", update: null, cancellable: true, missingTool: null,
      foundPath: null, notice: "TeamRun's Codex chats show in the Codex app's recent chats." };
    const value = ProviderKindInstallation.fromJson(json);

    Assert.areEqual(json.notice, value.notice);
    Assert.areEqual(JSON.stringify(json), JSON.stringify(value.toJson()));
    Assert.areEqual("shown", new ProviderKindInstallation("codex", ProviderKindInstallState.Installed, null, 0, 0, "0.171.0", null, true, null, null, "shown").notice);
  }

  @TestMethod
  public carriesThePathOfACopyFoundOutsideTeamRunsOwnInstall(): void {
    const json = { kind: "codex", state: "Installed", reason: null, received: 0, total: 0, version: "0.166.0", update: null, cancellable: true, missingTool: null,
      foundPath: "/opt/homebrew/bin/codex", notice: null };
    const value = ProviderKindInstallation.fromJson(json);

    Assert.areEqual("/opt/homebrew/bin/codex", value.foundPath);
    Assert.areEqual(JSON.stringify(json), JSON.stringify(value.toJson()));
    Assert.areEqual("/bin/codex", new ProviderKindInstallation("codex", ProviderKindInstallState.Installed, null, 0, 0, "0.166.0", null, true, null, "/bin/codex").foundPath);
  }

  @TestMethod
  public startsWithNoReasonNothingReceivedNoVersionsAndCancellable(): void {
    const value = new ProviderKindInstallation("antigravity", ProviderKindInstallState.NotInstalled);

    Assert.areEqual("{\"kind\":\"antigravity\",\"state\":\"NotInstalled\",\"reason\":null,\"received\":0,\"total\":0,\"version\":null,\"update\":null,\"cancellable\":true,\"missingTool\":null,\"foundPath\":null,\"notice\":null}",
      JSON.stringify(value.toJson()));
    Assert.throws(() => new ProviderKindInstallation(" ", ProviderKindInstallState.Installed), ArgumentException);
  }

  @TestMethod
  public rejectsInvalidValuesWithTheirPath(): void {
    for (const [field, value] of [["kind", ""], ["state", "Broken"], ["reason", 1], ["received", "1"], ["total", null], ["version", 2], ["update", false], ["cancellable", "no"],
      ["missingTool", 3], ["foundPath", 4]] as const) {
      const exception = Assert.throws(() => ProviderKindInstallation.fromJson({ ...ProviderKindInstallationTests.json, [field]: value }, "$.payload"), JsonException);
      Assert.areEqual(`$.payload.${field}`, exception.path, field);
    }
  }
}
