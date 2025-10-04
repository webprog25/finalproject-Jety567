import express from "express";
import http from "http";
import https from "https";
import path from "path";
import { fileURLToPath } from 'url';
import fs from "fs";
import 'dotenv/config';

import initApi from "./api/index.js";
import updater from "./api/utils/updater.js";
import {requireAuthFiles,login} from "./api/utils/auth.js";
import cookieParser from "cookie-parser";

const PORT = process.env.PORT || 1930;
const HTTPS_PORT = process.env.HTTPS_PORT || 1931;
const isDev = process.env.NODE_ENV === "development";

const app = express();
const dirname = process.cwd();
const publicPath = path.join(dirname, "public");
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let server; // will hold http or https server

app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, './public/login.html'));
})

app.post("/login",login );
app.use(requireAuthFiles,express.static(publicPath));

if (isDev) {
    // 🔐 Development: use self-signed HTTPS
    const certPath = path.join(dirname, "cert");
    const httpsOptions = {
        key: fs.readFileSync(path.join(certPath, "key.pem")),
        cert: fs.readFileSync(path.join(certPath, "cert.pem")),
    };

    server = https.createServer(httpsOptions, app);

    updater(server, publicPath);

    server.listen(HTTPS_PORT, () => {
        console.log(`🚀 Dev HTTPS server running at https://localhost:${HTTPS_PORT}/`);
    });

} else {
    // 🌍 Production: plain HTTP (proxy will handle TLS)
    server = http.createServer(app);

    updater(server, publicPath);

    server.listen(PORT, () => {
        console.log(`🚀 Prod HTTP server running at http://localhost:${PORT}/`);
    });
}

const main = async () => {
    await initApi(app);
};

main();