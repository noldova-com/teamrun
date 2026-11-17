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

@TestClass
export class RemoveProviderCommandTests {
  @TestMethod
  public async removesAProviderAndNamesIt(): Promise<void> {
    const context = await RecordingCliContext.activateAsync();
    context.answer("teamrun.providerDelete", () => null);

    const result = await context.runAsync("teamrun.removeProvider", { providerId: "a1" });

    Assert.areEqual("Removed provider a1.", result.text);
    Assert.isNull(result.value);
    Assert.areEqual("a1", ProviderIdParams.fromJson(context.payloadsOf("teamrun.providerDelete")[0]).providerId);
  }
}
