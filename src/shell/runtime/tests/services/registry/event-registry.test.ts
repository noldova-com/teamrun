/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { type Event, QualifiedName } from "@noldova/teamrun-shell-protocol";
import { EventRegistry, type IEventSink, RegistrationException } from "@noldova/teamrun-shell-runtime";

@TestClass
export class EventRegistryTests {
  private static readonly NAME: QualifiedName = new QualifiedName("notes", "changed");

  @TestMethod
  public publishesADeclaredEventToTheSink(): void {
    const events: Event[] = [];
    const registry = new EventRegistry(EventRegistryTests.createSink(events));

    registry.declare(EventRegistryTests.NAME).publish({ path: "notes.md" });

    Assert.areEqual(1, events.length);
    Assert.areEqual("notes.changed", events[0]?.name.text);
    Assert.areEqual("{\"path\":\"notes.md\"}", JSON.stringify(events[0]?.payload));
  }

  @TestMethod
  public refusesASecondDeclarationOfOneName(): void {
    const registry = new EventRegistry(EventRegistryTests.createSink([]));
    registry.declare(EventRegistryTests.NAME);

    const exception = Assert.throws(() => registry.declare(EventRegistryTests.NAME), RegistrationException);

    Assert.areEqual("The event notes.changed is already declared.", exception.message);
  }

  @TestMethod
  public aWithdrawnChannelNoLongerPublishes(): void {
    const events: Event[] = [];
    const registry = new EventRegistry(EventRegistryTests.createSink(events));
    const channel = registry.declare(EventRegistryTests.NAME);

    channel[Symbol.dispose]();
    const exception = Assert.throws(() => channel.publish(null), RegistrationException);

    Assert.areEqual("The event notes.changed is no longer declared.", exception.message);
    Assert.areEqual(0, events.length);
    registry.declare(EventRegistryTests.NAME).publish(null);
    Assert.areEqual(1, events.length);
  }

  private static createSink(events: Event[]): IEventSink {
    return { broadcast: t => events.push(t) };
  }
}
