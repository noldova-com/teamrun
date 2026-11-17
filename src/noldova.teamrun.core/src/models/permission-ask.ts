/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/context.exceptions";
import type { JsonValue } from "@noldova/context.json";

import { Resources } from "../resources.js";
import { Guid } from "./guid.js";

export class PermissionAsk {
  public readonly action: string;
  public readonly title: string;
  public readonly payload: JsonValue;
  public readonly remembersInChat: boolean;
  public readonly allowAlwaysLabel: string | null;
  public readonly takeOverLabel: string | null;
  public readonly id: string;
  public readonly offersAllowOnce: boolean;

  public constructor(action: string, title: string, payload: JsonValue, remembersInChat: boolean, allowAlwaysLabel: string | null = null,
    takeOverLabel: string | null = null, id: string = Guid.createVersion7().toString(), offersAllowOnce: boolean = true) {
    ArgumentException.throwIfNullOrWhitespace(action, Resources.actionParameterName);
    ArgumentException.throwIfNullOrWhitespace(title, Resources.titleParameterName);
    if (!Object.isNull(allowAlwaysLabel))
      ArgumentException.throwIfNullOrWhitespace(allowAlwaysLabel, Resources.allowAlwaysLabelParameterName);
    if (!Object.isNull(takeOverLabel))
      ArgumentException.throwIfNullOrWhitespace(takeOverLabel, Resources.takeOverLabelParameterName);

    if (!offersAllowOnce && !remembersInChat && Object.isNull(allowAlwaysLabel))
      throw new ArgumentException(Resources.permissionAskAllowsNothing, Resources.offersAllowOnceParameterName);

    this.action = action;
    this.title = title;
    this.payload = payload;
    this.remembersInChat = remembersInChat;
    this.allowAlwaysLabel = allowAlwaysLabel;
    this.takeOverLabel = takeOverLabel;
    this.id = id;
    this.offersAllowOnce = offersAllowOnce;
  }
}
