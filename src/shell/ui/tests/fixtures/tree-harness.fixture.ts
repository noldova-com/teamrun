/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ComponentFixture } from "@angular/core/testing";

import { DragGesture } from "../../src/app/models/drag-gesture";
import type { MovableTreeHostComponent } from "./movable-tree-host.component";

export class TreeHarness {
  private readonly fixture: ComponentFixture<MovableTreeHostComponent>;

  public constructor(fixture: ComponentFixture<MovableTreeHostComponent>) {
    this.fixture = fixture;
  }

  public get root(): HTMLElement {
    return this.fixture.nativeElement;
  }

  public get line(): HTMLElement | null {
    return this.root.querySelector<HTMLElement>(".tr-tree-drop-line");
  }

  public get ghost(): HTMLElement | null {
    return this.root.querySelector<HTMLElement>(".tr-tree-ghost");
  }

  public shownLine(): HTMLElement {
    return this.shown(this.line, "drop line");
  }

  public shownGhost(): HTMLElement {
    return this.shown(this.ghost, "ghost");
  }

  public get gap(): number {
    return Number.parseFloat(getComputedStyle(this.shown(this.root.querySelector<HTMLElement>(".tr-tree"), "tree")).rowGap);
  }

  public get moves(): (string | number | null)[][] {
    return this.fixture.componentInstance.moves.map(t => [t.id, t.parentId, t.index]);
  }

  public items(): HTMLElement[] {
    return [...this.root.querySelectorAll<HTMLElement>("[role=treeitem]")];
  }

  public row(label: string): HTMLElement {
    const found = this.items().find(t => t.querySelector(".tr-tree-label")?.textContent === label);
    if (Object.isUndefined(found))
      throw new Error(`No row labelled ${label}.`);
    return found;
  }

  public yAt(label: string, fraction: number): number {
    const box = this.row(label).getBoundingClientRect();
    return box.top + box.height * fraction;
  }

  public pointer(type: string, target: EventTarget, y: number, button: number = 0): void {
    target.dispatchEvent(new PointerEvent(type, { bubbles: true, button, clientX: this.root.getBoundingClientRect().left + 24, clientY: y }));
  }

  public async dragAsync(from: string, to: string, fraction: number, release: boolean = true): Promise<void> {
    this.pointer("pointerdown", this.row(from), this.yAt(from, 0.5));
    this.pointer("pointermove", this.row(from), this.yAt(from, 0.5) + DragGesture.threshold + 1);
    this.pointer("pointermove", this.row(to), this.yAt(to, fraction));
    await this.fixture.whenStable();
    if (release) {
      this.pointer("pointerup", this.row(to), this.yAt(to, fraction));
      await this.fixture.whenStable();
    }
  }

  public press(target: HTMLElement, key: string, modifiers: KeyboardEventInit = { altKey: true }): boolean {
    return target.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...modifiers }));
  }

  private shown(element: HTMLElement | null, name: string): HTMLElement {
    if (Object.isNull(element))
      throw new Error(`The tree shows no ${name}.`);
    return element;
  }
}
