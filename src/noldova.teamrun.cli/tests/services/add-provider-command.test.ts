/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { ProviderCreateParams } from "@noldova/teamrun.protocol";

import { RecordingCliContext } from "../fixtures/recording-cli-context.fixture.js";
import { SampleData } from "../fixtures/sample-data.fixture.js";

@TestClass
export class AddProviderCommandTests {
  @TestMethod
  public async addsAProviderWithoutNamingItsProfileFolder(): Promise<void> {
    const context = await RecordingCliContext.activateAsync();
    context.answer("teamrun.providerCreate", () => SampleData.provider.toJson());

    const result = await context.runAsync("teamrun.addProvider", { kind: "codex", label: "Work" });

    Assert.areEqual("Added provider a1: Work (codex)", result.text);
    Assert.areEqual(JSON.stringify(SampleData.provider.toJson()), JSON.stringify(result.value));
    const params = ProviderCreateParams.fromJson(context.payloadsOf("teamrun.providerCreate")[0]);
    Assert.areEqual("codex|Work|null", [params.kind, params.label, String(params.profileDir)].join("|"));
  }
}
