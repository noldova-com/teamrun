/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonObject } from "@noldova/teamrun-foundation-json";

import { StartupStateKind } from "../enums/startup-state-kind.js";
import { Resources } from "../resources.js";

export class StartupState {
  public readonly kind: StartupStateKind;
  public readonly details: readonly string[];

  private constructor(kind: StartupStateKind, details: readonly string[]) {
    this.kind = kind;
    this.details = [...details];
  }

  public static connecting(): StartupState {
    return new StartupState(StartupStateKind.Connecting, []);
  }

  public static preShellData(location: string): StartupState {
    return new StartupState(StartupStateKind.PreShellData, [location]);
  }

  public static workInProgress(descriptions: readonly string[]): StartupState {
    return new StartupState(StartupStateKind.WorkInProgress, descriptions);
  }

  public static waitingForWork(descriptions: readonly string[]): StartupState {
    return new StartupState(StartupStateKind.WaitingForWork, descriptions);
  }

  public static newerBuild(version: string): StartupState {
    return new StartupState(StartupStateKind.NewerBuild, [version]);
  }

  public static failed(message: string): StartupState {
    return new StartupState(StartupStateKind.Failed, [message]);
  }

  public static ready(): StartupState {
    return new StartupState(StartupStateKind.Ready, []);
  }

  public toJson(): JsonObject {
    return { [Resources.kindField]: this.kind, [Resources.detailsField]: [...this.details] };
  }
}
