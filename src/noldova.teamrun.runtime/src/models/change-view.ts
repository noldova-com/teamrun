/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IPermissionDetail } from "@noldova/desktop.runtime";

export class ChangeView {
  public readonly subject: string;
  public readonly title: string;
  public readonly details: readonly IPermissionDetail[];
  public readonly state: string;

  public constructor(subject: string, title: string, details: readonly IPermissionDetail[], state: string) {
    this.subject = subject;
    this.title = title;
    this.details = details;
    this.state = state;
  }
}
