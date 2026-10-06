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
  private static readonly SERIAL_SHARD_LIMIT: number = 2;
  private static readonly SERIAL_TEST_MILLISECONDS: number = 3_600;
  private static readonly SERIAL_LEG_MILLISECONDS: number = 40 * 60_000;
  private static readonly PARALLEL_TARGETS: readonly string[] = ["Linux x64", "Windows x64"];
  private static readonly SERIAL_TARGETS: readonly string[] = ["macOS ARM64"];

  public static plan(workflowTests: number): readonly IRepeatLeg[] {
    const shards = RepeatMatrix.countSerialShards(workflowTests);
    return new BuildMatrix(undefined).targets.flatMap(t => {
      if (RepeatMatrix.PARALLEL_TARGETS.includes(t.name))
        return Array.from({ length: RepeatMatrix.PASSES }, (_, i) => ({
          name: `${t.name}, pass ${i + 1} of ${RepeatMatrix.PASSES}`, key: `${t.key}-${i + 1}`, runner: t.runner, architecture: t.architecture, repeats: 1, shard: "", hasTests: true
        }));
      if (!RepeatMatrix.SERIAL_TARGETS.includes(t.name))
        return [];
      const name = `${t.name}, ${RepeatMatrix.PASSES} passes`;
      if (shards === 1)
        return [{ name, key: t.key, runner: t.runner, architecture: t.architecture, repeats: RepeatMatrix.PASSES, shard: "", hasTests: true }];
      return Array.from({ length: shards }, (_, i) => ({
        name: `${name}, shard ${i + 1} of ${shards}`, key: `${t.key}-${i + 1}`, runner: t.runner, architecture: t.architecture, repeats: RepeatMatrix.PASSES,
        shard: `${i + 1}/${shards}`, hasTests: i === 0
      }));
    });
  }

  private static countSerialShards(workflowTests: number): number {
    const needed = Math.ceil(workflowTests * RepeatMatrix.PASSES * RepeatMatrix.SERIAL_TEST_MILLISECONDS / RepeatMatrix.SERIAL_LEG_MILLISECONDS);
    return Math.min(RepeatMatrix.SERIAL_SHARD_LIMIT, Math.max(1, needed));
  }
}
