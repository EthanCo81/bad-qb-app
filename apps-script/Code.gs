function doGet() {
  return json_({ ok: true, message: "Webhook is up. Use POST." });
}

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
    rebuildSummaries_(sheet);
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

function asNumber_(value) {
  if (value === "" || value == null) return null;
  var n = Number(value);
  return isNaN(n) ? null : n;
}

function parseDataRows_(sheet) {
  var values = sheet.getDataRange().getValues();
  var rows = [];
  for (var i = 0; i < values.length; i++) {
    if (i === 0 && String(values[i][0]).toLowerCase() === "timestamp") continue;
    var empty = true;
    for (var c = 0; c < values[i].length; c++) {
      if (String(values[i][c]).trim() !== "") {
        empty = false;
        break;
      }
    }
    if (empty) continue;
    rows.push({
      username: String(values[i][1] || ""),
      userId: String(values[i][2] || ""),
      name1: String(values[i][3] || ""),
      name2: String(values[i][4] || ""),
      week: Number(values[i][5]),
      score1: asNumber_(values[i][6]),
      score2: asNumber_(values[i][7]),
    });
  }
  return rows;
}

function rebuildSummaries_(dataSheet) {
  var rows = parseDataRows_(dataSheet);
  var ss = dataSheet.getParent();
  var seasonTotals = {};
  var weeks = {};

  for (var i = 0; i < rows.length; i++) {
    var row = rows[i];
    if (!row.userId) continue;
    if (row.score1 != null) seasonTotals[row.userId] = (seasonTotals[row.userId] || 0) + row.score1;
    if (row.score2 != null) seasonTotals[row.userId] = (seasonTotals[row.userId] || 0) + row.score2;
    if (!row.week || isNaN(row.week)) continue;
    if (row.score1 == null && row.score2 == null) continue;
    if (!weeks[row.week]) weeks[row.week] = [];
    weeks[row.week].push(row);
  }

  for (var weekKey in weeks) {
    writeWeekSheet_(ss, Number(weekKey), weeks[weekKey], seasonTotals);
  }
}

function writeWeekSheet_(ss, week, weekRows, seasonTotals) {
  var name = "Week " + week;
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  }
  sheet.clear();

  var byUser = {};
  for (var i = 0; i < weekRows.length; i++) {
    byUser[weekRows[i].userId] = weekRows[i];
  }

  var table = [];
  for (var userId in byUser) {
    var row = byUser[userId];
    var score1 = row.score1 == null ? "" : row.score1;
    var score2 = row.score2 == null ? "" : row.score2;
    var weekTotal = (row.score1 || 0) + (row.score2 || 0);
    table.push({
      username: row.username || userId,
      pick1: row.name1,
      score1: score1,
      pick2: row.name2,
      score2: score2,
      weekTotal: Math.round(weekTotal * 100) / 100,
      seasonTotal: Math.round((seasonTotals[userId] || 0) * 100) / 100,
    });
  }

  table.sort(function (a, b) {
    if (b.weekTotal !== a.weekTotal) return b.weekTotal - a.weekTotal;
    return String(a.username).localeCompare(String(b.username));
  });

  sheet.getRange(1, 1, 1, 7).merge();
  sheet
    .getRange(1, 1)
    .setValue("Bad QB picks — Week " + week)
    .setFontWeight("bold")
    .setFontSize(14);

  var output = [["Username", "Pick 1", "Score 1", "Pick 2", "Score 2", "Week total", "Season total"]];
  for (var t = 0; t < table.length; t++) {
    output.push([
      table[t].username,
      table[t].pick1,
      table[t].score1,
      table[t].pick2,
      table[t].score2,
      table[t].weekTotal,
      table[t].seasonTotal,
    ]);
  }

  sheet.getRange(3, 1, output.length, 7).setValues(output);
  sheet.getRange(3, 1, 1, 7).setFontWeight("bold");
  if (output.length > 1) {
    var dataRows = output.length - 1;
    sheet.getRange(4, 3, dataRows, 1).setNumberFormat("0.00");
    sheet.getRange(4, 5, dataRows, 3).setNumberFormat("0.00");
  }
  sheet.setFrozenRows(3);
  sheet.autoResizeColumns(1, 7);
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
