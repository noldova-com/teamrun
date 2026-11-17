/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { computed } from "@angular/core";
import { TestBed } from "@angular/core/testing";

import "@noldova/context.core";
import { FileSaveOutcome, WindowPartTokens } from "@noldova/desktop.window";
import {
  AttachmentContent, AttachmentReadParams, AttachmentShare, ConversationIdParams, EventName, MessageAttachment, MethodName, WrittenImageReadParams
} from "@noldova/teamrun.protocol";
import { ClipboardWriter } from "@noldova/ui.components.angular";
import type { ClipboardWriterFixture } from "@noldova/ui.components.angular/testing";
import declaration from "@noldova/teamrun/module.json";
import settings from "@noldova/teamrun/settings.json";

import { ImageOpenMode } from "../../../src/app/enums/image-open-mode";
import type { IImageClipboard } from "../../../src/app/interfaces/i-image-clipboard";
import { ViewedImage } from "../../../src/app/models/viewed-image";
import { ChatStoreService } from "../../../src/app/services/chat-store.service";
import { ImageViewerService } from "../../../src/app/services/image-viewer.service";
import { Resources } from "../../../src/resources";
import type { FakeWindowPartContext } from "../../fixtures/fake-window-part-context.fixture";
import { DeferredResponse } from "../../fixtures/deferred-response.fixture";
import { SampleData } from "../../fixtures/sample-data.fixture";
import { Wait } from "../../fixtures/wait.fixture";

describe("ImageViewerService", () => {
  let context: FakeWindowPartContext;

  const pixels = (): string => {
    const canvas = document.createElement("canvas");
    canvas.width = 3;
    canvas.height = 2;
    const url = canvas.toDataURL("image/png");
    return url.slice(url.indexOf(",") + 1);
  };
  const attachment = new MessageAttachment("plan.png", "image/png", 12, "D:/data/attachments/c1/plan.png");
  const attached = (): ViewedImage => ViewedImage.of("c1", attachment);
  const generated = (): ViewedImage => ViewedImage.fromData("d7", "c1", "Generated image", "image/png", pixels());
  const readBack = (): void => {
    context.answer(MethodName.AttachmentRead, () => new AttachmentContent(attachment.name, attachment.mediaType, attachment.size, pixels()).toJson());
  };
  const shareBack = (): void => {
    context.answer(MethodName.AttachmentShare, () => context.share(`data:image/png;base64,${pixels()}`));
  };
  const written = (name: string): ViewedImage => ViewedImage.written("c1", "m4", `D:/work/app/${name}.png`);
  const writeBack = (): void => {
    context.answer(MethodName.WrittenImageRead, () => new AttachmentContent("chart.png", "image/png", 4, pixels()).toJson());
  };
  const grant = (index: number): string => index.toString(16).padStart(32, "0");
  const bytes = (data: string): number[] => [...Uint8Array.from(atob(data), t => t.charCodeAt(0))];

  beforeEach(() => {
    context = SampleData.createContext();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    ImageViewerService.release(context);
    ChatStoreService.release(context);
  });

  it("declares Open images on the TeamRun page, Popup by default, with a choice for each way to open", () => {
    const setting = settings.settings.find(t => t.name === Resources.imageOpenModeSetting);

    expect(declaration.contributes.settings).toContain(Resources.imageOpenModeSetting);
    expect([setting?.title, setting?.default, setting?.page, setting?.group]).toEqual(["Open images", ImageOpenMode.Popup, "TeamRun", "Images"]);
    expect(setting?.type.kind).toBe("Choice");
    expect((setting?.type as { readonly options: readonly { readonly value: string }[] }).options.map(t => t.value)).toEqual(Object.values(ImageOpenMode));
  });

  it("opens images in a popup until the setting says Tab, and follows the setting as it changes", () => {
    const viewer = ImageViewerService.of(context);

    expect(viewer.openMode()).toBe(ImageOpenMode.Popup);
    context.changeSetting(Resources.imageOpenModeSetting, ImageOpenMode.Tab);
    expect(viewer.openMode()).toBe(ImageOpenMode.Tab);
    context.changeSetting(Resources.imageOpenModeSetting, "Window");
    expect(viewer.openMode()).toBe(ImageOpenMode.Popup);

    ImageViewerService.release(context);
    context.changeSetting(Resources.imageOpenModeSetting, ImageOpenMode.Tab);
    expect(viewer.openMode()).toBe(ImageOpenMode.Popup);
    expect(context.watchedSettings).not.toContain(Resources.imageOpenModeSetting);
  });

  it("reads the setting when a reactive read asks for the service first, as a template does", () => {
    context.changeSetting(Resources.imageOpenModeSetting, ImageOpenMode.Tab);
    const mode = computed(() => ImageViewerService.of(context).openMode());

    expect(mode()).toBe(ImageOpenMode.Tab);
    context.changeSetting(Resources.imageOpenModeSetting, ImageOpenMode.Popup);
    expect(mode()).toBe(ImageOpenMode.Popup);
  });

  it("opens an image in a tab named after it, and finds a generated image's bytes again while the window keeps them", () => {
    const viewer = ImageViewerService.of(context);

    viewer.openTab(attached());
    viewer.openTab(generated());

    expect(context.openedDocuments).toEqual([
      { name: Resources.imageDocumentName, instance: attached().toInstance(), title: "plan.png", options: undefined },
      { name: Resources.imageDocumentName, instance: generated().toInstance(), title: "Generated image", options: undefined }
    ]);
    expect(viewer.find(attached().toInstance())).toEqual(attached());
    expect(viewer.find(generated().toInstance())?.data).toBe(generated().data);
    expect(viewer.find("plan.png")).toBeNull();

    ImageViewerService.release(context);
    expect(ImageViewerService.of(context).find(generated().toInstance())?.data).toBeNull();
  });

  it("shares an attachment with the page once and answers its address, never its bytes, a generated image from its bytes, nothing when the share fails, and again after a failure", async () => {
    const viewer = ImageViewerService.of(context);
    context.fail(MethodName.AttachmentShare, "The attachment is gone.");

    expect(await viewer.readAsync(attached())).toBeNull();
    context.answer(MethodName.AttachmentShare, () => new AttachmentShare(grant(7)).toJson());
    expect(await viewer.readAsync(attached())).toBe(`desktop-file://${grant(7)}/`);
    expect(await viewer.readAsync(attached())).toBe(`desktop-file://${grant(7)}/`);
    expect(AttachmentReadParams.fromJson(context.parametersOf(MethodName.AttachmentShare)!)).toEqual(new AttachmentReadParams("c1", attachment.path));
    expect(await viewer.readAsync(generated())).toBe(`data:image/png;base64,${pixels()}`);
    expect([context.count(MethodName.AttachmentShare), context.count(MethodName.AttachmentRead)]).toEqual([2, 0]);
    expect(await viewer.readAsync(new ViewedImage("k", null, "lost.png", "image/png", null, null))).toBeNull();
  });

  it("shares an image a reply wrote with the page once and answers its address, never its bytes, and the same image again after a refused share", async () => {
    const viewer = ImageViewerService.of(context);
    context.fail(MethodName.WrittenImageShare, "The copies are full.");
    context.fail(MethodName.WrittenImageRead, "The image is gone.");

    expect(await viewer.readAsync(written("chart"))).toBeNull();
    context.answer(MethodName.WrittenImageShare, () => new AttachmentShare(grant(9)).toJson());
    expect(await viewer.readAsync(written("chart"))).toBe(`desktop-file://${grant(9)}/`);
    expect(await viewer.readAsync(written("chart"))).toBe(`desktop-file://${grant(9)}/`);
    expect(context.parametersOf(MethodName.WrittenImageShare)).toEqual(new WrittenImageReadParams("c1", "m4", "D:/work/app/chart.png").toJson());
    expect([context.count(MethodName.WrittenImageShare), context.count(MethodName.WrittenImageRead)]).toEqual([2, 1]);
  });

  it("loads an image a reply wrote from its share, and from its bytes when the page can't load the address or the share is refused", async () => {
    const viewer = ImageViewerService.of(context);
    context.answer(MethodName.WrittenImageShare, () => context.share("data:image/png;base64,AAAA"));
    writeBack();

    expect((await viewer.loadAsync(written("chart")))?.naturalWidth).toBe(3);
    expect([context.count(MethodName.WrittenImageShare), context.count(MethodName.WrittenImageRead), context.discardedGrants]).toEqual([1, 1, [grant(1)]]);
    context.fail(MethodName.WrittenImageShare, "The image is an SVG.");
    expect((await viewer.loadAsync(written("diagram")))?.naturalWidth).toBe(3);
    expect([context.count(MethodName.WrittenImageShare), context.count(MethodName.WrittenImageRead)]).toEqual([2, 2]);
  });

  it("saves and copies an image a reply wrote from its bytes read at the time, never from its share", async () => {
    const copied: Uint8Array[] = [];
    const viewer = ImageViewerService.of(context, { writeImageAsync: png => (copied.push(png), Promise.resolve(true)) });
    context.answer(MethodName.WrittenImageShare, () => context.share(`data:image/png;base64,${pixels()}`));
    writeBack();

    await viewer.readAsync(written("chart"));
    expect(await viewer.copyAsync(written("chart"))).toBe(true);
    expect(await viewer.saveAsync(written("chart"))).toBe(true);

    expect([context.count(MethodName.WrittenImageShare), context.count(MethodName.WrittenImageRead)]).toEqual([1, 2]);
    expect([copied.map(t => [...t]), context.savedFiles.map(t => [...t.bytes])]).toEqual([[bytes(pixels())], [bytes(pixels())]]);
  });

  it("reads an image a reply wrote through its message once its share is refused, and nothing when the project refuses it too", async () => {
    const viewer = ImageViewerService.of(context);
    const written = ViewedImage.written("c1", "m4", "D:/work/app/chart.png");
    context.fail(MethodName.WrittenImageRead, "The image is gone.");

    expect(await viewer.readAsync(written)).toBeNull();
    context.answer(MethodName.WrittenImageRead, () => new AttachmentContent("chart.png", "image/png", 4, pixels()).toJson());
    expect(await viewer.readAsync(written)).toBe(`data:image/png;base64,${pixels()}`);
    expect(await viewer.readAsync(ViewedImage.written("c1", "m4", "D:/work/app/chart.png"))).toBe(`data:image/png;base64,${pixels()}`);
    expect(WrittenImageReadParams.fromJson(context.parametersOf(MethodName.WrittenImageRead)!)).toEqual(new WrittenImageReadParams("c1", "m4", "D:/work/app/chart.png"));
    expect(context.count(MethodName.WrittenImageRead)).toBe(2);
    expect([context.count(MethodName.AttachmentRead), context.count(MethodName.AttachmentShare)]).toEqual([0, 0]);
  });

  it("shares an attachment again once its share nears the end of its lifetime, releasing the one it replaces", async () => {
    let now = 0;
    const viewer = ImageViewerService.of(context, null, () => now);
    shareBack();

    await viewer.readAsync(attached());
    now = Resources.imageShareLifetime - 1;
    await viewer.readAsync(attached());
    const early = [context.count(MethodName.AttachmentShare), [...context.discardedGrants]];
    now = Resources.imageShareLifetime;
    await viewer.readAsync(attached());

    expect([early, [context.count(MethodName.AttachmentShare), context.discardedGrants]]).toEqual([[1, []], [2, [grant(1)]]]);
    expect(Resources.imageShareLifetime).toBe(9 * 60 * 1000);
  });

  it("loads an attachment from its share, sharing it once more when the page can't load the address, and gives up after that or a refused share", async () => {
    const viewer = ImageViewerService.of(context);
    const addresses = ["data:image/png;base64,AAAA", `data:image/png;base64,${pixels()}`];
    context.answer(MethodName.AttachmentShare, () => context.share(addresses.shift() ?? "data:image/png;base64,AAAA"));

    expect((await viewer.loadAsync(attached()))?.naturalWidth).toBe(3);
    expect([context.count(MethodName.AttachmentShare), context.discardedGrants]).toEqual([2, [grant(1)]]);
    expect((await viewer.loadAsync(attached()))?.naturalWidth).toBe(3);
    expect(context.count(MethodName.AttachmentShare)).toBe(2);

    expect(await viewer.loadAsync(ViewedImage.of("c1", new MessageAttachment("broken.png", "image/png", 12, "D:/data/attachments/c1/broken.png")))).toBeNull();
    expect(context.count(MethodName.AttachmentShare)).toBe(4);
    context.fail(MethodName.AttachmentShare, "The attachment is gone.");
    expect(await viewer.loadAsync(ViewedImage.of("c1", new MessageAttachment("gone.png", "image/png", 12, "D:/data/attachments/c1/gone.png")))).toBeNull();
    expect(context.count(MethodName.AttachmentShare)).toBe(5);
    context.answer(MethodName.AttachmentShare, () => context.fail(MethodName.AttachmentShare, "The attachment is gone.").share("data:image/png;base64,AAAA"));
    const removed = ViewedImage.of("c1", new MessageAttachment("removed.png", "image/png", 12, "D:/data/attachments/c1/removed.png"));
    expect(await viewer.loadAsync(removed)).toBeNull();
    expect([context.count(MethodName.AttachmentShare), context.discardedGrants.includes(grant(5))]).toEqual([7, true]);
    expect(await viewer.readAsync(removed)).toBeNull();
    expect(context.count(MethodName.AttachmentShare)).toBe(8);

    context.answer(MethodName.WrittenImageRead, () => new AttachmentContent("chart.png", "image/png", 4, "AAAA").toJson());
    expect(await viewer.loadAsync(written("chart"))).toBeNull();
    expect((await viewer.loadAsync(generated()))?.naturalWidth).toBe(3);
    expect([context.count(MethodName.WrittenImageRead), context.count(MethodName.AttachmentRead)]).toEqual([1, 0]);
  });

  it("shares a read in flight and keeps the 16 latest images read, reading one again once it has dropped out", async () => {
    const viewer = ImageViewerService.of(context);
    const images = Array.from({ length: Resources.imageReadLimit + 1 },
      (_, t) => ViewedImage.of("c1", new MessageAttachment(`p${t}.png`, "image/png", 12, `D:/data/attachments/c1/p${t}.png`)));
    shareBack();

    const [first, second] = await Promise.all([viewer.readAsync(images[0]!), viewer.readAsync(images[0]!)]);
    for (const image of images.slice(1))
      await viewer.readAsync(image);
    await viewer.readAsync(images.at(-1)!);
    const counted = context.count(MethodName.AttachmentShare);
    const discarded = [...context.discardedGrants];
    await viewer.readAsync(images[0]!);

    expect([first, second]).toEqual([`data:image/png;base64,${pixels()}`, `data:image/png;base64,${pixels()}`]);
    expect(Resources.imageReadLimit).toBe(16);
    expect([counted, context.count(MethodName.AttachmentShare)]).toEqual([17, 18]);
    expect([discarded, context.discardedGrants]).toEqual([[grant(1)], [grant(1), grant(2)]]);
  });

  it("keeps only the latest reads whose images fit the byte bound, reading an older one again once it has dropped out", async () => {
    const viewer = ImageViewerService.of(context);
    const images = Array.from({ length: 3 }, (_, t) => written(`p${t}`));
    const limit = Resources.imageByteLimit;
    writeBack();

    Object.defineProperty(Resources, "imageByteLimit", { value: 2 * bytes(pixels()).length });
    try {
      for (const image of images)
        await viewer.readAsync(image);
      await viewer.readAsync(images[1]!);
      const counted = context.count(MethodName.WrittenImageRead);
      await viewer.readAsync(images[0]!);
      await viewer.readAsync(images[1]!);

      expect([counted, context.count(MethodName.WrittenImageRead)]).toEqual([3, 4]);
      await viewer.readAsync(images[2]!);
      expect(context.count(MethodName.WrittenImageRead)).toBe(5);
    }
    finally {
      Object.defineProperty(Resources, "imageByteLimit", { value: limit });
    }
    expect(Resources.imageByteLimit).toBe(48 * 1024 * 1024);
  });

  it("holds no bytes for a shared attachment, so the byte bound drops the written images around it and never the share", async () => {
    const viewer = ImageViewerService.of(context);
    const limit = Resources.imageByteLimit;
    shareBack();
    writeBack();

    Object.defineProperty(Resources, "imageByteLimit", { value: 0 });
    try {
      for (let round = 0; round < 2; round++) {
        await viewer.readAsync(attached());
        await viewer.readAsync(written("chart"));
      }
    }
    finally {
      Object.defineProperty(Resources, "imageByteLimit", { value: limit });
    }
    expect([context.count(MethodName.AttachmentShare), context.count(MethodName.WrittenImageRead), context.discardedGrants]).toEqual([1, 2, []]);
  });

  it("keeps only the latest generated images that fit the byte bound, the one just opened even past it, and at most 32", () => {
    const viewer = ImageViewerService.of(context);
    const images = Array.from({ length: 3 }, (_, t) => ViewedImage.fromData(`d${t}`, "c1", "Generated image", "image/png", pixels()));
    const kept = (shown: readonly ViewedImage[]): boolean[] => shown.map(t => viewer.find(t.toInstance())?.data === pixels());
    const limit = Resources.imageByteLimit;

    Object.defineProperty(Resources, "imageByteLimit", { value: 2 * bytes(pixels()).length });
    try {
      for (const image of images)
        viewer.openTab(image);
      const fitting = kept(images);
      Object.defineProperty(Resources, "imageByteLimit", { value: 0 });
      viewer.openTab(images[0]!);

      expect([fitting, kept(images)]).toEqual([[false, true, true], [true, false, false]]);
    }
    finally {
      Object.defineProperty(Resources, "imageByteLimit", { value: limit });
    }
    const many = Array.from({ length: 33 }, (_, t) => ViewedImage.fromData(`m${t}`, "c1", "Generated image", "image/png", pixels()));
    for (const image of many)
      viewer.openTab(image);

    expect(Resources.generatedImageLimit).toBe(32);
    expect(kept(many).filter(t => t).length).toBe(32);
    expect(kept(many.slice(0, 2))).toEqual([false, true]);
  });

  it("never drops a read still in flight for the byte bound, sharing it until it ends", async () => {
    const viewer = ImageViewerService.of(context);
    const images = Array.from({ length: 4 }, (_, t) => written(`p${t}`));
    const held = new DeferredResponse();
    const content = new AttachmentContent(attachment.name, attachment.mediaType, attachment.size, pixels()).toJson();
    context.answer(MethodName.WrittenImageRead, t => WrittenImageReadParams.fromJson(t).path === images[0]!.path ? held.promise : content);
    const limit = Resources.imageByteLimit;

    Object.defineProperty(Resources, "imageByteLimit", { value: 2 * bytes(pixels()).length });
    try {
      const first = viewer.readAsync(images[0]!);
      for (const image of images.slice(1))
        await viewer.readAsync(image);
      const again = viewer.readAsync(images[0]!);
      held.resolve(content);

      expect(await Promise.all([first, again])).toEqual([`data:image/png;base64,${pixels()}`, `data:image/png;base64,${pixels()}`]);
      expect(context.count(MethodName.WrittenImageRead)).toBe(4);
      await viewer.readAsync(images[1]!);
      expect(context.count(MethodName.WrittenImageRead)).toBe(5);
    }
    finally {
      Object.defineProperty(Resources, "imageByteLimit", { value: limit });
    }
  });

  it("keeps a newer read of an image when an older read of it ends after it, done or failed", async () => {
    const viewer = ImageViewerService.of(context);
    const image = (name: string): ViewedImage => written(name);
    const content = new AttachmentContent(attachment.name, attachment.mediaType, attachment.size, pixels()).toJson();
    const held: DeferredResponse[] = [];
    context.answer(MethodName.WrittenImageRead, t => {
      if (WrittenImageReadParams.fromJson(t).path !== image("k").path)
        return content;
      const response = new DeferredResponse();
      held.push(response);
      return response.promise.then(u => {
        if (u === null)
          throw new Error("The attachment is gone.");
        return u;
      });
    });
    const dropK = async (round: string): Promise<void> => {
      for (let t = 0; t < Resources.imageReadLimit; t++)
        await viewer.readAsync(image(`${round}${t}`));
    };
    const limit = Resources.imageByteLimit;

    const doneLate = viewer.readAsync(image("k"));
    await dropK("a");
    const newer = viewer.readAsync(image("k"));
    held[0]!.resolve(content);
    expect(await doneLate).toBe(`data:image/png;base64,${pixels()}`);
    Object.defineProperty(Resources, "imageByteLimit", { value: 0 });
    try {
      await viewer.readAsync(image("x"));
    }
    finally {
      Object.defineProperty(Resources, "imageByteLimit", { value: limit });
    }
    void viewer.readAsync(image("k"));
    expect(held).toHaveLength(2);
    held[1]!.resolve(content);
    expect(await newer).toBe(`data:image/png;base64,${pixels()}`);

    await dropK("b");
    const failedLate = viewer.readAsync(image("k"));
    await dropK("c");
    const newest = viewer.readAsync(image("k"));
    held[2]!.resolve(null);
    expect(await failedLate).toBeNull();
    void viewer.readAsync(image("k"));
    expect(held).toHaveLength(4);
    held[3]!.resolve(content);
    expect(await newest).toBe(`data:image/png;base64,${pixels()}`);
  });

  it("answers a share that dropped out in flight to the page that asked and releases it, as no load draws it, keeps a newer share an older one ends after, and releases the kept one", async () => {
    const viewer = ImageViewerService.of(context);
    const image = (name: string): ViewedImage => ViewedImage.of("c1", new MessageAttachment(`${name}.png`, "image/png", 12, `D:/data/attachments/c1/${name}.png`));
    const held: DeferredResponse[] = [];
    context.answer(MethodName.AttachmentShare, t => {
      if (AttachmentReadParams.fromJson(t).path !== image("k").path)
        return context.share(`data:image/png;base64,${pixels()}`);
      const response = new DeferredResponse();
      held.push(response);
      return response.promise.then(() => context.share(`data:image/png;base64,${pixels()}`));
    });
    const dropK = async (round: string): Promise<void> => {
      for (let t = 0; t < Resources.imageReadLimit; t++)
        await viewer.readAsync(image(`${round}${t}`));
    };

    const late = viewer.readAsync(image("k"));
    await dropK("a");
    const newer = viewer.readAsync(image("k"));
    held[0]!.resolve(null);
    expect(await late).toBe(`data:image/png;base64,${pixels()}`);
    expect(context.discardedGrants).toContain(grant(17));
    held[1]!.resolve(null);
    expect(await newer).toBe(`data:image/png;base64,${pixels()}`);
    void viewer.readAsync(image("k"));
    expect(held).toHaveLength(2);

    await dropK("b");
    expect(context.discardedGrants).toContain(grant(18));
  });

  it("releases a share that answers after its read dropped out once the load waiting for it has drawn it", async () => {
    const viewer = ImageViewerService.of(context);
    const image = (name: string): ViewedImage => ViewedImage.of("c1", new MessageAttachment(`${name}.png`, "image/png", 12, `D:/data/attachments/c1/${name}.png`));
    const held = new DeferredResponse();
    context.answer(MethodName.AttachmentShare, t => AttachmentReadParams.fromJson(t).path === image("k").path
      ? held.promise.then(() => context.share(`data:image/png;base64,${pixels()}`)) : context.share(`data:image/png;base64,${pixels()}`));

    const load = viewer.loadAsync(image("k"));
    for (let t = 0; t < Resources.imageReadLimit; t++)
      await viewer.readAsync(image(`a${t}`));
    held.resolve(null);

    expect((await load)?.naturalWidth).toBe(3);
    expect(context.discardedGrants).toEqual([grant(17)]);
  });

  it("keeps the share it took again after a failed address until that share has drawn, even when newer reads drop it out meanwhile", async () => {
    const viewer = ImageViewerService.of(context);
    const image = (name: string): ViewedImage => ViewedImage.of("c1", new MessageAttachment(`${name}.png`, "image/png", 12, `D:/data/attachments/c1/${name}.png`));
    const addresses = ["data:image/png;base64,AAAA", `data:image/png;base64,${pixels()}`];
    context.answer(MethodName.AttachmentShare, t => context.share(AttachmentReadParams.fromJson(t).path === image("k").path
      ? addresses.shift()! : `data:image/png;base64,${pixels()}`));
    const decode = ImageViewerService.decodeAsync.bind(ImageViewerService);
    const started = new DeferredResponse();
    const held = new DeferredResponse();
    let decodes = 0;
    vi.spyOn(ImageViewerService, "decodeAsync").mockImplementation(async url => {
      if (++decodes === 2) {
        started.resolve(null);
        await held.promise;
      }
      return decode(url);
    });

    const load = viewer.loadAsync(image("k"));
    await started.promise;
    for (let t = 0; t < Resources.imageReadLimit; t++)
      await viewer.readAsync(image(`a${t}`));
    const discarded = [...context.discardedGrants];
    held.resolve(null);

    expect((await load)?.naturalWidth).toBe(3);
    expect([discarded, context.discardedGrants]).toEqual([[grant(1)], [grant(1), grant(2)]]);
  });

  it("drops the reads, sizes and generated images of a chat this window deletes, and keeps other chats'", async () => {
    const viewer = ImageViewerService.of(context);
    const store = ChatStoreService.of(context);
    const deleted = attached();
    const kept = ViewedImage.of("c2", new MessageAttachment("map.png", "image/png", 12, "D:/data/attachments/c2/map.png"));
    const drawn = [ViewedImage.fromData("d1", "c1", "Generated image", "image/png", pixels()), ViewedImage.fromData("d2", "c2", "Generated image", "image/png", pixels())];
    const element = (await ImageViewerService.decodeAsync(`data:image/png;base64,${pixels()}`))!;
    shareBack();
    context.answer(MethodName.ConversationDelete, () => null);

    for (const image of [deleted, kept]) {
      await viewer.readAsync(image);
      viewer.rememberSize(image, element);
    }
    for (const image of drawn)
      viewer.openTab(image);
    await store.deleteConversation("c1");
    await viewer.readAsync(kept);
    await viewer.readAsync(deleted);

    expect([context.count(MethodName.AttachmentShare), context.discardedGrants]).toEqual([3, [grant(1)]]);
    expect([viewer.sizeOf(deleted.key), viewer.sizeOf(kept.key)?.width]).toEqual([null, 3]);
    expect(drawn.map(t => viewer.find(t.toInstance())?.data === pixels())).toEqual([false, true]);

    ImageViewerService.release(context);
    await store.deleteConversation("c2");
    expect(viewer.sizeOf(kept.key)?.width).toBe(3);
  });

  it("drops the reads, sizes and generated images of a chat another window or the CLI deleted", async () => {
    const viewer = ImageViewerService.of(context);
    ChatStoreService.of(context);
    const deleted = attached();
    const element = (await ImageViewerService.decodeAsync(`data:image/png;base64,${pixels()}`))!;
    shareBack();
    await viewer.readAsync(deleted);
    viewer.rememberSize(deleted, element);
    viewer.openTab(generated());

    context.emit(EventName.ConversationDeleted, new ConversationIdParams("c1").toJson());
    await viewer.readAsync(deleted);

    expect([context.count(MethodName.AttachmentShare), context.discardedGrants]).toEqual([2, [grant(1)]]);
    expect(viewer.sizeOf(deleted.key)).toBeNull();
    expect(viewer.find(generated().toInstance())?.data).toBeNull();
  });

  it("forgets each image tab it opened for a deleted chat, closed or still open, once each, and none of another chat or of no chat", async () => {
    const viewer = ImageViewerService.of(context);
    ChatStoreService.of(context);
    const other = ViewedImage.of("c2", new MessageAttachment("map.png", "image/png", 12, "D:/data/attachments/c2/map.png"));
    viewer.openTab(attached());
    viewer.openTab(generated());
    viewer.openTab(other);
    viewer.openTab(new ViewedImage("k", null, "lost.png", "image/png", "D:/data/lost.png", null));
    context.closeDocument(Resources.imageDocumentName, attached().toInstance());
    viewer.forgetTab(generated().toInstance());

    context.emit(EventName.ConversationDeleted, new ConversationIdParams("c1").toJson());

    await Wait.until(() => expect(context.forgottenDocuments.filter(d => d.name === Resources.imageDocumentName)).toEqual([
      { name: Resources.imageDocumentName, instance: generated().toInstance() },
      { name: Resources.imageDocumentName, instance: attached().toInstance() }
    ]));
  });

  it("saves an image's bytes under its name, adding the kind's extension a generated image's name lacks, and none for a kind it doesn't know", async () => {
    const viewer = ImageViewerService.of(context);
    readBack();

    expect(await viewer.saveAsync(attached())).toBe(true);
    expect(await viewer.saveAsync(ViewedImage.fromData("d8", "c1", "Generated image", "image/jpeg", pixels()))).toBe(true);
    expect(await viewer.saveAsync(ViewedImage.fromData("d7", "c1", "Sketch", "image/x-sketch", pixels()))).toBe(true);

    expect(context.savedFiles.map(t => [t.name, [...t.bytes]])).toEqual([["plan.png", bytes(pixels())], ["Generated image.jpg", bytes(pixels())],
      ["Sketch", bytes(pixels())]]);
  });

  it("counts a cancelled save as no failure, and reports a save that failed or an image it couldn't read", async () => {
    const viewer = ImageViewerService.of(context);
    readBack();

    context.saveOutcome = FileSaveOutcome.Cancelled;
    expect(await viewer.saveAsync(attached())).toBe(true);
    context.saveOutcome = FileSaveOutcome.Failed;
    expect(await viewer.saveAsync(attached())).toBe(false);
    context.saveFileAsync = (): Promise<FileSaveOutcome> => Promise.reject(new Error("The window closed."));
    expect(await viewer.saveAsync(attached())).toBe(false);

    context.fail(MethodName.AttachmentRead, "The attachment is gone.");
    expect(await viewer.saveAsync(ViewedImage.of("c1", new MessageAttachment("gone.png", "image/png", 12, "D:/data/attachments/c1/gone.png")))).toBe(false);
    expect(context.count(MethodName.AttachmentRead)).toBe(4);
    expect(context.savedFiles).toHaveLength(2);
  });

  it("saves and copies an attachment from its bytes read at the time, never from its share", async () => {
    const copied: Uint8Array[] = [];
    const viewer = ImageViewerService.of(context, { writeImageAsync: png => (copied.push(png), Promise.resolve(true)) });
    shareBack();
    readBack();

    await viewer.readAsync(attached());
    expect(await viewer.copyAsync(attached())).toBe(true);
    expect(await viewer.saveAsync(attached())).toBe(true);

    expect([context.count(MethodName.AttachmentShare), context.count(MethodName.AttachmentRead)]).toEqual([1, 2]);
    expect([[...copied[0]!], [...context.savedFiles[0]!.bytes]]).toEqual([bytes(pixels()), bytes(pixels())]);
  });

  it("takes the window's clipboard writer as its image clipboard, and has none in a window without one", async () => {
    TestBed.configureTestingModule({ providers: [{ provide: WindowPartTokens.context, useValue: context }, { provide: ClipboardWriter, useValue: null },
      ImageViewerService.provider] });
    expect(TestBed.inject(ImageViewerService).canCopy).toBe(false);

    ImageViewerService.release(context);
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [{ provide: WindowPartTokens.context, useValue: context }, ImageViewerService.provider] });
    const writer = TestBed.inject(ClipboardWriter) as ClipboardWriterFixture;
    const viewer = TestBed.inject(ImageViewerService);
    expect(viewer.canCopy).toBe(true);
    expect(await viewer.copyAsync(generated())).toBe(true);
    expect([...writer.images[0]!]).toEqual(bytes(pixels()));
  });

  it("copies nothing while there's no image clipboard, and a PNG of the image once there is, a PNG as its own bytes", async () => {
    const copied: Uint8Array[] = [];
    let answer = true;
    const clipboard: IImageClipboard = { writeImageAsync: png => (copied.push(png), Promise.resolve(answer)) };
    const plain = ImageViewerService.of(context);

    expect(plain.canCopy).toBe(false);
    expect(await plain.copyAsync(generated())).toBe(false);

    ImageViewerService.release(context);
    const viewer = ImageViewerService.of(context, clipboard);
    expect(viewer.canCopy).toBe(true);
    expect(await viewer.copyAsync(ViewedImage.fromData("d9", "c1", "Generated image", "image/jpeg", pixels()))).toBe(true);
    expect([...copied[0]!.slice(0, 8)]).toEqual([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
    const stored = "iVBORw0KGgoAAAANSUhEUgAAAAIAAAABCAYAAAD0In+KAAAAFElEQVR4AQEJAPb/AP8AAP8AAP//D/kD/aYucFEAAAAASUVORK5CYII=";
    expect(await viewer.copyAsync(ViewedImage.fromData("d8", "c1", "Screenshot", "image/png", stored))).toBe(true);
    expect(btoa(String.fromCharCode(...copied[1]!))).toBe(stored);

    answer = false;
    expect(await viewer.copyAsync(generated())).toBe(false);
    expect(await viewer.copyAsync(ViewedImage.fromData("d0", "c1", "Broken", "image/png", "AAAA"))).toBe(false);
    expect(copied).toHaveLength(3);
  });

  it("copies a JPEG as a PNG of the same pixels", async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 16;
    canvas.height = 8;
    const drawing = canvas.getContext("2d")!;
    drawing.fillStyle = "rgb(255, 0, 0)";
    drawing.fillRect(0, 0, 8, 8);
    drawing.fillStyle = "rgb(0, 0, 255)";
    drawing.fillRect(8, 0, 8, 8);
    const url = canvas.toDataURL("image/jpeg", 1);
    const jpeg = url.slice(url.indexOf(",") + 1);
    const copied: Uint8Array[] = [];
    const viewer = ImageViewerService.of(context, { writeImageAsync: png => (copied.push(png), Promise.resolve(true)) });

    expect(bytes(jpeg).slice(0, 3)).toEqual([0xFF, 0xD8, 0xFF]);
    expect(await viewer.copyAsync(ViewedImage.fromData("d9", "c1", "Photo.jpg", "image/jpeg", jpeg))).toBe(true);
    expect([...copied[0]!.slice(0, 8)]).toEqual([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
    const written = await createImageBitmap(new Blob([new Uint8Array(copied[0]!)], { type: "image/png" }));
    const reading = new OffscreenCanvas(written.width, written.height).getContext("2d")!;
    reading.drawImage(written, 0, 0);
    const pixel = (x: number, y: number): number[] => [...reading.getImageData(x, y, 1, 1).data];
    const near = (actual: number[], expected: number[]): boolean => actual.every((t, i) => Math.abs(t - expected[i]!) <= 8);

    expect([written.width, written.height]).toEqual([16, 8]);
    expect([[0, 0], [3, 4], [7, 7]].every(([x, y]) => near(pixel(x!, y!), [255, 0, 0, 255]))).toBe(true);
    expect([[8, 0], [12, 4], [15, 7]].every(([x, y]) => near(pixel(x!, y!), [0, 0, 255, 255]))).toBe(true);
  });

  it("holds a copy while another runs, and takes copies again once it ends, done or failed", async () => {
    const answers: ((value: boolean) => void)[] = [];
    let failing = false;
    const viewer = ImageViewerService.of(context, {
      writeImageAsync: () => failing ? Promise.reject(new Error("The clipboard is busy.")) : new Promise<boolean>(resolve => answers.push(resolve))
    });

    expect(viewer.copying()).toBe(false);
    const first = viewer.copyAsync(generated());
    expect(viewer.copying()).toBe(true);
    expect(await viewer.copyAsync(generated())).toBe(false);
    await Wait.until(() => expect(answers).toHaveLength(1));
    answers[0]!(true);
    expect(await first).toBe(true);
    expect(viewer.copying()).toBe(false);

    failing = true;
    expect(await viewer.copyAsync(generated())).toBe(false);
    expect(viewer.copying()).toBe(false);
    failing = false;
    const again = viewer.copyAsync(generated());
    await Wait.until(() => expect(answers).toHaveLength(2));
    answers[1]!(true);
    expect(await again).toBe(true);
  });

  it("saves an SVG under its own extension, and copies it as a PNG of the size it gives", async () => {
    const copied: Uint8Array[] = [];
    const viewer = ImageViewerService.of(context, { writeImageAsync: png => (copied.push(png), Promise.resolve(true)) });
    const svg = btoa("<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"40\" height=\"20\"><rect width=\"40\" height=\"20\" fill=\"red\"/></svg>");
    const drawn = ViewedImage.fromData("d6", "c1", "Generated image", "image/svg+xml", svg);

    expect(await viewer.saveAsync(drawn)).toBe(true);
    expect(await viewer.copyAsync(drawn)).toBe(true);

    expect(context.savedFiles.map(t => t.name)).toEqual(["Generated image.svg"]);
    expect(btoa(String.fromCharCode(...context.savedFiles[0]!.bytes))).toBe(svg);
    const png = (await ImageViewerService.decodeAsync(`data:image/png;base64,${btoa(String.fromCharCode(...copied[0]!))}`))!;
    expect([png.naturalWidth, png.naturalHeight]).toEqual([40, 20]);
  });

  it("takes an image that gives no size of its own at the size a browser gives an image without one", async () => {
    const decoded = (await ImageViewerService.decodeAsync(`data:image/png;base64,${pixels()}`))!;
    const sizeOf = (width: number, height: number): number[] => {
      const size = ImageViewerService.naturalSizeOf({ naturalWidth: width, naturalHeight: height, src: String.empty } as HTMLImageElement);
      return [size.width, size.height];
    };

    expect([ImageViewerService.naturalSizeOf(decoded).width, ImageViewerService.naturalSizeOf(decoded).height]).toEqual([3, 2]);
    expect([sizeOf(0, 0), sizeOf(40, 0), sizeOf(0, 20), sizeOf(1, 1)]).toEqual([[300, 150], [300, 150], [300, 150], [1, 1]]);
  });

  it("takes an SVG that gives only a viewBox, or a size in percent, at the viewBox's size, and one with its own size or no usable viewBox as drawn", async () => {
    const url = (attributes: string): string =>
      `data:image/svg+xml;base64,${btoa(`<svg xmlns="http://www.w3.org/2000/svg"${attributes}><rect width="100%" height="100%" fill="red"/></svg>`)}`;
    const sizeOf = async (attributes: string): Promise<number[]> => {
      const size = ImageViewerService.naturalSizeOf((await ImageViewerService.decodeAsync(url(attributes)))!);
      return [size.width, size.height];
    };
    const unreadable = ImageViewerService.naturalSizeOf({ naturalWidth: 0, naturalHeight: 0, src: `data:image/svg+xml;base64,${btoa("<svg")}` } as HTMLImageElement);

    expect(await Promise.all([
      ' viewBox="0 0 120 60"', ' width="100%" height=" 50% " viewBox=" 10,10, 90,180 "', ' width="40" height="20" viewBox="0 0 120 60"',
      ' width="40" viewBox="0 0 120 60"', ' height="20%" viewBox="0 0 0 60"', ' viewBox="0 0 wide 60"', ""
    ].map(sizeOf))).toEqual([[120, 60], [90, 180], [40, 20], [40, 20], [300, 150], [300, 150], [300, 150]]);
    expect([unreadable.width, unreadable.height]).toEqual([300, 150]);
  });

  it("remembers the sizes of the latest images it drew, forgetting the oldest past its limit", async () => {
    const viewer = ImageViewerService.of(context);
    const image = (await ImageViewerService.decodeAsync(`data:image/png;base64,${pixels()}`))!;

    for (let index = 0; index <= Resources.imageSizeLimit; index++)
      viewer.rememberSize(ViewedImage.fromData(`k${index}`, "c1", "Generated image", "image/png", pixels()), image);

    expect(viewer.sizeOf("k0")).toBeNull();
    expect([viewer.sizeOf("k1")?.width, viewer.sizeOf("k1")?.height, viewer.sizeOf(`k${Resources.imageSizeLimit}`)?.ratio]).toEqual([3, 2, 1.5]);
    expect(await ImageViewerService.decodeAsync("data:image/png;base64,AAAA")).toBeNull();
  });
});
