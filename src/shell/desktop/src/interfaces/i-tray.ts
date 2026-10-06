/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export interface ITray {
  setImage(image: string): void;
  setToolTip(toolTip: string): void;
  setContextMenu(menu: unknown): void;
  on(event: "click", listener: () => void): unknown;
  destroy(): void;
}
