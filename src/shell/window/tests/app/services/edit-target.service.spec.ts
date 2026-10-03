/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TestBed } from "@angular/core/testing";

import { EditAction } from "../../../src/app/enums/edit-action";
import { EditTargetService } from "../../../src/app/services/edit-target.service";

describe("EditTargetService", () => {
  let host: HTMLElement;
  let overlay: HTMLButtonElement;
  let elsewhere: HTMLButtonElement;

  beforeEach(() => {
    host = document.createElement("div");
    host.innerHTML = `
      <input class="field" type="text" value="Meeting notes">
      <input class="locked" type="text" value="Read only" readonly>
      <input class="count" type="number" value="42">
      <textarea class="notes">Week 3</textarea>
      <div class="rich" contenteditable="true">Rich text</div>
      <svg class="drawing" tabindex="0"></svg>
      <button type="button" class="elsewhere">Elsewhere</button>
      <div class="cdk-overlay-container"><button type="button" class="row">Copy</button></div>`;
    document.body.append(host);
    overlay = host.querySelector(".row") as HTMLButtonElement;
    elsewhere = host.querySelector(".elsewhere") as HTMLButtonElement;
  });

  afterEach(() => host.remove());

  function element<T extends Element>(selector: string): T {
    return host.querySelector(selector) as T;
  }

  function actions(edits: EditTargetService): readonly EditAction[] {
    return Object.values(EditAction).filter(t => edits.canRun(t));
  }

  it("keeps the field and its selection while focus is in a menu, and restores both", async () => {
    const edits = TestBed.inject(EditTargetService);
    const field = element<HTMLInputElement>(".field");
    field.focus();
    field.setSelectionRange(0, 7, "backward");

    overlay.focus();
    const enabled = actions(edits);
    const restored = await edits.restoreAsync();

    expect(enabled).toEqual(Object.values(EditAction));
    expect(restored).toBe(true);
    expect(document.activeElement).toBe(field);
    expect([field.selectionStart, field.selectionEnd, field.selectionDirection]).toEqual([0, 7, "backward"]);
  });

  it("allows only what a field can do: no copy or cut without a selection, and nothing that writes into a read-only field", () => {
    const edits = TestBed.inject(EditTargetService);
    const field = element<HTMLInputElement>(".field");
    const locked = element<HTMLInputElement>(".locked");

    field.focus();
    field.setSelectionRange(3, 3);
    overlay.focus();
    const collapsed = actions(edits);
    locked.focus();
    locked.setSelectionRange(0, 4);
    overlay.focus();
    const readOnly = actions(edits);

    expect(collapsed).toEqual([EditAction.Undo, EditAction.Redo, EditAction.Paste, EditAction.SelectAll]);
    expect(readOnly).toEqual([EditAction.Copy, EditAction.SelectAll]);
  });

  it("forgets the field when focus moves to something that is not editable outside the menus, or the field leaves the page", async () => {
    const edits = TestBed.inject(EditTargetService);
    const field = element<HTMLInputElement>(".field");

    field.focus();
    elsewhere.focus();
    const afterElsewhere = [actions(edits), await edits.restoreAsync()];
    field.focus();
    overlay.focus();
    field.remove();

    expect(afterElsewhere).toEqual([[], false]);
    expect([actions(edits), await edits.restoreAsync()]).toEqual([[], false]);
  });

  it("restores a selection in editable rich text and in a text area, and treats a field without a selection range as selected", async () => {
    const edits = TestBed.inject(EditTargetService);
    const rich = element<HTMLElement>(".rich");
    const notes = element<HTMLTextAreaElement>(".notes");
    const count = element<HTMLInputElement>(".count");
    rich.focus();
    const range = document.createRange();
    range.setStart(rich.firstChild as Node, 0);
    range.setEnd(rich.firstChild as Node, 4);
    document.getSelection()?.removeAllRanges();
    document.getSelection()?.addRange(range);

    overlay.focus();
    await edits.restoreAsync();
    const richSelection = document.getSelection()?.toString();
    notes.focus();
    notes.setSelectionRange(0, 4);
    overlay.focus();
    await edits.restoreAsync();
    const notesRestored = [document.activeElement === notes, notes.selectionStart, notes.selectionEnd];
    count.focus();
    overlay.focus();

    expect(richSelection).toBe("Rich");
    expect(notesRestored).toEqual([true, 0, 4]);
    expect(actions(edits)).toEqual(Object.values(EditAction));
  });

  it("treats rich text without a selection inside it as unselected, and ignores focus on an element that is not HTML", async () => {
    const edits = TestBed.inject(EditTargetService);
    const rich = element<HTMLElement>(".rich");
    document.getSelection()?.removeAllRanges();

    rich.focus();
    document.getSelection()?.removeAllRanges();
    overlay.focus();
    const unselected = actions(edits);
    element<SVGElement>(".drawing").focus();

    expect(unselected).toEqual([EditAction.Undo, EditAction.Redo, EditAction.Paste, EditAction.SelectAll]);
    expect(actions(edits)).toEqual(unselected);
    expect(await edits.restoreAsync()).toBe(true);
  });
});
