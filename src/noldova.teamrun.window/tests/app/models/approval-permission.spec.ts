/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonValue } from "@noldova/context.json";
import {
  Approval, ApprovalKind, ApprovalOption, ApprovalOutcome, ApprovalQuestion, ApprovalScope, ApprovalStatus, PermissionDetail, PermissionDetailKind, PermissionPayload,
  PermissionRisk as RequestRisk, QuestionOption
} from "@noldova/teamrun.protocol";
import { PermissionEffect, PermissionRisk, PermissionScope, PermissionStatus } from "@noldova/ui.components.angular";

import { ApprovalAnswer } from "../../../src/app/models/approval-answer";
import { ApprovalPermission } from "../../../src/app/models/approval-permission";
import { ProviderAsk } from "../../fixtures/provider-ask.fixture";
import { SampleData } from "../../fixtures/sample-data.fixture";

describe("ApprovalPermission", () => {
  const ofKind = (kind: ApprovalKind): Approval => new Approval("ap1", "m2", kind, "native", "summary", null, SampleData.approval.options, ApprovalStatus.Pending,
    null, SampleData.timestamp, null);
  const asking = (title: string, payload: PermissionPayload): Approval => new Approval("ap1", "m2", ApprovalKind.Permission, "teamrun.deleteChat", title,
    payload.toJson(), [
      new ApprovalOption("allowOnce", "Allow once", ApprovalOutcome.Approved, ApprovalScope.Once),
      new ApprovalOption("deny", "Deny", ApprovalOutcome.Denied, ApprovalScope.Once)
    ], ApprovalStatus.Pending, null, SampleData.timestamp, null);
  const permission = (risk: RequestRisk, details: readonly PermissionDetail[]): Approval =>
    asking("Delete the chat \"Old\"", new PermissionPayload("teamrun", "c1", risk, details));
  const served = (module: string, tool: string): Approval =>
    asking("Commit 2 files to dev8/1719-gemini-folder-trust", new PermissionPayload(module, "teamrun", RequestRisk.Medium, [], { tool, input: { message: "Fix" } }));

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
    const asks = [new ProviderAsk("Codex", ApprovalKind.Command, "commandExecution"), new ProviderAsk("Codex", ApprovalKind.FileChange, "fileChange"),
      new ProviderAsk("Codex", ApprovalKind.Tool, "elicitation"), new ProviderAsk("Claude Code", ApprovalKind.Command, "Bash"),
      new ProviderAsk("Claude Code", ApprovalKind.FileChange, "Edit"), new ProviderAsk("Claude Code", ApprovalKind.Tool, "WebFetch"),
      new ProviderAsk("Pi", ApprovalKind.Command, "bash"), new ProviderAsk("Pi", ApprovalKind.FileChange, "write"), new ProviderAsk("Copilot", ApprovalKind.Command, "execute"),
      new ProviderAsk("Antigravity", ApprovalKind.Tool, "read")];

    const requests = asks.map(t => ApprovalPermission.toRequest(ask(t.kind, t.nativeKind), "Alice", null, t.provider));

    expect(requests.map(t => t.kind)).toEqual(["Codex · command", "Codex · file change", "Codex · tool", "Claude Code · command", "Claude Code · file change",
      "Claude Code · tool", "Pi · command", "Pi · file change", "Copilot · command", "Antigravity · tool"]);
    expect(requests.map(t => [t.details, t.description])).toEqual(asks.map(t => [`summary\nKind: ${t.nativeKind}`, null]));
  });

  it("leaves the kind line out for a permission request no served call made, whose title says what it does, or without a provider's name", () => {
    const shown = [ApprovalPermission.toRequest(permission(RequestRisk.Low, []), "Alice", null, "Codex", "First"),
      ApprovalPermission.toRequest(SampleData.approval, "Alice", null), ApprovalPermission.toRequest(SampleData.approval, "Alice", null, " ")];

    expect(shown.map(t => t.kind)).toEqual([null, null, null]);
    expect(shown[0]?.heading).toBe("Delete the chat \"Old\"");
  });

  it("names under a served call's title its module by name, its tool, the teammate and the chat, never the action's ID", () => {
    const shown = [ApprovalPermission.toRequest(served("git", "git_commit"), "Codex", null, "Codex", "Gemini folder trust"),
      ApprovalPermission.toRequest(served("git-github", "github_pr_create"), "Codex", null, null, "Gemini folder trust"),
      ApprovalPermission.toRequest(served("git", "git_push"), "Codex", null, "Codex"),
      ApprovalPermission.toRequest(served("notes", "notes_delete"), "Alice", null, "Codex", "Docs typo")];

    expect(shown.map(t => t.kind)).toEqual(["Git · git_commit · Codex in \"Gemini folder trust\"", "GitHub · github_pr_create · Codex in \"Gemini folder trust\"",
      "Git · git_push · Codex", "notes · notes_delete · Alice in \"Docs typo\""]);
    expect(shown.map(t => [t.heading, t.details, t.description])).toEqual(Array.from({ length: 4 }, () => ["Commit 2 files to dev8/1719-gemini-folder-trust", null, null]));
  });

  it("says which sub-agent asks, from a provider request's payload, and never for a permission request", () => {
    const asked = (kind: ApprovalKind, payload: JsonValue): Approval => new Approval("ap1", "m2", kind, "native", "summary", payload, SampleData.approval.options,
      ApprovalStatus.Pending, null, SampleData.timestamp, null);
    const named = asked(ApprovalKind.Tool, { tool: "Bash", subAgent: "Explore the parser" });

    expect(ApprovalPermission.toRequest(named, "Alice", null, "Codex").description).toBe("Explore the parser asks");
    expect([asked(ApprovalKind.Command, { subAgent: " " }), asked(ApprovalKind.Tool, ["Explore"]), asked(ApprovalKind.Tool, { subAgent: 3 }), asked(ApprovalKind.Tool, null),
      permission(RequestRisk.Low, [])].map(t => ApprovalPermission.subAgentOf(t))).toEqual([null, null, null, null, null]);
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
    const request = ApprovalPermission.toRequest(permission(RequestRisk.Medium, [new PermissionDetail("Chat", PermissionDetailKind.Text, "Old"),
      new PermissionDetail("Token", PermissionDetailKind.Secret, null)]),
      "Alice", null, "Codex");

    expect([request.heading, request.risk, request.details, request.description]).toEqual(["Delete the chat \"Old\"", PermissionRisk.Medium,
      "Chat: Old\nToken: hidden", null]);
    expect(request.expiresAt?.toISOString()).toBe("2026-09-10T08:05:00.000Z");
    expect(request.options.map(t => [t.id, t.effect, t.scope])).toEqual([["allowOnce", PermissionEffect.Allow, PermissionScope.Once],
      ["deny", PermissionEffect.Deny, PermissionScope.Once]]);
  });

  it("marks a high-risk permission request by its risk alone, with no description line, and shows no details when it has none", () => {
    const requests = [RequestRisk.Low, RequestRisk.High].map(t => ApprovalPermission.toRequest(permission(t, []), "Alice", null, "Codex"));

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
