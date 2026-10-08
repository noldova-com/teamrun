/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import ListTargets from "../../list-targets.ts";
import type CommandDoublesFixture from "./command-doubles.fixture.ts";
import TextOutputFixture from "./text-output.fixture.ts";

export default class TargetListFixture {
  public static readonly CALL: string = "node scripts/list-targets.ts";

  public static answer(doubles: CommandDoublesFixture): void {
    const output = new TextOutputFixture();
    new ListTargets(output).run([]);
    doubles.respond("node", "scripts/list-targets.ts", output.text);
  }
}
