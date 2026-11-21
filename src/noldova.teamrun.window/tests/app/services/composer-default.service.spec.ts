/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonValue } from "@noldova/context.json";
import { ComposerDefaultSaveParams, EventName, MethodName } from "@noldova/teamrun.protocol";

import { ComposerSettings } from "../../../src/app/models/composer-settings";
import { ComposerDefaultService } from "../../../src/app/services/composer-default.service";
import { Resources } from "../../../src/resources";
import { DeferredResponse } from "../../fixtures/deferred-response.fixture";
import { FakeWindowPartContext } from "../../fixtures/fake-window-part-context.fixture";
import { Wait } from "../../fixtures/wait.fixture";

describe("ComposerDefaultService", () => {
  const key = Resources.composerChoicesStorageKey;
  const codex = new ComposerSettings("codex", "gpt-5", "high", "a1");
  const claude = new ComposerSettings("claude", "opus", "max", "a2");
  const gemini = new ComposerSettings("gemini", null, null, null);
  const conversations = { c1: codex.withResponder("bob").toJson() };
  const storeEarlier = (choice: unknown): void => localStorage.setItem(key, JSON.stringify({ defaultChoice: choice, conversations }));
  const stored = (): unknown => JSON.parse(localStorage.getItem(key) ?? "null");
  const shown = (store: ComposerDefaultService): JsonValue => store.defaultChoice()?.toJson() ?? null;
  let context: FakeWindowPartContext;
  let saves: string[];

  const contextKeeping = (choice: JsonValue): FakeWindowPartContext => {
    saves = [];
    return new FakeWindowPartContext()
      .answer(MethodName.ComposerDefaultRead, () => choice)
      .answer(MethodName.ComposerDefaultSave, t => {
        const params = ComposerDefaultSaveParams.fromJson(t);
        saves.push(`${ComposerSettings.fromJson(params.choice)?.kind}${params.onlyIfNone ? " once" : String.empty}`);
        return params.choice;
      });
  };
  const settle = (): Promise<void> => new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
  const open = async (): Promise<ComposerDefaultService> => {
    const store = ComposerDefaultService.of(context);
    await Wait.until(() => expect(context.count(MethodName.ComposerDefaultRead)).toBe(1));
    await settle();
    return store;
  };

  beforeEach(() => {
    localStorage.removeItem(key);
    context = contextKeeping(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    ComposerDefaultService.release(context);
    localStorage.removeItem(key);
  });

  it("starts with no choice when none is kept, and shows the choice the runtime keeps", async () => {
    expect(shown(await open())).toBeNull();
    ComposerDefaultService.release(context);

    context = contextKeeping(codex.toJson());
    const store = ComposerDefaultService.of(context);

    await Wait.until(() => expect(shown(store)).toEqual(codex.toJson()));
    expect(saves).toEqual([]);
  });

  it("is one store per window part", () => {
    expect(ComposerDefaultService.of(context)).toBe(ComposerDefaultService.of(context));
    expect(ComposerDefaultService.of(contextKeeping(null))).not.toBe(ComposerDefaultService.of(context));
  });

  it("saves each sent choice to the runtime without its responder, in order", async () => {
    const store = await open();

    store.remember(codex.withResponder("bob"));
    store.remember(claude);

    await Wait.until(() => expect(saves).toEqual(["codex", "claude"]));
    expect(ComposerDefaultSaveParams.fromJson(context.requests.find(t => t.method === FakeWindowPartContext.qualify(MethodName.ComposerDefaultSave))!.parameters).choice)
      .toEqual(codex.toJson());
    expect(shown(store)).toEqual(claude.toJson());
  });

  it("moves a choice an earlier version stored in local storage over once, then removes it and keeps each chat's choice", async () => {
    storeEarlier(codex.toJson());
    const store = ComposerDefaultService.of(context);

    expect(shown(store)).toEqual(codex.toJson());
    await Wait.until(() => expect(stored()).toEqual({ conversations }));
    expect(saves).toEqual(["codex once"]);
    ComposerDefaultService.release(context);

    context = contextKeeping(codex.toJson());
    await open();
    expect(saves).toEqual([]);
  });

  it("moves nothing when no choice was stored", async () => {
    localStorage.setItem(key, JSON.stringify({ conversations }));
    await open();

    expect(stored()).toEqual({ conversations });
    expect(context.count(MethodName.ComposerDefaultSave)).toBe(0);
  });

  it.each([["no choice", null], ["a choice with no provider", { model: "gpt-5" }], ["a string", "codex"]])("drops a stored default that is %s, and moves nothing", async (_, choice) => {
    storeEarlier(choice);
    const store = await open();

    expect(stored()).toEqual({ conversations });
    expect(shown(store)).toBeNull();
    expect(context.count(MethodName.ComposerDefaultSave)).toBe(0);
  });

  it("keeps the stored choice when its move can't be saved, to move it at the next start", async () => {
    storeEarlier(codex.toJson());
    context = new FakeWindowPartContext().answer(MethodName.ComposerDefaultRead, () => null).fail(MethodName.ComposerDefaultSave, "The runtime is gone.");
    const store = ComposerDefaultService.of(context);

    await Wait.until(() => expect(context.count(MethodName.ComposerDefaultSave)).toBe(1));
    await settle();

    expect(shown(store)).toEqual(codex.toJson());
    expect(stored()).toEqual({ defaultChoice: codex.toJson(), conversations });
  });

  it("shows a stored choice and keeps it when the kept choice can't be read", async () => {
    storeEarlier(codex.toJson());
    context = new FakeWindowPartContext().fail(MethodName.ComposerDefaultRead, "The runtime is gone.");
    const store = await open();

    expect(shown(store)).toEqual(codex.toJson());
    expect(stored()).toEqual({ defaultChoice: codex.toJson(), conversations });
    expect(context.count(MethodName.ComposerDefaultSave)).toBe(0);
  });

  it("opens with no choice when local storage refuses to drop an unreadable stored one", async () => {
    storeEarlier("codex");
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("The storage is blocked.");
    });

    expect(shown(await open())).toBeNull();
    expect(stored()).toEqual({ defaultChoice: "codex", conversations });
    expect(context.count(MethodName.ComposerDefaultSave)).toBe(0);
  });

  it("shows the runtime's choice over a stored one, and removes the stored one without saving it", async () => {
    storeEarlier(gemini.toJson());
    context = contextKeeping(codex.toJson());
    const store = ComposerDefaultService.of(context);

    await Wait.until(() => expect(shown(store)).toEqual(codex.toJson()));
    expect(stored()).toEqual({ conversations });
    expect(saves).toEqual([]);
  });

  it("shows a choice sent before the kept choice arrives at once, and saves it once it does", async () => {
    const read = new DeferredResponse();
    context.answer(MethodName.ComposerDefaultRead, () => read.promise);
    const store = ComposerDefaultService.of(context);

    store.remember(claude);
    expect(shown(store)).toEqual(claude.toJson());
    await settle();
    expect(saves).toEqual([]);
    read.resolve(codex.toJson());

    await Wait.until(() => expect(saves).toEqual(["claude"]));
    expect(shown(store)).toEqual(claude.toJson());
  });

  it("keeps a choice sent here over another window's while the first read waits, and saves it", async () => {
    const read = new DeferredResponse();
    context.answer(MethodName.ComposerDefaultRead, () => read.promise);
    const store = ComposerDefaultService.of(context);
    await Wait.until(() => expect(context.count(MethodName.ComposerDefaultRead)).toBe(1));

    store.remember(claude);
    context.emit(EventName.ComposerDefaultUpdated, codex.toJson());
    expect(shown(store)).toEqual(claude.toJson());
    read.resolve(null);

    await Wait.until(() => expect(saves).toEqual(["claude"]));
  });

  it("saves a choice sent before a failed read, and keeps the stored one to move at the next start", async () => {
    storeEarlier(gemini.toJson());
    context = contextKeeping(null).fail(MethodName.ComposerDefaultRead, "The runtime is gone.");
    const store = ComposerDefaultService.of(context);

    store.remember(claude);
    await Wait.until(() => expect(saves).toEqual(["claude"]));
    expect(shown(store)).toEqual(claude.toJson());
    expect(stored()).toEqual({ defaultChoice: gemini.toJson(), conversations });
  });

  it("saves a choice sent while the stored one's move waits after the move, and shows it", async () => {
    storeEarlier(gemini.toJson());
    const move = new DeferredResponse();
    context.answer(MethodName.ComposerDefaultSave, t => {
      saves.push(ComposerSettings.fromJson(ComposerDefaultSaveParams.fromJson(t).choice)!.kind);
      return saves.length === 1 ? move.promise : ComposerDefaultSaveParams.fromJson(t).choice;
    });
    const store = ComposerDefaultService.of(context);
    await Wait.until(() => expect(saves).toEqual(["gemini"]));

    store.remember(claude);
    move.resolve(codex.toJson());
    await Wait.until(() => expect(saves).toEqual(["gemini", "claude"]));
    await settle();

    expect(shown(store)).toEqual(claude.toJson());
    expect(stored()).toEqual({ conversations });
  });

  it("keeps a choice for this window when the runtime refuses it", async () => {
    context.fail(MethodName.ComposerDefaultSave, "The disk is full.");
    const store = await open();

    store.remember(claude);
    await Wait.until(() => expect(context.count(MethodName.ComposerDefaultSave)).toBe(1));
    await settle();

    expect(shown(store)).toEqual(claude.toJson());
  });

  it("follows a choice another window keeps, but not while a save of its own is under way", async () => {
    const store = await open();

    context.emit(EventName.ComposerDefaultUpdated, codex.toJson());
    expect(shown(store)).toEqual(codex.toJson());

    const save = new DeferredResponse();
    context.answer(MethodName.ComposerDefaultSave, () => save.promise);
    store.remember(claude);
    await Wait.until(() => expect(context.count(MethodName.ComposerDefaultSave)).toBe(1));
    context.emit(EventName.ComposerDefaultUpdated, gemini.toJson());
    expect(shown(store)).toEqual(claude.toJson());

    save.resolve(claude.toJson());
    await Wait.until(() => {
      context.emit(EventName.ComposerDefaultUpdated, gemini.toJson());
      expect(shown(store)).toEqual(gemini.toJson());
    });
  });

  it("shows the choice another window kept during its own save once that save settles", async () => {
    const store = await open();
    const save = new DeferredResponse();
    context.answer(MethodName.ComposerDefaultSave, () => save.promise);
    store.remember(claude);
    await Wait.until(() => expect(context.count(MethodName.ComposerDefaultSave)).toBe(1));
    context.emit(EventName.ComposerDefaultUpdated, claude.toJson());
    context.emit(EventName.ComposerDefaultUpdated, gemini.toJson());
    expect(shown(store)).toEqual(claude.toJson());

    save.resolve(claude.toJson());

    await Wait.until(() => expect(shown(store)).toEqual(gemini.toJson()));
  });

  it("shows a choice another window keeps while its own read waits, over the read's older answer, and removes the stored one", async () => {
    storeEarlier(gemini.toJson());
    const read = new DeferredResponse();
    context.answer(MethodName.ComposerDefaultRead, () => read.promise);
    const store = ComposerDefaultService.of(context);
    await Wait.until(() => expect(context.count(MethodName.ComposerDefaultRead)).toBe(1));

    context.emit(EventName.ComposerDefaultUpdated, claude.toJson());
    expect(shown(store)).toEqual(claude.toJson());
    read.resolve(codex.toJson());
    await settle();

    expect(shown(store)).toEqual(claude.toJson());
    expect(stored()).toEqual({ conversations });
    expect(saves).toEqual([]);
  });

  it("moves a stored choice from one window only, so a second window's move keeps the first window's later choice and shows it", async () => {
    storeEarlier(gemini.toJson());
    let row: JsonValue = null;
    const windowOn = (read: DeferredResponse): FakeWindowPartContext => new FakeWindowPartContext()
      .answer(MethodName.ComposerDefaultRead, () => read.promise)
      .answer(MethodName.ComposerDefaultSave, t => {
        const params = ComposerDefaultSaveParams.fromJson(t);
        if (!params.onlyIfNone || Object.isNull(row))
          row = params.choice;
        return row;
      });
    const [firstRead, secondRead] = [new DeferredResponse(), new DeferredResponse()];
    const [firstContext, secondContext] = [windowOn(firstRead), windowOn(secondRead)];
    const [first, second] = [ComposerDefaultService.of(firstContext), ComposerDefaultService.of(secondContext)];

    try {
      firstRead.resolve(null);
      await Wait.until(() => expect(row).toEqual(gemini.toJson()));
      first.remember(claude);
      await Wait.until(() => expect(row).toEqual(claude.toJson()));
      secondRead.resolve(null);
      await Wait.until(() => expect(secondContext.count(MethodName.ComposerDefaultSave)).toBe(1));
      await settle();

      expect(row).toEqual(claude.toJson());
      expect(shown(second)).toEqual(claude.toJson());
    }
    finally {
      ComposerDefaultService.release(firstContext);
      ComposerDefaultService.release(secondContext);
    }
  });

  it("reads the kept choice again when the runtime asks for a resync, unless none is kept, a choice was sent or the read fails", async () => {
    const store = await open();
    context.answer(MethodName.ComposerDefaultRead, () => codex.toJson());

    context.emit(EventName.StateResyncRequested, null);
    await Wait.until(() => expect(shown(store)).toEqual(codex.toJson()));

    context.answer(MethodName.ComposerDefaultRead, () => null);
    context.emit(EventName.StateResyncRequested, null);
    await Wait.until(() => expect(context.count(MethodName.ComposerDefaultRead)).toBe(3));
    await settle();
    expect(shown(store)).toEqual(codex.toJson());

    const read = new DeferredResponse();
    context.answer(MethodName.ComposerDefaultRead, () => read.promise);
    context.emit(EventName.StateResyncRequested, null);
    await Wait.until(() => expect(context.count(MethodName.ComposerDefaultRead)).toBe(4));
    store.remember(claude);
    read.resolve(gemini.toJson());
    await settle();
    expect(shown(store)).toEqual(claude.toJson());

    context.fail(MethodName.ComposerDefaultRead, "The runtime is gone.");
    context.emit(EventName.StateResyncRequested, null);
    await Wait.until(() => expect(context.count(MethodName.ComposerDefaultRead)).toBe(5));
    await settle();
    expect(shown(store)).toEqual(claude.toJson());
  });

  it("stops following other windows once released", async () => {
    const store = await open();

    ComposerDefaultService.release(context);
    context.emit(EventName.ComposerDefaultUpdated, codex.toJson());

    expect(shown(store)).toBeNull();
    expect(ComposerDefaultService.of(context)).not.toBe(store);
  });
});
