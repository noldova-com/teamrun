/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import "@noldova/teamrun-foundation-core";
import type { JsonValue } from "@noldova/teamrun-foundation-json";
import {
  type BuildIdentity, Event, Handshake, NotificationBroadcast, NotificationPost, NotificationReference, NotificationSeverity, NotificationState, NotificationsQuery, QualifiedName, Request, Response,
  ShellMethods, WireDecoder
} from "@noldova/teamrun-shell-protocol";
import { DataDirectory, DiscoveryReader, Endpoint, type RuntimeDiscovery, RuntimeEntry, RuntimeHost, RuntimeOptions, ServerSettings } from "@noldova/teamrun-shell-runtime";

import { RawConnectionFixture } from "./raw-connection.fixture.js";
import { SocketFolderFixture } from "./socket-folder.fixture.js";

export class RuntimeHostFixture implements AsyncDisposable {
  public static readonly PART: string = [
    "import { mkdir, writeFile } from \"node:fs/promises\";",
    "import path from \"node:path\";",
    "",
    "export class RuntimePart {",
    "  async activateAsync(context) {",
    "    this.folder = context.moduleFolder;",
    "    context.registerMethod(`${context.moduleId}.echo`, { handleAsync: async request => request.payload });",
    "  }",
    "",
    "  async deactivateAsync() {",
    "    await mkdir(this.folder, { recursive: true });",
    "    await writeFile(path.join(this.folder, \"deactivated\"), \"yes\");",
    "  }",
    "}",
    ""
  ].join("\n");

  private readonly connections: RawConnectionFixture[] = [];
  private currentHost: RuntimeHost | null = null;

  public readonly root: string;
  public readonly dataDirectory: DataDirectory;

  private constructor(root: string) {
    this.root = root;
    this.dataDirectory = new DataDirectory(path.join(root, "data"));
  }

  public get host(): RuntimeHost {
    if (this.currentHost === null)
      throw new Error("The host has not started.");
    return this.currentHost;
  }

  public static async createAsync(): Promise<RuntimeHostFixture> {
    return new RuntimeHostFixture((await SocketFolderFixture.createAsync("tr-host-")).path);
  }

  public async startAsync(idleGraceMilliseconds: number = 30_000, declarationsFile?: string, takeoverMilliseconds?: number,
    environment: NodeJS.ProcessEnv = process.env): Promise<RuntimeHost> {
    const options = new RuntimeOptions(this.dataDirectory, idleGraceMilliseconds, new ServerSettings(), declarationsFile, null, takeoverMilliseconds);
    this.currentHost = await RuntimeHost.startAsync(options, process.platform, environment);
    return this.currentHost;
  }

  public async writeModulesAsync(modules: readonly (readonly [string, string | null])[]): Promise<string> {
    const folder = path.join(this.root, "build");
    await mkdir(folder, { recursive: true });
    const declarations = [];
    for (const [id, source] of modules) {
      const file = path.join(folder, `${id}.mjs`);
      if (source !== null)
        await writeFile(file, source);
      declarations.push({ id, version: "0.0.1", displayName: id, description: id, dependencies: [], runtimePackage: pathToFileURL(file).href, contributes: { methods: [`${id}.echo`], commands: [`${id}.tick`, `${id}.pause`], notifications: [`${id}.alarm`] } });
    }
    const declarationsFile = path.join(folder, "declarations.json");
    await writeFile(declarationsFile, JSON.stringify({ formatVersion: 1, modules: declarations }));
    return declarationsFile;
  }

  public async readDiscoveryAsync(): Promise<RuntimeDiscovery> {
    const discovery = await DiscoveryReader.readAsync(this.dataDirectory);
    if (discovery === null)
      throw new Error("The host has published no discovery metadata.");
    return discovery;
  }

  public async handshakeAsync(client: string, identity: BuildIdentity): Promise<[RawConnectionFixture, Response]> {
    const discovery = await this.readDiscoveryAsync();
    const connection = await RawConnectionFixture.connectAsync(Endpoint.parse(discovery.endpoint));
    this.connections.push(connection);
    connection.sendMessages(new Handshake(`${client}:0`, identity, discovery.token, client));
    return [connection, await connection.readResponseAsync()];
  }

  public static createAlarm(title: string, kind: string = "clock.alarm"): NotificationPost {
    return new NotificationPost(QualifiedName.parse(kind), "window", title, null, NotificationSeverity.Warning, null, [], null);
  }

  public static async readMessagesAsync(connection: RawConnectionFixture, count: number): Promise<[Map<string, Response>, Event[]]> {
    const responses = new Map<string, Response>();
    const events: Event[] = [];
    for (let index = 0; index < count; index++) {
      const message = new WireDecoder().decode(await connection.readTextAsync());
      if (message instanceof Response)
        responses.set(String(message.id), message);
      else if (message instanceof Event)
        events.push(message);
    }
    return [responses, events];
  }

  public static async readResponsesAsync(connection: RawConnectionFixture, count: number): Promise<Map<string, Response>> {
    const responses = new Map<string, Response>();
    for (let index = 0; index < count; index++) {
      const response = await connection.readResponseAsync();
      responses.set(String(response.id), response);
    }
    return responses;
  }

  public static async callAsync(connection: RawConnectionFixture, id: string, method: QualifiedName, payload: JsonValue): Promise<Response> {
    connection.sendMessages(new Request(id, method, payload));
    return await connection.readResponseAsync();
  }

  public static async listAndPostAsync(connection: RawConnectionFixture): Promise<[string, string, Event]> {
    const listed = await RuntimeHostFixture.callAsync(connection, "desktop:1", ShellMethods.notifications, new NotificationsQuery("laptop").toJson());
    const synced = NotificationState.fromJson(listed.payload).notifications[0]?.id ?? "";
    connection.sendMessages(new Request("desktop:2", ShellMethods.postNotification, RuntimeHostFixture.createAlarm("Posted").toJson()));
    const event = await connection.readEventAsync();
    const posted = NotificationReference.fromJson((await connection.readResponseAsync()).payload).id;
    return [synced, posted, event];
  }

  public static formatTitles(payload: JsonValue, synced: string, posted: string): string {
    const name = (id: string): string => id === synced ? "synced" : id === posted ? "posted" : id;
    return NotificationBroadcast.fromJson(payload).notifications.map(t => `${name(t.id)}:${t.post.title}`).join(",");
  }

  public static createNotificationPart(): string {
    const protocol = import.meta.resolve("@noldova/teamrun-shell-protocol");
    return [
      `import { CommandRun, NotificationAction, NotificationPost, QualifiedName } from ${JSON.stringify(protocol)};`,
      "",
      "export class RuntimePart {",
      "  async activateAsync(context) {",
      "    const tick = new NotificationAction(\"Tick\", new CommandRun(QualifiedName.parse(\"clock.tick\"), null));",
      "    context.postNotification(new NotificationPost(QualifiedName.parse(\"clock.alarm\"), null, \"Synced\", null, \"Success\", null, [tick], 1));",
      "  }",
      "",
      "  async deactivateAsync() {",
      "  }",
      "}",
      ""
    ].join("\n");
  }

  public static createCommandPart(): string {
    const api = pathToFileURL(path.join(path.dirname(RuntimeEntry.entryPath), "..", "api", "index.js")).href;
    return [
      `import { RuntimeCommand } from ${JSON.stringify(api)};`,
      "",
      "export class RuntimePart {",
      "  async activateAsync(context) {",
      "    const tick = new RuntimeCommand(\"clock.tick\", \"Tick\", \"timer\", \"Mod+Alt+T\", { handleAsync: async request => ({ client: request.client, arguments: request.payload }) });",
      "    const pause = new RuntimeCommand(\"clock.pause\", \"Pause\", null, null, { handleAsync: async () => {",
      "      pause.setChecked(true);",
      "      tick.setEnabled(false);",
      "      return null;",
      "    } }, false);",
      "    context.registerCommand(tick);",
      "    context.registerCommand(pause);",
      "  }",
      "",
      "  async deactivateAsync() {",
      "  }",
      "}",
      ""
    ].join("\n");
  }

  public static createWorkPart(): string {
    const api = pathToFileURL(path.join(path.dirname(RuntimeEntry.entryPath), "..", "api", "index.js")).href;
    return [
      "import { writeFileSync } from \"node:fs\";",
      "import path from \"node:path\";",
      "",
      `import { RuntimeCommand } from ${JSON.stringify(api)};`,
      "",
      "export class RuntimePart {",
      "  async activateAsync(context) {",
      "    context.registerCommand(new RuntimeCommand(\"clock.tick\", \"Tick\", \"timer\", \"Mod+Alt+T\", { handleAsync: async () => {",
      "      const folder = await context.getWorkFolderAsync();",
      "      const work = context.beginWork(\"Ticking\");",
      "      context.log.write(\"Ticking began\");",
      "      work.signal.addEventListener(\"abort\", () => {",
      "        writeFileSync(path.join(folder, \"aborted\"), \"\");",
      "        work[Symbol.dispose]();",
      "      });",
      "      return null;",
      "    } }));",
      "  }",
      "",
      "  async deactivateAsync() {",
      "  }",
      "}",
      ""
    ].join("\n");
  }

  public static async runAsync(test: (fixture: RuntimeHostFixture) => Promise<void>): Promise<void> {
    await using fixture = await RuntimeHostFixture.createAsync();
    await test(fixture);
  }

  public async [Symbol.asyncDispose](): Promise<void> {
    for (const connection of this.connections)
      connection[Symbol.dispose]();
    if (this.currentHost !== null) {
      this.currentHost.requestStop("test");
      await this.currentHost.waitForStopAsync().catch(() => undefined);
    }
    await rm(this.root, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 });
  }
}
