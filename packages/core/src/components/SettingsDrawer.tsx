import AddIcon from "@mui/icons-material/Add";
import CloseIcon from "@mui/icons-material/Close";
import DeleteIcon from "@mui/icons-material/Delete";
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
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
import { useLocation } from "wouter";
import { usePlatform } from "@/context/PlatformContext";
import { useI18n } from "@/i18n";
import { useAppStore } from "@/stores/appStore";
import { useSettingsStore } from "@/stores/settingsStore";
import type { Locale, SortMethod } from "@/types";
import type {
  CacheCleanupStrategy,
  CachePolicy,
  ExtractedMode,
  FolderThumbnailsMode,
  PasswordStorageMode,
  ThumbRetain,
} from "@/types/platform";

const MB = 1024 * 1024;

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

  const platform = usePlatform();
  const [, navigate] = useLocation();

  const [newFormat, setNewFormat] = useState("");
  const [newBpWidth, setNewBpWidth] = useState("");
  const [thumbSizesText, setThumbSizesText] = useState(
    thumbnailSizes.join(", "),
  );
  const [clearConfirm, setClearConfirm] = useState<
    null | "thumbs" | "extracted"
  >(null);

  const updateCachePolicy = (patch: Partial<CachePolicy>) => {
    setCachePolicy({ ...cachePolicy, ...patch });
  };

  const commitThumbSizes = () => {
    const parsed = thumbSizesText
      .split(",")
      .map((s) => Number.parseInt(s.trim(), 10))
      .filter((n) => Number.isFinite(n) && n > 0 && n <= 4096)
      .sort((a, b) => a - b);
    if (parsed.length > 0) {
      setThumbnailSizes(parsed);
      setThumbSizesText(parsed.join(", "));
    } else {
      // Empty/invalid input — revert to the last committed value rather than
      // persisting an empty array (the backend rejects `widths: []` anyway).
      setThumbSizesText(thumbnailSizes.join(", "));
    }
  };

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
          sx={{ mb: 1 }}
        />

        {/* Confirm before delete */}
        <FormControlLabel
          control={
            <Switch
              checked={confirmDelete}
              onChange={(e) => setConfirmDelete(e.target.checked)}
            />
          }
          label={t.settings.confirmDelete}
          sx={{ mb: 1 }}
        />

        {/* Show delete toast */}
        <FormControlLabel
          control={
            <Switch
              checked={showDeleteToast}
              onChange={(e) => setShowDeleteToast(e.target.checked)}
            />
          }
          label={t.settings.showDeleteToast}
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

        {/* Archives section (desktop only) */}
        {platform.capabilities.canBrowseArchives && (
          <>
            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle1" sx={{ mb: 2 }}>
              {t.archive.settingsSection}
            </Typography>

            {/* Cache Cleanup */}
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              {t.archive.cacheCleanup}
            </Typography>
            <Select
              fullWidth
              size="small"
              value={cacheCleanupStrategy}
              onChange={(e) =>
                setCacheCleanupStrategy(e.target.value as CacheCleanupStrategy)
              }
              sx={{ mb: 2 }}
            >
              <MenuItem value="auto-clean">{t.archive.autoClean}</MenuItem>
              <MenuItem value="keep-all">{t.archive.keepAll}</MenuItem>
            </Select>

            {/* Password Storage */}
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              {t.archive.passwordStorage}
            </Typography>
            <Select
              fullWidth
              size="small"
              value={passwordStorageMode}
              onChange={(e) =>
                setPasswordStorageMode(e.target.value as PasswordStorageMode)
              }
              sx={{ mb: 2 }}
            >
              <MenuItem value="none">{t.archive.dontSave}</MenuItem>
              <MenuItem value="plaintext">{t.archive.plaintext}</MenuItem>
              <MenuItem value="master">{t.archive.masterPassword}</MenuItem>
            </Select>

            {/* Manage Cache Link */}
            <Button
              variant="outlined"
              size="small"
              fullWidth
              onClick={() => {
                setOpen(false);
                navigate("/cache");
              }}
            >
              {t.archive.manageCache}
            </Button>

            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle1" sx={{ mb: 2 }}>
              {t.cache.section}
            </Typography>

            {/* Extracted cache mode */}
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              {t.cache.extractedMode}
            </Typography>
            <Select
              fullWidth
              size="small"
              value={cachePolicy.extracted.mode}
              onChange={(e) =>
                updateCachePolicy({
                  extracted: {
                    ...cachePolicy.extracted,
                    mode: e.target.value as ExtractedMode,
                  },
                })
              }
              sx={{ mb: 2 }}
            >
              <MenuItem value="no-cache">
                {t.cache.extractedModeNoCache}
              </MenuItem>
              <MenuItem value="lru-capped">{t.cache.extractedModeLru}</MenuItem>
              <MenuItem value="unlimited">
                {t.cache.extractedModeUnlimited}
              </MenuItem>
            </Select>

            {cachePolicy.extracted.mode === "lru-capped" && (
              <>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  {t.cache.extractedMaxSizePerSource}
                </Typography>
                <TextField
                  fullWidth
                  size="small"
                  type="number"
                  value={
                    cachePolicy.extracted.maxSizePerSource != null
                      ? Math.round(cachePolicy.extracted.maxSizePerSource / MB)
                      : ""
                  }
                  onChange={(e) => {
                    const mb = Number.parseInt(e.target.value, 10);
                    updateCachePolicy({
                      extracted: {
                        ...cachePolicy.extracted,
                        maxSizePerSource:
                          Number.isFinite(mb) && mb > 0 ? mb * MB : undefined,
                      },
                    });
                  }}
                  slotProps={{ htmlInput: { min: 0 } }}
                  sx={{ mb: 2 }}
                />
              </>
            )}

            {cachePolicy.extracted.mode !== "no-cache" && (
              <>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  {t.cache.extractedMinFileSize}
                </Typography>
                <TextField
                  fullWidth
                  size="small"
                  type="number"
                  value={
                    cachePolicy.extracted.minFileSize != null
                      ? Math.round(cachePolicy.extracted.minFileSize / MB)
                      : ""
                  }
                  onChange={(e) => {
                    const mb = Number.parseInt(e.target.value, 10);
                    updateCachePolicy({
                      extracted: {
                        ...cachePolicy.extracted,
                        minFileSize:
                          Number.isFinite(mb) && mb > 0 ? mb * MB : undefined,
                      },
                    });
                  }}
                  slotProps={{ htmlInput: { min: 0 } }}
                  sx={{ mb: 2 }}
                />
              </>
            )}

            {/* Thumbnail retention */}
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              {t.cache.thumbnailRetention}
            </Typography>
            <Select
              fullWidth
              size="small"
              value={cachePolicy.thumbnails.retain}
              onChange={(e) =>
                updateCachePolicy({
                  thumbnails: {
                    ...cachePolicy.thumbnails,
                    retain: e.target.value as ThumbRetain,
                  },
                })
              }
              sx={{ mb: 2 }}
            >
              <MenuItem value="until-source-removed">
                {t.cache.thumbnailRetainUntilRemoved}
              </MenuItem>
              <MenuItem value="lru-capped">
                {t.cache.thumbnailRetainLru}
              </MenuItem>
            </Select>

            {cachePolicy.thumbnails.retain === "lru-capped" && (
              <>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  {t.cache.thumbnailMaxTotalSize}
                </Typography>
                <TextField
                  fullWidth
                  size="small"
                  type="number"
                  value={
                    cachePolicy.thumbnails.maxTotalSize != null
                      ? Math.round(cachePolicy.thumbnails.maxTotalSize / MB)
                      : ""
                  }
                  onChange={(e) => {
                    const mb = Number.parseInt(e.target.value, 10);
                    updateCachePolicy({
                      thumbnails: {
                        ...cachePolicy.thumbnails,
                        maxTotalSize:
                          Number.isFinite(mb) && mb > 0 ? mb * MB : undefined,
                      },
                    });
                  }}
                  slotProps={{ htmlInput: { min: 0 } }}
                  sx={{ mb: 2 }}
                />
              </>
            )}

            {/* Thumbnail sizes */}
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              {t.cache.thumbnailSizes}
            </Typography>
            <TextField
              fullWidth
              size="small"
              value={thumbSizesText}
              placeholder={t.cache.thumbnailSizesHint}
              onChange={(e) => setThumbSizesText(e.target.value)}
              onBlur={commitThumbSizes}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitThumbSizes();
              }}
              sx={{ mb: 2 }}
            />

            {/* Folder thumbnail mode */}
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              {t.cache.folderThumbnails}
            </Typography>
            <Select
              fullWidth
              size="small"
              value={folderThumbnails}
              onChange={(e) =>
                setFolderThumbnails(e.target.value as FolderThumbnailsMode)
              }
              sx={{ mb: 1 }}
            >
              <MenuItem value="off">{t.cache.folderThumbnailsOff}</MenuItem>
              <MenuItem value="lazy">{t.cache.folderThumbnailsLazy}</MenuItem>
            </Select>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: "block", mb: 2 }}
            >
              {t.cache.folderThumbnailsHint}
            </Typography>

            {/* Clear actions */}
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
              <Button
                variant="outlined"
                size="small"
                color="error"
                onClick={() => setClearConfirm("thumbs")}
              >
                {t.cache.clearThumbs}
              </Button>
              <Button
                variant="outlined"
                size="small"
                color="error"
                onClick={() => setClearConfirm("extracted")}
              >
                {t.cache.clearExtracted}
              </Button>
            </Box>

            <Dialog
              open={clearConfirm !== null}
              onClose={() => setClearConfirm(null)}
            >
              <DialogTitle>
                {clearConfirm === "thumbs"
                  ? t.cache.clearThumbs
                  : t.cache.clearExtracted}
              </DialogTitle>
              <DialogContent>
                <Typography>
                  {clearConfirm === "thumbs"
                    ? t.cache.clearThumbsConfirm
                    : t.cache.clearExtractedConfirm}
                </Typography>
              </DialogContent>
              <DialogActions>
                <Button onClick={() => setClearConfirm(null)}>
                  {t.archive.cancel}
                </Button>
                <Button
                  color="error"
                  onClick={async () => {
                    const which = clearConfirm;
                    setClearConfirm(null);
                    if (which === "thumbs") {
                      await platform.clearThumbnails();
                    } else if (which === "extracted") {
                      await platform.clearExtracted();
                    }
                  }}
                >
                  {t.cache.confirm}
                </Button>
              </DialogActions>
            </Dialog>
          </>
        )}
      </Box>
    </Drawer>
  );
}
