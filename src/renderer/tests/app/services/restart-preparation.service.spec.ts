/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TestBed } from "@angular/core/testing";
import { OverlayContainer } from "@angular/cdk/overlay";
import { UpdateCheckpoint, UpdateCheckpointPhase, UpdateCheckpointResult } from "@noldova/teamrun-protocol";

import { SampleData } from "../../fixtures/sample-data";
import { MemoryStorage } from "../../fixtures/memory-storage";
import { MemoryDraftStore } from "../../fixtures/memory-draft-store";
import { TEAMRUN_BRIDGE } from "../../../src/app/services/bridge.service";
import { ChatStore } from "../../../src/app/services/chat-store.service";
import { COMPOSER_DRAFT_STORE, ComposerDraftsService } from "../../../src/app/services/composer-drafts.service";
import { RestartPreparationService } from "../../../src/app/services/restart-preparation.service";

describe("RestartPreparationService", () => {
  let previousStorage: PropertyDescriptor | undefined;
  let previousStyle: string | null;

  beforeEach(() => {
    previousStorage = Object.getOwnPropertyDescriptor(window, "localStorage");
    previousStyle = document.documentElement.getAttribute("style");
    MemoryStorage.install(window);
  });
  afterEach(() => {
    TestBed.resetTestingModule();
    if (previousStorage) Object.defineProperty(window, "localStorage", previousStorage);
    else delete (window as { localStorage?: Storage }).localStorage;
    if (previousStyle === null) document.documentElement.removeAttribute("style");
    else document.documentElement.setAttribute("style", previousStyle);
  });

  it("freezes editing and overlays, flushes the draft and restores editing only for the matching operation", async () => {
    const bridge = SampleData.createBridge();
    const storage = new MemoryDraftStore();
    TestBed.configureTestingModule({ providers: [{ provide: TEAMRUN_BRIDGE, useValue: bridge }, { provide: COMPOSER_DRAFT_STORE, useValue: storage }] });
    await TestBed.inject(ChatStore).initialize();
    const drafts = TestBed.inject(ComposerDraftsService);
    await drafts.select("c1");
    drafts.text.set("durable before restart");
    const preparation = TestBed.inject(RestartPreparationService);
    const overlay = TestBed.inject(OverlayContainer).getContainerElement();
    overlay.inert = false;
    preparation.attachComposer(() => drafts.flush());
    for (const listener of bridge.checkpointListeners)
      listener(new UpdateCheckpoint("one", UpdateCheckpointPhase.Prepare).toJson());
    expect(drafts.isReadyFor("c1")).toBe(false);
    await vi.waitFor(() => expect(bridge.checkpoints.length).toBe(1));
    expect(UpdateCheckpointResult.fromJson(bridge.checkpoints[0]).ready).toBe(true);
    expect(storage.drafts.get("c1")?.text).toBe("durable before restart");
    expect(overlay.inert).toBe(true);
    for (const listener of bridge.checkpointListeners)
      listener(new UpdateCheckpoint("unrelated", UpdateCheckpointPhase.Resume).toJson());
    expect(preparation.frozen()).toBe(true);
    for (const listener of bridge.checkpointListeners)
      listener(new UpdateCheckpoint("one", UpdateCheckpointPhase.Resume).toJson());
    expect(preparation.frozen()).toBe(false);
    expect(overlay.inert).toBe(false);
    expect(drafts.isReadyFor("c1")).toBe(true);
  });

  it("refuses a failed draft save and unfreezes the editor without pretending it was saved", async () => {
    const bridge = SampleData.createBridge();
    const storage = new MemoryDraftStore();
    TestBed.configureTestingModule({ providers: [{ provide: TEAMRUN_BRIDGE, useValue: bridge }, { provide: COMPOSER_DRAFT_STORE, useValue: storage }] });
    await TestBed.inject(ChatStore).initialize();
    const drafts = TestBed.inject(ComposerDraftsService);
    await drafts.select("c1");
    storage.failWrites = true;
    drafts.text.set("keep in memory");
    const preparation = TestBed.inject(RestartPreparationService);
    preparation.attachComposer(() => drafts.flush());
    for (const listener of bridge.checkpointListeners)
      listener(new UpdateCheckpoint("one", UpdateCheckpointPhase.Prepare).toJson());
    await vi.waitFor(() => expect(bridge.checkpoints.length).toBe(1));
    expect(UpdateCheckpointResult.fromJson(bridge.checkpoints[0]).ready).toBe(false);
    expect(preparation.frozen()).toBe(false);
    expect(preparation.error()).not.toBeNull();
    expect(drafts.text()).toBe("keep in memory");
    storage.failWrites = false;
    await drafts.flush();
  });

  it("does not acknowledge an absent composer or an active attachment preparation", async () => {
    const bridge = SampleData.createBridge();
    TestBed.configureTestingModule({ providers: [{ provide: TEAMRUN_BRIDGE, useValue: bridge }] });
    await TestBed.inject(ChatStore).initialize();
    const preparation = TestBed.inject(RestartPreparationService);
    for (const listener of bridge.checkpointListeners)
      listener(new UpdateCheckpoint("missing", UpdateCheckpointPhase.Prepare).toJson());
    await vi.waitFor(() => expect(bridge.checkpoints.length).toBe(1));
    expect(UpdateCheckpointResult.fromJson(bridge.checkpoints[0]).ready).toBe(false);
    preparation.attachComposer(async () => true);
    TestBed.inject(ComposerDraftsService).preparing.set(true);
    for (const listener of bridge.checkpointListeners)
      listener(new UpdateCheckpoint("busy", UpdateCheckpointPhase.Prepare).toJson());
    await vi.waitFor(() => expect(bridge.checkpoints.length).toBe(2));
    expect(UpdateCheckpointResult.fromJson(bridge.checkpoints[1]).ready).toBe(false);
  });
});
