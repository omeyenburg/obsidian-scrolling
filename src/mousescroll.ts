import type { default as ScrollingPlugin } from "./main";

export class MouseScroll {
    private plugin: ScrollingPlugin;

    private trackpadLastUse = 0;
    private trackpadFriction = 0;
    private trackpadVelocity = 0;
    private trackpadScrolling = false;
    private mouseLastUse = 0;
    private mouseTarget: number;
    private mouseAnimationFrame: number;

    constructor(plugin: ScrollingPlugin) {
        this.plugin = plugin;

        plugin.registerDomEvent(document, "wheel", (e: WheelEvent) => this.wheelHandler(e), {
            passive: false,
        });
    }

    private wheelHandler(event: WheelEvent): void {
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

    private isTrackpad(event: WheelEvent): boolean {
        if (event.deltaMode !== WheelEvent.DOM_DELTA_PIXEL) {
            this.trackpadLastUse = 0;
            return false;
        }

        // Mice often return multiples of certain deltas.
        const commonDeltas = [120, 197.18010794176823];
        for (const delta of commonDeltas) {
            if ((event.deltaY / delta) % 1 == 0) {
                this.trackpadLastUse = 0;
                return false;
            }
        }

        const now = performance.now();

        // Movement on both axes
        if (event.deltaX !== 0 && event.deltaY !== 0) {
            this.trackpadLastUse = now;
            return true;
        }

        // Small, fractional, non-zero delta
        if (event.deltaY % 1 !== 0 && Math.abs(event.deltaY) < 50) {
            this.trackpadLastUse = now;
            return true;
        }

        // Grace period
        if (now - this.trackpadLastUse < 1000) {
            this.trackpadLastUse = now;
            return true;
        }

        return false;
    }

    // Really good approximation of the default scrolling in Obsidian with duration 150.
    private scrollWithMouse(el: HTMLElement, change: number): void {
        if (!el) return;
        cancelAnimationFrame(this.mouseAnimationFrame);

        const duration = 150;
        const startTime = performance.now();
        if (
            this.mouseTarget &&
            this.mouseLastUse &&
            startTime - this.mouseLastUse < duration
        ) {
            el.scrollTop = this.mouseTarget;
        }
        this.mouseLastUse = startTime;

        let start = el.scrollTop;
        this.mouseTarget = start + change;

        const easeOut = (t: number) => 1 - (1 - t) ** 2;

        const animateScroll = (now: number) => {
            now = performance.now();
            let t = Math.min(1, (now - startTime) / duration);
            t = easeOut(t);

            el.scrollTop = start + change * t;

            if (t < 1) {
                this.mouseAnimationFrame = requestAnimationFrame(animateScroll);
            } else {
                el.scrollTop = start + change;
            }
        };

        this.mouseAnimationFrame = requestAnimationFrame(animateScroll);
    }

    private scrollWithTrackpad(el: HTMLElement, change: number): void {
        const defaultFriction = 0.75;
        const maxFriction = 0.98;
        const fullFrictionThreshold = 20;
        const multiplier = 0.25;
        const minVelocity = 0.1;

        if (this.trackpadVelocity * change < 0) {
            this.trackpadScrolling = false;
        }

        this.trackpadVelocity += change * multiplier;

        const animate = () => {
            if (Math.abs(this.trackpadVelocity) > minVelocity) {
                el.scrollTop += this.trackpadVelocity;
                this.trackpadVelocity *= this.trackpadFriction;
                this.trackpadFriction = Math.max(
                    0,
                    Math.min(maxFriction, this.trackpadFriction + 0.05),
                );
                requestAnimationFrame(animate);
            } else {
                this.trackpadScrolling = false;
                this.trackpadVelocity = 0;
            }
        };

        this.trackpadFriction =
            Math.min(1, (Math.abs(change) / fullFrictionThreshold) ** 3) * defaultFriction;

        if (!this.trackpadScrolling) {
            this.trackpadScrolling = true;
            animate();
        }
    }
}
