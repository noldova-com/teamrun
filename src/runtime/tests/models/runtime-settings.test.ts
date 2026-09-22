/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { join } from "node:path";

import { ArgumentException, ArgumentOutOfRangeException } from "@noldova/teamrun-foundation-exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { EndpointKind, RuntimeSettings } from "@noldova/teamrun-runtime";

@TestClass
export class RuntimeSettingsTests {
  private static readonly DIRECTORY: string = process.platform === "win32" ? "C:\\data\\teamrun" : "/data/teamrun";

  @TestMethod
  public choosesTheEndpointByPlatform(): void {
    const windows = RuntimeSettings.forPlatform("win32", RuntimeSettingsTests.DIRECTORY, "1.0.0", 500);
    const linux = RuntimeSettings.forPlatform("linux", RuntimeSettingsTests.DIRECTORY, "1.0.0", null);

    Assert.areEqual(EndpointKind.Tcp, windows.endpointKind);
    Assert.isTrue(windows.socketPath.startsWith("\\\\.\\pipe\\teamrun-"));
    Assert.areEqual(16, windows.socketPath.length - "\\\\.\\pipe\\teamrun-".length);
    Assert.areEqual(500, windows.idleGraceMilliseconds);
    Assert.areEqual(EndpointKind.Socket, linux.endpointKind);
    Assert.areEqual(join(RuntimeSettingsTests.DIRECTORY, "runtime.sock"), linux.socketPath);
    Assert.isNull(linux.idleGraceMilliseconds);
    Assert.areEqual(join(RuntimeSettingsTests.DIRECTORY, "runtime.lock"), linux.lockPath);
    Assert.areEqual(windows.socketPath, RuntimeSettings.createSocketPath(true, RuntimeSettingsTests.DIRECTORY));
  }

  @TestMethod
  public validatesItsFields(): void {
    Assert.areEqual("dataDirectory", Assert.throws(() => new RuntimeSettings(" ", "1", EndpointKind.Tcp, "s", null), ArgumentException).parameterName);
    Assert.areEqual("dataDirectory", Assert.throws(() => new RuntimeSettings("relative/dir", "1", EndpointKind.Tcp, "s", null), ArgumentException).parameterName);
    Assert.areEqual("productVersion", Assert.throws(() => new RuntimeSettings(RuntimeSettingsTests.DIRECTORY, "", EndpointKind.Tcp, "s", null), ArgumentException).parameterName);
    Assert.areEqual("socketPath", Assert.throws(() => new RuntimeSettings(RuntimeSettingsTests.DIRECTORY, "1", EndpointKind.Tcp, " ", null), ArgumentException).parameterName);
    Assert.throws(() => new RuntimeSettings(RuntimeSettingsTests.DIRECTORY, "1", EndpointKind.Tcp, "s", 0), ArgumentOutOfRangeException);
  }
}
