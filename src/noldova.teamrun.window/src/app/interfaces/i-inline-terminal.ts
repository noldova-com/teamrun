/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Signal } from "@angular/core";

export interface IInlineTerminal {
  readonly element: HTMLElement;
  readonly rowHeight: Signal<number>;
  setMaximumRows(rows: number): void;
  setShown(shown: boolean): void;
  focus(): void;
  dispose(): void;
}
