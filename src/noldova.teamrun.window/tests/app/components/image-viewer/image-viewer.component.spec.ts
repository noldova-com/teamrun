/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type ComponentFixture, TestBed } from "@angular/core/testing";

import "@noldova/context.core";
import { FileSaveOutcome } from "@noldova/desktop.window";
import { MessageAttachment, MethodName } from "@noldova/teamrun.protocol";
import { AnnouncementPoliteness, Announcer, ThemeMode } from "@noldova/ui.components.angular";
import { AppearanceFixture, FixtureTheme } from "@noldova/ui.components.angular/testing";

import { ImageViewerComponent } from "../../../../src/app/components/image-viewer/image-viewer.component";
import type { IImageClipboard } from "../../../../src/app/interfaces/i-image-clipboard";
import { ImageViewerData } from "../../../../src/app/models/image-viewer-data";
import { ViewedImage } from "../../../../src/app/models/viewed-image";
import { ChatStoreService } from "../../../../src/app/services/chat-store.service";
import { ClockService } from "../../../../src/app/services/clock.service";
import { ImageViewerService } from "../../../../src/app/services/image-viewer.service";
import { Resources } from "../../../../src/resources";
import { AccessibilityFixture } from "../../../fixtures/accessibility.fixture";
import { EmulatedMediaFixture } from "../../../fixtures/emulated-media.fixture";
import { FakeClock } from "../../../fixtures/fake-clock.fixture";
import type { FakeWindowPartContext } from "../../../fixtures/fake-window-part-context.fixture";
import { SampleData } from "../../../fixtures/sample-data.fixture";
import { Wait } from "../../../fixtures/wait.fixture";

describe("ImageViewerComponent", () => {
  let context: FakeWindowPartContext;
  let fixture: ComponentFixture<ImageViewerComponent>;
  let closes: number;

  const pixels = (width: number, height: number, fill: string = "transparent"): string => {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const drawing = canvas.getContext("2d")!;
    drawing.fillStyle = fill;
    drawing.fillRect(0, 0, width, height);
    const url = canvas.toDataURL("image/png");
    return url.slice(url.indexOf(",") + 1);
  };
  const image = (name: string, width: number, height: number): ViewedImage => ViewedImage.fromData(name, "c1", name, "image/png", pixels(width, height));
  const element = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const part = <T extends HTMLElement = HTMLElement>(selector: string): T | null => element().querySelector<T>(selector);
  const button = (selector: string): HTMLButtonElement => part<HTMLButtonElement>(selector)!;
  const box = (target: Element | null): DOMRect => target?.getBoundingClientRect() ?? new DOMRect();
  const name = (): string | undefined => part(".nol-teamrun-image-viewer-name")?.textContent?.trim();
  const percent = (): string | undefined => part(".nol-teamrun-zoom-fit")?.textContent?.trim();
  const items = (): string[] => [...document.querySelectorAll("button[nol-menu-item] .nol-menu-item-label")].map(t => t.textContent!.trim());
  const scrollbar = "0.375rem";
  const room = (): [number, number] => {
    const viewport = part(".nol-teamrun-image-viewer-viewport")!;
    return [viewport.clientWidth, viewport.clientHeight];
  };
  const loaded = async (check: () => void): Promise<void> => {
    await fixture.whenStable();
    check();
  };
  const settle = async (): Promise<void> => {
    await fixture.whenStable();
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    await fixture.whenStable();
  };
  const create = async (shown: ViewedImage, images: readonly ViewedImage[] = [], embedded: boolean = false, clipboard: IImageClipboard | null = null): Promise<void> => {
    fixture = TestBed.createComponent(ImageViewerComponent);
    fixture.componentRef.setInput("data", new ImageViewerData(shown, images));
    fixture.componentRef.setInput("viewer", ImageViewerService.of(context, clipboard));
    fixture.componentRef.setInput("embedded", embedded);
    if (embedded)
      element().style.height = "30rem";
    closes = 0;
    fixture.componentInstance.closed.subscribe(() => closes++);
    fixture.autoDetectChanges();
    await loaded(() => expect(part('[role="status"]')).toBeNull());
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
  const press = async (key: string, ctrlKey: boolean = false): Promise<void> => {
    element().dispatchEvent(new KeyboardEvent("keydown", { key, ctrlKey, bubbles: true, cancelable: true }));
    await settle();
  };
  const click = async (target: HTMLElement): Promise<void> => {
    target.click();
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

  it("names the image in its header beside Download and Close, with Copy only once there's an image clipboard", async () => {
    await create(image("plan.png", 30, 20));

    expect(name()).toBe("plan.png");
    expect(button(".nol-teamrun-image-download").getAttribute("aria-label")).toBe(Resources.downloadImageLabel);
    expect(button(".nol-teamrun-image-close").getAttribute("aria-label")).toBe(Resources.closeLabel);
    expect(part(".nol-teamrun-image-copy")).toBeNull();
    fixture.destroy();
    ImageViewerService.release(context);

    await create(image("plan.png", 30, 20), [], false, { writeImageAsync: () => Promise.resolve(true) });
    expect([...element().querySelectorAll(".nol-teamrun-image-viewer-header button")].map(t => t.getAttribute("aria-label")))
      .toEqual([Resources.copyImageLabel, Resources.downloadImageLabel, Resources.closeLabel]);
  });

  it("shows a chat's attachment from the address its share gives, from a second share when the first address fails, reading none of its bytes", async () => {
    const addresses = ["data:image/png;base64,AAAA", `data:image/png;base64,${pixels(30, 20)}`];
    context.answer(MethodName.AttachmentShare, () => context.share(addresses.shift() ?? "data:image/png;base64,AAAA"));
    await create(ViewedImage.of("c1", new MessageAttachment("plan.png", "image/png", 12, "D:/data/attachments/c1/plan.png")));
    const shown = part<HTMLImageElement>(".nol-teamrun-image-viewer-image");

    expect([shown?.src, shown?.naturalWidth]).toEqual([`data:image/png;base64,${pixels(30, 20)}`, 30]);
    expect([context.count(MethodName.AttachmentShare), context.count(MethodName.AttachmentRead), context.discardedGrants]).toEqual([2, 0, ["1".padStart(32, "0")]]);
  });

  it("starts a large image fitted to the space, and a small one at its own size", async () => {
    await create(image("wide.png", 4000, 3000));
    const [width, height] = room();
    const fitted = Math.min(1, width / 4000, height / 3000);

    expect(fitted).toBeLessThan(1);
    AppearanceFixture.expectPixels(box(part(".nol-teamrun-image-viewer-image")).width, 4000 * fitted);
    expect(percent()).toBe(`${Math.round(fitted * 100)}%`);
    fixture.destroy();

    await create(image("small.png", 30, 20));
    AppearanceFixture.expectPixels(box(part(".nol-teamrun-image-viewer-image")).width, 30);
    expect(percent()).toBe("100%");
  });

  it("fits a large SVG to the space like any image, and shows one that gives no size at a browser's size for an image without one", async () => {
    const svg = (size: string): ViewedImage => ViewedImage.fromData("diagram.svg", "c1", "diagram.svg", "image/svg+xml",
      btoa(`<svg xmlns="http://www.w3.org/2000/svg"${size}><rect width="100%" height="100%" fill="red"/></svg>`));
    await create(svg(' width="4000" height="3000"'));
    const [width, height] = room();
    const fitted = Math.min(1, width / 4000, height / 3000);

    expect(fitted).toBeLessThan(1);
    AppearanceFixture.expectPixels(box(part(".nol-teamrun-image-viewer-image")).width, 4000 * fitted);
    AppearanceFixture.expectPixels(box(part(".nol-teamrun-image-viewer-image")).height, 3000 * fitted);
    fixture.destroy();

    await create(svg(""));
    AppearanceFixture.expectPixels(box(part(".nol-teamrun-image-viewer-image")).width, 300);
    AppearanceFixture.expectPixels(box(part(".nol-teamrun-image-viewer-image")).height, 150);
    expect(percent()).toBe("100%");
  });

  it("shows an SVG that gives only a viewBox in the viewBox's proportions, fitted to the space when it's larger", async () => {
    await create(ViewedImage.fromData("tall.svg", "c1", "tall.svg", "image/svg+xml",
      btoa('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 30000"><rect width="100%" height="100%" fill="red"/></svg>')));
    const [width, height] = room();
    const fitted = Math.min(1, width / 600, height / 30000);

    expect(fitted).toBeLessThan(1);
    AppearanceFixture.expectPixels(box(part(".nol-teamrun-image-viewer-image")).width, 600 * fitted);
    AppearanceFixture.expectPixels(box(part(".nol-teamrun-image-viewer-image")).height, 30000 * fitted);
    expect(percent()).toBe(`${Math.round(fitted * 100)}%`);
  });

  it("shows an SVG only as an image, so its script, onload handler and outside image never run", async () => {
    await create(ViewedImage.fromData("unsafe.svg", "c1", "unsafe.svg", "image/svg+xml", unsafe));

    expectDrawnAsAnImage(part<HTMLImageElement>(".nol-teamrun-image-viewer-image"), element());
  });

  it("zooms in steps of a quarter between 10% and 400%, and fits again from the percentage, moving the focus to the other zoom button at each end", async () => {
    await create(image("small.png", 30, 20));

    button(".nol-teamrun-zoom-in").focus();
    await click(button(".nol-teamrun-zoom-in"));
    expect(percent()).toBe("125%");
    expect(document.activeElement).toBe(button(".nol-teamrun-zoom-in"));
    AppearanceFixture.expectPixels(box(part(".nol-teamrun-image-viewer-image")).width, 37.5);
    for (let step = 0; step < 6; step++)
      await click(button(".nol-teamrun-zoom-in"));
    expect([percent(), button(".nol-teamrun-zoom-in").disabled, document.activeElement]).toEqual(["400%", true, button(".nol-teamrun-zoom-out")]);

    await click(button(".nol-teamrun-zoom-fit"));
    expect(percent()).toBe("100%");
    button(".nol-teamrun-zoom-out").focus();
    for (let step = 0; step < 11; step++)
      await click(button(".nol-teamrun-zoom-out"));
    expect([percent(), button(".nol-teamrun-zoom-out").disabled, button(".nol-teamrun-zoom-in").disabled]).toEqual(["10%", true, false]);
    expect(document.activeElement).toBe(button(".nol-teamrun-zoom-in"));
  });

  it("keeps a zoom chosen from an image fitted below 100% while the scrollbars it overflows into take their space, and scrolls it", async () => {
    await create(image("wide.png", 4000, 1000), [], true);
    const viewport = part(".nol-teamrun-image-viewer-viewport")!;
    const fitted = Math.min(room()[0] / 4000, room()[1] / 1000);
    expect(fitted).toBeLessThan(1);

    await click(button(".nol-teamrun-zoom-in"));
    const zoomed = percent();
    element().style.height = `calc(30rem - ${scrollbar})`;
    for (let frame = 0; frame < 3; frame++)
      await settle();

    expect(percent()).toBe(zoomed);
    AppearanceFixture.expectPixels(box(part(".nol-teamrun-image-viewer-image")).width, 4000 * fitted * 1.25);
    expect([getComputedStyle(viewport).overflowX, getComputedStyle(viewport).overflowY]).toEqual(["auto", "auto"]);
    expect(viewport.scrollWidth).toBeGreaterThan(viewport.clientWidth);
    viewport.scrollTo(0, 0);
    viewport.scrollBy(10, 0);
    expect(viewport.scrollLeft).toBe(10);
    expect(percent()).toBe(zoomed);
  });

  it("zooms an image shown at its own size a quarter at a time past the step where it first overflows", async () => {
    await create(image("small.png", 30, 20), [], true);
    const [roomWidth, roomHeight] = room();
    const [width, height] = [Math.floor(roomWidth * 0.7), Math.floor(roomHeight * 0.7)];
    fixture.destroy();
    await create(image("fits.png", width, height), [], true);
    const viewport = part(".nol-teamrun-image-viewer-viewport")!;
    expect(percent()).toBe("100%");

    const shown: (string | undefined)[] = [];
    let overflowedAt: number | null = null;
    for (let step = 0; step < 4; step++) {
      await click(button(".nol-teamrun-zoom-in"));
      if (overflowedAt === null && (viewport.scrollWidth > viewport.clientWidth || viewport.scrollHeight > viewport.clientHeight)) {
        overflowedAt = step;
        element().style.height = `calc(30rem - ${scrollbar})`;
      }
      await settle();
      shown.push(percent());
    }

    expect([overflowedAt, shown]).toEqual([1, ["125%", "156%", "195%", "244%"]]);
    expect([viewport.scrollWidth > viewport.clientWidth, viewport.scrollHeight > viewport.clientHeight]).toEqual([true, true]);
  });

  it("fits a fitted image again when its tab resizes, and keeps a chosen zoom through a resize", async () => {
    await create(image("tall.png", 1000, 4000), [], true);
    const fitted = (): string => `${Math.round(Math.min(1, room()[0] / 1000, room()[1] / 4000) * 100)}%`;
    const first = percent();
    expect(first).toBe(fitted());

    element().style.height = "20rem";
    await Wait.until(() => expect(percent()).not.toBe(first));
    expect(percent()).toBe(fitted());

    await click(button(".nol-teamrun-zoom-in"));
    const zoomed = percent();
    element().style.height = "30rem";
    for (let frame = 0; frame < 3; frame++)
      await settle();
    expect(percent()).toBe(zoomed);
    expect(zoomed).not.toBe(fitted());
  });

  it("moves between the message's images by its arrows and the arrow keys, stopping at each end with the focus on the other arrow, and keeps their space for a single image", async () => {
    const images = [image("a.png", 30, 20), image("b.png", 30, 20), image("c.png", 30, 20)];
    await create(images[1]!, images);

    button(".nol-teamrun-image-previous").focus();
    await click(button(".nol-teamrun-image-previous"));
    expect([name(), button(".nol-teamrun-image-previous").disabled, document.activeElement]).toEqual(["a.png", true, button(".nol-teamrun-image-next")]);
    await press("ArrowLeft");
    expect(name()).toBe("a.png");
    await press("ArrowRight");
    button(".nol-teamrun-image-next").focus();
    await click(button(".nol-teamrun-image-next"));
    await Wait.until(() => expect(name()).toBe("c.png"));
    expect([button(".nol-teamrun-image-next").disabled, document.activeElement]).toEqual([true, button(".nol-teamrun-image-previous")]);
    await click(button(".nol-teamrun-image-next"));
    expect(name()).toBe("c.png");
    const start = (): number => box(part(".nol-teamrun-image-viewer-viewport")).left;
    const inset = start();
    fixture.destroy();
    await create(images[0]!);
    expect([getComputedStyle(part(".nol-teamrun-image-viewer-previous")!).visibility, getComputedStyle(part(".nol-teamrun-image-viewer-next")!).visibility])
      .toEqual(["hidden", "hidden"]);
    AppearanceFixture.expectPixels(start(), inset);
  });

  it("pans a zoomed image by the arrow keys, moves between images by Left and Right once it fits, zooms by + and -, leaving a panned view where it is at 400%, and fits by 0, without Ctrl", async () => {
    const images = [image("big.png", 2000, 2000), image("b.png", 30, 20)];
    await create(images[0]!, images, true);
    const viewport = part(".nol-teamrun-image-viewer-viewport")!;
    const fittedPercent = (): string => `${Math.round(Math.min(1, room()[0] / 2000, room()[1] / 2000) * 100)}%`;
    element().style.width = "30rem";
    await Wait.until(() => expect(percent()).toBe(fittedPercent()));
    const fitted = Math.min(1, room()[0] / 2000, room()[1] / 2000);
    const shown = percent();
    expect([viewport.scrollWidth > viewport.clientWidth, viewport.scrollHeight > viewport.clientHeight]).toEqual([false, false]);

    await press("+");
    await press("=");
    expect(percent()).toBe(`${Math.round(fitted * 1.25 * 1.25 * 100)}%`);
    expect([viewport.scrollWidth > viewport.clientWidth, viewport.scrollHeight > viewport.clientHeight]).toEqual([true, true]);
    const expectWithinPixel = (actual: number, expected: number): void => expect(Math.abs(actual - expected)).toBeLessThan(1);
    const [left, top] = [viewport.scrollLeft, viewport.scrollTop];
    await press("ArrowRight");
    await press("ArrowDown");
    expectWithinPixel(viewport.scrollLeft - left, viewport.clientWidth * 0.1);
    expectWithinPixel(viewport.scrollTop - top, viewport.clientHeight * 0.1);
    await press("ArrowLeft");
    await press("ArrowUp");
    expectWithinPixel(viewport.scrollLeft, left);
    expectWithinPixel(viewport.scrollTop, top);
    expect(name()).toBe("big.png");
    for (let step = 0; step < 30 && percent() !== "400%"; step++)
      await press("+");
    await settle();
    await press("ArrowRight");
    const panned = [percent(), viewport.scrollLeft, viewport.scrollTop];
    await press("+");
    await settle();
    expect([percent(), viewport.scrollLeft, viewport.scrollTop]).toEqual(panned);
    expect(panned[0]).toBe("400%");

    await press("0");
    await Wait.until(() => expect(percent()).toBe(shown));
    await press("ArrowRight");
    await loaded(() => expect([name(), part<HTMLImageElement>(".nol-teamrun-image-viewer-image")?.naturalWidth]).toEqual(["b.png", 30]));
    await settle();
    await press("-");
    expect(percent()).toBe("80%");
    await press("+", true);
    expect(percent()).toBe("80%");
    await press("0");

    expect(percent()).toBe("100%");
  });

  it("closes a popup from Close, Escape, Ctrl+W and a click around the image, but not from a click on it", async () => {
    await create(image("small.png", 30, 20));

    await click(part(".nol-teamrun-image-viewer-image")!);
    expect(closes).toBe(0);
    await click(part(".nol-teamrun-image-viewer-canvas")!);
    await click(part(".nol-teamrun-image-viewer")!);
    await press("Escape");
    await press("w", true);
    await click(button(".nol-teamrun-image-close"));
    expect(closes).toBe(5);
  });

  it("in a tab, takes the focus, has no Close, and leaves Escape, Ctrl+W and clicks around the image to the window", async () => {
    await create(image("small.png", 30, 20), [], true);

    expect(document.activeElement).toBe(element());
    expect(part(".nol-teamrun-image-close")).toBeNull();
    await press("Escape");
    await press("w", true);
    await click(part(".nol-teamrun-image-viewer-canvas")!);
    expect(closes).toBe(0);
  });

  it.each([
    { kind: "drawn", shown: ViewedImage.fromData("x", "c1", "broken.png", "image/png", "AAAA") },
    { kind: "read", shown: new ViewedImage("k", null, "lost.png", "image/png", null, null) }
  ])("says when the image can't be $kind, with Download and zoom held", async ({ shown }) => {
    fixture = TestBed.createComponent(ImageViewerComponent);
    fixture.componentRef.setInput("data", new ImageViewerData(shown));
    fixture.componentRef.setInput("viewer", ImageViewerService.of(context));
    fixture.autoDetectChanges();

    await loaded(() => expect(part('[role="status"]')?.textContent?.trim()).toBe(Resources.imageLoadFailed));
    expect([button(".nol-teamrun-image-download").disabled, button(".nol-teamrun-zoom-in").disabled, button(".nol-teamrun-zoom-fit").disabled])
      .toEqual([true, true, true]);
  });

  it("draws Copy, Download and the zoom already held while the image loads, so each changes only once, when the image is drawn", async () => {
    const property = Object.getOwnPropertyDescriptor(HTMLButtonElement.prototype, "disabled");
    const changes: string[] = [];
    vi.spyOn(HTMLButtonElement.prototype, "disabled", "set").mockImplementation(function (this: HTMLButtonElement, value: boolean) {
      const before = property?.get?.call(this);
      property?.set?.call(this, value);
      if (before !== value)
        changes.push(`${[...this.classList].find(t => t.startsWith("nol-teamrun-")) ?? ""} ${value}`);
    });
    await create(image("plan.png", 30, 20), [], false, { writeImageAsync: () => Promise.resolve(true) });

    expect(changes.toSorted()).toEqual(["nol-teamrun-image-copy false", "nol-teamrun-image-download false", "nol-teamrun-image-next true",
      "nol-teamrun-image-previous true", "nol-teamrun-zoom-fit false", "nol-teamrun-zoom-in false", "nol-teamrun-zoom-out false"]);
  });

  it("saves the shown image from its header and its right-click menu, and says when a save fails", async () => {
    await create(image("small.png", 30, 20));

    await click(button(".nol-teamrun-image-download"));
    await Wait.until(() => expect(context.savedFiles.map(t => t.name)).toEqual(["small.png"]));
    expect(part('[role="alert"]')).toBeNull();

    const shown = part(".nol-teamrun-image-viewer-image")!;
    shown.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, button: 2, clientX: box(shown).left, clientY: box(shown).top }));
    await settle();
    expect(items()).toEqual([Resources.downloadImageLabel]);
    context.saveOutcome = FileSaveOutcome.Failed;
    document.querySelector<HTMLButtonElement>("button[nol-menu-item]")!.click();
    await Wait.until(() => expect(part('[role="alert"]')?.textContent?.trim()).toBe(Resources.imageSaveFailed));
    expect(context.savedFiles).toHaveLength(2);
  });

  it("copies the shown image from its header and its right-click menu, and says when a copy fails", async () => {
    const copied: Uint8Array[] = [];
    let answer = true;
    let wrote: () => void = () => undefined;
    const writing = (): Promise<void> => new Promise<void>(resolve => wrote = resolve);
    await create(image("small.png", 30, 20), [], false, { writeImageAsync: png => (copied.push(png), wrote(), Promise.resolve(answer)) });

    let written = writing();
    await click(button(".nol-teamrun-image-copy"));
    await Wait.settled(written, "the copy's write to the clipboard");
    expect(copied).toHaveLength(1);
    expect(part('[role="alert"]')).toBeNull();

    const shown = part(".nol-teamrun-image-viewer-image")!;
    shown.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, button: 2, clientX: box(shown).left, clientY: box(shown).top }));
    await settle();
    expect(items()).toEqual([Resources.copyImageLabel, Resources.downloadImageLabel]);
    answer = false;
    written = writing();
    document.querySelector<HTMLButtonElement>("button[nol-menu-item]")!.click();
    await Wait.settled(written, "the copy's write to the clipboard");
    await Wait.until(() => expect(part('[role="alert"]')?.textContent?.trim()).toBe(Resources.imageCopyFailed));
    expect(copied).toHaveLength(2);
  });

  it("shows Copied with a check for a moment after a copy, says so politely, and shows Copy Image again once the moment passes or the image changes", async () => {
    let answer = true;
    const images = [image("first.png", 30, 20), image("second.png", 30, 20)];
    let wrote: () => void = () => undefined;
    const writing = (): Promise<void> => new Promise<void>(resolve => wrote = resolve);
    const clock = new FakeClock(0);
    TestBed.configureTestingModule({ providers: [{ provide: ClockService, useValue: clock }] });
    await create(images[0]!, images, false, { writeImageAsync: () => (wrote(), Promise.resolve(answer)) });
    const announce = vi.spyOn(TestBed.inject(Announcer), "announce");
    const copy = (): HTMLButtonElement => button(".nol-teamrun-image-copy");
    const shown = (): (string | null | undefined)[] =>
      [copy().getAttribute("aria-label"), copy().querySelector(".nol-icon-button-glyph")?.textContent?.trim()];

    let written = writing();
    await click(copy());
    await Wait.settled(written, "the copy's write to the clipboard");
    await Wait.until(() => expect(shown()).toEqual([Resources.copiedImageLabel, Resources.copiedImageGlyph]));
    expect(announce.mock.calls).toEqual([[Resources.copiedImageLabel, AnnouncementPoliteness.Polite]]);
    expect(clock.remaining).toEqual([1500]);
    clock.advance(1500);
    await settle();
    expect(shown()).toEqual([Resources.copyImageLabel, Resources.copyImageGlyph]);

    written = writing();
    await click(copy());
    await Wait.settled(written, "the copy's write to the clipboard");
    await Wait.until(() => expect(shown()[0]).toBe(Resources.copiedImageLabel));
    await press("ArrowRight");
    expect([name(), ...shown()]).toEqual(["second.png", Resources.copyImageLabel, Resources.copyImageGlyph]);

    answer = false;
    await loaded(() => expect(copy().disabled).toBe(false));
    written = writing();
    await click(copy());
    await Wait.settled(written, "the copy's write to the clipboard");
    await Wait.until(() => expect(part('[role="alert"]')?.textContent?.trim()).toBe(Resources.imageCopyFailed));
    expect([shown(), announce.mock.calls.length]).toEqual([[Resources.copyImageLabel, Resources.copyImageGlyph], 2]);
  });

  it("holds every Copy Image while a copy runs, and copies once", async () => {
    const answers: ((value: boolean) => void)[] = [];
    let wrote: () => void = () => undefined;
    const written = new Promise<void>(resolve => wrote = resolve);
    await create(image("small.png", 30, 20), [], false, { writeImageAsync: () => (wrote(), new Promise<boolean>(resolve => answers.push(resolve))) });
    const copy = button(".nol-teamrun-image-copy");

    copy.focus();
    await click(copy);
    await Wait.settled(written, "the copy's write to the clipboard");
    expect(answers).toHaveLength(1);
    await settle();
    expect([copy.disabled, copy.getAttribute("aria-disabled"), document.activeElement === copy]).toEqual([false, "true", true]);
    await click(copy);
    const shown = part(".nol-teamrun-image-viewer-image")!;
    shown.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, button: 2, clientX: box(shown).left, clientY: box(shown).top }));
    await settle();
    const item = document.querySelector<HTMLButtonElement>("button[nol-menu-item]")!;
    expect([item.querySelector(".nol-menu-item-label")?.textContent?.trim(), item.getAttribute("aria-disabled") === "true"]).toEqual([Resources.copyImageLabel, true]);
    item.click();
    await settle();
    expect(answers).toHaveLength(1);
    document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));

    answers[0]!(true);
    await Wait.until(() => expect(copy.getAttribute("aria-disabled")).toBeNull());
    expect(copy.getAttribute("aria-label")).toBe(Resources.copiedImageLabel);
  });

  it("shows no Copied for an image it stepped past while copying it", async () => {
    const answers: ((value: boolean) => void)[] = [];
    const images = [image("first.png", 30, 20), image("second.png", 30, 20)];
    let wrote: () => void = () => undefined;
    const written = new Promise<void>(resolve => wrote = resolve);
    await create(images[0]!, images, false, { writeImageAsync: () => (wrote(), new Promise<boolean>(resolve => answers.push(resolve))) });

    await click(button(".nol-teamrun-image-copy"));
    await Wait.settled(written, "the copy's write to the clipboard");
    expect(answers).toHaveLength(1);
    await press("ArrowRight");
    answers[0]!(true);
    await Wait.until(() => expect(button(".nol-teamrun-image-copy").getAttribute("aria-disabled")).toBeNull());

    expect([name(), button(".nol-teamrun-image-copy").getAttribute("aria-label"), part('[role="alert"]')]).toEqual(["second.png", Resources.copyImageLabel, null]);
  });

  it("clears a failed copy or download only when the same action next succeeds", async () => {
    let answer = true;
    let wrote: () => void = () => undefined;
    const writing = (): Promise<void> => new Promise<void>(resolve => wrote = resolve);
    await create(image("small.png", 30, 20), [], false, { writeImageAsync: () => (wrote(), Promise.resolve(answer)) });
    const alert = (): string | undefined => part('[role="alert"]')?.textContent?.trim();

    context.saveOutcome = FileSaveOutcome.Failed;
    await click(button(".nol-teamrun-image-download"));
    await Wait.until(() => expect(alert()).toBe(Resources.imageSaveFailed));
    let written = writing();
    await click(button(".nol-teamrun-image-copy"));
    await Wait.settled(written, "the copy's write to the clipboard");
    await Wait.until(() => expect(button(".nol-teamrun-image-copy").getAttribute("aria-label")).toBe(Resources.copiedImageLabel));
    expect(alert()).toBe(Resources.imageSaveFailed);

    answer = false;
    written = writing();
    await click(button(".nol-teamrun-image-copy"));
    await Wait.settled(written, "the copy's write to the clipboard");
    await Wait.until(() => expect(alert()).toBe(Resources.imageCopyFailed));
    context.saveOutcome = FileSaveOutcome.Saved;
    await click(button(".nol-teamrun-image-download"));
    await Wait.until(() => expect(context.savedFiles).toHaveLength(2));
    expect(alert()).toBe(Resources.imageCopyFailed);

    answer = true;
    written = writing();
    await click(button(".nol-teamrun-image-copy"));
    await Wait.settled(written, "the copy's write to the clipboard");
    await Wait.until(() => expect(alert()).toBeUndefined());
  });

  it("leaves a key that a part inside it already handled", async () => {
    await create(image("small.png", 30, 20));
    const inside = part(".nol-teamrun-image-viewer-viewport")!;
    inside.addEventListener("keydown", event => event.preventDefault());

    inside.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
    await settle();

    expect(closes).toBe(0);
  });

  it("keeps an image at its own size while its tab has no room, and fits it once the tab has room", async () => {
    fixture = TestBed.createComponent(ImageViewerComponent);
    fixture.componentRef.setInput("data", new ImageViewerData(image("wide.png", 4000, 3000)));
    fixture.componentRef.setInput("viewer", ImageViewerService.of(context));
    fixture.componentRef.setInput("embedded", true);
    element().style.display = "none";
    fixture.autoDetectChanges();
    await loaded(() => expect(part(".nol-teamrun-image-viewer-image")).not.toBeNull());
    await settle();
    expect(percent()).toBe("100%");

    element().style.display = String.empty;
    element().style.height = "0";
    await settle();
    expect(percent()).toBe("100%");

    element().style.height = "30rem";
    await Wait.until(() => expect(percent()).not.toBe("100%"));
    const viewport = box(part(".nol-teamrun-image-viewer-viewport"));
    expect(percent()).toBe(`${Math.round(Math.min(viewport.width / 4000, viewport.height / 3000) * 100)}%`);
  });

  it("holds the window unstable while the image it moved to is drawn, and shows only that image when it moves on before the earlier one is drawn", async () => {
    const images = [image("a.png", 30, 20), image("b.png", 40, 20)];
    await create(images[0]!, images);
    const decode = ImageViewerService.decodeAsync.bind(ImageViewerService);
    let release: () => void = () => undefined;
    let reached: () => void = () => undefined;
    const drawing = new Promise<void>(resolve => reached = resolve);
    const held = vi.spyOn(ImageViewerService, "decodeAsync").mockImplementationOnce(async url => {
      reached();
      await new Promise<void>(resolve => release = resolve);
      return decode(url);
    });

    element().dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true, cancelable: true }));
    await drawing;
    const stableWhileDrawing = fixture.isStable();
    await press("ArrowLeft");
    expect(stableWhileDrawing).toBe(false);
    await loaded(() => expect(part<HTMLImageElement>(".nol-teamrun-image-viewer-image")?.naturalWidth).toBe(30));
    release();
    await held.mock.results[0]!.value;
    await settle();

    expect([name(), part<HTMLImageElement>(".nol-teamrun-image-viewer-image")?.naturalWidth]).toEqual(["a.png", 30]);
  });

  describe.each([
    { look: "the fixture theme", mode: ThemeMode.Light, forcedColors: "none" },
    { look: "dark", mode: ThemeMode.Dark, forcedColors: "none" },
    { look: "forced colors", mode: ThemeMode.Light, forcedColors: "active" }
  ])("in $look", ({ mode, forcedColors }) => {
    const space = (step: number): number => AppearanceFixture.measureLook(`space-${step}`);
    const colorOf = (token: string): string => {
      const probe = document.body.appendChild(document.createElement("div"));
      probe.style.color = `var(--nol-${token})`;
      const color = getComputedStyle(probe).color;
      probe.remove();
      return color;
    };

    beforeAll(() => EmulatedMediaFixture.emulateAsync("forced-colors", forcedColors));

    beforeEach(() => AppearanceFixture.apply(FixtureTheme.theme, mode));

    afterEach(() => AppearanceFixture.reset());

    afterAll(() => EmulatedMediaFixture.resetAsync());

    it.each([
      { form: "popup", embedded: false },
      { form: "tab", embedded: true }
    ])("scrolls a zoomed image between the arrows in a $form, a gap from each, where the fitted image sits", async ({ embedded }) => {
      const images = [image("a.png", 4000, 100), image("b.png", 30, 20)];
      await create(images[0]!, images, embedded);
      const viewport = part(".nol-teamrun-image-viewer-viewport")!;
      const [pane, frame, previous, next] = [box(element()), box(viewport), box(part(".nol-teamrun-image-viewer-previous")), box(part(".nol-teamrun-image-viewer-next"))];

      AppearanceFixture.expectPixels(previous.left - pane.left, space(4));
      AppearanceFixture.expectPixels(pane.right - next.right, space(4));
      AppearanceFixture.expectPixels(frame.left, previous.right + space(3));
      AppearanceFixture.expectPixels(frame.right, next.left - space(3));
      AppearanceFixture.expectPixels(box(part(".nol-teamrun-image-viewer-image")).left, previous.right + space(3));

      for (let step = 0; step < 4; step++)
        await click(button(".nol-teamrun-zoom-in"));
      viewport.scrollTo(0, 0);
      await settle();

      expect(viewport.scrollWidth).toBeGreaterThan(viewport.clientWidth);
      expect(box(part(".nol-teamrun-image-viewer-image")).right).toBeGreaterThan(box(viewport).right);
      AppearanceFixture.expectPixels(box(viewport).left, previous.right + space(3));
      AppearanceFixture.expectPixels(box(viewport).right, next.left - space(3));
      viewport.scrollTo(viewport.scrollWidth, 0);
      await settle();
      const end = box(part(".nol-teamrun-image-viewer-image")).right - box(viewport).left - viewport.clientLeft + viewport.scrollLeft;

      expect(Math.abs(viewport.scrollWidth - viewport.clientWidth - viewport.scrollLeft)).toBeLessThan(1);
      expect(Math.abs(viewport.scrollWidth - end)).toBeLessThan(1);
    });

    it("closes a popup from a click in the gap beside the image on either side, between it and the arrows", async () => {
      const images = [image("a.png", 30, 20), image("b.png", 30, 20)];
      await create(images[0]!, images);
      const frame = box(part(".nol-teamrun-image-viewer-viewport"));
      const gaps = [frame.left - space(3) / 2, frame.right + space(3) / 2];

      for (const x of gaps) {
        const hit = document.elementFromPoint(x, frame.top + frame.height / 2) as HTMLElement;
        expect(hit).toBe(part(".nol-teamrun-image-viewer"));
        await click(hit);
      }

      expect(closes).toBe(2);
    });

    it("lays a popup over the window below its title row: the header across the top, the zoom centred at the foot, the arrows beside the fitted image", async () => {
      const images = [image("a.png", 30, 20), image("b.png", 30, 20)];
      await create(images[0]!, images);
      const host = box(element());
      const header = box(part(".nol-teamrun-image-viewer-header"));
      const tools = box(part(".nol-teamrun-image-viewer-tools"));
      const viewport = box(part(".nol-teamrun-image-viewer-viewport"));
      const previous = box(part(".nol-teamrun-image-viewer-previous"));
      const next = box(part(".nol-teamrun-image-viewer-next"));

      expect(matchMedia("(forced-colors: active)").matches).toBe(forcedColors === "active");
      AppearanceFixture.expectPixels(host.width, document.documentElement.clientWidth);
      AppearanceFixture.expectPixels(host.height, document.documentElement.clientHeight);
      AppearanceFixture.expectPixels(header.top, AppearanceFixture.measureLook("window-row-height") + space(4));
      AppearanceFixture.expectPixels(header.left, space(4));
      AppearanceFixture.expectPixels(document.documentElement.clientWidth - header.right, space(4));
      AppearanceFixture.expectPixels(document.documentElement.clientHeight - tools.bottom, space(4));
      AppearanceFixture.expectPixels(tools.left + tools.width / 2, document.documentElement.clientWidth / 2);
      AppearanceFixture.expectPixels(viewport.top - header.bottom, space(3));
      AppearanceFixture.expectPixels(tools.top - viewport.bottom, space(3));
      AppearanceFixture.expectPixels(viewport.left - previous.right, space(3));
      AppearanceFixture.expectPixels(next.left - viewport.right, space(3));
      AppearanceFixture.expectPixels(previous.top + previous.height / 2, viewport.top + viewport.height / 2);
      AppearanceFixture.expectPixels(box(part(".nol-teamrun-image-viewer-title")).left, header.left);
      AppearanceFixture.expectPixels(box(part(".nol-teamrun-image-viewer-actions")).right, header.right);
      AppearanceFixture.expectPixels(box(part(".nol-teamrun-image-viewer-title")).height, box(part(".nol-teamrun-image-viewer-actions")).height);
      AppearanceFixture.expectPixels(box(part(".nol-teamrun-zoom-out")).left, tools.left);
      AppearanceFixture.expectPixels(box(part(".nol-teamrun-zoom-in")).right, tools.right);
      AppearanceFixture.expectPixels(box(part(".nol-teamrun-image-viewer-percent")).left - box(part(".nol-teamrun-zoom-out")).right, space(2));
      AppearanceFixture.expectPixels(box(part(".nol-teamrun-image-close")).left - box(part(".nol-teamrun-image-download")).right, space(2));
      const controls = [...element().querySelectorAll<HTMLElement>("[nol-icon-button]")];
      expect(controls.map(t => t.classList.contains("nol-icon-button-overlay"))).toEqual(controls.map(() => true));
      expect(controls.map(t => t.classList.contains("nol-icon-button-backdrop"))).toEqual(controls.map(() => true));
      expect(controls).toHaveLength(6);
      expect(part(".nol-teamrun-zoom-fit")?.classList.contains("nol-button-overlay")).toBe(true);
      expect(part(".nol-teamrun-zoom-fit")?.classList.contains("nol-button-backdrop")).toBe(true);
      const zoom = [".nol-teamrun-zoom-out", ".nol-teamrun-zoom-fit", ".nol-teamrun-zoom-in"].map(t => box(part(t)));
      for (const control of zoom) {
        AppearanceFixture.expectPixels(control.height, AppearanceFixture.measureLook("button-height"));
        AppearanceFixture.expectPixels(control.top + control.height / 2, zoom[0]!.top + zoom[0]!.height / 2);
      }
      if (forcedColors === "none") {
        expect(getComputedStyle(part(".nol-teamrun-image-viewer-title")!).backgroundColor).toBe("rgba(0, 0, 0, 0)");
        expect(getComputedStyle(part(".nol-teamrun-image-viewer-actions")!).backgroundColor).toBe("rgba(0, 0, 0, 0)");
        expect(getComputedStyle(part(".nol-teamrun-image-viewer-tools")!).backgroundColor).toBe("rgba(0, 0, 0, 0)");
        expect(getComputedStyle(part(".nol-teamrun-image-viewer-name")!).color).toBe(colorOf("overlay-text"));
        expect(getComputedStyle(part(".nol-teamrun-image-viewer-percent")!).backgroundColor).toBe("rgba(0, 0, 0, 0)");
        expect(getComputedStyle(part(".nol-teamrun-zoom-fit")!).color).toBe(colorOf("overlay-control-text"));
      }
    });

    it.each([
      { shade: "light", fill: "#FFFFFF" },
      { shade: "dark", fill: "#000000" }
    ])("puts each of a popup's buttons on a round chip of white at 10%, faded when it can't be used, with no pixel of a $shade image zoomed wide under the arrows", async ({ fill }) => {
      const images = [ViewedImage.fromData("a.png", "c1", "a.png", "image/png", pixels(2000, 2000, fill)), image("b.png", 30, 20)];
      await create(images[0]!, images, false, { writeImageAsync: () => Promise.resolve(true) });
      for (let step = 0; step < 4; step++)
        await click(button(".nol-teamrun-zoom-in"));
      const viewport = part(".nol-teamrun-image-viewer-viewport")!;
      viewport.scrollTo((viewport.scrollWidth - viewport.clientWidth) / 2, (viewport.scrollHeight - viewport.clientHeight) / 2);
      await settle();
      const [picture, shown] = [box(part(".nol-teamrun-image-viewer-image")), box(viewport)];
      const visible = DOMRect.fromRect({ x: Math.max(picture.left, shown.left), y: Math.max(picture.top, shown.top),
        width: Math.min(picture.right, shown.right) - Math.max(picture.left, shown.left), height: Math.min(picture.bottom, shown.bottom) - Math.max(picture.top, shown.top) });
      const overlaps = (a: DOMRect, b: DOMRect): boolean => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
      const arrows = [box(button(".nol-teamrun-image-previous")), box(button(".nol-teamrun-image-next"))];
      const arrow = arrows[1]!;
      const height = AppearanceFixture.measureLook("button-height");

      expect([picture.left < shown.left, picture.right > shown.right, visible.width > 0, visible.height > 0]).toEqual([true, true, true, true]);
      expect(arrows.map(t => overlaps(visible, t))).toEqual([false, false]);
      expect(button(".nol-teamrun-image-next").contains(document.elementFromPoint(arrow.left + arrow.width / 2, arrow.top + arrow.height / 2))).toBe(true);
      const controls = [...element().querySelectorAll<HTMLElement>("[nol-icon-button]")];
      expect(controls).toHaveLength(7);
      for (const control of controls) {
        const chip = getComputedStyle(control, "::before");
        const disc = [Number.parseFloat(chip.width), Number.parseFloat(chip.height)];
        AppearanceFixture.expectPixels(disc[0]!, height);
        AppearanceFixture.expectPixels(disc[1]!, height);
        AppearanceFixture.expectPixels(box(control).width, height);
        expect(chip.borderTopLeftRadius).toBe("50%");
        if (forcedColors === "none") {
          expect(chip.backgroundColor).toBe(colorOf("overlay-control"));
          expect(getComputedStyle(control).color).toBe(colorOf("overlay-control-text"));
        }
      }
      const fit = getComputedStyle(part(".nol-teamrun-zoom-fit")!);
      AppearanceFixture.expectPixels(box(part(".nol-teamrun-zoom-fit")).height, height);
      AppearanceFixture.expectPixels(Number.parseFloat(fit.borderTopLeftRadius), height / 2);
      if (forcedColors === "none") {
        expect(fit.backgroundColor).toBe(colorOf("overlay-control"));
        expect(fit.color).toBe(colorOf("overlay-control-text"));
        expect([getComputedStyle(button(".nol-teamrun-image-previous")).opacity, getComputedStyle(button(".nol-teamrun-image-next")).opacity]).toEqual(["0.35", "1"]);
      }
    });

    it("lays a tab out within its document, and truncates a long name before the header's buttons", async () => {
      await create(ViewedImage.fromData("k", "c1", `${"long name ".repeat(40)}.png`, "image/png", pixels(30, 20)), [], true);
      const host = box(element());
      const header = box(part(".nol-teamrun-image-viewer-header"));
      const download = box(part(".nol-teamrun-image-download"));

      AppearanceFixture.expectPixels(header.top - host.top, space(4));
      AppearanceFixture.expectPixels(header.left - host.left, space(4));
      AppearanceFixture.expectPixels(host.height, AppearanceFixture.toPixels(30));
      AppearanceFixture.expectPixels(box(part(".nol-teamrun-image-viewer-name")).left - host.left, space(4));
      if (forcedColors === "none") {
        expect(getComputedStyle(part(".nol-teamrun-image-viewer-title")!).backgroundColor).toBe("rgba(0, 0, 0, 0)");
        expect(getComputedStyle(part(".nol-teamrun-image-viewer-actions")!).backgroundColor).toBe("rgba(0, 0, 0, 0)");
        expect(getComputedStyle(part(".nol-teamrun-image-viewer-name")!).color).toBe(colorOf("text"));
        const chips = [...element().querySelectorAll<HTMLElement>(".nol-teamrun-image-viewer-chip, .nol-teamrun-image-viewer-step, .nol-teamrun-image-viewer-percent")];
        expect(chips.map(t => getComputedStyle(t).backgroundColor)).toEqual(chips.map(() => colorOf("raised")));
      }
      for (const chip of element().querySelectorAll<HTMLElement>(".nol-teamrun-image-viewer-chip")) {
        const button = box(chip.querySelector("[nol-icon-button]"));
        AppearanceFixture.expectPixels(box(chip).width, button.width);
        AppearanceFixture.expectPixels(box(chip).height, button.height);
        expect(getComputedStyle(chip).borderTopLeftRadius).toBe("50%");
      }
      expect(element().querySelector(".nol-icon-button-overlay, .nol-button-overlay")).toBeNull();
      AppearanceFixture.expectTruncates(part(".nol-teamrun-image-viewer-name")!);
      expect(box(part(".nol-teamrun-image-viewer-name")).right).toBeLessThanOrEqual(download.left);
    });

    it.each([{ shown: "popup", embedded: false }, { shown: "tab", embedded: true }])("gives Copy, Download, Close and the arrows the zoom buttons' height in a $shown, one centre line per row", async ({ embedded }) => {
      const images = [image("a.png", 30, 20), image("b.png", 30, 20)];
      await create(images[0]!, images, embedded, { writeImageAsync: () => Promise.resolve(true) });
      const middle = (target: DOMRect): number => target.top + target.height / 2;
      const header = [".nol-teamrun-image-copy", ".nol-teamrun-image-download", ...embedded ? [] : [".nol-teamrun-image-close"]].map(t => box(part(t)));
      const arrows = [".nol-teamrun-image-previous", ".nol-teamrun-image-next"].map(t => box(part(t)));
      const zoom = box(part(".nol-teamrun-zoom-in"));

      expect(element().querySelectorAll("[nol-icon-button]")).toHaveLength(embedded ? 6 : 7);
      for (const control of [...header, ...arrows]) {
        AppearanceFixture.expectPixels(control.height, zoom.height);
        AppearanceFixture.expectPixels(control.width, zoom.width);
      }
      AppearanceFixture.expectPixels(zoom.height, AppearanceFixture.measureLook("button-height"));
      for (const control of header)
        AppearanceFixture.expectPixels(middle(control), middle(header[0]!));
      AppearanceFixture.expectPixels(middle(arrows[1]!), middle(arrows[0]!));
      for (const chip of element().querySelectorAll<HTMLElement>(".nol-teamrun-image-viewer-chip, .nol-teamrun-image-viewer-step"))
        AppearanceFixture.expectPixels(box(chip).height, zoom.height);
    });
  });

  describe("under forced colours and at 200% zoom", () => {
    it("keeps every control, state and focus ring in the image viewer visible under forced colours", async () => {
      const shown = image("plan.png", 30, 20);
      await create(shown, [shown, image("chart.png", 40, 20)]);
      await AccessibilityFixture.expectVisibleForcedAsync(element());
    });

    it("neither cuts, crosses nor loses a control in the image viewer at 200% zoom", async () => {
      const shown = image("plan.png", 30, 20);
      await create(shown, [shown, image("chart.png", 40, 20)]);
      await AccessibilityFixture.expectFitsZoomedAsync(element(), settle);
    });
  });

  describe("by keyboard and screen reader", () => {
    it("reaches every control in the image viewer by keyboard, with a visible ring", async () => {
      const shown = image("plan.png", 30, 20);
      await create(shown, [shown, image("chart.png", 40, 20)]);
      expect(await AccessibilityFixture.expectKeyboardAsync(element())).toBeGreaterThan(0);
    });

    it("names every control, dialog, list and image in the image viewer", async () => {
      const shown = image("plan.png", 30, 20);
      await create(shown, [shown, image("chart.png", 40, 20)]);
      expect(AccessibilityFixture.expectNamed(element())).toBeGreaterThan(0);
    });
  });
});
