import { Box } from "@chakra-ui/react";

import LumiTransportProvider from "./components/LumiTransportProvider";
import DashboardGrid from "./components/Dashboard/DashboardGrid";
import Navbar from "./components/Shell/Navbar";
import useSettingsSync from "./hooks/useSettingsSync";

/**
 * The dashboard shell.
 *
 * The layout is no longer hard-coded here: panels are placed by the user and
 * persisted per-account (see stores/dashboard.ts and hooks/useSettingsSync.ts).
 * This component only wires the transport, the settings sync and the grid
 * together.
 */
function App() {
  const { status: syncStatus } = useSettingsSync();

  return (
    <Box minH="100vh" bg="app.bg">
      <Navbar syncStatus={syncStatus} />

      <LumiTransportProvider>
        <Box px={{ base: 2, md: 3 }} py={3}>
          <DashboardGrid />
        </Box>
      </LumiTransportProvider>
    </Box>
  );
}

export default App;
