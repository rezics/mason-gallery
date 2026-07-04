import { ArrowLeft, Check } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Input, Select, Switch } from "@/components/ui/field";
import { usePlatform } from "@/context/PlatformContext";
import { useI18n } from "@/i18n";
import { ACCENT_PRESET_IDS, THEME_PRESET_IDS } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { useSettingsStore } from "@/stores/settingsStore";
import type { Locale, SortMethod } from "@/types";
import type {
  AccentPreset,
  CacheCleanupStrategy,
  CachePolicy,
  ExtractedMode,
  FolderThumbnailsMode,
  PasswordStorageMode,
  ThemePreference,
  ThemePreset,
  ThumbRetain,
} from "@/types/platform";

const MB = 1024 * 1024;

const categories = [
  "appearance",
  "gallery",
  "files",
  "archive",
  "cache",
] as const;

type Category = (typeof categories)[number];

type BuiltInAccent = Exclude<AccentPreset, "custom">;

const accentSwatches: Record<BuiltInAccent, string> = {
  rose: "#e75b73",
  blue: "#3b82f6",
  amber: "#f59e0b",
  emerald: "#10b981",
  violet: "#8b5cf6",
};

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
  const themePreset = useSettingsStore((s) => s.themePreset);
  const setThemePreset = useSettingsStore((s) => s.setThemePreset);
  const accentPreset = useSettingsStore((s) => s.accentPreset);
  const setAccentPreset = useSettingsStore((s) => s.setAccentPreset);
  const customAccent = useSettingsStore((s) => s.customAccent);
  const setCustomAccent = useSettingsStore((s) => s.setCustomAccent);
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
    appearance: t.settings.appearance,
    gallery: t.settings.gallery,
    files: t.settings.files,
    archive: t.archive.settingsSection,
    cache: t.cache.section,
  };

  const themePresetLabels: Record<ThemePreset, string> = {
    mason: t.settings.presetMason,
    graphite: t.settings.presetGraphite,
    midnight: t.settings.presetMidnight,
    paper: t.settings.presetPaper,
    custom: t.settings.customAccent,
  };

  const accentLabels: Record<AccentPreset, string> = {
    rose: t.settings.accentRose,
    blue: t.settings.accentBlue,
    amber: t.settings.accentAmber,
    emerald: t.settings.accentEmerald,
    violet: t.settings.accentViolet,
    custom: t.settings.customAccent,
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
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="mb-3 justify-start px-2"
          onClick={() => navigate("/")}
        >
          <ArrowLeft />
          {t.settings.backToGallery}
        </Button>
        <h1 className="mb-4 text-lg font-semibold">{t.settings.preferences}</h1>
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
              <Field label={t.settings.themeMode}>
                <Select
                  value={theme}
                  onChange={(event) =>
                    setTheme(event.target.value as ThemePreference)
                  }
                >
                  <option value="system">{t.settings.modeSystem}</option>
                  <option value="light">{t.settings.modeLight}</option>
                  <option value="dark">{t.settings.modeDark}</option>
                </Select>
              </Field>

              <Field label={t.settings.themePreset}>
                <div className="grid gap-2 sm:grid-cols-2">
                  {THEME_PRESET_IDS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      className={cn(
                        "flex min-h-20 items-start justify-between rounded-md border border-border bg-background p-3 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground",
                        themePreset === preset &&
                          "border-primary bg-accent text-accent-foreground",
                      )}
                      onClick={() => setThemePreset(preset)}
                    >
                      <span className="font-medium">
                        {themePresetLabels[preset]}
                      </span>
                      {themePreset === preset && <Check className="size-4" />}
                    </button>
                  ))}
                </div>
              </Field>

              <Field label={t.settings.accentColor}>
                <div className="flex flex-wrap gap-2">
                  {ACCENT_PRESET_IDS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      title={accentLabels[preset]}
                      className={cn(
                        "flex h-9 items-center gap-2 rounded-md border border-border bg-background px-2 text-sm hover:bg-accent hover:text-accent-foreground",
                        accentPreset === preset && "border-primary",
                      )}
                      onClick={() => setAccentPreset(preset)}
                    >
                      <span
                        className="size-5 rounded-full border border-black/10"
                        style={{ backgroundColor: accentSwatches[preset] }}
                      />
                      {accentLabels[preset]}
                      {accentPreset === preset && <Check className="size-4" />}
                    </button>
                  ))}
                  <button
                    type="button"
                    className={cn(
                      "flex h-9 items-center gap-2 rounded-md border border-border bg-background px-2 text-sm hover:bg-accent hover:text-accent-foreground",
                      accentPreset === "custom" && "border-primary",
                    )}
                    onClick={() => setAccentPreset("custom")}
                  >
                    <span
                      className="size-5 rounded-full border border-black/10"
                      style={{ backgroundColor: customAccent }}
                    />
                    {t.settings.customAccent}
                    {accentPreset === "custom" && <Check className="size-4" />}
                  </button>
                </div>
              </Field>

              {accentPreset === "custom" && (
                <Field label={t.settings.customAccent}>
                  <Input
                    type="color"
                    value={customAccent}
                    onChange={(event) => setCustomAccent(event.target.value)}
                  />
                </Field>
              )}

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

              <div className="rounded-md border border-border bg-background p-4">
                <div className="mb-3 text-sm font-medium">
                  {t.settings.preview}
                </div>
                <div className="grid gap-3 sm:grid-cols-[160px_1fr]">
                  <div className="rounded-md border border-border bg-card p-3 text-sm">
                    <div className="mb-2 h-2 w-16 rounded bg-primary" />
                    <div className="space-y-1">
                      <div className="h-2 rounded bg-muted" />
                      <div className="h-2 w-2/3 rounded bg-muted" />
                    </div>
                  </div>
                  <div className="rounded-md border border-border bg-card p-3">
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-sm font-medium">Mason Gallery</span>
                      <Button type="button" size="sm">
                        {accentLabels[accentPreset]}
                      </Button>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="aspect-[3/4] rounded bg-muted" />
                      <div className="aspect-square rounded bg-accent" />
                      <div className="aspect-[4/5] rounded bg-muted" />
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setTheme("system");
                    setThemePreset("mason");
                    setAccentPreset("rose");
                    setCustomAccent("#e75b73");
                  }}
                >
                  {t.settings.resetTheme}
                </Button>
              </div>
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
                  onClick={() => navigate("/manage/cache")}
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
