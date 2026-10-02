/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { PreShellDataException } from "@noldova/teamrun-shell-runtime";

@TestClass
export class PreShellDataExceptionTests {
  @TestMethod
  public listsTheEarlierReleasesEntries(): void {
    const entries = ["teamrun.db", "attachments"];
    const exception = new PreShellDataException("/data/teamrun", entries);
    entries.push("other");

    Assert.areEqual("The data directory /data/teamrun holds data from a release before the shell: teamrun.db, attachments.", exception.message);
    Assert.areEqual("/data/teamrun", exception.root);
    Assert.areEqual("teamrun.db,attachments", exception.entries.join(","));
    Assert.areEqual("PreShellDataException", exception.name);
  }
}
