/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

export class FileSystemHook {
  public readonly name: "readSync" | "openSync" | "realpathSync";
  public readonly call: number;
  public readonly before: (() => void) | null;
  public readonly after: (() => void) | null;

  public constructor(name: "readSync" | "openSync" | "realpathSync", call: number, before: (() => void) | null, after: (() => void) | null) {
    this.name = name;
    this.call = call;
    this.before = before;
    this.after = after;
  }
}
