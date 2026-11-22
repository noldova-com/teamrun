/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { PartReadError } from "./part-read-error.fixture";

export class PartReads {
  public static elementOf(found: unknown): HTMLElement {
    if (!(found instanceof HTMLElement))
      throw new PartReadError("The part the spec reads isn't an element.");
    return found;
  }

  public static buttonOf(found: unknown): HTMLButtonElement {
    if (!(found instanceof HTMLButtonElement))
      throw new PartReadError("The part the spec reads isn't a button.");
    return found;
  }
}
