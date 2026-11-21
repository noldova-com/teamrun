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
import { ApprovalStatus, AuthStatus, Approval, EventName, Message, MessageAuthor, MessageStatus, MethodName, PlanUsage, Provider } from "@noldova/teamrun.protocol";

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
  let store: TeammateStatusStoreService;

  const reply = (id: string, chatId: string, teammateId: string | null, status: MessageStatus, startedAt: string | null = earlier): Message =>
    new Message(id, chatId, 1, MessageAuthor.Provider, null, status, [], SampleData.provenance, earlier, status === MessageStatus.Pending ? null : startedAt,
      [MessageStatus.Pending, MessageStatus.Running, MessageStatus.AwaitingApproval].includes(status) ? null : later, [], teammateId, teammateId);
  const approval = (messageId: string, status: ApprovalStatus): Approval => new Approval("ap1", messageId, SampleData.approval.kind, "exec", "run tests", null,
    SampleData.approval.options, status, status === ApprovalStatus.Pending ? null : "yes", earlier, status === ApprovalStatus.Pending ? null : later);
  const plan = (usedUp: boolean): PlanUsage => new PlanUsage("codex", "a1", [], later, null, usedUp);
  const provider = (authStatus: AuthStatus, kind: string = "codex", enabled: boolean = true): Provider =>
    new Provider("a1", kind, "Work", "D:\\profiles\\codex", authStatus, null, "1.0", earlier, null, later, enabled);
  const statuses = (): readonly TeammateStatus[] => ["alice", "bob"].map(t => store.statusOf(t)());

  const create = async (): Promise<void> => {
    context = SampleData.createContext().answer(MethodName.MessageListOpen, () => open.map(t => t.toJson()));
    new TeammateFixture(context);
    const chats = ChatStoreService.of(context);
    store = TeammateStatusStoreService.of(context);
    await Wait.until(() => expect(chats.teammates()).toHaveLength(3));
    await Wait.until(() => expect(chats.providers()).toHaveLength(1));
  };

  beforeEach(() => {
    open = [];
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
