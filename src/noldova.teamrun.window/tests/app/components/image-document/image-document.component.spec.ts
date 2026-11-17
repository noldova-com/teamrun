/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type ComponentFixture, TestBed } from "@angular/core/testing";

import "@noldova/context.core";
import { WindowPartTokens } from "@noldova/desktop.window";
import { ConversationIdParams, ErrorCode, EventName, MessageAttachment, MethodName } from "@noldova/teamrun.protocol";

import { ImageDocumentComponent } from "../../../../src/app/components/image-document/image-document.component";
import { ViewedImage } from "../../../../src/app/models/viewed-image";
import { ChatStoreService } from "../../../../src/app/services/chat-store.service";
import { ImageViewerService } from "../../../../src/app/services/image-viewer.service";
import { Resources } from "../../../../src/resources";
import { AccessibilityFixture } from "../../../fixtures/accessibility.fixture";
import type { FakeWindowPartContext } from "../../../fixtures/fake-window-part-context.fixture";
import { SampleData } from "../../../fixtures/sample-data.fixture";
import { Wait } from "../../../fixtures/wait.fixture";

describe("ImageDocumentComponent", () => {
  let context: FakeWindowPartContext;
  let fixture: ComponentFixture<ImageDocumentComponent>;

  const pixels = (): string => {
    const canvas = document.createElement("canvas");
    canvas.width = 30;
    canvas.height = 20;
    const url = canvas.toDataURL("image/png");
    return url.slice(url.indexOf(",") + 1);
  };
  const attachment = new MessageAttachment("plan.png", "image/png", 12, "D:/data/attachments/c1/plan.png");
  const element = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const status = (): string | undefined => element().querySelector('[role="status"]')?.textContent?.trim();
  const open = (instance: string): void => {
    fixture = TestBed.createComponent(ImageDocumentComponent);
    fixture.componentRef.setInput("instance", instance);
    fixture.autoDetectChanges();
  };

  beforeEach(() => {
    context = SampleData.createContext();
    TestBed.configureTestingModule({ providers: [{ provide: WindowPartTokens.context, useValue: context }] });
  });

  afterEach(() => {
    ImageViewerService.release(context);
    ChatStoreService.release(context);
  });

  it("shows a conversation's attachment in the viewer, shared again from the tab's instance, as a tab, reading none of its bytes", async () => {
    context.answer(MethodName.AttachmentShare, () => context.share(`data:image/png;base64,${pixels()}`));
    open(ViewedImage.of("c1", attachment).toInstance());

    await Wait.until(() => expect(element().querySelector(".nol-teamrun-image-viewer-image")).not.toBeNull());
    expect(element().querySelector("nol-teamrun-image-viewer")?.classList.contains("nol-teamrun-image-viewer-tab")).toBe(true);
    expect(element().querySelector(".nol-teamrun-image-viewer-name")?.textContent?.trim()).toBe("plan.png");
    expect([context.count(MethodName.AttachmentShare), context.count(MethodName.AttachmentRead)]).toEqual([1, 0]);
  });

  it("shows a generated image the window still holds, and says one it no longer holds can't be loaded", async () => {
    const generated = ViewedImage.fromData("d7", "c1", "Generated image", "image/png", pixels());
    ImageViewerService.of(context).openTab(generated);
    open(generated.toInstance());
    await Wait.until(() => expect(element().querySelector(".nol-teamrun-image-viewer-image")).not.toBeNull());
    fixture.destroy();

    ImageViewerService.release(context);
    open(generated.toInstance());
    await Wait.until(() => expect(status()).toBe(Resources.imageLoadFailed));
  });

  it("forgets its tab once its chat is deleted, here or elsewhere, a generated image's too, and leaves another chat's and an unreadable tab open", () => {
    context.answer(MethodName.AttachmentShare, () => context.share(`data:image/png;base64,${pixels()}`));
    const instances = [ViewedImage.of("c1", attachment), ViewedImage.of("c2", attachment), ViewedImage.fromData("d7", "c1", "Generated image", "image/png", pixels())]
      .map(t => t.toInstance()).concat("plan.png");
    const tabs = instances.map(t => {
      open(t);
      return fixture;
    });
    const forgottenImages = (): readonly string[] => context.forgottenDocuments.filter(t => t.name === Resources.imageDocumentName).map(t => t.instance);

    context.emit(EventName.ConversationDeleted, new ConversationIdParams("c1").toJson());
    expect(forgottenImages()).toEqual([instances[0], instances[2]]);

    tabs[1]!.destroy();
    context.emit(EventName.ConversationDeleted, new ConversationIdParams("c2").toJson());
    expect(forgottenImages()).toEqual([instances[0], instances[2]]);
  });

  it("forgets a restored tab whose chat Core no longer has once the conversations load, a generated image's too, and leaves a listed chat's open", async () => {
    context.answer(MethodName.AttachmentShare, () => context.share(`data:image/png;base64,${pixels()}`))
      .refuse(MethodName.ConversationListMembers, ErrorCode.NotFound, "Conversation c9 was not found.", "c9");
    const instances = [ViewedImage.of("c1", attachment), ViewedImage.of("c9", attachment), ViewedImage.fromData("d7", "c1", "Generated image", "image/png", pixels()),
      ViewedImage.fromData("d9", "c9", "Generated image", "image/png", pixels())].map(t => t.toInstance());
    for (const instance of instances)
      open(instance);

    await ChatStoreService.of(context).initialize();

    await Wait.until(() => expect(context.forgottenDocuments.filter(t => t.name === Resources.imageDocumentName).map(t => t.instance)).toEqual([instances[1], instances[3]]));
    expect(context.count(MethodName.ConversationListMembers)).toBe(1);
  });

  it("forgets a tab first shown after its chat was found gone, without asking Core again", async () => {
    context.refuse(MethodName.ConversationListMembers, ErrorCode.NotFound, "Conversation c9 was not found.", "c9");
    const instance = ViewedImage.of("c9", attachment).toInstance();
    await ChatStoreService.of(context).initialize();
    expect(await ChatStoreService.of(context).confirmConversation("c9")).toBe(false);

    open(instance);

    await Wait.until(() => expect(context.forgottenDocuments.filter(t => t.name === Resources.imageDocumentName).map(t => t.instance)).toEqual([instance]));
    expect(context.count(MethodName.ConversationListMembers)).toBe(1);
  });

  it("says an instance it can't read can't be loaded", () => {
    open("plan.png");

    expect(status()).toBe(Resources.imageLoadFailed);
    expect(element().querySelector("nol-teamrun-image-viewer")).toBeNull();
  });

  describe("under forced colours and at 200% zoom", () => {
    it("keeps every control, state and focus ring in the image document visible under forced colours", async () => {
      context.answer(MethodName.AttachmentShare, () => context.share(`data:image/png;base64,${pixels()}`));
      open(ViewedImage.of("c1", attachment).toInstance());
      await Wait.until(() => expect(element().querySelector(".nol-teamrun-image-viewer-image")).not.toBeNull());
      await AccessibilityFixture.expectVisibleForcedAsync(element());
    });

    it("neither cuts, crosses nor loses a control in the image document at 200% zoom", async () => {
      context.answer(MethodName.AttachmentShare, () => context.share(`data:image/png;base64,${pixels()}`));
      open(ViewedImage.of("c1", attachment).toInstance());
      await Wait.until(() => expect(element().querySelector(".nol-teamrun-image-viewer-image")).not.toBeNull());
      await AccessibilityFixture.expectFitsZoomedAsync(element(), () => fixture.whenStable());
    });
  });

  describe("by keyboard and screen reader", () => {
    it("reaches every control in the image document by keyboard, with a visible ring", async () => {
      context.answer(MethodName.AttachmentShare, () => context.share(`data:image/png;base64,${pixels()}`));
      open(ViewedImage.of("c1", attachment).toInstance());
      await Wait.until(() => expect(element().querySelector(".nol-teamrun-image-viewer-image")).not.toBeNull());
      expect(await AccessibilityFixture.expectKeyboardAsync(element())).toBeGreaterThan(0);
    });

    it("names every control, dialog, list and image in the image document", async () => {
      context.answer(MethodName.AttachmentShare, () => context.share(`data:image/png;base64,${pixels()}`));
      open(ViewedImage.of("c1", attachment).toInstance());
      await Wait.until(() => expect(element().querySelector(".nol-teamrun-image-viewer-image")).not.toBeNull());
      expect(AccessibilityFixture.expectNamed(element())).toBeGreaterThan(0);
    });
  });
});
