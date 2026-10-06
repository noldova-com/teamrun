/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import "@noldova/teamrun-foundation-core";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { FailureCode, ShellMethods, UpdateSaved } from "@noldova/teamrun-shell-protocol";
import { RuntimeBuild } from "@noldova/teamrun-shell-runtime";

import { RuntimeHostFixture } from "../../fixtures/runtime-host.fixture.js";

@TestClass
export class UpdateSavedMethodTests {
  @TestMethod
  public refusesASaveWhenNoUpdateIsBeingPrepared(): Promise<void> {
    return RuntimeHostFixture.runAsync(async fixture => {
      await fixture.startAsync();
      const [connection] = await fixture.handshakeAsync("cli", RuntimeBuild.identity);

      const refused = await RuntimeHostFixture.callAsync(connection, "cli:1", ShellMethods.updateSaved, new UpdateSaved(process.pid, []).toJson());

      Assert.areEqual(`${FailureCode.Conflict}|The runtime is not preparing for an update.`, `${refused.failure?.code}|${refused.failure?.message}`);
    });
  }
}
