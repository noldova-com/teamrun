/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TestBed } from "@angular/core/testing";

import { FakeTeamRunBridge } from "../../../fixtures/fake-teamrun-bridge";
import { ImageSource } from "../../../../src/app/models/image-source";
import { ImageViewerData } from "../../../../src/app/models/image-viewer-data";
import { TEAMRUN_BRIDGE } from "../../../../src/app/services/bridge.service";
import { ImageViewerComponent } from "../../../../src/app/components/image-viewer/image-viewer.component";

describe("ImageViewerComponent", () => {
  beforeEach(() => {
    class DecodedImage {
      public src: string = "";
      public readonly naturalWidth: number = 1200;
      public readonly naturalHeight: number = 800;
      public decode(): Promise<void> { return Promise.resolve(); }
    }
    vi.stubGlobal("Image", DecodedImage);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("focuses the Close button when opened as an image tab", async () => {
    TestBed.configureTestingModule({ imports: [ImageViewerComponent], providers: [
      { provide: TEAMRUN_BRIDGE, useValue: new FakeTeamRunBridge() }
    ] });
    const fixture = TestBed.createComponent(ImageViewerComponent);
    fixture.componentRef.setInput("data", new ImageViewerData(new ImageSource("1", "one.png", null, "data:first")));
    fixture.componentRef.setInput("embedded", true);
    fixture.detectChanges();
    await fixture.whenStable();

    const root = fixture.nativeElement as HTMLElement;
    const closeButton = root.querySelector<HTMLButtonElement>("[data-image-close]");
    expect(closeButton).not.toBeNull();
    expect(document.activeElement).toBe(closeButton);
  });

  it("fits, zooms and navigates between images without changing the source", async () => {
    const first = new ImageSource("1", "one.png", null, "data:first");
    const second = new ImageSource("2", "two.png", "D:/data/two.png", null);
    const bridge = new FakeTeamRunBridge();
    bridge.images.set(second.path!, "data:second");
    TestBed.configureTestingModule({ imports: [ImageViewerComponent], providers: [
      { provide: TEAMRUN_BRIDGE, useValue: bridge }
    ] });
    const fixture = TestBed.createComponent(ImageViewerComponent);
    fixture.componentRef.setInput("data", new ImageViewerData(first, [first, second]));
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const viewport = root.querySelector<HTMLElement>(".tr-image-viewer-viewport")!;
    Object.defineProperty(viewport, "clientWidth", { value: 600 });
    Object.defineProperty(viewport, "clientHeight", { value: 400 });
    viewport.scrollTo = vi.fn();
    await fixture.whenStable();
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(root.querySelector('button[aria-label="Fit image"]')?.textContent).toContain("50%");
    });
    expect(root.querySelector<HTMLButtonElement>('button[aria-label="Previous image"]')?.disabled).toBe(true);
    root.querySelector<HTMLButtonElement>('button[aria-label="Zoom in"]')!.click();
    await fixture.whenStable();
    expect(root.querySelector('button[aria-label="Fit image"]')?.textContent).toContain("63%");
    expect(root.querySelector('img')?.getAttribute('src')).toBe('data:first');
    root.querySelector<HTMLButtonElement>('button[aria-label="Fit image"]')!.click();
    await fixture.whenStable();
    expect(root.querySelector('button[aria-label="Fit image"]')?.textContent).toContain("50%");
    root.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true, cancelable: true }));
    await fixture.whenStable();
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(root.querySelector('img')?.getAttribute('src')).toBe('data:second');
    });
    expect(root.querySelector<HTMLButtonElement>('button[aria-label="Next image"]')?.disabled).toBe(true);
    expect(bridge.imageRequests).toEqual([second.path]);
    root.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true, cancelable: true }));
    await fixture.whenStable();
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(root.querySelector('img')?.getAttribute('src')).toBe('data:first');
    });
  });

  it("reports an unavailable image and closes from empty backdrop space", async () => {
    const close = vi.fn();
    TestBed.configureTestingModule({ imports: [ImageViewerComponent], providers: [
      { provide: TEAMRUN_BRIDGE, useValue: new FakeTeamRunBridge() }
    ] });
    const fixture = TestBed.createComponent(ImageViewerComponent);
    fixture.componentRef.setInput("data", new ImageViewerData(new ImageSource("missing", "missing.png", null, null)));
    fixture.componentInstance.closed.subscribe(close);
    fixture.detectChanges();
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(root.querySelector('[role="status"]')?.textContent).toContain("could not be loaded");
    });
    expect(root.querySelector<HTMLButtonElement>('button[aria-label="Zoom in"]')?.disabled).toBe(true);
    root.querySelector<HTMLElement>('.tr-image-viewer-canvas')!.click();
    expect(close).toHaveBeenCalledOnce();
    fixture.componentRef.setInput("embedded", true);
    fixture.detectChanges();
    root.querySelector<HTMLElement>('.tr-image-viewer-canvas')!.click();
    expect(close).toHaveBeenCalledOnce();
    root.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
    expect(close).toHaveBeenCalledTimes(2);
  });
});
