/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { EditTarget } from "../../../src/app/models/edit-target";

describe("EditTarget", () => {
  let host: HTMLElement;

  beforeEach(() => {
    host = document.createElement("div");
    host.innerHTML = `
      <input class="field" type="text" value="Meeting notes">
      <input class="locked" type="text" value="Read only" readonly>
      <input class="off" type="text" value="Disabled" disabled>
      <input class="count" type="number" value="42">
      <input class="box" type="checkbox">
      <div class="rich" contenteditable="true">Rich text</div>
      <div class="plain">Plain text</div>
      <button type="button" class="elsewhere">Elsewhere</button>`;
    document.body.append(host);
  });

  afterEach(() => host.remove());

  function element<T extends HTMLElement>(selector: string): T {
    return host.querySelector(selector) as T;
  }

  it("is editable for a text field and rich text, and not for other elements", () => {
    expect([".field", ".count", ".rich", ".box", ".plain", ".elsewhere"].map(t => EditTarget.isEditable(element(t)))).toEqual([true, true, true, false, false, false]);
  });

  it("captures a field's selection and whether it can be written, and restores the focus and the selection", () => {
    const field = element<HTMLInputElement>(".field");
    field.focus();
    field.setSelectionRange(0, 7, "backward");
    const target = EditTarget.capture(field, document);
    field.setSelectionRange(3, 3);
    const collapsed = EditTarget.capture(field, document);

    element<HTMLButtonElement>(".elsewhere").focus();
    target.restore(document);

    expect([target.element, target.hasSelection, target.isWritable, collapsed.hasSelection]).toEqual([field, true, true, false]);
    expect(document.activeElement).toBe(field);
    expect([field.selectionStart, field.selectionEnd, field.selectionDirection]).toEqual([0, 7, "backward"]);
    expect([EditTarget.capture(element(".locked"), document).isWritable, EditTarget.capture(element(".off"), document).isWritable]).toEqual([false, false]);
  });

  it("treats a field without a selection range as selected", () => {
    expect(EditTarget.capture(element(".count"), document).hasSelection).toBe(true);
  });

  it("captures and restores a selection inside rich text, and treats rich text without one inside it as unselected", () => {
    const rich = element(".rich");
    rich.focus();
    const range = document.createRange();
    range.setStart(rich.firstChild as Node, 0);
    range.setEnd(rich.firstChild as Node, 4);
    document.getSelection()?.removeAllRanges();
    document.getSelection()?.addRange(range);
    const target = EditTarget.capture(rich, document);
    document.getSelection()?.removeAllRanges();
    const unselected = EditTarget.capture(rich, document);
    const plainRange = document.createRange();
    plainRange.selectNodeContents(element(".plain"));
    document.getSelection()?.addRange(plainRange);
    const outside = EditTarget.capture(rich, document);

    target.restore(document);

    expect([target.hasSelection, target.isWritable, unselected.hasSelection, outside.hasSelection]).toEqual([true, true, false, false]);
    expect(document.activeElement).toBe(rich);
    expect(document.getSelection()?.toString()).toBe("Rich");
  });
});
