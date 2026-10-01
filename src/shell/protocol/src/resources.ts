/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class Resources {
  public static readonly protocolVersion: string = "__PROTOCOL_VERSION__";
  public static readonly defaultMaximumFrameLength: number = 16 * 1024 * 1024;
  public static readonly frameDelimiter: string = "\n";
  public static readonly shellOwner: string = "shell";
  public static readonly nameSeparator: string = ".";
  public static readonly pathSeparator: string = ".";
  public static readonly ownerPattern: RegExp = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
  public static readonly memberPattern: RegExp = /^[a-z][a-zA-Z0-9]*$/;
  public static readonly protocolVersionPattern: RegExp = /^[1-9][0-9]*$/;

  public static readonly kindField: string = "kind";
  public static readonly idField: string = "id";
  public static readonly methodField: string = "method";
  public static readonly nameField: string = "name";
  public static readonly payloadField: string = "payload";
  public static readonly failureField: string = "failure";
  public static readonly codeField: string = "code";
  public static readonly messageField: string = "message";
  public static readonly timeoutField: string = "timeoutMilliseconds";
  public static readonly identityField: string = "identity";
  public static readonly tokenField: string = "token";
  public static readonly clientField: string = "client";
  public static readonly productVersionField: string = "productVersion";
  public static readonly protocolVersionField: string = "protocolVersion";
  public static readonly fingerprintField: string = "fingerprint";
  public static readonly detailsField: string = "details";
  public static readonly executablePathField: string = "executablePath";
  public static readonly policyField: string = "policy";
  public static readonly descriptionsField: string = "descriptions";
  public static readonly textParameterName: string = "text";
  public static readonly maximumFrameLengthParameterName: string = "maximumFrameLength";

  public static readonly nameInvalid: string = "A name must be an owner, a dot and a member, such as \"shell.handshake\": the owner is \"shell\" or a module id in lowercase kebab-case, and the member starts with a lowercase letter followed by letters and digits.";
  public static readonly protocolVersionInvalid: string = "The protocol version must be a positive integer.";
  public static readonly stampedProtocolVersionInvalid: string = "The package's protocol version was not stamped by the build.";
  public static readonly timeoutInvalid: string = "The time limit must be a positive integer of milliseconds.";
  public static readonly maximumFrameLengthInvalid: string = "The maximum frame length must be a positive integer.";
  public static readonly responseOutcomeMissing: string = "A response must carry a payload or a failure.";
  public static readonly responseOutcomeAmbiguous: string = "A response cannot carry both a payload and a failure.";
  public static readonly unknownField: string = "The field is not part of this message, which accepts no unknown fields.";

  public static formatFrameTooLarge(maximumFrameLength: number): string {
    return `A frame exceeds the maximum length of ${maximumFrameLength} characters.`;
  }

  public static formatFieldPath(path: string, field: string): string {
    return `${path}${Resources.pathSeparator}${field}`;
  }
}
