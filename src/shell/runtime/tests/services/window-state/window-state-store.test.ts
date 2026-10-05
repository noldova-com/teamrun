/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { Request, ShellMethods, WindowStateKey, WindowStateWrite } from "@noldova/teamrun-shell-protocol";
import { RuntimeBuild } from "@noldova/teamrun-shell-runtime";

import { RuntimeHostFixture } from "../../fixtures/runtime-host.fixture.js";

@TestClass
export class WindowStateStoreTests {
  @TestMethod
  public keepsWindowStateAcrossRuntimes(): Promise<void> {
    return RuntimeHostFixture.runAsync(async fixture => {
      const first = await fixture.startAsync();
      const [writer] = await fixture.handshakeAsync("desktop", RuntimeBuild.identity);
      const key = new WindowStateKey("device-1", "main");
      writer.sendMessages(new Request("desktop:1", ShellMethods.writeWindowBounds, new WindowStateWrite(key, { width: 900, height: 600 }).toJson()));
      await writer.readResponseAsync();
      first.requestStop("test");
      await first.waitForStopAsync();

      await fixture.startAsync();
      const [reader] = await fixture.handshakeAsync("desktop", RuntimeBuild.identity);
      reader.sendMessages(new Request("desktop:2", ShellMethods.readWindowBounds, key.toJson()));

      Assert.areEqual("{\"value\":{\"width\":900,\"height\":600}}", JSON.stringify((await reader.readResponseAsync()).payload));
    });
  }
}
