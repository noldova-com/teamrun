/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export default class PackageException extends Error {
  private static readonly PACKAGE_EXCEPTION_NAME: string = "PackageException";

  public constructor(message: string) {
    super(message);

    this.name = PackageException.PACKAGE_EXCEPTION_NAME;
  }
}
