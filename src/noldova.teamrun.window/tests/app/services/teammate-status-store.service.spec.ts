/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, computed, inject, input } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";

import "@noldova/context.core";
import { WindowPartTokens } from "@noldova/desktop.window";
import {
  ApprovalStatus, AuthStatus, Approval, ConversationIdParams, EventName, Message, MessageAuthor, MessageIdParams, MessageStatus, MethodName, PlanUsage, Provider,
  ReplySummary, Teammate, TeammateFallback
} from "@noldova/teamrun.protocol";

import { TeammateStatus } from "../../../src/app/enums/teammate-status";
import { TeammateStopReason } from "../../../src/app/enums/teammate-stop-reason";
import { TeammateActivity } from "../../../src/app/models/teammate-activity";
import { ChatStoreService } from "../../../src/app/services/chat-store.service";
import { TeammateStatusStoreService } from "../../../src/app/services/teammate-status-store.service";
import type { FakeWindowPartContext } from "../../fixtures/fake-window-part-context.fixture";
import { SampleData } from "../../fixtures/sample-data.fixture";
import { TeammateFixture } from "../../fixtures/teammate.fixture";
import { Wait } from "../../fixtures/wait.fixture";

@Component({
  selector: "nol-teamrun-status-probe",
  template: "{{ rendered() }}{{ status() }} {{ activities().length }}"
})
class StatusProbeComponent {
  public readonly teammateId = input.required<string>();
  public renders: number = 0;
  private readonly store: TeammateStatusStoreService = TeammateStatusStoreService.of(inject(WindowPartTokens.context));
  protected readonly status = computed(() => this.store.statusOf(this.teammateId())());
  protected readonly activities = computed(() => this.store.activitiesOf(this.teammateId())());

  protected rendered(): string {
    this.renders++;
    return "";
  }
}

@Component({
  template: "<nol-teamrun-status-probe teammateId=\"alice\" /><nol-teamrun-status-probe teammateId=\"bob\" />",
  imports: [StatusProbeComponent]
})
class StatusHostComponent {
}

describe("TeammateStatusStoreService", () => {
  const earlier = "2026-09-10T08:00:00.000Z";
  const later = "2026-09-10T09:00:00.000Z";
  let context: FakeWindowPartContext;
  let open: readonly Message[];
  let pending: readonly Approval[];
  let summaries: ReadonlyMap<string, Message>;
  let store: TeammateStatusStoreService;

  const reply = (id: string, chatId: string, teammateId: string | null, status: MessageStatus, startedAt: string | null = earlier): Message =>
    new Message(id, chatId, 1, MessageAuthor.Provider, null, status, [], SampleData.provenance, earlier, status === MessageStatus.Pending ? null : startedAt,
      [MessageStatus.Pending, MessageStatus.Running, MessageStatus.AwaitingApproval].includes(status) ? null : later, [], teammateId, teammateId);
  const approval = (messageId: string, status: ApprovalStatus): Approval => new Approval("ap1", messageId, SampleData.approval.kind, "exec", "run tests", null,
    SampleData.approval.options, status, status === ApprovalStatus.Pending ? null : "yes", earlier, status === ApprovalStatus.Pending ? null : later);
  const plan = (usedUp: boolean, providerId: string = "a1"): PlanUsage => new PlanUsage("codex", providerId, [], later, null, usedUp);
  const sustaining = (teammate: Teammate, sustain: boolean, providerIds: readonly string[]): Teammate => new Teammate(teammate.id, teammate.name, teammate.role,
    teammate.providerId, teammate.harness, teammate.model, teammate.effort, "t", "t", null, null, null, [], sustain, providerIds.map(t => new TeammateFallback(t)));
  const provider = (authStatus: AuthStatus, kind: string = "codex", enabled: boolean = true): Provider =>
    new Provider("a1", kind, "Work", "D:\\profiles\\codex", authStatus, null, "1.0", earlier, null, later, enabled);
  const statuses = (): readonly TeammateStatus[] => ["alice", "bob"].map(t => store.statusOf(t)());

  const create = async (prepare: (fixture: TeammateFixture) => void = () => undefined): Promise<void> => {
    context = SampleData.createContext().answer(MethodName.MessageListOpen, () => open.map(t => t.toJson()))
      .answer(MethodName.ApprovalListPending, () => pending.map(t => t.toJson()))
      .answer(MethodName.MessageSummary, t => {
        const found = summaries.get(MessageIdParams.fromJson(t).messageId);
        return Object.isUndefined(found) ? null : ReplySummary.fromMessage(found).toJson();
      });
    const fixture = new TeammateFixture(context);
    prepare(fixture);
    const chats = ChatStoreService.of(context);
    store = TeammateStatusStoreService.of(context);
    await Wait.until(() => expect(chats.teammates()).toHaveLength(fixture.teammates.length));
    await Wait.until(() => expect(chats.providers()).toHaveLength(1));
  };

  beforeEach(() => {
    open = [];
    pending = [];
    summaries = new Map();
  });

  afterEach(() => {
    TeammateStatusStoreService.release(context);
    ChatStoreService.release(context);
    TestBed.resetTestingModule();
  });

  it("names every status the cards show", () => {
    expect(Object.values(TeammateStatus)).toEqual(["Working", "WaitingForYou", "Idle", "UsageLimit", "Stopped"]);
    expect(Object.values(TeammateStopReason)).toEqual(["ProviderDeleted", "ProviderTurnedOff", "SignedOut", "KindMissing"]);
  });

  it("is one store per window part, and a new one once released", async () => {
    await create();

    expect(TeammateStatusStoreService.of(context)).toBe(store);
    expect(store.statusOf("alice")).toBe(store.statusOf("alice"));
    expect(store.activitiesOf("alice")).toBe(store.activitiesOf("alice"));
    TeammateStatusStoreService.release(context);
    expect(TeammateStatusStoreService.of(context)).not.toBe(store);
  });

  it("starts from the replies the runtime lists as open in every chat", async () => {
    open = [reply("r1", "c1", "alice", MessageStatus.Running), reply("r2", "c2", "bob", MessageStatus.AwaitingApproval)];
    await create();

    await Wait.until(() => expect(statuses()).toEqual([TeammateStatus.Working, TeammateStatus.WaitingForYou]));
  });

  it("is working while a reply of its own runs in any chat, lists each with its chat and start, and drops each as it ends", async () => {
    await create();
    expect(statuses()).toEqual([TeammateStatus.Idle, TeammateStatus.Idle]);

    context.emit(EventName.MessageCreated, reply("r1", "c2", "alice", MessageStatus.Running, later).toJson());
    context.emit(EventName.MessageCreated, reply("r2", "c1", "alice", MessageStatus.Pending).toJson());
    context.emit(EventName.MessageCreated, reply("r3", "c1", null, MessageStatus.Running).toJson());

    expect(statuses()).toEqual([TeammateStatus.Working, TeammateStatus.Idle]);
    expect(store.activitiesOf("alice")()).toEqual([
      new TeammateActivity("r2", "c1", MessageStatus.Pending, earlier),
      new TeammateActivity("r1", "c2", MessageStatus.Running, later)
    ]);
    context.emit(EventName.MessageUpdated, reply("r2", "c1", "alice", MessageStatus.Completed).toJson());
    expect(store.activitiesOf("alice")().map(t => t.messageId)).toEqual(["r1"]);
    context.emit(EventName.MessageUpdated, reply("r1", "c2", "alice", MessageStatus.Failed, later).toJson());
    expect([statuses(), store.activitiesOf("alice")()]).toEqual([[TeammateStatus.Idle, TeammateStatus.Idle], []]);
  });

  it("waits for you while a reply of its own awaits an approval or has a question pending, and works again once it's answered", async () => {
    await create();

    context.emit(EventName.MessageCreated, reply("r1", "c1", "alice", MessageStatus.AwaitingApproval).toJson());
    context.emit(EventName.MessageCreated, reply("r2", "c1", "bob", MessageStatus.Running).toJson());
    context.emit(EventName.ApprovalCreated, approval("r2", ApprovalStatus.Pending).toJson());
    expect(statuses()).toEqual([TeammateStatus.WaitingForYou, TeammateStatus.WaitingForYou]);

    context.emit(EventName.MessageUpdated, reply("r1", "c1", "alice", MessageStatus.Running).toJson());
    context.emit(EventName.ApprovalUpdated, approval("r2", ApprovalStatus.Approved).toJson());
    expect(statuses()).toEqual([TeammateStatus.Working, TeammateStatus.Working]);
  });

  it("keeps waiting for you while a question outlives its reply or was left pending before a reload, until its chat is deleted", async () => {
    pending = [approval("m9", ApprovalStatus.Pending)];
    summaries = new Map([["m9", reply("m9", "c2", "bob", MessageStatus.Completed)]]);
    await create();
    await Wait.until(() => expect(store.statusOf("bob")()).toBe(TeammateStatus.WaitingForYou));

    context.emit(EventName.MessageCreated, reply("r1", "c1", "alice", MessageStatus.Running).toJson());
    context.emit(EventName.ApprovalCreated, new Approval("ap2", "r1", SampleData.approval.kind, "ask", "which branch?", null, SampleData.approval.options,
      ApprovalStatus.Pending, null, earlier, null).toJson());
    context.emit(EventName.MessageUpdated, reply("r1", "c1", "alice", MessageStatus.Completed).toJson());
    const outlived = statuses();
    context.emit(EventName.ConversationDeleted, new ConversationIdParams("c1").toJson());

    expect(outlived).toEqual([TeammateStatus.WaitingForYou, TeammateStatus.WaitingForYou]);
    await Wait.until(() => expect(statuses()).toEqual([TeammateStatus.Idle, TeammateStatus.WaitingForYou]));
    expect(ChatStoreService.of(context).pendingApprovals().map(t => t.messageId)).toEqual(["m9"]);
  });

  it("is at its usage limit only while no Sustain account that can reply has room", async () => {
    await create(t => {
      t.teammates = [sustaining(t.alice, true, ["gone", "a2"]), sustaining(t.bob, true, ["off", "out", "old"]), sustaining(t.reviewer, false, ["a2"]),
        t.unavailable];
    });
    const spare = (id: string, authStatus: AuthStatus, kind: string = "codex", enabled: boolean = true): Provider =>
      new Provider(id, kind, id, "D:\\profiles\\spare", authStatus, null, "1.0", earlier, null, later, enabled);
    for (const provider of [spare("a2", AuthStatus.LoggedIn), spare("off", AuthStatus.LoggedIn, "codex", false), spare("out", AuthStatus.LoggedOut),
      spare("old", AuthStatus.LoggedIn, "retired")])
      context.emit(EventName.ProviderUpdated, provider.toJson());
    context.emit(EventName.PlanUsageUpdated, plan(true).toJson());
    const room = [...statuses(), store.statusOf("reviewer")()];

    context.emit(EventName.PlanUsageUpdated, plan(true, "a2").toJson());

    expect(room).toEqual([TeammateStatus.Idle, TeammateStatus.UsageLimit, TeammateStatus.UsageLimit]);
    expect(statuses()).toEqual([TeammateStatus.UsageLimit, TeammateStatus.UsageLimit]);
  });

  it("is at its usage limit while its provider's plan is used up, until the plan has room again, though a running reply shows as working", async () => {
    await create();

    context.emit(EventName.PlanUsageUpdated, plan(true).toJson());
    context.emit(EventName.MessageCreated, reply("r1", "c1", "bob", MessageStatus.Running).toJson());
    expect([...statuses(), store.statusOf("offline")()]).toEqual([TeammateStatus.UsageLimit, TeammateStatus.Working, TeammateStatus.Stopped]);

    context.emit(EventName.PlanUsageUpdated, plan(false).toJson());
    expect(store.statusOf("alice")()).toBe(TeammateStatus.Idle);
  });

  it("is stopped, and says why, while it can't run until the person fixes its provider: deleted, turned off, signed out or of a kind TeamRun lacks", async () => {
    await create();
    const stop = (id: string): readonly [TeammateStatus, TeammateStopReason | null] => [store.statusOf(id)(), store.stopReasonOf(id)()];
    expect([stop("offline"), stop("deleted"), stop("alice")]).toEqual([
      [TeammateStatus.Stopped, TeammateStopReason.ProviderDeleted], [TeammateStatus.Stopped, TeammateStopReason.ProviderDeleted], [TeammateStatus.Idle, null]
    ]);

    context.emit(EventName.ProviderUpdated, provider(AuthStatus.LoggedIn, "codex", false).toJson());
    expect(stop("alice")).toEqual([TeammateStatus.Stopped, TeammateStopReason.ProviderTurnedOff]);
    context.emit(EventName.ProviderUpdated, provider(AuthStatus.LoggedOut).toJson());
    expect([stop("alice"), stop("bob")]).toEqual([[TeammateStatus.Stopped, TeammateStopReason.SignedOut], [TeammateStatus.Stopped, TeammateStopReason.SignedOut]]);
    context.emit(EventName.ProviderUpdated, provider(AuthStatus.LoggedIn, "retired").toJson());
    expect(stop("alice")).toEqual([TeammateStatus.Stopped, TeammateStopReason.KindMissing]);
    context.emit(EventName.ProviderUpdated, provider(AuthStatus.LoggedIn).toJson());
    expect([stop("alice"), stop("bob")]).toEqual([[TeammateStatus.Idle, null], [TeammateStatus.Idle, null]]);
  });

  it("says no stop reason while a stopped teammate's reply still runs", async () => {
    await create();

    context.emit(EventName.MessageCreated, reply("r1", "c1", "offline", MessageStatus.Running).toJson());

    expect([store.statusOf("offline")(), store.stopReasonOf("offline")()]).toEqual([TeammateStatus.Working, null]);
    expect(store.stopReasonOf("offline")).toBe(store.stopReasonOf("offline"));
  });

  it("renders only the card of the teammate whose status or activities changed", async () => {
    await create();
    TestBed.configureTestingModule({ providers: [{ provide: WindowPartTokens.context, useValue: context }] });
    const fixture = TestBed.createComponent(StatusHostComponent);
    await fixture.whenStable();
    const [alice, bob] = fixture.debugElement.queryAll(By.directive(StatusProbeComponent)).map(t => t.componentInstance as StatusProbeComponent);
    const before = [alice?.renders, bob?.renders];

    context.emit(EventName.MessageCreated, reply("r1", "c1", "alice", MessageStatus.Running).toJson());
    await fixture.whenStable();
    context.emit(EventName.MessageCreated, reply("r2", "c2", "alice", MessageStatus.Running).toJson());
    await fixture.whenStable();

    expect(fixture.nativeElement.textContent).toBe("Working 2Idle 0");
    expect([alice?.renders, bob?.renders]).toEqual([(before[0] ?? 0) + 2, before[1]]);
  });
});
