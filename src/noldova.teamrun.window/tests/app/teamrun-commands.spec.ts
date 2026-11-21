/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { windowPart } from "@noldova/browser.window";
import type { CommandContribution } from "@noldova/desktop.window";
import {
  AuthStatus,
  Conversation,
  ConversationIdParams,
  ConversationListParams,
  ConversationResponder,
  ConversationResponderParams,
  ConversationMember,
  ConversationMemberParams,
  DataFolder,
  ErrorCode,
  EventName,
  Harness,
  MessageStatus,
  MethodName,
  Project,
  Provider,
  ProviderEnabledParams,
  RequestedSettings,
  Teammate
} from "@noldova/teamrun.protocol";

import { ChatAction } from "../../src/app/enums/chat-action";
import { ComposerSettings } from "../../src/app/models/composer-settings";
import { BrowserAvailability } from "../../src/app/services/browser-availability";
import { ChatStoreService } from "../../src/app/services/chat-store.service";
import { ConversationActions } from "../../src/app/services/conversation-actions";
import { CommandTargetsService } from "../../src/app/services/command-targets.service";
import { TeamRunCommands } from "../../src/app/teamrun-commands";
import { Resources } from "../../src/resources";
import { BrowserPartContext } from "../fixtures/browser-part-context.fixture";
import { DeferredResponse } from "../fixtures/deferred-response.fixture";
import { FakeWindowPartContext } from "../fixtures/fake-window-part-context.fixture";
import { SampleData } from "../fixtures/sample-data.fixture";
import { Wait } from "../fixtures/wait.fixture";

describe("TeamRun's commands", () => {
  const older = new Conversation("c2", "p1", "Second", "2026-09-09T08:00:00.000Z", "2026-09-09T08:00:00.000Z");
  let context: FakeWindowPartContext;
  let store: ChatStoreService;

  const command = (name: string): CommandContribution => {
    const found = TeamRunCommands.of(context).find(t => t.name === name);
    if (Object.isUndefined(found))
      throw new Error(`TeamRun has no command ${name}.`);
    return found;
  };
  const load = async (configure: (context: FakeWindowPartContext) => void = () => undefined): Promise<void> => {
    context = SampleData.createContext();
    configure(context);
    store = ChatStoreService.of(context);
    await Wait.until(() => expect(store.loaded()).toBe(true));
    await Wait.until(() => expect(store.isBusy()).toBe(false));
  };
  const withConversations = (t: FakeWindowPartContext): void => {
    t.answer(MethodName.ConversationList, u => ConversationListParams.fromJson(u).projectId === "p1" ? [SampleData.conversation.toJson(), older.toJson()] : []);
  };

  afterEach(() => {
    ChatStoreService.release(context);
  });

  describe("bringing forward an empty chat for a teammate it adds", () => {
    const pilot = new Teammate("pilot", "Pilot", null, "copilot-1", Harness.Provider, null, null, "t", "t");
    const providerOf = (id: string, kind: string, enabled: boolean): Provider =>
      new Provider(id, kind, "Work", `D:\\profiles\\${kind}`, AuthStatus.LoggedIn, null, null, null, null, SampleData.timestamp, enabled);
    const keptOf = async (responder: ConversationResponder | null, providers: readonly Provider[]): Promise<ConversationResponderParams[]> => {
      const empty = new Conversation("c9", null, Resources.newConversationTitle, SampleData.timestamp, SampleData.timestamp).withResponder(responder);
      const members: ConversationMember[] = [];
      await load(t => t.answer(MethodName.ConversationList, u => Object.isNull(ConversationListParams.fromJson(u).projectId) ? [empty.toJson()] : [])
        .answer(MethodName.ConversationListEmpty, u => Object.isNull(ConversationListParams.fromJson(u).projectId) ? [empty.toJson()] : [])
        .answer(MethodName.ConversationTouch, () => SampleData.touched(empty).toJson())
        .answer(MethodName.ProviderList, () => providers.map(u => u.toJson()))
        .answer(MethodName.TeammateList, () => [pilot.toJson()])
        .answer(MethodName.ConversationListMembers, () => members.map(u => u.toJson()))
        .answer(MethodName.ConversationAddMember, () => {
          members.push(new ConversationMember("c9", "pilot", "t", null, false));
          return null;
        }));

      expect((await ConversationActions.start(context, store, null, "pilot"))?.id).toBe("c9");
      expect(context.requests.filter(t => t.method === FakeWindowPartContext.qualify(MethodName.ConversationAddMember)).map(t => t.parameters))
        .toEqual([new ConversationMemberParams("c9", "pilot").toJson()]);
      return context.requests.filter(t => t.method === FakeWindowPartContext.qualify(MethodName.ConversationResponderSet))
        .map(t => ConversationResponderParams.fromJson(t.parameters));
    };

    it("keeps the teammate's provider type as the chat's responder, over the one the empty chat kept", async () => {
      const kept = await keptOf(new ConversationResponder(null, new RequestedSettings("claude", null, null), null),
        [providerOf("claude-1", "claude", true), providerOf("copilot-1", "copilot", true)]);

      expect(kept).toEqual([new ConversationResponderParams("c9", new ComposerSettings("copilot", null, null, "copilot-1").toResponder())]);
    });

    it("keeps no responder for a chat that kept none while no provider is enabled", async () => {
      expect(await keptOf(null, [providerOf("copilot-1", "copilot", false)])).toEqual([]);
    });
  });

  it("starts a conversation in the selected project, opens it and keeps it open", async () => {
    const created = new Conversation("c9", "p1", Resources.newConversationTitle, SampleData.timestamp, SampleData.timestamp);
    await load(t => t.answer(MethodName.ConversationCreate, () => created.toJson()));
    const newConversation = command(Resources.newConversationCommand);
    expect(newConversation.isEnabled(null)).toBe(true);

    await expect(newConversation.runAsync(null)).resolves.toBeNull();

    expect(context.parametersOf(MethodName.ConversationCreate)).toEqual({ projectId: "p1", title: null, teammateId: null });
    expect(context.openedDocuments).toEqual([{ name: "teamrun.conversation", instance: "c9", title: created.title, options: { preview: true, breadcrumb: ["repo"] } }]);
    expect(context.keptDocuments).toEqual([{ name: "teamrun.conversation", instance: "c9" }]);
  });

  it("brings the project's empty new chat to the front and focuses its composer instead of starting another, also when run again before the composer shows", async () => {
    const created = new Conversation("c9", "p1", Resources.newConversationTitle, SampleData.timestamp, SampleData.timestamp);
    await load(t => SampleData.keepCreatedEmpty(t, () => created));
    const newConversation = command(Resources.newConversationCommand);
    let focused = 0;

    await newConversation.runAsync(null);
    await newConversation.runAsync(null);
    CommandTargetsService.of(context).provideComposer("c9", () => focused++, () => true);
    await Wait.until(() => expect(focused).toBe(1));
    await newConversation.runAsync(null);

    expect([context.count(MethodName.ConversationCreate), focused]).toEqual([1, 2]);
    expect(context.openedDocuments.map(t => t.instance)).toEqual(["c9", "c9", "c9"]);
    expect(context.keptDocuments.map(t => t.instance)).toEqual(["c9", "c9", "c9"]);
  });

  it("starts another chat once the open one has something sent or in its composer, and when its members can't be read starts none and shows why", async () => {
    await load(t => SampleData.keepCreatedEmpty(t, () => new Conversation(`c${8 + context.count(MethodName.ConversationCreate)}`, "p1", Resources.newConversationTitle,
      SampleData.timestamp, SampleData.timestamp)));
    const newConversation = command(Resources.newConversationCommand);

    await newConversation.runAsync(null);
    CommandTargetsService.of(context).provideComposer("c9", () => undefined, () => false);
    await newConversation.runAsync(null);
    context.fail(MethodName.ConversationListMembers, "Chat is gone");
    await newConversation.runAsync(null);

    expect(context.count(MethodName.ConversationCreate)).toBe(2);
    expect(context.openedDocuments.map(t => t.instance)).toEqual(["c9", "c10"]);
    expect(context.noticeText()).toBe("Chat is gone");
  });

  it("starts one chat for New chat run twice without waiting, the second bringing forward the chat the first started", async () => {
    const created = new Conversation("c9", "p1", Resources.newConversationTitle, SampleData.timestamp, SampleData.timestamp);
    await load(t => SampleData.keepCreatedEmpty(t, () => created));
    const newConversation = command(Resources.newConversationCommand);

    await Promise.all([newConversation.runAsync(null), newConversation.runAsync(null)]);

    expect(context.count(MethodName.ConversationCreate)).toBe(1);
    expect(context.openedDocuments.map(t => t.instance)).toEqual(["c9", "c9"]);
  });

  it("waits for the chat settings writes still on their way before it looks for an empty chat, so a chat whose settings the person just chose starts another", async () => {
    const first = new Conversation("c9", "p1", Resources.newConversationTitle, SampleData.timestamp, SampleData.timestamp);
    const held = new DeferredResponse();
    const chosen = new Set<string>();
    await load(t => SampleData.keepCreatedEmpty(t, () => context.count(MethodName.ConversationCreate) === 1 ? first
      : new Conversation("c10", "p1", Resources.newConversationTitle, SampleData.timestamp, SampleData.timestamp)));
    const newConversation = command(Resources.newConversationCommand);
    await newConversation.runAsync(null);
    context.answer(MethodName.ConversationListEmpty, () => chosen.has(first.id) ? [] : [first.toJson()]);
    context.answer(MethodName.ConversationResponderSet, async t => {
      const params = ConversationResponderParams.fromJson(t);
      if (!params.chosen)
        await held.promise;
      else
        chosen.add(params.conversationId);
      return first.withResponder(params.responder).toJson();
    });

    const kept = store.setResponder(first.id, new ConversationResponder("alice"));
    const picked = store.setResponder(first.id, new ConversationResponder("bob"), true);
    const started = newConversation.runAsync(null);
    await Wait.until(() => expect(context.count(MethodName.ConversationResponderSet)).toBe(1));
    held.resolve(null);
    await Promise.all([kept, picked, started]);

    expect(context.count(MethodName.ConversationCreate)).toBe(2);
    expect(context.openedDocuments.map(t => t.instance)).toEqual(["c9", "c10"]);
  });

  it("brings forward an empty chat the runtime lists although its tab hasn't shown a composer, preferring one whose composer shows, and starts one when it lists none", async () => {
    const created = new Conversation("c9", "p1", Resources.newConversationTitle, SampleData.timestamp, SampleData.timestamp);
    let empty = [SampleData.conversation, older];
    await load(t => {
      withConversations(t);
      t.answer(MethodName.ConversationListEmpty, () => empty.map(u => u.toJson())).answer(MethodName.ConversationCreate, () => created.toJson())
        .answer(MethodName.ConversationTouch, u => SampleData.touched([SampleData.conversation, older].find(v => v.id === ConversationIdParams.fromJson(u).conversationId)!).toJson());
    });
    const newConversation = command(Resources.newConversationCommand);
    let focused = 0;

    await newConversation.runAsync(null);
    CommandTargetsService.of(context).provideComposer("c2", () => focused++, () => true);
    await newConversation.runAsync(null);
    empty = [];
    await newConversation.runAsync(null);

    expect([context.count(MethodName.ConversationCreate), focused]).toEqual([1, 1]);
    expect(context.openedDocuments.map(t => t.instance)).toEqual(["c1", "c2", "c9"]);
    expect(context.parametersOf(MethodName.ConversationListEmpty)).toEqual({ projectId: "p1" });
  });

  it("moves the empty chat it brings forward to the top of the project's newest-first list, as a new chat shows, and opens none when that fails", async () => {
    await load(t => {
      withConversations(t);
      t.answer(MethodName.ConversationListEmpty, () => [older.toJson()]).answer(MethodName.ConversationTouch, () => SampleData.touched(older).toJson());
    });
    const newConversation = command(Resources.newConversationCommand);
    expect(store.newestConversationsOf("p1").map(t => t.id)).toEqual(["c1", "c2"]);

    await newConversation.runAsync(null);
    const moved = store.newestConversationsOf("p1").map(t => t.id);
    context.fail(MethodName.ConversationTouch, "Chat is gone");
    await newConversation.runAsync(null);

    expect([moved, context.parametersOf(MethodName.ConversationTouch), context.openedDocuments.map(t => t.instance), context.noticeText()])
      .toEqual([["c2", "c1"], { chatId: "c2" }, ["c2"], "Chat is gone"]);
  });

  it("starts no chat and shows why when the project's empty chats can't be read", async () => {
    await load(t => t.fail(MethodName.ConversationListEmpty, "Chats can't be read"));

    await command(Resources.newConversationCommand).runAsync(null);

    expect([context.count(MethodName.ConversationCreate), context.openedDocuments.length, context.noticeText()]).toEqual([0, 0, "Chats can't be read"]);
  });

  it("starts a chat without a project while there is no project, asking for no folder", async () => {
    const created = new Conversation("c9", null, Resources.newConversationTitle, SampleData.timestamp, SampleData.timestamp, false, null, null, false, "/data/chats/c9");
    await load(t => t.answer(MethodName.ProjectList, () => []).answer(MethodName.ConversationCreate, () => created.toJson()));
    const newConversation = command(Resources.newConversationCommand);
    expect(newConversation.isEnabled(null)).toBe(true);

    await newConversation.runAsync(null);

    expect(context.folderChoices).toBe(0);
    expect(context.parametersOf(MethodName.ConversationCreate)).toEqual({ projectId: null, title: null, teammateId: null });
    expect(context.openedDocuments).toEqual([{ name: "teamrun.conversation", instance: "c9", title: created.title,
      options: { preview: true, breadcrumb: [Resources.chatsTitle] } }]);
  });

  it("opens the folder the person chooses as a project, and nothing when they cancel", async () => {
    const opened = new Project("p3", "new", "D:\\new", SampleData.timestamp);
    await load(t => t.answer(MethodName.ProjectOpen, () => opened.toJson()));
    const openProject = command(Resources.openProjectCommand);
    expect(openProject.isEnabled(null)).toBe(true);

    await openProject.runAsync(null);
    expect(context.count(MethodName.ProjectOpen)).toBe(0);
    context.chosenFolder = "D:\\new";
    await openProject.runAsync(null);

    expect(context.folderChoices).toBe(2);
    expect(context.parametersOf(MethodName.ProjectOpen)).toEqual({ rootPath: "D:\\new" });
    expect(store.projects().map(t => t.id)).toContain("p3");
  });

  it("opens the window's one search under the Chats filter, with no key of its own", async () => {
    await load();
    const search = command(Resources.searchConversationsCommand);

    await expect(search.runAsync(null)).resolves.toBeNull();

    expect([search.isEnabled(null), search.defaultKey ?? null]).toEqual([true, null]);
    expect(context.ranCommands).toEqual([{ name: "desktop.search", commandArguments: { source: "teamrun.chats" } }]);
  });

  it("shows the selected conversation and focuses its composer, and is offered only while a conversation is selected", async () => {
    await load();
    const focus = command(Resources.focusComposerCommand);
    let focused = 0;
    CommandTargetsService.of(context).provideComposer("c1", () => focused++);
    expect(focus.isEnabled(null)).toBe(false);
    await focus.runAsync(null);
    expect(focused).toBe(0);

    await store.selectConversation("c1");
    expect(focus.isEnabled(null)).toBe(true);
    await focus.runAsync(null);

    expect(focused).toBe(1);
    expect(context.openedDocuments.map(t => [t.instance, t.options])).toEqual([["c1", { preview: true, breadcrumb: ["repo"] }]]);
  });

  it("opens the Browser page of the chat on screen, in its project's workspace, is offered only while a chat shows, and says so when it can't", async () => {
    await load(withConversations);
    const open = command(Resources.openChatPageCommand);
    expect([open.title, open.icon, open.defaultKey?.text]).toEqual(["Open the chat's Browser page", "language", undefined]);
    expect(open.isEnabled(null)).toBe(false);
    await open.runAsync(null);
    expect(context.ranCommands).toEqual([]);

    await store.conversationInView("c1");
    expect(open.isEnabled(null)).toBe(true);
    await open.runAsync(null);
    await Wait.until(() => expect(context.ranCommands).toEqual([{ name: "browser.openPage", commandArguments: { profileKey: "p1", instance: "c1" } }]));
    vi.spyOn(context, "runCommandAsync").mockRejectedValueOnce(new Error("The Browser isn't installed."));
    await open.runAsync(null);
    await Wait.until(() => expect(context.shownNotices(Resources.chatActionFailedNotice).map(t => [t.key, t.title, t.text]))
      .toEqual([[Resources.formatNoticeKey(ChatAction.OpenPage, "c1"), "Couldn't open the page", Resources.chatPageNotShown]]));

    store.conversationOutOfView("c1");
    expect(open.isEnabled(null)).toBe(false);
  });

  it("opens a new Browser tab on an empty page in the links profile each time, with no key, is offered only while the Browser module is on, and says so when it can't", async () => {
    await load();
    const open = command(Resources.openBrowserCommand);
    const listening = context.dependencyListeners.size;
    expect([open.title, open.icon, open.defaultKey?.text, open.isEnabled(null)]).toEqual(["Open browser", "language", undefined, false]);

    context.activeDependencies.add("browser");
    BrowserAvailability.register(context);
    try {
      expect(open.isEnabled(null)).toBe(true);
      await open.runAsync(null);
      await open.runAsync(null);
      expect(context.ranCommands).toEqual([{ name: "browser.openPage", commandArguments: { profileKey: "links" } },
        { name: "browser.openPage", commandArguments: { profileKey: "links" } }]);
      vi.spyOn(context, "runCommandAsync").mockRejectedValueOnce(new Error("The Browser stopped."));
      await open.runAsync(null);
      await Wait.until(() => expect(context.shownNotices(Resources.chatActionFailedNotice).map(t => [t.key, t.title, t.text]))
        .toEqual([[Resources.formatNoticeKey(ChatAction.OpenBrowser, "links"), "Couldn't open the Browser", "The Browser stopped."]]));

      context.changeDependency("browser", false);
      expect(open.isEnabled(null)).toBe(false);
      context.changeDependency("computer-use", true);
      expect(open.isEnabled(null)).toBe(false);
      context.changeDependency("browser", true);
      expect(open.isEnabled(null)).toBe(true);
    }
    finally {
      BrowserAvailability.release(context);
    }

    expect([open.isEnabled(null), context.dependencyListeners.size]).toEqual([false, listening]);
  });

  it("offers Open browser only once the Browser module comes on when it was off as the window part started", async () => {
    await load();
    const open = command(Resources.openBrowserCommand);
    BrowserAvailability.register(context);
    try {
      expect(open.isEnabled(null)).toBe(false);
      context.changeDependency("browser", true);
      expect(open.isEnabled(null)).toBe(true);
    }
    finally {
      BrowserAvailability.release(context);
    }
  });

  it("opens nothing and shows no notice when the command runs while the Browser module is off, as a part's runCommandAsync runs it without asking whether it is enabled", async () => {
    await load();
    const open = command(Resources.openBrowserCommand);
    context.activeDependencies.add("browser");
    BrowserAvailability.register(context);
    try {
      context.changeDependency("browser", false);
      expect(await open.runAsync(null)).toBeNull();
      expect([context.ranCommands, context.shownNotices(Resources.chatActionFailedNotice)]).toEqual([[], []]);

      context.changeDependency("browser", true);
      await open.runAsync(null);
      expect(context.ranCommands).toEqual([{ name: "browser.openPage", commandArguments: { profileKey: "links" } }]);
    }
    finally {
      BrowserAvailability.release(context);
    }
  });

  it("opens the Browser with arguments the Browser's own command takes", async () => {
    await load();
    const browser = new BrowserPartContext();
    await windowPart.activateAsync(browser);
    const openPage = browser.commands.find(t => t.name === "browser.openPage");
    context.activeDependencies.add("browser");
    BrowserAvailability.register(context);
    try {
      await command(Resources.openBrowserCommand).runAsync(null);
    }
    finally {
      BrowserAvailability.release(context);
      await windowPart.deactivateAsync();
    }

    expect(context.ranCommands.map(t => openPage?.isApplicable(t.commandArguments ?? null))).toEqual([true]);
  });

  it("opens the selected conversation when it shows no composer yet, and focuses its composer once it appears, as the earlier app did", async () => {
    await load();
    let focused = 0;
    await store.selectConversation("c1");

    await command(Resources.focusComposerCommand).runAsync(null);
    expect(context.openedDocuments.map(t => [t.instance, t.options])).toEqual([["c1", { preview: true, breadcrumb: ["repo"] }]]);
    CommandTargetsService.of(context).provideComposer("c1", () => focused++);

    await Wait.until(() => expect(focused).toBe(1));
  });

  it("stops the selected conversation's running reply, and is offered only while one runs", async () => {
    await load(t => t.answer(MethodName.MessageListOpen, () => [SampleData.reply.toJson()])
      .answer(MethodName.ConversationCancel, () => [SampleData.withStatus(SampleData.reply, MessageStatus.Cancelled).toJson()]));
    const stop = command(Resources.stopReplyCommand);
    expect(stop.isEnabled(null)).toBe(false);

    await store.selectConversation("c1");
    expect(stop.isEnabled(null)).toBe(true);
    await stop.runAsync(null);

    expect(context.parametersOf(MethodName.ConversationCancel)).toEqual({ chatId: "c1" });
    expect(stop.isEnabled(null)).toBe(false);
    await stop.runAsync(null);
    expect(context.count(MethodName.ConversationCancel)).toBe(1);
  });

  describe("while an opened project sets aside the chat on screen", () => {
    const elsewhere = new Conversation("c3", "p2", "Elsewhere", SampleData.timestamp, SampleData.timestamp);
    const opening = (chats: readonly Conversation[]): ((t: FakeWindowPartContext) => void) => (t: FakeWindowPartContext): void => {
      t.answer(MethodName.ConversationList, u => {
        const projectId = ConversationListParams.fromJson(u).projectId;
        return projectId === "p1" ? [SampleData.conversation.toJson()] : projectId === "p2" ? chats.map(v => v.toJson()) : [];
      }).answer(MethodName.ProjectOpen, () => SampleData.otherProject.toJson());
    };
    const setAside = async (selected: string | null): Promise<void> => {
      await store.conversationInView("c1");
      await store.openProject(SampleData.otherProject.rootPath);
      await Wait.until(() => expect(store.selectedConversationId()).toBe(selected));
      expect([store.selectedProjectId(), store.shownConversationId(), store.markedConversationId()]).toEqual(["p2", "c1", null]);
    };

    it("stops the running reply of the chat on screen", async () => {
      await load(t => {
        opening([])(t);
        t.answer(MethodName.MessageListOpen, () => [SampleData.reply.toJson()])
          .answer(MethodName.ConversationCancel, () => [SampleData.withStatus(SampleData.reply, MessageStatus.Cancelled).toJson()]);
      });
      const stop = command(Resources.stopReplyCommand);
      await setAside(null);

      expect(stop.isEnabled(null)).toBe(true);
      await stop.runAsync(null);

      expect(context.parametersOf(MethodName.ConversationCancel)).toEqual({ chatId: "c1" });
    });

    it("shows and focuses the composer of the chat on screen, not the opened project's first chat it selects", async () => {
      await load(opening([elsewhere]));
      const focus = command(Resources.focusComposerCommand);
      const focused: string[] = [];
      for (const id of ["c1", "c3"])
        CommandTargetsService.of(context).provideComposer(id, () => focused.push(id));
      await setAside("c3");

      expect(focus.isEnabled(null)).toBe(true);
      await focus.runAsync(null);

      expect([focused, context.openedDocuments.map(t => t.instance)]).toEqual([["c1"], ["c1"]]);
    });
  });

  it("steps to the next and previous recent conversation and opens each, staying at either end", async () => {
    await load(withConversations);
    const next = command(Resources.nextConversationCommand);
    const previous = command(Resources.previousConversationCommand);
    const opened = (): string[] => context.openedDocuments.map(t => t.instance);
    expect([next.isEnabled(null), previous.isEnabled(null)]).toEqual([true, true]);

    await next.runAsync(null);
    expect(store.selectedConversationId()).toBe("c1");
    await next.runAsync(null);
    expect(store.selectedConversationId()).toBe("c2");
    await next.runAsync(null);
    await previous.runAsync(null);

    expect(store.selectedConversationId()).toBe("c1");
    expect(opened()).toEqual(["c1", "c2", "c2", "c1"]);
    expect(context.openedDocuments[1]?.options).toEqual({ preview: true, breadcrumb: ["repo"] });
  });

  it("moves the focused row up or down through the row mover the Projects view provides, enabled only while it has a row to move", async () => {
    await load();
    const up = command(Resources.moveRowUpCommand);
    const down = command(Resources.moveRowDownCommand);
    const targets = CommandTargetsService.of(context);
    const steps: number[] = [];
    let hasRow = false;

    expect([up.title, up.icon, up.defaultKey?.text, down.title, down.icon, down.defaultKey?.text])
      .toEqual(["Move row up", "arrow_upward", "Mod+Shift+ArrowUp", "Move row down", "arrow_downward", "Mod+Shift+ArrowDown"]);
    expect([up.isEnabled(null), down.isEnabled(null)]).toEqual([false, false]);
    await down.runAsync(null);
    const earlier = targets.provideRowMover(() => true, t => steps.push(t * 10));
    const later = targets.provideRowMover(() => hasRow, t => steps.push(t));
    expect(up.isEnabled(null)).toBe(false);
    hasRow = true;
    expect([up.isEnabled(null), down.isEnabled(null)]).toEqual([true, true]);
    await up.runAsync(null);
    await down.runAsync(null);
    earlier();
    expect(up.isEnabled(null)).toBe(true);
    later();

    expect([steps, up.isEnabled(null)]).toEqual([[-1, 1], false]);
  });

  it("steps twice for two quick presses made before the first conversation loads, and opens only where the steps end", async () => {
    const first = new DeferredResponse();
    let pages = 0;
    await load(t => {
      withConversations(t);
      t.answer(MethodName.MessagePage, () => ++pages === 1 ? first.promise : SampleData.page([], false, false).toJson());
    });
    const next = command(Resources.nextConversationCommand);

    const pressed = next.runAsync(null);
    await next.runAsync(null);
    first.resolve(SampleData.page([], false, false).toJson());
    await pressed;

    expect(store.selectedConversationId()).toBe("c2");
    expect(context.openedDocuments.map(t => t.instance)).toEqual(["c2"]);
  });

  it("opens Teammates as one tab and asks it for the default teammate's dialog", async () => {
    await load();
    const choose = command(Resources.chooseDefaultTeammateCommand);
    expect([choose.title, choose.icon, choose.defaultKey, choose.isEnabled(null)]).toEqual(["Choose default teammate", "group", null, true]);

    await expect(choose.runAsync(null)).resolves.toBeNull();

    expect(store.defaultTeammateAsked()).toBe(true);
    expect(context.openedDocuments).toEqual([{ name: "teamrun.teammates", instance: "teammates", title: "Teammates", options: undefined }]);
  });

  it("shows TeamRun's database file, selected, in the system's file manager, at the path TeamRun's runtime gives", async () => {
    const folder = new DataFolder("/data/modules/teamrun", "/data/modules/teamrun/teamrun.sqlite");
    await load(t => t.answer(MethodName.DataFolderRead, () => folder.toJson()));
    const show = command(Resources.showDataFolderCommand);
    expect(show.isEnabled(null)).toBe(true);

    await expect(show.runAsync(null)).resolves.toBeNull();

    expect(context.count(MethodName.DataFolderRead)).toBe(1);
    expect(context.shownInFolder).toEqual(["/data/modules/teamrun/teamrun.sqlite"]);
  });

  it("fails with the runtime's reason and shows nothing when the folder can't be read, and with the file manager's when it can't show the file", async () => {
    const folder = new DataFolder("/data/modules/teamrun", "/data/modules/teamrun/teamrun.sqlite");
    await load(t => t.fail(MethodName.DataFolderRead, "The runtime is gone."));
    const show = command(Resources.showDataFolderCommand);

    await expect(show.runAsync(null)).rejects.toThrow("The runtime is gone.");
    expect(context.shownInFolder).toEqual([]);
    context.answer(MethodName.DataFolderRead, () => folder.toJson());
    context.showInFolderFailure = "The file is missing.";
    await expect(show.runAsync(null)).rejects.toThrow("The file is missing.");

    expect(context.shownInFolder).toEqual(["/data/modules/teamrun/teamrun.sqlite"]);
  });

  it("offers no stepping while there are no conversations, and opens nothing if run anyway", async () => {
    await load(t => t.answer(MethodName.ConversationList, () => []));
    const next = command(Resources.nextConversationCommand);

    expect(next.isEnabled(null)).toBe(false);
    await next.runAsync(null);
    expect(context.openedDocuments).toEqual([]);
  });
  it("opens the chat a notice names, under its project, or as Untitled when the window doesn't list it, and nothing for a deleted chat", async () => {
    await load(withConversations);
    const open = command(Resources.openChatCommand);

    await open.runAsync({ [Resources.chatIdArgument]: "c2" });
    await open.runAsync({ [Resources.chatIdArgument]: "c7" });
    context.emit(EventName.ConversationDeleted, new ConversationIdParams("c2").toJson());
    await open.runAsync({ [Resources.chatIdArgument]: "c2" });

    expect(context.openedDocuments).toEqual([{ name: "teamrun.conversation", instance: "c2", title: older.title, options: { breadcrumb: ["repo"] } },
      { name: "teamrun.conversation", instance: "c7", title: Resources.untitledConversation, options: { breadcrumb: [] } }]);
  });

  it("opens the chat a notice an earlier version posted names as conversationId, and the chatId over it", async () => {
    await load(withConversations);
    const open = command(Resources.openChatCommand);

    expect(open.isEnabled({ conversationId: "c2" })).toBe(true);
    await open.runAsync({ conversationId: "c2" });
    await open.runAsync({ chatId: "c7", conversationId: "c2" });

    expect(context.openedDocuments.map(t => t.instance)).toEqual(["c2", "c7"]);
  });

  it("offers Open chat and Enable provider only with their id as text, and does nothing when run without one", async () => {
    await load(withConversations);
    const open = command(Resources.openChatCommand);
    const enable = command(Resources.enableProviderCommand);
    const refused = [null, "c2", ["c2"], { [Resources.chatIdArgument]: 2 }, { [Resources.chatIdArgument]: " " }, { [Resources.legacyChatIdArgument]: " " }, {}];

    expect(refused.map(t => open.isEnabled(t))).toEqual(refused.map(() => false));
    expect([open.isEnabled({ [Resources.chatIdArgument]: "c2" }), enable.isEnabled({ [Resources.providerIdArgument]: "codex-work" }),
      enable.isEnabled({ [Resources.chatIdArgument]: "codex-work" })]).toEqual([true, true, false]);
    await open.runAsync(null);
    await enable.runAsync(null);

    expect([context.openedDocuments, context.count(MethodName.ProviderSetEnabled)]).toEqual([[], 0]);
  });

  it("enables the provider a notice names, and shows why when it can't", async () => {
    await load(t => t.answer(MethodName.ProviderSetEnabled, u => SampleData.provider.withEnabled(ProviderEnabledParams.fromJson(u).enabled).toJson()));
    const enable = command(Resources.enableProviderCommand);

    await enable.runAsync({ [Resources.providerIdArgument]: SampleData.provider.id });
    expect(context.parametersOf(MethodName.ProviderSetEnabled)).toEqual({ providerId: SampleData.provider.id, enabled: true });
    context.fail(MethodName.ProviderSetEnabled, "The provider is gone.");
    await enable.runAsync({ [Resources.providerIdArgument]: SampleData.provider.id });

    expect(context.shownNotices(Resources.chatActionFailedNotice).map(t => [t.key, t.title, t.text]))
      .toEqual([[Resources.formatNoticeKey(ChatAction.EnableProvider, SampleData.provider.id), "Couldn't enable Work", "The provider is gone."]]);
  });

  it("offers Try again only while a load has failed, and loads it again", async () => {
    await load(t => t.fail(MethodName.ProviderToolList, "offline"));
    const reload = command(Resources.reloadCommand);
    expect(reload.isEnabled(null)).toBe(false);

    await store.refreshTools();
    expect(reload.isEnabled(null)).toBe(true);
    context.answer(MethodName.ProviderToolList, () => []);
    await reload.runAsync(null);

    expect([reload.isEnabled(null), context.shownNotices(Resources.loadFailedNotice)]).toEqual([false, []]);
  });

  it("loads again from Try again of this window's notice, and passes Try again of another window's notice to that window", async () => {
    await load(t => t.fail(MethodName.ProviderToolList, "offline"));
    const reload = command(Resources.reloadCommand);
    await store.refreshTools();
    const [notice] = context.shownNotices(Resources.loadFailedNotice);
    const tryAgain = notice?.actions[0]?.command;
    context.answer(MethodName.ProviderToolList, () => []);
    context.answer(MethodName.WindowReload, () => null);

    expect([reload.isEnabled({ [Resources.windowIdArgument]: "w2" }), tryAgain?.commandArguments])
      .toEqual([true, { [Resources.windowIdArgument]: store.windowId, [Resources.noticeKeyArgument]: Resources.formatNoticeKey(store.windowId, Resources.toolsLoad) }]);
    await reload.runAsync({ [Resources.windowIdArgument]: "w2" });
    expect([context.parametersOf(MethodName.WindowReload), context.shownNotices(Resources.loadFailedNotice).length]).toEqual([{ windowId: "w2" }, 1]);
    await reload.runAsync(tryAgain?.commandArguments ?? null);

    expect([reload.isEnabled(null), context.shownNotices(Resources.loadFailedNotice)]).toEqual([false, []]);
  });

  it("passes the notice a Try again names, so one for a closed window says so in its place", async () => {
    await load(t => t.refuse(MethodName.WindowReload, ErrorCode.NotFound, "The window is closed.", "w2"));
    const reload = command(Resources.reloadCommand);

    await reload.runAsync({ [Resources.windowIdArgument]: "w2", [Resources.noticeKeyArgument]: "w2/tools" });

    expect(context.shownNotices(Resources.loadFailedNotice).map(t => [t.key, t.title])).toEqual([["w2/tools", Resources.windowClosedTitle]]);
  });
});
