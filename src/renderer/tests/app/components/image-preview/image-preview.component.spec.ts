/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TestBed } from "@angular/core/testing";
import { MatDialog } from "@angular/material/dialog";

import { FakeTeamRunBridge } from "../../../fixtures/fake-teamrun-bridge";
import { MemoryStorage } from "../../../fixtures/memory-storage";
import { ImageOpenMode } from "../../../../src/app/enums/image-open-mode";
import { ImageSource } from "../../../../src/app/models/image-source";
import { TEAMRUN_BRIDGE } from "../../../../src/app/services/bridge.service";
import { PreferencesService } from "../../../../src/app/services/preferences.service";
import { NavigationService } from "../../../../src/app/services/navigation.service";
import { ImagePreviewComponent } from "../../../../src/app/components/image-preview/image-preview.component";

describe("ImagePreviewComponent", () => {
  beforeEach(() => {
    MemoryStorage.install(window);
    class DecodedImage {
      public src: string = "";
      public readonly naturalWidth: number = 1200;
      public readonly naturalHeight: number = 800;
      public decode(): Promise<void> { return Promise.resolve(); }
    }
    vi.stubGlobal("Image", DecodedImage);
  });
  afterEach(() => vi.unstubAllGlobals());

  it.each([
    [ImageOpenMode.Popup, "Open in a new tab"],
    [ImageOpenMode.Tab, "Open modal"]
  ] as const)("offers the alternative to %s without changing the saved setting", async (mode, label) => {
    const bridge = new FakeTeamRunBridge();
    bridge.images.set("D:/image.png", "data:image/png;base64,AAAA");
    TestBed.configureTestingModule({ imports: [ImagePreviewComponent], providers: [{ provide: TEAMRUN_BRIDGE, useValue: bridge }] });
    const preferences = TestBed.inject(PreferencesService);
    const navigation = TestBed.inject(NavigationService);
    preferences.setImageOpenMode(mode);
    const first = new ImageSource("first", "image.png", "D:/image.png", null);
    const second = new ImageSource("second", "second.png", null, "data:image/png;base64,BBBB");
    const fixture = TestBed.createComponent(ImagePreviewComponent);
    fixture.componentRef.setInput("image", first);
    fixture.componentRef.setInput("images", [first, second]);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(root.querySelector('img')).not.toBeNull();
    });
    root.querySelector('img')!.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, button: 2 }));
    await fixture.whenStable();
    const menu = document.querySelector('.mat-mdc-menu-panel')!;
    const opening = Array.from(menu.querySelectorAll<HTMLButtonElement>('button')).filter(t => t.textContent?.includes('Open '));
    expect(opening).toHaveLength(1);
    expect(opening[0]?.textContent).toContain(label);
    expect(menu.textContent).toContain('Copy Image');
    expect(menu.textContent).toContain('Download Image');
    opening[0]!.click();
    await fixture.whenStable();
    expect(preferences.imageOpenMode()).toBe(mode);
    if (mode === ImageOpenMode.Popup) {
      expect(navigation.activeImage()?.data.image.path).toBe(first.path);
      expect(TestBed.inject(MatDialog).openDialogs).toHaveLength(0);
    } else {
      expect(navigation.images()).toHaveLength(0);
      expect(TestBed.inject(MatDialog).openDialogs).toHaveLength(1);
      await vi.waitFor(() => expect(document.querySelector('tr-image-dialog img')?.getAttribute('alt')).toBe(first.label));
      expect(document.querySelector<HTMLButtonElement>('tr-image-dialog button[aria-label="Next image"]')?.disabled).toBe(false);
      TestBed.inject(MatDialog).closeAll();
    }
  });

  it("shows embedded data, then the image the bridge serves, and nothing otherwise", async () => {
    const bridge = new FakeTeamRunBridge();
    bridge.images.set("D:\\repo\\out\\sphere.png", "data:image/png;base64,AAAA");
    TestBed.configureTestingModule({ imports: [ImagePreviewComponent], providers: [{ provide: TEAMRUN_BRIDGE, useValue: bridge }] });
    const fixture = TestBed.createComponent(ImagePreviewComponent);
    const element = fixture.nativeElement as HTMLElement;

    fixture.componentRef.setInput("image", new ImageSource("g", "Generated image", null, "data:image/jpeg;base64,BBBB"));
    fixture.detectChanges();
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(element.querySelector("img")?.getAttribute("src")).toBe("data:image/jpeg;base64,BBBB");
    });
    expect(element.querySelector("figcaption")?.textContent).toBe("Generated image");
    expect(bridge.imageRequests).toEqual([]);

    fixture.componentRef.setInput("image", new ImageSource("s", "sphere.png", "D:\\repo\\out\\sphere.png", null));
    fixture.detectChanges();
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(element.querySelector("img")?.getAttribute("src")).toBe("data:image/png;base64,AAAA");
    });
    expect(element.querySelector("figcaption")?.textContent).toBe("sphere.png");

    fixture.componentRef.setInput("image", new ImageSource("m", "missing.png", "/repo/missing.png", null));
    fixture.detectChanges();
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(element.querySelector("img")).toBeNull();
    });
    fixture.componentRef.setInput("image", new ImageSource("n", "none", null, null));
    fixture.detectChanges();
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(element.querySelector("img")).toBeNull();
    });
    expect(bridge.imageRequests).toEqual(["D:\\repo\\out\\sphere.png", "/repo/missing.png"]);
  });

  it("waits for decoding and reserves a revisited file's dimensions while reading it again", async () => {
    const bridge = new FakeTeamRunBridge();
    const path = "D:\\repo\\revisited.png";
    bridge.images.set(path, "data:image/png;base64,CCCC");
    TestBed.configureTestingModule({ imports: [ImagePreviewComponent], providers: [{ provide: TEAMRUN_BRIDGE, useValue: bridge }] });
    const first = TestBed.createComponent(ImagePreviewComponent);
    first.componentRef.setInput("image", new ImageSource(path, "revisited.png", path, null));
    first.detectChanges();
    await vi.waitFor(() => {
      first.detectChanges();
      expect(first.nativeElement.querySelector("img")?.getAttribute("width")).toBe("1200");
    });
    expect(first.nativeElement.querySelector("img").getAttribute("height")).toBe("800");
    first.destroy();

    let resolvePending: (value: string | null) => void = () => undefined;
    const pending = new Promise<string | null>(resolve => resolvePending = resolve);
    vi.spyOn(bridge, "readImage").mockReturnValueOnce(pending);
    const second = TestBed.createComponent(ImagePreviewComponent);
    second.componentRef.setInput("image", new ImageSource(path, "revisited.png", path, null));
    second.detectChanges();
    const element = second.nativeElement as HTMLElement;
    expect(element.querySelector("img")).toBeNull();
    expect(element.querySelector<HTMLElement>("figure")!.style.getPropertyValue("--tr-image-width")).toBe("1200px");
    expect(element.querySelector<HTMLElement>("figure")!.style.getPropertyValue("--tr-image-ratio")).toBe("1.5");
    resolvePending("data:image/png;base64,DDDD");
    await vi.waitFor(() => {
      second.detectChanges();
      expect(element.querySelector("img")?.getAttribute("src")).toBe("data:image/png;base64,DDDD");
    });

    second.componentRef.setInput("image", new ImageSource(path, "New caption", path, null));
    second.detectChanges();
    expect(element.querySelector("img")?.getAttribute("src")).toBe("data:image/png;base64,DDDD");
    expect(element.querySelector("figcaption")?.textContent).toBe("New caption");
    expect(bridge.readImage).toHaveBeenCalledTimes(1);
  });

  it("ignores an obsolete file result after the source changes", async () => {
    const bridge = new FakeTeamRunBridge();
    let resolvePending: (value: string | null) => void = () => undefined;
    const pending = new Promise<string | null>(resolve => resolvePending = resolve);
    vi.spyOn(bridge, "readImage").mockReturnValueOnce(pending);
    TestBed.configureTestingModule({ imports: [ImagePreviewComponent], providers: [{ provide: TEAMRUN_BRIDGE, useValue: bridge }] });
    const fixture = TestBed.createComponent(ImagePreviewComponent);
    fixture.componentRef.setInput("image", new ImageSource("old", "old.png", "D:\\repo\\old-result.png", null));
    fixture.detectChanges();
    fixture.componentRef.setInput("image", new ImageSource("new", "new.png", null, "data:image/png;base64,NEW"));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    resolvePending("data:image/png;base64,OLD");
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector("img").getAttribute("src")).toBe("data:image/png;base64,NEW");
  });

  it("does not display an image before decoding finishes or after decoding fails", async () => {
    let rejectPending: (error: Error) => void = () => undefined;
    const pending = new Promise<void>((_resolve, reject) => rejectPending = reject);
    class PendingImage {
      public src: string = "";
      public readonly naturalWidth: number = 800;
      public readonly naturalHeight: number = 600;
      public decode(): Promise<void> { return pending; }
    }
    vi.stubGlobal("Image", PendingImage);
    TestBed.configureTestingModule({ imports: [ImagePreviewComponent], providers: [{ provide: TEAMRUN_BRIDGE, useValue: new FakeTeamRunBridge() }] });
    const fixture = TestBed.createComponent(ImagePreviewComponent);
    fixture.componentRef.setInput("image", new ImageSource("pending", "pending.png", null, "data:image/png;base64,WAIT"));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector("img")).toBeNull();
    rejectPending(new Error("Invalid image"));
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector("figure")).toBeNull();
  });
});
