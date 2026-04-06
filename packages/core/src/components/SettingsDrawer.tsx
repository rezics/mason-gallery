import AddIcon from "@mui/icons-material/Add";
import CloseIcon from "@mui/icons-material/Close";
import DeleteIcon from "@mui/icons-material/Delete";
import {
  Box,
  Chip,
  Divider,
  Drawer,
  FormControlLabel,
  IconButton,
  MenuItem,
  Select,
  Slider,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import { useState } from "react";
import { useI18n } from "@/i18n";
import { useAppStore } from "@/stores/appStore";
import { useSettingsStore } from "@/stores/settingsStore";
import type { Locale, SortMethod } from "@/types";

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
  const showGridPosition = useSettingsStore((s) => s.showGridPosition);
  const setShowGridPosition = useSettingsStore((s) => s.setShowGridPosition);

  const [newFormat, setNewFormat] = useState("");
  const [newBpWidth, setNewBpWidth] = useState("");

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

        {/* Show Grid Position */}
        <FormControlLabel
          control={
            <Switch
              checked={showGridPosition}
              onChange={(e) => setShowGridPosition(e.target.checked)}
            />
          }
          label={t.settings.showGridPosition}
          sx={{ mb: 2 }}
        />

        {/* Waterfall Column Breakpoints */}
        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          {t.settings.columns}
        </Typography>
        {(() => {
          const sortedKeys = Object.keys(breakpoints)
            .map(Number)
            .sort((a, b) => a - b);
          return sortedKeys.map((bp, i) => {
            const nextBp = sortedKeys[i + 1];
            const rangeLabel =
              nextBp !== undefined ? `${bp}–${nextBp - 1} px` : `≥ ${bp} px`;
            return (
              <Box
                key={bp}
                sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}
              >
                <Typography
                  variant="body2"
                  sx={{ minWidth: 100 }}
                  title={rangeLabel}
                >
                  {rangeLabel}
                </Typography>
                <TextField
                  size="small"
                  type="number"
                  value={breakpoints[bp]}
                  onChange={(e) => {
                    const val = Number.parseInt(e.target.value, 10);
                    if (val >= 1 && val <= 10) {
                      setBreakpoints({ ...breakpoints, [bp]: val });
                    }
                  }}
                  slotProps={{ htmlInput: { min: 1, max: 10 } }}
                  sx={{ width: 80 }}
                />
                <Typography variant="body2" color="text.secondary">
                  cols
                </Typography>
                {sortedKeys.length > 1 && (
                  <IconButton
                    size="small"
                    onClick={() => {
                      const next = { ...breakpoints };
                      delete next[bp];
                      setBreakpoints(next);
                    }}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                )}
              </Box>
            );
          });
        })()}
        <Box sx={{ display: "flex", gap: 1, mb: 2, alignItems: "center" }}>
          <TextField
            size="small"
            type="number"
            placeholder="Width (px)"
            value={newBpWidth}
            onChange={(e) => setNewBpWidth(e.target.value)}
            slotProps={{ htmlInput: { min: 0 } }}
            sx={{ width: 100 }}
          />
          <IconButton
            size="small"
            onClick={() => {
              const w = Number.parseInt(newBpWidth, 10);
              if (!Number.isNaN(w) && w >= 0 && !(w in breakpoints)) {
                setBreakpoints({ ...breakpoints, [w]: 1 });
                setNewBpWidth("");
              }
            }}
          >
            <AddIcon />
          </IconButton>
        </Box>
      </Box>
    </Drawer>
  );
}
