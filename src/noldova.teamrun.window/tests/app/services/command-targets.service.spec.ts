/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { CommandTargetsService } from "../../../src/app/services/command-targets.service";
import { RecordingWindowPartContext } from "../../fixtures/recording-window-part-context.fixture";
import { Wait } from "../../fixtures/wait.fixture";

describe("CommandTargetsService", () => {
  it("keeps one set of targets per window", () => {
    const context = new RecordingWindowPartContext();

    expect(CommandTargetsService.of(context)).toBe(CommandTargetsService.of(context));
    expect(CommandTargetsService.of(new RecordingWindowPartContext())).not.toBe(CommandTargetsService.of(context));
  });

  it("focuses the composer of the conversation asked for, ignoring an earlier composer's withdrawal", () => {
    const targets = CommandTargetsService.of(new RecordingWindowPartContext());
    const focused: string[] = [];
    const withdrawFirst = targets.provideComposer("c1", () => focused.push("first"));
    const withdrawSecond = targets.provideComposer("c1", () => focused.push("second"));
    targets.provideComposer("c2", () => focused.push("other"));

    targets.focusComposer("c1");
    withdrawFirst();
    targets.focusComposer("c1");
    withdrawSecond();

    expect(focused).toEqual(["second", "second"]);
    expect([targets.canFocusComposer("c1"), targets.canFocusComposer("c2")]).toEqual([false, true]);
  });

  it("opens the settings of the conversation's latest composer, and of none once it is withdrawn", () => {
    const targets = CommandTargetsService.of(new RecordingWindowPartContext());
    const opened: string[] = [];
    targets.provideComposer("c1", () => undefined, () => false, () => opened.push("first"));
    const withdraw = targets.provideComposer("c1", () => undefined, () => false, () => opened.push("second"));
    targets.provideComposer("c2", () => undefined);

    targets.openComposerSettings("c1");
    targets.openComposerSettings("c2");
    targets.openComposerSettings("c3");
    withdraw();
    targets.openComposerSettings("c1");

    expect(opened).toEqual(["second"]);
  });

  it("focuses a composer asked for before it exists once it appears, and only the one asked for last", async () => {
    const targets = CommandTargetsService.of(new RecordingWindowPartContext());
    const focused: string[] = [];

    targets.focusComposer("c3");
    targets.focusComposer("c1");
    targets.provideComposer("c3", () => focused.push("c3"));
    targets.provideComposer("c1", () => focused.push("c1"));
    expect(focused).toEqual([]);
    await Wait.until(() => expect(focused).toEqual(["c1"]));
    targets.provideComposer("c1", () => focused.push("again"));

    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    expect(focused).toEqual(["c1"]);
  });

  it("leaves a chat with no composer to the runtime's answer, and counts one with a composer as fresh as its composer says", () => {
    const targets = CommandTargetsService.of(new RecordingWindowPartContext());
    let isFresh = true;
    const states = (): boolean[] => ["c1", "c2"].map(t => targets.isFresh(t));

    const withdraw = targets.provideComposer("c1", () => undefined, () => isFresh);
    targets.provideComposer("c2", () => undefined);
    const shown = states();
    isFresh = false;
    const typed = states();
    withdraw();

    expect([shown, typed, states()]).toEqual([[true, false], [false, false], [true, false]]);
  });

  it("says the person types in a chat while a composer says so, and not with a composer that doesn't say or none", () => {
    const targets = CommandTargetsService.of(new RecordingWindowPartContext());
    let typing = true;

    const none = targets.isTypingInAnyChat();
    const withdraw = targets.provideComposer("c1", () => undefined, () => false, () => undefined, () => typing);
    targets.provideComposer("c2", () => undefined);
    const typed = targets.isTypingInAnyChat();
    typing = false;
    const stopped = targets.isTypingInAnyChat();
    typing = true;
    withdraw();

    expect([none, typed, stopped, targets.isTypingInAnyChat()]).toEqual([false, true, false, false]);
  });

  it("runs one start at a time, each after the one before has ended, also when that one failed", async () => {
    const targets = CommandTargetsService.of(new RecordingWindowPartContext());
    const steps: string[] = [];
    let release = (): void => undefined;
    const held = new Promise<void>(resolve => release = resolve);

    const first = targets.startOneAtATime(async () => {
      steps.push("first");
      await held;
      throw new Error("Refused");
    });
    const second = targets.startOneAtATime(async () => {
      steps.push("second");
      return 2;
    });
    await Promise.resolve();
    const waiting = [...steps];
    release();

    await expect(first).rejects.toThrow("Refused");
    await expect(second).resolves.toBe(2);
    expect([waiting, steps]).toEqual([["first"], ["first", "second"]]);
  });
});
