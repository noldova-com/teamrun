/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ArgumentException } from "@noldova/context.exceptions";

import { Resources } from "../resources.js";

export class RememberedAppGrant {
  public readonly id: string;
  public readonly app: string | null;
  public readonly scope: string;
  public readonly rememberedAt: Date;

  public constructor(id: string, app: string | null, scope: string, rememberedAt: Date) {
    ArgumentException.throwIfNullOrWhitespace(id, Resources.idParameterName);
    if (!Object.isNull(app))
      ArgumentException.throwIfNullOrWhitespace(app, Resources.appParameterName);
    ArgumentException.throwIfNullOrWhitespace(scope, Resources.scopeParameterName);

    this.id = id;
    this.app = app;
    this.scope = scope;
    this.rememberedAt = rememberedAt;
  }
}
