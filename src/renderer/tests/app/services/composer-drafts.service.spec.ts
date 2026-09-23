/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TestBed } from "@angular/core/testing";

import { ComposerAttachment } from "../../../src/app/models/composer-attachment";
import { ComposerDraft } from "../../../src/app/models/composer-draft";
import { DraftAttachment } from "../../../src/app/models/draft-attachment";
import { MemoryDraftStore } from "../../fixtures/memory-draft-store";
import { Resources } from "../../../src/app/resources";
import { COMPOSER_DRAFT_STORE, ComposerDraftsService } from "../../../src/app/services/composer-drafts.service";

describe("ComposerDraftsService", () => {
  let storage: MemoryDraftStore;
  beforeEach(() => {
    storage = new MemoryDraftStore();
    TestBed.configureTestingModule({ providers: [{ provide: COMPOSER_DRAFT_STORE, useValue: storage }] });
  });

  it("preserves separate conversations and immutable file identities across recreation", async () => {
    const service = TestBed.inject(ComposerDraftsService);
    await service.select("a");
    service.text.set("unsent A");
    const file = new File(["draft bytes"], "notes.txt", { type: "text/plain" });
    service.attachments.set([ComposerAttachment.fromFile(file)]);
    expect(await service.flush()).toBe(true);
    const id = storage.drafts.get("a")?.attachments[0]?.id;
    await service.select("b");
    expect(service.text()).toBe("");
    service.text.set("unsent B");
    await service.select("a");
    expect(service.text()).toBe("unsent A");
    expect(service.attachments()[0]?.toDraft().id).toBe(id);
    expect(service.attachments()[0]?.toDraft().file).toBe(file);
    await service.flush();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [{ provide: COMPOSER_DRAFT_STORE, useValue: storage }] });
    const reopened = TestBed.inject(ComposerDraftsService);
    await reopened.select("b");
    expect(reopened.text()).toBe("unsent B");
  });

  it("keeps failed saves in memory, reports failure to restart preparation and retries", async () => {
    const service = TestBed.inject(ComposerDraftsService);
    await service.select("a");
    storage.failWrites = true;
    service.text.set("keep me");
    expect(await service.flush()).toBe(false);
    expect(service.error()).toBe(Resources.draftSaveFailed);
    await service.select("b");
    expect(service.loading()).toBe(true);
    expect(service.isReadyFor("b")).toBe(false);
    await service.select("a");
    expect(service.text()).toBe("keep me");
    storage.failWrites = false;
    await service.retry();
    expect(service.error()).toBeNull();
    expect(storage.drafts.get("a")?.text).toBe("keep me");
  });

  it("blocks an unreadable draft from being overwritten and retries restoration", async () => {
    storage.drafts.set("a", new ComposerDraft("a", "saved", []));
    storage.failReads = true;
    const service = TestBed.inject(ComposerDraftsService);
    await service.select("a");
    expect(service.loading()).toBe(true);
    expect(await service.flush()).toBe(false);
    expect(storage.drafts.get("a")?.text).toBe("saved");
    storage.failReads = false;
    await service.retry();
    expect(service.text()).toBe("saved");
    expect(service.loading()).toBe(false);
  });

  it("clears a sent draft after switching chats without erasing the new draft", async () => {
    const service = TestBed.inject(ComposerDraftsService);
    await service.select("a");
    service.text.set("sent A");
    await service.select("b");
    service.text.set("unsent B");
    await service.sent("a", "sent A", []);
    expect(storage.drafts.has("a")).toBe(false);
    expect(service.text()).toBe("unsent B");
    expect(storage.drafts.get("b")?.text).toBe("unsent B");
    await service.sent("b", "old B", []);
    expect(service.text()).toBe("unsent B");
    await service.sent("b", "unsent B", []);
    expect(service.text()).toBe("");
    expect(storage.drafts.has("b")).toBe(false);
  });

  it("validates saved attachment records", () => {
    expect(() => DraftAttachment.fromStored({ id: "x", file: null, saved: null })).toThrow();
    expect(() => DraftAttachment.fromStored({ id: "x", file: "path", saved: null })).toThrow();
    const file = new File(["image"], "test.png", { type: "image/png" });
    expect(DraftAttachment.fromStored({ id: "x", file, saved: null }).file).toBe(file);
  });

  it("flushes the latest keystroke when the conversation closes before effects run", async () => {
    const service = TestBed.inject(ComposerDraftsService);
    await service.select("a");
    service.text.set("last keystroke");
    await service.select(null);
    expect(storage.drafts.get("a")?.text).toBe("last keystroke");
    expect(service.isReadyFor(null)).toBe(false);
  });

  it("forgets a removed conversation without resaving its current draft", async () => {
    const service = TestBed.inject(ComposerDraftsService);
    await service.select("a");
    service.text.set("delete this draft");
    await service.flush();
    await service.forget("a");
    TestBed.tick();
    await service.flush();
    expect(storage.drafts.has("a")).toBe(false);
    expect(service.isReadyFor("a")).toBe(false);
    expect(service.text()).toBe("");
  });
});
