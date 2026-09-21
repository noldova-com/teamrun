/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException, ArgumentOutOfRangeException } from "@noldova/teamrun-foundation-exceptions";

import type { ChangeOperation } from "../enums/change-operation.js";
import type { Change } from "../models/change.js";
import { Resources } from "../resources.js";

export abstract class ChangeFeed {
  public append(entity: string, entityId: string, operation: ChangeOperation, payload: string): Change {
    ArgumentException.throwIfNullOrWhitespace(entity, Resources.entityParameterName);
    ArgumentException.throwIfNullOrWhitespace(entityId, Resources.entityIdParameterName);

    return this.appendCore(entity, entityId, operation, payload);
  }

  public readAfter(sequence: number, limit: number = Resources.defaultChangeBatch): readonly Change[] {
    if (!Number.isInteger(sequence) || sequence < 0)
      throw new ArgumentOutOfRangeException(Resources.sequenceParameterName, sequence);
    if (!Number.isInteger(limit) || limit <= 0)
      throw new ArgumentOutOfRangeException(Resources.limitParameterName, limit);

    return this.readAfterCore(sequence, limit);
  }

  protected abstract appendCore(entity: string, entityId: string, operation: ChangeOperation, payload: string): Change;

  protected abstract readAfterCore(sequence: number, limit: number): readonly Change[];
}
