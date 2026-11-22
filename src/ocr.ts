import { createWorker } from "tesseract.js";

export async function readScreenshot(file: File): Promise<string> {
  const worker = await createWorker("rus");
  try {
    const result = await worker.recognize(file);
    return result.data.text.replace(/\s+\n/g, "\n").trim();
  } finally {
    await worker.terminate();
  }
}
