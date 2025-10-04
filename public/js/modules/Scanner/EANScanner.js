import Quagga from "https://cdn.jsdelivr.net/npm/@ericblade/quagga2@1.8.4/+esm";
import BaseScanner from "./BaseScanner.js";

export default class EANScanner extends BaseScanner {
    constructor({ buttonId, containerId, wrapperId, onDetect }) {
        super({ buttonId, wrapperId, onDetect });
        this.container = document.getElementById(containerId);
    }

    startScanner() {
        this.wrapper.hidden = false;

        Quagga.init({
            inputStream: {
                name: "Live",
                type: "LiveStream",
                target: this.container,
                constraints: {
                    facingMode: "environment",
                    width: { min: 640, ideal: 1280 },
                    height: { min: 480, ideal: 720 }
                }
            },
            locator: { patchSize: "medium", halfSample: true },
            numOfWorkers: 2,
            decoder: { readers: ["ean_reader"] },
            locate: true,
        }, (err) => {
            if (err) {
                console.error("Quagga init error:", err);
                return;
            }
            Quagga.start();
            Quagga.onDetected(this.onDetectedHandler);
            this.isScanning = true;
        });
    }

    onDetectedHandler = (result) => {
        const code = result.codeResult.code;
        this.onDetect(code); // 👈 call user-provided function
        this.stopScanner();
    };

    stopScanner() {
        Quagga.stop();
        Quagga.offDetected(this.onDetectedHandler);
        this.container.querySelector("video")?.remove();
        this.isScanning = false;
        this.wrapper.hidden = true;
    }
}