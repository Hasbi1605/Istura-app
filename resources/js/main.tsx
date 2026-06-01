import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
// Poster fonts (Montserrat untuk judul, Playfair Display untuk isi) — di-bundle
// lokal via @fontsource supaya ter-embed di PNG hasil ekspor, tidak bergantung
// CDN. Hanya weight latin yang dipakai poster yang diimpor.
import "@fontsource/montserrat/latin-700.css";
import "@fontsource/montserrat/latin-800.css";
import "@fontsource/playfair-display/latin-400.css";
import "@fontsource/playfair-display/latin-700.css";
import "@fontsource/playfair-display/latin-900.css";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
