/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {
  Approval,
  ApprovalKind,
  ApprovalOption,
  ApprovalOutcome,
  ApprovalScope,
  ApprovalStatus,
  AuthStatus,
  Conversation,
  DetailKind,
  Harness,
  Message,
  MessageAuthor,
  MessageDetail,
  MessageStatus,
  ObservedSettings,
  Project,
  ProjectListing,
  Provenance,
  Provider,
  RequestedSettings,
  Teammate
} from "@noldova/teamrun.protocol";

export class SampleData {
  public static readonly time: string = "2026-10-19T12:00:00.000Z";
  public static readonly site: Project = new Project("p1", "Site", "/work/site", SampleData.time);
  public static readonly docs: Project = new Project("p2", "Docs", "/work/docs", SampleData.time);
  public static readonly listed: readonly ProjectListing[] = [new ProjectListing(SampleData.site, false), new ProjectListing(SampleData.docs, true)];
  public static readonly release: Conversation = new Conversation("c1", "p1", "Release", SampleData.time, SampleData.time);
  public static readonly notes: Conversation = new Conversation("c2", "p2", "Notes", SampleData.time, SampleData.time);
  public static readonly scratch: Conversation = new Conversation("c4", null, "Scratch", SampleData.time, SampleData.time, false, null, null, false, "/data/chats/c4");
  public static readonly alice: Teammate = new Teammate("t1", "Alice", "Review", "a1", Harness.Provider, "gpt-5", "high", SampleData.time, SampleData.time);
  public static readonly chat: Teammate = new Teammate("t2", "Chat GPT", null, "a1", Harness.Provider, null, null, SampleData.time, SampleData.time);
  public static readonly provider: Provider = new Provider("a1", "codex", "Work", "/profiles/a1", AuthStatus.LoggedIn, null, null, null, null,
    SampleData.time);
  public static readonly allow: ApprovalOption = new ApprovalOption("allow", "Allow", ApprovalOutcome.Approved, ApprovalScope.Once);
  public static readonly deny: ApprovalOption = new ApprovalOption("deny", "Deny", ApprovalOutcome.Denied, ApprovalScope.Once);

  public static user(id: string, conversationId: string, sequence: number, text: string): Message {
    return new Message(id, conversationId, sequence, MessageAuthor.User, null, MessageStatus.Completed, [SampleData.detail(0, DetailKind.Text, text)],
      null, SampleData.time, null, SampleData.time);
  }

  public static reply(id: string, conversationId: string, sequence: number, status: MessageStatus, details: readonly MessageDetail[] = [],
    teammate: Teammate | null = null): Message {
    const open = [MessageStatus.Pending, MessageStatus.Running, MessageStatus.AwaitingApproval].includes(status);
    return new Message(id, conversationId, sequence, MessageAuthor.Provider, "m1", status, details,
      new Provenance(null, new RequestedSettings("codex", null, null), new ObservedSettings(null, null, null, null), null, false), SampleData.time,
      status === MessageStatus.Pending ? null : SampleData.time, open ? null : SampleData.time, [], teammate?.id ?? null, teammate?.name ?? null);
  }

  public static detail(sequence: number, kind: DetailKind, text: string): MessageDetail {
    return new MessageDetail(sequence, kind, text, null, SampleData.time);
  }

  public static approval(id: string, status: ApprovalStatus): Approval {
    return new Approval(id, "m2", ApprovalKind.Command, "exec", "Run npm test", null, [SampleData.allow, SampleData.deny], status,
      status === ApprovalStatus.Pending ? null : "allow", SampleData.time, status === ApprovalStatus.Pending ? null : SampleData.time);
  }
}
