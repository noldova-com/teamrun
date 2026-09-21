/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException, ArgumentOutOfRangeException } from "@noldova/teamrun-foundation-exceptions";

import type { ChangeOperation } from "../enums/change-operation.js";
import { Resources } from "../resources.js";

export class Change {
  public readonly sequence: number;
  public readonly entity: string;
  public readonly entityId: string;
  public readonly operation: ChangeOperation;
  public readonly payload: string;
  public readonly createdAt: string;

  public constructor(sequence: number, entity: string, entityId: string, operation: ChangeOperation, payload: string, createdAt: string) {
    if (!Number.isInteger(sequence) || sequence <= 0)
      throw new ArgumentOutOfRangeException(Resources.sequenceParameterName, sequence);
    ArgumentException.throwIfNullOrWhitespace(entity, Resources.entityParameterName);
    ArgumentException.throwIfNullOrWhitespace(entityId, Resources.entityIdParameterName);
    ArgumentException.throwIfNullOrWhitespace(createdAt, Resources.createdAtParameterName);

    this.sequence = sequence;
    this.entity = entity;
    this.entityId = entityId;
    this.operation = operation;
    this.payload = payload;
    this.createdAt = createdAt;
  }
}
