/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export interface IScreenshotOptions {
  readonly path?: string;
  readonly save?: boolean;
  readonly base64?: boolean | undefined;
  readonly [option: string]: unknown;
}
