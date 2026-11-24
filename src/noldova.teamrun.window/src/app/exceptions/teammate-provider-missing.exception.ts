/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../../resources";
import { WindowException } from "./window.exception";

export class TeammateProviderMissingException extends WindowException {
  public override readonly name: string = "TeammateProviderMissingException";
  public readonly teammateId: string;
  public readonly providerId: string;

  public constructor(teammateId: string, providerId: string) {
    super(Resources.formatTeammateProviderMissing(teammateId, providerId));
    this.teammateId = teammateId;
    this.providerId = providerId;
  }
}
