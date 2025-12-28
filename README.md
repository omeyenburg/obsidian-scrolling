# Scrolling

A plugin to improve and extend scrolling and navigation in [Obsidian](https://obsidian.md/) with quality-of-life features such as:

- **Centered Cursor**: Keep cursor centered while editing
- **Code Wrapping**: Disable code wrapping & allow horizontal scrolling
- **Remember Scroll Position**: Auto-save and restore scroll/cursor position
- **Image Zooming**: Scroll to zoom images with Ctrl key
- **MathJax**: Allow horizontal scrolling of long inline MathJax
- **File Tree**: Allow horizontal scrolling in the file tree
- **Line Length**: Customize maximum line width for readability
- **Scrollbars**: Hide, show, or auto-show scrollbars
- **Reading Mode Keybinds**: Vim-like navigation in reading mode
- **Mouse & Touchpad Scrolling**: Customize mouse & touchpad scroll speed

All features are **optional** and **fully configurable** in plugin settings.

## Features

### Centered Cursor

- Automatically scrolls the view to keep the text cursor near the center while editing or navigating
- Also known as 'typewriter mode', 'cursor surrounding lines' in VSCode or 'scrolloff' in Vim
- Configurable trigger distance and animation smoothness
- Works seamlessly with Markdown tables and Vim mode

<img src="https://raw.githubusercontent.com/omeyenburg/obsidian-scrolling/refs/heads/master/preview/followcursor.webp" alt="Centered cursor preview" style="max-width: 640px; width: 100%; height: auto;">

### Code Wrapping

- Disable code wrapping and allow horizontal scrolling
- Works in both source mode and preview mode

<img src="https://raw.githubusercontent.com/omeyenburg/obsidian-scrolling/refs/heads/master/preview/codeblock.webp" alt="Code blocks preview" style="max-width: 640px; width: 100%; height: auto;">

### Remember Scroll Position

- Saves your scroll or cursor position when closing a file
- Restores the position when reopening the file later
- Works for Markdown files, PDF files, and canvases

<img src="https://raw.githubusercontent.com/omeyenburg/obsidian-scrolling/refs/heads/master/preview/restorescroll.webp" alt="Restore scroll preview" style="max-width: 640px; width: 100%; height: auto;">

### Image Zooming

- Hover over an image, hold Ctrl and scroll to zoom in where your mouse points
- Desktop only

<img src="https://raw.githubusercontent.com/omeyenburg/obsidian-scrolling/refs/heads/master/preview/imagezoom.webp" alt="Image zoom preview" style="max-width: 640px; width: 100%; height: auto;">

### Horizontal Scrolling of Inline MathJax

- Make inline MathJax expressions scrollable
- This prevents long formulas from extending the viewport

<img src="https://raw.githubusercontent.com/omeyenburg/obsidian-scrolling/refs/heads/master/preview/mathjax.webp" alt="MathJax preview" style="max-width: 640px; width: 100%; height: auto;">

### Horizontal Scrolling in File Tree

- Allow horizontal scrolling in the file tree to see long file names
- Desktop only

<img src="https://raw.githubusercontent.com/omeyenburg/obsidian-scrolling/refs/heads/master/preview/filetree.webp" alt="Filetree preview" style="max-width: 640px; width: 100%; height: auto;">

### Scrollbar Customization

- Adjust visibility: always show, show while scrolling, or hide
- Adjust scrollbar width (Linux only)

### Line Length

- Set the maximum line length as pixels, characters or percentage

<img src="https://raw.githubusercontent.com/omeyenburg/obsidian-scrolling/refs/heads/master/preview/linelength.webp" alt="Line length preview" style="max-width: 640px; width: 100%; height: auto;">

### Reading Mode Keybinds

Enable Vim-like keybinds in reading mode:

- **j** - Scroll down one line
- **k** - Scroll up one line
- **d** - Scroll down half a page
- **u** - Scroll up half a page
- **G** - Jump to bottom
- **g** - Jump to top

### Mouse & Touchpad Scrolling

- Adjust scroll speed and smoothness for mouse and touchpad
- Desktop only

## Installation

### From Obsidian Community Plugins

1. Open **Settings → Community Plugins** in Obsidian
2. Click **Browse** and search for **"Scrolling"**  
   Or open directly: **obsidian://show-plugin?id=scrolling**
3. Click **Install**, then **Enable**
4. Configure the plugin under **Settings → Community Plugins → Scrolling**

### Manual Installation

```sh
# Navigate to your vault's plugin directory
cd /path/to/vault/.obsidian/plugins

# Clone the repository
git clone https://github.com/omeyenburg/obsidian-scrolling.git

# Install dependencies and build
cd obsidian-scrolling
npm install
npm run build
```

Then enable the plugin under **Community Plugins** in Obsidian.

## Changelog

See [Releases](https://github.com/omeyenburg/obsidian-scrolling/releases) for version history.

## Contributing

Contributions are welcome! Feel free to open an issue or submit a pull request. See [CONTRIBUTING](CONTRIBUTING.md) for further information.

## Similar Projects

If you're interested in scrolling enhancements, you might also like:

- [Obsidian Scroll Speed](https://github.com/flolu/obsidian-scroll-speed)
- [Obsidian Scroll Offset](https://github.com/lijyze/scroll-offset)
- [Obsidian Scroll Control](https://github.com/zxai-io/obsidian-scroll-control)
- [Typewriter Mode for Obsidian](https://github.com/davisriedel/obsidian-typewriter-mode)
- [Typewriter Scroll Obsidian Plugin](https://github.com/deathau/cm-typewriter-scroll-obsidian)

## License

MIT License. See [LICENSE](LICENSE) for details.
