/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";

import { CliTestHost } from "../fixtures/cli-test-host.fixture.js";

@TestClass
export class CliApplicationTests {
  @TestMethod
  public async mapsOutcomesToExitCodes(): Promise<void> {
    await using host = await CliTestHost.create();

    const help = await host.run();
    const helpLines = host.console.lines.length;
    const unknown = await host.run("nope");
    const unknownError = host.console.errors[0];
    const usage = await host.run("models");
    const usageError = host.console.errors[0];
    const failed = await host.run("project-forget", "missing");
    const failedError = host.console.errors[0];
    host.connections.connectFailure = new Error("socket gone");
    const unreachable = await host.run("providers");
    const unreachableError = host.console.errors[0];
    host.connections.connectFailure = "plain text";
    const plain = await host.run("providers");
    const plainError = host.console.errors[0];

    Assert.areEqual(0, help);
    Assert.isTrue(helpLines > 20);
    Assert.areEqual(2, unknown);
    Assert.areEqual("Unknown command \"nope\". Run \"teamrun help\" for the list.", unknownError);
    Assert.areEqual(2, usage);
    Assert.areEqual("The argument <provider> is required.", usageError);
    Assert.areEqual(1, failed);
    Assert.isTrue(failedError?.startsWith("Error (NotFound)") ?? false);
    Assert.areEqual(1, unreachable);
    Assert.areEqual("Could not reach the runtime: socket gone", unreachableError);
    Assert.areEqual(1, plain);
    Assert.areEqual("Could not reach the runtime: plain text", plainError);
  }
}
