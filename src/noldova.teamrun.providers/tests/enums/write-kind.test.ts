/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { WriteKind } from "@noldova/teamrun.providers";

@TestClass
export class WriteKindTests {
  @TestMethod
  public namesEveryKind(): void {
    Assert.areEqual("Quiet,ChangeFolder,PushFolder,PopFolder,Git,Files,Copy,Move,Remove,Rename,NewItem,StreamEdit,DiskDump,Sort,Download,Fetch,Find",
      Object.values(WriteKind).join(","));
  }
}
