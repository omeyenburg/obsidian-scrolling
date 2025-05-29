# Obsidian Scrolling

A plugin for [Obsidian](https://obsidian.md/) that enhances scrolling behavior with intelligent cursor tracking, smooth mouse wheel animations, and customizable scrollbar styling.

## Features

Each feature can be toggled individually via the plugin's settings panel.

- **Smart Scrolling**<br>
Automatically centers the cursor during editing and navigation for improved focus and readability.
- **Scrollbar Customization**<br>
Provides visual customization options for scrollbar appearance to match your theme preferences.
- **Enhanced Mouse & Touchpad Scrolling**<br>
Smooths mouse wheel and trackpad scrolling with customizable animations for a more fluid editing experience.

## Installation

Currently there are two methods of installation.

### Manual installation (Prebuilt release)

1. Go to the latest release on this repo and download `main.js` and `manifest.json`.
2. Move the downloaded files to your vault `VaultFolder/.obsidian/plugins/obsidian-scrolling/`.
3. Enable the plugin under community plugins.

### Manual installation (From source)

1. Make sure you have git and npm installed.
2. Open your vault in your terminal and navigate into .obsidian/plugins.
3. Run `git clone https://github.com/omeyenburg/obsidian-scrolling.git`.
4. Navigate into obsidian-scrolling and run `npm install` and `npm run build`.
6. Enable the plugin under community plugins.

## Requirements

- Obsidian: Version 1.2.7 or higher
- Platform: Desktop only

## Usage

Once enabled, go to Settings -> Community Plugins -> Scrolling to configure the plugin.

<details>
<summary><strong>Configuration Reference</strong> (click to expand)</summary>

### Smart scrolling

- **Mode**<br>
**Follow cursor**: Smoothly keeps text cursor within a comfortable zone while moving or editing.<br>
Behaves similarly to Vim's `scrolloff` option.<br>
**Page jumping**: Reduces scrolling by jumping whole pages at screen edges.<br>
Best paired with high center radius and longer animation.<br>
Default: Follow cursor

    - **Scroll zone radius when editing**<br>
    Defines how far the cursor can move from the center before scrolling.<br>
    Default: 75

    - **Scroll smoothness when editing**<br>
    Adjusts how fast or slow the scrolling animation is when editing moves the cursor.<br>
    Default: 25

    - **Scroll zone radius when moving cursor**<br>
    Defines how far you can move the cursor from the center before scrolling.<br>
    Default: 75

    - **Scroll smoothness when moving cursor**<br>
    Adjusts how fast or slow the scrolling animation is when you move the cursor.<br>
    Default: 25

    - **Dynamic animations**<br>
    Skip animation frames if lots of scroll events occur for smoother animations.<br>
    Default: enabled

    - **Invoke on mouse-driven cursor movement**<br>
    Apply this feature when the text cursor is moved with the mouse.<br>
    Default: disabled

        - **Invoke on mouse selection**<br>
        Also trigger, when the mouse has selected text.<br>
        Default: disabled

### Scrollbar appearance

- **Apply to all scrollbars**<br>
Whether scrollbar settings apply to all scrollbars or only markdown files.
Windows & Linux only.<br>
Default: disabl

- **Scrollbar visibility**<br>
When to show scrollbars.
Windows & Linux only.<br>
Default: always

- **Scrollbar thickness**<br>
Width in pixels.
Linux only.<br>
Default: 12

### Mouse/Touchpad scrolling (Experimental)

- **Enabled**<br>
Whether mouse/touchpad scrolling settings are applied.<br>
Default: enabled

    - **Invert scroll direction**<br>
    Reverses the scroll direction for both mouse and touchpad.<br>
    Default: disabled

    - **Mouse scroll speed**<br>
    Scroll speed multiplier for mouse wheel.<br>
    Default: 50

    - **Mouse scroll smoothness**<br>
    Determines mouse scroll smoothness.<br>
    Default: 75

    - **Touchpad detection**<br>
    Detect touchpad input to provide smoother scrolling. (Should work well with most devices)<br>
    Default: enabled

        - **Touchpad scroll speed**<br>
        Adjusts scroll speed when using a touchpad.<br>
        Default: 50

        - **Touchpad smoothness**<br>
        Controls the smoothness of touchpad.<br>
        Default: 75

        - **Touchpad friction threshold**<br>
        Sets the minimum speed below which increased friction is applied for finer control.<br>
        Default: 20

</details>

## Contributing

Contributions are welcome! Feel free to open an issue or submit a pull request.
You can follow the [manual installation](#manual-installation-from-source) guide to build this plugin.

## Similar projects

- [Obsidian Scroll Speed](https://github.com/flolu/obsidian-scroll-speed)
- [Obsidian Scroll Offset](https://github.com/lijyze/scroll-offset)
- [Obsidian Scroll Control](https://github.com/zxai-io/obsidian-scroll-control)

## License

MIT License. See [LICENSE](LICENSE) for details.
