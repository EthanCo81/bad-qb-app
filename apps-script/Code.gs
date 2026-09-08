function doPost(e) {
  const secret = PropertiesService.getScriptProperties().getProperty("WEBHOOK_SECRET");
  let data;

  try {
    data = JSON.parse(e.postData.contents);
  } catch (error) {
    return json_({ ok: false, error: "Invalid JSON" });
  }

  if (!secret || data.secret !== secret) {
    return json_({ ok: false, error: "Unauthorized" });
  }

  const tabName = PropertiesService.getScriptProperties().getProperty("SHEET_TAB") || "Sheet1";
  const sheet =
    SpreadsheetApp.getActiveSpreadsheet().getSheetByName(tabName) ||
    SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];

  if (data.action === "list") {
    const rows = sheet.getDataRange().getDisplayValues();
    return json_({ ok: true, rows: rows });
  }

  if (data.action === "upsert") {
    upsertWeek_(sheet, data);
    return json_({ ok: true });
  }

  if (data.action === "setScores") {
    setScores_(sheet, data.updates || []);
    return json_({ ok: true });
  }

  sheet.appendRow(fullRow_(data, "", ""));
  formatUserIdColumn_(sheet, sheet.getLastRow());
  return json_({ ok: true });
}

function fullRow_(data, score1, score2) {
  return [
    data.timestamp || new Date().toISOString(),
    data.username || "",
    String(data.userId || ""),
    data.name1 || "",
    data.name2 || "",
    data.week == null || data.week === "" ? "" : Number(data.week),
    score1,
    score2,
  ];
}

function upsertWeek_(sheet, data) {
  const tz = data.timezone || "America/Chicago";
  const weekStart = String(data.weekStart || "");
  const weekEnd = String(data.weekEnd || "");
  const userId = String(data.userId || "");
  const values = sheet.getDataRange().getValues();
  const matches = [];

  for (var i = 0; i < values.length; i++) {
    var ts = values[i][0];
    if (i === 0 && String(ts).toLowerCase() === "timestamp") continue;
    var rowUserId = String(values[i][2] || "");
    var key = toDateKey_(ts, tz);
    if (userId && rowUserId === userId && key >= weekStart && key <= weekEnd) {
      matches.push(i + 1);
    }
  }

  var score1 = "";
  var score2 = "";
  if (matches.length) {
    var prev = values[matches[0] - 1];
    var sameNames =
      String(prev[3] || "") === String(data.name1 || "") &&
      String(prev[4] || "") === String(data.name2 || "");
    if (sameNames) {
      score1 = prev.length > 6 ? prev[6] : "";
      score2 = prev.length > 7 ? prev[7] : "";
    }
  }

  var rowValues = fullRow_(data, score1, score2);

  if (matches.length === 0) {
    sheet.appendRow(rowValues);
    formatUserIdColumn_(sheet, sheet.getLastRow());
    return;
  }

  sheet.getRange(matches[0], 1, 1, 8).setValues([rowValues]);
  formatUserIdColumn_(sheet, matches[0]);
  for (var j = matches.length - 1; j >= 1; j--) {
    sheet.deleteRow(matches[j]);
  }
}

function setScores_(sheet, updates) {
  if (!updates.length) return;
  var values = sheet.getDataRange().getValues();
  for (var u = 0; u < updates.length; u++) {
    var update = updates[u];
    var userId = String(update.userId || "");
    var week = Number(update.week);
    for (var i = 0; i < values.length; i++) {
      if (i === 0 && String(values[i][0]).toLowerCase() === "timestamp") continue;
      if (String(values[i][2] || "") !== userId) continue;
      if (Number(values[i][5]) !== week) continue;
      sheet.getRange(i + 1, 7, 1, 2).setValues([[update.score_1, update.score_2]]);
    }
  }
}

function formatUserIdColumn_(sheet, rowNumber) {
  sheet.getRange(rowNumber, 3).setNumberFormat("@");
}

function toDateKey_(value, tz) {
  var date;
  if (Object.prototype.toString.call(value) === "[object Date]") {
    date = value;
  } else {
    date = new Date(value);
  }
  if (isNaN(date.getTime())) return "";
  return Utilities.formatDate(date, tz, "yyyy-MM-dd");
}

function json_(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(
    ContentService.MimeType.JSON,
  );
}
