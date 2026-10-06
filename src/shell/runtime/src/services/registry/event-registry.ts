/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonValue } from "@noldova/teamrun-foundation-json";
import { Event, type QualifiedName } from "@noldova/teamrun-shell-protocol";

import { RegistrationException } from "../../exceptions/registration.exception.js";
import type { IEventSink } from "../../interfaces/i-event-sink.js";
import { EventChannel } from "../../models/event-channel.js";
import { Resources } from "../../resources.js";

export class EventRegistry {
  private readonly names: Set<string> = new Set();
  private readonly sink: IEventSink;

  public constructor(sink: IEventSink) {
    this.sink = sink;
  }

  public declare(name: QualifiedName): EventChannel {
    if (this.names.has(name.text))
      throw new RegistrationException(Resources.formatEventDeclared(name.text));

    this.names.add(name.text);
    return new EventChannel(
      (payload: JsonValue) => this.publish(name, payload),
      () => this.names.delete(name.text));
  }

  private publish(name: QualifiedName, payload: JsonValue): void {
    if (!this.names.has(name.text))
      throw new RegistrationException(Resources.formatEventWithdrawn(name.text));
    this.sink.broadcast(new Event(name, payload));
  }
}
