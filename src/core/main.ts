import { Plugin } from "obsidian";

import { CodeBlock } from "@components/codeblock";
import { FileTree } from "@components/filetree";
import { MathJax } from "@components/mathjax";
import { FollowCursor } from "@components/followcursor";
import { MouseScroll } from "@components/mousescroll";
import { RestoreScroll } from "@components/restorescroll";
import { Scrollbar } from "@components/scrollbar";
import { PreviewScrollKeys } from "@components/previewscrollkeys";
import { LineLength } from "@components/linelength";
import { Commands } from "@components/commands";
import { ScrollButtons } from "@components/scrollbuttons";

import { Events } from "@core/events";
import { ScrollingSettingTab, ScrollingPluginSettings, DEFAULT_SETTINGS } from "@core/settings";

export default class ScrollingPlugin extends Plugin {
    settings: ScrollingPluginSettings;
    events!: Events;

    codeBlock!: CodeBlock;
    fileTree!: FileTree;
    mathJax!: MathJax;
    followCursor!: FollowCursor;
    mouseScroll!: MouseScroll;
    restoreScroll!: RestoreScroll;
    scrollbar!: Scrollbar;
    previewScrollKeys!: PreviewScrollKeys;
    lineLength!: LineLength;
    commands!: Commands;
    scrollButtons!: ScrollButtons;

    async onload() {
        await this.loadSettings();
        this.addSettingTab(new ScrollingSettingTab(this));

        this.events = new Events(this);

        this.codeBlock = new CodeBlock(this);
        this.fileTree = new FileTree(this);
        this.mathJax = new MathJax(this);
        this.followCursor = new FollowCursor(this);
        this.mouseScroll = new MouseScroll(this);
        this.restoreScroll = new RestoreScroll(this);
        this.scrollbar = new Scrollbar(this);
        this.previewScrollKeys = new PreviewScrollKeys(this);
        this.lineLength = new LineLength(this);
        this.commands = new Commands(this);
        this.scrollButtons = new ScrollButtons(this);

        this.events.postInit();

        await this.restoreScroll.loadStatesFile();
    }

    onunload() {
        this.events.unload();
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

    getMainDoc(): Document {
        return this.app.workspace.containerEl.ownerDocument;
    }

    enableStyleClass(name: string | string[]) {
        if (Array.isArray(name)) {
            for (const n of name) {
                this.getMainDoc().body.addClass(n);
            }
        } else {
            this.getMainDoc().body.addClass(name);
        }
    }

    disableStyleClass(name: string | string[]) {
        if (Array.isArray(name)) {
            for (const n of name) {
                this.getMainDoc().body.removeClass(n);
            }
        } else {
            this.getMainDoc().body.removeClass(name);
        }
    }

    setStyleProperty(key: string, value: string) {
        this.getMainDoc().body.style.setProperty(key, value);
    }

    removeStyleProperty(key: string) {
        this.getMainDoc().body.style.removeProperty(key);
    }
}
