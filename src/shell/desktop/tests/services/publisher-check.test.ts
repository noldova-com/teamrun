/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { type IWindowsSignature, WindowsProcessApi } from "@noldova/teamrun-shell-runtime";
import { PublisherCheck } from "@noldova/teamrun-shell-desktop";

import { PlatformFixture } from "../fixtures/platform.fixture.js";

class FakeSignatures {
  public readonly files: string[] = [];
  private readonly answer: () => Promise<IWindowsSignature>;

  public constructor(answer: () => Promise<IWindowsSignature>) {
    this.answer = answer;
  }

  public verifySignatureAsync(file: string): Promise<IWindowsSignature> {
    this.files.push(file);
    return this.answer();
  }
}

@TestClass
export class PublisherCheckTests {
  private static readonly PUBLISHER: string = "CN=Noldova SRL, O=Noldova SRL, C=MD";
  private static readonly INSTALLER: string = "C:\\Temp\\it's\\TeamRun-windows-x64.exe";

  @TestMethod
  public async passesAValidSignatureOfThePublisherAndRecordsHowLongItTook(): Promise<void> {
    const lines: string[] = [];
    let time = 1_000;
    const signatures = new FakeSignatures(() => {
      time += 840;
      return Promise.resolve({ status: 0, message: "The operation completed successfully.\r\n", subject: "CN=Noldova SRL, O=Noldova SRL, L=Chisinau, C=MD" });
    });
    const check = new PublisherCheck(PublisherCheckTests.PUBLISHER, signatures, t => lines.push(t), () => time);

    const failure = await check.checkAsync(PublisherCheckTests.INSTALLER);

    Assert.isNull(failure);
    Assert.areEqual(JSON.stringify([PublisherCheckTests.INSTALLER]), JSON.stringify(signatures.files));
    Assert.areEqual(JSON.stringify(["The update's publisher check passed in 840 ms."]), JSON.stringify(lines));
  }

  @TestMethod
  public async matchesTheSignersNameFieldByFieldWhateverItsQuotingEscapingSpacingAndCase(): Promise<void> {
    const signers = ["c=MD,o=\"Noldova SRL\",cn=Noldova SRL", "CN=\"Noldova SRL\", O=Noldova SRL, C=MD", "CN=Noldova\\ SRL, O=Noldova SRL, C=MD, OU=Updates"];

    for (const signer of signers) {
      const check = new PublisherCheck(PublisherCheckTests.PUBLISHER, new FakeSignatures(() => Promise.resolve({ status: 0, message: "", subject: signer })), () => undefined, () => 0);

      Assert.isNull(await check.checkAsync(PublisherCheckTests.INSTALLER), signer);
    }
  }

  @TestMethod
  public async failsInOneLineWhenTheSignatureIsInvalidHasNoReadableSignerOrIsAnothers(): Promise<void> {
    const cases: readonly (readonly [string, IWindowsSignature, string])[] = [
      [PublisherCheckTests.PUBLISHER, { status: 0x800B0100, message: "No signature was present\r\nin the subject.\r\n", subject: null },
        "its signature is not valid (0x800B0100): No signature was present in the subject."],
      [PublisherCheckTests.PUBLISHER, { status: 0x10B, message: " ", subject: "CN=Noldova SRL, O=Noldova SRL, C=MD" }, "its signature is not valid (0x0000010B)"],
      [PublisherCheckTests.PUBLISHER, { status: 0, message: "", subject: null }, "Windows verified its signature but could not read its signer's name"],
      [PublisherCheckTests.PUBLISHER, { status: 0, message: "", subject: "CN=Noldova SRL, O=Other, C=MD" },
        "it is signed by CN=Noldova SRL, O=Other, C=MD, not by CN=Noldova SRL, O=Noldova SRL, C=MD"],
      ["Noldova", { status: 0, message: "", subject: "CN=Noldova" }, "it is signed by CN=Noldova, not by Noldova"]
    ];

    for (const [publisher, signature, expected] of cases) {
      const lines: string[] = [];
      const check = new PublisherCheck(publisher, new FakeSignatures(() => Promise.resolve(signature)), t => lines.push(t), () => 0);

      Assert.areEqual(expected, await check.checkAsync(PublisherCheckTests.INSTALLER));
      Assert.areEqual(JSON.stringify(["The update's publisher check failed in 0 ms."]), JSON.stringify(lines));
    }
  }

  @TestMethod
  public async failsInOneLineWhenTheSignatureCannotBeRead(): Promise<void> {
    const lines: string[] = [];
    const check = new PublisherCheck(PublisherCheckTests.PUBLISHER, new FakeSignatures(() => Promise.reject(new Error("The runtime could not load\n  its Windows addon."))),
      t => lines.push(t), () => 0);

    Assert.areEqual("Error: The runtime could not load its Windows addon.", await check.checkAsync(PublisherCheckTests.INSTALLER));
    Assert.areEqual(JSON.stringify(["The update's publisher check failed in 0 ms."]), JSON.stringify(lines));
  }

  @PlatformFixture.windowsOnly()
  @TestMethod
  public async readsRealSignaturesWithoutHoldingTheEventLoopOnWindows(): Promise<void> {
    const folder = await mkdtemp(path.join(tmpdir(), "tr-publisher-"));
    try {
      const unsigned = path.join(folder, "TeamRun's ünsigned installer.exe");
      await writeFile(unsigned, "MZ");
      const lines: string[] = [];
      const check = new PublisherCheck(PublisherCheckTests.PUBLISHER, new WindowsProcessApi(), t => lines.push(t), Date.now);
      const order: string[] = [];

      const unsignedFailure = await check.checkAsync(unsigned);
      const checking = check.checkAsync(process.execPath).then(t => {
        order.push("checked");
        return t;
      });
      setImmediate(() => order.push("immediate"));
      const signedFailure = await checking;

      const megabytes = Math.round((await stat(process.execPath)).size / 1_048_576);
      console.log(`${lines[1]} (${path.basename(process.execPath)}, ${megabytes} MB)`);
      Assert.isTrue(unsignedFailure?.startsWith("its signature is not valid (0x") === true, unsignedFailure ?? "");
      Assert.isTrue(signedFailure?.startsWith("it is signed by CN=") === true, signedFailure ?? "");
      Assert.areEqual(JSON.stringify(["immediate", "checked"]), JSON.stringify(order));
    }
    finally {
      await rm(folder, { recursive: true, force: true });
    }
  }
}
