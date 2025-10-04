export default class Loader {
    constructor() {
        this.theme = localStorage.getItem("theme") || "light";
        console.log(localStorage.getItem("theme"));
        this.loaderFired = false;
        this.timeoutId = null;

        // Create loader wrapper
        this.loaderWrapper = document.createElement("div");
        this.loaderWrapper.innerHTML = `
          <div id="loading-screen" class="${this.theme}" style="display:flex; position:fixed; inset:0; justify-content:center; align-items:center; background: rgba(255,255,255,0.9); z-index:9999;">
            <div class="baby">👶</div>
            <div class="loading-text">Loading...</div>
          </div>
        `;
        this.loaderElement = this.loaderWrapper.querySelector("#loading-screen");

        // Append immediately
        document.documentElement.appendChild(this.loaderElement);

        // Optional content element handling
        this.contentElement = document.getElementById("content");
        if (this.contentElement) {
            this.contentElement.style.display = "none";
        }
    }

    startLoader(timeout) {
        if (this.loaderFired) return;

        this.loaderElement.style.display = "flex";
        if (this.contentElement) this.contentElement.style.display = "none";

        this.loaderFired = true;

        if (timeout) {
            this.timeoutId = setTimeout(() => {
                this.stopLoader();
            }, timeout);
        }
    }

    stopLoader() {
        document.body.style.display = "block";
        setTimeout(() => {
            if (this.timeoutId) {
                clearTimeout(this.timeoutId);
                this.timeoutId = null;
            }

            this.loaderElement.style.display = "none";
            if (this.contentElement) this.contentElement.style.display = "block";

            this.loaderFired = false;
        },200)
    }
}