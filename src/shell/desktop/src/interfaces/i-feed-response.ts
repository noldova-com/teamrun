/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export interface IFeedResponse {
  readonly ok: boolean;
  readonly status: number;
  readonly url: string;
  text(): Promise<string>;
}
