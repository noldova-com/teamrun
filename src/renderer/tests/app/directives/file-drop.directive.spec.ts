/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, signal } from "@angular/core";
import { TestBed } from "@angular/core/testing";

import { FileDropDirective } from "../../../src/app/directives/file-drop.directive";

@Component({
  imports: [FileDropDirective],
  template: `<section [trFileDrop]="enabled()" #drop="trFileDrop" (filesDropped)="files = $event">
    <span>Message</span><button>Copy</button>@if (drop.active()) { <aside>Drop to attach</aside> }
  </section>`
})
class FileDropHost {
  public readonly enabled = signal(true);
  public files: readonly File[] = [];

  public static drag(type: string, files: readonly File[] = [], types: readonly string[] = ["Files"]): Event {
    const event = new Event(type, { bubbles: true, cancelable: true });
    Object.defineProperty(event, "dataTransfer", { value: { files, types, dropEffect: "none" } });
    return event;
  }
}

describe("FileDropDirective", () => {
  it("keeps the highlight across child boundaries and clears it on leaving the panel", async () => {
    const fixture = TestBed.createComponent(FileDropHost);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    const region = root.querySelector("section")!;
    const child = root.querySelector("span")!;
    region.dispatchEvent(FileDropHost.drag("dragenter"));
    child.dispatchEvent(FileDropHost.drag("dragenter"));
    region.dispatchEvent(FileDropHost.drag("dragleave"));
    await fixture.whenStable();
    expect(root.querySelector("aside")).not.toBeNull();
    const over = FileDropHost.drag("dragover") as DragEvent;
    child.dispatchEvent(over);
    expect(over.defaultPrevented).toBe(true);
    expect(over.dataTransfer?.dropEffect).toBe("copy");
    child.dispatchEvent(FileDropHost.drag("dragleave"));
    await fixture.whenStable();
    expect(root.querySelector("aside")).toBeNull();
  });

  it("accepts a drop once, leaves text drags native, and rejects files when disabled", async () => {
    const fixture = TestBed.createComponent(FileDropHost);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    const child = root.querySelector("span")!;
    for (const type of ["dragenter", "dragover", "drop"]) {
      const event = FileDropHost.drag(type, [], ["text/plain"]);
      child.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(false);
    }
    await fixture.whenStable();
    expect(root.querySelector("aside")).toBeNull();
    const file = new File(["hello"], "notes.txt");
    child.dispatchEvent(FileDropHost.drag("dragenter"));
    const drop = FileDropHost.drag("drop", [file]);
    child.dispatchEvent(drop);
    await fixture.whenStable();
    expect(drop.defaultPrevented).toBe(true);
    expect(fixture.componentInstance.files).toEqual([file]);
    expect(root.querySelector("aside")).toBeNull();

    child.dispatchEvent(FileDropHost.drag("dragenter"));
    fixture.componentInstance.enabled.set(false);
    await fixture.whenStable();
    expect(root.querySelector("aside")).toBeNull();
    const over = FileDropHost.drag("dragover") as DragEvent;
    child.dispatchEvent(over);
    expect(over.dataTransfer?.dropEffect).toBe("none");
    child.dispatchEvent(FileDropHost.drag("drop", [new File(["other"], "other.txt")]));
    expect(fixture.componentInstance.files).toEqual([file]);
  });

  it("clears cancelled and outside drops and starts the next drag cleanly", async () => {
    const fixture = TestBed.createComponent(FileDropHost);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    for (const event of [new Event("dragend"), new Event("blur"), new Event("drop"), new KeyboardEvent("keydown", { key: "Escape" })]) {
      root.querySelector("span")!.dispatchEvent(FileDropHost.drag("dragenter"));
      await fixture.whenStable();
      expect(root.querySelector("aside")).not.toBeNull();
      window.dispatchEvent(event);
      await fixture.whenStable();
      expect(root.querySelector("aside")).toBeNull();
    }
    expect(fixture.componentInstance.files).toEqual([]);
    fixture.destroy();
  });
});
