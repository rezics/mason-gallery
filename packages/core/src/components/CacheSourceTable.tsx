import {
  Archive,
  FolderOpen,
  Pin,
  PinOff,
  Settings,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useI18n } from "@/i18n";
import type { CacheStats } from "@/types/platform";

function formatDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

export function CacheSourceTable({
  stats,
  selected,
  formatSize,
  onSelectionChange,
  onCustomize,
  onTogglePin,
  onClear,
}: {
  stats: CacheStats[];
  selected: Set<number>;
  formatSize: (bytes: number) => string;
  onSelectionChange: (selected: Set<number>) => void;
  onCustomize: (stats: CacheStats) => void;
  onTogglePin: (stats: CacheStats) => void;
  onClear: (stats: CacheStats) => void;
}) {
  const t = useI18n();
  const allSelected =
    stats.length > 0 && stats.every((source) => selected.has(source.id));

  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <Table>
        <TableHeader className="bg-muted/35">
          <TableRow>
            <TableHead className="w-10 pl-3">
              <Checkbox
                checked={allSelected}
                aria-label={t("cache:selectAll")}
                onCheckedChange={(checked) => {
                  const next = new Set(selected);
                  for (const source of stats) {
                    if (checked) next.add(source.id);
                    else next.delete(source.id);
                  }
                  onSelectionChange(next);
                }}
              />
            </TableHead>
            <TableHead>{t("cache:source")}</TableHead>
            <TableHead className="hidden md:table-cell">
              {t("cache:type")}
            </TableHead>
            <TableHead>{t("cache:size")}</TableHead>
            <TableHead className="hidden lg:table-cell">
              {t("cache:lastUsed")}
            </TableHead>
            <TableHead className="hidden xl:table-cell">
              {t("cache:status")}
            </TableHead>
            <TableHead className="w-28 text-right">
              {t("cache:actions")}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {stats.map((source) => {
            const SourceIcon = source.kind === "archive" ? Archive : FolderOpen;
            const hasOverride = Boolean(source.policyOverride);
            return (
              <TableRow
                key={source.id}
                data-state={selected.has(source.id) ? "selected" : undefined}
              >
                <TableCell className="pl-3">
                  <Checkbox
                    checked={selected.has(source.id)}
                    aria-label={source.originPath}
                    onCheckedChange={() => {
                      const next = new Set(selected);
                      if (next.has(source.id)) next.delete(source.id);
                      else next.add(source.id);
                      onSelectionChange(next);
                    }}
                  />
                </TableCell>
                <TableCell className="min-w-52">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                      <SourceIcon className="size-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="max-w-[24rem] truncate font-medium">
                        {source.originPath}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {source.entryCount ?? 0} {t("archive:entries")}
                      </p>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  {source.kind === "archive"
                    ? t("library:archive")
                    : t("library:folder")}
                </TableCell>
                <TableCell>
                  <p className="font-medium">
                    {formatSize(
                      source.thumbCacheSize + source.extractedCacheSize,
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatSize(source.thumbCacheSize)} +{" "}
                    {formatSize(source.extractedCacheSize)}
                  </p>
                </TableCell>
                <TableCell className="hidden text-muted-foreground lg:table-cell">
                  {formatDate(source.lastAccessed)}
                </TableCell>
                <TableCell className="hidden xl:table-cell">
                  <div className="flex items-center gap-1.5">
                    <Badge variant={hasOverride ? "outline" : "secondary"}>
                      {hasOverride ? t("cache:custom") : t("cache:inherited")}
                    </Badge>
                    {source.isPinned && (
                      <Badge variant="secondary">
                        <Pin />
                        {t("archive:pinned")}
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-1">
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            aria-label={t("cache:customize")}
                            onClick={() => onCustomize(source)}
                          />
                        }
                      >
                        <Settings />
                      </TooltipTrigger>
                      <TooltipContent>{t("cache:customize")}</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            aria-label={
                              source.isPinned
                                ? t("cache:unpin")
                                : t("cache:pin")
                            }
                            onClick={() => onTogglePin(source)}
                          />
                        }
                      >
                        {source.isPinned ? <PinOff /> : <Pin />}
                      </TooltipTrigger>
                      <TooltipContent>
                        {source.isPinned ? t("cache:unpin") : t("cache:pin")}
                      </TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            className="text-destructive"
                            aria-label={t("cache:clearCache")}
                            onClick={() => onClear(source)}
                          />
                        }
                      >
                        <Trash2 />
                      </TooltipTrigger>
                      <TooltipContent>{t("cache:clearCache")}</TooltipContent>
                    </Tooltip>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
