/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { JsonException, JsonReader } from "@noldova/teamrun-foundation-json";

import { StartupStateKind } from "../enums/startup-state-kind";
import { Resources } from "../../resources";

export class StartupState {
  public readonly kind: StartupStateKind;
  public readonly details: readonly string[];

  public constructor(kind: StartupStateKind, details: readonly string[]) {
    this.kind = kind;
    this.details = [...details];
  }

  public static fromJson(value: unknown): StartupState {
    const json = JsonReader.fromValue(value);
    const kind = json.readString(Resources.kindField);
    const details = json.readStringArray(Resources.detailsField);
    const known = Object.values(StartupStateKind).find(t => t === kind);
    if (Object.isUndefined(known))
      throw new JsonException(Resources.unknownStartupState, `${json.path}.${Resources.kindField}`);
    return new StartupState(known, details);
  }

  public get isReady(): boolean {
    return this.kind === StartupStateKind.Ready;
  }
}
