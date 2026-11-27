/**
 * Appends DevFlow workflow runs to the spreadsheet this script is bound to.
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
    const workflow = payload.workflow || {};
    const sheetName = "DevFlow Runs";
    let sheet = spreadsheet.getSheetByName(sheetName);

    if (!sheet) {
      sheet = spreadsheet.insertSheet(sheetName);
    }

    if (sheet.getLastRow() === 0) {
      sheet.appendRow([
        "Received at",
        "Workflow name",
        "Workflow ID",
        "Description",
        "Trigger",
        "Run source",
        "Executed at"
      ]);
    }

    sheet.appendRow([
      new Date(),
      String(workflow.name || ""),
      String(workflow.id || ""),
      String(workflow.description || ""),
      String(workflow.trigger || ""),
      String(payload.source || ""),
      String(payload.executedAt || "")
    ]);

    return jsonResponse({ ok: true });
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

function jsonResponse(value) {
  return ContentService
    .createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}
