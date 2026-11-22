/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import type { FileSystemHook } from "./file-system-hook.fixture.js";

export class LinkSwapCase {
  public readonly name: string;
  public readonly hooks: readonly FileSystemHook[];
  public readonly restore: () => void;

  public constructor(name: string, hooks: readonly FileSystemHook[], restore: () => void) {
    this.name = name;
    this.hooks = hooks;
    this.restore = restore;
  }
}
