/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { JsonException, JsonReader } from "@noldova/teamrun-foundation-json";

import { UpdateStateKind } from "../enums/update-state-kind";
import { Resources } from "../../resources";

export class UpdateState {
  public static readonly off: UpdateState = new UpdateState(UpdateStateKind.Off, null, null, null, null, false);

  public readonly kind: UpdateStateKind;
  public readonly version: string | null;
  public readonly progress: number | null;
  public readonly checkedAt: number | null;
  public readonly reason: string | null;
  public readonly mustMove: boolean;

  public constructor(kind: UpdateStateKind, version: string | null, progress: number | null, checkedAt: number | null, reason: string | null, mustMove: boolean) {
    this.kind = kind;
    this.version = version;
    this.progress = progress;
    this.checkedAt = checkedAt;
    this.reason = reason;
    this.mustMove = mustMove;
  }

  public static fromJson(value: unknown): UpdateState {
    const json = JsonReader.fromValue(value);
    const kind = json.readString(Resources.kindField);
    const known = Object.values(UpdateStateKind).find(t => t === kind);
    if (Object.isUndefined(known))
      throw new JsonException(Resources.unknownUpdateState, `${json.path}.${Resources.kindField}`);
    const progress = json.readNullableInteger(Resources.progressField);
    if (!Object.isNull(progress) && (progress < 0 || progress > 100))
      throw new JsonException(Resources.invalidUpdateProgress, `${json.path}.${Resources.progressField}`);
    const version = json.readNullableString(Resources.versionField);
    if (Object.isNull(version) && [UpdateStateKind.Available, UpdateStateKind.Downloading, UpdateStateKind.Ready].includes(known))
      throw new JsonException(Resources.missingUpdateVersion, `${json.path}.${Resources.versionField}`);
    const mustMove = json.readBoolean(Resources.mustMoveField);
    if (mustMove !== (known === UpdateStateKind.Available) && known !== UpdateStateKind.Failed)
      throw new JsonException(Resources.invalidUpdateMove, `${json.path}.${Resources.mustMoveField}`);
    return new UpdateState(known, version, progress, json.readNullableInteger(Resources.checkedAtField), json.readNullableString(Resources.reasonField), mustMove);
  }

  public get canCheck(): boolean {
    return [UpdateStateKind.UpToDate, UpdateStateKind.Available, UpdateStateKind.Failed].includes(this.kind);
  }

  public get canRestart(): boolean {
    return this.kind === UpdateStateKind.Ready;
  }

  public get showsItem(): boolean {
    return [UpdateStateKind.Available, UpdateStateKind.Ready, UpdateStateKind.Failed].includes(this.kind);
  }
}
