/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class LinkedFileCase {
  public readonly name: string;
  public readonly openFailure: string | null;
  public readonly folderFailure: string | null;
  public readonly opened: readonly string[];
  public readonly shown: readonly string[];
  public readonly error: string | null;

  public constructor(name: string, openFailure: string | null, folderFailure: string | null, opened: readonly string[], shown: readonly string[], error: string | null) {
    this.name = name;
    this.openFailure = openFailure;
    this.folderFailure = folderFailure;
    this.opened = opened;
    this.shown = shown;
    this.error = error;
  }
}
