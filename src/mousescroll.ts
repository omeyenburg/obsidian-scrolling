import type { default as ScrollingPlugin } from "./main";

export class MouseScroll {
    private plugin: ScrollingPlugin;

    constructor(plugin: ScrollingPlugin) {
        this.plugin = plugin;

        plugin.registerDomEvent(document, "wheel", (e: WheelEvent) => this.wheelHandler(e), {
            passive: false,
        });
    }

    wheelHandler(event: WheelEvent) {
        if (!this.plugin.settings.mouseScrollEnabled) return;
        if (!event.deltaY) return;

        let el: HTMLElement | null = event.target as HTMLElement;

        while (el && el != document.body) {
            const { overflowY } = getComputedStyle(el);
            const allowsScrollY =
                (overflowY === "auto" || overflowY === "scroll") &&
                el.scrollHeight > el.clientHeight;

            if (allowsScrollY) {
                var delta = event.deltaY;
                if (event.deltaMode == event.DOM_DELTA_LINE) {
                    delta *= 20;
                }

                if (this.isTrackpad(event)) {
                    this.scrollWithTrackpad(el, delta);
                } else {
                    this.scrollWithMouse(el, delta);
                }

                event.preventDefault();
                return;
            }

            el = el.parentElement;
        }
    }

    private lastTrackpadUse: number = 0;
    isTrackpad(event: WheelEvent): boolean {
        if (event.deltaMode !== WheelEvent.DOM_DELTA_PIXEL) {
            this.lastTrackpadUse = 0;
            return false;
        }

        const commonDeltas = [120, 197.18010794176823];
        for (const delta of commonDeltas) {
            if ((event.deltaY / delta) % 1 == 0) {
                this.lastTrackpadUse = 0;
                return false;
            }
        }

        const now = performance.now();

        // Movement on both axes
        if (event.deltaX !== 0 && event.deltaY !== 0) {
            this.lastTrackpadUse = now;
            return true;
        }

        // Small, fractional, non-zero delta
        if (event.deltaY % 1 !== 0 && Math.abs(event.deltaY) < 50) {
            this.lastTrackpadUse = now;
            return true;
        }

        // Grace period
        if (now - this.lastTrackpadUse < 1000) {
            this.lastTrackpadUse = now;
            return true;
        }

        return false;
    }

    // This works exactly as in Obsidian!
    // Call with `this.scrollWithMouseNotTrackpad(el, event.deltaY)`
    // No additional multiplier for deltaY needed. Default duration is 150!
    private mouseScrollAnimation: number;
    private mouseScrollTarget: number;
    private lastMouseScroll: number;
    scrollWithMouse(el: HTMLElement, change: number) {
        if (!el) return;
        cancelAnimationFrame(this.mouseScrollAnimation);

        const duration = 150;
        const startTime = performance.now();
        if (this.lastMouseScroll && startTime - this.lastMouseScroll < duration) {
            el.scrollTop = this.mouseScrollTarget;
        }
        this.lastMouseScroll = startTime;

        let start = el.scrollTop;
        this.mouseScrollTarget = start + change;

        const easeOut = (t: number) => 1 - (1 - t) ** 2;

        const animateScroll = (now: number) => {
            now = performance.now();
            let t = Math.min(1, (now - startTime) / duration);
            t = easeOut(t);

            el.scrollTop = start + change * t;

            if (t < 1) {
                this.mouseScrollAnimation = requestAnimationFrame(animateScroll);
            } else {
                el.scrollTop = start + change;
            }
        };

        this.mouseScrollAnimation = requestAnimationFrame(animateScroll);
    }

    private trackpadScrolling = false;
    private trackpadScrollVelocity = 0;
    private trackpadScrollFriction = 0;
    scrollWithTrackpad(el: HTMLElement, change: number) {
        const defaultFriction = 0.75;
        const maxFriction = 0.98;
        const fullFrictionThreshold = 20;
        const multiplier = 0.25;
        const minVelocity = 0.1;

        if (this.trackpadScrollVelocity * change < 0) {
            this.trackpadScrolling = false;
        }

        this.trackpadScrollVelocity += change * multiplier;

        const animate = () => {
            if (Math.abs(this.trackpadScrollVelocity) > minVelocity) {
                el.scrollTop += this.trackpadScrollVelocity;
                this.trackpadScrollVelocity *= this.trackpadScrollFriction;
                this.trackpadScrollFriction = Math.max(
                    0,
                    Math.min(maxFriction, this.trackpadScrollFriction + 0.05),
                );
                requestAnimationFrame(animate);
            } else {
                this.trackpadScrolling = false;
                this.trackpadScrollVelocity = 0;
            }
        };

        this.trackpadScrollFriction =
            Math.min(1, (Math.abs(change) / fullFrictionThreshold) ** 3) * defaultFriction;

        if (!this.trackpadScrolling) {
            this.trackpadScrolling = true;
            animate();
            console.log("do a scroll");
        }
    }
}
