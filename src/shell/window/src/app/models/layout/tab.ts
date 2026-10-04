/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import type { JsonObject } from "@noldova/teamrun-foundation-json";

import { Resources } from "../../../resources";
import type { ViewRegistry } from "./view-registry";

export abstract class Tab {
  public readonly name: string;
  public readonly instance?: string;
  public readonly key: string;

  protected constructor(kind: string, name: string, instance?: string) {
    if (!Tab.isName(name))
      throw new ArgumentException(Resources.invalidContributionName, "name");
    if (!Tab.isInstance(instance))
      throw new ArgumentException(Resources.invalidInstance, "instance");

    this.name = name;
    if (!Object.isUndefined(instance))
      this.instance = instance;
    this.key = [kind, name, ...(Object.isUndefined(instance) ? [] : [instance])].join(Resources.keySeparator);
  }

  public abstract get isMovable(): boolean;

  public static isName(name: string): boolean {
    return Resources.contributionNamePattern.test(name);
  }

  public static isInstance(instance: string | undefined): boolean {
    return Object.isUndefined(instance) || !String.isNullOrWhitespace(instance);
  }

  public equals(other: Tab | null): boolean {
    return other?.key === this.key;
  }

  public abstract isAvailable(registry: ViewRegistry): boolean;

  public abstract toJson(): JsonObject;
}
