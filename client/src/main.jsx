import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import { recoverStaleDynamicImport } from "./utils/chunkRecovery.js";
import App from "./App.jsx";
import "./i18n";
import { HelmetProvider } from "react-helmet-async";
import "@aejkatappaja/phantom-ui";
import { initializeAnalytics } from "./utils/analytics";

initializeAnalytics();

window.addEventListener("vite:preloadError", (event) => {
  if (recoverStaleDynamicImport(event.payload || event)) {
    event.preventDefault();
  }
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <HelmetProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <App />
          <ReactQueryDevtools initialIsOpen={false} />
        </QueryClientProvider>
      </ErrorBoundary>
    </HelmetProvider>
  </StrictMode>,
);
