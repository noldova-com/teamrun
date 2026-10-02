/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import type { BuildIdentity } from "@noldova/teamrun-shell-protocol";

import { BuildRelation } from "../../enums/build-relation.js";
import { Resources } from "../../resources.js";

export class BuildComparer {
  public static compare(own: BuildIdentity, other: BuildIdentity): BuildRelation {
    const ownKey = BuildComparer.formatKey(own.productVersion);
    const otherKey = BuildComparer.formatKey(other.productVersion);
    if (ownKey === otherKey)
      return BuildRelation.SameVersion;
    return ownKey > otherKey ? BuildRelation.Newer : BuildRelation.Older;
  }

  private static formatKey(version: string): string {
    if (!Resources.productVersionPattern.test(version))
      throw new ArgumentException(Resources.formatProductVersionInvalid(version), Resources.productVersionParameterName);
    return version.split(Resources.versionSeparator).map(t => t.padStart(Resources.versionPartWidth, Resources.versionPadding)).join(Resources.versionSeparator);
  }
}
