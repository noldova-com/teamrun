/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { ProviderIdParams } from "@noldova/teamrun.protocol";

import { RecordingCliContext } from "../fixtures/recording-cli-context.fixture.js";
import { SampleData } from "../fixtures/sample-data.fixture.js";

@TestClass
export class CheckProviderCommandTests {
  @TestMethod
  public async checksAProviderAndPrintsItsSignIn(): Promise<void> {
    const context = await RecordingCliContext.activateAsync();
    context.answer("teamrun.providerCheck", () => SampleData.provider.toJson());

    const result = await context.runAsync("teamrun.checkProvider", { providerId: "a1" });

    Assert.areEqual("a1  codex  Work  LoggedIn", result.text);
    Assert.areEqual("a1", ProviderIdParams.fromJson(context.payloadsOf("teamrun.providerCheck")[0]).providerId);
  }
}
