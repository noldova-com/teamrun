/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export default class ApiVisibility {
  public static readonly PUBLIC: ApiVisibility = new ApiVisibility(false);
  public static readonly PUBLIC_AND_PROTECTED: ApiVisibility = new ApiVisibility(true);

  public readonly includesProtected: boolean;

  private constructor(includesProtected: boolean) {
    this.includesProtected = includesProtected;
  }
}
