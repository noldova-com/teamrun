/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { JsonReader } from "@noldova/teamrun-foundation-json";

import { WireMessageKind } from "../enums/wire-message-kind.js";
import { Cancel } from "../models/cancel.js";
import { Event } from "../models/event.js";
import { Handshake } from "../models/handshake.js";
import { Request } from "../models/request.js";
import { Response } from "../models/response.js";
import type { WireMessage } from "../models/wire-message.js";
import { Resources } from "../resources.js";

export class WireDecoder {
  private static readonly KINDS: readonly WireMessageKind[] = Object.values(WireMessageKind);

  public decode(text: string): WireMessage {
    const reader = JsonReader.parse(text);
    const value = reader.toJson();
    switch (reader.readOneOf(Resources.kindField, WireDecoder.KINDS)) {
      case WireMessageKind.Handshake:
        return Handshake.fromJson(value);
      case WireMessageKind.Request:
        return Request.fromJson(value);
      case WireMessageKind.Response:
        return Response.fromJson(value);
      case WireMessageKind.Event:
        return Event.fromJson(value);
      case WireMessageKind.Cancel:
        return Cancel.fromJson(value);
    }
  }
}
