/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { existsSync, readFileSync } from "node:fs";

import { ApprovalAsk, TurnOutcome } from "@noldova/teamrun-core";
import { ApprovalKind, ApprovalOption, ApprovalOutcome } from "@noldova/teamrun-protocol";

import { CliTestHost } from "../../fixtures/cli-test-host.fixture.js";

@TestClass
export class LiveCheckCommandTests {
  @TestMethod
  public async runsOneTurnInADisposableProject(): Promise<void> {
    await using host = await CliTestHost.create();
    const options = [new ApprovalOption("allow", "Allow", ApprovalOutcome.Approved), new ApprovalOption("deny", "Deny", ApprovalOutcome.Denied)];
    host.adapter.approvalAsk = new ApprovalAsk("req-1", ApprovalKind.Command, "Bash", "Run ls", null, options);
    const evidence = host.directory.resolve("evidence.json");

    const code = await host.run("live-check", "--provider", "fake", "--evidence", evidence);
    const errors = host.console.errors.join("; ");
    Assert.areEqual(0, code, errors);
    const withoutEvidence = await host.run("live-check", "--provider", "fake", "--prompt", "Say hi");
    const missing = await host.run("live-check");
    host.adapter.outcome = TurnOutcome.Failed;
    const failed = await host.run("live-check", "--provider", "fake");
    host.adapter.outcome = TurnOutcome.Completed;
    host.adapter.removeFixture = true;
    const vanished = await host.run("live-check", "--provider", "fake");
    const kept = host.console.errors.join("; ");
    const projects = await host.runJson("projects");

    const report = JSON.parse(readFileSync(evidence, "utf8")) as { provider: string; decisions: string[]; detailCount: number; projectPath: string };
    Assert.areEqual(0, code);
    Assert.areEqual("fake", report.provider);
    Assert.areEqual("deny", report.decisions.join(","));
    Assert.areEqual(2, report.detailCount);
    Assert.isFalse(existsSync(report.projectPath));
    Assert.areEqual(0, withoutEvidence);
    Assert.areEqual("Say hi", host.adapter.prompts[1]);
    Assert.areEqual(2, missing);
    Assert.areEqual(1, failed);
    Assert.areEqual(0, vanished);
    Assert.isTrue(kept.includes("could not be removed"), kept);
    Assert.areEqual("[]", JSON.stringify(projects));
  }
}
