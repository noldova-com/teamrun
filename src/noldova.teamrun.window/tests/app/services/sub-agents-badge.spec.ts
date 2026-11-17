/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import "@noldova/context.core";
import type { JsonValue } from "@noldova/context.json";
import {
  ConversationRewoundPayload,
  DetailEventPayload,
  DetailKind,
  EventName,
  Message,
  MessageAuthor,
  MessageDetail,
  MessagePageParams,
  MessageStatus,
  MethodName,
  ReplyPage,
  ReplyPanel,
  ReplySummary,
  SubAgent,
  SubAgentStatus
} from "@noldova/teamrun.protocol";

import { ChatStoreService } from "../../../src/app/services/chat-store.service";
import { SubAgentsBadge } from "../../../src/app/services/sub-agents-badge";
import { Resources } from "../../../src/resources";
import { DeferredResponse } from "../../fixtures/deferred-response.fixture";
import type { FakeWindowPartContext } from "../../fixtures/fake-window-part-context.fixture";
import { SampleData } from "../../fixtures/sample-data.fixture";
import { Wait } from "../../fixtures/wait.fixture";

describe("SubAgentsBadge", () => {
  const agent = (sequence: number, value: SubAgent, parentSequence: number | null = null): MessageDetail =>
    new MessageDetail(sequence, DetailKind.SubAgent, value.description, value.toJson(), SampleData.timestamp, parentSequence);
  const reply = (id: string, sequence: number, status: MessageStatus, details: readonly MessageDetail[]): Message =>
    new Message(id, SampleData.conversation.id, sequence, MessageAuthor.Provider, null, status, details, SampleData.provenance, SampleData.timestamp,
      SampleData.timestamp, status === MessageStatus.Running ? null : SampleData.timestamp, []);
  const finding = new SubAgent("t1", "Explore", "Find where plans are stored", null, SubAgentStatus.Running, false);
  const checking = new SubAgent("t2", null, "Check the release workflow's inputs", null, SubAgentStatus.Running, true);
  const drafting = new SubAgent("t3", null, "Draft the release notes", null, SubAgentStatus.Stopped, false);
  const reviewing = new SubAgent("t4", "Explore", "Review the composer's focus code", null, SubAgentStatus.Completed, false);
  const mapping = new SubAgent("t7", "Explore", "Map the settings pages", null, SubAgentStatus.Running, false);
  const nested = new SubAgent("t6", "Explore", "Read the nested part", null, SubAgentStatus.Running, false);

  let context: FakeWindowPartContext;
  let store: ChatStoreService;
  let replies: Message[];
  let size: number;
  let hold: DeferredResponse | null;

  const page = async (parameters: JsonValue): Promise<JsonValue> => {
    await hold?.promise;
    const params = MessagePageParams.fromJson(parameters);
    const matching = replies.filter(t => t.conversationId === params.chatId).map(t => ReplySummary.fromMessage(t)).filter(t => t.matches(ReplyPanel.SubAgents))
      .toSorted((a, b) => b.preview.sequence - a.preview.sequence).filter(t => Object.isNull(params.beforeSequence) || t.preview.sequence < params.beforeSequence);
    return new ReplyPage(matching.slice(0, size), matching.length > size, false).toJson();
  };
  const pages = (): number => context.requests.filter(t => t.method === Resources.formatQualifiedName(MethodName.MessageSubAgentsPage)).length;
  const badge = (): string | null => {
    const value = context.badges.get(Resources.subAgentsViewName);
    return Object.isNullOrUndefined(value) ? null : `${value.count} ${value.description}`;
  };
  const running = (count: number): string => `${count} ${Resources.formatRunningSubAgents(count)}`;
  const update = (index: number, message: Message, detail: number): void => {
    replies[index] = message;
    context.emit(EventName.DetailUpdated, new DetailEventPayload(message.id, message.details[detail] as MessageDetail).toJson());
  };
  const create = async (): Promise<void> => {
    context = SampleData.createContext().answer(MethodName.MessageSubAgentsPage, page);
    store = ChatStoreService.of(context);
    await Wait.until(() => expect(store.loaded()).toBe(true));
    SubAgentsBadge.register(context, store);
    await store.conversationInView(SampleData.conversation.id);
  };

  beforeEach(() => {
    size = Resources.replyPageSize;
    hold = null;
    replies = [
      reply("r1", 1, MessageStatus.Completed, [agent(0, reviewing), agent(1, nested, 0)]),
      reply("r2", 3, MessageStatus.Completed, [SampleData.detail(0, DetailKind.Text, "No sub-agents here."),
        new MessageDetail(1, DetailKind.SubAgent, "Unreadable", { status: 5 }, SampleData.timestamp)]),
      reply("r3", 5, MessageStatus.Running, [agent(0, finding), agent(1, checking), agent(2, drafting)])
    ];
  });

  afterEach(() => {
    SubAgentsBadge.release(context);
    ChatStoreService.release(context);
  });

  it("counts a sub-agent that starts while the Sub-agents view was never opened", async () => {
    replies = [replies[0] as Message];
    await create();
    await Wait.until(() => expect(pages()).toBe(1));
    expect(badge()).toBeNull();

    const started = reply("r4", 7, MessageStatus.Running, [agent(0, finding)]);
    context.emit(EventName.MessageCreated, reply("r4", 7, MessageStatus.Running, []).toJson());
    context.emit(EventName.DetailAppended, new DetailEventPayload("r4", started.details[0] as MessageDetail).toJson());

    expect(badge()).toBe(running(1));
  });

  it("counts the shown chat's running sub-agents on every page, and none a sub-agent started itself or one it can't read", async () => {
    size = 1;
    await create();

    await Wait.until(() => expect(badge()).toBe(running(2)));
    expect(pages()).toBe(3);
  });

  it("lowers the count as each one ends, and takes the badge away once none runs", async () => {
    await create();
    await Wait.until(() => expect(badge()).toBe(running(2)));

    update(2, reply("r3", 5, MessageStatus.Running, [agent(0, finding.with({ status: SubAgentStatus.Completed })), agent(1, checking), agent(2, drafting)]), 0);
    expect(badge()).toBe(running(1));
    update(2, reply("r3", 5, MessageStatus.Completed, [agent(0, finding.with({ status: SubAgentStatus.Completed })),
      agent(1, checking.with({ status: SubAgentStatus.Stopped })), agent(2, drafting)]), 1);
    expect(badge()).toBeNull();
  });

  it("leaves out a detail that isn't a sub-agent, and a sub-agent another one started", async () => {
    await create();
    await Wait.until(() => expect(badge()).toBe(running(2)));

    context.emit(EventName.DetailAppended, new DetailEventPayload("r3", SampleData.detail(3, DetailKind.Text, "Still working.")).toJson());
    context.emit(EventName.DetailAppended, new DetailEventPayload("r3", agent(4, nested, 0)).toJson());

    expect(badge()).toBe(running(2));
  });

  it("leaves out a sub-agent of a reply in another chat, and reads nothing again when another chat is rewound", async () => {
    await create();
    await Wait.until(() => expect(badge()).toBe(running(2)));
    const read = pages();

    context.emit(EventName.MessageCreated, new Message("x1", "another-chat", 1, MessageAuthor.Provider, null, MessageStatus.Running, [], SampleData.provenance,
      SampleData.timestamp, SampleData.timestamp, null, []).toJson());
    context.emit(EventName.DetailAppended, new DetailEventPayload("x1", agent(0, finding)).toJson());
    context.emit(EventName.DetailAppended, new DetailEventPayload("x2", agent(0, checking)).toJson());
    context.emit(EventName.ConversationRewound, new ConversationRewoundPayload("another-chat", 1).toJson());

    expect(badge()).toBe(running(2));
    expect(pages()).toBe(read);
  });

  it.each([
    { cause: "the runtime asks for a resync", resync: (): void => context.emit(EventName.StateResyncRequested, null) },
    { cause: "the window reconnects", resync: (): void => SubAgentsBadge.reload(context) },
    { cause: "the chat is rewound", resync: (): void => context.emit(EventName.ConversationRewound, new ConversationRewoundPayload(SampleData.conversation.id, 4).toJson()) }
  ])("reads the chat's pages again after $cause, so the sub-agents a restart stopped leave the badge", async ({ resync }) => {
    await create();
    await Wait.until(() => expect(badge()).toBe(running(2)));
    const read = pages();
    replies[2] = reply("r3", 5, MessageStatus.Completed, [agent(0, finding.with({ status: SubAgentStatus.Stopped })),
      agent(1, checking.with({ status: SubAgentStatus.Stopped })), agent(2, drafting)]);

    resync();

    await Wait.until(() => expect(badge()).toBeNull());
    expect(pages()).toBeGreaterThan(read);
  });

  it("drops the sub-agents of a reply a rewind took away", async () => {
    await create();
    await Wait.until(() => expect(badge()).toBe(running(2)));
    replies = replies.slice(0, 2);

    context.emit(EventName.ConversationRewound, new ConversationRewoundPayload(SampleData.conversation.id, 4).toJson());

    await Wait.until(() => expect(badge()).toBeNull());
  });

  it("stops reading a chat's pages once another chat is shown, and reads the shown one whole", async () => {
    size = 1;
    await create();
    await Wait.until(() => expect(badge()).toBe(running(2)));
    const answer = new DeferredResponse();
    hold = answer;
    const read = pages();

    context.emit(EventName.StateResyncRequested, null);
    await Wait.until(() => expect(pages()).toBe(read + 1));
    store.conversationOutOfView(SampleData.conversation.id);
    hold = null;
    answer.resolve(null);
    await store.conversationInView(SampleData.conversation.id);

    await Wait.until(() => expect(badge()).toBe(running(2)));
    expect(pages()).toBe(read + 4);
  });

  it("keeps a sub-agent's news that comes while the pages are read over the older page", async () => {
    await create();
    await Wait.until(() => expect(badge()).toBe(running(2)));
    const answer = new DeferredResponse();
    hold = answer;
    const read = pages();
    replies[2] = reply("r3", 5, MessageStatus.Running, [agent(0, finding), agent(1, checking), agent(2, drafting), agent(3, mapping)]);

    context.emit(EventName.StateResyncRequested, null);
    await Wait.until(() => expect(pages()).toBe(read + 1));
    context.emit(EventName.DetailUpdated, new DetailEventPayload("r3", agent(0, finding.with({ status: SubAgentStatus.Completed }))).toJson());
    expect(badge()).toBe(running(1));
    answer.resolve(null);

    await Wait.until(() => expect(badge()).toBe(running(2)));
  });

  it("takes the badge away while no chat is shown, and counts the chat again once it is", async () => {
    await create();
    await Wait.until(() => expect(badge()).toBe(running(2)));

    store.conversationOutOfView(SampleData.conversation.id);
    expect(badge()).toBeNull();
    await store.conversationInView(SampleData.conversation.id);
    await Wait.until(() => expect(badge()).toBe(running(2)));
  });

  it("sets no badge when the chat's pages can't be read, and counts once they can", async () => {
    context = SampleData.createContext().fail(MethodName.MessageSubAgentsPage, "The runtime is restarting.");
    store = ChatStoreService.of(context);
    await Wait.until(() => expect(store.loaded()).toBe(true));
    SubAgentsBadge.register(context, store);
    await store.conversationInView(SampleData.conversation.id);
    await Wait.until(() => expect(pages()).toBe(1));
    expect(badge()).toBeNull();

    context.answer(MethodName.MessageSubAgentsPage, page);
    SubAgentsBadge.reload(context);

    await Wait.until(() => expect(badge()).toBe(running(2)));
  });

  it("takes the badge away and stops counting when released", async () => {
    await create();
    await Wait.until(() => expect(badge()).toBe(running(2)));

    SubAgentsBadge.release(context);
    expect(context.badges.get(Resources.subAgentsViewName)).toBeNull();
    context.emit(EventName.DetailAppended, new DetailEventPayload("r3", agent(3, finding)).toJson());

    expect(context.badges.get(Resources.subAgentsViewName)).toBeNull();
  });
});
