/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { FileSnapshot } from "@noldova/teamrun.core";

@TestClass
export class FileSnapshotTests {
  @TestMethod
  public keepsEveryField(): void {
    const snapshot = new FileSnapshot(true, true, 3, 10, "hi\n");

    Assert.isTrue(snapshot.exists);
    Assert.isTrue(snapshot.isFile);
    Assert.areEqual(3, snapshot.size);
    Assert.areEqual(10, snapshot.modified);
    Assert.areEqual("hi\n", snapshot.text);
  }

  @TestMethod
  public isTheSameWhenEveryFieldAgreesOrOneSideHasNoText(): void {
    const snapshot = new FileSnapshot(true, true, 3, 10, "hi\n");

    Assert.isTrue(snapshot.isSameAs(new FileSnapshot(true, true, 3, 10, "hi\n")));
    Assert.isFalse(snapshot.isSameAs(new FileSnapshot(true, true, 3, 11, "hi\n")));
    Assert.isFalse(snapshot.isSameAs(new FileSnapshot(true, true, 3, 10, "ho\n")));
    Assert.isTrue(snapshot.isSameAs(new FileSnapshot(true, true, 3, 10, null)));
    Assert.isTrue(new FileSnapshot(true, true, 3, 10, null).isSameAs(snapshot));
    Assert.isFalse(snapshot.isSameAs(new FileSnapshot(true, true, 4, 10, "hi\n")));
    Assert.isFalse(snapshot.isSameAs(new FileSnapshot(true, false, 3, 10, "hi\n")));
    Assert.isFalse(snapshot.isSameAs(FileSnapshot.missing));
    Assert.isTrue(FileSnapshot.missing.isSameAs(new FileSnapshot(false, false, 0, 0, null)));
  }
}
