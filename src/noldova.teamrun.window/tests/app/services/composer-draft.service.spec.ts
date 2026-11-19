/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TestBed } from "@angular/core/testing";

import "@noldova/context.core";
import { AttachmentInput, Draft, DraftSaveParams, ErrorCode, MessageAttachment, MethodName } from "@noldova/teamrun.protocol";

import { DraftNotSavedException } from "../../../src/app/exceptions/draft-not-saved.exception";
import { ComposerAttachment } from "../../../src/app/models/composer-attachment";
import { ComposerDraft } from "../../../src/app/models/composer-draft";
import { ChatStoreService } from "../../../src/app/services/chat-store.service";
import { ClockService } from "../../../src/app/services/clock.service";
import { ComposerDraftService } from "../../../src/app/services/composer-draft.service";
import { Resources } from "../../../src/resources";
import { DeferredResponse } from "../../fixtures/deferred-response.fixture";
import { FakeClock } from "../../fixtures/fake-clock.fixture";
import { FakeWindowPartContext } from "../../fixtures/fake-window-part-context.fixture";
import { SampleData } from "../../fixtures/sample-data.fixture";
import { Wait } from "../../fixtures/wait.fixture";

describe("ComposerDraftService", () => {
  let context: FakeWindowPartContext;
  let store: ChatStoreService;
  let drafts: ComposerDraftService;
  let clock: FakeClock;

  const draft = (text: string, conversationId: string = "c1", attachments: readonly ComposerAttachment[] = []): ComposerDraft =>
    new ComposerDraft(conversationId, text, attachments);
  const saved = (): DraftSaveParams[] => context.requests.filter(t => t.method === FakeWindowPartContext.qualify(MethodName.DraftSave))
    .map(t => DraftSaveParams.fromJson(t.parameters));
  const stored = (revision: number): Draft => new Draft("c1", "hello", [], [], revision, SampleData.timestamp);
  const answerSaves = (): void => {
    let revision = 0;
    context.answer(MethodName.DraftSave, t => SampleData.savedDraft(DraftSaveParams.fromJson(t), ++revision).toJson());
  };

  beforeEach(() => {
    context = SampleData.createContext();
    store = new ChatStoreService(context);
    clock = new FakeClock(Date.parse(SampleData.timestamp));
    TestBed.configureTestingModule({
      providers: [ComposerDraftService, { provide: ChatStoreService, useValue: store }, { provide: ClockService, useValue: clock }]
    });
    drafts = TestBed.inject(ComposerDraftService);
  });

  afterEach(() => {
    store.dispose();
  });

  it("saves the latest draft once the interval has passed since the first change, and again after the next change", async () => {
    drafts.schedule(draft("h"));
    clock.advance(Resources.draftSaveInterval - 1);
    drafts.schedule(draft("he"));
    expect(clock.remaining).toEqual([1]);
    clock.advance(1);
    await Wait.until(() => expect(saved().map(t => t.text)).toEqual(["he"]));

    drafts.schedule(draft("hey"));
    clock.advance(Resources.draftSaveInterval - 1);
    expect(clock.remaining).toEqual([1]);
    clock.advance(1);
    await Wait.until(() => expect(saved().map(t => t.text)).toEqual(["he", "hey"]));
  });

  it("saves a pending draft at once when asked, and nothing when nothing changed", async () => {
    drafts.schedule(draft("hello"));

    await drafts.save();
    await drafts.save();
    clock.advance(Resources.draftSaveInterval);
    await drafts.flush();

    expect(saved().map(t => t.text)).toEqual(["hello"]);
  });

  it("sends each new file once by a grant of its own, never its bytes, saves the draft by paths, and sends the stored path after", async () => {
    const chosen = [new File(["a"], "notes.txt", { type: "text/plain" }), new File(["b"], "more.txt", { type: "text/plain" })];
    const files = chosen.map(t => new ComposerAttachment(t));

    drafts.schedule(draft("", "c1", files));
    await drafts.save();
    drafts.schedule(draft("with notes", "c1", files));
    await drafts.save();

    const prepared = context.requests.filter(t => t.method === FakeWindowPartContext.qualify(MethodName.AttachmentPrepare))
      .map(t => AttachmentInput.fromJson(t.parameters));
    expect(prepared.map(t => [t.name, t.grant, t.data])).toEqual([["notes.txt", "grant-1", null], ["more.txt", "grant-2", null]]);
    expect(context.grantedFiles).toEqual(chosen);
    expect(context.count(MethodName.AttachmentDiscard)).toBe(2);
    const [first, second] = saved();
    expect(first?.attachments.map(t => [t.data, t.path])).toEqual([[null, "D:/data/attachments/drafts/notes.txt"], [null, "D:/data/attachments/drafts/more.txt"]]);
    expect(second?.attachments.map(t => [t.data, t.path]))
      .toEqual([[null, "D:/data/attachments/drafts/c1/notes.txt"], [null, "D:/data/attachments/drafts/c1/more.txt"]]);
  });

  it("discards the files it prepared when a file or the save fails, and says why", async () => {
    const files = [new File(["a"], "notes.txt"), new File(["b"], "more.txt")].map(t => new ComposerAttachment(t));
    let prepared = 0;
    context.answer(MethodName.AttachmentPrepare, t => {
      if (++prepared === 2)
        throw new Error("prepare failed");
      return new MessageAttachment(AttachmentInput.fromJson(t).name, "text/plain", 1, "D:/data/attachments/drafts/notes.txt").toJson();
    });
    drafts.schedule(draft("", "c1", files));

    const saving = drafts.save();
    await expect(saving).rejects.toThrow(Resources.draftNotSaved);
    await expect(saving).rejects.toBeInstanceOf(DraftNotSavedException);
    expect(context.noticeText()).toBe(Resources.formatDraftNotSaved("prepare failed"));
    expect(context.count(MethodName.AttachmentDiscard)).toBe(1);
    expect(context.discardedGrants).toEqual(["grant-2"]);
    expect(saved()).toEqual([]);

    context.fail(MethodName.DraftSave, "disk full");
    await expect(drafts.save()).rejects.toThrow(Resources.draftNotSaved);
    expect(context.count(MethodName.AttachmentDiscard)).toBe(3);
    expect(context.discardedGrants).toEqual(["grant-2"]);
    expect(files.map(t => t.isSaved)).toEqual([false, false]);
  });

  it("says a draft whose file the window can't grant isn't saved, and asks the runtime nothing for it", async () => {
    context.refusesGrants = true;
    drafts.schedule(draft("", "c1", [new ComposerAttachment(new File(["a"], "notes.txt"))]));

    await expect(drafts.save()).rejects.toThrow(Resources.draftNotSaved);

    expect(context.noticeText()).toBe(Resources.formatDraftNotSaved(Resources.attachmentReadFailed));
    expect(context.count(MethodName.AttachmentPrepare)).toBe(0);
    expect(saved()).toEqual([]);
  });

  it("waits the interval it is given", async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [ComposerDraftService, { provide: ChatStoreService, useValue: store }, { provide: ClockService, useValue: clock },
      { provide: ComposerDraftService.interval, useValue: 2000 }] });
    const slow = TestBed.inject(ComposerDraftService);

    slow.schedule(draft("hello"));
    clock.advance(1999);
    expect(clock.remaining).toEqual([1]);
    clock.advance(1);

    await Wait.until(() => expect(saved().map(t => t.text)).toEqual(["hello"]));
  });

  it("keeps a saved file's stored path", async () => {
    const attachment = new ComposerAttachment(new MessageAttachment("a.txt", "text/plain", 1, "D:/kept/a.txt"));

    drafts.schedule(draft("", "c1", [attachment]));
    await drafts.save();

    expect(saved()[0]?.attachments[0]?.path).toBe("D:/kept/a.txt");
    expect(saved()[0]?.attachments[0]?.data).toBeNull();
  });

  it("says why a save failed, rejects the close's save step, and saves the same draft on the next try", async () => {
    context.fail(MethodName.DraftSave, "disk full");
    drafts.schedule(draft("hello"));

    await expect(drafts.save()).rejects.toThrow(Resources.draftNotSaved);
    expect(context.noticeText()).toBe(Resources.formatDraftNotSaved("disk full"));

    answerSaves();
    await drafts.save();
    expect(saved().map(t => t.text)).toEqual(["hello", "hello"]);
  });

  it("keeps a change made while a failing save ran over the draft that failed", async () => {
    context.answer(MethodName.DraftSave, () => {
      drafts.schedule(draft("newer"));
      throw new Error("disk full");
    });
    drafts.schedule(draft("older"));

    expect(await drafts.flush()).toBe(false);
    answerSaves();
    await drafts.save();

    expect(saved().map(t => t.text)).toEqual(["older", "newer"]);
  });

  it("reads a conversation's stored draft and discards that revision once", async () => {
    context.answer(MethodName.DraftRead, () => stored(7).toJson());

    expect((await drafts.restore("c1"))?.text).toBe("hello");
    await drafts.discard("c1");
    await drafts.discard("c1");

    expect(context.count(MethodName.DraftDiscard)).toBe(1);
    expect(context.parametersOf(MethodName.DraftDiscard)).toEqual({ chatId: "c1", revision: 7 });
  });

  it("bases each save on the revision it read or saved last, and on none once its read finds no draft", async () => {
    answerSaves();
    context.answer(MethodName.DraftRead, () => stored(7).toJson());
    await drafts.restore("c1");
    drafts.schedule(draft("one"));
    await drafts.save();
    drafts.schedule(draft("two"));
    await drafts.save();
    context.answer(MethodName.DraftRead, () => null);
    await drafts.restore("c1");
    drafts.schedule(draft("other", "c2"));
    await drafts.save();
    drafts.schedule(draft("four", "c2"));
    await drafts.save();

    expect(saved().map(t => [t.text, t.revision])).toEqual([["one", 7], ["two", 1], ["other", 0], ["four", 3]]);
  });

  it("tells its watchers of a save refused as stale, with no notice, drops what was pending, discards the files it prepared and saves nothing over the newer draft until it reads it", async () => {
    const refusedOver: string[] = [];
    const unwatch = drafts.onStale(t => refusedOver.push(t));
    context.answer(MethodName.DraftRead, () => stored(3).toJson())
      .refuse(MethodName.DraftSave, ErrorCode.Conflict, "The draft changed.", "c1");
    await drafts.restore("c1");

    drafts.schedule(draft("mine", "c1", [new ComposerAttachment(new File(["a"], "notes.txt", { type: "text/plain" }))]));
    await drafts.save();
    await drafts.discard("c1");
    unwatch();
    drafts.schedule(draft("again"));
    await drafts.save();

    expect(refusedOver).toEqual(["c1"]);
    expect(context.noticeText()).toBeNull();
    expect(saved().map(t => [t.text, t.revision])).toEqual([["mine", 3], ["again", 0]]);
    expect(context.count(MethodName.AttachmentDiscard)).toBe(1);
    expect(context.count(MethodName.DraftDiscard)).toBe(0);
  });

  it("discards nothing it has neither read nor saved, so another window's draft stays", async () => {
    expect(await drafts.restore("c1")).toBeNull();

    await drafts.discard("c1");

    expect(context.count(MethodName.DraftDiscard)).toBe(0);
  });

  it("discards the revision it saved last, after the save in flight answers, and leaves the store free meanwhile", async () => {
    const response = new DeferredResponse();
    context.answer(MethodName.DraftSave, () => response.promise);
    drafts.schedule(draft("hello"));
    void drafts.flush();

    const discarding = drafts.discard("c1");
    await Promise.resolve();
    expect(context.count(MethodName.DraftDiscard)).toBe(0);
    expect(store.isBusy()).toBe(false);
    response.resolve(stored(3).toJson());
    await discarding;

    expect(context.parametersOf(MethodName.DraftDiscard)).toEqual({ chatId: "c1", revision: 3 });
  });

  it("drops the pending draft of the conversation it discards, and keeps another conversation's", async () => {
    drafts.schedule(draft("other", "c2"));
    await drafts.discard("c1");
    await drafts.save();
    expect(saved().map(t => t.conversationId)).toEqual(["c2"]);

    drafts.schedule(draft("hello"));
    await drafts.discard("c1");
    await drafts.save();

    expect(saved()).toHaveLength(1);
    expect(context.count(MethodName.DraftDiscard)).toBe(0);
  });

  it("keeps the revision when a discard fails, and names it on the next try", async () => {
    context.answer(MethodName.DraftRead, () => stored(4).toJson()).fail(MethodName.DraftDiscard, "locked");
    await drafts.restore("c1");

    await drafts.discard("c1");
    expect(context.noticeText()).toBe("locked");
    context.answer(MethodName.DraftDiscard, () => null);
    await drafts.discard("c1");

    expect(context.count(MethodName.DraftDiscard)).toBe(2);
    expect(context.parametersOf(MethodName.DraftDiscard)).toEqual({ chatId: "c1", revision: 4 });
  });

  it("saves the conversation it leaves before it reads the next one", async () => {
    drafts.schedule(draft("hello"));

    await drafts.restore("c2");

    expect(context.methods.filter(t => t.startsWith("teamrun.draft")))
      .toEqual([FakeWindowPartContext.qualify(MethodName.DraftSave), FakeWindowPartContext.qualify(MethodName.DraftRead)]);
  });

  it("rejects with the reason a stored draft could not be read, and saves nothing over it until a later read answers", async () => {
    context.fail(MethodName.DraftRead, "unreadable");

    await expect(drafts.restore("c1")).rejects.toThrow("unreadable");
    drafts.schedule(draft("hello"));
    drafts.schedule(draft("other", "c2"));
    await drafts.save();
    expect(context.noticeText()).toBeNull();
    expect(saved().map(t => t.conversationId)).toEqual(["c2"]);

    context.answer(MethodName.DraftRead, () => null);
    await drafts.restore("c1");
    drafts.schedule(draft("hello"));
    await drafts.save();
    expect(saved().map(t => t.conversationId)).toEqual(["c2", "c1"]);
  });
});
