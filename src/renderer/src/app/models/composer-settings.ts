/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { RequestedSettings } from "@noldova/teamrun-protocol";

export class ComposerSettings {
  public readonly provider: string;
  public readonly model: string | null;
  public readonly effort: string | null;
  public readonly providerAccountId: string | null;
  public readonly responderTeammateId: string | null;

  public constructor(provider: string, model: string | null, effort: string | null, providerAccountId: string | null, responderTeammateId: string | null = null) {
    this.provider = provider;
    this.model = model;
    this.effort = effort;
    this.providerAccountId = providerAccountId;
    this.responderTeammateId = responderTeammateId;
  }

  public toRequested(): RequestedSettings {
    return new RequestedSettings(this.provider, this.model, this.effort);
  }
}
