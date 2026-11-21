/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Message, RequestedSettings } from "@noldova/teamrun.protocol";

import type { HandoverPrompt } from "../services/sustain/handover-prompt.js";
import type { SustainedSettings } from "./sustained-settings.js";

export class MovedSettings {
  public readonly sustained: SustainedSettings | null;
  public readonly requested: RequestedSettings;
  public readonly handover: HandoverPrompt | null;
  public readonly posted: Message | null;
  public readonly kept: string | null;

  public constructor(sustained: SustainedSettings | null, requested: RequestedSettings, handover: HandoverPrompt | null, posted: Message | null, kept: string | null) {
    this.sustained = sustained;
    this.requested = requested;
    this.handover = handover;
    this.posted = posted;
    this.kept = kept;
  }
}
