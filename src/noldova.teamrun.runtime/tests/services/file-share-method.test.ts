/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Failure, FailureCode } from "@noldova/desktop.protocol";
import { type GrantedFile, type IFileShareOptions, type IMethodHandler, type IRuntimeFiles, MethodFailureException, RequestContext } from "@noldova/desktop.runtime";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import type { JsonValue } from "@noldova/context.json";
import { MessageAttachment } from "@noldova/teamrun.protocol";
import { FileShareMethod } from "@noldova/teamrun.runtime";

@TestClass
export class FileShareMethodTests {
  private static readonly grant: string = "0123456789abcdef0123456789abcdef";
  private static readonly attachment: MessageAttachment = new MessageAttachment("shot.png", "image/png", 5, "/data/attachments/drafts/c1/shot.png");

  @TestMethod
  public async sharesTheFileItsMethodFindsWithThePageThatAskedAsItsMediaTypeAndAnswersOnlyTheGrant(): Promise<void> {
    const shares: [string, RequestContext, IFileShareOptions | undefined][] = [];
    const request = FileShareMethodTests.request();

    const payload = await new FileShareMethod(FileShareMethodTests.method(), FileShareMethodTests.context(shares)).handleAsync(request);

    Assert.areEqual(JSON.stringify({ grant: FileShareMethodTests.grant }), JSON.stringify(payload));
    Assert.areEqual(JSON.stringify([[FileShareMethodTests.attachment.path, { mediaType: "image/png", lifetime: 600000 }]]), JSON.stringify(shares.map(t => [t[0], t[2]])));
    Assert.isTrue(shares[0]![1] === request);
  }

  @TestMethod
  public async passesDesktopCoresRefusalOfTheShareOnAsItIs(): Promise<void> {
    const refusal = new MethodFailureException(new Failure(FailureCode.InvalidParams, "The file is outside the module's folders."));

    const error = await new FileShareMethod(FileShareMethodTests.method(), FileShareMethodTests.context([], refusal))
      .handleAsync(FileShareMethodTests.request()).then(() => null, (t: unknown) => t);

    Assert.isTrue(error === refusal);
  }

  @TestMethod
  public async sharesNothingWhenItsMethodRefusesAndPassesTheRefusalOn(): Promise<void> {
    const shares: [string, RequestContext, IFileShareOptions | undefined][] = [];
    const refusal = new MethodFailureException(new Failure(FailureCode.NotFound, "The attachment's file is gone or changed since it was saved."));
    const method: IMethodHandler = { handleAsync: (): Promise<JsonValue> => Promise.reject(refusal) };

    const error = await new FileShareMethod(method, FileShareMethodTests.context(shares)).handleAsync(FileShareMethodTests.request())
      .then(() => null, (t: unknown) => t);

    Assert.isTrue(error === refusal);
    Assert.areEqual(0, shares.length);
  }

  private static method(): IMethodHandler {
    return { handleAsync: (): Promise<JsonValue> => Promise.resolve(FileShareMethodTests.attachment.toJson()) };
  }

  private static context(shares: [string, RequestContext, IFileShareOptions | undefined][], refusal: Error | null = null): { readonly files: IRuntimeFiles } {
    const files: IRuntimeFiles = {
      redeemAsync: (): Promise<GrantedFile> => Promise.reject(new Error("The test redeems no grants.")),
      shareAsync: (file: string, request: RequestContext, options?: IFileShareOptions): Promise<string> => {
        shares.push([file, request, options]);
        return Object.isNull(refusal) ? Promise.resolve(FileShareMethodTests.grant) : Promise.reject(refusal);
      }
    };
    return { files };
  }

  private static request(): RequestContext {
    return new RequestContext("window", { chatId: "c1", path: "/data/attachments/drafts/c1/shot.png" }, new AbortController().signal, 1);
  }
}
