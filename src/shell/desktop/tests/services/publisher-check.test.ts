/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Logger } from "electron-updater";

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { PublisherCheck } from "@noldova/teamrun-shell-desktop";

@TestClass
export class PublisherCheckTests {
  @TestMethod
  public async passesASignatureOfThePublisherAndRecordsHowLongItTook(): Promise<void> {
    const lines: string[] = [];
    const calls: string[] = [];
    let time = 1_000;
    const check = new PublisherCheck("CN=Noldova", (names, file, logger) => {
      calls.push(`${names.join("|")} ${file}`);
      logger.info("Verifying signature");
      time += 840;
      return Promise.resolve(null);
    }, t => lines.push(t), () => time);

    const failure = await check.checkAsync("C:\\Temp\\TeamRun-windows-x64.exe");

    Assert.isNull(failure);
    Assert.areEqual(JSON.stringify(["CN=Noldova C:\\Temp\\TeamRun-windows-x64.exe"]), JSON.stringify(calls));
    Assert.areEqual(JSON.stringify(["The update's publisher check passed in 840 ms."]), JSON.stringify(lines));
  }

  @TestMethod
  public async failsWhenTheSignatureIsAnothers(): Promise<void> {
    const lines: string[] = [];
    const check = new PublisherCheck("CN=Noldova", () => Promise.resolve("publisherNames: CN=Noldova, raw info: CN=Other"), t => lines.push(t), () => 0);

    Assert.areEqual("publisherNames: CN=Noldova, raw info: CN=Other", await check.checkAsync("/tmp/a.exe"));
    Assert.areEqual(JSON.stringify(["The update's publisher check failed in 0 ms: publisherNames: CN=Noldova, raw info: CN=Other"]), JSON.stringify(lines));
  }

  @TestMethod
  public async failsWhenTheCheckWarnsOrErrsEvenIfItPassed(): Promise<void> {
    const failures: (string | null)[] = [];
    const verifications: ((logger: Logger) => void)[] = [
      t => t.warn("Cannot execute ConvertTo-Json: timeout. Ignoring signature validation due to unsupported powershell version."),
      t => {
        t.error("first");
        t.warn("second");
      }
    ];

    for (const verify of verifications) {
      const check = new PublisherCheck("CN=Noldova", (_, __, logger) => {
        verify(logger);
        return Promise.resolve(null);
      }, () => undefined, () => 0);
      failures.push(await check.checkAsync("/tmp/a.exe"));
    }

    Assert.areEqual(JSON.stringify(["Cannot execute ConvertTo-Json: timeout. Ignoring signature validation due to unsupported powershell version.", "first\nsecond"]), JSON.stringify(failures));
  }

  @TestMethod
  public async failsWhenTheCheckRejects(): Promise<void> {
    const lines: string[] = [];
    const check = new PublisherCheck("CN=Noldova", () => Promise.reject(new Error("Command failed: powershell timed out")), t => lines.push(t), () => 0);

    Assert.areEqual("Error: Command failed: powershell timed out", await check.checkAsync("/tmp/a.exe"));
    Assert.areEqual(JSON.stringify(["The update's publisher check failed in 0 ms: Error: Command failed: powershell timed out"]), JSON.stringify(lines));
  }
}
