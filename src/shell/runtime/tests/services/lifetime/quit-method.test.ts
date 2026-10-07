/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { ShellMethods } from "@noldova/teamrun-shell-protocol";
import { RuntimeBuild } from "@noldova/teamrun-shell-runtime";

import { RuntimeHostFixture } from "../../fixtures/runtime-host.fixture.js";

@TestClass
export class QuitMethodTests {
  @TestMethod
  public answersNoDesktopAtOnceWhenNoDesktopIsConnected(): Promise<void> {
    return RuntimeHostFixture.runAsync(async fixture => {
      await fixture.startAsync();
      const [cli] = await fixture.handshakeAsync("cli", RuntimeBuild.identity);
      await fixture.handshakeAsync("cli", RuntimeBuild.identity);

      const answer = await RuntimeHostFixture.callAsync(cli, "cli:1", ShellMethods.quit, null);

      Assert.areEqual("{\"outcome\":\"NoDesktop\"}", JSON.stringify(answer.payload));
    });
  }
}
