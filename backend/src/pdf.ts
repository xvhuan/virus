import pdfParse from "pdf-parse";

export async function extractPdfText(pdfBytes: Uint8Array) {
  const data = await pdfParse(Buffer.from(pdfBytes));
  return (data.text ?? "").trim();
}

