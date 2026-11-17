/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class ShownText {
  private static readonly DECORATIVE: string = "nol-file-badge";

  public static of(view: Node): string {
    return ShownText.textOf(view).trim();
  }

  private static textOf(view: Node): string {
    return [...view.childNodes]
      .map(t => t instanceof Element && t.matches(ShownText.DECORATIVE) ? "" : t.nodeType === Node.TEXT_NODE ? t.textContent ?? "" : ShownText.textOf(t))
      .join("");
  }
}
