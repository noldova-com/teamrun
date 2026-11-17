/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { execFileSync } from "node:child_process";
import fs, {
  appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, renameSync, rmSync, statSync, symlinkSync, truncateSync, utimesSync, writeFileSync
} from "node:fs";
import { open, stat } from "node:fs/promises";
import { syncBuiltinESMExports } from "node:module";
import { basename, dirname, join, sep } from "node:path";

import { ServiceException } from "@noldova/teamrun.services";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { AttachmentStore, Resources } from "@noldova/teamrun.core";
import { AttachmentInput, ErrorCode, MessageAttachment, Resources as ProtocolResources } from "@noldova/teamrun.protocol";

import { ChangingFile } from "../../fixtures/changing-file.fixture.js";
import { TemporaryDataDirectory } from "../../fixtures/temporary-data-directory.fixture.js";

@TestClass
export class AttachmentStoreTests {
  @TestMethod
  public copiesBytesAndSavedReferencesWithoutUsingOriginalNamesAsPaths(): void {
    using directory = new TemporaryDataDirectory();
    const store = new AttachmentStore(directory.path);
    Assert.areEqual(0, store.save([]).length);
    Assert.isFalse(existsSync(join(directory.path, "attachments")));
    const saved = store.save([
      new AttachmentInput("../../escape.txt", "text/plain", Buffer.from("hello").toString("base64"), null),
      new AttachmentInput("picture", "image/png", "AA==", null),
      new AttachmentInput("no.extension-too-long-for-storage", "application/octet-stream", "", null)
    ]);
    Assert.areEqual("hello", readFileSync(saved[0]!.path, "utf8"));
    Assert.isTrue(saved[0]!.path.startsWith(join(directory.path, "attachments")));
    Assert.isTrue(saved[1]!.path.endsWith(".png"));
    Assert.isFalse(saved[2]!.path.endsWith("storage"));
    const repeated = store.save([new AttachmentInput(saved[0]!.name, saved[0]!.mediaType, null, saved[0]!.path)]);
    Assert.areNotEqual(saved[0]!.path, repeated[0]!.path);
    Assert.areEqual("hello", readFileSync(repeated[0]!.path, "utf8"));
    Assert.areEqual("plain", AttachmentStore.formatPrompt("plain", []));
    Assert.isTrue(AttachmentStore.formatPrompt("", saved).includes(JSON.stringify(saved[0]!.path)));
    store.discard(saved);
    store.discard(repeated);
    Assert.areEqual(0, readdirSync(join(directory.path, "attachments")).length);
  }

  @TestMethod
  public enforcesLimitsAndRollsBackPartialSaves(): void {
    using directory = new TemporaryDataDirectory();
    const store = new AttachmentStore(directory.path);
    const small = new AttachmentInput("a.txt", "text/plain", "YQ==", null);
    Assert.throws(() => store.save(Array.from({ length: 11 }, () => small)), ServiceException);
    Assert.throws(() => store.save([small, new AttachmentInput("bad", "text/plain", "not base64", null)]), ServiceException);
    Assert.areEqual(0, readdirSync(join(directory.path, "attachments")).length);
    Assert.throws(() => store.save([new AttachmentInput("big", "text/plain", "A".repeat(4 * Math.ceil(100 * 1024 * 1024 / 3) + 1), null)]), ServiceException);
    const large = Buffer.alloc(10 * 1024 * 1024 + 1).toString("base64");
    Assert.throws(() => store.save([new AttachmentInput("big.png", "image/png", large, null)]), ServiceException);
    const part = new AttachmentInput("part", "text/plain", Buffer.alloc(51 * 1024 * 1024).toString("base64"), null);
    const combined = store.save([part, part]);
    Assert.areEqual(2, combined.length);
    store.discard(combined);
    Assert.areEqual(0, readdirSync(join(directory.path, "attachments")).length);
  }

  @TestMethod
  public keepsPreparationsSeparateAndCleansUpInterruptedAndFailedWrites(): void {
    using directory = new TemporaryDataDirectory();
    const store = new AttachmentStore(directory.path);
    const input = new AttachmentInput("a.txt", "text/plain", "YQ==", null);
    const prepared = store.prepare(input);
    const saved = store.save([new AttachmentInput(prepared.name, prepared.mediaType, null, prepared.path)]);
    store.discardPrepared(prepared);
    Assert.isFalse(existsSync(prepared.path));
    Assert.isTrue(existsSync(saved[0]!.path));
    Assert.throws(() => store.discardPrepared(saved[0]!), ServiceException);
    const abandoned = store.prepare(input);
    new AttachmentStore(directory.path);
    Assert.isFalse(existsSync(abandoned.path));
    Assert.isTrue(existsSync(saved[0]!.path));
    const original = fs.writeFileSync;
    fs.writeFileSync = () => { throw new Error("Simulated disk write failure"); };
    syncBuiltinESMExports();
    try {
      Assert.throws(() => store.prepare(input), Error);
    }
    finally {
      fs.writeFileSync = original;
      syncBuiltinESMExports();
    }
    Assert.areEqual(0, readdirSync(join(directory.path, "attachments", "drafts")).length);
  }

  @TestMethod
  public keepsDraftFilesInTheirConversationsFolderOnly(): void {
    using directory = new TemporaryDataDirectory();
    const store = new AttachmentStore(directory.path);
    const small = new AttachmentInput("a.txt", "text/plain", "YQ==", null);

    Assert.throws(() => store.saveDraft("c", Array.from({ length: 11 }, () => small)), ServiceException);
    for (const conversationId of ["..", ".", "", "a/b"]) {
      Assert.throws(() => store.saveDraft(conversationId, [small]), ServiceException);
      Assert.throws(() => store.removeDraftFiles(conversationId), ServiceException);
    }
    store.removeDraftFiles("c");
    const [saved] = store.saveDraft("c", [small]);
    Assert.isTrue(store.exists(saved!));
    store.removeDraftFiles("c");
    Assert.isFalse(store.exists(saved!));
    Assert.isFalse(existsSync(join(directory.path, "attachments", "draft-files", "c")));
  }

  @TestMethod
  public keepsAWaitingMessagesFilesInItsOwnFolderAndRemovesThemWithoutFollowingALink(): void {
    using directory = new TemporaryDataDirectory();
    using outside = new TemporaryDataDirectory();
    const store = new AttachmentStore(directory.path);
    const small = new AttachmentInput("a.txt", "text/plain", "YQ==", null);
    const chat = join(directory.path, "attachments", "waiting-files", "c");

    for (const name of ["..", ".", "", "a/b"]) {
      Assert.throws(() => store.saveWaiting(name, "w", [small]), ServiceException);
      Assert.throws(() => store.saveWaiting("c", name, [small]), ServiceException);
      Assert.throws(() => store.removeWaitingFiles(name), ServiceException);
    }
    const first = store.saveWaiting("c", "w1", [small]).map(t => t.path).join();
    const saved = store.saveWaiting("c", "w1", [new AttachmentInput("b.txt", "text/plain", null, first), small]);
    store.removeWaitingFiles("c", "w1", saved.slice(0, 1));
    Assert.areEqual(`${first}|true,false`, [saved[0]?.path, saved.map(t => store.exists(t)).join()].join("|"));
    store.saveWaiting("c", "w2", [small]);
    store.removeWaitingFiles("c", "w2");
    Assert.areEqual("w1|c,w1", [readdirSync(chat).join(), store.listWaitingFolders().flat().join()].join("|"));
    store.removeWaitingFiles("c");
    Assert.isFalse(existsSync(chat));

    Assert.areEqual(0, store.listWaitingFolders().length);
    writeFileSync(join(outside.path, "keep.txt"), "a");
    mkdirSync(join(outside.path, "w9"));
    mkdirSync(dirname(chat), { recursive: true });
    symlinkSync(outside.path, chat, "junction");
    Assert.areEqual(0, store.listWaitingFolders().length);
    store.removeWaitingFiles("c");
    Assert.areEqual("true|false", [existsSync(join(outside.path, "keep.txt")), existsSync(chat)].join("|"));
  }

  @TestMethod
  public acceptsTheExactImageAndFileLimits(): void {
    using directory = new TemporaryDataDirectory();
    const store = new AttachmentStore(directory.path);
    const root = join(directory.path, "attachments");
    mkdirSync(root);
    const path = join(root, "boundary.bin");
    writeFileSync(path, "");
    truncateSync(path, 100 * 1024 * 1024);
    const file = store.save([new AttachmentInput("boundary.bin", "application/octet-stream", null, path)]);
    Assert.areEqual(100 * 1024 * 1024, file[0]!.size);
    store.discard(file);
    truncateSync(path, 10 * 1024 * 1024);
    const image = store.save([new AttachmentInput("boundary.png", "image/png", null, path)]);
    Assert.areEqual(10 * 1024 * 1024, image[0]!.size);
    store.discard(image);
  }

  @TestMethod
  public recordsAnImagesPixelSizeFromItsHeaderAndKeepsItWithAKeptDraftFile(): void {
    using directory = new TemporaryDataDirectory();
    const store = new AttachmentStore(directory.path);
    const png = Buffer.concat([Buffer.from("89504e470d0a1a0a0000000d", "hex"), Buffer.from("IHDR", "latin1"), Buffer.from("00000280000001e0", "hex"),
      Buffer.alloc(5)]).toString("base64");

    const [image, text, unreadable] = store.save([new AttachmentInput("a.png", "image/png", png, null),
      new AttachmentInput("a.txt", "text/plain", png, null), new AttachmentInput("b.png", "image/png", "AAEC", null)]);
    const prepared = store.prepare(new AttachmentInput("c.png", "image/png", png, null));
    const [drafted] = store.saveDraft("c", [new AttachmentInput("d.png", "image/png", png, null)]);
    const [kept] = store.saveDraft("c", [new AttachmentInput(drafted!.name, drafted!.mediaType, null, drafted!.path)]);

    for (const attachment of [image!, prepared, drafted!, kept!])
      Assert.areEqual("640x480", `${attachment.width}x${attachment.height}`);
    Assert.areEqual(drafted!.path, kept!.path);
    for (const attachment of [text!, unreadable!]) {
      Assert.isNull(attachment.width);
      Assert.isNull(attachment.height);
    }
  }

  @TestMethod
  public loadsASavedFileOnlyWhileItIsStillTheFileThatWasSaved(): void {
    using directory = new TemporaryDataDirectory();
    const store = new AttachmentStore(directory.path);
    const outside = join(directory.path, "outside.txt");
    writeFileSync(outside, "private");
    Assert.areEqual(ErrorCode.NotFound, AttachmentStoreTests.refusal(() => store.load(new MessageAttachment("outside", "text/plain", 7, outside))));
    const [saved, removed] = store.save([new AttachmentInput("notes.txt", "text/plain", Buffer.from("hello").toString("base64"), null),
      new AttachmentInput("gone.txt", "text/plain", "YQ==", null)]);
    const root = join(directory.path, "attachments");

    Assert.areEqual("hello", store.load(saved!).toString("utf8"));
    Assert.areEqual(0, store.load(store.save([new AttachmentInput("empty.txt", "text/plain", "", null)])[0]!).length);
    rmSync(removed!.path);
    for (const attachment of [removed!, new MessageAttachment("relative", "text/plain", 1, "package.json"),
      new MessageAttachment("outside", "text/plain", 7, outside), new MessageAttachment("folder", "text/plain", 0, root),
      new MessageAttachment(saved!.name, saved!.mediaType, 4, saved!.path)])
      Assert.areEqual(ErrorCode.NotFound, AttachmentStoreTests.refusal(() => store.load(attachment)));
    appendFileSync(saved!.path, "!");
    Assert.areEqual(ErrorCode.NotFound, AttachmentStoreTests.refusal(() => store.load(saved!)));
    Assert.areEqual("private", readFileSync(outside, "utf8"));
  }

  @TestMethod
  public locatesASavedFileByItsRealPathPastTheReadLimitOnlyWhileItIsStillTheFileThatWasSaved(): void {
    using directory = new TemporaryDataDirectory();
    const store = new AttachmentStore(directory.path);
    const outside = join(directory.path, "outside.txt");
    writeFileSync(outside, "private");
    const [saved, removed] = store.save([new AttachmentInput("notes.txt", "text/plain", Buffer.from("hello").toString("base64"), null),
      new AttachmentInput("gone.txt", "text/plain", "YQ==", null)]);
    const root = join(directory.path, "attachments");
    const large = join(root, "large.bin");
    writeFileSync(large, "");
    truncateSync(large, ProtocolResources.maximumAttachmentReadBytes + 1);

    Assert.areEqual(JSON.stringify({ ...saved!.toJson(), path: realpathSync(saved!.path) }), JSON.stringify(store.locateSaved(saved!).toJson()));
    Assert.areEqual(realpathSync(large),
      store.locateSaved(new MessageAttachment("large.bin", "application/octet-stream", ProtocolResources.maximumAttachmentReadBytes + 1, large)).path);
    rmSync(removed!.path);
    for (const attachment of [removed!, new MessageAttachment("relative", "text/plain", 1, "package.json"),
      new MessageAttachment("outside", "text/plain", 7, outside), new MessageAttachment("folder", "text/plain", 0, root),
      new MessageAttachment(saved!.name, saved!.mediaType, 4, saved!.path)])
      Assert.areEqual(ErrorCode.NotFound, AttachmentStoreTests.refusal(() => store.locateSaved(attachment)));
    const stepped = [dirname(saved!.path), "..", basename(dirname(saved!.path)), basename(saved!.path)].join(sep);
    const refused = Assert.throws(() => store.locateSaved(new MessageAttachment(saved!.name, saved!.mediaType, saved!.size, stepped)), ServiceException);
    Assert.areEqual(JSON.stringify([ErrorCode.NotFound, Resources.attachmentLinkRefused]), JSON.stringify([refused.info.name, refused.message]));
    appendFileSync(saved!.path, "!");
    Assert.areEqual(ErrorCode.NotFound, AttachmentStoreTests.refusal(() => store.locateSaved(saved!)));
  }

  @TestMethod
  public loadsUpToTheReadLimitAndRefusesALargerFileOrNameAsTooLargeBeforeOpeningIt(): void {
    using directory = new TemporaryDataDirectory();
    const store = new AttachmentStore(directory.path);
    const root = join(directory.path, "attachments");
    mkdirSync(root);
    const path = join(root, "boundary.bin");
    writeFileSync(path, "");
    truncateSync(path, ProtocolResources.maximumAttachmentReadBytes);

    Assert.areEqual(ProtocolResources.maximumAttachmentReadBytes,
      store.load(new MessageAttachment("boundary.bin", "application/octet-stream", ProtocolResources.maximumAttachmentReadBytes, path)).length);
    Assert.isTrue(4 * Math.ceil(ProtocolResources.maximumAttachmentReadBytes / 3) + 64 * 1024 <= 16 * 1024 * 1024);
    Assert.areEqual(ErrorCode.TooLarge, AttachmentStoreTests.refusal(() =>
      store.load(new MessageAttachment("large.bin", "application/octet-stream", ProtocolResources.maximumAttachmentReadBytes + 1, join(root, "absent.bin")))));

    const longest = 16 * 1024 * 1024 - 4 * 1024 - 4 * Math.ceil(ProtocolResources.maximumAttachmentReadBytes / 3)
      - JSON.stringify("application/octet-stream").length - 2;
    Assert.areEqual(ProtocolResources.maximumAttachmentReadBytes,
      store.load(new MessageAttachment("n".repeat(longest), "application/octet-stream", ProtocolResources.maximumAttachmentReadBytes, path)).length);
    for (const name of ["n".repeat(longest + 1), String.fromCharCode(1).repeat(Math.ceil((longest + 1) / 6))])
      Assert.areEqual(ErrorCode.TooLarge, AttachmentStoreTests.refusal(() =>
        store.load(new MessageAttachment(name, "application/octet-stream", ProtocolResources.maximumAttachmentReadBytes, join(root, "absent.bin")))));
  }

  @TestMethod
  public refusesAFileThatGoesOrChangesBetweenTheChecksAsNotFoundWithoutWaiting(): void {
    using directory = new TemporaryDataDirectory();
    const store = new AttachmentStore(directory.path);
    const [saved] = store.save([new AttachmentInput("a.txt", "text/plain", Buffer.from("hello").toString("base64"), null)]);
    const path = saved!.path;
    const opens = (first: unknown): boolean => basename(String(first)) === basename(path);
    const cases: [name: "openSync" | "readSync" | "realpathSync", change: (first: unknown) => void][] = [
      ["realpathSync", first => {
        if (first === path)
          throw new Error("Simulated lost permission");
      }],
      ["openSync", first => {
        if (opens(first))
          rmSync(path);
      }],
      ["readSync", () => {
        throw new Error("Simulated read failure");
      }],
    ];
    if (process.platform !== "win32")
      cases.push(["openSync", first => {
        if (!opens(first))
          return;
        rmSync(path);
        execFileSync("mkfifo", [path]);
      }]);

    for (const [name, change] of cases) {
      rmSync(path, { force: true });
      writeFileSync(path, "hello");
      Assert.areEqual(ErrorCode.NotFound, AttachmentStoreTests.refusalWhile(name, change, () => store.load(saved!)).info.name, name);
    }
    rmSync(path, { force: true });
    writeFileSync(path, "hello");
    Assert.areEqual("hello", store.load(saved!).toString());
  }

  @TestMethod
  public findsAFileReachedThroughALocalLinkFromTheAttachmentsFolderDown(): void {
    using directory = new TemporaryDataDirectory();
    using outside = new TemporaryDataDirectory();
    const store = new AttachmentStore(directory.path);
    const small = new AttachmentInput("a.txt", "text/plain", "YQ==", null);
    const [kept, linked, gone] = store.save([small, small, small]);
    const [draft] = store.saveDraft("c", [small]);
    if (Object.isUndefined(kept) || Object.isUndefined(linked) || Object.isUndefined(gone) || Object.isUndefined(draft))
      throw new Error("The store saved fewer files than it was given.");
    const target = join(outside.path, "target.txt");
    writeFileSync(target, "a");
    if (process.platform !== "win32") {
      rmSync(linked.path);
      symlinkSync(target, linked.path, "file");
    }
    rmSync(gone.path);
    const drafts = dirname(draft.path);
    renameSync(drafts, join(outside.path, "drafts"));
    symlinkSync(join(outside.path, "drafts"), drafts, "junction");

    Assert.areEqual(JSON.stringify([true, true, false, true, false]), JSON.stringify([kept, linked, gone, draft,
      new MessageAttachment("a.txt", "text/plain", 1, join(directory.path, "attachments"))].map(t => store.exists(t))));
    rmSync(drafts);
    Assert.isFalse(store.exists(draft));
  }

  @TestMethod
  public refusesReferencesOutsideTheStoreAndOversizedSavedFiles(): void {
    using directory = new TemporaryDataDirectory();
    const store = new AttachmentStore(directory.path);
    const root = join(directory.path, "attachments");
    mkdirSync(root);
    const outside = join(directory.path, "outside.txt");
    writeFileSync(outside, "private");
    Assert.throws(() => store.save([new AttachmentInput("outside", "text/plain", null, outside)]), ServiceException);
    Assert.throws(() => store.save([new AttachmentInput("directory", "text/plain", null, root)]), ServiceException);
    const large = join(root, "large.txt");
    writeFileSync(large, "");
    truncateSync(large, 100 * 1024 * 1024 + 1);
    Assert.throws(() => store.save([new AttachmentInput("large", "text/plain", null, large)]), ServiceException);
    Assert.throws(() => store.save([new AttachmentInput("relative", "text/plain", null, "package.json")]), ServiceException);
    symlinkSync(directory.path, join(root, "up"), "junction");
    Assert.areEqual(Resources.attachmentOutsideStore,
      Assert.throws(() => store.save([new AttachmentInput("up", "text/plain", null, join(root, "up", "outside.txt"))]), ServiceException).message);
    Assert.areEqual("private", readFileSync(outside, "utf8"));
  }

  @TestMethod
  public refusesASavedFileDraftOrDraftFolderThatIsALinkToAShareOrADeviceBeforeAnyStatOrRealpath(): void {
    if (process.platform !== "win32")
      return;
    using directory = new TemporaryDataDirectory();
    const store = new AttachmentStore(directory.path);
    const [saved] = store.save([new AttachmentInput("a.txt", "text/plain", "YQ==", null)]);
    const [drafted] = store.saveDraft("c", [new AttachmentInput("d.txt", "text/plain", "YQ==", null)]);
    const prepared = store.prepare(new AttachmentInput("p.txt", "text/plain", "YQ==", null));
    const share = ["", "", "noldova.invalid", "share"].join(sep);
    const device = ["", "", ".", "NUL"].join(sep);

    const results = [
      ...[join(share, "a.txt"), device].flatMap(t => [saved!, drafted!].map(u => AttachmentStoreTests.refusalsThrough(store, u, u.path, t))),
      AttachmentStoreTests.refusalsThrough(store, drafted!, dirname(drafted!.path), share),
      AttachmentStoreTests.draftFolderRefusalsThrough(store, drafted!, share),
      AttachmentStoreTests.preparedFolderRefusalsThrough(store, prepared, share)
    ];

    Assert.areEqual(JSON.stringify([...Array.from({ length: 5 }, () => AttachmentStoreTests.fileRefusals()), AttachmentStoreTests.draftFolderRefusals(),
      AttachmentStoreTests.preparedFolderRefusals()]), JSON.stringify(results));
    Assert.isTrue(store.exists(drafted!));
    Assert.isTrue(existsSync(prepared.path));
    Assert.areEqual(JSON.stringify(["c"]), JSON.stringify(store.listDraftFolders()));
  }

  @TestMethod
  public refusesAFileOrDraftFolderReachedThroughALinkItCannotRead(): void {
    using directory = new TemporaryDataDirectory();
    const store = new AttachmentStore(directory.path);
    const [saved] = store.save([new AttachmentInput("a.txt", "text/plain", "YQ==", null)]);
    const [drafted] = store.saveDraft("c", [new AttachmentInput("d.txt", "text/plain", "YQ==", null)]);
    const prepared = store.prepare(new AttachmentInput("p.txt", "text/plain", "YQ==", null));
    const unreadable = Object.assign(new Error("EACCES: permission denied"), { code: "EACCES" });

    const results = [
      AttachmentStoreTests.refusalsThrough(store, saved!, saved!.path, unreadable),
      AttachmentStoreTests.refusalsThrough(store, drafted!, dirname(drafted!.path), unreadable),
      AttachmentStoreTests.draftFolderRefusalsThrough(store, drafted!, unreadable),
      AttachmentStoreTests.preparedFolderRefusalsThrough(store, prepared, unreadable)
    ];

    Assert.areEqual(JSON.stringify([AttachmentStoreTests.fileRefusals(), AttachmentStoreTests.fileRefusals(), AttachmentStoreTests.draftFolderRefusals(),
      AttachmentStoreTests.preparedFolderRefusals()]), JSON.stringify(results));
    Assert.isTrue(store.exists(saved!));
    Assert.isTrue(store.exists(drafted!));
    Assert.isTrue(existsSync(prepared.path));
  }

  @TestMethod
  public followsALocalLinkInsideTheStoreAndRefusesALinkLoopThroughAFolderOutsideIt(): void {
    using directory = new TemporaryDataDirectory();
    const store = new AttachmentStore(directory.path);
    const [saved] = store.save([new AttachmentInput("a.txt", "text/plain", Buffer.from("hello").toString("base64"), null)]);
    const root = join(directory.path, "attachments");
    const outside = join(directory.path, "outside");
    mkdirSync(outside);
    symlinkSync(root, join(root, "local"), "junction");
    symlinkSync(join(outside, "back"), join(root, "loop"), "junction");
    symlinkSync(join(root, "loop"), join(outside, "back"), "junction");
    const local = new MessageAttachment(saved!.name, saved!.mediaType, saved!.size, join(root, "local", basename(saved!.path)));
    const looped = new MessageAttachment(saved!.name, saved!.mediaType, saved!.size, join(root, "loop", basename(saved!.path)));
    const stepped = new MessageAttachment(saved!.name, saved!.mediaType, saved!.size, [root, "loop", "..", ".", basename(saved!.path)].join(sep));

    Assert.isTrue(store.exists(local));
    Assert.areEqual("hello", store.load(local).toString("utf8"));
    Assert.isFalse(store.exists(looped));
    const loaded = Assert.throws(() => store.load(looped), ServiceException);
    const kept = Assert.throws(() => store.saveDraft("c", [new AttachmentInput(looped.name, looped.mediaType, null, looped.path)]), ServiceException);
    Assert.areEqual(JSON.stringify([ErrorCode.NotFound, Resources.attachmentLinkRefused, ErrorCode.InvalidParams, Resources.attachmentLinkRefused]),
      JSON.stringify([loaded.info.name, loaded.message, kept.info.name, kept.message]));
    Assert.isFalse(store.exists(stepped));
    Assert.areEqual(Resources.attachmentLinkRefused, Assert.throws(() => store.saveDraft("c", [new AttachmentInput(stepped.name, stepped.mediaType, null, stepped.path)]),
      ServiceException).message);
  }

  @TestMethod
  public async preparesAnOpenedFileByCopyingItFromItsHandle(): Promise<void> {
    using directory = new TemporaryDataDirectory();
    const store = new AttachmentStore(directory.path);
    const chosen = join(directory.path, "chosen");
    mkdirSync(chosen);
    const notes = join(chosen, "notes.txt");
    const bytes = Buffer.alloc(2 * 1024 * 1024 + 3, "abc");
    writeFileSync(notes, bytes);
    const photo = join(chosen, "photo");
    writeFileSync(photo, Buffer.concat([Buffer.from("89504e470d0a1a0a0000000d", "hex"), Buffer.from("IHDR", "latin1"), Buffer.from("00000280000001e0", "hex"),
      Buffer.alloc(5)]));
    const empty = join(chosen, "empty.log");
    writeFileSync(empty, "");

    const [copied, image, nothing] = [
      await AttachmentStoreTests.prepareOpenedAsync(store, "notes.txt", "text/plain", notes),
      await AttachmentStoreTests.prepareOpenedAsync(store, "photo", "image/png", photo),
      await AttachmentStoreTests.prepareOpenedAsync(store, "empty.log", "text/plain", empty)
    ];

    Assert.areEqual(join(directory.path, "attachments", "drafts"), dirname(copied.path));
    Assert.isTrue(copied.path.endsWith(".txt"));
    Assert.areEqual("notes.txt text/plain", `${copied.name} ${copied.mediaType}`);
    Assert.areEqual(bytes.length, copied.size);
    Assert.isTrue(bytes.equals(readFileSync(copied.path)));
    Assert.isTrue(bytes.equals(readFileSync(notes)));
    Assert.isNull(copied.width);
    Assert.isTrue(image.path.endsWith(".png"));
    Assert.areEqual("640x480", `${image.width}x${image.height}`);
    Assert.areEqual(0, nothing.size);
    Assert.areEqual(0, readFileSync(nothing.path).length);
    const [saved] = store.save([new AttachmentInput(copied.name, copied.mediaType, null, copied.path)]);
    Assert.isTrue(bytes.equals(readFileSync(saved!.path)));
  }

  @TestMethod
  public async preparesAnOpenedFileUpToItsLimitAndRefusesOneByteMoreWithoutCopying(): Promise<void> {
    using directory = new TemporaryDataDirectory();
    const store = new AttachmentStore(directory.path);
    const path = join(directory.path, "boundary.bin");
    writeFileSync(path, "");

    for (const [mediaType, limit] of [["application/octet-stream", 100 * 1024 * 1024], ["image/png", 10 * 1024 * 1024]] as const) {
      truncateSync(path, limit);
      const prepared = await AttachmentStoreTests.prepareOpenedAsync(store, "boundary.bin", mediaType, path);
      Assert.areEqual(limit, prepared.size);
      Assert.areEqual(limit, statSync(prepared.path).size);
      store.discardPrepared(prepared);
      truncateSync(path, limit + 1);
      const refused = await Assert.throwsAsync(() => AttachmentStoreTests.prepareOpenedAsync(store, "boundary.bin", mediaType, path), ServiceException);
      Assert.areEqual(ErrorCode.InvalidParams, refused.info.name);
      Assert.areEqual("Attach up to 10 files: 10 MiB per image and 100 MiB per file.", refused.message);
      Assert.areEqual(0, readdirSync(join(directory.path, "attachments", "drafts")).length);
    }
  }

  @TestMethod
  public async refusesAnOpenedFileItCantReadOrThatChangesWhileCopiedAndKeepsNoCopy(): Promise<void> {
    using directory = new TemporaryDataDirectory();
    const store = new AttachmentStore(directory.path);
    const source = join(directory.path, "notes.txt");
    const drafts = join(directory.path, "attachments", "drafts");
    const input = new AttachmentInput("notes.txt", "text/plain", null, null, "g1");
    const unreadable = "The file can't be read.";
    const changed = "The file changed while it was being attached.";
    writeFileSync(source, Buffer.alloc(Resources.attachmentCopyChunkBytes + 5, "a"));
    const folder = { stat: () => stat(directory.path), read: () => Promise.resolve({ bytesRead: 0 }) };

    Assert.areEqual(unreadable, (await Assert.throwsAsync(() => store.prepareOpenedAsync(input, folder), ServiceException)).message);
    Assert.isFalse(existsSync(drafts));
    const cases: [change: (read: number) => void, message: string][] = [
      [read => {
        if (read === 1)
          throw new Error("Simulated read failure");
      }, unreadable],
      [read => {
        if (read === 0)
          appendFileSync(source, "!");
      }, changed],
      [read => {
        if (read === 1)
          utimesSync(source, 1_000_000_001, 1_000_000_001);
      }, changed]
    ];
    for (const [change, message] of cases) {
      utimesSync(source, 1_000_000_000, 1_000_000_000);
      await using file = await ChangingFile.openAsync(source, change);
      Assert.areEqual(message, (await Assert.throwsAsync(() => store.prepareOpenedAsync(input, file), ServiceException)).message);
      Assert.areEqual(0, readdirSync(drafts).length);
    }
    await using left = await ChangingFile.openAsync(source, () => {});
    Assert.areEqual(statSync(source).size, (await store.prepareOpenedAsync(input, left)).size);
  }

  @TestMethod
  public refusesAGrantedInputItIsNotGivenTheFileOfWithoutStoringAnything(): void {
    using directory = new TemporaryDataDirectory();
    const store = new AttachmentStore(directory.path);
    const granted = new AttachmentInput("chosen.zip", "application/zip", null, null, "g1");

    for (const action of [() => store.prepare(granted), () => store.save([granted]), () => store.saveDraft("c1", [granted])]) {
      const refused = Assert.throws(action, ServiceException);
      Assert.areEqual(`${ErrorCode.InvalidParams} The file's grant is unknown, already used or expired.`, `${refused.info.name} ${refused.message}`);
    }
    Assert.isFalse(existsSync(join(directory.path, "attachments")));
  }

  private static async prepareOpenedAsync(store: AttachmentStore, name: string, mediaType: string, path: string): Promise<MessageAttachment> {
    await using file = await open(path, "r");
    return await store.prepareOpenedAsync(new AttachmentInput(name, mediaType, null, null, "g1"), file);
  }

  private static refusalsThrough(store: AttachmentStore, attachment: MessageAttachment, link: string, target: string | Error): unknown[] {
    const kept = new AttachmentInput(attachment.name, attachment.mediaType, null, attachment.path);
    const touched: unknown[] = [];
    return [
      ...AttachmentStoreTests.throughLink(link, target, touched, () => [
        store.exists(attachment),
        Assert.throws(() => store.load(attachment), ServiceException).message,
        Assert.throws(() => store.saveDraft("c", [kept]), ServiceException).message,
        Assert.throws(() => store.save([kept]), ServiceException).message,
        Assert.throws(() => store.prepare(kept), ServiceException).message
      ]),
      AttachmentStoreTests.reached(touched, link)
    ];
  }

  private static draftFolderRefusalsThrough(store: AttachmentStore, drafted: MessageAttachment, target: string | Error): unknown[] {
    const folders = dirname(dirname(drafted.path));
    const touched: unknown[] = [];
    return [
      ...AttachmentStoreTests.throughLink(folders, target, touched, () => {
        store.removeDraftFiles("c");
        store.removeDraftFiles("c", [drafted]);
        return [
          store.listDraftFolders(),
          Assert.throws(() => store.saveDraft("c", [new AttachmentInput("e.txt", "text/plain", "YQ==", null)]), ServiceException).message
        ];
      }),
      AttachmentStoreTests.reached(touched, folders)
    ];
  }

  private static preparedFolderRefusalsThrough(store: AttachmentStore, prepared: MessageAttachment, target: string | Error): unknown[] {
    const folder = dirname(prepared.path);
    const touched: unknown[] = [];
    return [
      ...AttachmentStoreTests.throughLink(folder, target, touched, () => {
        store.discardPrepared(prepared);
        return [Assert.throws(() => store.prepare(new AttachmentInput("q.txt", "text/plain", "YQ==", null)), ServiceException).message];
      }),
      AttachmentStoreTests.reached(touched, folder)
    ];
  }

  private static preparedFolderRefusals(): unknown[] {
    return [Resources.attachmentLinkRefused, []];
  }

  private static fileRefusals(): unknown[] {
    return [false, ...Array.from({ length: 4 }, () => Resources.attachmentLinkRefused), []];
  }

  private static draftFolderRefusals(): unknown[] {
    return [[], Resources.attachmentLinkRefused, []];
  }

  private static reached(touched: readonly unknown[], link: string): unknown[] {
    return touched.filter(t => typeof t === "string" && (t.startsWith(link) || t.includes("noldova.invalid") || t.endsWith("NUL")));
  }

  private static throughLink<T>(link: string, target: string | Error, touched: unknown[], action: () => T): T {
    const names = ["lstatSync", "readlinkSync", "statSync", "realpathSync", "existsSync", "openSync", "readdirSync", "mkdirSync", "rmSync"] as const;
    const originals = names.map(t => [t, fs[t]] as const);
    for (const [name, original] of originals)
      Object.assign(fs, { [name]: new Proxy(original, { apply: (callee, self, args: unknown[]): unknown => {
        if (name === "lstatSync" && args[0] === link)
          return { isSymbolicLink: (): boolean => true };
        if (name === "readlinkSync" && args[0] === link) {
          if (target instanceof Error)
            throw target;
          return target;
        }
        if (name !== "lstatSync" && name !== "readlinkSync")
          touched.push(args[0]);
        return Reflect.apply(callee, self, args);
      } }) });
    syncBuiltinESMExports();
    try {
      return action();
    }
    finally {
      for (const [name, original] of originals)
        Object.assign(fs, { [name]: original });
      syncBuiltinESMExports();
    }
  }

  private static refusal(action: () => unknown): string {
    return Assert.throws(action, ServiceException).info.name;
  }

  private static refusalWhile(name: "openSync" | "readSync" | "realpathSync", change: (first: unknown) => void, action: () => unknown): ServiceException {
    const original = fs[name];
    Object.assign(fs, { [name]: new Proxy(original, { apply: (target, self, args: unknown[]): unknown => {
      change(args[0]);
      return Reflect.apply(target, self, args);
    } }) });
    syncBuiltinESMExports();
    try {
      return Assert.throws(action, ServiceException);
    }
    finally {
      Object.assign(fs, { [name]: original });
      syncBuiltinESMExports();
    }
  }
}
