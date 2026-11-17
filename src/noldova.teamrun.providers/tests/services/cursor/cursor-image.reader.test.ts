/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { execFileSync } from "node:child_process";
import { mkdirSync, statSync, symlinkSync, truncateSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { JsonReader, type JsonValue } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { CursorImageReader, Resources, SavedImageFile } from "@noldova/teamrun.providers";

import { TemporaryDirectory } from "../../fixtures/temporary-directory.fixture.js";

@TestClass
export class CursorImageReaderTests {
  private static readonly PNG: Buffer = Buffer.from("89504e470d0a1a0a", "hex");

  @TestMethod
  public readsTheImageItsNotificationNamesInTheChatsFolderOrTheTempFolder(): void {
    using directory = new TemporaryDirectory();
    const chat = CursorImageReaderTests.folder(directory.resolve("chat", "assets"));
    const temp = CursorImageReaderTests.folder(directory.resolve("temp"));
    writeFileSync(join(chat, "icon.png"), CursorImageReaderTests.PNG);
    writeFileSync(join(temp, "icon.jpg"), Buffer.from([0xff, 0xd8, 0xff, 0xe0]));
    const reader = new CursorImageReader([temp]);

    const inChat = reader.read(CursorImageReaderTests.notification(join(chat, "icon.png")), "s-1", null, directory.resolve("chat"));
    const inTemp = reader.read(CursorImageReaderTests.notification(join(temp, "icon.jpg")), "s-1", null, directory.resolve("chat"));

    Assert.areEqual(JSON.stringify([join(chat, "icon.png"), "image/png", "iVBORw0KGgo="]), JSON.stringify([inChat?.path, inChat?.mediaType, inChat?.data]));
    Assert.areEqual(JSON.stringify([join(temp, "icon.jpg"), "image/jpeg", "/9j/4A=="]), JSON.stringify([inTemp?.path, inTemp?.mediaType, inTemp?.data]));
  }

  @TestMethod
  public readsNothingWhenTheNotificationNamesNoAbsolutePath(): void {
    using directory = new TemporaryDirectory();
    const chat = CursorImageReaderTests.folder(directory.resolve("chat"));
    writeFileSync(join(chat, "icon.png"), CursorImageReaderTests.PNG);
    const reader = new CursorImageReader([CursorImageReaderTests.folder(directory.resolve("temp"))]);
    const read = (params: Record<string, JsonValue>): unknown =>
      reader.read(JsonReader.fromValue({ sessionId: "s-1", toolCallId: "g1", description: "A flat icon", ...params }), "s-1", null, chat);

    Assert.isNotNull(read({ filePath: join(chat, "icon.png") }));
    Assert.isNull(read({}));
    Assert.isNull(read({ filePath: null }));
    Assert.isNull(read({ filePath: 7 }));
    Assert.isNull(read({ filePath: [join(chat, "icon.png")] }));
    Assert.isNull(read({ filePath: "icon.png" }));
    Assert.isNull(read({ path: join(chat, "icon.png") }));
    Assert.isNull(read({ rawOutput: { filePath: join(chat, "icon.png") } }));
  }

  @TestMethod
  public refusesAFileOutsideTheChatsFolderAndTheTempFolderEvenThroughDotsOrALink(): void {
    using directory = new TemporaryDirectory();
    const chat = CursorImageReaderTests.folder(directory.resolve("chat"));
    const temp = CursorImageReaderTests.folder(directory.resolve("temp"));
    const outside = CursorImageReaderTests.folder(directory.resolve("outside"));
    for (const folder of [chat, temp, outside])
      writeFileSync(join(folder, "icon.png"), CursorImageReaderTests.PNG);
    symlinkSync(outside, join(chat, "linked"), "junction");
    symlinkSync(chat, join(outside, "into-chat"), "junction");
    const read = (path: string, reader: CursorImageReader = new CursorImageReader([temp])): unknown =>
      reader.read(CursorImageReaderTests.notification(path), "s-1", null, chat);

    Assert.isNotNull(read(join(chat, "icon.png")));
    Assert.isNotNull(read(join(temp, "icon.png")));
    Assert.isNull(read(join(outside, "icon.png")));
    Assert.isNull(read(join(chat, "linked", "icon.png")));
    Assert.isNull(read(join(outside, "into-chat", "icon.png")));
    Assert.isNull(read("\\\\server.invalid\\share\\icon.png"));
    Assert.isNull(read("//server.invalid/share/icon.png"));
    Assert.isNull(read(`${chat}/../outside/icon.png`));
    Assert.isNull(read(`${chat}/../chat/icon.png`));
    Assert.isNull(read(`${chat}/./icon.png`));
    Assert.isNull(read(join(chat, "missing.png")));
    Assert.isNull(read(join(temp, "icon.png"), new CursorImageReader([directory.resolve("missing")])));
    Assert.isNull(new CursorImageReader([temp]).read(CursorImageReaderTests.notification(join(chat, "icon.png")), "s-1", null, directory.resolve("missing")));
  }

  @TestMethod
  public refusesAFileThatIsNotAnImageWithinTheSizeLimit(): void {
    using directory = new TemporaryDirectory();
    const chat = CursorImageReaderTests.folder(directory.resolve("chat"));
    const write = (name: string, bytes: Buffer): string => {
      writeFileSync(join(chat, name), bytes);
      return join(chat, name);
    };
    const reader = new CursorImageReader([CursorImageReaderTests.folder(directory.resolve("temp"))]);
    const read = (path: string): unknown => reader.read(CursorImageReaderTests.notification(path), "s-1", null, chat);
    const largest = write("largest.png", CursorImageReaderTests.PNG);
    truncateSync(largest, Resources.maximumImageBytes);
    const larger = write("larger.png", CursorImageReaderTests.PNG);
    truncateSync(larger, Resources.maximumImageBytes + 1);
    mkdirSync(join(chat, "folder.png"));

    Assert.isNotNull(read(largest));
    Assert.isNull(read(larger));
    Assert.isNull(read(write("notes.png", Buffer.from("not an image"))));
    Assert.isNull(read(write("icon.svg", Buffer.from("<svg xmlns=\"http://www.w3.org/2000/svg\"/>"))));
    Assert.isNull(read(write("empty.png", Buffer.alloc(0))));
    Assert.isNull(read(join(chat, "folder.png")));
  }

  @TestMethod
  public readsFromTheSystemsTempFolderByDefault(): void {
    using directory = new TemporaryDirectory();
    const chat = CursorImageReaderTests.folder(directory.resolve("chat"));
    const temp = CursorImageReaderTests.folder(directory.resolve("temp"));
    writeFileSync(join(temp, "icon.png"), CursorImageReaderTests.PNG);

    Assert.isNotNull(new CursorImageReader().read(CursorImageReaderTests.notification(join(temp, "icon.png")), "s-1", null, chat));
    Assert.isNull(new CursorImageReader([]).read(CursorImageReaderTests.notification(join(temp, "icon.png")), "s-1", null, chat));
  }

  @TestMethod
  public takesTheSystemsTempFolderEverywhereAndSlashTmpTooOnLinuxAndMacOS(): void {
    Assert.areEqual(JSON.stringify([tmpdir()]), JSON.stringify(CursorImageReader.temporaryDirectoriesOf("win32")));
    Assert.areEqual(JSON.stringify([tmpdir(), "/tmp"]), JSON.stringify(CursorImageReader.temporaryDirectoriesOf("linux")));
    Assert.areEqual(JSON.stringify([tmpdir(), "/tmp"]), JSON.stringify(CursorImageReader.temporaryDirectoriesOf("darwin")));
  }

  @TestMethod
  public neverResolvesAPathThatIsNotInsideAnAllowedFolderAsWritten(): void {
    using directory = new TemporaryDirectory();
    const chat = CursorImageReaderTests.folder(directory.resolve("chat"));
    const temp = CursorImageReaderTests.folder(directory.resolve("temp"));
    const outside = CursorImageReaderTests.folder(directory.resolve("outside"));
    writeFileSync(join(chat, "icon.png"), CursorImageReaderTests.PNG);
    symlinkSync(chat, join(outside, "into-chat"), "junction");
    const resolved: string[] = [];
    const reader = new CursorImageReader([temp], null, t => {
      resolved.push(t);
      return SavedImageFile.realPathOf(t);
    });
    const unresolved = ["\\\\server.invalid\\share\\icon.png","//server.invalid/share/icon.png", join(outside, "icon.png"), join(outside, "into-chat", "icon.png")];

    const refused = unresolved.map(t => reader.read(CursorImageReaderTests.notification(t), "s-1", null, chat));
    const read = reader.read(CursorImageReaderTests.notification(join(chat, "icon.png")), "s-1", null, chat);

    Assert.isTrue(refused.every(t => t === null));
    Assert.isNotNull(read);
    Assert.areEqual(String.empty, resolved.filter(t => unresolved.includes(t)).join(","));
    Assert.isTrue(resolved.includes(join(chat, "icon.png")), resolved.join(","));
  }

  @TestMethod
  public readsAFileInATempFolderOnlyWhenItBelongsToTheUserButAnyInTheChatsFolder(): void {
    using directory = new TemporaryDirectory();
    const chat = CursorImageReaderTests.folder(directory.resolve("chat"));
    const temp = CursorImageReaderTests.folder(directory.resolve("temp"));
    writeFileSync(join(chat, "icon.png"), CursorImageReaderTests.PNG);
    writeFileSync(join(temp, "icon.png"), CursorImageReaderTests.PNG);
    const owner = statSync(join(temp, "icon.png")).uid;
    const read = (path: string, userId: number | null): unknown =>
      new CursorImageReader([temp], userId).read(CursorImageReaderTests.notification(path), "s-1", null, chat);

    Assert.isNotNull(read(join(temp, "icon.png"), owner));
    Assert.isNotNull(read(join(temp, "icon.png"), null));
    Assert.isNull(read(join(temp, "icon.png"), owner + 1));
    Assert.isNotNull(read(join(chat, "icon.png"), owner + 1));
  }

  @TestMethod
  public takesTheProcesssUserIdOrNoneWhereItHasNone(): void {
    Assert.isNull(CursorImageReader.userIdOf({}));
    Assert.areEqual(501, CursorImageReader.userIdOf({ getuid: () => 501 }));
  }

  @TestMethod
  public refusesAPipeNamedAsTheImageWithoutWaitingOnIt(): void {
    if (process.platform === "win32")
      return;
    using directory = new TemporaryDirectory();
    const chat = CursorImageReaderTests.folder(directory.resolve("chat"));
    execFileSync("mkfifo", [join(chat, "icon.png")]);
    const reader = new CursorImageReader([CursorImageReaderTests.folder(directory.resolve("temp"))]);

    Assert.isNull(reader.read(CursorImageReaderTests.notification(join(chat, "icon.png")), "s-1", null, chat));
  }

  @TestMethod
  public readsNoFailureSinceCursorsNotificationCarriesNone(): void {
    const reader = new CursorImageReader();

    Assert.isNull(reader.failureOf(JsonReader.fromValue({ toolCallId: "g1", status: "failed", rawOutput: { error: "failed", message: "no image" } })));
    Assert.isNull(reader.failureOf(CursorImageReaderTests.notification("/work/icon.png")));
  }

  private static folder(path: string): string {
    mkdirSync(path, { recursive: true });
    return path;
  }

  private static notification(filePath: string): JsonReader {
    return JsonReader.fromValue({ sessionId: "s-1", toolCallId: "g1", description: "A flat icon", filePath });
  }
}
