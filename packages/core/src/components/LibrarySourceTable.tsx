import {
  Archive,
  Clock,
  FolderOpen,
  MoreHorizontal,
  Pencil,
  RefreshCw,
  Star,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { cn } from "@/lib/utils";
import type { LibrarySource } from "@/types/platform";

function formatDate(value: string | null, never: string): string {
  if (!value) return never;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return never;
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

export function LibrarySourceTable({
  sources,
  selected,
  onSelectionChange,
  onOpen,
  onToggleFavorite,
  onRename,
  onRemove,
}: {
  sources: LibrarySource[];
  selected: Set<number>;
  onSelectionChange: (selected: Set<number>) => void;
  onOpen: (source: LibrarySource, rescan?: boolean) => void;
  onToggleFavorite: (source: LibrarySource) => void;
  onRename: (source: LibrarySource) => void;
  onRemove: (source: LibrarySource) => void;
}) {
  const t = useI18n();
  const allSelected =
    sources.length > 0 && sources.every((source) => selected.has(source.id));

  const toggleSource = (id: number) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onSelectionChange(next);
  };

  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <Table>
        <TableHeader className="bg-muted/35">
          <TableRow>
            <TableHead className="w-10 pl-3">
              <Checkbox
                checked={allSelected}
                aria-label={t("library:selectAll")}
                onCheckedChange={(checked) => {
                  const next = new Set(selected);
                  for (const source of sources) {
                    if (checked) next.add(source.id);
                    else next.delete(source.id);
                  }
                  onSelectionChange(next);
                }}
              />
            </TableHead>
            <TableHead>{t("library:tableName")}</TableHead>
            <TableHead className="hidden md:table-cell">
              {t("library:tableType")}
            </TableHead>
            <TableHead className="hidden lg:table-cell">
              {t("library:tableImages")}
            </TableHead>
            <TableHead className="hidden xl:table-cell">
              {t("library:tableLastOpened")}
            </TableHead>
            <TableHead>{t("library:tableStatus")}</TableHead>
            <TableHead className="w-28 text-right">
              {t("library:tableActions")}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sources.map((source) => {
            const SourceIcon = source.kind === "archive" ? Archive : FolderOpen;
            const statusLabel =
              source.accessStatus === "ready"
                ? t("library:statusReady")
                : source.accessStatus === "needs-access"
                  ? t("library:statusNeedsAccess")
                  : t("library:statusMissing");

            return (
              <TableRow
                key={source.id}
                data-state={selected.has(source.id) ? "selected" : undefined}
              >
                <TableCell className="pl-3">
                  <Checkbox
                    checked={selected.has(source.id)}
                    aria-label={source.label}
                    onCheckedChange={() => toggleSource(source.id)}
                  />
                </TableCell>
                <TableCell className="min-w-52">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                      <SourceIcon className="size-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-medium">{source.label}</p>
                      <p className="max-w-[20rem] truncate text-xs text-muted-foreground">
                        {source.path}
                      </p>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  {source.kind === "archive"
                    ? t("library:archive")
                    : t("library:folder")}
                </TableCell>
                <TableCell className="hidden lg:table-cell">
                  {source.imageCount == null
                    ? "—"
                    : t("library:imagesCount", {
                        count: source.imageCount,
                      })}
                </TableCell>
                <TableCell className="hidden text-muted-foreground xl:table-cell">
                  <span className="inline-flex items-center gap-1.5">
                    <Clock className="size-3.5" />
                    {formatDate(source.lastOpenedAt, t("library:never"))}
                  </span>
                </TableCell>
                <TableCell>
                  <Badge
                    variant={
                      source.accessStatus === "missing"
                        ? "destructive"
                        : source.accessStatus === "ready"
                          ? "secondary"
                          : "outline"
                    }
                  >
                    {statusLabel}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={source.accessStatus === "missing"}
                      onClick={() => onOpen(source)}
                    >
                      {t("library:open")}
                    </Button>
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            className={cn(source.isFavorite && "text-brand")}
                            aria-label={
                              source.isFavorite
                                ? t("library:unfavorite")
                                : t("library:favorite")
                            }
                            onClick={() => onToggleFavorite(source)}
                          />
                        }
                      >
                        <Star
                          className={cn(source.isFavorite && "fill-current")}
                        />
                      </TooltipTrigger>
                      <TooltipContent>
                        {source.isFavorite
                          ? t("library:unfavorite")
                          : t("library:favorite")}
                      </TooltipContent>
                    </Tooltip>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            aria-label={t("library:moreActions")}
                          />
                        }
                      >
                        <MoreHorizontal />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="min-w-44">
                        <DropdownMenuItem
                          disabled={source.accessStatus === "missing"}
                          onClick={() => onOpen(source, true)}
                        >
                          <RefreshCw />
                          {t("library:rescan")}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onRename(source)}>
                          <Pencil />
                          {t("library:rename")}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() => onRemove(source)}
                        >
                          <Trash2 />
                          {t("library:remove")}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
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
