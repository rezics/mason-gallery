import AddIcon from "@mui/icons-material/Add";
import CloseIcon from "@mui/icons-material/Close";
import {
  Box,
  Chip,
  Divider,
  Drawer,
  IconButton,
  MenuItem,
  Select,
  Slider,
  TextField,
  Typography,
} from "@mui/material";
import { useState } from "react";
import { useI18n } from "@/i18n";
import { useAppStore } from "@/stores/appStore";
import { useSettingsStore } from "@/stores/settingsStore";
import type { ColumnBreakpoints, Locale, SortMethod } from "@/types";

export default function SettingsDrawer() {
  const t = useI18n();
  const isOpen = useAppStore((s) => s.isSettingsOpen);
  const setOpen = useAppStore((s) => s.setSettingsOpen);

  const formats = useSettingsStore((s) => s.formats);
  const setFormats = useSettingsStore((s) => s.setFormats);
  const sortMethod = useSettingsStore((s) => s.sortMethod);
  const setSortMethod = useSettingsStore((s) => s.setSortMethod);
  const pageSize = useSettingsStore((s) => s.pageSize);
  const setPageSize = useSettingsStore((s) => s.setPageSize);
  const language = useSettingsStore((s) => s.language);
  const setLanguage = useSettingsStore((s) => s.setLanguage);
  const breakpoints = useSettingsStore((s) => s.breakpoints);
  const setBreakpoints = useSettingsStore((s) => s.setBreakpoints);

  const [newFormat, setNewFormat] = useState("");

  const handleAddFormat = () => {
    const fmt = newFormat.trim().toLowerCase();
    if (fmt && !formats.includes(fmt.startsWith(".") ? fmt : `.${fmt}`)) {
      setFormats([...formats, fmt.startsWith(".") ? fmt : `.${fmt}`]);
      setNewFormat("");
    }
  };

  const handleRemoveFormat = (fmt: string) => {
    setFormats(formats.filter((f) => f !== fmt));
  };

  return (
    <Drawer
      anchor="right"
      open={isOpen}
      onClose={() => setOpen(false)}
      sx={{ "& .MuiDrawer-paper": { width: 340, pt: "44px" } }}
    >
      <Box sx={{ p: 2 }}>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            mb: 2,
          }}
        >
          <Typography variant="h6">{t.settings.title}</Typography>
          <IconButton onClick={() => setOpen(false)} size="small">
            <CloseIcon />
          </IconButton>
        </Box>

        <Divider sx={{ mb: 2 }} />

        {/* Language */}
        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          {t.settings.language}
        </Typography>
        <Select
          fullWidth
          size="small"
          value={language}
          onChange={(e) => setLanguage(e.target.value as Locale)}
          sx={{ mb: 2 }}
        >
          <MenuItem value="en">English</MenuItem>
          <MenuItem value="zh">简体中文</MenuItem>
        </Select>

        {/* Sort Method */}
        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          {t.settings.sortMethod}
        </Typography>
        <Select
          fullWidth
          size="small"
          value={sortMethod}
          onChange={(e) => setSortMethod(e.target.value as SortMethod)}
          sx={{ mb: 2 }}
        >
          <MenuItem value="name-asc">{t.settings.nameAsc}</MenuItem>
          <MenuItem value="name-desc">{t.settings.nameDesc}</MenuItem>
          <MenuItem value="time-asc">{t.settings.timeAsc}</MenuItem>
          <MenuItem value="time-desc">{t.settings.timeDesc}</MenuItem>
        </Select>

        {/* Page Size */}
        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          {t.settings.pageSize}
        </Typography>
        <Slider
          value={pageSize}
          onChange={(_, v) => setPageSize(v as number)}
          min={10}
          max={200}
          step={10}
          valueLabelDisplay="auto"
          sx={{ mb: 2 }}
        />

        {/* Image Formats */}
        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          {t.settings.formats}
        </Typography>
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mb: 1 }}>
          {formats.map((fmt) => (
            <Chip
              key={fmt}
              label={fmt}
              size="small"
              onDelete={() => handleRemoveFormat(fmt)}
            />
          ))}
        </Box>
        <Box sx={{ display: "flex", gap: 1, mb: 2 }}>
          <TextField
            size="small"
            placeholder={t.settings.addFormat}
            value={newFormat}
            onChange={(e) => setNewFormat(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAddFormat();
            }}
            sx={{ flex: 1 }}
          />
          <IconButton size="small" onClick={handleAddFormat}>
            <AddIcon />
          </IconButton>
        </Box>

        {/* Waterfall Column Breakpoints */}
        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          {t.settings.columns}
        </Typography>
        {([500, 800, 1200, 1400] as const).map((bp) => (
          <Box
            key={bp}
            sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}
          >
            <Typography variant="body2" sx={{ minWidth: 60 }}>
              {bp}px
            </Typography>
            <TextField
              size="small"
              type="number"
              value={breakpoints[bp]}
              onChange={(e) => {
                const val = Number.parseInt(e.target.value, 10);
                if (val >= 1 && val <= 10) {
                  setBreakpoints({
                    ...breakpoints,
                    [bp]: val,
                  } as ColumnBreakpoints);
                }
              }}
              slotProps={{ htmlInput: { min: 1, max: 10 } }}
              sx={{ width: 80 }}
            />
            <Typography variant="body2" color="text.secondary">
              cols
            </Typography>
          </Box>
        ))}
      </Box>
    </Drawer>
  );
}
