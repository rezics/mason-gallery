import MoreVertIcon from "@mui/icons-material/MoreVert";
import RefreshIcon from "@mui/icons-material/Refresh";
import SettingsIcon from "@mui/icons-material/Settings";
import { SpeedDial, SpeedDialAction } from "@mui/material";
import { useI18n } from "@/i18n";
import { useAppStore } from "@/stores/appStore";

interface FabActionsProps {
  onRefresh: () => void;
}

export default function FabActions({ onRefresh }: FabActionsProps) {
  const t = useI18n();
  const toggleSettings = useAppStore((s) => s.toggleSettings);

  return (
    <SpeedDial
      ariaLabel="Actions"
      sx={{ position: "fixed", bottom: 24, right: 24 }}
      icon={<MoreVertIcon />}
    >
      <SpeedDialAction
        icon={<RefreshIcon />}
        tooltipTitle={t.actions.refresh}
        onClick={onRefresh}
      />
      <SpeedDialAction
        icon={<SettingsIcon />}
        tooltipTitle={t.actions.settings}
        onClick={toggleSettings}
      />
    </SpeedDial>
  );
}
