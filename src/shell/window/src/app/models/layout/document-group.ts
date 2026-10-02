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
  public constructor(tabs: readonly Tab[], active: Tab | null) {
    super(Resources.documentsGroupId, tabs, active);
  }

  public static createEmpty(): DocumentGroup {
    return new DocumentGroup([], null);
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

  protected override copy(tabs: readonly Tab[], active: Tab | null): TabGroup {
    return new DocumentGroup(tabs, active);
  }

  protected override emptied(): TabGroup {
    return DocumentGroup.createEmpty();
  }
}
