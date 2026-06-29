import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
// Poster fonts — di-bundle lokal via @fontsource supaya ter-embed di PNG hasil
// ekspor, tidak bergantung CDN. Hanya weight latin yang dipakai poster yang
// diimpor. Montserrat = judul; Playfair Display = elemen display (angka/bulan);
// Lora = serif teks isi (agenda/jam/jumlah) yang lebih nyaman dibaca & tahan
// kompresi WhatsApp dibanding Playfair yang berkontras tinggi.
import "@fontsource/montserrat/latin-700.css";
import "@fontsource/montserrat/latin-800.css";
import "@fontsource/playfair-display/latin-400.css";
import "@fontsource/playfair-display/latin-500.css";
import "@fontsource/playfair-display/latin-600.css";
import "@fontsource/playfair-display/latin-700.css";
import "@fontsource/lora/latin-400.css";
import "@fontsource/lora/latin-500.css";
import "@fontsource/lora/latin-600.css";
import "@fontsource/lora/latin-700.css";
import "@fontsource/playfair-display/latin-900.css";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
