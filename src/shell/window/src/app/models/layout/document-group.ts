/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonObject } from "@noldova/teamrun-foundation-json";

import { Resources } from "../../../resources";
import type { SplitAxis } from "../../enums/split-axis";
import type { Tab } from "./tab";
import { TabGroup } from "./tab-group";

export class DocumentGroup extends TabGroup {
  public constructor(tabs: readonly Tab[], active: Tab | null, preview: Tab | null = null, id: number = Resources.documentsGroupId) {
    super(id, tabs, active, preview);
  }

  public static createEmpty(id: number = Resources.documentsGroupId): DocumentGroup {
    return new DocumentGroup([], null, null, id);
  }

  public override get isDocuments(): boolean {
    return true;
  }

  public override accepts(): boolean {
    return true;
  }

  public override minimumLength(axis: SplitAxis): number {
    return Math.max(super.minimumLength(axis), Resources.documentMinimumSize);
  }

  public override toJson(): JsonObject {
    return { ...super.toJson(), [Resources.documentsField]: true };
  }

  protected override copy(tabs: readonly Tab[], active: Tab | null, preview: Tab | null): TabGroup {
    return new DocumentGroup(tabs, active, preview, this.id);
  }

  protected override emptied(): TabGroup {
    return DocumentGroup.createEmpty(this.id);
  }
}
