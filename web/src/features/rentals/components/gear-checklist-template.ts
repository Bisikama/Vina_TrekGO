import type { PackingChecklistItem } from "../services/gear-advisor.api";

type Progress = { requirementId: string; isChecked: boolean; note?: string };
type PdfPage = { canvas: HTMLCanvasElement; boxes: Array<{ x: number; y: number; checked: boolean }> };
const WIDTH = 1240, HEIGHT = 1754, MARGIN = 82;

function wrap(ctx: CanvasRenderingContext2D, value: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of value.replace(/\s+/g, " ").trim().split(" ")) {
    if (line && ctx.measureText(`${line} ${word}`).width > maxWidth) { lines.push(line); line = ""; }
    for (const char of word) {
      const candidate = line + char;
      if (line && ctx.measureText(candidate).width > maxWidth) { lines.push(line); line = char; }
      else line = candidate;
    }
    line += " ";
  }
  if (line.trim()) lines.push(line.trim());
  return lines;
}

function image(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Không tải được logo cho checklist PDF."));
    img.src = src;
  });
}

/** Creates an offline PDF with fillable checkboxes and Vietnamese text rendered by the browser. */
export async function downloadPackingChecklist(trip: string, date: string, revision: number, checklist: PackingChecklistItem[], progress: Progress[], itemNames: Record<string, string>, options?: { kind: "wardrobe" }) {
  const logo = await image("/images/avatars/avatar-1.png");
  if (document.fonts?.ready) await document.fonts.ready;
  const progressById = new Map(progress.map((entry) => [entry.requirementId, entry]));
  const pages: PdfPage[] = [];
  let canvas: HTMLCanvasElement, ctx!: CanvasRenderingContext2D, page!: PdfPage, y = 0;
  const font = (size: number, weight = 400) => `${weight} ${size}px Arial, sans-serif`;
  const text = (value: string, x: number, baseline: number, size: number, color: string, weight = 400) => {
    ctx.font = font(size, weight); ctx.fillStyle = color; ctx.fillText(value, x, baseline);
  };
  const newPage = () => {
    canvas = document.createElement("canvas"); canvas.width = WIDTH; canvas.height = HEIGHT;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Trình duyệt không hỗ trợ tạo checklist PDF.");
    ctx = context; ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, WIDTH, HEIGHT);
    page = { canvas, boxes: [] }; pages.push(page);
    ctx.fillStyle = "#143e30"; ctx.fillRect(0, 0, WIDTH, 228);
    // Subtle contour lines echo trail maps while keeping the logo legible.
    ctx.strokeStyle = "rgba(201,225,200,0.17)"; ctx.lineWidth = 2;
    for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.ellipse(1060, 80, 140 + i * 43, 45 + i * 22, -0.3, 0, Math.PI * 2); ctx.stroke(); }
    ctx.fillStyle = "#ffffff"; ctx.fillRect(MARGIN, 45, 220, 123);
    const scale = Math.min(220 / logo.naturalWidth, 123 / logo.naturalHeight);
    const w = logo.naturalWidth * scale, h = logo.naturalHeight * scale;
    ctx.drawImage(logo, MARGIN + (220 - w) / 2, 45 + (123 - h) / 2, w, h);
    text("VINATREKGO", 335, 90, 30, "#ffffff", 700);
    text("CHUẨN BỊ CHO MỖI HÀNH TRÌNH", 335, 128, 17, "#c1ddc9", 600);
    ctx.fillStyle = "#f09a50"; ctx.fillRect(MARGIN, 224, 116, 4);
    y = 282;
  };
  const lineText = (value: string, x: number, size: number, color: string, weight = 400) => {
    ctx.font = font(size, weight);
    const lines = wrap(ctx, value, WIDTH - MARGIN * 2 - (x - MARGIN));
    for (const line of lines) { text(line, x, y, size, color, weight); y += size * 1.45; }
  };
  newPage();
  text("HÀNH TRANG  /  PACKING LIST", MARGIN, y, 17, "#668873", 700); y += 52;
  text(options?.kind === "wardrobe" ? "Danh sách đồ mang theo" : "Checklist chuẩn bị đồ", MARGIN, y, 45, "#173c2d", 700); y += 46;
  if (trip) lineText(trip, MARGIN, 23, "#314b3c", 600);
  const packed = checklist.filter((item) => progressById.get(item.requirementId)?.isChecked).length;
  const subtitle = options?.kind === "wardrobe"
    ? `${checklist.length} món trang bị  •  Đã soạn ${packed}/${checklist.length}  •  Tạo ngày ${date}`
    : `${date || "Chưa có ngày khởi hành"}  •  Phiên bản đánh giá ${revision}`;
  text(subtitle, MARGIN, y + 4, 19, "#6a8071"); y += 48;
  if (options?.kind === "wardrobe") {
    ctx.fillStyle = "#f3f7f1"; ctx.fillRect(MARGIN, y, WIDTH - MARGIN * 2, 64);
    text("CHUYẾN ĐI:  ___________________________", MARGIN + 20, y + 40, 17, "#597364", 600);
    text("NGÀY ĐI:  __________________", MARGIN + 600, y + 40, 17, "#597364", 600);
    y += 93;
  } else { y += 10; text("DANH SÁCH CHO CHUYẾN ĐI", MARGIN, y, 19, "#2f6b4f", 700); y += 30; }

  let section = "";
  for (const item of checklist) {
    const entry = progressById.get(item.requirementId);
    const x = MARGIN + 56;
    const maxWidth = WIDTH - MARGIN * 2 - 56;
    const names = (item.assignedItemIds ?? []).map((id) => itemNames[id] ?? "Món đồ không còn trong Tủ đồ");
    const meta = options?.kind === "wardrobe" ? item.exportDetail ?? "" : `${item.priority === "REQUIRED" ? "Bắt buộc" : "Tùy chọn"}  •  Số lượng ${item.quantity}${item.remainingQuantity > 0 ? `  •  Cần chuẩn bị thêm ${item.remainingQuantity}` : ""}`;
    ctx.font = font(25, 700); const titleLines = wrap(ctx, item.title || item.category, maxWidth);
    ctx.font = font(19); const metaLines = wrap(ctx, meta, maxWidth);
    const nameLines = names.length ? wrap(ctx, `Đồ đã chọn: ${names.join(", ")}`, maxWidth) : [];
    const noteLines = entry?.note ? wrap(ctx, `Ghi chú: ${entry.note}`, maxWidth) : [];
    const rowHeight = 59 + titleLines.length * 36 + (metaLines.length + nameLines.length + noteLines.length) * 28;
    const nextSection = options?.kind === "wardrobe" && item.exportSection && item.exportSection !== section ? item.exportSection : "";
    if (y + rowHeight + (nextSection ? 60 : 0) > HEIGHT - 130) {
      newPage();
      if (options?.kind === "wardrobe" && !nextSection && section) { text(`${section.toLocaleUpperCase("vi-VN")}  /  TIẾP THEO`, MARGIN, y, 19, "#2f6b4f", 700); y += 38; }
      else if (options?.kind !== "wardrobe") { text("DANH SÁCH CHO CHUYẾN ĐI  /  TIẾP THEO", MARGIN, y, 19, "#2f6b4f", 700); y += 35; }
    }
    if (nextSection) { section = nextSection; ctx.fillStyle = "#eaf3e9"; ctx.fillRect(MARGIN, y, WIDTH - MARGIN * 2, 46); text(section.toLocaleUpperCase("vi-VN"), MARGIN + 16, y + 30, 18, "#286047", 700); y += 59; }
    page.boxes.push({ x: MARGIN + 2, y: y + 7, checked: !!entry?.isChecked });
    y += 27;
    for (const line of titleLines) { text(line, x, y, 25, "#243d30", 700); y += 36; }
    for (const line of [...metaLines, ...nameLines, ...noteLines]) { text(line, x, y, 19, "#65796e"); y += 28; }
    y += 12; ctx.fillStyle = "#e3ebe5"; ctx.fillRect(MARGIN, y, WIDTH - MARGIN * 2, 2); y += 20;
  }
  if (options?.kind === "wardrobe") {
    if (y + 125 > HEIGHT - 130) newPage();
    y += 24;
    text("GHI CHÚ CHO HÀNH TRÌNH", MARGIN, y, 18, "#668873", 700);
    ctx.fillStyle = "#dbe7dc";
    ctx.fillRect(MARGIN, y + 45, WIDTH - MARGIN * 2, 2);
    ctx.fillRect(MARGIN, y + 85, WIDTH - MARGIN * 2, 2);
  }
  pages.forEach(({ canvas: sheet }, index) => {
    const c = sheet.getContext("2d")!;
    c.fillStyle = "#65796e"; c.font = font(17);
    c.fillText("Bản sao checklist • Thay đổi trong PDF không đồng bộ với VinaTrekGO", MARGIN, HEIGHT - 63);
    c.textAlign = "right"; c.fillText(`${index + 1} / ${pages.length}`, WIDTH - MARGIN, HEIGHT - 63);
  });
  const bytes = await buildPdf(pages);
  const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
  const link = document.createElement("a"); link.href = url; link.download = options?.kind === "wardrobe" ? "vinatrekgo-danh-sach-do-mang-theo.pdf" : "vinatrekgo-checklist-chuan-bi-do.pdf"; link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function buildPdf(pages: PdfPage[]): Promise<Uint8Array<ArrayBuffer>> {
  const encoder = new TextEncoder();
  const objects: Uint8Array[] = [];
  const reserve = () => { objects.push(new Uint8Array()); return objects.length; };
  const set = (id: number, content: string | Uint8Array) => { objects[id - 1] = typeof content === "string" ? encoder.encode(content) : content; };
  const join = (...parts: Uint8Array[]) => { const result = new Uint8Array(parts.reduce((n, part) => n + part.length, 0)); let at = 0; for (const part of parts) { result.set(part, at); at += part.length; } return result; };
  const stream = (dictionary: string, data: Uint8Array) => join(encoder.encode(`<< ${dictionary} /Length ${data.length} >>\nstream\n`), data, encoder.encode("\nendstream"));
  const catalog = reserve(), pageTree = reserve(), form = reserve(), off = reserve(), yes = reserve();
  set(off, stream("/Type /XObject /Subtype /Form /BBox [0 0 20 20]", encoder.encode("1 1 1 rg 0 0 20 20 re f 0.2 0.42 0.31 RG 1.2 w 1 1 18 18 re S")));
  set(yes, stream("/Type /XObject /Subtype /Form /BBox [0 0 20 20]", encoder.encode("1 1 1 rg 0 0 20 20 re f 0.2 0.42 0.31 RG 1.2 w 1 1 18 18 re S 0.12 0.42 0.26 RG 2 w 4 10 m 8 6 l 16 15 l S")));
  const pageIds: number[] = [], fieldIds: number[] = [];
  for (const page of pages) {
    const pageId = reserve(), imageId = reserve(), contentId = reserve(); pageIds.push(pageId);
    const jpegBlob = await new Promise<Blob>((resolve, reject) => page.canvas.toBlob((value) => value ? resolve(value) : reject(new Error("Không thể tạo ảnh cho PDF.")), "image/jpeg", 0.94));
    const jpeg = new Uint8Array(await jpegBlob.arrayBuffer());
    set(imageId, stream(`/Type /XObject /Subtype /Image /Width ${WIDTH} /Height ${HEIGHT} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode`, jpeg));
    set(contentId, stream("", encoder.encode("q 595 0 0 842 0 0 cm /PageImage Do Q")));
    const annotations: number[] = [];
    for (const box of page.boxes) {
      const id = reserve(); annotations.push(id); fieldIds.push(id);
      const x = box.x * 595 / WIDTH, top = 842 - box.y * 842 / HEIGHT, size = 20;
      const state = box.checked ? "Yes" : "Off";
      set(id, `<< /Type /Annot /Subtype /Widget /FT /Btn /T (item${fieldIds.length}) /Rect [${x.toFixed(2)} ${(top - size).toFixed(2)} ${(x + size).toFixed(2)} ${top.toFixed(2)}] /P ${pageId} 0 R /F 4 /V /${state} /AS /${state} /AP << /N << /Off ${off} 0 R /Yes ${yes} 0 R >> >> >>`);
    }
    set(pageId, `<< /Type /Page /Parent ${pageTree} 0 R /MediaBox [0 0 595 842] /Resources << /XObject << /PageImage ${imageId} 0 R >> >> /Contents ${contentId} 0 R /Annots [${annotations.map((id) => `${id} 0 R`).join(" ")}] >>`);
  }
  set(pageTree, `<< /Type /Pages /Count ${pageIds.length} /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] >>`);
  set(form, `<< /Fields [${fieldIds.map((id) => `${id} 0 R`).join(" ")}] /NeedAppearances false >>`);
  set(catalog, `<< /Type /Catalog /Pages ${pageTree} 0 R /AcroForm ${form} 0 R >>`);
  const parts = [encoder.encode("%PDF-1.4\n%VinaTrekGO\n")]; const offsets = [0]; let length = parts[0].length;
  objects.forEach((object, index) => { offsets.push(length); const part = join(encoder.encode(`${index + 1} 0 obj\n`), object, encoder.encode("\nendobj\n")); parts.push(part); length += part.length; });
  const xref = length;
  parts.push(encoder.encode(`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size ${objects.length + 1} /Root ${catalog} 0 R >>\nstartxref\n${xref}\n%%EOF`));
  return join(...parts);
}
