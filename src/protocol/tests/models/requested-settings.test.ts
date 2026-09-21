/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import { JsonException } from "@noldova/teamrun-foundation-json";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { RequestedSettings } from "@noldova/teamrun-protocol";

@TestClass
export class RequestedSettingsTests {
  @TestMethod
  public holdsTheRequestedValues(): void {
    const settings = new RequestedSettings("codex", null, "high");

    Assert.areEqual("codex", settings.provider);
    Assert.isNull(settings.model);
    Assert.areEqual("high", settings.effort);
  }

  @TestMethod
  public rejectsABlankProvider(): void {
    Assert.throws(() => new RequestedSettings(" ", null, null), ArgumentException);
  }

  @TestMethod
  public roundTripsThroughJson(): void {
    const json = { provider: "claude", model: "claude-opus-5", effort: null };
    const settings = RequestedSettings.fromJson(json);

    Assert.areEqual("claude-opus-5", settings.model);
    Assert.isNull(settings.effort);
    Assert.areEqual(JSON.stringify(json), JSON.stringify(settings.toJson()));
  }

  @TestMethod
  public reportsMissingFieldsWithTheirPath(): void {
    const missingModel = Assert.throws(() => RequestedSettings.fromJson({ provider: "codex", effort: null }, "$.turn.requested"), JsonException);

    Assert.areEqual("$.turn.requested.model", missingModel.path);
  }
}
