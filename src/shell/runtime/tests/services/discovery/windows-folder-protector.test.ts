/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { Assert, TestClass, TestData, TestMethod } from "@noldova/teamrun-foundation-testing";
import { SystemCommandException, WindowsFolderProtector } from "@noldova/teamrun-shell-runtime";

import { SystemCommandFixture } from "../../fixtures/system-command.fixture.js";

@TestClass
export class WindowsFolderProtectorTests {
  private static readonly FOLDER: string = "C:\\Users\\person\\.noldova\\teamrun\\discovery";

  @TestMethod
  public async grantsTheCurrentUserAloneFullControlWithSystemTools(): Promise<void> {
    const command = new SystemCommandFixture(["\"desktop\\person\",\"S-1-5-21-1004336348-1177238915-682003330-1001\"\r\n", ""]);

    await new WindowsFolderProtector(command, { SystemRoot: "C:\\Windows" }).protectAsync(WindowsFolderProtectorTests.FOLDER);

    Assert.areEqual(2, command.calls.length);
    Assert.areEqual("C:\\Windows\\System32\\whoami.exe /user /fo csv /nh", command.calls[0]?.join(" "));
    Assert.areEqual(
      `C:\\Windows\\System32\\icacls.exe ${WindowsFolderProtectorTests.FOLDER} /inheritance:r /grant:r *S-1-5-21-1004336348-1177238915-682003330-1001:(OI)(CI)F`,
      command.calls[1]?.join(" "));
  }

  @TestMethod
  @TestData("")
  @TestData("   ")
  public async refusesWithoutSystemRoot(systemRoot: string): Promise<void> {
    const command = new SystemCommandFixture([]);

    const exception = await Assert.throwsAsync(
      () => new WindowsFolderProtector(command, { SystemRoot: systemRoot }).protectAsync(WindowsFolderProtectorTests.FOLDER),
      SystemCommandException);
    await Assert.throwsAsync(() => new WindowsFolderProtector(command, {}).protectAsync(WindowsFolderProtectorTests.FOLDER), SystemCommandException);

    Assert.areEqual("SystemRoot is not set, so the Windows system tools cannot be found.", exception.message);
    Assert.areEqual(0, command.calls.length);
  }

  @TestMethod
  public async refusesAnUnreadableIdentity(): Promise<void> {
    const command = new SystemCommandFixture(["\"desktop\\person\",\"unknown\"\r\n"]);

    const exception = await Assert.throwsAsync(
      () => new WindowsFolderProtector(command, { SystemRoot: "C:\\Windows" }).protectAsync(WindowsFolderProtectorTests.FOLDER),
      SystemCommandException);

    Assert.areEqual("The current user's security identifier could not be read from: \"desktop\\person\",\"unknown\"\r\n", exception.message);
    Assert.areEqual(1, command.calls.length);
  }

  @TestMethod
  public async passesOnAToolFailure(): Promise<void> {
    const failure = new SystemCommandException("icacls.exe failed");
    const command = new SystemCommandFixture(["\"desktop\\person\",\"S-1-5-18\"", failure]);

    const exception = await Assert.throwsAsync(
      () => new WindowsFolderProtector(command, { SystemRoot: "C:\\Windows" }).protectAsync(WindowsFolderProtectorTests.FOLDER),
      SystemCommandException);

    Assert.areEqual(failure, exception);
  }
}
