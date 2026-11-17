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
import { ProviderUpdateParams } from "@noldova/teamrun.protocol";

@TestClass
export class ProviderUpdateParamsTests {
  private static readonly json: object = { providerId: "a1", label: "Personal", profileDir: "/profiles/personal" };

  @TestMethod
  public roundTripsThroughJson(): void {
    const value = ProviderUpdateParams.fromJson(ProviderUpdateParamsTests.json);

    Assert.areEqual(JSON.stringify(ProviderUpdateParamsTests.json), JSON.stringify(value.toJson()));
  }

  @TestMethod
  public switchesTheProvidersOwnMcpServersOnlyWhenItSaysSo(): void {
    const switched = ProviderUpdateParams.fromJson({ ...ProviderUpdateParamsTests.json, ownMcpServers: false });

    Assert.isNull(ProviderUpdateParams.fromJson(ProviderUpdateParamsTests.json).ownMcpServers);
    Assert.areEqual(false, switched.ownMcpServers);
    Assert.areEqual(JSON.stringify({ ...ProviderUpdateParamsTests.json, ownMcpServers: false }), JSON.stringify(switched.toJson()));
    Assert.areEqual(true, new ProviderUpdateParams("a1", "Work", "/p", true).ownMcpServers);
    Assert.areEqual("$.ownMcpServers",
      Assert.throws(() => ProviderUpdateParams.fromJson({ ...ProviderUpdateParamsTests.json, ownMcpServers: null }), JsonException).path);
  }

  @TestMethod
  public changesTheChosenServerOnlyWhenItSaysSo(): void {
    const chosen = ProviderUpdateParams.fromJson({ ...ProviderUpdateParamsTests.json, binaryPath: "/opt/agy/agy_acp_server" });
    const cleared = ProviderUpdateParams.fromJson({ ...ProviderUpdateParamsTests.json, binaryPath: String.empty });

    Assert.isNull(ProviderUpdateParams.fromJson(ProviderUpdateParamsTests.json).binaryPath);
    Assert.areEqual("/opt/agy/agy_acp_server", chosen.binaryPath);
    Assert.areEqual(JSON.stringify({ ...ProviderUpdateParamsTests.json, binaryPath: "/opt/agy/agy_acp_server" }), JSON.stringify(chosen.toJson()));
    Assert.areEqual(String.empty, cleared.binaryPath);
    Assert.areEqual(JSON.stringify({ ...ProviderUpdateParamsTests.json, binaryPath: String.empty }), JSON.stringify(cleared.toJson()));
    Assert.areEqual("/p/agy", new ProviderUpdateParams("a1", "Work", "/p", null, "/p/agy").binaryPath);
    Assert.areEqual("$.binaryPath",
      Assert.throws(() => ProviderUpdateParams.fromJson({ ...ProviderUpdateParamsTests.json, binaryPath: null }), JsonException).path);
  }

  @TestMethod
  public rejectsInvalidArguments(): void {
    const valid = ProviderUpdateParams.fromJson(ProviderUpdateParamsTests.json);

    Assert.throws(() => new ProviderUpdateParams(String.empty, valid.label, valid.profileDir), ArgumentException);
    Assert.throws(() => new ProviderUpdateParams(valid.providerId, " ", valid.profileDir), ArgumentException);
    Assert.throws(() => new ProviderUpdateParams(valid.providerId, valid.label, String.empty), ArgumentException);
  }

  @TestMethod
  public rejectsInvalidValuesWithTheirPath(): void {
    const exception = Assert.throws(() => ProviderUpdateParams.fromJson({ ...ProviderUpdateParamsTests.json, profileDir: 1 }), JsonException);

    Assert.areEqual("$.profileDir", exception.path);
  }
}
