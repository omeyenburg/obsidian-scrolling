import { Plugin } from "obsidian";

import { CodeBlock } from "./codeblock";
import { FileTree } from "./filetree";
import { MathJax } from "./mathjax";
import { FollowCursor } from "./followcursor";
import { FollowScroll } from "./followscroll";
import { MouseScroll } from "./mousescroll";
import { RestoreScroll } from "./restorescroll";
import { Scrollbar } from "./scrollbar";
import { PreviewShortcuts } from "./previewshortcuts";
import { ImageZoom } from "./imagezoom";
import { LineLength } from "./linelength";
import { ScrollCommands } from "./scrollcommands";

import { Events } from "./events";
import { ScrollingSettingTab, ScrollingPluginSettings, DEFAULT_SETTINGS } from "./settings";

export default class ScrollingPlugin extends Plugin {
    settings: ScrollingPluginSettings;

    codeBlock!: CodeBlock;
    fileTree!: FileTree;
    mathJax!: MathJax;
    followCursor!: FollowCursor;
    followScroll!: FollowScroll;
    mouseScroll!: MouseScroll;
    restoreScroll!: RestoreScroll;
    scrollbar!: Scrollbar;
    previewShortcuts!: PreviewShortcuts;
    imageZoom!: ImageZoom;
    lineLength!: LineLength;
    scrollCommands!: ScrollCommands;

    events!: Events;

    async onload() {
        await this.loadSettings();
        this.addSettingTab(new ScrollingSettingTab(this));

        this.codeBlock = new CodeBlock(this);
        this.fileTree = new FileTree(this);
        this.mathJax = new MathJax(this);
        this.followCursor = new FollowCursor(this);
        this.followScroll = new FollowScroll(this);
        this.mouseScroll = new MouseScroll(this);
        this.restoreScroll = new RestoreScroll(this);
        this.scrollbar = new Scrollbar(this);
        this.previewShortcuts = new PreviewShortcuts(this);
        this.imageZoom = new ImageZoom(this);
        this.lineLength = new LineLength(this);
        this.scrollCommands = new ScrollCommands(this);

        this.events = new Events(this);

        await this.restoreScroll.loadData();

        console.log("ScrollingPlugin loaded");
    }

    async onunload() {
        this.restoreScroll.quitHandler();

        console.log("ScrollingPlugin unloaded");
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());

        for (const key in this.settings) {
            if (!(key in DEFAULT_SETTINGS)) {
                delete this.settings[key];
            }
        }
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }
}
