/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";

import { CliFixture } from "../fixtures/cli.fixture.js";

@TestClass
export class UsageExceptionTests {
  @TestMethod
  public async isReportedWithTheUsageExitCodeAndItsMessageBeforeTheUsageOrAloneAsJson(): Promise<void> {
    await using fixture = await CliFixture.createAsync();

    const help = await fixture.runAsync(["help"]);
    const text = await fixture.runAsync(["status", "--bogus"]);
    const json = await fixture.runAsync(["--json", "status", "--bogus"]);

    Assert.areEqual(2, text.code);
    Assert.areEqual(`"--bogus" is not an option.\n\n${help.output}`, text.error);
    Assert.areEqual("", text.output);
    Assert.areEqual(2, json.code);
    Assert.areEqual("{\"code\":\"Usage\",\"message\":\"\\\"--bogus\\\" is not an option.\"}\n", json.error);
    Assert.areEqual("", json.output);
  }
}
