# Scrolling

A plugin for [Obsidian](https://obsidian.md/) that improves scrolling by following the cursor, remembering the scroll position and more.

Feel free to contribute or leave a star if you like this plugin :)

---

## Features

Each feature is fully optional and can be toggled or configured in the plugin settings.

#### Scroll follows cursor

- By default, Obsidian only scrolls when the cursor reaches the edge of the viewport.
- This feature automatically scrolls the view to keep the text cursor near the center while editing or navigating.
- Also known as '_typewriter mode_' or similar to '_scrolloff_' in Vim.
- Can be used together with '_Cursor follows scroll_'.

#### Cursor follows scroll (Desktop only)

- Normally, Obsidian allows the text cursor to move out of view when scrolling with the mouse or touchpad.
- With this feature enabled, the text cursor is automatically moved to stay within view as you scroll.
- Can be used together with '_Scroll follows cursor_'.

#### Remember Scroll Position

- By default, Obsidian will always open files and place you at the top.
- This feature saves your scroll position when closing a file and restores it when reopening the file later.

#### Scrollbar Customization

- Customize when the scrollbar is shown or hidden.
- Optionally enable individual scrollbars.

#### Mouse & Touchpad Scrolling (Experimental, Desktop only)

- Change the speed and smoothness of scrolling with mouse and touchpad.

---

## Installation

1. In Obsidian, open **Settings → Community Plugins**.
2. Make sure Safe Mode is turned off to enable plugin installation.
3. Click **Browse**, then search for **"Scrolling"** or open directly:<br>**obsidian://show-plugin?id=scrolling**
4. Click **Install**, then **Enable** the plugin.
5. You can configure this plugin under **Settings → Community Plugins → Scrolling**.

### Manual installation

1. Open your vault in your terminal and navigate into *.obsidian/plugins*.
2. Clone the repo:
   ```sh
   git clone https://github.com/omeyenburg/obsidian-scrolling.git
   ```
3. Build the plugin:
   ```sh
   cd obsidian-scrolling
   npm install
   npm run build
   ```
4. Enable the plugin under **Community Plugins**.

### Requirements

- Obsidian: Version 1.2.7 or higher
- Platform: Desktop only

## Changelog

See [Releases](https://github.com/omeyenburg/obsidian-scrolling/releases) for version history.

## Contributing

Contributions are welcome! Feel free to open an issue or submit a pull request.

To start developing:
1. Follow the [Manual installation](#manual-installation) steps.
2. Run the plugin in development mode, which will automatically rebuild the plugin on file changes:
   ```sh
   npm run dev
   ```
3. Run tests:
   ```sh
   npm run test
   ```

## Similar projects

- [Obsidian Scroll Speed](https://github.com/flolu/obsidian-scroll-speed)
- [Obsidian Scroll Offset](https://github.com/lijyze/scroll-offset)
- [Obsidian Scroll Control](https://github.com/zxai-io/obsidian-scroll-control)

## License

MIT License. See [LICENSE](LICENSE) for details.
