/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type ComponentFixture, TestBed } from "@angular/core/testing";

import "@noldova/context.core";
import { FileSaveOutcome, WindowPartTokens } from "@noldova/desktop.window";
import type { JsonValue } from "@noldova/context.json";
import { AttachmentContent, MessageAttachment, MethodName } from "@noldova/teamrun.protocol";
import { ClipboardWriter, ThemeMode } from "@noldova/ui.components.angular";
import { AppearanceFixture, ClipboardWriterFixture, FixtureTheme } from "@noldova/ui.components.angular/testing";
import { userEvent } from "vitest/browser";

import { ImagePreviewComponent } from "../../../../src/app/components/image-preview/image-preview.component";
import { ImageOpenMode } from "../../../../src/app/enums/image-open-mode";
import type { IImageClipboard } from "../../../../src/app/interfaces/i-image-clipboard";
import { ViewedImage } from "../../../../src/app/models/viewed-image";
import { ChatStoreService } from "../../../../src/app/services/chat-store.service";
import { ImageViewerService } from "../../../../src/app/services/image-viewer.service";
import { Resources } from "../../../../src/resources";
import { AccessibilityFixture } from "../../../fixtures/accessibility.fixture";
import { DeferredResponse } from "../../../fixtures/deferred-response.fixture";
import { EmulatedMediaFixture } from "../../../fixtures/emulated-media.fixture";
import type { FakeWindowPartContext } from "../../../fixtures/fake-window-part-context.fixture";
import { SampleData } from "../../../fixtures/sample-data.fixture";
import { Wait } from "../../../fixtures/wait.fixture";

describe("ImagePreviewComponent", () => {
  let context: FakeWindowPartContext;
  let fixture: ComponentFixture<ImagePreviewComponent>;
  let settles: number;

  const pixels = (width: number, height: number): string => {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const url = canvas.toDataURL("image/png");
    return url.slice(url.indexOf(",") + 1);
  };
  const attachment = new MessageAttachment("plan.png", "image/png", 12, "D:/data/attachments/c1/plan.png");
  const attached = ViewedImage.of("c1", attachment);
  const element = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const part = <T extends HTMLElement = HTMLElement>(selector: string): T | null => element().querySelector<T>(selector);
  const box = (target: Element | null): DOMRect => target?.getBoundingClientRect() ?? new DOMRect();
  const items = (): HTMLButtonElement[] => [...document.querySelectorAll<HTMLButtonElement>("button[nol-menu-item]")];
  const labels = (): string[] => items().map(t => t.querySelector(".nol-menu-item-label")!.textContent!.trim());
  const item = (label: string): HTMLButtonElement => items().find(t => t.querySelector(".nol-menu-item-label")!.textContent!.trim() === label)!;
  const viewerShown = (): HTMLElement | null => document.querySelector<HTMLElement>("nol-teamrun-image-viewer");
  const popup = (): HTMLElement => {
    const overlay = document.querySelector<HTMLElement>(".cdk-overlay-container");
    if (Object.isNull(overlay))
      throw new Error("The viewer's popup isn't open.");
    return overlay;
  };
  const settle = async (): Promise<void> => {
    await fixture.whenStable();
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    await fixture.whenStable();
  };
  const shared = (width: number, height: number): JsonValue => context.share(`data:image/png;base64,${pixels(width, height)}`);
  const answer = (width: number = 600, height: number = 400): void => {
    context.answer(MethodName.AttachmentShare, () => shared(width, height))
      .answer(MethodName.AttachmentRead, () => new AttachmentContent(attachment.name, attachment.mediaType, attachment.size, pixels(width, height)).toJson());
  };
  const create = async (image: ViewedImage = attached, clipboard: IImageClipboard | ClipboardWriter | null = null, configure: () => void = () => answer()): Promise<void> => {
    configure();
    TestBed.configureTestingModule({ providers: [{ provide: WindowPartTokens.context, useValue: context }, clipboard instanceof ClipboardWriter
      ? { provide: ClipboardWriter, useValue: clipboard } : { provide: ImageViewerService.clipboard, useValue: clipboard }] });
    fixture = TestBed.createComponent(ImagePreviewComponent);
    fixture.componentRef.setInput("image", image);
    settles = 0;
    fixture.componentInstance.settled.subscribe(() => settles++);
    fixture.autoDetectChanges();
    await Wait.until(() => expect(settles).toBe(1));
    await settle();
  };
  const openMenu = async (): Promise<void> => {
    const frame = part(".nol-teamrun-image-frame")!;
    const bounds = box(frame);
    frame.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, button: 2, clientX: bounds.left + 10, clientY: bounds.top + 10 }));
    await settle();
  };
  const unsafe = btoa("<svg xmlns='http://www.w3.org/2000/svg' width='40' height='20' onload='window.svgRan = true'>"
    + "<script>window.svgRan = true</script><image href='https://example.invalid/outside.png' width='40' height='20'/>"
    + "<rect width='40' height='20' fill='red'/></svg>");
  const ran = (): unknown => (window as { svgRan?: unknown }).svgRan;
  const expectDrawnAsAnImage = (image: HTMLImageElement | null, root: HTMLElement): void => {
    expect(image?.tagName).toBe("IMG");
    expect(image?.src).toBe(`data:image/svg+xml;base64,${unsafe}`);
    expect([image?.complete, image?.naturalWidth, image?.naturalHeight]).toEqual([true, 40, 20]);
    expect(root.querySelector("svg")).toBeNull();
    expect(document.querySelector("svg script, svg image, svg [onload]")).toBeNull();
    expect(ran()).toBeUndefined();
    expect(performance.getEntriesByName("https://example.invalid/outside.png")).toHaveLength(0);
  };
  const pressEscape = async (target: Element = document.activeElement ?? document.body): Promise<void> => {
    target.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
    await settle();
  };

  beforeEach(() => {
    context = SampleData.createContext();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    ImageViewerService.release(context);
    ChatStoreService.release(context);
    delete (window as { svgRan?: unknown }).svgRan;
  });

  it("draws the image with its name under it, emits settled once drawn, and gives no caption inside the person's bubble", async () => {
    await create();

    expect(part<HTMLImageElement>(".nol-teamrun-image")?.alt).toBe("plan.png");
    expect(part(".nol-teamrun-image-frame")?.getAttribute("aria-label")).toBe("plan.png");
    expect(part(".nol-teamrun-image-caption")?.textContent?.trim()).toBe("plan.png");
    expect(settles).toBe(1);

    fixture.componentRef.setInput("showCaption", false);
    await settle();
    expect(part(".nol-teamrun-image-caption")).toBeNull();
  });

  it("says which image couldn't be read, offers no menu, and still emits settled", async () => {
    await create(attached, null, () => context.fail(MethodName.AttachmentShare, "The attachment is gone."));

    expect(part('[role="status"]')?.textContent?.trim()).toBe("plan.png could not be loaded.");
    expect(part(".nol-teamrun-image-frame")).toBeNull();
    expect(settles).toBe(1);
  });

  it("shows the text it falls back to in place of saying the image couldn't be read, and nothing for an empty one", async () => {
    await create(attached, null, () => context.fail(MethodName.AttachmentShare, "The attachment is gone."));
    fixture.componentRef.setInput("fallback", "the plan");
    await settle();

    expect(part(".nol-teamrun-image-fallback")?.textContent?.trim()).toBe("the plan");
    expect(part('[role="status"]')).toBeNull();

    fixture.componentRef.setInput("fallback", "");
    await settle();
    expect(element().textContent?.trim()).toBe("");
    expect(part('[role="status"]')).toBeNull();
  });

  it("shows the text it falls back to while its image loads, and the image once it's read", async () => {
    let release: () => void = () => undefined;
    context.answer(MethodName.AttachmentShare, () => new Promise(resolve => release = () => resolve(shared(60, 40))));
    TestBed.configureTestingModule({ providers: [{ provide: WindowPartTokens.context, useValue: context }] });
    fixture = TestBed.createComponent(ImagePreviewComponent);
    fixture.componentRef.setInput("image", attached);
    fixture.componentRef.setInput("fallback", "the plan");
    fixture.autoDetectChanges();
    await settle();

    expect(part(".nol-teamrun-image-fallback")?.textContent?.trim()).toBe("the plan");
    expect(part(".nol-teamrun-image-frame")).toBeNull();
    release();
    await Wait.until(() => expect(part(".nol-teamrun-image")).not.toBeNull());
    expect(part(".nol-teamrun-image-fallback")).toBeNull();
  });

  it("keeps its image, with no second read, when its row gives it the same image again as a new object", async () => {
    await create();
    const image = part<HTMLImageElement>(".nol-teamrun-image");

    fixture.componentRef.setInput("image", ViewedImage.of("c1", attachment));
    fixture.detectChanges();
    await settle();

    expect(part<HTMLImageElement>(".nol-teamrun-image")).toBe(image);
    expect([settles, context.count(MethodName.AttachmentShare)]).toEqual([1, 1]);
  });

  it("keeps the size it learned for an image, so a row drawn again has its height before the bytes come", async () => {
    await create();
    const height = box(part(".nol-teamrun-image-frame")).height;
    fixture.destroy();
    for (let t = 0; t < Resources.imageReadLimit; t++)
      await ImageViewerService.of(context).readAsync(ViewedImage.of("c1", new MessageAttachment(`p${t}.png`, "image/png", 12, `D:/data/attachments/c1/p${t}.png`)));

    const pending = new DeferredResponse();
    context.answer(MethodName.AttachmentShare, () => pending.promise);
    fixture = TestBed.createComponent(ImagePreviewComponent);
    fixture.componentRef.setInput("image", attached);
    fixture.autoDetectChanges();
    await settle();

    expect(part<HTMLButtonElement>(".nol-teamrun-image-frame")?.disabled).toBe(true);
    AppearanceFixture.expectPixels(box(part(".nol-teamrun-image-frame")).height, height);
    pending.resolve(shared(600, 400));
    await Wait.until(() => expect(part(".nol-teamrun-image")).not.toBeNull());
  });

  it("draws only the image it shows now when that changes before the earlier one is drawn", async () => {
    const decode = ImageViewerService.decodeAsync.bind(ImageViewerService);
    let release: () => void = () => undefined;
    const held = vi.spyOn(ImageViewerService, "decodeAsync").mockImplementationOnce(async url => {
      await new Promise<void>(resolve => release = resolve);
      return decode(url);
    });
    answer();
    TestBed.configureTestingModule({ providers: [{ provide: WindowPartTokens.context, useValue: context }] });
    fixture = TestBed.createComponent(ImagePreviewComponent);
    fixture.componentRef.setInput("image", attached);
    settles = 0;
    fixture.componentInstance.settled.subscribe(() => settles++);
    fixture.autoDetectChanges();
    await Wait.until(() => expect(held).toHaveBeenCalledOnce());

    fixture.componentRef.setInput("image", ViewedImage.fromData("g1", "c1", "generated.png", "image/png", pixels(30, 20)));
    await Wait.until(() => expect(settles).toBe(1));
    release();
    await held.mock.results[0]!.value;
    await settle();

    expect([settles, part<HTMLImageElement>(".nol-teamrun-image")?.naturalWidth]).toEqual([1, 30]);
  });

  it("opens the viewer in a popup on a click, with the focus on Close, and closes it on Escape back to the image", async () => {
    await create();

    await userEvent.click(part<HTMLButtonElement>(".nol-teamrun-image-frame")!);
    await settle();

    expect(viewerShown()?.querySelector(".nol-teamrun-image-viewer-name")?.textContent?.trim()).toBe("plan.png");
    expect(document.activeElement?.classList.contains("nol-teamrun-image-close")).toBe(true);
    expect(document.querySelector("nol-tooltip")).toBeNull();
    expect(context.openedDocuments).toEqual([]);

    await pressEscape();
    expect(viewerShown()).toBeNull();
    expect(document.activeElement).toBe(part(".nol-teamrun-image-frame"));
    await userEvent.unhover(part(".nol-teamrun-image-frame")!);
  });

  it.each([{ mode: ThemeMode.Light }, { mode: ThemeMode.Dark }])("darkens the window behind the popup to about 85 percent, in one overlay over the dialog's backdrop, in $mode mode", async ({ mode }) => {
    AppearanceFixture.apply(undefined, mode);
    const alpha = (target: Element | null): number => {
      const channels = getComputedStyle(target!).backgroundColor.match(/[\d.]+/g)!.map(Number);
      return channels.length > 3 ? channels[3]! : 1;
    };
    try {
      await create();

      part<HTMLButtonElement>(".nol-teamrun-image-frame")!.click();
      await settle();
      const backdrop = alpha(document.querySelector(".nol-dialog-backdrop"));
      const overlay = alpha(document.querySelector("nol-teamrun-image-viewer .nol-teamrun-image-viewer"));

      expect([backdrop, overlay]).toEqual([0.5, 0.7]);
      expect(1 - (1 - backdrop) * (1 - overlay)).toBeCloseTo(0.85, 2);
    }
    finally {
      try {
        await pressEscape();
      }
      finally {
        AppearanceFixture.reset();
      }
    }
  });

  it("opens the image in a tab when the setting says so, and offers the popup in its menu instead, which closes back to the image", async () => {
    context.changeSetting(Resources.imageOpenModeSetting, ImageOpenMode.Tab);
    await create();

    part<HTMLButtonElement>(".nol-teamrun-image-frame")!.click();
    await settle();
    expect(context.openedDocuments).toEqual([{ name: Resources.imageDocumentName, instance: attached.toInstance(), title: "plan.png", options: undefined }]);
    expect(viewerShown()).toBeNull();

    await openMenu();
    expect(labels()).toEqual(["Open modal", "Download Image"]);
    await userEvent.click(item("Open modal"));
    await settle();
    expect(viewerShown()).not.toBeNull();
    expect(document.querySelector("nol-tooltip")).toBeNull();
    await pressEscape();
    expect(viewerShown()).toBeNull();
    expect(document.activeElement).toBe(part(".nol-teamrun-image-frame"));
    await userEvent.unhover(part(".nol-teamrun-image-frame")!);
  });

  it("offers a new tab and Download in its right-click menu, with Copy only once there's an image clipboard", async () => {
    await create();

    await openMenu();
    expect(document.querySelector("nol-menu")?.getAttribute("aria-label")).toBe(Resources.imageMenuLabel);
    expect(labels()).toEqual(["Open in a new tab", "Download Image"]);
    item("Open in a new tab").click();
    await settle();
    expect(context.openedDocuments.map(t => t.instance)).toEqual([attached.toInstance()]);
    expect(items()).toEqual([]);
  });

  it("copies the image from its menu when there's an image clipboard, and says so when it fails", async () => {
    const copied: Uint8Array[] = [];
    let answerWith = true;
    let wrote: () => void = () => undefined;
    const writing = (): Promise<void> => new Promise<void>(resolve => wrote = resolve);
    await create(attached, { writeImageAsync: png => (copied.push(png), wrote(), Promise.resolve(answerWith)) }, () => answer(30, 20));

    await openMenu();
    expect(labels()).toEqual(["Open in a new tab", "Copy Image", "Download Image"]);
    let written = writing();
    item("Copy Image").click();
    await Wait.settled(written, "the copy's write to the clipboard");
    expect(copied).toHaveLength(1);
    expect(context.noticeText()).toBeNull();

    answerWith = false;
    await openMenu();
    written = writing();
    item("Copy Image").click();
    await Wait.settled(written, "the copy's write to the clipboard");
    await Wait.until(() => expect(context.noticeText()).toBe(Resources.imageCopyFailed));
  });

  it("holds Copy Image in its menu while a copy runs, and copies once without calling the held copy a failure", async () => {
    const answers: ((value: boolean) => void)[] = [];
    let wrote: () => void = () => undefined;
    const written = new Promise<void>(resolve => wrote = resolve);
    await create(attached, { writeImageAsync: () => (wrote(), new Promise<boolean>(resolve => answers.push(resolve))) }, () => answer(30, 20));

    await openMenu();
    item("Copy Image").click();
    await Wait.settled(written, "the copy's write to the clipboard");
    expect(answers).toHaveLength(1);
    await openMenu();
    expect(item("Copy Image").getAttribute("aria-disabled") === "true").toBe(true);
    item("Copy Image").click();
    await settle();
    expect([answers.length, context.noticeText()]).toEqual([1, null]);

    answers[0]!(true);
    await Wait.until(() => expect(ImageViewerService.of(context).copying()).toBe(false));
    await openMenu();
    expect(item("Copy Image").getAttribute("aria-disabled") === "true").toBe(false);
  });

  it("copies the image through the clipboard writer the window provides, putting the image's PNG bytes on it", async () => {
    const writer = new ClipboardWriterFixture();
    let wrote: () => void = () => undefined;
    const written = new Promise<void>(resolve => wrote = resolve);
    writer.answer = () => (wrote(), Promise.resolve(true));
    await create(attached, writer, () => answer(30, 20));

    await openMenu();
    expect(labels()).toEqual(["Open in a new tab", "Copy Image", "Download Image"]);
    item("Copy Image").click();
    await Wait.settled(written, "the copy's write to the clipboard");
    expect(writer.images).toHaveLength(1);
    expect([...writer.images[0]!]).toEqual([...Uint8Array.from(atob(pixels(30, 20)), t => t.charCodeAt(0))]);
  });

  it("saves the image from its menu, and says so in the conversation when the save fails", async () => {
    await create();

    await openMenu();
    item("Download Image").click();
    await Wait.until(() => expect(context.savedFiles.map(t => t.name)).toEqual(["plan.png"]));
    expect(context.noticeText()).toBeNull();

    context.saveOutcome = FileSaveOutcome.Failed;
    await openMenu();
    item("Download Image").click();
    await Wait.until(() => expect(context.noticeText()).toBe(Resources.imageSaveFailed));
  });

  it("draws an SVG a reply wrote only as an image, so its script, onload handler and outside image never run", async () => {
    await create(ViewedImage.written("c1", "m4", "D:/work/app/unsafe.svg"), null,
      () => context.answer(MethodName.WrittenImageRead, () => new AttachmentContent("unsafe.svg", "image/svg+xml", 4, unsafe).toJson()));

    expectDrawnAsAnImage(part<HTMLImageElement>(".nol-teamrun-image"), element());
  });

  it("shows a generated image from its own bytes, with no read", async () => {
    await create(ViewedImage.fromData("d7", "c1", "Generated image", "image/png", pixels(30, 20)), null, () => undefined);

    expect(part(".nol-teamrun-image-caption")?.textContent?.trim()).toBe("Generated image");
    expect([context.count(MethodName.AttachmentRead), context.count(MethodName.AttachmentShare)]).toEqual([0, 0]);
  });

  it("shows an attachment from the address its share gives, reading none of its bytes, and from a second share when the first address fails", async () => {
    const addresses = ["data:image/png;base64,AAAA", `data:image/png;base64,${pixels(60, 40)}`];
    await create(attached, null, () => context.answer(MethodName.AttachmentShare, () => context.share(addresses.shift() ?? "data:image/png;base64,AAAA")));
    const image = part<HTMLImageElement>(".nol-teamrun-image");

    expect([image?.src, image?.naturalWidth]).toEqual([`data:image/png;base64,${pixels(60, 40)}`, 60]);
    expect([context.count(MethodName.AttachmentShare), context.count(MethodName.AttachmentRead), context.discardedGrants]).toEqual([2, 0, ["1".padStart(32, "0")]]);
  });

  describe.each([
    { look: "the fixture theme", mode: ThemeMode.Light, forcedColors: "none" },
    { look: "dark", mode: ThemeMode.Dark, forcedColors: "none" },
    { look: "forced colors", mode: ThemeMode.Light, forcedColors: "active" }
  ])("in $look", ({ mode, forcedColors }) => {
    const space = (step: number): number => AppearanceFixture.measureLook(`space-${step}`);
    const border = (): number => AppearanceFixture.measureLook("border-width");
    let hovered: Element | null = null;

    beforeAll(() => EmulatedMediaFixture.emulateAsync("forced-colors", forcedColors));

    beforeEach(() => AppearanceFixture.apply(FixtureTheme.theme, mode));

    afterEach(async () => {
      const caption = hovered;
      hovered = null;
      try {
        if (!Object.isNull(caption)) {
          await userEvent.unhover(caption);
          await Wait.until(() => expect(document.querySelector(".cdk-overlay-container nol-tooltip")).toBeNull());
        }
      }
      finally {
        AppearanceFixture.reset();
      }
    });

    afterAll(() => EmulatedMediaFixture.resetAsync());

    it("draws a tall image at most 24rem high in its own proportions, framed, with the muted caption right under it", async () => {
      await create();
      const frame = box(part(".nol-teamrun-image-frame"));
      const image = box(part(".nol-teamrun-image"));
      const caption = box(part(".nol-teamrun-image-caption"));
      const style = getComputedStyle(part(".nol-teamrun-image-frame")!);

      AppearanceFixture.expectPixels(frame.height, Math.min(400, AppearanceFixture.toPixels(24)));
      AppearanceFixture.expectPixels(frame.width, frame.height * 1.5);
      AppearanceFixture.expectPixels(image.width, frame.width - 2 * border());
      AppearanceFixture.expectPixels(Number.parseFloat(style.borderTopWidth), border());
      AppearanceFixture.expectPixels(caption.top - frame.bottom, space(1));
      AppearanceFixture.expectPixels(caption.left, frame.left);
      expect(matchMedia("(forced-colors: active)").matches).toBe(forcedColors === "active");
    });

    it("sets the text it falls back to in its surrounding text's colour, size and line, from its start edge", async () => {
      await create(attached, null, () => context.fail(MethodName.AttachmentShare, "The attachment is gone."));
      element().style.fontSize = "1.125rem";
      fixture.componentRef.setInput("fallback", "the plan");
      await settle();
      const text = part(".nol-teamrun-image-fallback")!;
      const style = getComputedStyle(text);
      const host = getComputedStyle(element());

      expect([style.color, style.fontSize, style.lineHeight, style.display]).toEqual([host.color, host.fontSize, host.lineHeight, "inline"]);
      AppearanceFixture.expectPixels(Number.parseFloat(style.fontSize), AppearanceFixture.toPixels(1.125));
      AppearanceFixture.expectPixels(box(text).left, box(element()).left);
      expect(Math.abs(box(text).top + box(text).height / 2 - (box(element()).top + box(element()).height / 2))).toBeLessThanOrEqual(0.5);
    });

    it("keeps a long name under a small image to one line within the image's width, ending in an ellipsis, with the full name in its tooltip", async () => {
      const long = "a-very-long-generated-chart-name-that-runs-past-its-image.png";
      await create(ViewedImage.fromData("g2", "c1", long, "image/png", pixels(30, 20)));
      const frame = box(part(".nol-teamrun-image-frame"));
      const caption = part(".nol-teamrun-image-caption")!;
      const style = getComputedStyle(caption);

      expect(caption.textContent?.trim()).toBe(long);
      AppearanceFixture.expectPixels(box(caption).width, frame.width);
      expect(box(caption).height).toBeLessThan(2 * Number.parseFloat(style.fontSize));
      expect([style.whiteSpace, style.textOverflow]).toEqual(["nowrap", "ellipsis"]);
      expect(caption.scrollWidth).toBeGreaterThan(caption.clientWidth);

      hovered = caption;
      await userEvent.hover(caption);
      await Wait.until(() => expect(document.querySelector(".cdk-overlay-container nol-tooltip")?.textContent?.trim()).toBe(long));
    });

    it("draws an SVG a reply wrote framed at the size it gives, and one that gives none at a browser's size for an image without one", async () => {
      const svg = (size: string): string => btoa(`<svg xmlns="http://www.w3.org/2000/svg"${size}><rect width="100%" height="100%" fill="red"/></svg>`);
      await create(ViewedImage.written("c1", "m4", "D:/work/app/diagram.svg"), null,
        () => context.answer(MethodName.WrittenImageRead, () => new AttachmentContent("diagram.svg", "image/svg+xml", 4, svg(' width="120" height="60"')).toJson()));
      const frame = box(part(".nol-teamrun-image-frame"));
      const image = box(part(".nol-teamrun-image"));

      AppearanceFixture.expectPixels(frame.width, 120);
      AppearanceFixture.expectPixels(frame.height, 60);
      AppearanceFixture.expectPixels(image.width, frame.width - 2 * border());
      AppearanceFixture.expectPixels(image.left - frame.left, border());
      AppearanceFixture.expectPixels(box(part(".nol-teamrun-image-caption")).left, frame.left);
      expect(part(".nol-teamrun-image-caption")?.textContent?.trim()).toBe("diagram.svg");
      fixture.destroy();
      ImageViewerService.release(context);

      context.answer(MethodName.WrittenImageRead, () => new AttachmentContent("diagram.svg", "image/svg+xml", 4, svg("")).toJson());
      fixture = TestBed.createComponent(ImagePreviewComponent);
      fixture.componentRef.setInput("image", ViewedImage.written("c1", "m5", "D:/work/app/diagram.svg"));
      fixture.autoDetectChanges();
      await Wait.until(() => expect(part(".nol-teamrun-image")).not.toBeNull());
      await settle();
      AppearanceFixture.expectPixels(box(part(".nol-teamrun-image-frame")).width, 300);
      AppearanceFixture.expectPixels(box(part(".nol-teamrun-image-frame")).height, 150);
    });

    it("frames an SVG that gives only a viewBox, or its size in percent, at the viewBox's size, drawn to the frame with no letterbox", async () => {
      const svg = (attributes: string): string => btoa(`<svg xmlns="http://www.w3.org/2000/svg"${attributes}><rect width="100%" height="100%" fill="red"/></svg>`);
      const expectFramed = (): void => {
        const frame = box(part(".nol-teamrun-image-frame"));
        const image = box(part(".nol-teamrun-image"));
        AppearanceFixture.expectPixels(frame.width, 120);
        AppearanceFixture.expectPixels(frame.height, 60);
        AppearanceFixture.expectPixels(image.width, frame.width - 2 * border());
        AppearanceFixture.expectPixels(image.height, frame.height - 2 * border());
        AppearanceFixture.expectPixels(image.top - frame.top, border());
        AppearanceFixture.expectPixels(image.left - frame.left, border());
      };
      await create(ViewedImage.written("c1", "m6", "D:/work/app/diagram.svg"), null,
        () => context.answer(MethodName.WrittenImageRead, () => new AttachmentContent("diagram.svg", "image/svg+xml", 4, svg(' viewBox="0 0 120 60"')).toJson()));
      expectFramed();
      fixture.destroy();
      ImageViewerService.release(context);

      context.answer(MethodName.WrittenImageRead,
        () => new AttachmentContent("diagram.svg", "image/svg+xml", 4, svg(' width="100%" height="100%" viewBox="0 0 120 60"')).toJson());
      fixture = TestBed.createComponent(ImagePreviewComponent);
      fixture.componentRef.setInput("image", ViewedImage.written("c1", "m7", "D:/work/app/diagram.svg"));
      fixture.autoDetectChanges();
      await Wait.until(() => expect(part(".nol-teamrun-image")).not.toBeNull());
      await settle();
      expectFramed();
    });

    it("keeps a small image at its own size, and a wide one within its column", async () => {
      await create(attached, null, () => answer(30, 20));
      AppearanceFixture.expectPixels(box(part(".nol-teamrun-image-frame")).width, 30);
      fixture.destroy();
      ImageViewerService.release(context);

      answer(2000, 400);
      fixture = TestBed.createComponent(ImagePreviewComponent);
      fixture.componentRef.setInput("image", ViewedImage.of("c1", new MessageAttachment("wide.png", "image/png", 12, "D:/data/attachments/c1/wide.png")));
      (fixture.nativeElement as HTMLElement).style.width = "200px";
      fixture.autoDetectChanges();
      await Wait.until(() => expect(part(".nol-teamrun-image")).not.toBeNull());
      await settle();

      AppearanceFixture.expectPixels(box(part(".nol-teamrun-image-frame")).width, 200);
      AppearanceFixture.expectPixels(box(part(".nol-teamrun-image-frame")).height, 40);
    });
  });

  describe("under forced colours and at 200% zoom", () => {
    it("keeps every control, state and focus ring in the image preview visible under forced colours", async () => {
      await create();
      await AccessibilityFixture.expectVisibleForcedAsync(element());
    });

    it("neither cuts, crosses nor loses a control in the image preview at 200% zoom", async () => {
      await create();
      await AccessibilityFixture.expectFitsZoomedAsync(element(), settle);
    });

    it("keeps every control, state and focus ring in the image dialog visible under forced colours", async () => {
      await create();
      part<HTMLButtonElement>(".nol-teamrun-image-frame")?.click();
      await settle();
      await AccessibilityFixture.expectVisibleForcedAsync(popup());
      expect(viewerShown()?.getBoundingClientRect().toJSON()).toEqual(new DOMRect(0, 0, document.documentElement.clientWidth, document.documentElement.clientHeight).toJSON());
      await pressEscape();
    });

    it("neither cuts, crosses nor loses a control in the image dialog at 200% zoom", async () => {
      await create();
      part<HTMLButtonElement>(".nol-teamrun-image-frame")?.click();
      await settle();
      await AccessibilityFixture.expectFitsZoomedAsync(popup(), settle);
      await pressEscape();
    });
  });

  describe("by keyboard and screen reader", () => {
    it("reaches every control in the image preview by keyboard, with a visible ring", async () => {
      await create();
      expect(await AccessibilityFixture.expectKeyboardAsync(element())).toBeGreaterThan(0);
    });

    it("names every control, dialog, list and image in the image preview", async () => {
      await create();
      expect(AccessibilityFixture.expectNamed(element())).toBeGreaterThan(0);
    });

    it("reaches every control in the image dialog by keyboard, with a visible ring", async () => {
      await create();
      part<HTMLButtonElement>(".nol-teamrun-image-frame")?.click();
      await settle();
      expect(await AccessibilityFixture.expectKeyboardAsync(popup())).toBeGreaterThan(0);
      await pressEscape();
    });

    it("names every control, dialog, list and image in the image dialog", async () => {
      await create();
      part<HTMLButtonElement>(".nol-teamrun-image-frame")?.click();
      await settle();
      expect(AccessibilityFixture.expectNamed(popup())).toBeGreaterThan(0);
      await pressEscape();
    });
  });
});
