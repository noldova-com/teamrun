/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import PackagingException from "./packaging.exception.ts";

export default class WindowsSigningAccount {
  public static readonly ENDPOINT_VARIABLE: string = "AZURE_SIGNING_ENDPOINT";
  public static readonly ACCOUNT_VARIABLE: string = "AZURE_SIGNING_ACCOUNT";
  public static readonly PROFILE_VARIABLE: string = "AZURE_SIGNING_PROFILE";
  public static readonly VARIABLES: readonly string[] = [
    WindowsSigningAccount.ENDPOINT_VARIABLE, WindowsSigningAccount.ACCOUNT_VARIABLE, WindowsSigningAccount.PROFILE_VARIABLE
  ];

  private static readonly ENDPOINT: RegExp = /^https:\/\/[a-z0-9]+(?:[.-][a-z0-9]+)*\/$/;
  private static readonly NAME: RegExp = /^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?$/;

  public readonly endpoint: string;
  public readonly account: string;
  public readonly profile: string;

  public constructor(endpoint: string, account: string, profile: string) {
    this.endpoint = endpoint;
    this.account = account;
    this.profile = profile;
  }

  public static fromCredentials(credentials: NodeJS.ProcessEnv): WindowsSigningAccount {
    const missing = WindowsSigningAccount.VARIABLES.filter(t => WindowsSigningAccount.read(credentials, t).length === 0);
    if (missing.length > 0)
      throw new PackagingException(`Signing Windows packages needs ${missing.join(", ")}, the Artifact Signing endpoint, account and certificate profile.`);
    const endpoint = WindowsSigningAccount.read(credentials, WindowsSigningAccount.ENDPOINT_VARIABLE);
    const account = WindowsSigningAccount.read(credentials, WindowsSigningAccount.ACCOUNT_VARIABLE);
    const profile = WindowsSigningAccount.read(credentials, WindowsSigningAccount.PROFILE_VARIABLE);
    WindowsSigningAccount.require(WindowsSigningAccount.ENDPOINT.test(endpoint), WindowsSigningAccount.ENDPOINT_VARIABLE, "the HTTPS URL of the Artifact Signing endpoint, ending in /");
    for (const [name, value] of [[WindowsSigningAccount.ACCOUNT_VARIABLE, account], [WindowsSigningAccount.PROFILE_VARIABLE, profile]] as const)
      WindowsSigningAccount.require(WindowsSigningAccount.NAME.test(value), name, "a name of letters, digits and hyphens that starts and ends with a letter or digit");
    return new WindowsSigningAccount(endpoint, account, profile);
  }

  private static read(credentials: NodeJS.ProcessEnv, name: string): string {
    return credentials[name] ?? "";
  }

  private static require(isValid: boolean, name: string, expected: string): void {
    if (!isValid)
      throw new PackagingException(`${name} must be ${expected}.`);
  }

  public redact(text: string): string {
    const host = URL.canParse(this.endpoint) ? new URL(this.endpoint).host : "";
    const values = ([[this.endpoint, WindowsSigningAccount.ENDPOINT_VARIABLE], [host, WindowsSigningAccount.ENDPOINT_VARIABLE],
      [this.account, WindowsSigningAccount.ACCOUNT_VARIABLE], [this.profile, WindowsSigningAccount.PROFILE_VARIABLE]] as const)
      .filter(t => t[0].length > 0)
      .toSorted((first, second) => second[0].length - first[0].length);
    let redacted = text;
    for (const [value, name] of values)
      redacted = redacted.split(value).join(name);
    return redacted;
  }
}
