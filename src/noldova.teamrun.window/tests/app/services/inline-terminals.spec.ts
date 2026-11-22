/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { EnvironmentInjector } from "@angular/core";
import { TestBed } from "@angular/core/testing";

import {
  TerminalRunBusy, TerminalRunEnd, TerminalRunNotFoundException, TerminalRunNotTypedException, TerminalRunOutcome, TerminalShellKind
} from "@noldova/terminal.window";
import { ShellRunState } from "@noldova/ui.components.angular";

import type { IKeptRuns } from "../../../src/app/interfaces/i-kept-runs";
import type { IRunPlace } from "../../../src/app/interfaces/i-run-place";
import type { IStoredRun } from "../../../src/app/interfaces/i-stored-run";
import { InlineTerminals } from "../../../src/app/services/inline-terminals";
import { FakeInlineTerminals, FakeRunStarter } from "../../fixtures/fake-inline-terminals.fixture";
import { Wait } from "../../fixtures/wait.fixture";

describe("InlineTerminals", () => {
  const first: IRunPlace = { messageId: "m1", site: "body", block: 0 };
  const second: IRunPlace = { messageId: "m1", site: "body", block: 2 };
  const elsewhere: IRunPlace = { messageId: "m2", site: "plan", block: 0 };
  const refuse = TerminalRunBusy.Refuse;
  let starter: FakeRunStarter;
  let fakes: FakeInlineTerminals;
  let inline: InlineTerminals;
  let injectors: unknown[];
  let hosts: HTMLElement[];

  const opened = (): unknown[] => fakes.opened.map(t => [t.sessionId, t.maximumRows, t.events]);
  const hostOf = (index: number): HTMLElement => {
    while (hosts.length <= index) {
      const host = document.createElement("div");
      document.body.append(host);
      hosts.push(host);
    }
    return hosts[index] ?? document.body;
  };
  const attach = (owner: string, place: IRunPlace, index: number): void => inline.attach(owner, place, hostOf(index), TestBed.inject(EnvironmentInjector));
  const shownOutput = (owner: string, place: IRunPlace): string[] | null => inline.outputAt(owner, place)?.lines.map(t => t.text) ?? null;

  beforeEach(() => {
    starter = new FakeRunStarter();
    injectors = [];
    hosts = [];
    fakes = new FakeInlineTerminals();
    inline = new InlineTerminals(starter, (sessionId, injector, rows) => {
      injectors.push(injector);
      return fakes.open(sessionId, rows);
    });
  });

  afterEach(() => {
    for (const host of hosts)
      host.remove();
  });

  it("starts each Run with no tab, into the runtime's choice at first, and opens the chat's terminal only once its block's slot attaches it, 15 rows high, shown and focused", async () => {
    starter.sessions = ["s1"];
    inline.show("teamrun.chat/c1");

    await inline.runAsync("teamrun.chat/c1", "cd src", "D:/repo", [TerminalShellKind.Bash], first);
    const beforeSlot = opened();
    attach("teamrun.chat/c1", first, 0);

    expect([starter.runs, beforeSlot, opened(), injectors, hostOf(0).firstElementChild, inline.of("teamrun.chat/c1"), inline.places().get("teamrun.chat/c1")])
      .toEqual([[["teamrun.chat/c1", "cd src", "D:/repo", [TerminalShellKind.Bash], null, null]], [], [["s1", 15, ["shown", "focus"]]],
        [TestBed.inject(EnvironmentInjector)], fakes.opened[0]?.element, fakes.opened[0], first]);
  });

  it("runs the next Run into the chat's terminal, refused while busy, focuses it again at the same block, and moves it, focused, to another block's slot", async () => {
    starter.sessions = ["s1", "s1", "s1"];
    inline.show("teamrun.chat/c1");
    await inline.runAsync("teamrun.chat/c1", "ls", null, [], first);
    attach("teamrun.chat/c1", first, 0);
    await inline.runAsync("teamrun.chat/c1", "pwd", null, [], first);
    await inline.runAsync("teamrun.chat/c1", "id", null, [], second);
    const beforeSlot = [...fakes.opened[0]?.events ?? []];
    attach("teamrun.chat/c1", first, 0);
    attach("teamrun.chat/c1", second, 1);
    inline.detach("teamrun.chat/c1", hostOf(0));

    expect([starter.runs.map(t => t.slice(4)), beforeSlot, opened(), hostOf(0).childElementCount, hostOf(1).firstElementChild, inline.places().get("teamrun.chat/c1")])
      .toEqual([[[null, null], ["s1", refuse], ["s1", refuse]], ["shown", "focus", "focus"], [["s1", 15, ["shown", "focus", "focus", "shown", "focus"]]], 0,
        fakes.opened[0]?.element, second]);
  });

  it("disposes the terminal of a Run that gives another session, and opens the new session's at the next slot", async () => {
    starter.sessions = ["s1", "s2"];
    await inline.runAsync("teamrun.chat/c1", "ls", null, [], first);
    attach("teamrun.chat/c1", first, 0);
    await inline.runAsync("teamrun.chat/c1", "exit", null, [], second);
    const between = inline.of("teamrun.chat/c1");
    attach("teamrun.chat/c1", second, 1);

    expect([between, opened(), inline.of("teamrun.chat/c1")]).toEqual([null, [["s1", 15, ["hidden", "focus", "dispose"]], ["s2", 15, ["hidden", "focus"]]], fakes.opened[1]]);
  });

  it("takes the terminal out of a slot that no longer shows, hidden, and leaves a slot that never held it or isn't the latest Run's", async () => {
    starter.sessions = ["s1"];
    inline.show("teamrun.chat/c1");
    await inline.runAsync("teamrun.chat/c1", "ls", null, [], first);
    inline.detach("teamrun.chat/c1", hostOf(0));
    attach("teamrun.chat/c1", second, 0);
    attach("teamrun.chat/c1", first, 0);
    attach("teamrun.chat/c1", first, 0);
    inline.detach("teamrun.chat/c1", hostOf(1));
    inline.detach("teamrun.chat/c1", hostOf(0));
    inline.detach("teamrun.chat/c9", hostOf(0));
    attach("teamrun.chat/c9", first, 0);

    expect([opened(), hostOf(0).childElementCount, fakes.opened.length]).toEqual([[["s1", 15, ["shown", "focus", "shown", "hidden"]]], 0, 1]);
  });

  it("focuses the terminal again when its slot draws again after taking it out while it held the focus, and not when it didn't", async () => {
    starter.sessions = ["s1"];
    inline.show("teamrun.chat/c1");
    await inline.runAsync("teamrun.chat/c1", "ls", null, [], first);
    attach("teamrun.chat/c1", first, 0);
    const input = document.createElement("textarea");
    fakes.opened[0]?.element.append(input);
    input.focus();
    inline.detach("teamrun.chat/c1", hostOf(0));
    attach("teamrun.chat/c1", first, 1);
    inline.detach("teamrun.chat/c1", hostOf(1));
    attach("teamrun.chat/c1", first, 0);

    expect(opened()).toEqual([["s1", 15, ["shown", "focus", "hidden", "shown", "focus", "hidden", "shown"]]]);
  });

  it("gives the chat's terminal the rows that fill half the history, from Terminal's row height, at most 15, at least 1 on a history that holds no more, and opens the next one at them", async () => {
    starter.sessions = ["s1", "s2"];
    inline.fit("teamrun.chat/c1", 400);
    await inline.runAsync("teamrun.chat/c1", "ls", null, [], first);
    inline.fit("teamrun.chat/c1", 400);
    attach("teamrun.chat/c1", first, 0);
    const terminal = fakes.opened[0];
    inline.fit("teamrun.chat/c1", 400);
    terminal?.rowHeight.set(20);
    for (const height of [400, 401, 2_000, 10])
      inline.fit("teamrun.chat/c1", height);
    await inline.runAsync("teamrun.chat/c1", "exit", null, [], second);
    attach("teamrun.chat/c1", second, 1);

    expect(opened()).toEqual([["s1", 15, ["hidden", "focus", "rows 10", "rows 15", "rows 1", "dispose"]], ["s2", 1, ["hidden", "focus"]]]);
  });

  it("gives the chat's terminal 8 rows on a short history, more than half of it, so a prompt and its output show, " +
    "but never more than the history holds with a row to spare for the terminal's inset", async () => {
    starter.sessions = ["s1"];
    await inline.runAsync("teamrun.chat/c1", "ls", null, [], first);
    attach("teamrun.chat/c1", first, 0);
    const terminal = fakes.opened[0];
    terminal?.rowHeight.set(20);
    for (const height of [240, 100, 40, 400])
      inline.fit("teamrun.chat/c1", height);

    expect(opened()).toEqual([["s1", 15, ["hidden", "focus", "rows 8", "rows 4", "rows 1", "rows 10"]]]);
  });

  it("counts the chat's terminal's rows without its inset, keeps them as its drawn rows grow in the same history, " +
    "and fits again when its row height or the history's height changes", async () => {
    starter.sessions = ["s1", "s2"];
    await inline.runAsync("teamrun.chat/c1", "ls", null, [], first);
    attach("teamrun.chat/c1", first, 0);
    const terminal = fakes.opened[0];
    terminal?.rowHeight.set(20);
    for (const rows of [1, 3, 4]) {
      terminal?.element.style.setProperty("height", `${rows * 20 + 12}px`);
      inline.fit("teamrun.chat/c1", 370);
    }
    terminal?.rowHeight.set(16);
    inline.fit("teamrun.chat/c1", 370);
    inline.fit("teamrun.chat/c1", 400);
    await inline.runAsync("teamrun.chat/c1", "exit", null, [], second);
    attach("teamrun.chat/c1", second, 1);
    fakes.opened[1]?.rowHeight.set(16);
    inline.fit("teamrun.chat/c1", 400);

    expect(opened()).toEqual([["s1", 15, ["hidden", "focus", "rows 9", "rows 11", "rows 12", "dispose"]], ["s2", 12, ["hidden", "focus"]]]);
  });

  it("keeps a row the half history holds all but a sliver of, as a row height measured a hair taller after a resize gives", async () => {
    starter.sessions = ["s1"];
    await inline.runAsync("teamrun.chat/c1", "ls", null, [], first);
    attach("teamrun.chat/c1", first, 0);
    const terminal = fakes.opened[0];
    terminal?.rowHeight.set(185 / 9);
    inline.fit("teamrun.chat/c1", 370);
    terminal?.rowHeight.set(185 / (9 - 1e-6));
    inline.fit("teamrun.chat/c1", 370);

    expect(opened()).toEqual([["s1", 15, ["hidden", "focus", "rows 9"]]]);
  });

  it("fits nothing while the chat's terminal has no row height, before it shows, and fits once it has one", async () => {
    starter.sessions = ["s1"];
    await inline.runAsync("teamrun.chat/c1", "ls", null, [], first);
    attach("teamrun.chat/c1", first, 0);
    const terminal = fakes.opened[0];
    inline.fit("teamrun.chat/c1", 370);
    terminal?.rowHeight.set(20);
    inline.fit("teamrun.chat/c1", 370);

    expect(opened()).toEqual([["s1", 15, ["hidden", "focus", "rows 9"]]]);
  });

  it("draws only the terminal of the chat on screen that a slot holds, from each change, and none with no chat on screen", async () => {
    starter.sessions = ["s1", "s2", "s3"];
    inline.show("teamrun.chat/c1");
    await inline.runAsync("teamrun.chat/c1", "ls", null, [], first);
    attach("teamrun.chat/c1", first, 0);
    await inline.runAsync("teamrun.chat/c2", "ls", null, [], first);
    attach("teamrun.chat/c2", first, 1);
    await inline.runAsync("teamrun.chat/c3", "ls", null, [], first);
    inline.show("teamrun.chat/c2");
    inline.detach("teamrun.chat/c1", hostOf(0));
    inline.show("teamrun.chat/c1");
    inline.show(null);

    expect(opened()).toEqual([["s1", 15, ["shown", "focus", "hidden", "hidden", "hidden", "hidden"]], ["s2", 15, ["hidden", "focus", "shown", "hidden", "hidden"]]]);
  });

  it("keeps no place for a Run given none, so no slot draws its terminal, and draws it again at the next Run's block", async () => {
    starter.sessions = ["s1", "s1", "s2", "s2"];
    await inline.runAsync("teamrun.chat/c1", "ls", null, [], first);
    await inline.runAsync("teamrun.chat/c1", "ls", null, []);
    const placed = inline.places().has("teamrun.chat/c1");
    await inline.runAsync("teamrun.chat/c1", "ls", null, []);
    attach("teamrun.chat/c1", first, 0);
    const unopened = opened();
    await inline.runAsync("teamrun.chat/c1", "ls", null, [], first);
    attach("teamrun.chat/c1", first, 0);

    expect([placed, unopened, opened()]).toEqual([false, [], [["s2", 15, ["hidden", "focus"]]]]);
  });

  it("opens nothing, keeps the chat's terminal and its place when a Run fails, and hands on the failure, as for one the person typed over", async () => {
    const failure = new TypeError("The runtime stopped.");
    const typedOver = new TerminalRunNotTypedException("s1", TerminalRunOutcome.Input);
    starter.sessions = ["s1", failure, typedOver];
    await inline.runAsync("teamrun.chat/c1", "ls", null, [], first);
    attach("teamrun.chat/c1", first, 0);

    await expect(inline.runAsync("teamrun.chat/c1", "pwd", null, [], second)).rejects.toBe(failure);
    await expect(inline.runAsync("teamrun.chat/c1", "pwd", null, [], second)).rejects.toBe(typedOver);
    expect([opened(), inline.places().get("teamrun.chat/c1"), inline.isBusyAt("teamrun.chat/c1", second)]).toEqual([[["s1", 15, ["hidden", "focus"]]], first, false]);
  });

  it("hands on a busy or ended refusal of a Run into the runtime's choice, which had no terminal to ask about", async () => {
    const busy = new TerminalRunNotTypedException("s1", TerminalRunOutcome.Busy);
    const ended = new TerminalRunNotTypedException("s1", TerminalRunOutcome.Ended);
    starter.sessions = [busy, ended];

    await expect(inline.runAsync("teamrun.chat/c1", "ls", null, [], first)).rejects.toBe(busy);
    await expect(inline.runAsync("teamrun.chat/c1", "ls", null, [], first)).rejects.toBe(ended);
    expect([starter.runs.length, inline.places().size, inline.isBusyAt("teamrun.chat/c1", first)]).toEqual([2, 0, false]);
  });

  it("asks at a Run's block while the chat's terminal is busy, leaving the terminal where it was, and Stop it and run interrupts the same terminal and runs there", async () => {
    starter.sessions = ["s1", new TerminalRunNotTypedException("s1", TerminalRunOutcome.Busy), "s1"];
    inline.show("teamrun.chat/c1");
    await inline.runAsync("teamrun.chat/c1", "npm start", null, [], first);
    attach("teamrun.chat/c1", first, 0);

    await inline.runAsync("teamrun.chat/c1", "ls", "D:/repo", [TerminalShellKind.Bash], second);
    const asking = [inline.isBusyAt("teamrun.chat/c1", second), inline.isLiveAt("teamrun.chat/c1", first), inline.blocksOf("teamrun.chat/c1", "m1")];
    await inline.answerBusyAsync("teamrun.chat/c1", true);
    await inline.answerBusyAsync("teamrun.chat/c1", true);

    expect(asking).toEqual([true, true, new Map([["body", new Set([0, 2])]])]);
    expect([starter.runs, inline.isBusyAt("teamrun.chat/c1", second), inline.places().get("teamrun.chat/c1"), opened()]).toEqual([[
      ["teamrun.chat/c1", "npm start", null, [], null, null],
      ["teamrun.chat/c1", "ls", "D:/repo", [TerminalShellKind.Bash], "s1", refuse],
      ["teamrun.chat/c1", "ls", "D:/repo", [TerminalShellKind.Bash], "s1", TerminalRunBusy.Interrupt]
    ], false, second, [["s1", 15, ["shown", "focus"]]]]);
  });

  it("asks nowhere for a busy refusal of a Run given no place, leaving the terminal at its block", async () => {
    starter.sessions = ["s1", new TerminalRunNotTypedException("s1", TerminalRunOutcome.Busy)];
    await inline.runAsync("teamrun.chat/c1", "npm start", null, [], first);
    attach("teamrun.chat/c1", first, 0);

    await inline.runAsync("teamrun.chat/c1", "ls", null, []);

    expect([inline.isBusyAt("teamrun.chat/c1", first), inline.places().get("teamrun.chat/c1"), inline.blocksOf("teamrun.chat/c1", "m1")])
      .toEqual([false, first, new Map([["body", new Set([0])]])]);
  });

  it("keeps no place and asks nothing for a busy refusal that comes back after its chat closed", async () => {
    starter.sessions = ["s1", new TerminalRunNotTypedException("s1", TerminalRunOutcome.Busy)];
    await inline.runAsync("teamrun.chat/c1", "npm start", null, [], first);
    attach("teamrun.chat/c1", first, 0);

    const refused = inline.runAsync("teamrun.chat/c1", "ls", null, [], second);
    inline.close("teamrun.chat/c1");
    await refused;

    expect([inline.isBusyAt("teamrun.chat/c1", second), inline.places().has("teamrun.chat/c1"), inline.of("teamrun.chat/c1")]).toEqual([false, false, null]);
  });

  it("keeps no terminal, place, state or latest Run for a Run that starts after its chat closed or the window's terminals went", async () => {
    const releases: (() => void)[] = [];
    const hold = (): void => {
      starter.held = new Promise<void>(resolve => {
        releases.push(resolve);
      });
    };
    starter.sessions = ["s1", "s2", "s3"];
    hold();
    const closed = inline.runAsync("teamrun.chat/c1", "npm start", null, [], first);
    inline.close("teamrun.chat/c1");
    releases[0]?.();
    await closed;
    const afterClose = [inline.of("teamrun.chat/c1"), inline.places().has("teamrun.chat/c1"), inline.statesOf("teamrun.chat/c1", "m1")];
    starter.held = null;
    await inline.runAsync("teamrun.chat/c1", "ls", null, [], second);
    const reads = [...starter.reads];
    hold();
    const disposed = inline.runAsync("teamrun.chat/c2", "pwd", null, [], first);
    inline.dispose();
    releases[1]?.();
    await disposed;

    expect([afterClose, reads, inline.places().has("teamrun.chat/c2"), inline.statesOf("teamrun.chat/c2", "m1"), opened()])
      .toEqual([[null, false, new Map()], [], false, new Map(), []]);
  });

  it("runs in a new terminal of the runtime's choice for Run in a new terminal, and asks again when Stop it and run finds the terminal still busy", async () => {
    starter.sessions = ["s1", new TerminalRunNotTypedException("s1", TerminalRunOutcome.Busy), new TerminalRunNotTypedException("s1", TerminalRunOutcome.Busy), "s2"];
    await inline.runAsync("teamrun.chat/c1", "npm start", null, [], first);
    attach("teamrun.chat/c1", first, 0);
    await inline.runAsync("teamrun.chat/c1", "ls", null, [], second);

    await inline.answerBusyAsync("teamrun.chat/c1", true);
    const askedAgain = inline.isBusyAt("teamrun.chat/c1", second);
    await inline.answerBusyAsync("teamrun.chat/c1", false);
    attach("teamrun.chat/c1", second, 1);

    expect([askedAgain, starter.runs.map(t => t.slice(4)), inline.isBusyAt("teamrun.chat/c1", second), opened()]).toEqual([true,
      [[null, null], ["s1", refuse], ["s1", TerminalRunBusy.Interrupt], [null, null]], false,
      [["s1", 15, ["hidden", "focus", "dispose"]], ["s2", 15, ["hidden", "focus"]]]]);
  });

  it("runs again into the runtime's choice when the chat's terminal ended, closed or restarted before the Run typed", async () => {
    starter.sessions = ["s1", new TerminalRunNotTypedException("s1", TerminalRunOutcome.Ended), "s2"];
    await inline.runAsync("teamrun.chat/c1", "ls", null, [], first);
    attach("teamrun.chat/c1", first, 0);

    await inline.runAsync("teamrun.chat/c1", "pwd", null, [], second);
    attach("teamrun.chat/c1", second, 1);

    expect([starter.runs.map(t => t.slice(4)), opened(), inline.places().get("teamrun.chat/c1")])
      .toEqual([[[null, null], ["s1", refuse], [null, null]], [["s1", 15, ["hidden", "focus", "dispose"]], ["s2", 15, ["hidden", "focus"]]], second]);
  });

  it("keeps an earlier Run's output at its block once the next Run moves the terminal, until a Run there again, and none the runtime no longer has", async () => {
    starter.sessions = ["s1", "s1", "s1", "s1"];
    starter.outputs.set("run-1", FakeRunStarter.outputOf("$ ls", "a.txt"));
    starter.outputs.set("run-2", new TerminalRunNotFoundException("s1", "run-2"));
    await inline.runAsync("teamrun.chat/c1", "ls", null, [], first);
    const before = inline.blocksOf("teamrun.chat/c1", "m1");

    await inline.runAsync("teamrun.chat/c1", "pwd", null, [], second);
    const kept = [shownOutput("teamrun.chat/c1", first), inline.isLiveAt("teamrun.chat/c1", first), inline.blocksOf("teamrun.chat/c1", "m1"),
      inline.blocksOf("teamrun.chat/c1", "m2")];
    await inline.runAsync("teamrun.chat/c1", "ls", null, [], first);
    const runAgain = shownOutput("teamrun.chat/c1", first);
    await inline.runAsync("teamrun.chat/c1", "id", null, [], elsewhere);

    expect([before, kept, runAgain, starter.reads, shownOutput("teamrun.chat/c1", second), shownOutput("teamrun.chat/c1", first),
      inline.blocksOf("teamrun.chat/c1", "m1"), inline.blocksOf("teamrun.chat/c1", "m2")]).toEqual([new Map([["body", new Set([0])]]),
      [["$ ls", "a.txt"], false, new Map([["body", new Set([2, 0])]]), new Map()], null, ["run-1", "run-2", "run-3"], null, null, new Map(),
      new Map([["plan", new Set([0])]])]);
  });

  it("keeps an earlier Run's output with its block in the chat's kept Runs once the next Run moves the terminal on, and keeps nothing of the live Run", async () => {
    const kept = new FakeKeptRuns();
    inline = new InlineTerminals(starter, (sessionId, _injector, rows) => fakes.open(sessionId, rows), kept);
    starter.sessions = ["s1", "s1"];
    starter.outputs.set("run-1", FakeRunStarter.outputOf("$ ls", "a.txt"));
    await inline.runAsync("teamrun.chat/c1", "ls", null, [], first);
    const live = [...kept.saved];

    await inline.runAsync("teamrun.chat/c1", "pwd", null, [], second);

    expect([live, kept.saved]).toEqual([[], [["teamrun.chat/c1", first, ["$ ls", "a.txt"]]]]);
  });

  it("shows an earlier Run's output at its block only once the chat's kept Runs saved it, keeping the block among its message's blocks until then", async () => {
    const kept = new FakeKeptRuns();
    inline = new InlineTerminals(starter, (sessionId, _injector, rows) => fakes.open(sessionId, rows), kept);
    starter.sessions = ["s1", "s1"];
    starter.outputs.set("run-1", FakeRunStarter.outputOf("$ ls", "a.txt"));
    await inline.runAsync("teamrun.chat/c1", "ls", null, [], first);
    let release = (): void => undefined;
    kept.saveHeld = new Promise<void>(resolve => {
      release = resolve;
    });
    const saving = new Promise<void>(resolve => {
      kept.onSave = resolve;
    });

    const moving = inline.runAsync("teamrun.chat/c1", "pwd", null, [], second);
    await saving;
    const held = [shownOutput("teamrun.chat/c1", first), inline.blocksOf("teamrun.chat/c1", "m1")];
    release();
    await moving;

    expect([held, shownOutput("teamrun.chat/c1", first)]).toEqual([[null, new Map([["body", new Set([2, 0])]])], ["$ ls", "a.txt"]]);
  });

  it("shows no earlier Run's output for a save that lands after its chat closed", async () => {
    const kept = new FakeKeptRuns();
    inline = new InlineTerminals(starter, (sessionId, _injector, rows) => fakes.open(sessionId, rows), kept);
    starter.sessions = ["s1", "s1"];
    starter.outputs.set("run-1", FakeRunStarter.outputOf("$ ls", "a.txt"));
    await inline.runAsync("teamrun.chat/c1", "ls", null, [], first);
    let release = (): void => undefined;
    kept.saveHeld = new Promise<void>(resolve => {
      release = resolve;
    });
    const saving = new Promise<void>(resolve => {
      kept.onSave = resolve;
    });

    const moving = inline.runAsync("teamrun.chat/c1", "pwd", null, [], second);
    await saving;
    inline.close("teamrun.chat/c1");
    release();
    await moving;

    expect([kept.saved.length, shownOutput("teamrun.chat/c1", first)]).toEqual([1, null]);
  });

  it("shows no earlier Run's output for a save that lands after a Run went back to its block", async () => {
    const kept = new FakeKeptRuns();
    inline = new InlineTerminals(starter, (sessionId, _injector, rows) => fakes.open(sessionId, rows), kept);
    starter.sessions = ["s1", "s1", "s1"];
    starter.outputs.set("run-1", FakeRunStarter.outputOf("$ ls", "a.txt"));
    starter.outputs.set("run-2", new TerminalRunNotFoundException("s1", "run-2"));
    await inline.runAsync("teamrun.chat/c1", "ls", null, [], first);
    let release = (): void => undefined;
    kept.saveHeld = new Promise<void>(resolve => {
      release = resolve;
    });
    const saving = new Promise<void>(resolve => {
      kept.onSave = resolve;
    });

    const moving = inline.runAsync("teamrun.chat/c1", "pwd", null, [], second);
    await saving;
    await inline.runAsync("teamrun.chat/c1", "ls", null, [], first);
    release();
    await moving;

    expect([kept.saved.length, inline.isLiveAt("teamrun.chat/c1", first), shownOutput("teamrun.chat/c1", first)]).toEqual([1, true, null]);
  });

  it("shows a chat's kept Runs once, when the chat first shows, beside the outputs it holds, and none at the live terminal's block", async () => {
    const kept = new FakeKeptRuns();
    kept.runs = [FakeKeptRuns.runAt(first, "$ old"), FakeKeptRuns.runAt(second, "$ kept"), FakeKeptRuns.runAt(elsewhere, "$ stale")];
    inline = new InlineTerminals(starter, (sessionId, _injector, rows) => fakes.open(sessionId, rows), kept);
    starter.sessions = ["s1", "s1"];
    starter.outputs.set("run-1", FakeRunStarter.outputOf("$ id"));
    await inline.runAsync("teamrun.chat/c1", "id", null, [], elsewhere);
    await inline.runAsync("teamrun.chat/c1", "ls", null, [], first);

    inline.show("teamrun.chat/c1");
    inline.show(null);
    inline.show("teamrun.chat/c1");

    await Wait.until(() => expect(shownOutput("teamrun.chat/c1", second)).toEqual(["$ kept"]));
    expect([kept.listed, shownOutput("teamrun.chat/c1", first), shownOutput("teamrun.chat/c1", elsewhere), inline.blocksOf("teamrun.chat/c1", "m1")])
      .toEqual([["teamrun.chat/c1"], null, ["$ id"], new Map([["body", new Set([0, 2])]])]);
  });

  it("drops the kept Runs a read brings after its chat closed, and reads them again when the chat shows after", async () => {
    const kept = new FakeKeptRuns();
    kept.runs = [FakeKeptRuns.runAt(second, "$ before")];
    kept.holds = true;
    inline = new InlineTerminals(starter, (sessionId, _injector, rows) => fakes.open(sessionId, rows), kept);
    inline.show("teamrun.chat/c1");
    inline.close("teamrun.chat/c1");
    kept.runs = [FakeKeptRuns.runAt(elsewhere, "$ after")];
    kept.holds = false;

    kept.release();
    inline.show("teamrun.chat/c1");

    await Wait.until(() => expect(shownOutput("teamrun.chat/c1", elsewhere)).toEqual(["$ after"]));
    expect([kept.listed, shownOutput("teamrun.chat/c1", second)]).toEqual([["teamrun.chat/c1", "teamrun.chat/c1"], null]);
  });

  it("keeps each earlier Run's output at its own block as the terminal moves on through several", async () => {
    starter.sessions = ["s1", "s1", "s1"];
    starter.outputs.set("run-1", FakeRunStarter.outputOf("$ ls", "a.txt"));
    starter.outputs.set("run-2", FakeRunStarter.outputOf("$ pwd", "/repo"));
    await inline.runAsync("teamrun.chat/c1", "ls", null, [], first);
    await inline.runAsync("teamrun.chat/c1", "pwd", null, [], second);

    await inline.runAsync("teamrun.chat/c1", "id", null, [], elsewhere);

    expect([shownOutput("teamrun.chat/c1", first), shownOutput("teamrun.chat/c1", second), inline.blocksOf("teamrun.chat/c1", "m1")])
      .toEqual([["$ ls", "a.txt"], ["$ pwd", "/repo"], new Map([["body", new Set([0, 2])]])]);
  });

  it("keeps an earlier Run's block among its message's blocks while the next Run reads its output, so the block's slot stays until the output shows", async () => {
    starter.sessions = ["s1", "s1"];
    starter.outputs.set("run-1", FakeRunStarter.outputOf("$ ls", "a.txt"));
    await inline.runAsync("teamrun.chat/c1", "ls", null, [], first);
    let release = (): void => undefined;
    starter.readHeld = new Promise<void>(resolve => {
      release = resolve;
    });
    const read = new Promise<void>(resolve => {
      starter.onRead = resolve;
    });

    const moving = inline.runAsync("teamrun.chat/c1", "pwd", null, [], second);
    await read;
    const reading = [inline.places().get("teamrun.chat/c1"), inline.blocksOf("teamrun.chat/c1", "m1"), shownOutput("teamrun.chat/c1", first)];
    release();
    await moving;

    expect([reading, inline.blocksOf("teamrun.chat/c1", "m1"), shownOutput("teamrun.chat/c1", first)]).toEqual([
      [second, new Map([["body", new Set([2, 0])]]), null], new Map([["body", new Set([2, 0])]]), ["$ ls", "a.txt"]]);
  });

  it("keeps each block a Run left among its message's blocks while a later Run starts during the read, until each Run's own read ends", async () => {
    const third: IRunPlace = { messageId: "m1", site: "body", block: 4 };
    starter.sessions = ["s1", "s1", "s1"];
    starter.outputs.set("run-1", FakeRunStarter.outputOf("$ ls", "a.txt"));
    starter.outputs.set("run-2", FakeRunStarter.outputOf("$ pwd", "/work"));
    await inline.runAsync("teamrun.chat/c1", "ls", null, [], first);
    let releaseFirst = (): void => undefined;
    starter.readHeld = new Promise<void>(resolve => {
      releaseFirst = resolve;
    });
    const firstRead = new Promise<void>(resolve => {
      starter.onRead = resolve;
    });
    const moving = inline.runAsync("teamrun.chat/c1", "pwd", null, [], second);
    await firstRead;
    let releaseSecond = (): void => undefined;
    starter.readHeld = new Promise<void>(resolve => {
      releaseSecond = resolve;
    });
    const secondRead = new Promise<void>(resolve => {
      starter.onRead = resolve;
    });
    const movingOn = inline.runAsync("teamrun.chat/c1", "id", null, [], third);
    await secondRead;
    const reading = [inline.places().get("teamrun.chat/c1"), inline.blocksOf("teamrun.chat/c1", "m1")];

    releaseFirst();
    await moving;
    const firstEnded = [inline.blocksOf("teamrun.chat/c1", "m1"), shownOutput("teamrun.chat/c1", first), shownOutput("teamrun.chat/c1", second)];
    releaseSecond();
    await movingOn;

    expect([reading, firstEnded, inline.blocksOf("teamrun.chat/c1", "m1"), shownOutput("teamrun.chat/c1", first), shownOutput("teamrun.chat/c1", second)]).toEqual([
      [third, new Map([["body", new Set([4, 0, 2])]])], [new Map([["body", new Set([4, 0, 2])]]), ["$ ls", "a.txt"], null],
      new Map([["body", new Set([4, 0, 2])]]), ["$ ls", "a.txt"], ["$ pwd", "/work"]]);
  });

  it("drops an earlier Run's block once the read finds no output to keep, or fails, or its chat closed during the read", async () => {
    const failure = new TypeError("The runtime stopped.");
    starter.sessions = ["s1", "s1", "s2", "s2", "s3", "s3"];
    starter.outputs.set("run-3", failure);
    starter.outputs.set("run-5", FakeRunStarter.outputOf("$ ls", "a.txt"));
    await inline.runAsync("teamrun.chat/c1", "ls", null, [], first);
    await inline.runAsync("teamrun.chat/c1", "pwd", null, [], second);
    const empty = inline.blocksOf("teamrun.chat/c1", "m1");
    await inline.runAsync("teamrun.chat/c2", "ls", null, [], first);
    await expect(inline.runAsync("teamrun.chat/c2", "pwd", null, [], second)).rejects.toBe(failure);
    const failed = inline.blocksOf("teamrun.chat/c2", "m1");
    await inline.runAsync("teamrun.chat/c3", "ls", null, [], first);
    let closed: ReadonlyMap<string, ReadonlySet<number>> | null = null;
    starter.onRead = () => {
      inline.close("teamrun.chat/c3");
      closed = inline.blocksOf("teamrun.chat/c3", "m1");
    };
    await inline.runAsync("teamrun.chat/c3", "pwd", null, [], second);

    expect([empty, failed, closed, inline.blocksOf("teamrun.chat/c3", "m1")]).toEqual([new Map([["body", new Set([2])]]), new Map([["body", new Set([2])]]),
      new Map(), new Map()]);
  });

  it("hands on a failure to read an earlier Run's output other than the runtime no longer having it, keeping the new Run's place", async () => {
    const failure = new TypeError("The runtime stopped.");
    starter.sessions = ["s1", "s1"];
    starter.outputs.set("run-1", failure);
    await inline.runAsync("teamrun.chat/c1", "ls", null, [], first);

    await expect(inline.runAsync("teamrun.chat/c1", "pwd", null, [], second)).rejects.toBe(failure);
    expect([inline.places().get("teamrun.chat/c1"), shownOutput("teamrun.chat/c1", first)]).toEqual([second, null]);
  });

  it("names a Run's block Running until its commands end and Ended after, an earlier Run's block Ended, and no block for a Run given none or refused " +
    "while busy", async () => {
    let end: (value: TerminalRunEnd) => void = () => undefined;
    const ended = new Promise<TerminalRunEnd>(resolve => {
      end = resolve;
    });
    starter.ends.set("run-1", ended);
    starter.sessions = ["s1", "s1", "s1", new TerminalRunNotTypedException("s1", TerminalRunOutcome.Busy)];
    await inline.runAsync("teamrun.chat/c1", "npm test", null, [], first);
    const running = inline.statesOf("teamrun.chat/c1", "m1");

    end(new TerminalRunEnd("Command", 0));
    await ended;
    const done = inline.statesOf("teamrun.chat/c1", "m1");
    await inline.runAsync("teamrun.chat/c1", "ls", null, [], second);
    await inline.runAsync("teamrun.chat/c1", "pwd", null, [], null);
    await inline.runAsync("teamrun.chat/c1", "id", null, [], elsewhere);

    expect([running, done, inline.statesOf("teamrun.chat/c1", "m1"), inline.statesOf("teamrun.chat/c1", "m2"), inline.statesOf("teamrun.chat/c2", "m1")]).toEqual([
      new Map([["body", new Map([[0, ShellRunState.Running]])]]), new Map([["body", new Map([[0, ShellRunState.Ended]])]]),
      new Map([["body", new Map([[0, ShellRunState.Ended], [2, ShellRunState.Ended]])]]), new Map(), new Map()]);
  });

  it("keeps a block Running for its latest Run when an earlier Run there ends after it, and names nothing for a Run that ends after its chat closed", async () => {
    const ends: ((value: TerminalRunEnd) => void)[] = [];
    const endings = ["run-1", "run-2"].map(t => {
      const ending = new Promise<TerminalRunEnd>(resolve => {
        ends.push(resolve);
      });
      starter.ends.set(t, ending);
      return ending;
    });
    starter.sessions = ["s1", "s1"];
    await inline.runAsync("teamrun.chat/c1", "npm test", null, [], first);
    await inline.runAsync("teamrun.chat/c1", "npm test", null, [], first);

    ends[0]?.(new TerminalRunEnd("Command", 1));
    await endings[0];
    const afterEarlier = inline.statesOf("teamrun.chat/c1", "m1");
    inline.close("teamrun.chat/c1");
    ends[1]?.(new TerminalRunEnd("TerminalEnded", null));
    await endings[1];

    expect([afterEarlier, inline.statesOf("teamrun.chat/c1", "m1")]).toEqual([new Map([["body", new Map([[0, ShellRunState.Running]])]]), new Map()]);
  });

  it("closes one chat's terminal, place, question and outputs, leaving the others, and every one once disposed", async () => {
    starter.sessions = ["s1", "s2", "s3", "s4", "s4", new TerminalRunNotTypedException("s4", TerminalRunOutcome.Busy)];
    starter.outputs.set("run-4", FakeRunStarter.outputOf("a.txt"));
    for (const [index, id] of ["c1", "c2", "c3"].entries()) {
      await inline.runAsync(`teamrun.chat/${id}`, "ls", null, [], first);
      attach(`teamrun.chat/${id}`, first, index);
    }
    await inline.runAsync("teamrun.chat/c4", "ls", null, [], first);
    await inline.runAsync("teamrun.chat/c4", "ls", null, [], second);
    await inline.runAsync("teamrun.chat/c4", "ls", null, [], elsewhere);
    const asked = [shownOutput("teamrun.chat/c4", first), inline.isBusyAt("teamrun.chat/c4", elsewhere)];
    inline.close("teamrun.chat/c2");
    inline.close("teamrun.chat/c9");
    const left = ["c1", "c2", "c3"].map(t => inline.of(`teamrun.chat/${t}`));
    const places = [...inline.places().keys()];
    inline.close("teamrun.chat/c4");
    const closed = [shownOutput("teamrun.chat/c4", first), inline.isBusyAt("teamrun.chat/c4", elsewhere), inline.blocksOf("teamrun.chat/c4", "m1")];
    inline.dispose();

    expect([asked, left, places, closed, fakes.opened.map(t => t.events.filter(e => e === "dispose").length), inline.of("teamrun.chat/c1"), inline.places().size])
      .toEqual([[["a.txt"], true], [fakes.opened[0], null, fakes.opened[2]], ["teamrun.chat/c1", "teamrun.chat/c3", "teamrun.chat/c4"], [null, false, new Map()],
        [1, 1, 1], null, 0]);
  });
});

class FakeKeptRuns implements IKeptRuns {
  public readonly saved: unknown[] = [];
  public readonly listed: string[] = [];
  public runs: readonly IStoredRun[] = [];
  public holds: boolean = false;
  public saveHeld: Promise<void> = Promise.resolve();
  public onSave: () => void = () => undefined;
  private readonly held: (() => void)[] = [];

  public static runAt(place: IRunPlace, ...lines: string[]): IStoredRun {
    return { place, output: FakeRunStarter.outputOf(...lines) };
  }

  public listAsync(owner: string): Promise<readonly IStoredRun[]> {
    this.listed.push(owner);
    const runs = this.runs;
    if (!this.holds)
      return Promise.resolve(runs);
    return new Promise(resolve => this.held.push(() => resolve(runs)));
  }

  public save(owner: string, run: IStoredRun): Promise<void> {
    this.saved.push([owner, run.place, run.output.lines.map(t => t.text)]);
    this.onSave();
    return this.saveHeld;
  }

  public release(): void {
    for (const resolve of this.held.splice(0))
      resolve();
  }
}
