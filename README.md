# Scrolling

A plugin for [Obsidian](https://obsidian.md/) that enhances scrolling behavior with smart cursor tracking and smooth scroll animations.

Feel free to contribute & leave a star if you like this plugin ;)

## Features

Each feature can be toggled and configured individually via the plugin's settings.

- **Smart Scrolling**<br>
Scrolls automatically while editing or navigating in a file.
- **Scrollbar Customization**<br>
Lets you hide the scrollbar or adjust its width.
- **Mouse & Touchpad Scrolling**<br>
Allows you to customize mouse wheel and touchpad scrolling.

## Installation

1. In Obsidian, open **Settings → Community Plugins**.
2. Make sure Safe Mode is turned off.
3. Click Browse, then search for **"Scrolling"** or open directly:<br>
   **obsidian://show-plugin?id=scrolling**
5. Click Install, then Enable the plugin.

### Manual installation

1. Make sure you have git and npm installed.
2. Open your vault in your terminal and navigate into *.obsidian/plugins*.
3. Run `git clone https://github.com/omeyenburg/obsidian-scrolling.git`.
4. Navigate into obsidian-scrolling and run `npm install` and `npm run build`.
6. Enable the plugin under community plugins.

## Requirements

- Obsidian: Version 1.2.7 or higher
- Platform: Desktop only

## Usage

Once enabled, go to **Settings → Community Plugins → Scrolling** to configure the plugin.

<details>
<summary><strong>Configuration Reference</strong> (click to expand)</summary>

### Smart scrolling

- **Mode**<br>
**Follow cursor**: Smoothly keeps text cursor within a comfortable zone while moving or editing.<br>
Behaves similarly to Vim's `scrolloff` option.<br>
**Page jumping**: Reduces scrolling by jumping by whole pages at screen edges.<br>
Best paired with high center radius and longer animation.<br>
→ Default: Follow cursor
    - **Scroll zone radius when editing**<br>
    Defines how far the cursor can move from the center before scrolling.<br>
    → Default: 75
    - **Scroll smoothness when editing**<br>
    Adjusts how fast or slow the scrolling animation is when editing moves the cursor.<br>
    → Default: 25
    - **Scroll zone radius when moving cursor**<br>
    Defines how far you can move the cursor from the center before scrolling.<br>
    → Default: 75
    - **Scroll smoothness when moving cursor**<br>
    Adjusts how fast or slow the scrolling animation is when you move the cursor.<br>
    → Default: 25
    - **Dynamic animations**<br>
    Skip animation frames if lots of scroll events occur for smoother animation.<br>
    → Default: enabled
    - **Invoke on mouse-driven cursor movement**<br>
    Apply this feature when the text cursor is moved with the mouse.<br>
    → Default: disabled
        - **Invoke on mouse selection**<br>
        Also trigger when the mouse has selected text.<br>
        → Default: disabled

### Scrollbar appearance

- **Apply to all scrollbars**<br>
Whether scrollbar settings should apply to all scrollbars or only markdown files. (Platform: Windows & Linux only)<br>
→ Default: disabled
- **Scrollbar visibility**<br>
Show scrollbars always, while scrolling or never. (Platform: Windows & Linux only)<br>
→ Default: Always show scrollbars
- **Scrollbar thickness**<br>
Width in pixels. (Platform: Linux only)<br>
→ Default: 12

### Mouse/Touchpad scrolling (Experimental)

- **Enabled**<br>
Whether mouse/touchpad scrolling settings are applied.<br>
→ Default: enabled
    - **Invert scroll direction**<br>
    Reverse the scroll direction for both mouse and touchpad.<br>
    → Default: disabled
    - **Mouse scroll speed**<br>
    Scroll speed multiplier for mouse wheel.<br>
    → Default: 50
    - **Mouse scroll smoothness**<br>
    Determines mouse scroll smoothness.<br>
    → Default: 75
    - **Touchpad detection**<br>
    Detect touchpad input to provide smoother scrolling. (Should work well with most devices)<br>
    → Default: enabled
        - **Touchpad scroll speed**<br>
        Adjusts scroll speed when using a touchpad.<br>
        → Default: 50
        - **Touchpad smoothness**<br>
        Controls the smoothness of touchpad.<br>
        → Default: 75
        - **Touchpad friction threshold**<br>
        Sets the minimum scroll strength below which increased friction is applied for finer control.<br>
        → Default: 20

</details>

## Contributing

Contributions are welcome! Feel free to open an issue or submit a pull request.

## Similar projects

- [Obsidian Scroll Speed](https://github.com/flolu/obsidian-scroll-speed)
- [Obsidian Scroll Offset](https://github.com/lijyze/scroll-offset)
- [Obsidian Scroll Control](https://github.com/zxai-io/obsidian-scroll-control)

## License

MIT License. See [LICENSE](LICENSE) for details.
