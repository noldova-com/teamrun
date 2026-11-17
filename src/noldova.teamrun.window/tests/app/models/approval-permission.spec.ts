/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Approval, ApprovalKind, ApprovalOption, ApprovalOutcome, ApprovalQuestion, ApprovalScope, ApprovalStatus, QuestionOption } from "@noldova/teamrun.protocol";
import { PermissionEffect, PermissionRisk, PermissionScope, PermissionStatus } from "@noldova/ui.components.angular";

import { ApprovalAnswer } from "../../../src/app/models/approval-answer";
import { ApprovalPermission } from "../../../src/app/models/approval-permission";
import { SampleData } from "../../fixtures/sample-data.fixture";

describe("ApprovalPermission", () => {
  const ofKind = (kind: ApprovalKind): Approval => new Approval("ap1", "m2", kind, "native", "summary", null, SampleData.approval.options, ApprovalStatus.Pending,
    null, SampleData.timestamp, null);
  const permission = (risk: string, details: { label: string; kind: string; value: string | null }[]): Approval => new Approval("ap1", "m2",
    ApprovalKind.Permission, "teamrun.deleteChat", "Delete the chat \"Old\"", { module: "teamrun", subject: "c1", risk, details }, [
      new ApprovalOption("allowOnce", "Allow once", ApprovalOutcome.Approved, ApprovalScope.Once),
      new ApprovalOption("deny", "Deny", ApprovalOutcome.Denied, ApprovalScope.Once)
    ], ApprovalStatus.Pending, null, SampleData.timestamp, null);

  it("asks for what the provider wants to do, in the teammate's name, with each option", () => {
    const request = ApprovalPermission.toRequest(SampleData.approval, "Alice", null, "Codex");

    expect([request.id, request.heading, request.details, request.description]).toEqual(["ap1", "Run a command", "run tests\nKind: exec", null]);
    expect([request.requester.name, request.requester.kind]).toEqual(["Alice", "Teammate"]);
    expect(request.options.map(t => [t.id, t.label, t.effect, t.scope])).toEqual([
      ["yes", "Approve", PermissionEffect.Allow, PermissionScope.Once],
      ["no", "Deny", PermissionEffect.Deny, PermissionScope.Once]
    ]);
    expect([request.status, request.decision, request.chosenOption]).toEqual([PermissionStatus.Pending, null, null]);
  });

  it("says the provider and the request's kind in plain words for each provider's own kind, and names that kind on the details' last line", () => {
    const ask = (kind: ApprovalKind, nativeKind: string): Approval => new Approval("ap1", "m2", kind, nativeKind, "summary", null, SampleData.approval.options,
      ApprovalStatus.Pending, null, SampleData.timestamp, null);
    const asks: readonly (readonly [string, ApprovalKind, string])[] = [["Codex", ApprovalKind.Command, "commandExecution"],
      ["Codex", ApprovalKind.FileChange, "fileChange"], ["Codex", ApprovalKind.Tool, "elicitation"], ["Claude Code", ApprovalKind.Command, "Bash"],
      ["Claude Code", ApprovalKind.FileChange, "Edit"], ["Claude Code", ApprovalKind.Tool, "WebFetch"], ["Pi", ApprovalKind.Command, "bash"],
      ["Pi", ApprovalKind.FileChange, "write"], ["Copilot", ApprovalKind.Command, "execute"], ["Antigravity", ApprovalKind.Tool, "read"]];

    const requests = asks.map(([provider, kind, nativeKind]) => ApprovalPermission.toRequest(ask(kind, nativeKind), "Alice", null, provider));

    expect(requests.map(t => t.kind)).toEqual(["Codex · command", "Codex · file change", "Codex · tool", "Claude Code · command", "Claude Code · file change",
      "Claude Code · tool", "Pi · command", "Pi · file change", "Copilot · command", "Antigravity · tool"]);
    expect(requests.map(t => [t.details, t.description])).toEqual(asks.map(([, , nativeKind]) => [`summary\nKind: ${nativeKind}`, null]));
  });

  it("leaves the kind line out for a permission request, whose title says what it does, or without a provider's name", () => {
    const shown = [ApprovalPermission.toRequest(permission("Low", []), "Alice", null, "Codex"), ApprovalPermission.toRequest(SampleData.approval, "Alice", null),
      ApprovalPermission.toRequest(SampleData.approval, "Alice", null, " ")];

    expect(shown.map(t => t.kind)).toEqual([null, null, null]);
    expect(shown[0]?.heading).toBe("Delete the chat \"Old\"");
  });

  it("says which sub-agent asks, from a provider request's payload, and never for a permission request", () => {
    const asked = (kind: ApprovalKind, payload: Approval["payload"]): Approval => new Approval("ap1", "m2", kind, "native", "summary", payload, SampleData.approval.options,
      ApprovalStatus.Pending, null, SampleData.timestamp, null);
    const named = asked(ApprovalKind.Tool, { tool: "Bash", subAgent: "Explore the parser" });

    expect(ApprovalPermission.toRequest(named, "Alice", null, "Codex").description).toBe("Explore the parser asks");
    expect([asked(ApprovalKind.Command, { subAgent: " " }), asked(ApprovalKind.Tool, ["Explore"]), asked(ApprovalKind.Tool, { subAgent: 3 }), asked(ApprovalKind.Tool, null),
      permission("low", [])].map(t => ApprovalPermission.subAgentOf(t))).toEqual([null, null, null, null, null]);
    expect(ApprovalPermission.toRequest(asked(ApprovalKind.Tool, { tool: "Bash" }), "Alice", null, "Codex").description).toBeNull();
    expect(ApprovalPermission.subAgentOf(new Approval("q1", "m2", ApprovalKind.Question, "AskUserQuestion", "Which platform?", { subAgent: "Explore the parser" },
      SampleData.approval.options, ApprovalStatus.Pending, null, SampleData.timestamp, null,
      [new ApprovalQuestion("platform", "Platform", "Which platform?", [new QuestionOption("Web", "A browser")], false, false, false)]))).toBe("Explore the parser");
  });

  it("leaves the risk unknown, so a deny is the default, and heads each request by its kind", () => {
    const requests = [ApprovalKind.Command, ApprovalKind.FileChange, ApprovalKind.Tool].map(t => ApprovalPermission.toRequest(ofKind(t), "Alice", null, "Codex"));

    expect(requests.map(t => [t.risk, t.heading])).toEqual([
      [null, "Run a command"],
      [null, "Change files"],
      [null, "Use a tool"]
    ]);
    expect(requests.map(t => t.defaultOption?.id ?? null)).toEqual(["no", "no", "no"]);
  });

  it("keeps a once or always option's scope and leaves a session option's scope unknown", () => {
    const options = [
      new ApprovalOption("accept", "Allow once", ApprovalOutcome.Approved, ApprovalScope.Once),
      new ApprovalOption("acceptForSession", "Allow for this session", ApprovalOutcome.Approved, ApprovalScope.Session),
      new ApprovalOption("always", "Always allow", ApprovalOutcome.Approved, ApprovalScope.Always)
    ];
    const approval = new Approval("ap1", "m2", ApprovalKind.Command, "native", "summary", null, options, ApprovalStatus.Pending, null, SampleData.timestamp, null);

    expect(ApprovalPermission.toRequest(approval, "Alice", null, "Codex").options.map(t => [t.id, t.scope])).toEqual([
      ["accept", PermissionScope.Once],
      ["acceptForSession", null],
      ["always", PermissionScope.Always]
    ]);
  });

  it("draws a module's allow-always label as an allow and its take-over label as a deny, each with its own label for a scope", () => {
    const approval = new Approval("ap1", "m2", ApprovalKind.Permission, "browser.type", "Type into \"Card number\"",
      { module: "browser", subject: "pay.example.com", risk: "High", details: [] }, [
        new ApprovalOption("allowOnce", "Allow once", ApprovalOutcome.Approved, ApprovalScope.Once),
        new ApprovalOption("allowAlways", "Allow this site for the project", ApprovalOutcome.Approved, ApprovalScope.Session),
        new ApprovalOption("deny", "Deny", ApprovalOutcome.Denied, ApprovalScope.Once),
        new ApprovalOption("takeOver", "I'll type it myself", ApprovalOutcome.Denied, ApprovalScope.Session)
      ], ApprovalStatus.Pending, null, SampleData.timestamp, null);

    expect(ApprovalPermission.toRequest(approval, "Alice", null, "Codex").options.map(t => [t.id, t.label, t.effect, t.scope])).toEqual([
      ["allowOnce", "Allow once", PermissionEffect.Allow, PermissionScope.Once],
      ["allowAlways", "Allow this site for the project", PermissionEffect.Allow, null],
      ["deny", "Deny", PermissionEffect.Deny, PermissionScope.Once],
      ["takeOver", "I'll type it myself", PermissionEffect.Deny, null]
    ]);
  });

  it("heads a permission request by its title and shows its risk, its details with a secret hidden and without the action's ID, and when it expires", () => {
    const request = ApprovalPermission.toRequest(permission("Medium", [{ label: "Chat", kind: "Text", value: "Old" }, { label: "Token", kind: "Secret", value: null }]),
      "Alice", null, "Codex");

    expect([request.heading, request.risk, request.details, request.description]).toEqual(["Delete the chat \"Old\"", PermissionRisk.Medium,
      "Chat: Old\nToken: hidden", null]);
    expect(request.expiresAt?.toISOString()).toBe("2026-09-10T08:05:00.000Z");
    expect(request.options.map(t => [t.id, t.effect, t.scope])).toEqual([["allowOnce", PermissionEffect.Allow, PermissionScope.Once],
      ["deny", PermissionEffect.Deny, PermissionScope.Once]]);
  });

  it("marks a high-risk permission request by its risk alone, with no description line, and shows no details when it has none", () => {
    const requests = ["Low", "High"].map(t => ApprovalPermission.toRequest(permission(t, []), "Alice", null, "Codex"));

    expect(requests.map(t => [t.risk, t.details, t.description])).toEqual([
      [PermissionRisk.Low, null, null],
      [PermissionRisk.High, null, null]
    ]);
  });

  it("shows the person's answer while a pending approval is sent, or failed to send", () => {
    const answeredAt = new Date("2026-09-10T08:30:00.000Z");
    const sending = ApprovalAnswer.sending("yes", answeredAt);

    const shown = [sending, sending.failed()].map(t => ApprovalPermission.toRequest(SampleData.approval, "Alice", t, "Codex"));

    expect(shown.map(t => [t.status, t.chosenOption?.id, t.decision?.decidedBy, t.decision?.decidedAt.toISOString()])).toEqual([
      [PermissionStatus.Sending, "yes", "You", "2026-09-10T08:30:00.000Z"],
      [PermissionStatus.SendFailed, "yes", "You", "2026-09-10T08:30:00.000Z"]
    ]);
  });
});
