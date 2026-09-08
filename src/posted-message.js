import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

const filePath = path.join(process.cwd(), "data", "button-message.json");

export async function loadPostedMessage() {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch {
    return null;
  }
}

export async function savePostedMessage({ channelId, messageId }) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify({ channelId, messageId }, null, 2));
}

export async function clearPostedMessage() {
  try {
    await unlink(filePath);
  } catch {
    // already gone
  }
}
