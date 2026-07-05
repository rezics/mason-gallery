import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { useI18n } from "@/i18n";
import { useSettingsStore } from "@/stores/settingsStore";
import type {
  ExtractedMode,
  FolderThumbnailsMode,
  ThumbRetain,
} from "@/types/platform";
import {
  MB,
  SettingsField,
  SettingsSection,
  updatePolicy,
} from "./SettingsField";

export function CacheSettingsSection({
  onClearRequested,
}: {
  onClearRequested: (target: "thumbs" | "extracted") => void;
}) {
  const t = useI18n();
  const cachePolicy = useSettingsStore((s) => s.cachePolicy);
  const setCachePolicy = useSettingsStore((s) => s.setCachePolicy);
  const thumbnailSizes = useSettingsStore((s) => s.thumbnailSizes);
  const setThumbnailSizes = useSettingsStore((s) => s.setThumbnailSizes);
  const folderThumbnails = useSettingsStore((s) => s.folderThumbnails);
  const setFolderThumbnails = useSettingsStore((s) => s.setFolderThumbnails);
  const [thumbSizesText, setThumbSizesText] = useState(
    thumbnailSizes.join(", "),
  );

  useEffect(() => {
    setThumbSizesText(thumbnailSizes.join(", "));
  }, [thumbnailSizes]);

  const commitThumbSizes = () => {
    const next = thumbSizesText
      .split(",")
      .map((value) => Number.parseInt(value.trim(), 10))
      .filter((value) => Number.isFinite(value) && value > 0 && value <= 4096)
      .sort((a, b) => a - b);
    if (next.length > 0) {
      const unique = [...new Set(next)];
      setThumbnailSizes(unique);
      setThumbSizesText(unique.join(", "));
    } else {
      setThumbSizesText(thumbnailSizes.join(", "));
    }
  };

  return (
    <SettingsSection>
      <SettingsField label={t("cache:extractedMode")}>
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
          <option value="no-cache">{t("cache:extractedModeNoCache")}</option>
          <option value="lru-capped">{t("cache:extractedModeLru")}</option>
          <option value="unlimited">{t("cache:extractedModeUnlimited")}</option>
        </Select>
      </SettingsField>
      {cachePolicy.extracted.mode === "lru-capped" && (
        <SettingsField label={t("cache:extractedMaxSizePerSource")}>
          <Input
            type="number"
            min={0}
            value={
              cachePolicy.extracted.maxSizePerSource != null
                ? Math.round(cachePolicy.extracted.maxSizePerSource / MB)
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
        </SettingsField>
      )}
      {cachePolicy.extracted.mode !== "no-cache" && (
        <SettingsField label={t("cache:extractedMinFileSize")}>
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
        </SettingsField>
      )}
      <SettingsField label={t("cache:thumbnailRetention")}>
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
            {t("cache:thumbnailRetainUntilRemoved")}
          </option>
          <option value="lru-capped">{t("cache:thumbnailRetainLru")}</option>
        </Select>
      </SettingsField>
      {cachePolicy.thumbnails.retain === "lru-capped" && (
        <SettingsField label={t("cache:thumbnailMaxTotalSize")}>
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
        </SettingsField>
      )}
      <SettingsField
        label={t("cache:thumbnailSizes")}
        hint={t("cache:thumbnailSizesHint")}
      >
        <Input
          value={thumbSizesText}
          onChange={(event) => setThumbSizesText(event.target.value)}
          onBlur={commitThumbSizes}
          onKeyDown={(event) => {
            if (event.key === "Enter") commitThumbSizes();
          }}
        />
      </SettingsField>
      <SettingsField
        label={t("cache:folderThumbnails")}
        hint={t("cache:folderThumbnailsHint")}
      >
        <Select
          value={folderThumbnails}
          onChange={(event) =>
            setFolderThumbnails(event.target.value as FolderThumbnailsMode)
          }
        >
          <option value="off">{t("cache:folderThumbnailsOff")}</option>
          <option value="lazy">{t("cache:folderThumbnailsLazy")}</option>
        </Select>
      </SettingsField>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="destructive"
          onClick={() => onClearRequested("thumbs")}
        >
          {t("cache:clearThumbs")}
        </Button>
        <Button
          type="button"
          variant="destructive"
          onClick={() => onClearRequested("extracted")}
        >
          {t("cache:clearExtracted")}
        </Button>
      </div>
    </SettingsSection>
  );
}
