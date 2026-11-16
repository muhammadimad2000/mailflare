import psl from "better-psl";
import { generate as randomWords } from "random-words";

import type { AliasSettings } from "../stores/alias-settings-store";
import { randomString } from "./random-string";

export type GenerateAliasOptions = Omit<AliasSettings, "destination"> & {
    customPrefix?: string;
    hostname?: string;
};

export function generateAliasAddress({
    format = "characters",
    characterCount = 5,
    wordCount = 2,
    separator = "_",
    prefixFormat = "none",
    customPrefix,
    hostname,
}: GenerateAliasOptions): string {
    let prefix = "";
    if (prefixFormat === "custom" && customPrefix) {
        prefix = customPrefix.trim();
    } else if (hostname && psl.isValid(hostname)) {
        // Cast type since we just checked if it's valid, this should never be an issue
        const parsedHostname = psl.parse(hostname).parsed!;

        if (prefixFormat === "domainWithoutExtension" && parsedHostname.sld) {
            prefix = parsedHostname.sld;
        } else if (prefixFormat === "domainWithExtension" && parsedHostname?.domain) {
            prefix = parsedHostname.domain;
        } else if (prefixFormat === "fullDomain") {
            prefix = hostname;
        }
    }

    if (prefix !== "" && format !== "domain") {
        prefix = `${prefix}${separator}`;
    }

    switch (format) {
        case "characters":
            return `${prefix}${randomString(characterCount)}`.toLowerCase();
        case "words":
            return `${prefix}${randomWords({ exactly: wordCount, join: separator })}`.toLowerCase();
        case "domain":
            return prefix.toLowerCase();
        default:
            throw new Error("Invalid alias type.");
    }
}
