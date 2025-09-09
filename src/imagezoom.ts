import type { default as ScrollingPlugin } from "./main";

export class ImageZoom {
    private readonly plugin: ScrollingPlugin;

    private readonly ZOOM_FACTOR = 1.05; // TODO: !
    private readonly MIN_SCALE = 1;
    private readonly MAX_SCALE = 100;

    constructor(plugin: ScrollingPlugin) {
        this.plugin = plugin;
    }

    public wheelHandler(event: WheelEvent): boolean {
        if (!this.plugin.settings.imageZoomEnabled) return false;

        const target = event.target as HTMLElement;
        if (target.localName !== "img") return false;

        // Zoom guesture is sent as wheel event with ctrlKey set to true.
        if (!event.ctrlKey || event.shiftKey) return false;

        const oldScale = Number.parseFloat(target.style.scale) || this.MIN_SCALE;

        /*
        const oldTransform = target.style.transform;
        const oldTranslate = oldTransform.match(/^translate\(([-.0-9]+)px, ([-.0-9]+)px\)/);

        let oldTranslateX = 0;
        let oldTranslateY = 0;
        if (oldTranslate) {
            oldTranslateX = Number.parseFloat(oldTranslate[1]);
            oldTranslateY = Number.parseFloat(oldTranslate[2]);
        }
        */

        let scale: number;
        if (event.deltaY < 0) {
            scale = Math.min(this.MAX_SCALE, oldScale * this.ZOOM_FACTOR);
        } else {
            scale = Math.max(this.MIN_SCALE, oldScale / this.ZOOM_FACTOR);
        }

        const imageRect = target.getBoundingClientRect();
        const parentRect = target.parentElement.getBoundingClientRect();

        let originalLeft: number;
        let originalTop: number;

        const view = this.plugin.app.workspace.getActiveFileView();
        const viewType = view.getViewType();
        if (viewType === "markdown") {
            // width & x of parentRect match image width & x
            const originalBottom = parentRect.bottom;
            const originalHeight = (parentRect.width * imageRect.height) / imageRect.width;

            originalTop = originalBottom - originalHeight;
            originalLeft = parentRect.left;
        } else if (viewType === "image") {
            // height & y of parentRect match image height & y
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

        /*
        target.parentElement.style.clipPath = `inset(-100px -100px -100px -100px)`;
        */

        event.preventDefault();

        return true;
    }
}
