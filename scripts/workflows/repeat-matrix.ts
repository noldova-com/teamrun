/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import BuildMatrix from "./build-matrix.ts";
import type IRepeatLeg from "./interfaces/i-repeat-leg.ts";

export default class RepeatMatrix {
  public static readonly PASSES: number = 5;
  private static readonly PARALLEL_TARGETS: readonly string[] = ["Linux x64", "Windows x64"];
  private static readonly SERIAL_TARGETS: readonly string[] = ["macOS ARM64"];

  public static plan(): readonly IRepeatLeg[] {
    return new BuildMatrix(undefined).targets.flatMap(t => {
      if (RepeatMatrix.PARALLEL_TARGETS.includes(t.name))
        return Array.from({ length: RepeatMatrix.PASSES }, (_, i) => ({
          name: `${t.name}, pass ${i + 1} of ${RepeatMatrix.PASSES}`, key: `${t.key}-${i + 1}`, runner: t.runner, architecture: t.architecture, repeats: 1
        }));
      return RepeatMatrix.SERIAL_TARGETS.includes(t.name)
        ? [{ name: `${t.name}, ${RepeatMatrix.PASSES} passes`, key: t.key, runner: t.runner, architecture: t.architecture, repeats: RepeatMatrix.PASSES }]
        : [];
    });
  }
}
