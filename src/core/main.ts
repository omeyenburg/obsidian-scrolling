import { Plugin } from "obsidian";

import { CodeBlock } from "@components/codeblock";
import { FileTree } from "@components/filetree";
import { MathJax } from "@components/mathjax";
import { FollowCursor } from "@components/followcursor";
import { FollowScroll } from "@components/followscroll";
import { MouseScroll } from "@components/mousescroll";
import { RestoreScroll } from "@components/restorescroll";
import { Scrollbar } from "@components/scrollbar";
import { PreviewScrollKeys } from "@components/previewscrollkeys";
import { ImageZoom } from "@components/imagezoom";
import { LineLength } from "@components/linelength";
import { Commands } from "@components/commands";

import { Events } from "@core/events";
import { ScrollingSettingTab, ScrollingPluginSettings, DEFAULT_SETTINGS } from "@core/settings";

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
    previewScrollKeys!: PreviewScrollKeys;
    imageZoom!: ImageZoom;
    lineLength!: LineLength;
    commands!: Commands;

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
        this.previewScrollKeys = new PreviewScrollKeys(this);
        this.imageZoom = new ImageZoom(this);
        this.lineLength = new LineLength(this);
        this.commands = new Commands(this);

        this.events = new Events(this);

        await this.restoreScroll.loadStatesFile();

        console.log("ScrollingPlugin loaded");
    }

    async onunload() {
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
