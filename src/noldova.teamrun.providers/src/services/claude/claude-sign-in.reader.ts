/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { AccountInfo } from "@anthropic-ai/claude-agent-sdk";

import "@noldova/context.core";
import { JsonReader } from "@noldova/context.json";
import { SignInCheck } from "@noldova/teamrun.core";
import { AuthStatus, ProviderIdentity } from "@noldova/teamrun.protocol";

import { Resources } from "../../resources.js";
import { FailureDescriber } from "../failure-describer.js";

export class ClaudeSignInReader {
  public signedIn(account: AccountInfo): boolean | null {
    if (!Object.isUndefined(account.apiProvider) && account.apiProvider !== Resources.claudeFirstPartyProvider)
      return null;
    const sources = [account.tokenSource, account.apiKeySource].filter(t => !Object.isUndefined(t));
    if (sources.length === 0)
      return null;
    return sources.some(t => t !== Resources.claudeTokenSourceNone && t !== Resources.claudeApiKeySourceNone);
  }

  public read(output: string, harnessVersion: string | null): SignInCheck {
    const start = output.indexOf(Resources.jsonObjectStart);
    if (start < 0)
      return new SignInCheck(AuthStatus.Error, null, harnessVersion, Resources.formatUnexpectedSignInOutput(output.slice(0, Resources.maximumSummaryLength)));

    let status: JsonReader;
    try {
      status = JsonReader.parse(output.slice(start), Resources.signInStatusPath);
    }
    catch (error) {
      return new SignInCheck(AuthStatus.Error, null, harnessVersion, Resources.formatUnexpectedSignInOutput(FailureDescriber.describe(error)));
    }

    if (!status.hasField(Resources.loggedInField) || status.readValue(Resources.loggedInField) !== true)
      return new SignInCheck(AuthStatus.LoggedOut, null, harnessVersion, null);

    const identity = new ProviderIdentity(
      status.readOptionalString(Resources.emailField),
      status.readOptionalString(Resources.subscriptionTypeField),
      status.readOptionalString(Resources.organizationNameField),
      status.readOptionalString(Resources.authMethodField));

    return new SignInCheck(AuthStatus.LoggedIn, identity, harnessVersion, null);
  }
}
