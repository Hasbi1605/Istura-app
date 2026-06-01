// Render a DOM node (the weekly poster preview) to a downloadable PNG.
//
// Memakai html-to-image agar desain HTML/CSS poster bisa diubah jadi gambar
// siap-share ke grup WA. html-to-image diimpor dinamis supaya tidak menambah
// bobot bundle awal admin.

export type PosterImageResult = {
  filename: string;
};

const slugify = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "agenda";

// Pixel ratio tetap 2x supaya teks poster tajam saat dibuka di HP.
const PIXEL_RATIO = 2;

export async function exportPosterToPng(
  node: HTMLElement,
  options: { filenameBase: string },
): Promise<PosterImageResult> {
  const { toPng } = await import("html-to-image");

  // Preview menampilkan poster dengan CSS transform (zoom). Untuk ekspor kita
  // butuh resolusi penuh 1024px, jadi transform dinetralkan sementara saat
  // snapshot lalu dikembalikan.
  const prevTransform = node.style.transform;
  const prevTransformOrigin = node.style.transformOrigin;
  node.style.transform = "none";
  node.style.transformOrigin = "top left";

  try {
    const dataUrl = await toPng(node, {
      pixelRatio: PIXEL_RATIO,
      cacheBust: true,
      width: node.offsetWidth,
      height: node.offsetHeight,
      // Background eksplisit supaya tidak transparan kalau elemen tidak menutup
      // penuh (PNG transparan akan jelek di WA).
      backgroundColor: "#3a3a3c",
      // Sembunyikan kontrol edit (tombol tambah/hapus baris) dari hasil gambar.
      filter: (domNode) => {
        if (domNode instanceof HTMLElement && domNode.dataset.exportHide !== undefined) {
          return false;
        }
        return true;
      },
    });

    const filename = `${slugify(options.filenameBase)}.png`;
    const link = document.createElement("a");
    link.download = filename;
    link.href = dataUrl;
    link.click();

    return { filename };
  } finally {
    node.style.transform = prevTransform;
    node.style.transformOrigin = prevTransformOrigin;
  }
}

// Convert an asset URL to a data URL so the logo embeds reliably into the
// exported PNG (html-to-image kadang gagal memuat gambar lintas-origin saat
// snapshot). Mengembalikan null kalau gagal — poster tetap dibuat tanpa logo.
export async function fetchImageAsDataUrl(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const blob = await response.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}
