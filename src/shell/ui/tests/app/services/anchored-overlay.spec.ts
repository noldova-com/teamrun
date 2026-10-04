/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ComponentPortal, TemplatePortal } from "@angular/cdk/portal";
import { Component, Injector, type TemplateRef, ViewContainerRef, inject, signal, viewChild } from "@angular/core";
import { type ComponentFixture, TestBed } from "@angular/core/testing";

import { OverlayAlignment } from "../../../src/app/enums/overlay-alignment";
import { OverlayAnchoring } from "../../../src/app/models/overlay-anchoring";
import { OverlaySide } from "../../../src/app/models/overlay-side";
import { AnchoredOverlay } from "../../../src/app/services/anchored-overlay";
import { AppearanceFixture } from "../../fixtures/appearance.fixture";

@Component({
  template: `<div class="content" [style.width.px]="120" [style.height.px]="height()"></div>`
})
class ContentComponent {
  public readonly height = signal(40);
}

@Component({
  template: `<p style="margin: 0; max-width: 320px;">{{ text() }}</p>`
})
class WrappingComponent {
  public readonly text = signal("");
}

@Component({
  template: `
    <div class="scroller" style="position: fixed; top: 0; left: 0; width: 600px; height: 400px; overflow: auto;">
      <button type="button" class="anchor" style="position: absolute; top: 200px; left: 200px; width: 60px; height: 24px;">Anchor</button>
      <div style="height: 2000px;"></div>
    </div>
    <ng-template #panel><div class="panel" style="width: 80px; height: 30px;"></div></ng-template>
  `
})
class AnchorHostComponent {
  public readonly injector: Injector = inject(Injector);
  public readonly viewContainer: ViewContainerRef = inject(ViewContainerRef);
  public readonly panel = viewChild.required<TemplateRef<unknown>>("panel");
}

describe("AnchoredOverlay", () => {
  let fixture: ComponentFixture<AnchorHostComponent>;
  let overlay: AnchoredOverlay;

  beforeEach(async () => {
    AppearanceFixture.apply();
    fixture = TestBed.createComponent(AnchorHostComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    overlay = new AnchoredOverlay(fixture.componentInstance.injector, "tr-test-pane");
  });

  afterEach(() => {
    overlay.dispose();
    fixture.destroy();
    AppearanceFixture.reset();
  });

  function anchor(): HTMLElement {
    return fixture.nativeElement.querySelector(".anchor");
  }

  function below(gap: number = 8): OverlayAnchoring {
    return new OverlayAnchoring(OverlaySide.below, OverlayAlignment.Start, gap);
  }

  it("places an attached component where its bounds put it and reports the placement", () => {
    const content = overlay.openComponent(new ComponentPortal(ContentComponent), anchor(), below());
    content.changeDetectorRef.detectChanges();
    overlay.reposition();
    const box = overlay.element.getBoundingClientRect();
    const target = anchor().getBoundingClientRect();

    expect(overlay.isOpen).toBe(true);
    expect(overlay.element.classList.contains("tr-test-pane")).toBe(true);
    expect([box.left, box.top]).toEqual([target.left, target.bottom + 8]);
    expect(overlay.placement?.side).toBe(OverlaySide.below);
  });

  it("places an attached template by an area it is given instead of its origin's box, and follows it again when asked", () => {
    const host = fixture.componentInstance;
    overlay.overlayRef.attach(new TemplatePortal(host.panel(), host.viewContainer));
    overlay.follow(anchor(), below(0), () => new DOMRect(300, 150, 0, 0));
    const first = overlay.element.getBoundingClientRect();
    overlay.follow(anchor(), below(0));
    const second = overlay.element.getBoundingClientRect();
    const target = anchor().getBoundingClientRect();

    expect([first.left, first.top]).toEqual([300, 150]);
    expect([second.left, second.top]).toEqual([target.left, target.bottom]);
    expect(overlay.element.querySelector(".panel")).not.toBeNull();
  });

  it("follows its anchor when the window resizes and its content when it grows, and limits its height to the room it has", async () => {
    const content = overlay.openComponent(new ComponentPortal(ContentComponent), anchor(), below());
    content.changeDetectorRef.detectChanges();
    overlay.reposition();

    anchor().style.left = "240px";
    window.dispatchEvent(new Event("resize"));
    expect(overlay.element.getBoundingClientRect().left).toBe(anchor().getBoundingClientRect().left);

    content.instance.height.set(5000);
    content.changeDetectorRef.detectChanges();
    await vi.waitFor(() => expect(overlay.placement?.maxHeight ?? 0).toBeGreaterThan(0));
    const limit = overlay.placement?.maxHeight ?? 0;

    expect(overlay.element.style.maxHeight).toBe(`${limit}px`);
  });

  const sides: [string, OverlaySide][] = [["above", OverlaySide.above], ["below", OverlaySide.below], ["start", OverlaySide.start], ["end", OverlaySide.end]];
  const edges: [string, (anchor: HTMLElement) => void][] = [
    ["left", t => Object.assign(t.style, { left: "4px", top: "300px" })],
    ["right", t => Object.assign(t.style, { left: `${window.innerWidth - 64}px`, top: "300px" })],
    ["top", t => Object.assign(t.style, { left: "400px", top: "4px" })],
    ["bottom", t => Object.assign(t.style, { left: "400px", top: `${window.innerHeight - 28}px` })]
  ];

  describe.each(sides)("on its %s side", (_, side) => {
    it.each(edges)("paints at the size and place it settles at near the %s edge of the window", async (_, move) => {
      const host = fixture.nativeElement.querySelector(".scroller") as HTMLElement;
      Object.assign(host.style, { width: "100vw", height: "100vh" });
      const target = anchor();
      move(target);
      const content = overlay.openComponent(new ComponentPortal(WrappingComponent), target, new OverlayAnchoring(side, OverlayAlignment.Center, 8));
      content.changeDetectorRef.detectChanges();
      content.instance.text.set("words that need room words that need room words that need room words that need room");
      content.changeDetectorRef.detectChanges();
      overlay.reposition();
      const first = overlay.element.getBoundingClientRect();

      await new Promise(t => requestAnimationFrame(() => requestAnimationFrame(t)));
      const settled = overlay.element.getBoundingClientRect();

      expect([first.left, first.top, first.width, first.height]).toEqual([settled.left, settled.top, settled.width, settled.height]);
      expect(first.width).toBeGreaterThan(0);
    });
  });

  it("drops a reposition its content asked for when it closes before the next frame", () => {
    const notify: (() => void)[] = [];
    vi.stubGlobal("ResizeObserver", class {
      public constructor(callback: () => void) {
        notify.push(callback);
      }

      public observe(): void {
      }

      public disconnect(): void {
      }
    });
    vi.useFakeTimers({ toFake: ["requestAnimationFrame", "cancelAnimationFrame"] });
    try {
      overlay.openComponent(new ComponentPortal(ContentComponent), anchor(), below());
      const reposition = vi.spyOn(overlay, "reposition");

      notify.forEach(t => t());
      notify.forEach(t => t());
      overlay.close();
      vi.runAllTimers();

      expect(reposition).not.toHaveBeenCalled();
      expect(overlay.placement).toBeNull();
    }
    finally {
      vi.useRealTimers();
      vi.unstubAllGlobals();
    }
  });

  it("reports an ancestor scroll that moves its anchor, but not a scroll inside itself or elsewhere", async () => {
    let scrolls = 0;
    overlay.originScrolls.subscribe(() => scrolls++);
    overlay.openComponent(new ComponentPortal(ContentComponent), anchor(), below());
    const elsewhere = document.body.appendChild(document.createElement("div"));
    elsewhere.dispatchEvent(new Event("scroll"));
    overlay.element.dispatchEvent(new Event("scroll"));
    elsewhere.remove();
    const scrollsAfterOthers = scrolls;

    const scroller = fixture.nativeElement.querySelector(".scroller") as HTMLElement;
    scroller.scrollTop = 120;
    await vi.waitFor(() => expect(scrolls).toBe(1));

    expect(scrollsAfterOthers).toBe(0);
    expect(overlay.isOpen).toBe(true);
  });

  it("does nothing when asked to reposition while closed and lets go of its listeners once closed", () => {
    overlay.reposition();
    expect(overlay.placement).toBeNull();
    const added = vi.spyOn(window, "removeEventListener");
    overlay.openComponent(new ComponentPortal(ContentComponent), anchor(), below());

    overlay.close();

    expect(overlay.isOpen).toBe(false);
    expect(added).toHaveBeenCalledWith("resize", expect.any(Function));
  });

  it("passes on its keyboard and outside pointer events and its detachments", () => {
    const keys: string[] = [];
    const outside: MouseEvent[] = [];
    let detached = 0;
    overlay.keydownEvents.subscribe(t => keys.push(t.key));
    overlay.outsidePointerEvents.subscribe(t => outside.push(t));
    overlay.detachments.subscribe(() => detached++);
    overlay.openComponent(new ComponentPortal(ContentComponent), anchor(), below());

    document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    document.body.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    overlay.close();

    expect(keys).toEqual(["Escape"]);
    expect(outside.length).toBe(1);
    expect(detached).toBe(1);
  });
});
