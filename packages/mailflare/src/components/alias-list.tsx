import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack } from "@astryxdesign/core/HStack";
import { IconButton } from "@astryxdesign/core/IconButton";
import { Link } from "@astryxdesign/core/Link";
import { Selector } from "@astryxdesign/core/Selector";
import { Spinner } from "@astryxdesign/core/Spinner";
import { Text } from "@astryxdesign/core/Text";
import { TextInput } from "@astryxdesign/core/TextInput";
import { VStack } from "@astryxdesign/core/VStack";
import { useCallback, useEffect, useRef, useState } from "react";
import {
    TbEdit,
    TbListCheck,
    TbPlaylistX,
    TbPlus,
    TbRefresh,
    TbSearch,
    TbSearchOff,
    TbTrash,
} from "react-icons/tb";
import { useTranslations } from "use-intl";
import { useLocation } from "wouter";

import { useCloudflareConfig } from "../api/config-context";
import type { Alias } from "../backend/types";
import { useMailflare } from "../backend/use-mailflare";
import { useOnlineStatus } from "../hooks/use-online-status";
import { useAuthStore } from "../stores/auth-store";
import { useSettingsStore } from "../stores/settings-store";
import { useUIStore } from "../stores/ui-store";
import { sort } from "../utils/sort";
import { AliasBulkDeleteDialog } from "./alias-bulk-delete-dialog";
import { AliasBulkEditDialog } from "./alias-bulk-edit-dialog";
import { AliasCard } from "./alias-card";
import { AliasCreateDialog } from "./alias-create-dialog";
import { AliasDeleteDialog } from "./alias-delete-dialog";
import { AliasEditDialog } from "./alias-edit-dialog";
import { PATHS } from "./navigation";

type AliasListProps = {
    /** Wide screens: domains are in the sidebar, not in a selector here. */
    hideDomainSelector?: boolean;
    /** Wide screens: opens an alias in the detail pane instead of the edit dialog. */
    onOpenAlias?: (alias: Alias) => void;
    openAliasId?: string | null;
};

export function AliasList({ hideDomainSelector, onOpenAlias, openAliasId }: AliasListProps) {
    const t = useTranslations("alias_list");
    const tc = useTranslations("common");

    const {
        selectedZoneId,
        setSelectedZoneId,
        zones,
        zoneStatus,
        aliases,
        canManageDomains,
        canEditDomains,
        account,
    } = useMailflare();

    const ruleFilter = useSettingsStore((s) => s.ruleFilter);
    const { isOnline } = useOnlineStatus();
    const aliasSearch = useUIStore((s) => s.aliasSearch);
    const setAliasSearch = useUIStore((s) => s.setAliasSearch);
    const selectedAliases = useUIStore((s) => s.selectedAliases);
    const setAliasSelected = useUIStore((s) => s.setAliasSelected);
    const clearSelection = useUIStore((s) => s.clearSelection);
    const createOpen = useUIStore((s) => s.createOpen);
    const setCreateOpen = useUIStore((s) => s.setCreateOpen);
    const editOpen = useUIStore((s) => s.editOpen);
    const setEditOpen = useUIStore((s) => s.setEditOpen);
    const deleteOpen = useUIStore((s) => s.deleteOpen);
    const setDeleteOpen = useUIStore((s) => s.setDeleteOpen);
    const { lockedWorkerUrl } = useCloudflareConfig();
    const workerUrl = useAuthStore((s) => s.workerUrl);
    const [, navigate] = useLocation();
    const selectEnabled = useUIStore((s) => s.selectEnabled);
    const setSelectEnabled = useUIStore((s) => s.setSelectEnabled);
    const searchVisible = useUIStore((s) => s.searchVisible);
    const setSearchVisible = useUIStore((s) => s.setSearchVisible);
    const aliasToEditId = useUIStore((s) => s.aliasToEditId);
    const setAliasToEditId = useUIStore((s) => s.setAliasToEditId);
    const aliasToDeleteId = useUIStore((s) => s.aliasToDeleteId);
    const setAliasToDeleteId = useUIStore((s) => s.setAliasToDeleteId);
    const scrollPosition = useUIStore((s) => s.scrollPosition);
    const setScrollPosition = useUIStore((s) => s.setScrollPosition);

    const scrollRef = useRef<HTMLDivElement>(null);

    const [filteredAliases, setFilteredAliases] = useState<Alias[]>([]);

    // Select the first zone once zones are known and none (or one that is gone) is selected.
    useEffect(() => {
        if (!zones.isSuccess) return;
        if (selectedZoneId !== null && zones.data.some((zone) => zone.id === selectedZoneId)) {
            return;
        }
        setSelectedZoneId(zones.data[0]?.id ?? null);
    }, [zones.isSuccess, zones.data, selectedZoneId, setSelectedZoneId]);

    // Cached aliases stay listed when a refresh fails (e.g. offline).
    useEffect(() => {
        if (!aliases.data || aliases.data.length === 0) {
            setFilteredAliases([]);
            return;
        }
        const search = aliasSearch.toLowerCase();
        setFilteredAliases(
            sort(
                aliases.data
                    .filter((a) => (ruleFilter ? !a.isExternal : true))
                    .filter(
                        (a) =>
                            search === "" ||
                            a.description.toLowerCase().includes(search) ||
                            a.address.toLowerCase().includes(search),
                    ),
                { order: "desc", by: (item) => item.order },
            ),
        );
    }, [aliases.data, ruleFilter, aliasSearch]);

    const aliasToEdit = filteredAliases.find((a) => a.id === aliasToEditId) ?? null;
    const aliasToDelete = filteredAliases.find((a) => a.id === aliasToDeleteId) ?? null;

    // Restore scroll position after aliases load
    useEffect(() => {
        if (scrollRef.current && scrollPosition > 0 && filteredAliases.length > 0) {
            scrollRef.current.scrollTop = scrollPosition;
        }
    }, [filteredAliases.length > 0]); // only on initial load

    const handleScroll = useCallback(() => {
        if (scrollRef.current) {
            setScrollPosition(scrollRef.current.scrollTop);
        }
    }, [setScrollPosition]);

    const selectedZone = zones.data?.find((zone) => zone.id === selectedZoneId);
    const noZoneSelected = !zones.data || zones.data.length === 0 || selectedZoneId === null;
    const routingNotReady = !!selectedZoneId && zoneStatus.data?.ready === false;

    return (
        <VStack gap={2}>
            <AliasCreateDialog open={createOpen} onClose={() => setCreateOpen(false)} />

            <AliasEditDialog
                open={editOpen && !!aliasToEdit && selectedAliases.length === 0}
                onClose={() => {
                    setEditOpen(false);
                    setAliasToEditId(null);
                }}
                alias={aliasToEdit}
            />

            <AliasBulkEditDialog
                open={editOpen && selectedAliases.length > 0}
                onClose={(clear) => {
                    setEditOpen(false);
                    if (clear) {
                        setSelectEnabled(false);
                        clearSelection();
                    }
                }}
                selectedAliases={selectedAliases}
            />

            <AliasDeleteDialog
                open={deleteOpen && !!aliasToDelete && selectedAliases.length === 0}
                onClose={() => {
                    setDeleteOpen(false);
                    setAliasToDeleteId(null);
                }}
                alias={aliasToDelete}
            />

            <AliasBulkDeleteDialog
                open={deleteOpen && selectedAliases.length > 0}
                onClose={(clear) => {
                    setDeleteOpen(false);
                    if (clear) {
                        setSelectEnabled(false);
                        clearSelection();
                    }
                }}
                selectedAliases={selectedAliases}
            />

            {/* WIDE: the sidebar selects the domain; one row with its name and the actions */}
            {hideDomainSelector && (
                <HStack gap={3} align="center" justify="between" style={{ flexWrap: "wrap" }}>
                    <HStack gap={2} align="end">
                        <Heading level={2}>{selectedZone?.name ?? ""}</Heading>
                        {aliases.isSuccess && (
                            <Text type="supporting">
                                {t("count", { count: aliases.data?.length ?? 0 })}
                            </Text>
                        )}
                    </HStack>
                    <HStack gap={2} align="center">
                        <TextInput
                            type="search"
                            label={t("search_placeholder")}
                            isLabelHidden
                            hasClear
                            width={260}
                            placeholder={t("search_placeholder")}
                            value={aliasSearch}
                            onChange={setAliasSearch}
                            isDisabled={!aliases.data || aliases.data.length === 0}
                        />
                        {selectEnabled ? (
                            <>
                                <Button
                                    label={tc("edit")}
                                    icon={<TbEdit />}
                                    isDisabled={selectedAliases.length === 0}
                                    onClick={() => setEditOpen(true)}
                                />
                                <Button
                                    variant="destructive"
                                    label={tc("delete")}
                                    icon={<TbTrash />}
                                    isDisabled={selectedAliases.length === 0}
                                    onClick={() => setDeleteOpen(true)}
                                />
                                <Button
                                    label={t("done_select")}
                                    onClick={() => {
                                        clearSelection();
                                        setSelectEnabled(false);
                                    }}
                                />
                            </>
                        ) : (
                            <>
                                <IconButton
                                    label={t("select")}
                                    tooltip={t("select")}
                                    icon={<TbListCheck />}
                                    isDisabled={filteredAliases.length === 0}
                                    onClick={() => {
                                        clearSelection();
                                        setSelectEnabled(true);
                                    }}
                                />
                                <IconButton
                                    label={t("refresh")}
                                    tooltip={t("refresh")}
                                    icon={<TbRefresh />}
                                    isLoading={aliases.isFetching}
                                    isDisabled={!isOnline || noZoneSelected}
                                    onClick={() => aliases.refetch()}
                                />
                                <Button
                                    variant="primary"
                                    label={t("create")}
                                    icon={<TbPlus />}
                                    isDisabled={!isOnline || noZoneSelected}
                                    onClick={() => setCreateOpen(true)}
                                />
                            </>
                        )}
                    </HStack>
                </HStack>
            )}

            {/* DOMAIN SELECTOR */}
            {!hideDomainSelector && (
                <Selector
                    label={t("domain_placeholder")}
                    isLabelHidden
                    width="100%"
                    placeholder={t("domain_placeholder")}
                    value={selectedZoneId ?? undefined}
                    onChange={setSelectedZoneId}
                    isLoading={zones.isFetching}
                    isDisabled={!zones.data || zones.data.length === 0}
                    options={zones.data?.map((z) => ({ value: z.id, label: z.name })) ?? []}
                />
            )}

            {/* ACTION BUTTONS (narrow) */}
            {!hideDomainSelector && (
                <HStack gap={1}>
                    <IconButton
                        size="sm"
                        label={selectEnabled ? t("stop_select") : t("select")}
                        tooltip={selectEnabled ? t("stop_select") : t("select")}
                        icon={selectEnabled ? <TbPlaylistX /> : <TbListCheck />}
                        isDisabled={
                            !zones.data ||
                            (!selectEnabled && filteredAliases.length === 0) ||
                            selectedZoneId === null
                        }
                        onClick={() => {
                            clearSelection();
                            setSelectEnabled(!selectEnabled);
                        }}
                    />

                    {selectEnabled ? (
                        <>
                            <IconButton
                                size="sm"
                                label={tc("edit")}
                                tooltip={tc("edit")}
                                icon={<TbEdit />}
                                isDisabled={selectedAliases.length === 0}
                                onClick={() => setEditOpen(true)}
                            />
                            <IconButton
                                size="sm"
                                variant="destructive"
                                label={tc("delete")}
                                tooltip={tc("delete")}
                                icon={<TbTrash />}
                                isDisabled={selectedAliases.length === 0}
                                onClick={() => setDeleteOpen(true)}
                            />
                        </>
                    ) : (
                        <>
                            <IconButton
                                size="sm"
                                variant="primary"
                                label={t("create")}
                                tooltip={t("create")}
                                icon={<TbPlus />}
                                isDisabled={!isOnline || noZoneSelected}
                                onClick={() => setCreateOpen(true)}
                            />
                            <IconButton
                                size="sm"
                                label={searchVisible ? t("stop_search") : t("search")}
                                tooltip={searchVisible ? t("stop_search") : t("search")}
                                icon={searchVisible ? <TbSearchOff /> : <TbSearch />}
                                isDisabled={!aliases.data || aliases.data.length === 0}
                                onClick={() => {
                                    setSearchVisible(!searchVisible);
                                    setAliasSearch("");
                                }}
                            />
                            <IconButton
                                size="sm"
                                label={t("refresh")}
                                tooltip={t("refresh")}
                                icon={<TbRefresh />}
                                isLoading={aliases.isFetching}
                                isDisabled={!isOnline || noZoneSelected}
                                onClick={() => aliases.refetch()}
                            />
                        </>
                    )}
                </HStack>
            )}

            {searchVisible && !hideDomainSelector && (
                <TextInput
                    type="search"
                    label={t("search_placeholder")}
                    isLabelHidden
                    hasAutoFocus
                    hasClear
                    placeholder={t("search_placeholder")}
                    value={aliasSearch}
                    onChange={setAliasSearch}
                />
            )}

            {routingNotReady && (
                <Banner
                    status="warning"
                    title={t("email_routing_not_enabled")}
                    endContent={
                        zoneStatus.data?.setupUrl && (
                            <Link href={zoneStatus.data.setupUrl} isExternalLink>
                                {t("email_routing_dashboard")}
                            </Link>
                        )
                    }
                />
            )}

            {!!selectedZoneId && filteredAliases.length === 0 && aliases.isFetching && (
                <HStack justify="center" paddingBlock={4}>
                    <Spinner />
                </HStack>
            )}

            {!zones.isFetching &&
                zones.isSuccess &&
                zones.data.length === 0 &&
                (canManageDomains && account.isSuccess && !canEditDomains ? (
                    <Banner status="info" title={t("no_shared_domains")} />
                ) : canManageDomains ? (
                    <Banner
                        status="info"
                        title={t("no_worker_domains")}
                        endContent={
                            // Domains are managed in the Worker's own app.
                            lockedWorkerUrl ? (
                                <Button
                                    size="sm"
                                    label={t("add_domain")}
                                    onClick={() => navigate(PATHS.adminDomains)}
                                />
                            ) : (
                                workerUrl && (
                                    <Button
                                        size="sm"
                                        label={t("add_domain")}
                                        href={workerUrl}
                                        target="_blank"
                                    />
                                )
                            )
                        }
                    />
                ) : (
                    <Banner status="warning" title={t("no_zones")} />
                ))}

            {zones.isError && (
                <Banner status="error" title={t("zones_error", { error: String(zones.error) })} />
            )}

            {!!selectedZoneId &&
                aliases.isSuccess &&
                !aliases.isFetching &&
                filteredAliases.length === 0 && <Banner status="info" title={t("no_rules")} />}

            {aliases.isError && !zones.isError && (
                <Banner status="error" title={t("rules_error", { error: String(aliases.error) })} />
            )}

            {/* ALIAS LIST */}
            <div
                ref={scrollRef}
                onScroll={handleScroll}
                style={{ flex: filteredAliases.length > 0 ? 1 : undefined, overflowY: "auto" }}
            >
                <VStack gap={2}>
                    {aliases.data &&
                        filteredAliases.map((alias) => (
                            <AliasCard
                                key={alias.id}
                                alias={alias}
                                selectEnabled={selectEnabled}
                                isSelected={selectedAliases.some((a) => a.id === alias.id)}
                                // The checkbox and the card both report it: setting, not toggling.
                                onSelect={(selected) => setAliasSelected(alias, selected)}
                                onEdit={() => {
                                    if (onOpenAlias) {
                                        onOpenAlias(alias);
                                        return;
                                    }
                                    setAliasToEditId(alias.id);
                                    setEditOpen(true);
                                }}
                                onOpen={onOpenAlias && (() => onOpenAlias(alias))}
                                isOpen={alias.id === openAliasId}
                                onDelete={() => {
                                    setAliasToDeleteId(alias.id);
                                    setDeleteOpen(true);
                                }}
                            />
                        ))}
                </VStack>
            </div>
        </VStack>
    );
}
