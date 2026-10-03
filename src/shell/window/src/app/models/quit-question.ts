/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { JsonReader } from "@noldova/teamrun-foundation-json";

import { Resources } from "../../resources";

export class QuitQuestion {
  public readonly descriptions: readonly string[];
  public readonly isWaiting: boolean;

  public constructor(descriptions: readonly string[], isWaiting: boolean) {
    this.descriptions = [...descriptions];
    this.isWaiting = isWaiting;
  }

  public static fromJson(value: unknown): QuitQuestion {
    const json = JsonReader.fromValue(value);
    return new QuitQuestion(json.readStringArray(Resources.descriptionsField), json.readBoolean(Resources.isWaitingField));
  }

  public get shown(): readonly string[] {
    return this.descriptions.slice(0, Resources.quitListLimit);
  }

  public get hiddenCount(): number {
    return Math.max(0, this.descriptions.length - Resources.quitListLimit);
  }
}
