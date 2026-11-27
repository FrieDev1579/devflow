/**
 * Appends configured DevFlow fields to the spreadsheet this script is bound to.
 * @OnlyCurrentDoc
 */
function doPost(e) {
  const lock = LockService.getScriptLock();

  try {
    lock.waitLock(10000);

    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    if (!spreadsheet) {
      throw new Error("Open Apps Script from the Google Sheet you want to update.");
    }

    const rawBody = e && e.postData && e.postData.contents;
    if (!rawBody) {
      throw new Error("The request did not contain a JSON body.");
    }

    const payload = JSON.parse(rawBody);
    const incomingFields = Array.isArray(payload.sheetsFields) && payload.sheetsFields.length
      ? payload.sheetsFields
      : legacyFields(payload);

    if (!incomingFields.length || incomingFields.length > 27) {
      throw new Error("The request must contain between 1 and 27 spreadsheet fields.");
    }

    const valuesByHeader = new Map();
    incomingFields.forEach(function(field) {
      const label = String(field && field.label ? field.label : "").trim();
      if (!label || label.length > 60) {
        throw new Error("Every spreadsheet column needs a name of 1 to 60 characters.");
      }

      const normalizedLabel = label.toLowerCase();
      if (valuesByHeader.has(normalizedLabel)) {
        throw new Error("Spreadsheet column names must be unique.");
      }

      valuesByHeader.set(normalizedLabel, safeCellValue(field.value));
    });

    const sheetName = "DevFlow Runs";
    let sheet = spreadsheet.getSheetByName(sheetName);
    if (!sheet) {
      sheet = spreadsheet.insertSheet(sheetName);
    }

    const lastColumn = sheet.getLastColumn();
    let headers = sheet.getLastRow() > 0 && lastColumn > 0
      ? sheet.getRange(1, 1, 1, lastColumn).getValues()[0].map(function(value) {
          return String(value || "").trim();
        })
      : [];

    const knownHeaders = new Set(headers.filter(Boolean).map(function(value) {
      return value.toLowerCase();
    }));

    incomingFields.forEach(function(field) {
      const label = String(field.label).trim();
      const normalizedLabel = label.toLowerCase();
      if (!knownHeaders.has(normalizedLabel)) {
        headers.push(label);
        knownHeaders.add(normalizedLabel);
      }
    });

    if (!headers.length) {
      throw new Error("No spreadsheet columns were provided.");
    }

    // Existing rows and headers are preserved; newly requested columns are added to the right.
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

    const row = headers.map(function(header) {
      return valuesByHeader.has(String(header).toLowerCase())
        ? valuesByHeader.get(String(header).toLowerCase())
        : "";
    });
    sheet.appendRow(row);

    return jsonResponse({ ok: true, columns: headers.length });
  } catch (error) {
    return jsonResponse({
      ok: false,
      error: String(error && error.message ? error.message : error)
    });
  } finally {
    if (lock.hasLock()) {
      lock.releaseLock();
    }
  }
}

function legacyFields(payload) {
  const workflow = payload.workflow || {};
  const executedAt = String(payload.executedAt || "");
  return [
    { label: "Received at", value: new Date() },
    { label: "Workflow name", value: String(workflow.name || "") },
    { label: "Workflow ID", value: String(workflow.id || "") },
    { label: "Description", value: String(workflow.description || "") },
    { label: "Trigger", value: String(workflow.trigger || "") },
    { label: "Run source", value: String(payload.source || "") },
    { label: "Executed at", value: executedAt }
  ];
}

function safeCellValue(value) {
  if (typeof value === "string" && /^[=+\-@]/.test(value)) {
    return "'" + value;
  }
  return value === undefined || value === null ? "" : value;
}

function jsonResponse(value) {
  return ContentService
    .createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}
