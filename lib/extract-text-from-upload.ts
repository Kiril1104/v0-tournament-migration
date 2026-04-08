import * as XLSX from "xlsx";
import mammoth from "mammoth";

function ext(filename: string): string {
  const i = filename.lastIndexOf(".");
  return i >= 0 ? filename.slice(i + 1).toLowerCase() : "";
}

/**
 * Extract plain text from common schedule file formats (server-side).
 */
export async function bufferToPlainText(buffer: Buffer, filename: string): Promise<string> {
  const e = ext(filename);

  if (e === "txt" || e === "csv" || e === "md" || e === "html" || e === "htm" || e === "json") {
    return buffer.toString("utf8");
  }

  if (e === "xlsx" || e === "xls") {
    const wb = XLSX.read(buffer, { type: "buffer" });
    const parts: string[] = [];
    for (const name of wb.SheetNames) {
      const sheet = wb.Sheets[name];
      if (!sheet) continue;
      parts.push(`--- Лист: ${name} ---\n${XLSX.utils.sheet_to_csv(sheet)}`);
    }
    return parts.join("\n\n");
  }

  if (e === "docx") {
    const { value } = await mammoth.extractRawText({ buffer });
    return value;
  }

  if (e === "pdf") {
    // pdf-parse v2+ експортує клас PDFParse (немає default-функції як у v1)
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: buffer });
    try {
      const result = await parser.getText();
      return typeof result.text === "string" ? result.text : "";
    } finally {
      await parser.destroy();
    }
  }

  throw new Error(
    `Непідтримуваний формат (.${e}). Підтримуються: txt, csv, md, json, xlsx, xls, pdf, docx.`
  );
}
