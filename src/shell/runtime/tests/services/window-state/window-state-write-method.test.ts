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
export class WindowStateWriteMethodTests {
  @TestMethod
  public keepsTheLatestBoundsApartFromTheLayoutAndRefusesAWriteWithoutAValue(): Promise<void> {
    return RuntimeHostFixture.runAsync(async fixture => {
      await fixture.startAsync();
      const [connection] = await fixture.handshakeAsync("desktop", RuntimeBuild.identity);
      const main = new WindowStateKey("device-1", "main");

      connection.sendMessages(
        new Request("desktop:1", ShellMethods.writeWindowBounds, new WindowStateWrite(main, { width: 1000, height: 700 }).toJson()),
        new Request("desktop:2", ShellMethods.writeWindowLayout, new WindowStateWrite(main, { version: 1 }).toJson()),
        new Request("desktop:3", ShellMethods.writeWindowBounds, new WindowStateWrite(main, { width: 1100, height: 700 }).toJson()),
        new Request("desktop:4", ShellMethods.readWindowBounds, main.toJson()),
        new Request("desktop:5", ShellMethods.readWindowLayout, main.toJson()),
        new Request("desktop:6", ShellMethods.writeWindowLayout, { device: "device-1", window: "main" }));
      const responses = await RuntimeHostFixture.readResponsesAsync(connection, 6);

      Assert.areEqual("{\"value\":{\"width\":1100,\"height\":700}}", JSON.stringify(responses.get("desktop:4")?.payload));
      Assert.areEqual("{\"value\":{\"version\":1}}", JSON.stringify(responses.get("desktop:5")?.payload));
      Assert.areEqual("InvalidParams", responses.get("desktop:6")?.failure?.code);
      Assert.isFalse(["desktop:1", "desktop:2", "desktop:3"].some(t => responses.get(t)?.hasFailed === true));
    });
  }
}
