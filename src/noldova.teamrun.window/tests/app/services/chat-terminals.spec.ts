/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { EnvironmentInjector } from "@angular/core";
import { TestBed } from "@angular/core/testing";

import { CommandRun, type NotificationPost, QualifiedName } from "@noldova/desktop.protocol";
import { Conversation, ConversationIdParams, EventName, MethodName, RunOutput } from "@noldova/teamrun.protocol";
import {
  OwnersProvidedException, RunArgumentRefusedException, RunShellKindsMissingException, TerminalOwners, TerminalRunBusy, TerminalRunNotTypedException, TerminalRunOutcome,
  TerminalShellKind
} from "@noldova/terminal.window";
import { ShellRun } from "@noldova/ui.components.angular";

import { Resources } from "../../../src/resources";
import { ChatAction } from "../../../src/app/enums/chat-action";
import { ChatStoreService } from "../../../src/app/services/chat-store.service";
import type { ITerminalRunner } from "../../../src/app/interfaces/i-terminal-runner";
import { ChatTerminals } from "../../../src/app/services/chat-terminals";
import { InlineTerminals } from "../../../src/app/services/inline-terminals";
import { FakeInlineTerminals, FakeRunStarter } from "../../fixtures/fake-inline-terminals.fixture";
import type { FakeWindowPartContext } from "../../fixtures/fake-window-part-context.fixture";
import { SampleData } from "../../fixtures/sample-data.fixture";
import { Wait } from "../../fixtures/wait.fixture";

describe("ChatTerminals", () => {
  const second = new Conversation("c2", "p1", "Second", SampleData.timestamp, SampleData.timestamp);
  const third = new Conversation("c3", "p1", "Third", SampleData.timestamp, SampleData.timestamp);
  const long = new Conversation("c".repeat(250), "p1", "Long", SampleData.timestamp, SampleData.timestamp);
  let context: FakeWindowPartContext;
  let store: ChatStoreService;
  let terminals: ChatTerminals | null;

  const notices = (): readonly NotificationPost[] => context.shownNotices(Resources.chatActionFailedNotice);
  const openChat = (id: string): CommandRun => new CommandRun(QualifiedName.parse(Resources.openChatCommand), { [Resources.chatIdArgument]: id });
  const provide = (): ChatTerminals => {
    terminals = ChatTerminals.provide(context, store);
    return terminals;
  };

  beforeEach(async () => {
    context = SampleData.createContext()
      .answer(MethodName.ConversationList, () => [SampleData.conversation.toJson(), second.toJson(), third.toJson(), long.toJson()]);
    store = new ChatStoreService(context);
    terminals = null;
    await store.initialize();
  });

  afterEach(async () => {
    await terminals?.removeAsync();
    store.dispose();
  });

  it("shows the terminals of the chat on screen, after activation and at each change, and none with no chat on screen", async () => {
    await store.conversationInView("c1");
    provide();
    await Wait.until(() => expect(TerminalOwners.shown).toBe("teamrun.chat/c1"));

    await store.conversationInView("c2");
    await Wait.until(() => expect(TerminalOwners.shown).toBe("teamrun.chat/c2"));
    store.conversationOutOfView("c2");
    await Wait.until(() => expect(TerminalOwners.shown).toBe("teamrun.chat/c1"));
    store.conversationOutOfView("c1");
    await Wait.until(() => expect(TerminalOwners.shown).toBeNull());
  });

  it("only hides a closed chat's terminals, whether one chat or every chat closes, and shows them again when the chat opens again", async () => {
    await store.conversationInView("c1");
    await store.conversationInView("c2");
    provide();
    await Wait.until(() => expect(TerminalOwners.shown).toBe("teamrun.chat/c2"));

    store.conversationOutOfView("c2");
    await Wait.until(() => expect(TerminalOwners.shown).toBe("teamrun.chat/c1"));
    store.conversationOutOfView("c1");
    await Wait.until(() => expect(TerminalOwners.shown).toBeNull());
    await store.conversationInView("c2");

    await Wait.until(() => expect(TerminalOwners.shown).toBe("teamrun.chat/c2"));
    expect(context.methods).not.toContain("terminal.closeOwner");
  });

  it("runs a reply's shell code block of every language it knows in its chat's own terminal, in the chat's folder, with the shells its language names, on any system, since Terminal picks an installed one", async () => {
    const ran: [string, TerminalShellKind[]][] = [["bash", [TerminalShellKind.Bash]], ["Bash", [TerminalShellKind.Bash]], ["sh", [TerminalShellKind.Bash, TerminalShellKind.Zsh]],
      ["SHELL", [TerminalShellKind.Bash, TerminalShellKind.Zsh]], ["zsh", [TerminalShellKind.Zsh]], ["PowerShell", [TerminalShellKind.PowerShell]],
      ["pwsh", [TerminalShellKind.PowerShell]], ["cmd", [TerminalShellKind.CommandPrompt]]];
    const runs: unknown[][] = [];
    const runner: ITerminalRunner = { runAsync: (...parts) => {
      runs.push(parts);
      return Promise.resolve(`session-${runs.length}`);
    } };
    terminals = ChatTerminals.provide(context, store, runner);

    for (const [language] of ran)
      terminals.run("c2", new ShellRun("npm ci\nnpm test", language));

    await Wait.until(() => expect(runs).toHaveLength(ran.length));
    expect(runs).toEqual(ran.map(([, kinds]) => ["teamrun.chat/c2", "npm ci\nnpm test", "D:\\repo", kinds]));
    expect(notices()).toEqual([]);
  });

  it("posts Terminal's refusal of a block whose shells aren't installed, which names them, as a failed chat action with Open chat", async () => {
    const runs: unknown[][] = [];
    const runner: ITerminalRunner = { runAsync: (...parts) => {
      runs.push(parts);
      return Promise.reject(new RunShellKindsMissingException(parts[3]));
    } };
    terminals = ChatTerminals.provide(context, store, runner);

    terminals.run("c2", new ShellRun("ls", "zsh"));
    terminals.run("c3", new ShellRun("ls", "pwsh"));

    await Wait.until(() => expect(notices()).toHaveLength(2));
    expect(runs).toEqual([["teamrun.chat/c2", "ls", "D:\\repo", [TerminalShellKind.Zsh]], ["teamrun.chat/c3", "ls", "D:\\repo", [TerminalShellKind.PowerShell]]]);
    expect(notices().map(t => [t.key, t.title, t.text, t.open])).toEqual([
      [Resources.formatNoticeKey(ChatAction.RunCode, "c2"), Resources.chatActionTitles[ChatAction.RunCode],
        "The commands weren't run, and nothing opened: no shell of the kinds they need is installed (Zsh).", openChat("c2")],
      [Resources.formatNoticeKey(ChatAction.RunCode, "c3"), Resources.chatActionTitles[ChatAction.RunCode],
        "The commands weren't run, and nothing opened: no shell of the kinds they need is installed (PowerShell).", openChat("c3")]]);
  });

  it("starts a block's Run with no tab while Run opens in Chat, the default, and runs it in the Terminals panel once set to it, from the next Run", async () => {
    const runs: string[] = [];
    const panel: ITerminalRunner = { runAsync: () => {
      runs.push("panel");
      return Promise.resolve(`session-${runs.length}`);
    } };
    const starter = new FakeRunStarter();
    starter.sessions = ["s1", "s1"];
    const fakes = new FakeInlineTerminals();
    terminals = ChatTerminals.provide(context, store, panel, () => new InlineTerminals(starter, (sessionId, _injector, rows) => fakes.open(sessionId, rows)));
    const [atFirst, atSecond, atThird] = [0, 1, 2].map(t => ({ messageId: "m1", site: "body", block: t }));

    terminals.run("c1", new ShellRun("ls", "bash", 0), atFirst ?? null);
    await Wait.until(() => expect(terminals?.inlineTerminals?.places().get("teamrun.chat/c1")).toEqual(atFirst));
    context.changeSetting(Resources.runOpensInSetting, "Panel");
    terminals.run("c1", new ShellRun("ls", "bash", 1), atSecond ?? null);
    await Wait.until(() => expect(runs).toHaveLength(1));
    context.changeSetting(Resources.runOpensInSetting, "Chat");
    terminals.run("c1", new ShellRun("ls", "bash", 2), atThird ?? null);

    await Wait.until(() => expect(terminals?.inlineTerminals?.places().get("teamrun.chat/c1")).toEqual(atThird));
    expect([runs, starter.runs.map(t => t[1]), notices(), fakes.opened]).toEqual([["panel"], ["ls", "ls"], [], []]);
  });

  it("posts a failure of the busy question's answer as a failed run of the chat's code, and nothing for a question no Run asked", async () => {
    const starter = new FakeRunStarter();
    starter.sessions = ["s1", new TerminalRunNotTypedException("s1", TerminalRunOutcome.Busy), new TypeError("The runtime stopped.")];
    terminals = ChatTerminals.provide(context, store, null, () => new InlineTerminals(starter, (sessionId, _injector, rows) => new FakeInlineTerminals().open(sessionId, rows)));
    const first = { messageId: "m1", site: "body", block: 0 };
    const second = { messageId: "m1", site: "body", block: 1 };
    terminals.answerBusy("teamrun.chat/c2", true);
    terminals.run("c2", new ShellRun("npm start", "bash", 0), first);
    await Wait.until(() => expect(starter.runs).toHaveLength(1));
    terminals.run("c2", new ShellRun("ls", "bash", 1), second);
    await Wait.until(() => expect(terminals?.inlineTerminals?.isBusyAt("teamrun.chat/c2", second)).toBe(true));
    const quiet = notices().length;

    terminals.answerBusy("teamrun.chat/c2", true);

    await Wait.until(() => expect(notices()).toHaveLength(1));
    expect([quiet, starter.runs.map(t => t.slice(4)), notices().map(t => [t.key, t.text, t.open])]).toEqual([0,
      [[null, null], ["s1", TerminalRunBusy.Refuse], ["s1", TerminalRunBusy.Interrupt]],
      [[Resources.formatNoticeKey(ChatAction.RunCode, "c2"), "The runtime stopped.", openChat("c2")]]]);
  });

  it("sends every Run of a cmd block to Terminal, which opens a new Command Prompt each time until it can tell one is free", async () => {
    const runs: unknown[][] = [];
    const runner: ITerminalRunner = { runAsync: (...parts) => {
      runs.push(parts);
      return Promise.resolve(`session-${runs.length}`);
    } };
    terminals = ChatTerminals.provide(context, store, runner);

    terminals.run("c1", new ShellRun("dir", "cmd"));
    terminals.run("c1", new ShellRun("dir", "cmd"));

    await Wait.until(() => expect(runs).toHaveLength(2));
    expect(runs).toEqual([["teamrun.chat/c1", "dir", "D:\\repo", [TerminalShellKind.CommandPrompt]], ["teamrun.chat/c1", "dir", "D:\\repo", [TerminalShellKind.CommandPrompt]]]);
    expect(notices()).toEqual([]);
  });

  it("posts a code block Terminal can't run as written, or a run it refuses or fails, as a failed chat action with Open chat, and types nothing it refused", async () => {
    const runs: string[] = [];
    const failures: Error[] = [new RunArgumentRefusedException("folder", "The folder is refused."), new TypeError("The runtime stopped.")];
    const messages = failures.map(t => t.message);
    const runner: ITerminalRunner = { runAsync: (_, command) => {
      runs.push(command);
      return Promise.reject(failures.shift());
    } };
    ChatTerminals.provide(context, store, runner);
    terminals = ChatTerminals.of(context);

    terminals?.run("c1", new ShellRun("echo hi\u0007", "bash"));
    terminals?.run("c2", new ShellRun("ls", "bash"));
    terminals?.run("c3", new ShellRun("pwd", "bash"));
    terminals?.run("c4", new ShellRun(" \n ", "bash"));
    terminals?.run("c5", new ShellRun("ls", "fish"));

    await Wait.until(() => expect(notices()).toHaveLength(5));
    expect(notices().map(t => [t.key, t.title, t.text, t.open])).toEqual([
      [Resources.formatNoticeKey(ChatAction.RunCode, "c1"), Resources.chatActionTitles[ChatAction.RunCode], Resources.shellRunRefused, openChat("c1")],
      [Resources.formatNoticeKey(ChatAction.RunCode, "c4"), Resources.chatActionTitles[ChatAction.RunCode], Resources.shellRunEmpty, openChat("c4")],
      [Resources.formatNoticeKey(ChatAction.RunCode, "c5"), Resources.chatActionTitles[ChatAction.RunCode],
        "TeamRun doesn't know which shell runs a code block marked fish, so it didn't run.", openChat("c5")],
      [Resources.formatNoticeKey(ChatAction.RunCode, "c2"), Resources.chatActionTitles[ChatAction.RunCode], messages[0], openChat("c2")],
      [Resources.formatNoticeKey(ChatAction.RunCode, "c3"), Resources.chatActionTitles[ChatAction.RunCode], messages[1], openChat("c3")]]);
    expect(runs).toEqual(["ls", "pwd"]);
  });

  it("is found by its window's context only while provided, removes once, and the window part's runs go through Terminal's own owners", async () => {
    expect(ChatTerminals.of(context)).toBeNull();
    const provided = provide();

    expect(ChatTerminals.of(context)).toBe(provided);
    provided.run("c1", new ShellRun("ls", "bash"));
    await Wait.until(() => expect(notices()).toHaveLength(1));
    expect(notices()[0]!.title).toBe(Resources.chatActionTitles[ChatAction.RunCode]);
    await provided.removeAsync();
    await provided.removeAsync();
    terminals = null;
    expect(ChatTerminals.of(context)).toBeNull();
  });

  it("gives Terminal's own new terminals the chat on screen only while New terminals is This chat", async () => {
    provide();
    const owners = [TerminalOwners.readNewOwner()];

    context.changeSetting(Resources.newTerminalsSetting, "Chat");
    owners.push(TerminalOwners.readNewOwner());
    await store.conversationInView("c1");
    owners.push(TerminalOwners.readNewOwner());
    context.changeSetting(Resources.newTerminalsSetting, "General");
    owners.push(TerminalOwners.readNewOwner());

    expect(owners).toEqual([null, null, "teamrun.chat/c1", null]);
  });

  it("opens a terminal for the chat on screen, in the menu row's tab group when it gives one, whatever New terminals says", async () => {
    const command = provide().command();
    const enabled = [command.isEnabled(null)];
    await command.runAsync(null);

    await store.conversationInView("c1");
    enabled.push(command.isEnabled(null));
    await command.runAsync({ tabGroup: "g1" });
    await command.runAsync(null);
    await command.runAsync({ tabGroup: 7 });

    expect([command.name, command.title, command.icon]).toEqual(["teamrun.newChatTerminal", "New chat terminal", "terminal"]);
    expect(enabled).toEqual([false, true]);
    expect(context.ranCommands).toEqual([
      { name: "terminal.new", commandArguments: { owner: "teamrun.chat/c1", tabGroup: "g1" } },
      { name: "terminal.new", commandArguments: { owner: "teamrun.chat/c1" } },
      { name: "terminal.new", commandArguments: { owner: "teamrun.chat/c1" } }
    ]);
  });

  it("posts a show Terminal refuses as a failed chat action with Open chat, and still shows the next chat", async () => {
    provide();
    await store.conversationInView(long.id);
    await Wait.until(() => expect(notices().map(t => [t.key, t.title, t.open])).toEqual([[Resources.formatNoticeKey(ChatAction.ShowTerminals, store.windowId),
      Resources.chatActionTitles[ChatAction.ShowTerminals], openChat(long.id)]]));
    expect(notices()[0]?.text).not.toBeNull();

    await store.conversationInView("c2");

    expect(notices()).toHaveLength(1);
    await Wait.until(() => expect(TerminalOwners.shown).toBe("teamrun.chat/c2"));
    expect(context.lines).toEqual([]);
  });

  it("closes a deleted chat's terminals through Terminal, whichever window or the CLI deleted it, and posts a close that fails, with no Open chat", async () => {
    const failures: unknown[] = [null, new TypeError("The runtime stopped."), "refused"];
    context.answerModule("terminal.closeOwner", () => {
      const failure = failures.shift();
      if (!Object.isNull(failure))
        throw failure;
      return null;
    });
    provide();

    for (const id of ["c2", "c1", "c3"])
      context.emit(EventName.ConversationDeleted, new ConversationIdParams(id).toJson());

    await Wait.until(() => expect(notices().map(t => [t.key, t.title, t.text, t.open])).toEqual([
      [Resources.formatNoticeKey(ChatAction.CloseTerminals, "c1"), Resources.chatActionTitles[ChatAction.CloseTerminals], "The runtime stopped.", null],
      [Resources.formatNoticeKey(ChatAction.CloseTerminals, "c3"), Resources.chatActionTitles[ChatAction.CloseTerminals], "refused", null]]));
    expect(context.requests.filter(t => t.method === "terminal.closeOwner").map(t => t.parameters)).toEqual([{ owner: "teamrun.chat/c2" },
      { owner: "teamrun.chat/c1" }, { owner: "teamrun.chat/c3" }]);
  });

  it("closes a deleted chat's terminals in a window whose store only watches, which never loads the chats", async () => {
    store.dispose();
    context = SampleData.createContext().answerModule("terminal.closeOwner", () => null);
    store = ChatStoreService.watch(context);
    provide();

    context.emit(EventName.ConversationDeleted, new ConversationIdParams("c9").toJson());

    await Wait.until(() => expect(context.requests.filter(t => t.method === "terminal.closeOwner").map(t => t.parameters))
      .toEqual([{ owner: "teamrun.chat/c9" }]));
    expect(store.loaded()).toBe(false);
  });

  it("hides the chat's terminals once removed, closes no deleted chat's then, and lets the window take another provider, which shows the chat on screen at once", async () => {
    await store.conversationInView("c1");
    const first = provide();
    await Wait.until(() => expect(TerminalOwners.shown).toBe("teamrun.chat/c1"));
    await first.removeAsync();
    const hidden = TerminalOwners.shown;
    context.emit(EventName.ConversationDeleted, new ConversationIdParams("c1").toJson());
    await store.conversationInView("c2");
    provide();

    expect(hidden).toBeNull();
    expect(context.methods).not.toContain("terminal.closeOwner");
    expect(() => ChatTerminals.provide(context, store)).toThrowError(OwnersProvidedException);
    await Wait.until(() => expect(TerminalOwners.shown).toBe("teamrun.chat/c2"));
  });

  it("reads a chat's kept Runs from the runtime when it shows, keeps an earlier Run's output there, and posts a read or a keep that fails or a list that isn't one", async () => {
    const starter = new FakeRunStarter();
    starter.sessions = ["s1", "s1"];
    starter.outputs.set("run-1", FakeRunStarter.outputOf("$ ls"));
    const old = new RunOutput("c2", "m9", "body", 1, FakeRunStarter.outputOf("$ old").toJson());
    context.answer(MethodName.RunOutputList, t => {
      const id = ConversationIdParams.fromJson(t).conversationId;
      if (id === "c3")
        throw new Error("The database is locked.");
      if (id === "c1")
        return "garbled";
      return id === "c2" ? [old.toJson()] : [];
    });
    context.answer(MethodName.RunOutputSave, () => {
      throw new Error("The disk is full.");
    });
    terminals = ChatTerminals.provide(context, store, null,
      (_given, kept) => new InlineTerminals(starter, (sessionId, _injector, rows) => new FakeInlineTerminals().open(sessionId, rows), kept));
    const first = { messageId: "m1", site: "body", block: 0 };

    await store.conversationInView("c2");
    await Wait.until(() => expect(terminals?.inlineTerminals?.outputAt("teamrun.chat/c2", { messageId: "m9", site: "body", block: 1 })?.lines.map(t => t.text))
      .toEqual(["$ old"]));
    terminals.run("c2", new ShellRun("ls", "bash", 0), first);
    await Wait.until(() => expect(starter.runs).toHaveLength(1));
    terminals.run("c2", new ShellRun("pwd", "bash", 1), { messageId: "m1", site: "body", block: 1 });
    await Wait.until(() => expect(notices()).toHaveLength(1));
    await store.conversationInView("c3");
    await Wait.until(() => expect(notices()).toHaveLength(2));
    await store.conversationInView("c1");
    await Wait.until(() => expect(notices()).toHaveLength(3));

    expect([context.requests.filter(t => t.method === Resources.formatQualifiedName(MethodName.RunOutputSave)).map(t => t.parameters),
      notices().map(t => [t.key, t.text])]).toEqual([[new RunOutput("c2", "m1", "body", 0, FakeRunStarter.outputOf("$ ls").toJson()).toJson()],
      [[Resources.formatNoticeKey(ChatAction.KeepRunOutput, "c2"), "The disk is full."], [Resources.formatNoticeKey(ChatAction.ShowRunOutputs, "c3"), "The database is locked."],
      [Resources.formatNoticeKey(ChatAction.ShowRunOutputs, "c1"), Resources.formatListNotArray("string")]]]);
  });

  it("draws only the inline terminal of the chat on screen, closes a deleted chat's, and closes them all once removed", async () => {
    context.answerModule("terminal.closeOwner", () => null);
    const fakes = new FakeInlineTerminals();
    const starter = new FakeRunStarter();
    starter.sessions = ["session-teamrun.chat/c1", "session-teamrun.chat/c2"];
    await store.conversationInView("c1");
    terminals = ChatTerminals.provide(context, store, null, () => new InlineTerminals(starter, (sessionId, _injector, rows) => fakes.open(sessionId, rows)));
    const place = { messageId: "m1", site: "body", block: 0 };
    terminals.run("c1", new ShellRun("ls", "bash"), place);
    terminals.run("c2", new ShellRun("ls", "bash"), place);
    await Wait.until(() => expect(terminals?.inlineTerminals?.places().size).toBe(2));
    const hosts = [document.createElement("div"), document.createElement("div")];
    document.body.append(...hosts);
    onTestFinished(() => {
      for (const host of hosts)
        host.remove();
    });
    for (const [index, id] of ["c1", "c2"].entries())
      terminals.inlineTerminals?.attach(`teamrun.chat/${id}`, place, hosts[index] ?? document.body, TestBed.inject(EnvironmentInjector));
    await store.conversationInView("c2");
    await Wait.until(() => expect(fakes.opened[1]?.events).toContain("shown"));
    context.emit(EventName.ConversationDeleted, new ConversationIdParams("c1").toJson());
    await terminals.removeAsync();
    terminals = null;

    expect(fakes.opened.map(t => [t.sessionId, t.events])).toEqual([["session-teamrun.chat/c1", ["shown", "focus", "hidden", "dispose"]],
      ["session-teamrun.chat/c2", ["hidden", "focus", "shown", "dispose"]]]);
  });
});
