# Scrolling

A plugin for [Obsidian](https://obsidian.md/) that enhances scrolling behavior with smart cursor tracking and smooth scroll animations.

Feel free to contribute or leave a star if you find this plugin useful ⭐

## Features

Each feature can be toggled and configured individually via the plugin settings.

- **Smart Scrolling**<br>Scrolls automatically while editing or navigating in a file. (Similar to "Typewriter mode" and Vim's `scrolloff` option)
- **Remember Scroll Position**<br>Stores your position in a file when closing and restores it when opening.
- **Scrollbar Customization**<br>Lets you change the appearance and behavior of scrollbars.
- **Mouse & Touchpad Scrolling**<br>Allows you to customize mouse wheel and touchpad scrolling.

## Installation

1. In Obsidian, open **Settings → Community Plugins**.
2. Make sure Safe Mode is turned off to enable plugin installation
3. Click Browse, then search for **"Scrolling"** or open directly:<br>**obsidian://show-plugin?id=scrolling**
4. Click Install, then Enable the plugin.

### Manual installation

1. Make sure you have git and npm installed.
2. Open your vault in your terminal and navigate into *.obsidian/plugins*.
3. Run `git clone https://github.com/omeyenburg/obsidian-scrolling.git`.
4. Navigate into obsidian-scrolling and run `npm install` and `npm run build`.
5. Enable the plugin under community plugins.

## Requirements

- Obsidian: Version 1.2.7 or higher
- Platform: Desktop only

## Usage

Once enabled, go to **Settings → Community Plugins → Scrolling** to configure the plugin.

<details>
<summary><strong>Configuration Reference</strong> (click to expand)</summary>

### Smart scrolling

- **Mode** (Default: Follow cursor)<br>- **Disabled**: Disables this feature.<br>- **Follow cursor**: Keeps the text cursor smoothly within a comfortable zone.<br>Also known as "Typewriter mode" or "Scrolloff".<br>- **Page jumping**: Reduces scrolling by jumping by whole pages at screen edges.<br>Best used with a trigger distance.
    - **Trigger distance** (Default: 75)<br>Defines at which distance from the center scrolling is triggered.
    - **Animation duration** (Default: 25)<br>Adjusts the speed of the scrolling animation.
    - **Dynamic animations** (Default: enabled)<br>If many scroll events happen quickly, skips animation frames to improve responsiveness.
    - **Enable for mouse interactions** (Default: disabled)<br>Triggers scrolling when the text cursor is moved with the mouse.
        - **Invoke on mouse selection** (Default: disabled)<br>Also triggers scrolling when the mouse selects text.

### Remember Scroll Position

- **Enabled** (Default: disabled)<br>Saves your scroll position before closing a file and restores it when opening the file again.

### Scrollbar appearance

- **Show horizontal scrollbar in file tree** (Default: disabled)<br>Enables horizontal scrolling and shows a scrollbar in the file tree.
- **Scrollbar visibility** (Default: Always show scrollbar)<br>When to show the scrollbar in markdown/pdf files: always, while scrolling or never. *(Platform: Windows & Linux only)*
- **Scrollbar thickness** (Default: 12)<br>Sets the width of scrollbars in pixels. *(Platform: Linux only)*

### Mouse/Touchpad scrolling (Experimental)

- **Enabled** (Default: enabled)<br>Enables custom scroll behavior for mouse and touchpad input.
    - **Invert scroll direction** (Default: disabled)<br>Reverses the scroll direction.
    - **Mouse scroll speed** (Default: 50)<br>Sets the scroll speed multiplier.
    - **Mouse scroll smoothness** (Default: 75)<br>Determines mouse scroll smoothness.
    - **Touchpad detection** (Default: enabled)<br>Detect touchpad input to provide smoother scrolling. *(Should work well with most devices)*
        - **Touchpad scroll speed** (Default: 50)<br>Adjusts scroll speed when using a touchpad.
        - **Touchpad smoothness** (Default: 75)<br>Controls scroll animation smoothness for touchpads.
        - **Touchpad friction threshold** (Default: 20)<br>Sets the minimum scroll strength below which increased friction is applied for finer control.

</details>

## Contributing

Contributions are welcome! Feel free to open an issue or submit a pull request.

## Similar projects

- [Obsidian Scroll Speed](https://github.com/flolu/obsidian-scroll-speed)
- [Obsidian Scroll Offset](https://github.com/lijyze/scroll-offset)
- [Obsidian Scroll Control](https://github.com/zxai-io/obsidian-scroll-control)

## License

MIT License. See [LICENSE](LICENSE) for details.
