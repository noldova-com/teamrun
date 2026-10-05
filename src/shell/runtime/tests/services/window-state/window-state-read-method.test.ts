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
export class WindowStateReadMethodTests {
  @TestMethod
  public readsNothingForAWindowWithoutStateOrForTheSameWindowOnAnotherDevice(): Promise<void> {
    return RuntimeHostFixture.runAsync(async fixture => {
      await fixture.startAsync();
      const [connection] = await fixture.handshakeAsync("desktop", RuntimeBuild.identity);
      const main = new WindowStateKey("device-1", "main");
      const other = new WindowStateKey("device-2", "main");

      connection.sendMessages(
        new Request("desktop:1", ShellMethods.readWindowBounds, main.toJson()),
        new Request("desktop:2", ShellMethods.writeWindowBounds, new WindowStateWrite(main, { width: 1000, height: 700 }).toJson()),
        new Request("desktop:3", ShellMethods.readWindowBounds, other.toJson()));
      const responses = await RuntimeHostFixture.readResponsesAsync(connection, 3);

      Assert.areEqual("{\"value\":null}", JSON.stringify(responses.get("desktop:1")?.payload));
      Assert.areEqual("{\"value\":null}", JSON.stringify(responses.get("desktop:3")?.payload));
      Assert.areEqual(false, responses.get("desktop:2")?.hasFailed);
    });
  }
}
