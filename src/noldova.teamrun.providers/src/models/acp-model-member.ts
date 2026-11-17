/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ArgumentException } from "@noldova/context.exceptions";

import { Resources } from "../resources.js";

export class AcpModelMember {
  public readonly familyId: string;
  public readonly familyName: string;
  public readonly levelName: string;

  public constructor(familyId: string, familyName: string, levelName: string) {
    ArgumentException.throwIfNullOrWhitespace(familyId, Resources.familyIdParameterName);
    ArgumentException.throwIfNullOrWhitespace(familyName, Resources.familyNameParameterName);
    ArgumentException.throwIfNullOrWhitespace(levelName, Resources.levelNameParameterName);

    this.familyId = familyId;
    this.familyName = familyName;
    this.levelName = levelName;
  }
}
