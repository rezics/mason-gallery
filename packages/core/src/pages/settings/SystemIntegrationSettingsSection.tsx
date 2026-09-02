import { Loader2, RotateCcw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { usePlatform } from "@/context/PlatformContext";
import { useI18n } from "@/i18n";
import type {
  SystemIntegrationRegistration,
  SystemIntegrationSelection,
  SystemIntegrationStatus,
  SystemIntegrationTargetStatus,
} from "@/types/platform";
import { SettingsSection } from "./SettingsField";

function isSelected(target: SystemIntegrationTargetStatus): boolean {
  return target.state !== "disabled";
}

function stateVariant(
  state: SystemIntegrationRegistration,
): "default" | "secondary" | "destructive" {
  if (state === "needs-repair") return "destructive";
  return state === "disabled" ? "secondary" : "default";
}

export function SystemIntegrationSettingsSection() {
  const t = useI18n();
  const platform = usePlatform();
  const [status, setStatus] = useState<SystemIntegrationStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  const loadStatus = useCallback(async () => {
    if (!platform.getSystemIntegrationStatus) {
      setError(true);
      return;
    }
    setBusy(true);
    setError(false);
    try {
      setStatus(await platform.getSystemIntegrationStatus());
    } catch (loadError) {
      console.error("Failed to inspect system integration:", loadError);
      setError(true);
    } finally {
      setBusy(false);
    }
  }, [platform]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  const applySelection = async (selection: SystemIntegrationSelection) => {
    if (
      !platform.setSystemIntegration ||
      !platform.getSystemIntegrationStatus
    ) {
      setError(true);
      return;
    }
    setBusy(true);
    setError(false);
    try {
      setStatus(await platform.setSystemIntegration(selection));
    } catch (updateError) {
      console.error("Failed to update system integration:", updateError);
      setError(true);
      try {
        setStatus(await platform.getSystemIntegrationStatus());
      } catch (refreshError) {
        console.error("Failed to refresh system integration:", refreshError);
      }
    } finally {
      setBusy(false);
    }
  };

  if (!status) {
    return (
      <SettingsSection>
        <div className="flex min-h-24 items-center justify-center">
          {busy ? (
            <Loader2
              className="size-5 animate-spin text-muted-foreground"
              aria-label={t("settings:systemIntegrationLoading")}
            />
          ) : (
            <Button type="button" variant="outline" onClick={loadStatus}>
              {t("settings:systemIntegrationRetry")}
            </Button>
          )}
        </div>
        {error && (
          <p className="text-sm text-destructive" role="alert">
            {t("settings:systemIntegrationError")}
          </p>
        )}
      </SettingsSection>
    );
  }

  const selection: SystemIntegrationSelection = {
    folders: isSelected(status.folders),
    archives: isSelected(status.archives),
  };
  const configurable =
    status.folders.configurable || status.archives.configurable;
  const integrationEnabled = selection.folders || selection.archives;
  const descriptionKey =
    status.platform === "windows"
      ? "settings:systemIntegrationWindowsHint"
      : status.platform === "macos"
        ? "settings:systemIntegrationMacosHint"
        : configurable
          ? "settings:systemIntegrationLinuxAppImageHint"
          : "settings:systemIntegrationLinuxPackageHint";

  const stateLabel = (state: SystemIntegrationRegistration) =>
    t(`settings:systemIntegrationState_${state}`);

  const targetRow = (
    kind: keyof SystemIntegrationSelection,
    target: SystemIntegrationTargetStatus,
    label: string,
    hint: string,
  ) => (
    <div className="flex items-start justify-between gap-4 rounded-xl border border-border p-4">
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium">{label}</span>
          <Badge variant={stateVariant(target.state)}>
            {stateLabel(target.state)}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">{hint}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {target.state === "needs-repair" && target.configurable && (
          <Button
            type="button"
            variant="outline"
            size="icon"
            disabled={busy}
            aria-label={t("settings:systemIntegrationRepair", {
              target: label,
            })}
            onClick={() => void applySelection({ ...selection, [kind]: true })}
          >
            <RotateCcw />
          </Button>
        )}
        <Switch
          aria-label={label}
          checked={isSelected(target)}
          disabled={busy || !target.configurable}
          onCheckedChange={(checked) =>
            void applySelection({ ...selection, [kind]: checked })
          }
        />
      </div>
    </div>
  );

  return (
    <SettingsSection>
      <p className="text-sm text-muted-foreground">{t(descriptionKey)}</p>

      {configurable && (
        <div className="flex items-center justify-between gap-4 rounded-xl bg-muted/50 p-4">
          <div>
            <p className="text-sm font-medium">
              {t("settings:systemIntegrationMaster")}
            </p>
            <p className="text-sm text-muted-foreground">
              {t("settings:systemIntegrationNoDefaultHint")}
            </p>
          </div>
          <Switch
            aria-label={t("settings:systemIntegrationMaster")}
            checked={integrationEnabled}
            disabled={busy}
            onCheckedChange={(checked) =>
              void applySelection({ folders: checked, archives: checked })
            }
          />
        </div>
      )}

      <div className="grid gap-3">
        {targetRow(
          "folders",
          status.folders,
          t("settings:systemIntegrationFolders"),
          t("settings:systemIntegrationFoldersHint"),
        )}
        {targetRow(
          "archives",
          status.archives,
          t("settings:systemIntegrationArchives"),
          t("settings:systemIntegrationArchivesHint"),
        )}
      </div>

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {t("settings:systemIntegrationError")}
        </p>
      )}
    </SettingsSection>
  );
}
