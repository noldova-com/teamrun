# TeamRun

TeamRun is designed to bring your coding agents, conversations and tools together. The main app is the window and the workspace. Everything you do in it comes from a module, so TeamRun grows by adding modules.

## Work with your agents

Whether you use one coding agent or several, they can all work in the same conversation. It doesn't matter which provider a model comes from, and later it won't matter which computer it runs on. TeamRun is built around a straightforward workflow:

1. **Start where you work.** Connect a conversation to the local folder you're working on, or start one without a project.
2. **Choose who helps.** Pick a provider you're signed in to, or create named teammates with their own roles and model preferences.
3. **Work in conversation.** Describe a task, share files or images, and follow replies and project changes.
4. **Review and continue.** Respond to permission requests, inspect the results and return to the conversation when you need it.

## Modules

Conversations, providers, terminals, editors and diffs are modules. Every module is built in: Noldova writes it and delivers it with TeamRun. Installing modules yourself and modules by other authors are separate future capabilities.

## Platforms

TeamRun targets Windows, macOS and Linux on x64 and ARM64.

## Build from source

You need Git, Node.js 26.7.0 or a later 26.x release, and npm 11.19.0. In a clone of the repository, run:

```bash
npm ci
npm run build
npm test
```

`npm ci` installs the exact tool versions the repository pins and warns when your Node.js or npm version differs from the required one. `npm run build` builds the packages under `src/`, installs the Angular project in `src/` from its own lockfile and downloads the headless Chromium its tests run in. `npm test` runs the complete set of checks: the documents' format and links, the folder structure, the architecture's dependency and naming rules, the type check and tests of the repository's scripts, and the Angular tests, each with full coverage. `npm test -- documents` runs only the document checks.

## Questions, ideas and contributions

Have a question, found a bug or want to suggest a feature? Search [GitHub Issues](https://github.com/noldova-com/teamrun/issues), then open an issue describing what you need. For security concerns, follow the [private reporting guidance](.github/SECURITY.md).

If you'd like to contribute, start with the [contribution guide](.github/CONTRIBUTING.md). It explains how to discuss a change, prepare a pull request and report what you've checked.

For a closer look at the project, read the [architecture](docs/ARCHITECTURE.md), [coding standards](docs/CODING-STANDARDS.md), [UI standards](docs/UI-STANDARDS.md) and [testing approach](docs/TESTING.md).

## License

TeamRun is a NOLDOVA project. Its own code and documentation are licensed under the [MIT License](LICENSE). Third-party components and assets retain their respective licenses.
