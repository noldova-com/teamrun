/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export interface IUpdater {
  readonly packagePath: string;
  readonly downloadedFile: string | null;
  checkAsync(): Promise<string | null>;
  downloadAsync(onProgress: (percent: number) => void): Promise<string>;
  cancel(): void;
}
