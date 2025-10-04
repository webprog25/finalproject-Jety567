import BaseScanner from "./BaseScanner.js";

export default class QRCodeScanner extends BaseScanner {
    constructor({ buttonId, containerId, wrapperId, onDetect }) {
        super({ buttonId, wrapperId, onDetect });
        this.containerId = containerId;
        this.qrScanner = null;
    }

    startScanner() {
        this.wrapper.hidden = false;

        this.qrScanner = new Html5Qrcode(this.containerId);
        this.qrScanner.start(
            { facingMode: "environment" },
            { fps: 10, qrbox: 250 },
            (decodedText) => {
                this.onDetect(decodedText); // 👈 call user-provided function
                this.stopScanner();
            },
            (errorMessage) => {
                console.warn("QR error:", errorMessage);
            }
        ).then(() => {
            this.isScanning = true;
        }).catch((err) => {
            console.error("QR init error:", err);
        });
    }

    stopScanner() {
        if (this.qrScanner) {
            this.qrScanner.stop().then(() => {
                this.qrScanner.clear();
                this.isScanning = false;
                this.wrapper.hidden = true;
            }).catch((err) => {
                console.error("QR stop error:", err);
            });
        }
    }
}