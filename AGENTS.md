# Agent instructions

Noldova owns this repository and makes the final decisions.

## Documents

Read the owner before you work on its subject, and change a rule there.

| When you… | Read |
|---|---|
| explain what TeamRun is or who uses it | [README.md](README.md) |
| change the app's parts or their boundaries, or write code in this repository | [documents/ARCHITECTURE.md](documents/ARCHITECTURE.md) |
| write code, tests, styles, documents or commits | the organization's standards, `https://github.com/noldova-com/.github/blob/main/standards/AGENTS.md` |
| build or change anything a person sees | the organization's UI standard, `https://github.com/noldova-com/.github/blob/main/standards/UI.md` |
| prepare or run a release | [README.md, Releases](README.md#releases) |

## Work

- Every pull request names the issue it resolves in this repository, such as `Closes #N`, and passes the checks [README.md](README.md#checks) lists.

## TeamRun

- TeamRun is an app on Noldova Desktop: everything it adds is a module, and it installs Noldova Desktop and `@noldova/ui.components.angular` as published versions; never copy, fork or override their files, tokens or styles, and ask for a change through an issue in their repositories.
- A provider's credentials stay with the provider's own tools or the operating system's credential store; TeamRun never writes them to its database, its logs, its fixtures or a PR.
