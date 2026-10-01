/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type SourceFile from "./source-file.ts";

export default class SourceInventory {
  public readonly moduleIds: readonly string[];
  public readonly files: readonly SourceFile[];

  public constructor(moduleIds: readonly string[], files: readonly SourceFile[]) {
    this.moduleIds = moduleIds;
    this.files = files;
  }
}
