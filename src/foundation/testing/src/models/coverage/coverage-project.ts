/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { nameof } from "@noldova/teamrun-foundation-core";
import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";

import { Resources } from "../../resources.js";
import type { CoverageExclusion } from "./coverage-exclusion.js";

export class CoverageProject {
  public readonly name: string;
  public readonly productionDirectory: string;
  public readonly sourceDirectory: string;
  public readonly exclusions: readonly CoverageExclusion[];

  public constructor(name: string, productionDirectory: string, sourceDirectory: string, exclusions: readonly CoverageExclusion[] = []) {
    ArgumentException.throwIfNullOrWhitespace(name, nameof<CoverageProject>(t => t.name));
    ArgumentException.throwIfNullOrWhitespace(productionDirectory, nameof<CoverageProject>(t => t.productionDirectory));
    ArgumentException.throwIfNullOrWhitespace(sourceDirectory, nameof<CoverageProject>(t => t.sourceDirectory));
    if (new Set(exclusions.map(t => t.relativePath)).size !== exclusions.length)
      throw new ArgumentException(Resources.repeatedCoverageExclusion, nameof<CoverageProject>(t => t.exclusions));

    this.name = name;
    this.productionDirectory = productionDirectory;
    this.sourceDirectory = sourceDirectory;
    this.exclusions = [...exclusions];
  }
}
