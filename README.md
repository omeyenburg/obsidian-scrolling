# Scrolling

This [Obsidian](https://obsidian.md/) Plugin adds lots of customizability to how scrolling works, featuring mouse scroll settings, automatic scrolling and scrollbar styling.

## Installation
Currently there are two methods of installation.

## Manual installation
Go to the latest release on this repo and download `main.js` and `manifest.json`.
Create the folder .obsidian/plugins/obsidian-scrolling/ and move the downloaded files into it.
(Alternatively, to get the latest bugs, you can download `main.js` and `manifest.json` from the source of the repo)

## Manual installation from source
1. Make sure you have git and npm installed.
2. Open your vault in your terminal and navigate into .obsidian/plugins.
3. Run `git clone https://github.com/omeyenburg/obsidian-scrolling.git`.
4. Navigate into obsidian-scrolling and run `npm install` and `npm run build`.
6. Activate the plugin under community plugins.

## Contributions
Feel free to commit issues and pull requests. You can follow the [[Manual installation from source]] guide to build this plugin.
Run `npm run dev` to start a job automatically which automatically cross-compiles the TypeScript source code into the `main.js` file.