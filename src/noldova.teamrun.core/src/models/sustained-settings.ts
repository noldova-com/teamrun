/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { RequestedSettings } from "@noldova/teamrun.protocol";

export class SustainedSettings {
  public readonly requested: RequestedSettings;
  public readonly note: string | null;

  public constructor(requested: RequestedSettings, note: string | null) {
    this.requested = requested;
    this.note = note;
  }
}
