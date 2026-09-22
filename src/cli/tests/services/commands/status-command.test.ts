/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { JsonReader } from "@noldova/teamrun-foundation-json";

import { CliTestHost } from "../../fixtures/cli-test-host.fixture.js";

@TestClass
export class StatusCommandTests {
  @TestMethod
  public async reportsTheRunningRuntimeOrNone(): Promise<void> {
    await using host = await CliTestHost.create();

    const running = await host.run("status");
    const line = host.console.lastLine;
    const endpoint = host.service.lock?.endpoint;
    const token = host.service.lock?.token;
    const json = await host.runJson("status");
    await host.service.stop("test");
    const stopped = await host.run("status");

    Assert.areEqual(0, running);
    Assert.isDefined(endpoint);
    Assert.isTrue(line.startsWith(`Runtime process ${process.pid} at ${endpoint.path ?? `127.0.0.1:${endpoint.port}`}`));
    const metadata = JsonReader.fromValue(json);
    Assert.areEqual(process.pid, metadata.readInteger("processId"));
    Assert.isFalse(metadata.hasField("token"));
    Assert.isDefined(token);
    Assert.isFalse(JSON.stringify(json).includes(token));
    Assert.areEqual("endpoint,processId,productVersion,protocolVersion,startedAt", Object.keys(metadata.toJson()).sort().join(","));
    Assert.areEqual(1, stopped);
    Assert.areEqual("No runtime is running for this data directory.", host.console.lastLine);
  }
}
