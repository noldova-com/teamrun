/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { BuildIdentity, Handshake, type Response, RuntimeHandover } from "@noldova/teamrun-shell-protocol";
import { CapabilityToken, type Endpoint, MethodRegistry, RuntimeServer, ServerSettings } from "@noldova/teamrun-shell-runtime";

import { RawConnectionFixture } from "./raw-connection.fixture.js";
import { TextOutputFixture } from "./text-output.fixture.js";

export class RuntimeServerFixture implements AsyncDisposable {
  public static readonly IDENTITY: BuildIdentity = new BuildIdentity("1.2.3", BuildIdentity.supportedProtocolVersion, "server-build");
  public static readonly OTHER_IDENTITY: BuildIdentity = new BuildIdentity("1.2.3", BuildIdentity.supportedProtocolVersion, "other-build");
  public static readonly TOKEN: string = "fixture-token";
  public static readonly EXECUTABLE: string = "/opt/teamrun/teamrun";

  private readonly connections: RawConnectionFixture[] = [];
  private readonly waiters: Set<() => void> = new Set();

  public readonly methods: MethodRegistry = new MethodRegistry();
  public readonly diagnostics: TextOutputFixture = new TextOutputFixture();
  public readonly server: RuntimeServer;
  public changes: number = 0;
  public endpoint: Endpoint | null = null;
  public onChange: () => void = () => undefined;

  public constructor(settings: ServerSettings = new ServerSettings(64 * 1024, 1_000, 1_000, 2_000)) {
    this.server = new RuntimeServer(
      RuntimeServerFixture.IDENTITY,
      new CapabilityToken(RuntimeServerFixture.TOKEN),
      new RuntimeHandover(RuntimeServerFixture.IDENTITY, RuntimeServerFixture.EXECUTABLE),
      this.methods,
      settings,
      () => {
        this.changes++;
        this.onChange();
        for (const waiter of [...this.waiters])
          waiter();
      },
      this.diagnostics);
  }

  public static async startAsync(settings?: ServerSettings): Promise<RuntimeServerFixture> {
    const fixture = new RuntimeServerFixture(settings);
    fixture.endpoint = await fixture.server.listenTcpAsync();
    return fixture;
  }

  public waitUntilAsync(condition: () => boolean): Promise<void> {
    if (condition())
      return Promise.resolve();
    return new Promise<void>(resolve => {
      const check = (): void => {
        if (!condition())
          return;
        this.waiters.delete(check);
        resolve();
      };
      this.waiters.add(check);
    });
  }

  public async connectAsync(allowHalfOpen: boolean = false): Promise<RawConnectionFixture> {
    if (this.endpoint === null)
      throw new Error("The server is not listening.");
    const connection = await RawConnectionFixture.connectAsync(this.endpoint, allowHalfOpen);
    this.connections.push(connection);
    return connection;
  }

  public async handshakeAsync(
    client: string = "tester",
    identity: BuildIdentity = RuntimeServerFixture.IDENTITY,
    token: string = RuntimeServerFixture.TOKEN): Promise<[RawConnectionFixture, Response]> {
    const connection = await this.connectAsync();
    connection.sendMessages(new Handshake(`${client}:0`, identity, token, client));
    return [connection, await connection.readResponseAsync()];
  }

  public async authenticateAsync(client: string = "tester"): Promise<RawConnectionFixture> {
    const [connection, answer] = await this.handshakeAsync(client);
    if (answer.hasFailed)
      throw new Error(`The handshake failed: ${answer.toText()}`);
    return connection;
  }

  public async [Symbol.asyncDispose](): Promise<void> {
    for (const connection of this.connections)
      connection[Symbol.dispose]();
    await this.server.closeAsync();
  }
}
