/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { readdir } from "node:fs/promises";
import path from "node:path";

import "@noldova/teamrun-foundation-core";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { UpdateProcess } from "@noldova/teamrun-shell-protocol";
import { Installation, UpdateBarrier, UpdateBarrierState } from "@noldova/teamrun-shell-runtime";

import { HeldRenameFixture } from "../../fixtures/held-rename.fixture.js";
import { TemporaryFolderFixture } from "../../fixtures/temporary-folder.fixture.js";

@TestClass
export class FileRenamerTests {
  private static readonly HOLDER: UpdateProcess = new UpdateProcess(4120, 1500, 1501, "desktop");

  @TestMethod
  public async replacesTheBarrierOnceItsReadersLetGo(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const file = path.join(folder.path, "installation", "barrier.json");
    using held = new HeldRenameFixture(file, ["EPERM", "EACCES", "EBUSY"]);
    const installation = await FileRenamerTests.holdAsync(folder.path);

    await installation.replaceAsync(new UpdateBarrier(FileRenamerTests.HOLDER, "0.3.0", UpdateBarrierState.Closing, null));

    Assert.areEqual(4, held.attempts);
    Assert.areEqual(UpdateBarrierState.Closing, (await installation.readAsync())?.state);
    Assert.areEqual("barrier.json", (await readdir(installation.folder)).join(","));
  }

  @TestMethod
  public async failsWithTheReasonWhenTheBarrierStaysHeld(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const file = path.join(folder.path, "installation", "barrier.json");
    using held = new HeldRenameFixture(file, Array.from({ length: 50 }, () => "EPERM"));
    const installation = await FileRenamerTests.holdAsync(folder.path);

    const failure = await Assert.throwsAsync(() => installation.replaceAsync(new UpdateBarrier(FileRenamerTests.HOLDER, "0.3.0", UpdateBarrierState.Closing, null)), Error);

    Assert.areEqual(40, held.attempts);
    Assert.areEqual("EPERM", Reflect.get(failure, "code"));
    Assert.isTrue(failure.message.endsWith(`-> '${file}'`), failure.message);
    Assert.areEqual(UpdateBarrierState.Preparing, (await installation.readAsync())?.state);
  }

  @TestMethod
  public async failsAtOnceOnAnyOtherError(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const file = path.join(folder.path, "installation", "barrier.json");
    using held = new HeldRenameFixture(file, ["EIO"]);
    const installation = await FileRenamerTests.holdAsync(folder.path);

    const failure = await Assert.throwsAsync(() => installation.replaceAsync(new UpdateBarrier(FileRenamerTests.HOLDER, "0.3.0", UpdateBarrierState.Closing, null)), Error);

    Assert.areEqual("EIO 1", `${String(Reflect.get(failure, "code"))} ${held.attempts}`);
  }

  private static async holdAsync(folder: string): Promise<Installation> {
    const installation = new Installation(path.join(folder, "installation"), t => Promise.resolve(t.processId === FileRenamerTests.HOLDER.processId));
    Assert.isTrue(await installation.holdAsync(new UpdateBarrier(FileRenamerTests.HOLDER, "0.3.0", UpdateBarrierState.Preparing, null), "0.2.0"));
    return installation;
  }
}
