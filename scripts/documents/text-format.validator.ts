/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export default class TextFormatValidator {
  private static readonly NULL_BYTE: number = 0x00;
  private static readonly LINE_FEED: number = 0x0a;
  private static readonly BYTE_ORDER_MARK: Buffer = Buffer.from([0xef, 0xbb, 0xbf]);
  private static readonly LINE_SEPARATOR: string = "\n";
  private static readonly CARRIAGE_RETURN: string = "\r";
  private static readonly TRAILING_WHITESPACE_PATTERN: RegExp = /[ \t]\r?$/;

  public validate(filePath: string, content: Buffer): readonly string[] {
    if (content.includes(TextFormatValidator.NULL_BYTE))
      return [];

    const findings: string[] = [];
    if (content.subarray(0, TextFormatValidator.BYTE_ORDER_MARK.length).equals(TextFormatValidator.BYTE_ORDER_MARK))
      findings.push(`${filePath}:1: starts with a byte order mark.`);
    let hasCarriageReturn = false;
    for (const [index, line] of content.toString("utf8").split(TextFormatValidator.LINE_SEPARATOR).entries()) {
      if (!hasCarriageReturn && line.includes(TextFormatValidator.CARRIAGE_RETURN)) {
        hasCarriageReturn = true;
        findings.push(`${filePath}:${index + 1}: uses a carriage return; lines end with LF only.`);
      }
      if (TextFormatValidator.TRAILING_WHITESPACE_PATTERN.test(line))
        findings.push(`${filePath}:${index + 1}: ends with whitespace.`);
    }
    if (content.at(-1) !== TextFormatValidator.LINE_FEED)
      findings.push(`${filePath}: does not end with a newline.`);
    else if (content.length === 1 || content.at(-2) === TextFormatValidator.LINE_FEED)
      findings.push(`${filePath}: ends with a blank line.`);
    return findings;
  }
}
