import { Box } from "@chakra-ui/react";
import { Outlet } from "react-router-dom";

import LumiTransportProvider from "./components/LumiTransportProvider";
import Navbar from "./components/Shell/Navbar";
import useSettingsSync from "./hooks/useSettingsSync";

/**
 * The app shell: navbar, transport and settings sync, around whichever page
 * the route picks -- the dashboard grid or the history browser.
 *
 * Both pages share the one transport, so switching between them neither
 * reconnects nor drops the app-wide streams (driver task results, mi_mode)
 * that `LumiTransportProvider` keeps alive.
 */
function App() {
  const { status: syncStatus } = useSettingsSync();

  return (
    <Box minH="100vh" bg="app.bg">
      <Navbar syncStatus={syncStatus} />

      <LumiTransportProvider>
        <Box px={{ base: 2, md: 3 }} py={3}>
          <Outlet />
        </Box>
      </LumiTransportProvider>
    </Box>
  );
}

export default App;
