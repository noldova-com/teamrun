/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/context.exceptions";
import { JsonReader, type JsonObject } from "@noldova/context.json";

import { PanelOutcome } from "../../enums/panel-outcome.js";
import { Resources } from "../../resources.js";

export class PanelAnsweredParams {
  public readonly requestId: string;
  public readonly windowId: string;
  public readonly outcome: PanelOutcome;

  public constructor(requestId: string, windowId: string, outcome: PanelOutcome) {
    ArgumentException.throwIfNullOrWhitespace(requestId, Resources.requestIdField);
    ArgumentException.throwIfNullOrWhitespace(windowId, Resources.windowIdField);
    if (!Object.values(PanelOutcome).includes(outcome))
      throw new ArgumentException(Resources.invalidPanelOutcome, Resources.outcomeField);

    this.requestId = requestId;
    this.windowId = windowId;
    this.outcome = outcome;
  }

  public static fromJson(value: unknown, path?: string): PanelAnsweredParams {
    const reader = JsonReader.fromValue(value, path);
    return new PanelAnsweredParams(reader.readNonBlankString(Resources.requestIdField), reader.readNonBlankString(Resources.windowIdField),
      reader.readOneOf(Resources.outcomeField, Object.values(PanelOutcome)));
  }

  public toJson(): JsonObject {
    return {
      [Resources.requestIdField]: this.requestId,
      [Resources.windowIdField]: this.windowId,
      [Resources.outcomeField]: this.outcome
    };
  }
}
