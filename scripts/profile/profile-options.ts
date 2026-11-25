/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

export class ProfileOptions {
  private static readonly LABEL: RegExp = /^[\w.-]+$/;
  private static readonly COUNT: RegExp = /^\d+$/;
  private static readonly SEED_OPTION: string = "--seed";
  private static readonly PAIRS_OPTION: string = "--pairs";
  private static readonly SCENARIOS_OPTION: string = "--scenarios";
  private static readonly NODE_OPTION: string = "--node";
  private static readonly SCENARIO_SEPARATOR: string = ",";

  public readonly label: string;
  public readonly seed: boolean;
  public readonly pairs: string | null;
  public readonly scenarios: readonly string[] | null;
  public readonly profileNode: boolean;

  public constructor(label: string, seed: boolean, pairs: string | null, scenarios: readonly string[] | null, profileNode: boolean) {
    this.label = label;
    this.seed = seed;
    this.pairs = pairs;
    this.scenarios = scenarios;
    this.profileNode = profileNode;
  }

  public static parse(args: readonly string[]): ProfileOptions | null {
    const [label, ...rest] = args;
    if (Object.isUndefined(label) || !ProfileOptions.LABEL.test(label))
      return null;
    let seed = false;
    let pairs: string | null = null;
    let scenarios: readonly string[] | null = null;
    let profileNode = false;
    for (let index = 0; index < rest.length; index++) {
      const option = rest[index];
      const value = rest[index + 1];
      if (option === ProfileOptions.SEED_OPTION)
        seed = true;
      else if (option === ProfileOptions.NODE_OPTION)
        profileNode = true;
      else if (option === ProfileOptions.PAIRS_OPTION && !Object.isUndefined(value) && ProfileOptions.COUNT.test(value)) {
        pairs = value;
        index++;
      }
      else if (option === ProfileOptions.SCENARIOS_OPTION && !Object.isUndefined(value) && !value.startsWith("--")) {
        scenarios = value.split(ProfileOptions.SCENARIO_SEPARATOR);
        index++;
      }
      else
        return null;
    }
    return !Object.isNull(pairs) && !seed ? null : new ProfileOptions(label, seed, pairs, scenarios, profileNode);
  }
}
