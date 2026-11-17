/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { OpencodeLevelReader } from "@noldova/teamrun.providers";

import { OpencodeModelListRecording } from "../../fixtures/opencode-model-list.recording.js";

@TestClass
export class OpencodeLevelReaderTests {
  @TestMethod
  public readsEachRecordedModelsVariantsInTheirOrderThenDefaultAndNoneWhereItsVariantsAreEmpty(): void {
    const levels = OpencodeLevelReaderTests.reader().read(OpencodeModelListRecording.output);

    Assert.areEqual("opencode/beam-free:low,medium,high,xhigh,max,default|opencode/big-pickle:|opencode/deepseek-v4.1-flash-free:low,high,max,default",
      OpencodeLevelReaderTests.format(levels));
  }

  @TestMethod
  public leavesOutAModelWhoseJsonCantBeReadOrHasNoVariantsAndReadsWindowsLineEnds(): void {
    const output = ["1.19.5", "a/one", "{ \"variants\": { \"high\": {}, \"low\": {} } }", "b/two", "{ \"variants\": ", "c/three", "{ \"id\": \"three\" }",
      "d/four", "{ \"variants\": {} }", ""].join("\r\n");

    Assert.areEqual("a/one:high,low,default|d/four:", OpencodeLevelReaderTests.format(OpencodeLevelReaderTests.reader().read(output)));
  }

  private static reader(): OpencodeLevelReader {
    return new OpencodeLevelReader(() => { throw new Error("Not launched"); });
  }

  private static format(levels: ReadonlyMap<string, readonly string[]>): string {
    return [...levels].map(([model, values]) => `${model}:${values.join(",")}`).join("|");
  }
}
