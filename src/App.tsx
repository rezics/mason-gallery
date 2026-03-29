import { Box, CssBaseline, createTheme, ThemeProvider } from "@mui/material";
import { useEffect } from "react";
import { Route, Router, Switch } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import SettingsDrawer from "@/components/SettingsDrawer";
import Titlebar from "@/components/Titlebar";
import UpdateChecker from "@/components/UpdateChecker";
import { getTranslations, I18nContext } from "@/i18n";
import AboutPage from "@/pages/AboutPage";
import HomePage from "@/pages/HomePage";
import { useSettingsStore } from "@/stores/settingsStore";

const darkTheme = createTheme({
  palette: {
    mode: "dark",
  },
});

function App() {
  const language = useSettingsStore((s) => s.language);
  const hydrate = useSettingsStore((s) => s.hydrate);
  const hydrated = useSettingsStore((s) => s._hydrated);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  if (!hydrated) return null;

  const translations = getTranslations(language);

  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <I18nContext.Provider value={translations}>
        <Router hook={useHashLocation}>
          <Titlebar />
          <Box sx={{ pt: "36px", height: "100vh", overflow: "hidden" }}>
            <Switch>
              <Route path="/" component={HomePage} />
              <Route path="/about" component={AboutPage} />
              <Route>
                <HomePage />
              </Route>
            </Switch>
          </Box>
          <SettingsDrawer />
          <UpdateChecker />
        </Router>
      </I18nContext.Provider>
    </ThemeProvider>
  );
}

export default App;
