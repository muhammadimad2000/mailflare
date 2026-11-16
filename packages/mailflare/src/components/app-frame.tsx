// The signed-in app's frame: a sidebar (domains and pages) on wide screens;
// a top bar and bottom tabs on phones and in the extension popup.

import { AppShell } from "@astryxdesign/core/AppShell";
import { HStack } from "@astryxdesign/core/HStack";
import { SideNav, SideNavHeading, SideNavItem, SideNavSection } from "@astryxdesign/core/SideNav";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import type { ReactNode } from "react";
import { TbWorld } from "react-icons/tb";
import { useTranslations } from "use-intl";
import { useLocation } from "wouter";

import { useCloudflareConfig } from "../api/config-context";
import { useMailflare } from "../backend/use-mailflare";
import { useLayout } from "../hooks/use-layout";
import { useAuthStore } from "../stores/auth-store";
import { CloudflareAccessBanner } from "./extension-notices";
import { type NavItem, PATHS, useNavItems } from "./navigation";
import { OfflineBanner } from "./offline-banner";

/** Where the app is connected to, for the sidebar heading. */
function useConnectionLabel() {
    const t = useTranslations("nav");
    const workerUrl = useAuthStore((s) => s.workerUrl);
    const { account } = useMailflare();
    const email = account.data?.user?.email;
    if (!workerUrl) return t("cloudflare");
    return email ?? new URL(workerUrl).host;
}

function Sidebar({ items }: { items: NavItem[] }) {
    const t = useTranslations("nav");
    const [location, navigate] = useLocation();
    const { zones, selectedZoneId, setSelectedZoneId } = useMailflare();
    const label = useConnectionLabel();

    const item = (nav: NavItem) => (
        <SideNavItem
            key={nav.path}
            label={nav.label}
            icon={nav.icon}
            isSelected={location === nav.path}
            onClick={() => navigate(nav.path)}
        />
    );
    const pages = items.filter((nav) => !nav.isAdmin && nav.path !== PATHS.settings);
    const admin = items.filter((nav) => nav.isAdmin);
    const settings = items.find((nav) => nav.path === PATHS.settings);

    return (
        <SideNav
            header={<SideNavHeading heading="MailFlare" subheading={label} />}
            footer={settings && item(settings)}
        >
            <SideNavSection title={t("aliases")}>
                {(zones.data ?? []).map((zone) => (
                    <SideNavItem
                        key={zone.id}
                        label={zone.name}
                        icon={<TbWorld />}
                        isSelected={location === PATHS.aliases && zone.id === selectedZoneId}
                        onClick={() => {
                            setSelectedZoneId(zone.id);
                            navigate(PATHS.aliases);
                        }}
                    />
                ))}
            </SideNavSection>
            <SideNavSection title={t("pages")} isHeaderHidden>
                {pages.filter((nav) => nav.path !== PATHS.aliases).map(item)}
            </SideNavSection>
            {admin.length > 0 && (
                <SideNavSection title={t("admin")}>{admin.map(item)}</SideNavSection>
            )}
        </SideNav>
    );
}

/** App-style bottom navigation: icons above labels, the current page in the accent color. */
function BottomTabs({ items }: { items: NavItem[] }) {
    const t = useTranslations("nav");
    const [location, navigate] = useLocation();
    const tabs = items.filter((nav) => !nav.isAdmin);
    // Admin pages are reached from the settings page on narrow screens.
    const current = tabs.some((nav) => nav.path === location) ? location : PATHS.settings;

    return (
        <nav
            aria-label={t("pages")}
            style={{
                display: "flex",
                borderTop: "1px solid var(--color-border)",
                background: "var(--color-background-surface)",
                paddingBottom: "env(safe-area-inset-bottom)",
            }}
        >
            {tabs.map((nav) => {
                const isCurrent = nav.path === current;
                return (
                    <button
                        key={nav.path}
                        type="button"
                        aria-current={isCurrent ? "page" : undefined}
                        onClick={() => navigate(nav.path)}
                        style={{
                            flex: 1,
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            gap: 2,
                            padding: "8px 4px 6px",
                            border: "none",
                            background: "none",
                            cursor: "pointer",
                            font: "inherit",
                            fontSize: "var(--font-size-xs)",
                            fontWeight: isCurrent ? 600 : 400,
                            color: isCurrent
                                ? "var(--color-text-accent)"
                                : "var(--color-text-secondary)",
                        }}
                    >
                        <span style={{ fontSize: 22, lineHeight: 0 }}>{nav.icon}</span>
                        {nav.label}
                    </button>
                );
            })}
        </nav>
    );
}

export function AppFrame({ children }: { children: ReactNode }) {
    const items = useNavItems();
    const { isWide } = useLayout();
    const { isExtension } = useCloudflareConfig();

    if (isWide) {
        return (
            <AppShell
                height="fill"
                contentPadding={6}
                mobileNav={false}
                sideNav={<Sidebar items={items} />}
            >
                <OfflineBanner />
                <CloudflareAccessBanner />
                {children}
            </AppShell>
        );
    }

    return (
        <VStack
            height="100%"
            style={{ maxWidth: isExtension ? undefined : 720, marginInline: "auto" }}
        >
            <HStack paddingInline={3} paddingBlock={2} align="center">
                <Text type="large" weight="bold">
                    MailFlare
                </Text>
            </HStack>
            <OfflineBanner />
            <CloudflareAccessBanner />
            <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
                <VStack padding={2}>{children}</VStack>
            </div>
            <BottomTabs items={items} />
        </VStack>
    );
}
