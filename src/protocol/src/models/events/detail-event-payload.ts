/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import { JsonReader, type JsonObject } from "@noldova/teamrun-foundation-json";

import { Resources } from "../../resources.js";
import { MessageDetail } from "../message-detail.js";

export class DetailEventPayload {
  public readonly messageId: string;
  public readonly detail: MessageDetail;

  public constructor(messageId: string, detail: MessageDetail) {
    ArgumentException.throwIfNullOrWhitespace(messageId, Resources.messageIdField);

    this.messageId = messageId;
    this.detail = detail;
  }

  public static fromJson(value: unknown, path?: string): DetailEventPayload {
    const reader = JsonReader.fromValue(value, path);
    const detail = reader.readObject(Resources.detailField);
    return new DetailEventPayload(reader.readNonBlankString(Resources.messageIdField), MessageDetail.fromJson(detail.toJson(), detail.path));
  }

  public toJson(): JsonObject {
    return {
      [Resources.messageIdField]: this.messageId,
      [Resources.detailField]: this.detail.toJson()
    };
  }
}
