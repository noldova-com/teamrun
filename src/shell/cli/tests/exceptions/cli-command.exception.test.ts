/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { CliCommandException } from "@noldova/teamrun-shell-cli";

import { CliFixture } from "../fixtures/cli.fixture.js";
import { ProbeBuildFixture } from "../fixtures/probe-build.fixture.js";

@TestClass
export class CliCommandExceptionTests {
  @TestMethod
  public async isReportedAsAFailureWithItsCodeMessageAndDetails(): Promise<void> {
    await using fixture = await CliFixture.createAsync();
    await using build = await ProbeBuildFixture.createAsync("1.0.0", true);
    await fixture.startHostAsync(build.declarationsFile);

    const text = await fixture.runModuleAsync(build, ["probe", "fail-with-code"]);
    const json = await fixture.runModuleAsync(build, ["probe", "fail-with-code", "--json"]);

    Assert.areEqual(1, text.code, text.error);
    Assert.areEqual("The probe's command broke.\n", text.error);
    Assert.areEqual("", text.output);
    Assert.areEqual(1, json.code, json.error);
    Assert.areEqual("{\"code\":\"ProbeBroke\",\"message\":\"The probe's command broke.\",\"details\":{\"why\":\"asked\"}}\n", json.error);
  }

  @TestMethod
  public async standsInForAnyOtherErrorACommandThrows(): Promise<void> {
    await using fixture = await CliFixture.createAsync();
    await using build = await ProbeBuildFixture.createAsync("1.0.0", true);
    await fixture.startHostAsync(build.declarationsFile);

    const text = await fixture.runModuleAsync(build, ["probe", "throw-plain"]);
    const json = await fixture.runModuleAsync(build, ["probe", "throw-plain", "--json"]);

    Assert.areEqual(1, text.code, text.error);
    Assert.areEqual("The command failed: The probe tripped.\n", text.error);
    Assert.areEqual(1, json.code, json.error);
    Assert.areEqual("{\"code\":\"Failed\",\"message\":\"The command failed: The probe tripped.\"}\n", json.error);
    Assert.areEqual("activate probe\ndeactivate probe\n".repeat(2), await build.readPartsLogAsync());
  }

  @TestMethod
  public needsACodeAndHasNoDetailsUnlessGiven(): void {
    const exception = new CliCommandException("NotesLocked", "The notes are locked.");

    Assert.areEqual("NotesLocked", exception.code);
    Assert.areEqual("The notes are locked.", exception.message);
    Assert.isNull(exception.details);
    Assert.throws(() => new CliCommandException(" ", "The notes are locked."), ArgumentException);
  }
}
