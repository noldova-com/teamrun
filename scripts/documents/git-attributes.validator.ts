/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export default class GitAttributesValidator {
  public static readonly FILE: string = ".gitattributes";

  private static readonly LINE_ENDING_RULE: string = "* text=auto eol=lf";
  private static readonly LINE_SEPARATOR: string = "\n";

  public validate(text: string | null): readonly string[] {
    if (text === null)
      return [`${GitAttributesValidator.FILE}: is missing; it holds "${GitAttributesValidator.LINE_ENDING_RULE}", which keeps every text file's line endings LF.`];
    return text.split(GitAttributesValidator.LINE_SEPARATOR).some(t => t.trim() === GitAttributesValidator.LINE_ENDING_RULE)
      ? []
      : [`${GitAttributesValidator.FILE}: lacks the line "${GitAttributesValidator.LINE_ENDING_RULE}", which keeps every text file's line endings LF.`];
  }
}
