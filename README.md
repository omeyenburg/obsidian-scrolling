# Scrolling

A plugin for [Obsidian](https://obsidian.md/) that improves scrolling by following the cursor, remembering the scroll position and more.

Feel free to contribute or leave a star if you like this plugin :)

---

## Features

Each feature can be toggled and configured individually via the plugin settings.

#### Follow Cursor

- Scrolls automatically while editing or navigating in a file.
- Also known as _typewriter mode_ or _`scrolloff`_ in vim.

#### Remember Scroll Position

- Saves your scroll position when closing a file.
- Restores it when reopening the file later.

#### Scrollbar Customization

- Change the appearance of scrollbars.
- Add or remove individual scrollbars.
- Show scrollbars only when necessary.

#### Mouse & Touchpad Scrolling

- Customize mouse wheel and touchpad behavior.

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
   ```
   git clone https://github.com/omeyenburg/obsidian-scrolling.git
   ```
3. Build the plugin:
   ```
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
   ```
   npm run dev
   ```

## Similar projects

- [Obsidian Scroll Speed](https://github.com/flolu/obsidian-scroll-speed)
- [Obsidian Scroll Offset](https://github.com/lijyze/scroll-offset)
- [Obsidian Scroll Control](https://github.com/zxai-io/obsidian-scroll-control)

## License

MIT License. See [LICENSE](LICENSE) for details.
