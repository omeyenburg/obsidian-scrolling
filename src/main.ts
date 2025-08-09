import { Plugin } from "obsidian";

import { Events } from "./events";
import { FollowCursor } from "./followcursor";
import { CursorScroll } from "./cursorscroll";
import { CodeScroll } from "./codescroll";
import { MouseScroll } from "./mousescroll";
import { Scrollbar } from "./scrollbar";
import { RestoreScroll } from "./restorescroll";
import { ScrollingSettingTab, ScrollingPluginSettings, DEFAULT_SETTINGS } from "./settings";

export default class ScrollingPlugin extends Plugin {
    settings: ScrollingPluginSettings;

    restoreScroll!: RestoreScroll;
    cursorScroll!: CursorScroll;
    followCursor!: FollowCursor;
    mouseScroll!: MouseScroll;
    scrollbar!: Scrollbar;
    codeScroll!: CodeScroll;
    events!: Events;

    async onload() {
        await this.loadSettings();
        this.addSettingTab(new ScrollingSettingTab(this));

        this.restoreScroll = new RestoreScroll(this);
        this.cursorScroll = new CursorScroll(this);
        this.followCursor = new FollowCursor(this);
        this.mouseScroll = new MouseScroll(this);
        this.scrollbar = new Scrollbar(this);
        this.codeScroll = new CodeScroll(this);
        this.events = new Events(this);

        await this.restoreScroll.loadData();

        console.log("ScrollingPlugin loaded");
    }

    async onunload() {
        this.scrollbar?.removeStyle();
        this.restoreScroll.quitHandler();

        this.codeScroll.unload();

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
