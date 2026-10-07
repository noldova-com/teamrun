/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../../resources";
import type { IVirtualRowContext } from "../interfaces/i-virtual-row-context";

export class VirtualListRow<T> {
  private static readonly stopTrack: symbol = Symbol("stop");

  public readonly index: number;
  public readonly track: string | number | symbol;
  public readonly top: number | null;
  public readonly height: number;
  public readonly isStop: boolean;
  public readonly isSelected: boolean;
  public readonly labelId: string;
  public readonly descriptionId: string;
  public readonly context: IVirtualRowContext<T> | null;

  public constructor(id: string, index: number, item: T | undefined, key: string | undefined, top: number | null, height: number, isStop: boolean, isSelected: boolean) {
    this.index = index;
    this.track = key ?? (isStop ? VirtualListRow.stopTrack : index);
    this.top = top;
    this.height = height;
    this.isStop = isStop;
    this.isSelected = isSelected;
    this.labelId = Resources.formatVirtualListLabelId(id, index);
    this.descriptionId = Resources.formatVirtualListDescriptionId(id, index);
    this.context = Object.isUndefined(item) ? null : { $implicit: item, index, height, labelId: this.labelId, descriptionId: this.descriptionId };
  }
}
