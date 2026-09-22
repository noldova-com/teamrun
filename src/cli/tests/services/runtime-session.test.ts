/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { JsonReader } from "@noldova/teamrun-foundation-json";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { EventName, MethodName } from "@noldova/teamrun-protocol";
import { CommandFailedException, RuntimeSession } from "@noldova/teamrun-cli";

import { CliTestHost } from "../fixtures/cli-test-host.fixture.js";
import { Wait } from "../fixtures/wait.fixture.js";

@TestClass
export class RuntimeSessionTests {
  @TestMethod
  public async callsAndSubscribes(): Promise<void> {
    await using host = await CliTestHost.create();
    const session = await RuntimeSession.open(host.connections);
    const names: string[] = [];
    const subscription = session.subscribe({ handleEvent: event => names.push(event.name) });

    const providers = await session.call(MethodName.ProviderList, null);
    const failure = await Assert.throwsAsync(() => session.call("nope/method", null), CommandFailedException);
    const created = JsonReader.fromValue(await session.call(MethodName.ProviderAccountCreate, { provider: "fake", label: "Work", profileDir: host.directory.resolve("profile") }));
    await session.call(MethodName.ProviderAccountCheck, { providerAccountId: created.readString("id") });
    await Wait.until(() => names.includes(EventName.ProviderAccountUpdated));
    subscription[Symbol.dispose]();
    const connected = session.isConnected;
    session[Symbol.dispose]();

    Assert.isTrue(JSON.stringify(providers).includes("fake"));
    Assert.areEqual("UnknownMethod", failure.info.name);
    Assert.isTrue(connected);
    Assert.isFalse(subscription.isActive);
  }
}
