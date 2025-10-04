export default class BaseScanner {
    constructor({ buttonId, wrapperId, onDetect }) {
        this.button = document.getElementById(buttonId);
        this.wrapper = document.getElementById(wrapperId);
        this.onDetect = onDetect || (() => {}); // fallback to no-op
        this.isScanning = false;

        this.button.addEventListener("click", () => this.toggleScanner());
    }

    toggleScanner() {
        if (!this.isScanning) {
            this.startScanner();
        } else {
            this.stopScanner();
        }
    }

    startScanner() {
        throw new Error("startScanner() must be implemented in subclass");
    }

    stopScanner() {
        throw new Error("stopScanner() must be implemented in subclass");
    }
}