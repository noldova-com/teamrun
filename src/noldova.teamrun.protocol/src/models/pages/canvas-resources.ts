/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class CanvasResources {
  public static readonly maximumTextLength: number = 120;
  public static readonly idField: string = "id";
  public static readonly nameField: string = "name";
  public static readonly pageIdField: string = "pageId";
  public static readonly pageVersionField: string = "pageVersion";
  public static readonly canvasPageField: string = "canvasPage";
  public static readonly xField: string = "x";
  public static readonly yField: string = "y";
  public static readonly widthField: string = "width";
  public static readonly heightField: string = "height";
  public static readonly titleField: string = "title";
  public static readonly lockedField: string = "locked";
  public static readonly hiddenField: string = "hidden";
  public static readonly groupField: string = "group";
  public static readonly kindField: string = "kind";
  public static readonly textField: string = "text";
  public static readonly hrefField: string = "href";
  public static readonly authorField: string = "author";
  public static readonly atField: string = "at";
  public static readonly geometryField: string = "geometry";
  public static readonly colourField: string = "colour";
  public static readonly weightField: string = "weight";
  public static readonly fillField: string = "fill";
  public static readonly axisField: string = "axis";
  public static readonly pagesField: string = "pages";
  public static readonly artboardsField: string = "artboards";
  public static readonly notesField: string = "notes";
  public static readonly marksField: string = "marks";
  public static readonly guidesField: string = "guides";
  public static readonly duplicateId: string = "Every page, artboard, note and mark in a canvas needs its own id.";
  public static readonly unknownCanvasPage: string = "Every artboard, note, mark and guide must be on one of the canvas's pages.";
  public static readonly noPages: string = "A canvas needs at least one page.";
}
