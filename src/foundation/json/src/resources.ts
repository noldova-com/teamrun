/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class Resources {
  public static readonly arrayTypeName: string = "an array";
  public static readonly blankString: string = "Expected a string that is not blank.";
  public static readonly booleanTypeName: string = "boolean";
  public static readonly circularReference: string = "Circular references cannot be carried as JSON.";
  public static readonly invalidJsonText: string = "The text is not valid JSON.";
  public static readonly listSeparator: string = ", ";
  public static readonly missingField: string = "The field is required.";
  public static readonly notInteger: string = "Expected an integer.";
  public static readonly notObject: string = "Expected a JSON object.";
  public static readonly numberTypeName: string = "number";
  public static readonly objectTypeName: string = "object";
  public static readonly pathMessageSeparator: string = ": ";
  public static readonly pathSeparator: string = ".";
  public static readonly rootPath: string = "$";
  public static readonly stringTypeName: string = "string";
  public static readonly unexpectedNull: string = "Null is not an accepted value here.";

  public static formatNotJsonValue(kind: string): string {
    return `A value of type "${kind}" cannot be carried as JSON.`;
  }

  public static formatNotOneOf(values: readonly string[]): string {
    return `Expected one of ${values.join(Resources.listSeparator)}.`;
  }

  public static formatWrongType(expected: string): string {
    return `Expected ${expected}.`;
  }
}
