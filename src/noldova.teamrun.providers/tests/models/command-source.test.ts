/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { CommandSource, ProcessCommand } from "@noldova/teamrun.providers";

@TestClass
export class CommandSourceTests {
  @TestMethod
  public keepsTheCommandFoundAtStartWithoutLookingAgain(): void {
    const command = new ProcessCommand("/usr/local/bin/claude", []);
    let looks = 0;
    const source = new CommandSource(command, () => {
      looks++;
      return null;
    });

    Assert.areEqual(command, source.current);
    Assert.areEqual(command, source.current);
    Assert.areEqual(0, looks);
  }

  @TestMethod
  public looksAgainWhileThereIsNoneAndKeepsWhatItFinds(): void {
    let found: ProcessCommand | null = null;
    let looks = 0;
    const source = new CommandSource(null, () => {
      looks++;
      return found;
    });
    const read = (): ProcessCommand | null => source.current;

    const before = [read(), read()];
    found = new ProcessCommand("/opt/tools/bin/claude", []);
    const current = read();
    found = null;

    Assert.areEqual("null,null", before.map(t => String(t)).join(","));
    Assert.areEqual("/opt/tools/bin/claude", current?.executable);
    Assert.areEqual(current, read());
    Assert.areEqual(3, looks);
  }

  @TestMethod
  public findsNothingByDefault(): void {
    Assert.isNull(new CommandSource(null).current);
    Assert.isNull(CommandSource.none());
  }
}
