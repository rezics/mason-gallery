import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import GitHubIcon from "@mui/icons-material/GitHub";
import { Box, Button, Paper, Typography } from "@mui/material";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useLocation } from "wouter";
import { useI18n } from "@/i18n";

export default function AboutPage() {
  const t = useI18n();
  const [, navigate] = useLocation();

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100%",
        p: 4,
      }}
    >
      <Paper sx={{ p: 4, maxWidth: 400, textAlign: "center" }}>
        <Typography variant="h4" gutterBottom>
          {t.about.title}
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 1 }}>
          {t.about.description}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          {t.about.version}: 2.0.0
        </Typography>
        <Box sx={{ display: "flex", gap: 2, justifyContent: "center" }}>
          <Button
            variant="outlined"
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate("/")}
          >
            Back
          </Button>
          <Button
            variant="outlined"
            startIcon={<GitHubIcon />}
            onClick={() => openUrl("https://github.com")}
          >
            {t.about.github}
          </Button>
        </Box>
      </Paper>
    </Box>
  );
}
