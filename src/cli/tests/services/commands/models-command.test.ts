/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";

import { CliTestHost } from "../../fixtures/cli-test-host.fixture.js";

@TestClass
export class ModelsCommandTests {
  @TestMethod
  public async listsTheModelsOfAProvider(): Promise<void> {
    await using host = await CliTestHost.create();

    const code = await host.run("models", "fake");
    const line = host.console.lastLine;
    const unknown = await host.run("models", "nope");

    Assert.areEqual(0, code);
    Assert.areEqual("fake-model", line);
    Assert.areEqual(1, unknown);
  }
}
