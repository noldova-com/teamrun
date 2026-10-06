/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../../resources";

export class EditTarget {
  private readonly start: number | null;
  private readonly end: number | null;
  private readonly direction: "forward" | "backward" | "none";
  private readonly range: Range | null;

  public readonly element: HTMLElement;
  public readonly hasSelection: boolean;
  public readonly isWritable: boolean;

  private constructor(element: HTMLElement, start: number | null, end: number | null, direction: "forward" | "backward" | "none", range: Range | null) {
    this.element = element;
    this.start = start;
    this.end = end;
    this.direction = direction;
    this.range = range;
    this.hasSelection = EditTarget.isTextField(element) ? Object.isNull(start) || start !== end : !Object.isNull(range) && !range.collapsed;
    this.isWritable = EditTarget.isTextField(element) ? !element.readOnly && !element.disabled : true;
  }

  public static isEditable(element: HTMLElement): boolean {
    return EditTarget.isTextField(element) || element.isContentEditable;
  }

  public static fieldOf(element: HTMLElement): HTMLElement | null {
    if (EditTarget.isTextField(element))
      return element;
    let field: HTMLElement | null = element.isContentEditable ? element : null;
    while (field?.parentElement?.isContentEditable === true)
      field = field.parentElement;
    return field;
  }

  public static capture(element: HTMLElement, document: Document): EditTarget {
    if (EditTarget.isTextField(element))
      return new EditTarget(element, element.selectionStart, element.selectionEnd, element.selectionDirection ?? "none", null);
    const selection = document.getSelection();
    const range = Object.isNull(selection) || selection.rangeCount === 0 ? null : selection.getRangeAt(0);
    return new EditTarget(element, null, null, "none", !Object.isNull(range) && element.contains(range.commonAncestorContainer) ? range.cloneRange() : null);
  }

  public restore(document: Document): void {
    this.element.focus({ preventScroll: true });
    if (EditTarget.isTextField(this.element) && !Object.isNull(this.start) && !Object.isNull(this.end))
      this.element.setSelectionRange(this.start, this.end, this.direction);
    if (Object.isNull(this.range))
      return;
    const selection = document.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(this.range);
  }

  private static isTextField(element: HTMLElement): element is HTMLInputElement | HTMLTextAreaElement {
    return element instanceof HTMLTextAreaElement || (element instanceof HTMLInputElement && Resources.textInputTypes.includes(element.type));
  }
}
