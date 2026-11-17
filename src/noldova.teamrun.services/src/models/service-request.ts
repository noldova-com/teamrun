/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class ServiceRequest<T> {
  public readonly payload: T;

  public constructor(payload: T) {
    this.payload = payload;
  }
}
