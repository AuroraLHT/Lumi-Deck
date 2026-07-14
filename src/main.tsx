import { ChakraProvider, ColorModeScript } from "@chakra-ui/react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";

import theme from "./theme.ts";
import App from "./App.tsx";
import LoginPage from "./components/Auth/LoginPage.tsx";
import ProtectedRoute from "./components/Auth/ProtectedRoute.tsx";

const queryClient = new QueryClient();

createRoot(document.getElementById("root")!).render(
  // StrictMode stays off: it double-invokes effects, which opens and immediately
  // tears down every websocket and MJPEG stream on mount.
  <ChakraProvider theme={theme}>
    <ColorModeScript initialColorMode={theme.config.initialColorMode} />
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <App />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      <ReactQueryDevtools />
    </QueryClientProvider>
  </ChakraProvider>
);
