import { Platform, Editor, MarkdownView } from "obsidian";

import type { default as ScrollingPlugin } from "./main";

export class ImageZoom {
    private readonly plugin: ScrollingPlugin;

    private zoomedImages: Set<HTMLElement> = new Set();

    private readonly SMALL_ZOOM_FACTOR = 1.07;
    private readonly LARGE_ZOOM_FACTOR = 1.2;
    private readonly MIN_SCALE = 1;
    private readonly MAX_SCALE = 100;

    constructor(plugin: ScrollingPlugin) {
        this.plugin = plugin;

        this.updateStyles();

        plugin.register(() => document.body.classList.remove("scrolling-image-zoom-enabled"));
    }

    public updateStyles() {
        if (this.plugin.settings.imageZoomEnabled) {
            document.body.classList.add("scrolling-image-zoom-enabled");
        } else {
            document.body.classList.remove("scrolling-image-zoom-enabled");
        }
    }

    /**
     * On view update.
     * When editing the line with an image, cropping breaks.
     * Will reset zoom.
     */
    public viewUpdateHandler(editor: Editor, isEdit: boolean) {
        if (!isEdit) return;
        if (Platform.isMobile) return;
        this.resetZoom(editor);
    }

    /**
     * On markdown container resize.
     * After resize cropping breaks.
     * Will reset zoom.
     */
    public resizeHandler() {
        if (Platform.isMobile) return;
        const view = this.plugin.app.workspace.getActiveViewOfType(MarkdownView);
        if (!view) return;
        this.resetZoom(view.editor);
    }

    /**
     * On wheel event. Desktop only.
     * While hovering over an image, this will zoom if the zoom guesture is used or the user scrolles while pressing ctrl.
     * Returns true if the wheel event is handled successfully.
     */
    public wheelHandler(event: WheelEvent): boolean {
        if (!this.plugin.settings.imageZoomEnabled) return false;

        const target = event.target as HTMLElement;
        if (target.localName !== "img") return false;

        // Zoom guesture is sent as wheel event with ctrlKey set to true.
        if (!event.ctrlKey || event.shiftKey) return false;

        const oldScale = Number.parseFloat(target.style.scale) || this.MIN_SCALE;

        const zoomFactor =
            Math.abs(event.deltaY) < 100 ? this.SMALL_ZOOM_FACTOR : this.LARGE_ZOOM_FACTOR;

        let scale: number;
        if (event.deltaY < 0) {
            scale = Math.min(this.MAX_SCALE, oldScale * zoomFactor);
        } else {
            scale = Math.max(this.MIN_SCALE, oldScale / zoomFactor);
        }

        const imageRect = target.getBoundingClientRect();
        const parentRect = target.parentElement.getBoundingClientRect();

        let originalLeft: number;
        let originalTop: number;

        const view = this.plugin.app.workspace.getActiveFileView();
        const viewType = view.getViewType();
        if (viewType === "markdown") {
            if (target.parentElement.previousElementSibling?.localName === "div") {
                // x, y and height of parentRect match original image
                const originalHeight = parentRect.height;
                const originalWidth = (originalHeight * imageRect.width) / imageRect.height;

                originalTop = parentRect.top;
                originalLeft = parentRect.left;

                target.parentElement.style.clipPath = `inset(0 ${parentRect.width - originalWidth}px 0 0)`;
            } else {
                // x and width of parentRect match original image
                const originalBottom = parentRect.bottom;
                const originalHeight = (parentRect.width * imageRect.height) / imageRect.width;

                originalTop = originalBottom - originalHeight;
                originalLeft = parentRect.left;

                target.parentElement.style.clipPath = `inset(-${originalHeight - parentRect.height}px 0 0 0)`;
            }

            this.zoomedImages.add(target);
        } else if (viewType === "image") {
            // y and height of parentRect match original image
            const originalHeight = parentRect.height;
            const originalWidth = (originalHeight * imageRect.width) / imageRect.height;

            originalTop = parentRect.top;
            originalLeft = parentRect.left + parentRect.width / 2 - originalWidth / 2;
        } else return;

        const mouseX = event.clientX - originalLeft;
        const mouseY = event.clientY - originalTop;

        const translateX = (1 / scale - 1) * mouseX;
        const translateY = (1 / scale - 1) * mouseY;

        target.style.scale = `${scale}`;
        target.style.transform = `translate(${translateX}px, ${translateY}px)`;

        event.preventDefault();

        return true;
    }

    /**
     * Reset the zoom of all registered images.
     */
    private resetZoom(editor: Editor) {
        editor.cm.requestMeasure({
            key: "reset-image-zoom",
            read: (_view) => {},
            write: (_measure, _view) => {
                if (!this.zoomedImages) return;
                this.zoomedImages.forEach((el: HTMLElement) => {
                    el.style.scale = "";
                    el.style.transform = "";
                    el.parentElement.style.clipPath = "";
                });
                this.zoomedImages.clear();
            },
        });
    }
}
