/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { SystemCommand } from "@noldova/teamrun-shell-runtime";
import { PublisherCheck } from "@noldova/teamrun-shell-desktop";

import { PlatformFixture } from "../fixtures/platform.fixture.js";

class FakeCommand {
  public readonly calls: { readonly file: string; readonly arguments: readonly string[]; readonly environment: NodeJS.ProcessEnv }[] = [];
  private readonly answer: () => Promise<string>;

  public constructor(answer: () => Promise<string>) {
    this.answer = answer;
  }

  public runAsync(file: string, commandArguments: readonly string[], environment?: NodeJS.ProcessEnv): Promise<string> {
    this.calls.push({ file, arguments: commandArguments, environment: environment ?? {} });
    return this.answer();
  }
}

@TestClass
export class PublisherCheckTests {
  private static readonly PUBLISHER: string = "CN=Noldova SRL, O=Noldova SRL, C=MD";
  private static readonly INSTALLER: string = "C:\\Temp\\it's\\TeamRun-windows-x64.exe";
  private static readonly ENVIRONMENT: NodeJS.ProcessEnv = { SystemRoot: "C:\\Windows", PSModulePath: "C:\\Modules", Path: "C:\\Windows\\System32" };

  @TestMethod
  public async passesASignatureOfThePublisherReadByPowerShellWithoutAShellAndRecordsHowLongItTook(): Promise<void> {
    const lines: string[] = [];
    let time = 1_000;
    const command = new FakeCommand(() => {
      time += 840;
      return Promise.resolve(PublisherCheckTests.answer(0, "Signature verified.", PublisherCheckTests.INSTALLER, "CN=Noldova SRL, O=Noldova SRL, L=Chisinau, C=MD"));
    });
    const check = new PublisherCheck(PublisherCheckTests.PUBLISHER, command, PublisherCheckTests.ENVIRONMENT, t => lines.push(t), () => time);

    const failure = await check.checkAsync(PublisherCheckTests.INSTALLER);

    Assert.isNull(failure);
    Assert.areEqual(JSON.stringify(["The update's publisher check passed in 840 ms."]), JSON.stringify(lines));
    const [call] = command.calls;
    Assert.areEqual("C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe", call?.file);
    Assert.areEqual(JSON.stringify(["-NoProfile", "-NonInteractive", "-InputFormat", "None", "-EncodedCommand"]), JSON.stringify(call?.arguments.slice(0, 5)));
    Assert.areEqual(JSON.stringify({ SystemRoot: "C:\\Windows", Path: "C:\\Windows\\System32" }), JSON.stringify(call?.environment));
    const script = Buffer.from(call?.arguments[5] ?? "", "base64").toString("utf16le");
    Assert.isTrue(script.includes("Get-AuthenticodeSignature -LiteralPath 'C:\\Temp\\it''s\\TeamRun-windows-x64.exe'"), script);
    Assert.isTrue(script.includes("ConvertTo-Json -Compress"), script);
  }

  @TestMethod
  public async matchesTheSignersNameFieldByFieldWhateverItsQuotingEscapingSpacingAndCase(): Promise<void> {
    const signers = ["c=MD,o=\"Noldova SRL\",cn=Noldova SRL", "CN=\"Noldova SRL\", O=Noldova SRL, C=MD", "CN=Noldova\\ SRL, O=Noldova SRL, C=MD, OU=Updates"];

    for (const signer of signers) {
      const check = new PublisherCheck(PublisherCheckTests.PUBLISHER, new FakeCommand(() => Promise.resolve(PublisherCheckTests.answer(0, "", PublisherCheckTests.INSTALLER, signer))),
        PublisherCheckTests.ENVIRONMENT, () => undefined, () => 0);

      Assert.isNull(await check.checkAsync(PublisherCheckTests.INSTALLER), signer);
    }
  }

  @TestMethod
  public async failsInOneLineWhenTheSignatureIsInvalidOfAnotherFileOrAnothersOrThePublisherNamesNoField(): Promise<void> {
    const cases: readonly (readonly [string, string, string])[] = [
      [PublisherCheckTests.PUBLISHER, PublisherCheckTests.answer(2, "The file is not signed.\r\nAsk its publisher.", PublisherCheckTests.INSTALLER, ""),
        "its signature is not valid: The file is not signed. Ask its publisher."],
      [PublisherCheckTests.PUBLISHER, PublisherCheckTests.answer(0, "", "C:\\Temp\\other.exe", "CN=Noldova SRL, O=Noldova SRL, C=MD"), "PowerShell read the signature of C:\\Temp\\other.exe instead"],
      [PublisherCheckTests.PUBLISHER, PublisherCheckTests.answer(0, "", "c:\\temp\\IT'S\\TeamRun-windows-x64.exe", "CN=Noldova SRL, O=Other, C=MD"),
        "it is signed by CN=Noldova SRL, O=Other, C=MD, not by CN=Noldova SRL, O=Noldova SRL, C=MD"],
      ["Noldova", PublisherCheckTests.answer(0, "", PublisherCheckTests.INSTALLER, "CN=Noldova"), "it is signed by CN=Noldova, not by Noldova"]
    ];

    for (const [publisher, answer, expected] of cases) {
      const lines: string[] = [];
      const check = new PublisherCheck(publisher, new FakeCommand(() => Promise.resolve(answer)), PublisherCheckTests.ENVIRONMENT, t => lines.push(t), () => 0);

      Assert.areEqual(expected, await check.checkAsync(PublisherCheckTests.INSTALLER));
      Assert.areEqual(JSON.stringify(["The update's publisher check failed in 0 ms."]), JSON.stringify(lines));
    }
  }

  @TestMethod
  public async failsWhenPowerShellCannotBeFoundFailsOrAnswersUnreadably(): Promise<void> {
    const cases: readonly (readonly [NodeJS.ProcessEnv, () => Promise<string>, string])[] = [
      [{}, () => Promise.resolve(""), "Windows did not name its system folder in SystemRoot, so PowerShell could not be found to read the signature."],
      [{ SystemRoot: " " }, () => Promise.resolve(""), "Windows did not name its system folder in SystemRoot, so PowerShell could not be found to read the signature."],
      [PublisherCheckTests.ENVIRONMENT, () => Promise.reject(new Error("powershell.exe failed: timed out\n  after 30 s")), "Error: powershell.exe failed: timed out after 30 s"],
      [PublisherCheckTests.ENVIRONMENT, () => Promise.resolve("Get-AuthenticodeSignature : Access\r\nis denied."), "PowerShell answered with an unreadable signature: Get-AuthenticodeSignature : Access is denied."],
      [PublisherCheckTests.ENVIRONMENT, () => Promise.resolve("{\"Status\":0}"), "JsonException: "]
    ];

    for (const [environment, answer, expected] of cases) {
      const check = new PublisherCheck(PublisherCheckTests.PUBLISHER, new FakeCommand(answer), environment, () => undefined, () => 0);

      const failure = await check.checkAsync(PublisherCheckTests.INSTALLER);

      Assert.isTrue(failure?.startsWith(expected) === true, `${expected} / ${failure}`);
      Assert.isFalse(failure?.includes("\n") === true, failure ?? "");
    }
  }

  @PlatformFixture.windowsOnly()
  @TestMethod
  public async readsRealSignaturesWithoutAShellOrAWarningOnWindows(): Promise<void> {
    const folder = await mkdtemp(path.join(tmpdir(), "tr-publisher-"));
    const warnings: string[] = [];
    const warn = (warning: Error): void => {
      warnings.push(warning.message);
    };
    process.on("warning", warn);
    try {
      const unsigned = path.join(folder, "TeamRun's installer.exe");
      await writeFile(unsigned, "MZ");
      const check = new PublisherCheck(PublisherCheckTests.PUBLISHER, new SystemCommand(), process.env, () => undefined, Date.now);
      const signed = path.join(process.env["SystemRoot"] ?? "C:\\Windows", "System32", "cmd.exe");

      const [unsignedFailure, signedFailure] = [await check.checkAsync(unsigned), await check.checkAsync(signed)];

      Assert.isTrue(unsignedFailure?.startsWith("its signature is not valid: ") === true, unsignedFailure ?? "");
      Assert.isTrue(signedFailure?.startsWith("it is signed by CN=Microsoft") === true, signedFailure ?? "");
      Assert.areEqual("[]", JSON.stringify(warnings));
    }
    finally {
      process.off("warning", warn);
      await rm(folder, { recursive: true, force: true });
    }
  }

  private static answer(status: number, message: string, file: string, subject: string): string {
    return JSON.stringify({ Status: status, StatusMessage: message, Path: file, Subject: subject });
  }
}
