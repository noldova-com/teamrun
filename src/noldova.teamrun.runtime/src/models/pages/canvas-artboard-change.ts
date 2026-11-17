/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ArgumentException } from "@noldova/context.exceptions";
import { CanvasArtboard } from "@noldova/teamrun.protocol";

import { PagesResources } from "../../services/pages/pages-resources.js";

export class CanvasArtboardChange {
  public readonly id: string;
  public readonly x: number | null;
  public readonly y: number | null;
  public readonly width: number | null;
  public readonly height: number | null;
  public readonly canvasPage: string | null;
  public readonly title: string | null;
  public readonly locked: boolean | null;
  public readonly hidden: boolean | null;
  public readonly group: string | null | undefined;
  public readonly removed: boolean;

  public constructor(id: string, x: number | null, y: number | null, width: number | null, height: number | null, canvasPage: string | null,
    title: string | null, locked: boolean | null, hidden: boolean | null, group: string | null | undefined, removed: boolean) {
    ArgumentException.throwIfNullOrWhitespace(id, PagesResources.artboardIdArgument);

    this.id = id;
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.canvasPage = canvasPage;
    this.title = title;
    this.locked = locked;
    this.hidden = hidden;
    this.group = group;
    this.removed = removed;
  }

  public applied(artboard: CanvasArtboard): readonly CanvasArtboard[] {
    if (this.removed)
      return [];
    return [new CanvasArtboard(artboard.id, artboard.pageId, artboard.pageVersion, this.canvasPage ?? artboard.canvasPage, this.x ?? artboard.x,
      this.y ?? artboard.y, this.width ?? artboard.width, this.height ?? artboard.height, this.title ?? artboard.title, this.locked ?? artboard.locked,
      this.hidden ?? artboard.hidden, Object.isUndefined(this.group) ? artboard.group : this.group)];
  }
}
