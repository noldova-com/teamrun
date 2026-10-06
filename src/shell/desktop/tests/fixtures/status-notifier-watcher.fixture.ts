/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { once } from "node:events";
import { createConnection, type Socket } from "node:net";

interface IBusField {
  readonly code: number;
  readonly signature: string;
  readonly value: string | number;
}

interface IBusMessage {
  readonly type: number;
  readonly flags: number;
  readonly serial: number;
  readonly replySerial: number;
  readonly sender: string;
  readonly interfaceName: string;
  readonly member: string;
  readonly body: Buffer;
}

class BusWriter {
  private readonly bytes: number[] = [];

  public get length(): number {
    return this.bytes.length;
  }

  public align(size: number): this {
    while (this.bytes.length % size !== 0)
      this.bytes.push(0);
    return this;
  }

  public byte(value: number): this {
    this.bytes.push(value);
    return this;
  }

  public uint32(value: number): this {
    this.align(4);
    const word = Buffer.alloc(4);
    word.writeUInt32LE(value);
    this.bytes.push(...word);
    return this;
  }

  public text(value: string): this {
    const encoded = Buffer.from(value, "utf8");
    this.uint32(encoded.length);
    this.bytes.push(...encoded, 0);
    return this;
  }

  public signature(value: string): this {
    this.bytes.push(value.length, ...Buffer.from(value, "ascii"), 0);
    return this;
  }

  public field(field: IBusField): this {
    this.align(8).byte(field.code).signature(field.signature);
    if (typeof field.value === "number")
      return this.uint32(field.value);
    return field.signature === "g" ? this.signature(field.value) : this.text(field.value);
  }

  public patch(offset: number, value: number): this {
    const word = Buffer.alloc(4);
    word.writeUInt32LE(value);
    this.bytes.splice(offset, 4, ...word);
    return this;
  }

  public toBuffer(): Buffer {
    return Buffer.from(this.bytes);
  }
}

class BusReader {
  private readonly buffer: Buffer;
  private offset: number;

  public constructor(buffer: Buffer, offset: number) {
    this.buffer = buffer;
    this.offset = offset;
  }

  public get position(): number {
    return this.offset;
  }

  public align(size: number): this {
    this.offset = Math.ceil(this.offset / size) * size;
    return this;
  }

  public byte(): number {
    return this.buffer.readUInt8(this.offset++);
  }

  public uint32(): number {
    this.align(4);
    const value = this.buffer.readUInt32LE(this.offset);
    this.offset += 4;
    return value;
  }

  public text(): string {
    const length = this.uint32();
    const value = this.buffer.toString("utf8", this.offset, this.offset + length);
    this.offset += length + 1;
    return value;
  }

  public signature(): string {
    const length = this.byte();
    const value = this.buffer.toString("ascii", this.offset, this.offset + length);
    this.offset += length + 1;
    return value;
  }

  public value(signature: string): string | number {
    if (signature === "u")
      return this.uint32();
    return signature === "g" ? this.signature() : this.text();
  }
}

export class StatusNotifierWatcherFixture {
  private static readonly NAME: string = "org.kde.StatusNotifierWatcher";
  private static readonly PATH: string = "/StatusNotifierWatcher";
  private static readonly PROPERTY: string = "IsStatusNotifierHostRegistered";
  private static readonly PROPERTIES: string = "org.freedesktop.DBus.Properties";
  private static readonly INTROSPECTABLE: string = "org.freedesktop.DBus.Introspectable";
  private static readonly BUS: string = "org.freedesktop.DBus";
  private static readonly UNKNOWN_METHOD: string = "org.freedesktop.DBus.Error.UnknownMethod";
  private static readonly INTROSPECTION: string = [
    "<node>",
    "<interface name=\"org.freedesktop.DBus.Properties\"><method name=\"Get\"><arg type=\"s\" direction=\"in\"/><arg type=\"s\" direction=\"in\"/><arg type=\"v\" direction=\"out\"/></method></interface>",
    "<interface name=\"org.kde.StatusNotifierWatcher\"><property name=\"IsStatusNotifierHostRegistered\" type=\"b\" access=\"read\"/>",
    "<signal name=\"StatusNotifierHostRegistered\"/><signal name=\"StatusNotifierHostUnregistered\"/></interface>",
    "</node>"
  ].join("");
  private static readonly METHOD_CALL: number = 1;
  private static readonly METHOD_RETURN: number = 2;
  private static readonly ERROR: number = 3;
  private static readonly SIGNAL: number = 4;
  private static readonly NO_REPLY_EXPECTED: number = 1;
  private static readonly HEADER_LENGTH: number = 16;

  private readonly socket: Socket;
  private readonly replies: Map<number, () => void> = new Map();
  private received: Buffer = Buffer.alloc(0);
  private serial: number = 0;
  private isHostRegistered: boolean;
  private failure: Error | null = null;

  public gets: number = 0;

  private constructor(socket: Socket, isHostRegistered: boolean) {
    this.socket = socket;
    this.isHostRegistered = isHostRegistered;
    socket.on("error", (t: Error) => this.failure ??= t);
  }

  public static async connectAsync(address: string, isHostRegistered: boolean): Promise<StatusNotifierWatcherFixture> {
    const socket = createConnection(address.replace(/^unix:path=/, "").replace(/,.*$/, ""));
    await once(socket, "connect");
    const watcher = new StatusNotifierWatcherFixture(socket, isHostRegistered);
    await watcher.authenticateAsync();
    socket.on("data", (t: Buffer) => watcher.receive(t));
    watcher.send(StatusNotifierWatcherFixture.METHOD_CALL, 0, watcher.callFields("Hello"), "", Buffer.alloc(0));
    const requested = watcher.call("RequestName", "su", new BusWriter().text(StatusNotifierWatcherFixture.NAME).uint32(4).toBuffer());
    await requested;
    return watcher;
  }

  public setHost(isRegistered: boolean): void {
    this.isHostRegistered = isRegistered;
    const member = isRegistered ? "StatusNotifierHostRegistered" : "StatusNotifierHostUnregistered";
    this.send(StatusNotifierWatcherFixture.SIGNAL, StatusNotifierWatcherFixture.NO_REPLY_EXPECTED, [
      { code: 1, signature: "o", value: StatusNotifierWatcherFixture.PATH },
      { code: 2, signature: "s", value: StatusNotifierWatcherFixture.NAME },
      { code: 3, signature: "s", value: member }
    ], "", Buffer.alloc(0));
  }

  public async leaveAsync(): Promise<void> {
    const closed = new Promise(resolve => this.socket.once("close", resolve));
    this.socket.destroy();
    await closed;
    if (this.failure !== null)
      throw new Error(`The fixture watcher's connection to the private session bus failed: ${this.failure.message}`, { cause: this.failure });
  }

  private async authenticateAsync(): Promise<void> {
    const user = Buffer.from(String(process.getuid?.() ?? 0), "ascii").toString("hex");
    this.socket.write(`\0AUTH EXTERNAL ${user}\r\n`);
    const [answer] = await once(this.socket, "data") as [Buffer];
    if (!answer.toString("ascii").startsWith("OK "))
      throw new Error(`The private bus refused the watcher: ${answer.toString("ascii")}`);
    this.socket.write("BEGIN\r\n");
  }

  private callFields(member: string): IBusField[] {
    return [
      { code: 1, signature: "o", value: "/org/freedesktop/DBus" },
      { code: 2, signature: "s", value: StatusNotifierWatcherFixture.BUS },
      { code: 3, signature: "s", value: member },
      { code: 6, signature: "s", value: StatusNotifierWatcherFixture.BUS }
    ];
  }

  private call(member: string, signature: string, body: Buffer): Promise<void> {
    const serial = this.send(StatusNotifierWatcherFixture.METHOD_CALL, 0, this.callFields(member), signature, body);
    return new Promise<void>(resolve => this.replies.set(serial, resolve));
  }

  private send(type: number, flags: number, fields: readonly IBusField[], signature: string, body: Buffer): number {
    this.serial++;
    const writer = new BusWriter().byte(0x6c).byte(type).byte(flags).byte(1).uint32(body.length).uint32(this.serial).uint32(0);
    for (const field of signature === "" ? fields : [...fields, { code: 8, signature: "g", value: signature }])
      writer.field(field);
    writer.patch(12, writer.length - StatusNotifierWatcherFixture.HEADER_LENGTH).align(8);
    this.socket.write(Buffer.concat([writer.toBuffer(), body]));
    return this.serial;
  }

  private reply(call: IBusMessage, signature: string, body: Buffer): void {
    this.send(StatusNotifierWatcherFixture.METHOD_RETURN, StatusNotifierWatcherFixture.NO_REPLY_EXPECTED, [
      { code: 5, signature: "u", value: call.serial },
      { code: 6, signature: "s", value: call.sender }
    ], signature, body);
  }

  private receive(data: Buffer): void {
    this.received = Buffer.concat([this.received, data]);
    for (let message = this.take(); message !== null; message = this.take())
      this.handle(message);
  }

  private take(): IBusMessage | null {
    if (this.received.length < StatusNotifierWatcherFixture.HEADER_LENGTH)
      return null;
    const fieldsEnd = StatusNotifierWatcherFixture.HEADER_LENGTH + this.received.readUInt32LE(12);
    const bodyStart = Math.ceil(fieldsEnd / 8) * 8;
    const end = bodyStart + this.received.readUInt32LE(4);
    if (this.received.length < end)
      return null;
    const fields = new Map<number, string | number>();
    const reader = new BusReader(this.received, StatusNotifierWatcherFixture.HEADER_LENGTH);
    while (reader.align(8).position < fieldsEnd) {
      const code = reader.byte();
      fields.set(code, reader.value(reader.signature()));
    }
    const message: IBusMessage = {
      type: this.received.readUInt8(1),
      flags: this.received.readUInt8(2),
      serial: this.received.readUInt32LE(8),
      replySerial: Number(fields.get(5) ?? 0),
      interfaceName: String(fields.get(2) ?? ""),
      member: String(fields.get(3) ?? ""),
      sender: String(fields.get(7) ?? ""),
      body: this.received.subarray(bodyStart, end)
    };
    this.received = this.received.subarray(end);
    return message;
  }

  private handle(message: IBusMessage): void {
    if (message.type === StatusNotifierWatcherFixture.METHOD_RETURN || message.type === StatusNotifierWatcherFixture.ERROR) {
      this.replies.get(message.replySerial)?.();
      this.replies.delete(message.replySerial);
      return;
    }
    if (message.type !== StatusNotifierWatcherFixture.METHOD_CALL || (message.flags & StatusNotifierWatcherFixture.NO_REPLY_EXPECTED) !== 0)
      return;
    if (message.interfaceName === StatusNotifierWatcherFixture.PROPERTIES && message.member === "Get") {
      const reader = new BusReader(message.body, 0);
      if (reader.text() === StatusNotifierWatcherFixture.NAME && reader.text() === StatusNotifierWatcherFixture.PROPERTY) {
        this.gets++;
        this.reply(message, "v", new BusWriter().signature("b").uint32(this.isHostRegistered ? 1 : 0).toBuffer());
        return;
      }
    }
    if (message.interfaceName === StatusNotifierWatcherFixture.INTROSPECTABLE && message.member === "Introspect") {
      this.reply(message, "s", new BusWriter().text(StatusNotifierWatcherFixture.INTROSPECTION).toBuffer());
      return;
    }
    this.send(StatusNotifierWatcherFixture.ERROR, StatusNotifierWatcherFixture.NO_REPLY_EXPECTED, [
      { code: 4, signature: "s", value: StatusNotifierWatcherFixture.UNKNOWN_METHOD },
      { code: 5, signature: "u", value: message.serial },
      { code: 6, signature: "s", value: message.sender }
    ], "s", new BusWriter().text(`${message.interfaceName}.${message.member} is not known to the fixture watcher.`).toBuffer());
  }
}
