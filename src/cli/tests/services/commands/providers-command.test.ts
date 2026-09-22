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
export class ProvidersCommandTests {
  @TestMethod
  public async listsProvidersAsTextOrJson(): Promise<void> {
    await using host = await CliTestHost.create();

    const text = await host.run("providers");
    const textLine = host.console.lastLine;
    const json = await host.runJson("providers");

    Assert.areEqual(0, text);
    Assert.areEqual("fake  Fake provider  low, high", textLine);
    Assert.areEqual("[{\"id\":\"fake\",\"displayName\":\"Fake provider\",\"effortLevels\":[\"low\",\"high\"],\"supportsResume\":true,\"supportsSignInCheck\":true,\"supportsFork\":false}]", JSON.stringify(json));
  }
}
