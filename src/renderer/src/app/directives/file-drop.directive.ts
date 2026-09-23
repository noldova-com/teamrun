/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Directive, effect, input, output, signal } from "@angular/core";

import { Resources } from "../resources";

@Directive({
  selector: "[trFileDrop]",
  exportAs: "trFileDrop",
  host: {
    "(dragenter)": "enter($event)",
    "(dragover)": "over($event)",
    "(dragleave)": "leave()",
    "(drop)": "drop($event)",
    "(window:drop)": "clear()",
    "(window:dragend)": "clear()",
    "(window:blur)": "clear()",
    "(window:keydown.escape)": "clear()"
  }
})
export class FileDropDirective {
  public readonly enabled = input(false, { alias: "trFileDrop" });
  public readonly filesDropped = output<readonly File[]>();
  public readonly active = signal(false);
  private depth: number = 0;

  public constructor() {
    effect(() => {
      if (!this.enabled())
        this.clear();
    });
  }

  protected enter(event: DragEvent): void {
    if (!event.dataTransfer?.types.includes(Resources.fileDragType))
      return;
    event.preventDefault();
    this.depth++;
    this.active.set(this.enabled());
  }

  protected over(event: DragEvent): void {
    if (!event.dataTransfer?.types.includes(Resources.fileDragType))
      return;
    event.preventDefault();
    event.dataTransfer.dropEffect = this.enabled() ? Resources.copyDropEffect : Resources.noneDropEffect;
  }

  protected leave(): void {
    this.depth = Math.max(0, this.depth - 1);
    if (this.depth === 0)
      this.active.set(false);
  }

  protected drop(event: DragEvent): void {
    this.clear();
    const files = Array.from(event.dataTransfer?.files ?? []);
    if (files.length === 0)
      return;
    event.preventDefault();
    if (this.enabled())
      this.filesDropped.emit(files);
  }

  protected clear(): void {
    this.depth = 0;
    this.active.set(false);
  }
}
