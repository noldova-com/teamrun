/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { realpathSync, statSync, writeFileSync } from "node:fs";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { SavedImageFile } from "@noldova/teamrun.providers";

import { TemporaryDirectory } from "../fixtures/temporary-directory.fixture.js";

@TestClass
export class SavedImageFileTests {
  private static readonly PNG: Buffer = Buffer.from("89504e470d0a1a0a", "hex");

  @TestMethod
  public readsTheImageAtItsPathWhenThePathStillResolvesToTheTargetAndTheTargetAndItsOwnerAreAllowed(): void {
    using directory = new TemporaryDirectory();
    const path = directory.resolve("icon.png");
    writeFileSync(path, SavedImageFileTests.PNG);
    const target = realpathSync(path);
    const asked: string[] = [];

    const image = SavedImageFile.read(path, target, (realPath, owner) => {
      asked.push(`${realPath}:${owner}`);
      return true;
    });

    Assert.areEqual(JSON.stringify([path, "image/png", "iVBORw0KGgo="]), JSON.stringify([image?.path, image?.mediaType, image?.data]));
    Assert.areEqual(JSON.stringify([`${target}:${statSync(path).uid}`]), JSON.stringify(asked));
  }

  @TestMethod
  public readsNothingWhenThePathNoLongerResolvesToTheTarget(): void {
    using directory = new TemporaryDirectory();
    const path = directory.resolve("icon.png");
    const other = directory.resolve("other.png");
    writeFileSync(path, SavedImageFileTests.PNG);
    writeFileSync(other, SavedImageFileTests.PNG);

    Assert.isNull(SavedImageFile.read(path, realpathSync(other), () => true));
  }

  @TestMethod
  public readsNothingWhenTheOpenedFileIsNotAllowed(): void {
    using directory = new TemporaryDirectory();
    const path = directory.resolve("icon.png");
    writeFileSync(path, SavedImageFileTests.PNG);

    Assert.isNull(SavedImageFile.read(path, realpathSync(path), () => false));
  }
}
