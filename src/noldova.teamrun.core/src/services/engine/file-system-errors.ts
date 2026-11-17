/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

export class FileSystemErrors {
  public static isFileSystemError(error: unknown): error is NodeJS.ErrnoException {
    return error instanceof Error && "syscall" in error && Object.isString(error.syscall);
  }
}
