# Contributing

Contributions are welcome! Feel free to open an issue or submit a pull request.

## Setup

Create a new test vault and clone this repository into *.obsidian/plugins*:
```sh
git clone https://github.com/omeyenburg/obsidian-scrolling.git
```

Within the cloned directory, install the dependencies:
```sh
npm install
```

## Developing

`npm run build`:
Build the plugin in release mode.

`npm run dev`:
Build and watch the plugin to automatically rebuild the plugin on file changes.
After building, reload the plugin from Obsidian's settings to apply changes.

`npm run test`:
Run the test suite.
`jest` is used for unit testing in a partially mocked Obsidian environment.

## Project structure

A selective overview:

- `scripts/` contain helper and build scripts.
- `test/` and `mocks/` contain files related to testing.
- `styles.css` is the main styles file and bundled as-is.
- `src/` contains all TypeScript source files and will be transpiled into `main.js`.
    - `src/components/` contains all features of this plugin separated into distinct components.
    - `src/core/` contains general plugin files that are not specific to any component.
