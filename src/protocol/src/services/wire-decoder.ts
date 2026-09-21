/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { JsonReader } from "@noldova/teamrun-foundation-json";

import { WireMessageKind } from "../enums/wire-message-kind.js";
import { Event } from "../models/event.js";
import { Hello } from "../models/hello.js";
import { Request } from "../models/request.js";
import { Response } from "../models/response.js";
import type { WireMessage } from "../models/wire-message.js";
import { Resources } from "../resources.js";

export class WireDecoder {
  private static readonly KINDS: readonly WireMessageKind[] = Object.values(WireMessageKind);

  public decodeText(text: string): WireMessage {
    return this.decode(JsonReader.parse(text));
  }

  public decodeValue(value: unknown): WireMessage {
    return this.decode(JsonReader.fromValue(value));
  }

  private decode(reader: JsonReader): WireMessage {
    const kind = reader.readOneOf(Resources.kindField, WireDecoder.KINDS);
    const value = reader.toJson();
    switch (kind) {
      case WireMessageKind.Hello:
        return Hello.fromJson(value);
      case WireMessageKind.Request:
        return Request.fromJson(value);
      case WireMessageKind.Response:
        return Response.fromJson(value);
      case WireMessageKind.Event:
        return Event.fromJson(value);
    }
  }
}
