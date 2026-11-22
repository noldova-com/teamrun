/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ShownNotice } from "./shown-notice.fixture";

export class OutsideLinkCase {
  public readonly name: string;
  public readonly target: string;
  public readonly openFailure: string | null;
  public readonly folderFailure: string | null;
  public readonly opened: readonly string[];
  public readonly shown: readonly string[];
  public readonly notice: ShownNotice | null;

  public constructor(name: string, target: string, openFailure: string | null, folderFailure: string | null, opened: readonly string[], shown: readonly string[],
    notice: ShownNotice | null) {
    this.name = name;
    this.target = target;
    this.openFailure = openFailure;
    this.folderFailure = folderFailure;
    this.opened = opened;
    this.shown = shown;
    this.notice = notice;
  }
}
