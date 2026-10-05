/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { QualifiedName, Response } from "@noldova/teamrun-shell-protocol";
import { ClientSettings, type Endpoint, RuntimeClient } from "@noldova/teamrun-shell-runtime";

import { ClientListenerFixture } from "./client-listener.fixture.js";
import { RawServerFixture } from "./raw-server.fixture.js";
import { RuntimeServerFixture } from "./runtime-server.fixture.js";

export class RuntimeClientFixture {
  public static readonly ECHO: QualifiedName = new QualifiedName("notes", "echo");
  public static readonly WAIT: QualifiedName = new QualifiedName("notes", "wait");
  public static readonly SETTINGS: ClientSettings = new ClientSettings(300, 1_000, 50);
  public static readonly AUTHENTICATED: string = Response.success("desktop:0", RuntimeServerFixture.IDENTITY.toJson()).toText();

  public static connectAsync(fixture: RuntimeServerFixture, listener: ClientListenerFixture): Promise<RuntimeClient> {
    return RuntimeClient.connectAsync(
      RuntimeClientFixture.endpointOf(fixture),
      RuntimeServerFixture.TOKEN,
      RuntimeServerFixture.IDENTITY,
      "desktop",
      listener,
      RuntimeClientFixture.SETTINGS);
  }

  public static async runAsync(test: (fixture: RuntimeServerFixture, listener: ClientListenerFixture) => Promise<void>): Promise<void> {
    await using fixture = await RuntimeServerFixture.startAsync();
    await test(fixture, new ClientListenerFixture());
  }

  public static async runRawAsync(
    reply: (frame: string, index: number) => readonly string[] | null,
    test: (server: RawServerFixture, listener: ClientListenerFixture) => Promise<void>): Promise<void> {
    await using server = await RawServerFixture.startAsync(reply);
    await test(server, new ClientListenerFixture());
  }

  public static endpointOf(fixture: RuntimeServerFixture): Endpoint {
    if (fixture.endpoint === null)
      throw new Error("The server is not listening.");
    return fixture.endpoint;
  }
}
