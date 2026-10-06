/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { EditTarget } from "../../../src/app/models/edit-target";
import { EditTargetFixture } from "../../fixtures/edit-target.fixture";

describe("EditTarget", () => {
  let page: EditTargetFixture;

  beforeEach(() => {
    page = EditTargetFixture.create();
  });

  afterEach(() => page.remove());

  it("is editable for a text field and rich text, and not for other elements", () => {
    expect([".field", ".count", ".rich", ".box", ".plain", ".elsewhere"].map(t => EditTarget.isEditable(page.find(t, HTMLElement)))).toEqual([true, true, true, false, false, false]);
  });

  it("finds the field an element belongs to: a text field itself, or the outermost rich text around it", () => {
    const rich = page.find(".rich", HTMLElement);
    rich.innerHTML = "<p><b class=\"bold\">Rich</b> text</p>";

    expect(EditTarget.fieldOf(page.find(".field", HTMLElement))).toBe(page.find(".field", HTMLElement));
    expect(EditTarget.fieldOf(page.find(".bold", HTMLElement))).toBe(rich);
    expect(EditTarget.fieldOf(rich)).toBe(rich);
    expect([".box", ".plain", ".elsewhere"].map(t => EditTarget.fieldOf(page.find(t, HTMLElement)))).toEqual([null, null, null]);
  });

  it("captures a field's selection and whether it can be written, and restores the focus and the selection", () => {
    const field = page.find(".field", HTMLInputElement);
    field.focus();
    field.setSelectionRange(0, 7, "backward");
    const target = EditTarget.capture(field, document);
    field.setSelectionRange(3, 3);
    const collapsed = EditTarget.capture(field, document);

    page.find(".elsewhere", HTMLButtonElement).focus();
    target.restore(document);

    expect([target.element, target.hasSelection, target.isWritable, collapsed.hasSelection]).toEqual([field, true, true, false]);
    expect(document.activeElement).toBe(field);
    expect([field.selectionStart, field.selectionEnd, field.selectionDirection]).toEqual([0, 7, "backward"]);
    expect([EditTarget.capture(page.find(".locked", HTMLElement), document).isWritable, EditTarget.capture(page.find(".off", HTMLElement), document).isWritable]).toEqual([false, false]);
  });

  it("treats a field without a selection range as selected", () => {
    expect(EditTarget.capture(page.find(".count", HTMLElement), document).hasSelection).toBe(true);
  });

  it("captures and restores a selection inside rich text, and treats rich text without one inside it as unselected", () => {
    const rich = page.find(".rich", HTMLElement);
    rich.focus();
    const range = document.createRange();
    const text = document.createTextNode("Rich text");
    rich.replaceChildren(text);
    range.setStart(text, 0);
    range.setEnd(text, 4);
    document.getSelection()?.removeAllRanges();
    document.getSelection()?.addRange(range);
    const target = EditTarget.capture(rich, document);
    document.getSelection()?.removeAllRanges();
    const unselected = EditTarget.capture(rich, document);
    const plainRange = document.createRange();
    plainRange.selectNodeContents(page.find(".plain", HTMLElement));
    document.getSelection()?.addRange(plainRange);
    const outside = EditTarget.capture(rich, document);

    target.restore(document);

    expect([target.hasSelection, target.isWritable, unselected.hasSelection, outside.hasSelection]).toEqual([true, true, false, false]);
    expect(document.activeElement).toBe(rich);
    expect(document.getSelection()?.toString()).toBe("Rich");
  });
});
