/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync, readdirSync, readFileSync, truncateSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { FailureCode } from "@noldova/desktop.protocol";
import { type IMethodHandler, MethodFailureException, RequestContext } from "@noldova/desktop.runtime";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import type { JsonValue } from "@noldova/context.json";
import { AttachmentStore } from "@noldova/teamrun.core";
import { AttachmentInput, MessageAttachment } from "@noldova/teamrun.protocol";
import { GrantedAttachmentMethod } from "@noldova/teamrun.runtime";

import { GrantedFiles } from "../fixtures/granted-files.fixture.js";
import { TemporaryDirectory } from "../fixtures/temporary-directory.fixture.js";

@TestClass
export class GrantedAttachmentMethodTests {
  @TestMethod
  public async redeemsTheGrantInItsRequestCopiesTheOpenFileIntoTheStoreAndClosesIt(): Promise<void> {
    using directory = new TemporaryDirectory();
    const chosen = join(directory.path, "report.pdf");
    writeFileSync(chosen, "report");
    const granted = new GrantedFiles();
    granted.grant("g1", chosen);
    const request = GrantedAttachmentMethodTests.request(new AttachmentInput("report.pdf", "application/pdf", null, null, "g1").toJson());

    const prepared = MessageAttachment.fromJson(await GrantedAttachmentMethodTests.method(directory.path, granted).handleAsync(request));

    Assert.areEqual("report.pdf application/pdf 6", `${prepared.name} ${prepared.mediaType} ${prepared.size}`);
    Assert.areEqual(join(directory.path, "attachments", "drafts"), dirname(prepared.path));
    Assert.areEqual("report", readFileSync(prepared.path, "utf8"));
    Assert.areEqual("g1", granted.redeemed.map(t => t[0]).join(","));
    Assert.isTrue(granted.redeemed[0]![1] === request);
    Assert.areEqual(-1, granted.opened[0]!.fd);
  }

  @TestMethod
  public async passesAnInputByItsBytesOrSavedPathAndAPayloadItCantReadToItsMethodWithoutRedeeming(): Promise<void> {
    using directory = new TemporaryDirectory();
    const granted = new GrantedFiles();
    const passed: JsonValue[] = [];
    const method: IMethodHandler = { handleAsync: (request: RequestContext): Promise<JsonValue> => {
      passed.push(request.payload);
      return Promise.resolve("passed");
    } };
    const payloads = [new AttachmentInput("a.txt", "text/plain", "YQ==", null).toJson(), new AttachmentInput("a.txt", "text/plain", null, "/data/a.txt").toJson(),
      { name: "a.txt", grant: "g1" }];

    for (const payload of payloads)
      Assert.areEqual("passed", await GrantedAttachmentMethodTests.method(directory.path, granted, method).handleAsync(GrantedAttachmentMethodTests.request(payload)));

    Assert.areEqual(JSON.stringify(payloads), JSON.stringify(passed));
    Assert.areEqual(0, granted.redeemed.length);
  }

  @TestMethod
  public async refusesAGrantDesktopCoreRefusesWithoutCopyingAnything(): Promise<void> {
    using directory = new TemporaryDirectory();
    const chosen = join(directory.path, "report.pdf");
    writeFileSync(chosen, "report");
    const granted = new GrantedFiles();
    granted.grant("g1", chosen);
    const method = GrantedAttachmentMethodTests.method(directory.path, granted);
    const input = new AttachmentInput("report.pdf", "application/pdf", null, null, "g1").toJson();
    await method.handleAsync(GrantedAttachmentMethodTests.request(input));

    for (const payload of [input, new AttachmentInput("report.pdf", "application/pdf", null, null, "made-up").toJson()]) {
      const refused = await Assert.throwsAsync(() => method.handleAsync(GrantedAttachmentMethodTests.request(payload)), MethodFailureException);
      Assert.areEqual(`${FailureCode.InvalidParams} The file's grant is unknown, already used or expired.`, `${refused.failure.code} ${refused.failure.message}`);
    }
    Assert.areEqual(1, readdirSync(join(directory.path, "attachments", "drafts")).length);
  }

  @TestMethod
  public async passesTheStoresRefusalOnAsTheDispatcherWouldAndClosesTheFileWithoutKeepingACopy(): Promise<void> {
    using directory = new TemporaryDirectory();
    const chosen = join(directory.path, "large.png");
    writeFileSync(chosen, "");
    truncateSync(chosen, 10 * 1024 * 1024 + 1);
    const granted = new GrantedFiles();
    granted.grant("g1", chosen);
    const request = GrantedAttachmentMethodTests.request(new AttachmentInput("large.png", "image/png", null, null, "g1").toJson());

    const refused = await Assert.throwsAsync(() => GrantedAttachmentMethodTests.method(directory.path, granted).handleAsync(request), MethodFailureException);

    Assert.areEqual(`${FailureCode.InvalidParams} Attach up to 10 files: 10 MiB per image and 100 MiB per file.`, `${refused.failure.code} ${refused.failure.message}`);
    Assert.areEqual(-1, granted.opened[0]!.fd);
    Assert.isFalse(existsSync(join(directory.path, "attachments", "drafts")));
  }

  private static method(folder: string, granted: GrantedFiles, method: IMethodHandler | null = null): GrantedAttachmentMethod {
    const store = new AttachmentStore(folder);
    const wrapped: IMethodHandler = method ?? { handleAsync: (): Promise<JsonValue> => Promise.reject(new Error("The test passes no inputs on.")) };
    return new GrantedAttachmentMethod(wrapped, { files: granted }, { prepareOpenedAttachmentAsync: (input, source) => store.prepareOpenedAsync(input, source) });
  }

  private static request(payload: JsonValue): RequestContext {
    return new RequestContext("window", payload, new AbortController().signal, 1);
  }
}
