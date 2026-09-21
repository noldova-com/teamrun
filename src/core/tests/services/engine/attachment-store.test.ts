/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import fs, { existsSync, mkdirSync, readFileSync, readdirSync, truncateSync, writeFileSync } from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import { join } from "node:path";

import { ServiceException } from "@noldova/teamrun-foundation-services";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { AttachmentStore } from "@noldova/teamrun-core";
import { AttachmentInput } from "@noldova/teamrun-protocol";

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
    Assert.areEqual("private", readFileSync(outside, "utf8"));
  }
}
