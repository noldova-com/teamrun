/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { RunningWork } from "@noldova/teamrun-shell-protocol";
import { WorkInProgressException } from "@noldova/teamrun-shell-runtime";

@TestClass
export class WorkInProgressExceptionTests {
  @TestMethod
  public listsTheRunningWork(): void {
    const work = new RunningWork(["Indexing the project", "Running the tests"]);

    const exception = new WorkInProgressException(work);

    Assert.areEqual("Work is in progress: Indexing the project; Running the tests.", exception.message);
    Assert.areEqual(work, exception.work);
    Assert.areEqual("WorkInProgressException", exception.name);
  }
}
