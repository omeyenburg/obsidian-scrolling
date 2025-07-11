import type { default as ScrollingPlugin } from "./main";

export class MouseScroll {
    private readonly plugin: ScrollingPlugin;

    private touchpadLastUse = 0;
    private touchpadFriction = 0;
    private touchpadVelocity = 0;
    private touchpadScrolling = false;
    private mouseLastUse = 0;
    private mouseTarget: number;
    private mouseAnimationFrame: number;

    private static readonly MAX_FRICTION = 0.98;
    private static readonly MIN_VELOCITY = 0.1;
    private static readonly COMMON_MOUSE_DELTAS = [120, 197.18010794176823];
    private static readonly TOUCHPAD_GRACE_PERIOD = 1000;
    private static readonly TOUCHPAD_DELTA_THRESHOLD = 50;

    constructor(plugin: ScrollingPlugin) {
        this.plugin = plugin;

        plugin.registerDomEvent(document, "wheel", this.wheelHandler.bind(this), {
            passive: false,
        });
    }

    // Called in main
    public activeLeafChangeHandler() {
        this.touchpadVelocity = 0;
    }

    private wheelHandler(event: WheelEvent): void {
        if (!this.plugin.settings.mouseEnabled) return;
        if (!event.deltaY) return;

        let el: HTMLElement | null = event.target as HTMLElement;

        while (el && el != document.body) {
            const { overflowY } = getComputedStyle(el);
            const allowsScrollY =
                (overflowY === "auto" || overflowY === "scroll") &&
                el.scrollHeight > el.clientHeight;

            if (allowsScrollY) {
                const delta = event.deltaMode == event.DOM_DELTA_LINE ? event.deltaY * 20 : event.deltaY;

                if (this.plugin.settings.touchpadEnabled && this.isTouchpad(event)) {
                    this.scrollWithTouchpad(el, delta);
                } else {
                    this.scrollWithMouse(el, delta);
                }

                event.preventDefault();
                return;
            }

            el = el.parentElement;
        }
    }

    private isTouchpad(event: WheelEvent): boolean {
        if (event.deltaMode !== WheelEvent.DOM_DELTA_PIXEL) {
            this.touchpadLastUse = 0;
            return false;
        }

        // Mice often return multiples of certain deltas.
        for (const delta of MouseScroll.COMMON_MOUSE_DELTAS) {
            if ((event.deltaY / delta) % 1 == 0) {
                this.touchpadLastUse = 0;
                return false;
            }
        }

        const now = performance.now();

        // Movement on both axes
        if (event.deltaX !== 0 && event.deltaY !== 0) {
            this.touchpadLastUse = now;
            return true;
        }

        // Small, fractional, non-zero delta
        if (event.deltaY % 1 !== 0 && Math.abs(event.deltaY) < MouseScroll.TOUCHPAD_DELTA_THRESHOLD) {
            this.touchpadLastUse = now;
            return true;
        }

        // Grace period
        if (now - this.touchpadLastUse < MouseScroll.TOUCHPAD_GRACE_PERIOD) {
            this.touchpadLastUse = now;
            return true;
        }

        return false;
    }

    // Really good approximation of the default scrolling in Obsidian.
    // Defaults: smoothness=150, speed=1
    private scrollWithMouse(el: HTMLElement, delta: number): void {
        if (!el) return;
        window.cancelAnimationFrame(this.mouseAnimationFrame);

        const smoothness = this.plugin.settings.mouseSmoothness * 2;
        const speed = this.plugin.settings.mouseSpeed / 50;
        const invert = this.plugin.settings.mouseInvert ? -1 : 1;

        const change = delta * speed * invert;

        const startTime = performance.now();
        if (this.mouseTarget && this.mouseLastUse && startTime - this.mouseLastUse < smoothness) {
            el.scrollTop = this.mouseTarget;
        }
        this.mouseLastUse = startTime;

        let start = el.scrollTop;
        this.mouseTarget = start + change;

        const easeOut = (t: number) => 1 - (1 - t) ** 2;

        const animateScroll = (now: number) => {
            now = performance.now();
            let t = Math.min(1, (now - startTime) / smoothness);
            t = easeOut(t);

            el.scrollTop = start + change * t;

            if (t < 1) {
                this.mouseAnimationFrame = window.requestAnimationFrame(animateScroll);
            } else {
                el.scrollTop = start + change;
            }
        };

        this.mouseAnimationFrame = window.requestAnimationFrame(animateScroll);
    }

    // Similar to touchpad scrolling in obsidian.
    // Defaults: smoothness=0.75, speed=0.25, frictionThreshold=20
    private scrollWithTouchpad(el: HTMLElement, change: number): void {
        const smoothness = this.plugin.settings.touchpadSmoothness / 100;
        const speed = this.plugin.settings.touchpadSpeed / 200;
        const frictionThreshold = this.plugin.settings.touchpadFrictionThreshold;
        const invert = this.plugin.settings.mouseInvert ? -1 : 1;

        if (this.touchpadVelocity * change < 0) {
            this.touchpadScrolling = false;
        }

        this.touchpadVelocity += change * speed * invert;

        const animate = () => {
            if (Math.abs(this.touchpadVelocity) > MouseScroll.MIN_VELOCITY) {
                el.scrollTop += this.touchpadVelocity;
                this.touchpadVelocity *= this.touchpadFriction;
                this.touchpadFriction = Math.max(
                    0,
                    Math.min(MouseScroll.MAX_FRICTION, this.touchpadFriction + 0.05),
                );
                window.requestAnimationFrame(animate);
            } else {
                this.touchpadScrolling = false;
                this.touchpadVelocity = 0;
            }
        };

        this.touchpadFriction =
            Math.min(1, (Math.abs(change) / frictionThreshold) ** 3) * smoothness;

        if (!this.touchpadScrolling) {
            this.touchpadScrolling = true;
            animate();
        }
    }
}
