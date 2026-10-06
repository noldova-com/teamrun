/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ErrorHandler } from "@angular/core";
import { TestBed } from "@angular/core/testing";

import { NotificationPost, NotificationSeverity, ShellNotifications } from "@noldova/teamrun-shell-protocol";

import { WindowPartFailureException } from "../../../src/app/exceptions/window-part-failure.exception";
import { ClosingService } from "../../../src/app/services/closing.service";
import { LayoutService } from "../../../src/app/services/layout.service";
import { ModuleStatusService } from "../../../src/app/services/module-status.service";
import { WindowPartHostService } from "../../../src/app/services/window-part-host.service";
import { DesktopBridgeFixture } from "../../fixtures/desktop-bridge.fixture";

describe("ClosingService", () => {
  let bridge: DesktopBridgeFixture;
  let errors: unknown[];
  let saves: Map<string, (() => Promise<void>)[]>;
  let saveLayoutAsync: () => Promise<void>;

  const posts = (): unknown[] => bridge.requests.filter(t => t[0] === "shell.postNotification").map(t => t[1]);
  const failed = (moduleId: string, title: string, text: string): unknown =>
    new NotificationPost(ShellNotifications.saveFailed, moduleId, title, text, NotificationSeverity.Error, null, [], null).toJson();

  beforeEach(() => {
    bridge = DesktopBridgeFixture.install();
    errors = [];
    saves = new Map();
    saveLayoutAsync = () => Promise.resolve();
    TestBed.configureTestingModule({
      providers: [
        { provide: ErrorHandler, useValue: { handleError: (error: unknown) => errors.push(error) } },
        { provide: WindowPartHostService, useValue: { listSaves: () => saves } },
        { provide: LayoutService, useValue: { saveAsync: () => saveLayoutAsync() } },
        { provide: ModuleStatusService, useValue: { nameOf: (owner: string) => `${owner[0]?.toUpperCase()}${owner.slice(1)}` } }
      ]
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    DesktopBridgeFixture.remove();
  });

  it("runs every part's save steps together with the layout save and lets TeamRun close once they all settle", async () => {
    const order: string[] = [];
    let release: () => void = () => undefined;
    saves.set("notes", [
      () => {
        order.push("notes 1");
        return new Promise<void>(resolve => {
          release = resolve;
        });
      },
      () => {
        order.push("notes 2");
        return Promise.resolve();
      }
    ]);
    saves.set("tasks", [() => {
      order.push("tasks");
      return Promise.resolve();
    }]);
    saveLayoutAsync = () => {
      order.push("layout");
      return Promise.resolve();
    };
    let isSettled = false;

    const saving = TestBed.inject(ClosingService).saveAsync().finally(() => {
      isSettled = true;
    });
    await Promise.resolve();
    const before = isSettled;
    release();

    expect(await saving).toBe(true);
    expect([order, before, errors, posts()]).toEqual([["notes 1", "notes 2", "tasks", "layout"], false, [], []]);
  });

  it("keeps TeamRun open when a part's save fails, logging it and posting an error that names the module, while the other parts still save", async () => {
    const full = new Error("The disk is full.");
    let isTasksSaved = false;
    saves.set("notes", [() => Promise.reject(full)]);
    saves.set("drafts", [() => {
      throw new Error("Drafts are read-only.");
    }]);
    saves.set("clock", [() => Promise.reject("offline")]);
    saves.set("tasks", [async () => {
      isTasksSaved = true;
    }]);

    const canClose = await TestBed.inject(ClosingService).saveAsync();

    expect([canClose, isTasksSaved]).toEqual([false, true]);
    expect(errors.map(t => t instanceof WindowPartFailureException ? [t.moduleId, t.message, t.cause] : t).sort()).toEqual([
      ["clock", "Its window part failed to save while TeamRun was closing.", "offline"],
      ["drafts", "Its window part failed to save while TeamRun was closing.", new Error("Drafts are read-only.")],
      ["notes", "Its window part failed to save while TeamRun was closing.", full]
    ]);
    expect(posts()).toEqual(expect.arrayContaining([
      failed("notes", "Notes couldn't save, so TeamRun stayed open", "The disk is full."),
      failed("drafts", "Drafts couldn't save, so TeamRun stayed open", "Drafts are read-only."),
      failed("clock", "Clock couldn't save, so TeamRun stayed open", "offline")
    ]));
    expect(posts().length).toBe(3);
  });

  it("lets TeamRun close after 4 seconds without a part that has not settled, logging it and posting a warning that names the module", async () => {
    vi.useFakeTimers();
    let finishTasks: () => void = () => undefined;
    let failDrafts: (error: Error) => void = () => undefined;
    saves.set("notes", [() => new Promise<void>(() => undefined)]);
    saves.set("tasks", [() => new Promise<void>(resolve => {
      finishTasks = resolve;
    })]);
    saves.set("drafts", [() => new Promise<void>((_, reject) => {
      failDrafts = reject;
    })]);

    const saving = TestBed.inject(ClosingService).saveAsync();
    await vi.advanceTimersByTimeAsync(3999);
    finishTasks();
    const isSettled = await Promise.race([saving.then(() => true), Promise.resolve(false)]);
    await vi.advanceTimersByTimeAsync(1);
    const canClose = await saving;
    const errorsBefore = [...errors];
    const late = new Error("Too late.");
    failDrafts(late);
    await vi.advanceTimersByTimeAsync(0);

    expect([isSettled, canClose, errorsBefore]).toEqual([false, true, []]);
    expect(errors.map(t => t instanceof WindowPartFailureException ? [t.moduleId, t.message, t.cause] : t))
      .toEqual([["drafts", "Its window part failed to save after TeamRun stopped waiting for it.", late]]);
    const unfinished = (moduleId: string, title: string): unknown => new NotificationPost(
      ShellNotifications.saveUnfinished, moduleId, title, "TeamRun closed after waiting 4 seconds for it.", NotificationSeverity.Warning, null, [], null).toJson();
    expect(posts()).toEqual([unfinished("notes", "Notes didn't finish saving"), unfinished("drafts", "Drafts didn't finish saving")]);
    const logged = "Its window part did not finish saving within 4 seconds while TeamRun was closing; TeamRun closed without it.";
    expect(bridge.errorsLogged).toEqual([["notes", logged], ["drafts", logged]]);
  });

  it("answers from the saves alone, without waiting for the notifications it posts", async () => {
    vi.useFakeTimers();
    bridge.responses.set("shell.postNotification", new Promise(() => undefined));
    saves.set("notes", [() => Promise.reject(new Error("The disk is full."))]);
    saves.set("tasks", [() => new Promise<void>(() => undefined)]);

    const saving = TestBed.inject(ClosingService).saveAsync();
    await vi.advanceTimersByTimeAsync(4000);
    const answer = await Promise.race([saving, Promise.resolve("waiting")]);

    expect(answer).toBe(false);
    expect(posts().length).toBe(2);
  });

  it("logs a failed layout save and a notification the runtime refuses, and still lets TeamRun close", async () => {
    const layoutFailure = new Error("This device has no identity, so the window's layout is not kept.");
    saveLayoutAsync = () => Promise.reject(layoutFailure);
    const refusal = { failure: { code: "Disconnected", message: "TeamRun is not connected to its runtime." } };
    bridge.responses.set("shell.postNotification", refusal);
    saves.set("notes", [() => new Promise<void>(() => undefined)]);
    vi.useFakeTimers();

    const saving = TestBed.inject(ClosingService).saveAsync();
    await vi.advanceTimersByTimeAsync(4000);

    expect(await saving).toBe(true);
    await vi.advanceTimersByTimeAsync(0);
    expect(errors.length).toBe(2);
    expect(errors[0]).toBe(layoutFailure);
    expect((errors[1] as Error).message).toBe("TeamRun is not connected to its runtime.");
  });
  it("names each part that failed or did not finish saving for an update, logging them without posting notifications", async () => {
    vi.useFakeTimers();
    const full = new Error("The disk is full.");
    saves.set("notes", [() => Promise.reject(full)]);
    saves.set("tasks", [() => new Promise<void>(() => undefined)]);
    saves.set("clock", [() => Promise.resolve()]);

    const saving = TestBed.inject(ClosingService).saveForUpdateAsync();
    await vi.advanceTimersByTimeAsync(4000);

    expect(await saving).toEqual(["Notes couldn't save", "Tasks didn't finish saving"]);
    expect(errors.map(t => t instanceof WindowPartFailureException ? [t.moduleId, t.message, t.cause] : t))
      .toEqual([["notes", "Its window part failed to save while TeamRun was preparing to install an update.", full]]);
    expect(bridge.errorsLogged).toEqual([["tasks", "Its window part did not finish saving within 4 seconds while TeamRun was preparing to install an update; the update stopped."]]);
    expect(posts()).toEqual([]);
  });

  it("names nothing for an update when every part saved", async () => {
    saves.set("notes", [() => Promise.resolve()]);

    expect(await TestBed.inject(ClosingService).saveForUpdateAsync()).toEqual([]);
  });
});
