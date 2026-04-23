import { Box, CssBaseline, createTheme, ThemeProvider } from "@mui/material";
import type { ReactNode } from "react";
import { useEffect } from "react";
import { Route, Router, Switch } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import SettingsDrawer from "@/components/SettingsDrawer";
import { usePlatform } from "@/context/PlatformContext";
import { getTranslations, I18nContext } from "@/i18n";
import AboutPage from "@/pages/AboutPage";
import CachePage from "@/pages/CachePage";
import HomePage from "@/pages/HomePage";
import { useSettingsStore } from "@/stores/settingsStore";
import { useViewerStore } from "@/stores/viewerStore";

const darkTheme = createTheme({
  palette: {
    mode: "dark",
    primary: {
      main: "#f4606c",
    },
  },
});

interface ShellProps {
  titlebar: ReactNode;
  updateChecker: ReactNode;
}

export default function Shell({ titlebar, updateChecker }: ShellProps) {
  const language = useSettingsStore((s) => s.language);
  const hydrate = useSettingsStore((s) => s.hydrate);
  const hydrated = useSettingsStore((s) => s._hydrated);
  const platform = usePlatform();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    const unsubscribe = platform.onThumbnailsReady(
      ({ sourceId, entryPath, thumbnails }) => {
        useViewerStore
          .getState()
          .patchThumbnails(sourceId, entryPath, thumbnails);
      },
    );
    return () => {
      unsubscribe();
    };
  }, [platform]);

  if (!hydrated) return null;

  const translations = getTranslations(language);

  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <I18nContext.Provider value={translations}>
        <Router hook={useHashLocation}>
          {titlebar}
          <Box
            sx={{
              pt: titlebar ? "36px" : 0,
              height: "100vh",
              overflow: "hidden",
            }}
          >
            <Switch>
              <Route path="/" component={HomePage} />
              <Route path="/about" component={AboutPage} />
              <Route path="/cache" component={CachePage} />
              <Route>
                <HomePage />
              </Route>
            </Switch>
          </Box>
          <SettingsDrawer />
          {updateChecker}
        </Router>
      </I18nContext.Provider>
    </ThemeProvider>
  );
}
