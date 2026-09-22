/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Exception } from "@noldova/teamrun-foundation-exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { ProtocolVersion } from "@noldova/teamrun-protocol";
import { Endpoint, RuntimeAlreadyRunningException, RuntimeLock } from "@noldova/teamrun-runtime";

@TestClass
export class RuntimeAlreadyRunningExceptionTests {
  @TestMethod
  public describesTheRunningRuntime(): void {
    const lock = new RuntimeLock(42, Endpoint.tcp(5000), "token", new ProtocolVersion(0, 1), "1.0.0", "2026-09-10T00:00:00.000Z");

    const exception = new RuntimeAlreadyRunningException(lock);

    Assert.isInstanceOf(exception, Exception);
    Assert.areEqual(lock, exception.lock);
    Assert.areEqual("A runtime for this data directory is already running (process 42, endpoint 127.0.0.1:5000).", exception.message);
  }
}
