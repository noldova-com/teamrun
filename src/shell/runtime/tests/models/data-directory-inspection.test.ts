/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { DataDirectoryInspection, DataDirectoryState } from "@noldova/teamrun-shell-runtime";

@TestClass
export class DataDirectoryInspectionTests {
  @TestMethod
  public keepsItsStateAndACopyOfItsEntries(): void {
    const entries = ["teamrun.db"];
    const inspection = new DataDirectoryInspection(DataDirectoryState.PreShell, entries);
    entries.push("other");

    Assert.areEqual(DataDirectoryState.PreShell, inspection.state);
    Assert.areEqual("teamrun.db", inspection.entries.join(","));
  }
}
