/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { NotificationSeverity } from "@noldova/desktop.protocol";

export class ShownNotice {
  public readonly title: string;
  public readonly text: string | null;
  public readonly severity: NotificationSeverity;

  public constructor(title: string, text: string | null, severity: NotificationSeverity) {
    this.title = title;
    this.text = text;
    this.severity = severity;
  }
}
