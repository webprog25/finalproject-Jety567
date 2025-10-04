import { io } from "https://cdn.socket.io/4.8.1/socket.io.esm.min.js";
import { javaScriptText } from "../i18n.js";

// Utility to get translated text with optional replacement
function t(key, params = {}) {
    let text = javaScriptText[key] || key;
    Object.keys(params).forEach(k => {
        text = text.replace(`{${k}}`, params[k]);
    });
    return text;
}

// Show a Bootstrap toast (using SweetAlert2)
function showToast(message, icon = 'info') {
    Swal.fire({
        toast: true,
        theme: localStorage.getItem('theme') || 'dark',
        position: 'top-end',
        icon: icon,
        title: message,
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true,
        didOpen: (toast) => {
            toast.addEventListener('mouseenter', Swal.stopTimer)
            toast.addEventListener('mouseleave', Swal.resumeTimer)
            toast.addEventListener('click', () => Swal.close())
        }
    });
}

function showToastFlag(message, flagUrl = null) {
    Swal.fire({
        toast: true,
        theme: localStorage.getItem('theme') || 'dark',
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true,
        title: "",
        icon: 'info', // fallback if no flag
        html: flagUrl
            ? `<div style="display:flex;align-items:center;gap:8px;">
                    <span>${message}</span>
                   <img src="${flagUrl}" alt="flag" style="width:20px;height:20px;border-radius:3px;" />
               </div>`
            : undefined,
        didOpen: (toast) => {
            toast.addEventListener('mouseenter', Swal.stopTimer);
            toast.addEventListener('mouseleave', Swal.resumeTimer);
            toast.addEventListener('click', () => Swal.close());
        },
    });
}

let socketInstance = null;

function initSocket() {
    getSocket();
}

function getSocket() {
    if (!socketInstance) {
        socketInstance = io("/", {
            autoConnect: true,
            reconnection: true,
            reconnectionAttempts: Infinity,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            timeout: 20000
        });

        socketInstance.on("connect", () => {
            showToast(`✅ ${t('connected')}`, "success");
        });

        socketInstance.on("disconnect", (reason) => {
            showToast(`⚠️ ${t('disconnected')}: ${reason}`, "warning");
        });

        socketInstance.on("reconnect_attempt", (attempt) => {
            // Optional: uncomment if you want to show reconnect attempts
            // showToast(`🔄 ${t('reconnect_attempt')} #${attempt}`, "info");
        });

        socketInstance.on("reconnect", (attempt) => {
            showToast(`✅ ${t('reconnected', { attempt })}`, "success");
        });
    }
    return socketInstance;
}

export {
    showToast,
    getSocket,
    initSocket,
    showToastFlag
};