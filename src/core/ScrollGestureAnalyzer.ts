function mean(data: number[]): number {
    return data.reduce((a, b) => a + b, 0) / data.length;
}

/**
 * Tracks the timing of consecutive wheel events in order to find gesture
 * boundaries.
 *
 * A gesture is a burst of wheel events separated from the next by a pause. Knowing
 * where one ends matters because a scroller is chosen once per gesture and then
 * reused for the rest of it, which is what keeps a scroll from hopping into a
 * different container halfway through.
 *
 * `Events` owns an instance and is the only caller of {@link analyzeDelay}. The
 * statistics are only meaningful when every wheel event feeds them, in order,
 * which is why they live here rather than in whichever feature happens to consume
 * them. Nothing outside this class may mutate the statistics.
 */
export class ScrollGestureAnalyzer {
    /** Lower bound for the pause that separates two gestures, in ms. */
    private readonly MIN_START_THRESHOLD = 200;
    /** Upper bound for that pause, reached once events arrive slowly. */
    private readonly MAX_START_THRESHOLD = 500;
    /** The delay assumed at a gesture start, before any sample has been recorded. */
    private readonly INITIAL_DELAY = 10;

    /** How many inter-event delays the rolling mean considers. */
    private readonly MAX_DELAY_SAMPLES = 50;

    /** Delays since the current gesture started, oldest first. */
    private delays: number[] = [];

    /** Mean delay between wheel events, in ms. */
    private avgDelay = 10;

    /**
     * Records one wheel event and reports whether it opens a new gesture.
     * Longer pauses between scrolls are more likely to signal a new batch.
     * @param deltaTime Milliseconds since the previous wheel event.
     * @returns True if this event starts a new scroll gesture.
     */
    public analyzeDelay(deltaTime: number): boolean {
        if (this.getIsStart(deltaTime)) {
            this.delays = [];
            this.avgDelay = this.INITIAL_DELAY;
            return true;
        }

        // Store delay
        this.delays.push(deltaTime);
        if (this.delays.length > this.MAX_DELAY_SAMPLES) {
            this.delays.shift(); // drop oldest
        }

        this.avgDelay = mean(this.delays);
        return false;
    }

    private getIsStart(deltaTime: number): boolean {
        const threshold = Math.min(
            this.MIN_START_THRESHOLD + this.avgDelay,
            this.MAX_START_THRESHOLD,
        );

        return deltaTime > threshold;
    }
}
