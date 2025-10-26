export class Editor {}
export class MarkdownView {}
export class Platform {
    static isMobile = false;
    static isDesktop = true;
    static isSafari = false;
    static isAndroidApp = false;
    static isIosApp = false;
}

export function debounce(func: any, wait?: number, immediate?: boolean) {
    return func;
}

(HTMLElement.prototype as any).addClass = function (cls: string) {
    this.classList.add(...(Array.isArray(cls) ? cls : [cls]));
};
(HTMLElement.prototype as any).removeClass = function (cls: string) {
    this.classList.remove(...(Array.isArray(cls) ? cls : [cls]));
};
(HTMLElement.prototype as any).toggleClass = function (cls: string, force?: boolean) {
    this.classList.toggle(cls, force);
};
(HTMLElement.prototype as any).hasClass = function (cls: string) {
    return this.classList.contains(cls);
};
