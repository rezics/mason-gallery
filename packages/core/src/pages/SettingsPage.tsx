import type { ReactNode } from "react";
import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Checkbox, Input, Select, Switch } from "@/components/ui/field";
import { usePlatform } from "@/context/PlatformContext";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";
import { useSettingsStore } from "@/stores/settingsStore";
import type { Locale, SortMethod } from "@/types";
import type {
  CacheCleanupStrategy,
  CachePolicy,
  ExtractedMode,
  FolderThumbnailsMode,
  PasswordStorageMode,
  ThemePreference,
  ThumbRetain,
} from "@/types/platform";

const MB = 1024 * 1024;

const categories = [
  "appearance",
  "gallery",
  "files",
  "archive",
  "cache",
  "advanced",
] as const;

type Category = (typeof categories)[number];

function getCategory(path: string): Category {
  const segment = path.split("/")[2] as Category | undefined;
  return segment && categories.includes(segment) ? segment : "appearance";
}

function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <div className="grid gap-2">
      <span className="text-sm font-medium">{label}</span>
      {children}
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </div>
  );
}

function updatePolicy(
  policy: CachePolicy,
  setPolicy: (policy: CachePolicy) => void,
  patch: Partial<CachePolicy>,
) {
  setPolicy({ ...policy, ...patch });
}

export default function SettingsPage() {
  const t = useI18n();
  const platform = usePlatform();
  const [location, navigate] = useLocation();
  const category = getCategory(location);
  const [clearConfirm, setClearConfirm] = useState<
    null | "thumbs" | "extracted"
  >(null);

  const language = useSettingsStore((s) => s.language);
  const setLanguage = useSettingsStore((s) => s.setLanguage);
  const theme = useSettingsStore((s) => s.theme);
  const setTheme = useSettingsStore((s) => s.setTheme);
  const sortMethod = useSettingsStore((s) => s.sortMethod);
  const setSortMethod = useSettingsStore((s) => s.setSortMethod);
  const pageSize = useSettingsStore((s) => s.pageSize);
  const setPageSize = useSettingsStore((s) => s.setPageSize);
  const breakpoints = useSettingsStore((s) => s.breakpoints);
  const setBreakpoints = useSettingsStore((s) => s.setBreakpoints);
  const showGridPosition = useSettingsStore((s) => s.showGridPosition);
  const setShowGridPosition = useSettingsStore((s) => s.setShowGridPosition);
  const formats = useSettingsStore((s) => s.formats);
  const setFormats = useSettingsStore((s) => s.setFormats);
  const confirmDelete = useSettingsStore((s) => s.confirmDelete);
  const setConfirmDelete = useSettingsStore((s) => s.setConfirmDelete);
  const showDeleteToast = useSettingsStore((s) => s.showDeleteToast);
  const setShowDeleteToast = useSettingsStore((s) => s.setShowDeleteToast);
  const cacheCleanupStrategy = useSettingsStore((s) => s.cacheCleanupStrategy);
  const setCacheCleanupStrategy = useSettingsStore(
    (s) => s.setCacheCleanupStrategy,
  );
  const passwordStorageMode = useSettingsStore((s) => s.passwordStorageMode);
  const setPasswordStorageMode = useSettingsStore(
    (s) => s.setPasswordStorageMode,
  );
  const cachePolicy = useSettingsStore((s) => s.cachePolicy);
  const setCachePolicy = useSettingsStore((s) => s.setCachePolicy);
  const thumbnailSizes = useSettingsStore((s) => s.thumbnailSizes);
  const setThumbnailSizes = useSettingsStore((s) => s.setThumbnailSizes);
  const folderThumbnails = useSettingsStore((s) => s.folderThumbnails);
  const setFolderThumbnails = useSettingsStore((s) => s.setFolderThumbnails);

  const [formatsText, setFormatsText] = useState(formats.join(", "));
  const [thumbSizesText, setThumbSizesText] = useState(
    thumbnailSizes.join(", "),
  );

  const commitFormats = () => {
    const next = formatsText
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean)
      .map((value) => (value.startsWith(".") ? value : `.${value}`));
    if (next.length > 0) {
      setFormats([...new Set(next)]);
      setFormatsText([...new Set(next)].join(", "));
    }
  };

  const commitThumbSizes = () => {
    const next = thumbSizesText
      .split(",")
      .map((value) => Number.parseInt(value.trim(), 10))
      .filter((value) => Number.isFinite(value) && value > 0 && value <= 4096)
      .sort((a, b) => a - b);
    if (next.length > 0) {
      setThumbnailSizes([...new Set(next)]);
      setThumbSizesText([...new Set(next)].join(", "));
    } else {
      setThumbSizesText(thumbnailSizes.join(", "));
    }
  };

  const categoryLabels: Record<Category, string> = {
    appearance: "Appearance",
    gallery: "Gallery",
    files: "Files",
    archive: t.archive.settingsSection,
    cache: t.cache.section,
    advanced: "Advanced",
  };

  const supportedCategories = categories.filter((item) => {
    if (item === "archive" || item === "cache") {
      return platform.capabilities.canBrowseArchives;
    }
    return true;
  });

  return (
    <div className="flex h-full overflow-hidden bg-background">
      <nav className="w-56 shrink-0 border-r border-border p-4">
        <h1 className="mb-4 text-lg font-semibold">{t.settings.title}</h1>
        <div className="grid gap-1">
          {supportedCategories.map((item) => (
            <Link
              key={item}
              href={`/settings/${item}`}
              className={cn(
                "rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                item === category && "bg-accent text-accent-foreground",
              )}
            >
              {categoryLabels[item]}
            </Link>
          ))}
        </div>
      </nav>

      <div className="flex-1 overflow-auto p-6">
        <div className="mx-auto max-w-3xl space-y-6">
          <header>
            <h2 className="text-2xl font-semibold">
              {categoryLabels[category]}
            </h2>
          </header>

          {category === "appearance" && (
            <section className="grid gap-5 rounded-lg border border-border bg-card p-5 text-card-foreground">
              <Field label="Theme">
                <Select
                  value={theme}
                  onChange={(event) =>
                    setTheme(event.target.value as ThemePreference)
                  }
                >
                  <option value="system">System</option>
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                </Select>
              </Field>
              <Field label={t.settings.language}>
                <Select
                  value={language}
                  onChange={(event) =>
                    setLanguage(event.target.value as Locale)
                  }
                >
                  <option value="en">English</option>
                  <option value="zh">简体中文</option>
                </Select>
              </Field>
            </section>
          )}

          {category === "gallery" && (
            <section className="grid gap-5 rounded-lg border border-border bg-card p-5 text-card-foreground">
              <Field label={t.settings.sortMethod}>
                <Select
                  value={sortMethod}
                  onChange={(event) =>
                    setSortMethod(event.target.value as SortMethod)
                  }
                >
                  <option value="name-asc">{t.settings.nameAsc}</option>
                  <option value="name-desc">{t.settings.nameDesc}</option>
                  <option value="time-asc">{t.settings.timeAsc}</option>
                  <option value="time-desc">{t.settings.timeDesc}</option>
                </Select>
              </Field>
              <Field label={t.settings.pageSize}>
                <Input
                  type="number"
                  min={10}
                  max={200}
                  step={10}
                  value={pageSize}
                  onChange={(event) => setPageSize(Number(event.target.value))}
                />
              </Field>
              <div className="flex items-center justify-between gap-3 rounded-md border border-border p-3 text-sm">
                <span>{t.settings.showGridPosition}</span>
                <Switch
                  checked={showGridPosition}
                  onChange={(event) =>
                    setShowGridPosition(event.currentTarget.checked)
                  }
                />
              </div>
              <Field label={t.settings.columns}>
                <div className="grid gap-2">
                  {Object.keys(breakpoints)
                    .map(Number)
                    .sort((a, b) => a - b)
                    .map((breakpoint) => (
                      <div
                        key={breakpoint}
                        className="grid grid-cols-[1fr_88px] items-center gap-3"
                      >
                        <span className="text-sm text-muted-foreground">
                          {breakpoint}px
                        </span>
                        <Input
                          type="number"
                          min={1}
                          max={10}
                          value={breakpoints[breakpoint]}
                          onChange={(event) => {
                            const value = Number(event.target.value);
                            if (value >= 1 && value <= 10) {
                              setBreakpoints({
                                ...breakpoints,
                                [breakpoint]: value,
                              });
                            }
                          }}
                        />
                      </div>
                    ))}
                </div>
              </Field>
            </section>
          )}

          {category === "files" && (
            <section className="grid gap-5 rounded-lg border border-border bg-card p-5 text-card-foreground">
              <Field label={t.settings.formats} hint={t.settings.formatsHint}>
                <Input
                  value={formatsText}
                  onChange={(event) => setFormatsText(event.target.value)}
                  onBlur={commitFormats}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") commitFormats();
                  }}
                />
              </Field>
              <div className="flex items-center justify-between gap-3 rounded-md border border-border p-3 text-sm">
                <span>{t.settings.confirmDelete}</span>
                <Switch
                  checked={confirmDelete}
                  onChange={(event) =>
                    setConfirmDelete(event.currentTarget.checked)
                  }
                />
              </div>
              <div className="flex items-center justify-between gap-3 rounded-md border border-border p-3 text-sm">
                <span>{t.settings.showDeleteToast}</span>
                <Switch
                  checked={showDeleteToast}
                  onChange={(event) =>
                    setShowDeleteToast(event.currentTarget.checked)
                  }
                />
              </div>
            </section>
          )}

          {category === "archive" &&
            platform.capabilities.canBrowseArchives && (
              <section className="grid gap-5 rounded-lg border border-border bg-card p-5 text-card-foreground">
                <Field label={t.archive.cacheCleanup}>
                  <Select
                    value={cacheCleanupStrategy}
                    onChange={(event) =>
                      setCacheCleanupStrategy(
                        event.target.value as CacheCleanupStrategy,
                      )
                    }
                  >
                    <option value="auto-clean">{t.archive.autoClean}</option>
                    <option value="keep-all">{t.archive.keepAll}</option>
                  </Select>
                </Field>
                <Field label={t.archive.passwordStorage}>
                  <Select
                    value={passwordStorageMode}
                    onChange={(event) =>
                      setPasswordStorageMode(
                        event.target.value as PasswordStorageMode,
                      )
                    }
                  >
                    <option value="none">{t.archive.dontSave}</option>
                    <option value="plaintext">{t.archive.plaintext}</option>
                    <option value="master">{t.archive.masterPassword}</option>
                  </Select>
                </Field>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate("/cache")}
                >
                  {t.archive.manageCache}
                </Button>
              </section>
            )}

          {category === "cache" && platform.capabilities.canBrowseArchives && (
            <section className="grid gap-5 rounded-lg border border-border bg-card p-5 text-card-foreground">
              <Field label={t.cache.extractedMode}>
                <Select
                  value={cachePolicy.extracted.mode}
                  onChange={(event) =>
                    updatePolicy(cachePolicy, setCachePolicy, {
                      extracted: {
                        ...cachePolicy.extracted,
                        mode: event.target.value as ExtractedMode,
                      },
                    })
                  }
                >
                  <option value="no-cache">
                    {t.cache.extractedModeNoCache}
                  </option>
                  <option value="lru-capped">{t.cache.extractedModeLru}</option>
                  <option value="unlimited">
                    {t.cache.extractedModeUnlimited}
                  </option>
                </Select>
              </Field>
              {cachePolicy.extracted.mode === "lru-capped" && (
                <Field label={t.cache.extractedMaxSizePerSource}>
                  <Input
                    type="number"
                    min={0}
                    value={
                      cachePolicy.extracted.maxSizePerSource != null
                        ? Math.round(
                            cachePolicy.extracted.maxSizePerSource / MB,
                          )
                        : ""
                    }
                    onChange={(event) => {
                      const mb = Number(event.target.value);
                      updatePolicy(cachePolicy, setCachePolicy, {
                        extracted: {
                          ...cachePolicy.extracted,
                          maxSizePerSource: mb > 0 ? mb * MB : undefined,
                        },
                      });
                    }}
                  />
                </Field>
              )}
              {cachePolicy.extracted.mode !== "no-cache" && (
                <Field label={t.cache.extractedMinFileSize}>
                  <Input
                    type="number"
                    min={0}
                    value={
                      cachePolicy.extracted.minFileSize != null
                        ? Math.round(cachePolicy.extracted.minFileSize / MB)
                        : ""
                    }
                    onChange={(event) => {
                      const mb = Number(event.target.value);
                      updatePolicy(cachePolicy, setCachePolicy, {
                        extracted: {
                          ...cachePolicy.extracted,
                          minFileSize: mb > 0 ? mb * MB : undefined,
                        },
                      });
                    }}
                  />
                </Field>
              )}
              <Field label={t.cache.thumbnailRetention}>
                <Select
                  value={cachePolicy.thumbnails.retain}
                  onChange={(event) =>
                    updatePolicy(cachePolicy, setCachePolicy, {
                      thumbnails: {
                        ...cachePolicy.thumbnails,
                        retain: event.target.value as ThumbRetain,
                      },
                    })
                  }
                >
                  <option value="until-source-removed">
                    {t.cache.thumbnailRetainUntilRemoved}
                  </option>
                  <option value="lru-capped">
                    {t.cache.thumbnailRetainLru}
                  </option>
                </Select>
              </Field>
              {cachePolicy.thumbnails.retain === "lru-capped" && (
                <Field label={t.cache.thumbnailMaxTotalSize}>
                  <Input
                    type="number"
                    min={0}
                    value={
                      cachePolicy.thumbnails.maxTotalSize != null
                        ? Math.round(cachePolicy.thumbnails.maxTotalSize / MB)
                        : ""
                    }
                    onChange={(event) => {
                      const mb = Number(event.target.value);
                      updatePolicy(cachePolicy, setCachePolicy, {
                        thumbnails: {
                          ...cachePolicy.thumbnails,
                          maxTotalSize: mb > 0 ? mb * MB : undefined,
                        },
                      });
                    }}
                  />
                </Field>
              )}
              <Field
                label={t.cache.thumbnailSizes}
                hint={t.cache.thumbnailSizesHint}
              >
                <Input
                  value={thumbSizesText}
                  onChange={(event) => setThumbSizesText(event.target.value)}
                  onBlur={commitThumbSizes}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") commitThumbSizes();
                  }}
                />
              </Field>
              <Field
                label={t.cache.folderThumbnails}
                hint={t.cache.folderThumbnailsHint}
              >
                <Select
                  value={folderThumbnails}
                  onChange={(event) =>
                    setFolderThumbnails(
                      event.target.value as FolderThumbnailsMode,
                    )
                  }
                >
                  <option value="off">{t.cache.folderThumbnailsOff}</option>
                  <option value="lazy">{t.cache.folderThumbnailsLazy}</option>
                </Select>
              </Field>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => setClearConfirm("thumbs")}
                >
                  {t.cache.clearThumbs}
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => setClearConfirm("extracted")}
                >
                  {t.cache.clearExtracted}
                </Button>
              </div>
            </section>
          )}

          {category === "advanced" && (
            <section className="grid gap-4 rounded-lg border border-border bg-card p-5 text-card-foreground">
              <div className="flex items-center gap-3 text-sm">
                <Checkbox checked readOnly />
                <span>Existing persisted setting keys are preserved.</span>
              </div>
            </section>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={clearConfirm !== null}
        title={
          clearConfirm === "thumbs"
            ? t.cache.clearThumbs
            : t.cache.clearExtracted
        }
        cancelLabel={t.archive.cancel}
        confirmLabel={t.cache.confirm}
        destructive
        onCancel={() => setClearConfirm(null)}
        onConfirm={async () => {
          const target = clearConfirm;
          setClearConfirm(null);
          if (target === "thumbs") await platform.clearThumbnails();
          if (target === "extracted") await platform.clearExtracted();
        }}
      >
        <p>
          {clearConfirm === "thumbs"
            ? t.cache.clearThumbsConfirm
            : t.cache.clearExtractedConfirm}
        </p>
      </ConfirmDialog>
    </div>
  );
}
