/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class UnscriptedRequestError extends Error {
  public override readonly name: string = "UnscriptedRequestError";

  public constructor(method: string) {
    super(`No answer scripted for ${method}`);
  }
}
