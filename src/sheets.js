import { google } from "googleapis";
import { readFile } from "node:fs/promises";

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var ${name}`);
  }
  return value;
}

export async function appendNames({ username, userId, name1, name2 }) {
  const spreadsheetId = required("GOOGLE_SHEET_ID");
  const tab = process.env.GOOGLE_SHEET_TAB || "Sheet1";
  const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || "./service-account.json";

  const credentials = JSON.parse(await readFile(keyPath, "utf8"));
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  const sheets = google.sheets({ version: "v4", auth });

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${tab}!A:E`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [[new Date().toISOString(), username, userId, name1, name2]],
    },
  });
}
