# Scrolling

A plugin for [Obsidian](https://obsidian.md/) to keep the cursor centered, disable code wrapping, enable image zooming & much more.

---

## Features

Each feature is fully optional and can be toggled or configured in the plugin settings.

#### Centered cursor

- By default, Obsidian only scrolls when the cursor reaches the edge of the viewport.
- This feature automatically scrolls the view to keep the text cursor near the center while editing or navigating.  
  (Also known as 'typewriter mode' or similar to 'scrolloff' in Vim)

<img src="https://raw.githubusercontent.com/omeyenburg/obsidian-scrolling/refs/heads/master/preview/followcursor.webp" alt="Centered cursor preview" style="max-width: 640px; width: 100%; height: auto;">

#### Horizontal scrolling

##### Code blocks
- Disable wrapping and enable horizontal scrolling in code blocks.

<img src="https://raw.githubusercontent.com/omeyenburg/obsidian-scrolling/refs/heads/master/preview/codeblock.webp" alt="Code blocks preview" style="max-width: 640px; width: 100%; height: auto;">

##### Inline MathJax
- Make inline MathJax scrollable and prevent it from extending the viewport.

<img src="https://raw.githubusercontent.com/omeyenburg/obsidian-scrolling/refs/heads/master/preview/mathjax.webp" alt="MathJax preview" style="max-width: 640px; width: 100%; height: auto;">

##### File tree
- Allow horizontal scrolling in the file tree.

<img src="https://raw.githubusercontent.com/omeyenburg/obsidian-scrolling/refs/heads/master/preview/filetree.webp" alt="Filetree preview" style="max-width: 640px; width: 100%; height: auto;">

#### Remember scroll position

- By default, Obsidian will always open files and place you at the top.
- This feature saves your scroll position when closing a file and restores it when reopening the file later.

<img src="https://raw.githubusercontent.com/omeyenburg/obsidian-scrolling/refs/heads/master/preview/restorescroll.webp" alt="Restore scroll preview" style="max-width: 640px; width: 100%; height: auto;">

#### Scroll to zoom images

- Zoom into an image based on your mouse pointer position.
- Hover over an image and scroll while holding the ctrl key.

<img src="https://raw.githubusercontent.com/omeyenburg/obsidian-scrolling/refs/heads/master/preview/imagezoom.webp" alt="Image zoom preview" style="max-width: 640px; width: 100%; height: auto;">

#### Scrollbar customization

- Customize when the scrollbar is shown or hidden.

#### Line length

- Set the maximum line length as pixels, characters or percentage.
- Toggle readable line length with a command or keybind.

<img src="https://raw.githubusercontent.com/omeyenburg/obsidian-scrolling/refs/heads/master/preview/linelength.webp" alt="Line length preview" style="max-width: 640px; width: 100%; height: auto;">

#### Reading mode keybinds

- Use Vim-like keybinds to scroll in reading mode:  
  down (j), up (k), half-page down (d), half-page up (u), bottom (G), top (g)

#### Mouse & touchpad scrolling (Desktop only)

- Change the speed and smoothness of scrolling with mouse and touchpad.

---

## Installation

1. In Obsidian, open **Settings → Community Plugins**.
2. Make sure Safe Mode is turned off to enable plugin installation.
3. Click **Browse**, then search for **"Scrolling"** or open directly:  
    **obsidian://show-plugin?id=scrolling**
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
For more information, see [CONTRIBUTING](CONTRIBUTING.md).

## Similar projects

- [Obsidian Scroll Speed](https://github.com/flolu/obsidian-scroll-speed)
- [Obsidian Scroll Offset](https://github.com/lijyze/scroll-offset)
- [Obsidian Scroll Control](https://github.com/zxai-io/obsidian-scroll-control)
- [Typewriter Mode for Obsidian](https://github.com/davisriedel/obsidian-typewriter-mode)
- [Typewriter Scroll Obsidian Plugin](https://github.com/deathau/cm-typewriter-scroll-obsidian)

## License

MIT License. See [LICENSE](LICENSE) for details.
