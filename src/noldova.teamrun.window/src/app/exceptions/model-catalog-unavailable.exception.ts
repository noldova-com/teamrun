/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../../resources";
import { WindowException } from "./window.exception";

export class ModelCatalogUnavailableException extends WindowException {
  public override readonly name: string = "ModelCatalogUnavailableException";
  public readonly kind: string;
  public readonly providerId: string | null;

  public constructor(kind: string, providerId: string | null) {
    super(Resources.modelCatalogUnavailable);
    this.kind = kind;
    this.providerId = providerId;
  }
}
