/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export interface IUpdateBackend {
  check(): Promise<string | null>;
  download(progress: (percent: number) => void): Promise<void>;
  install(): Promise<void>;
  dispose(): void;
}
