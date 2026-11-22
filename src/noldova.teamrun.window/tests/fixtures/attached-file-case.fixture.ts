/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ShownNotice } from "./shown-notice.fixture";

export class AttachedFileCase {
  public readonly title: string;
  public readonly name: string;
  public readonly saved: string;
  public readonly openFailure: string | null;
  public readonly folderFailure: string | null;
  public readonly exists: boolean | null;
  public readonly shown: readonly string[];
  public readonly notice: ShownNotice | null;

  public constructor(title: string, name: string, saved: string, openFailure: string | null, folderFailure: string | null, exists: boolean | null,
    shown: readonly string[], notice: ShownNotice | null) {
    this.title = title;
    this.name = name;
    this.saved = saved;
    this.openFailure = openFailure;
    this.folderFailure = folderFailure;
    this.exists = exists;
    this.shown = shown;
    this.notice = notice;
  }
}
