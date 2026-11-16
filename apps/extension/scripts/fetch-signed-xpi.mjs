// Waits until addons.mozilla.org has signed a version submitted to the
// unlisted channel, then downloads the signed XPI into .output/, for the
// GitHub release (unlisted versions are only distributed there).
//
//   FIREFOX_EXTENSION_ID, FIREFOX_JWT_ISSUER, FIREFOX_JWT_SECRET
//   node scripts/fetch-signed-xpi.mjs <version>

import { createHmac, randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";

const API = "https://addons.mozilla.org/api/v5";
const POLL_MS = 30_000;
const TIMEOUT_MS = 30 * 60_000;

const version = process.argv[2];
const {
    FIREFOX_EXTENSION_ID: id,
    FIREFOX_JWT_ISSUER: issuer,
    FIREFOX_JWT_SECRET: secret,
} = process.env;
if (!version || !id || !issuer || !secret) {
    console.error(
        "Usage: node scripts/fetch-signed-xpi.mjs <version>, with the FIREFOX_* variables",
    );
    process.exit(1);
}

const base64url = (value) => Buffer.from(value).toString("base64url");

/** A short-lived JWT for the AMO API (HS256 with the API secret). */
function authorization() {
    const now = Math.floor(Date.now() / 1000);
    const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
    const payload = base64url(
        JSON.stringify({ iss: issuer, jti: randomUUID(), iat: now, exp: now + 60 }),
    );
    const signature = createHmac("sha256", secret)
        .update(`${header}.${payload}`)
        .digest("base64url");
    return `JWT ${header}.${payload}.${signature}`;
}

async function amo(url) {
    const response = await fetch(url, { headers: { Authorization: authorization() } });
    if (!response.ok) throw new Error(`${url}: ${response.status} ${await response.text()}`);
    return response;
}

// The "v" prefix makes AMO read it as a version number, not an ID.
const versionUrl = `${API}/addons/addon/${encodeURIComponent(id)}/versions/v${version}/`;
const deadline = Date.now() + TIMEOUT_MS;
for (;;) {
    const { file } = await (await amo(versionUrl)).json();
    if (file?.status === "public") {
        const xpi = await (await amo(file.url)).arrayBuffer();
        const path = `.output/mailflare-${version}-firefox.xpi`;
        await writeFile(path, Buffer.from(xpi));
        console.log(`Saved ${path}`);
        break;
    }
    if (file?.status === "disabled") throw new Error(`Version ${version} was rejected by AMO`);
    if (Date.now() > deadline)
        throw new Error(`Version ${version} wasn't signed within 30 minutes`);
    console.log(`Waiting for AMO to sign ${version} (${file?.status ?? "not processed yet"})...`);
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
}
