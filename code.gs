const MASTER_SHEET_ID = '1_z9SacqBnkhj-VeD5EQhJHiAj38l2H-M60j_ikgGYbA';

function doPost(e) {
  let params;
  try {
    params = JSON.parse(e.postData.contents);
  } catch (err) {
    return createJsonResponse({ success: false, message: "JSON_ERROR" });
  }

  const action = params.action;
  const sId = params.sId; 

  try {
    const ss = SpreadsheetApp.openById(sId || MASTER_SHEET_ID);

    // --- 1. ログイン ---
    if (action === "login") {
      const masterSs = SpreadsheetApp.openById(MASTER_SHEET_ID);
      const data = masterSs.getSheets()[0].getDataRange().getValues();
      for (let i = 1; i < data.length; i++) {
        if (data[i][0].toString().trim() === params.id.trim() && 
            data[i][1].toString().trim() === params.pw.trim()) {
          
          let rawFolder = data[i][5] || ""; 
          let folderId = rawFolder;
          if (rawFolder.includes("folders/")) {
            folderId = rawFolder.split("folders/")[1].split("?")[0].split("/")[0];
          }

          return createJsonResponse({
            success: true, sId: data[i][2], folderId: folderId
          });
        }
      }
      return createJsonResponse({ success: false });
    }

    // --- 2. 取得系 ---
    if (action === "fetchToolMaster") {
      const data = ss.getSheetByName("道具名簿").getDataRange().getValues();
      return createJsonResponse(data.slice(1));
    }
    if (action === "fetchStaff") {
      const data = ss.getSheetByName("社員名簿").getDataRange().getValues();
      return createJsonResponse(data.slice(1));
    }
    if (action === "fetchHistory") {
      const data = ss.getSheets()[0].getDataRange().getValues();
      return createJsonResponse(data.slice(1).reverse());
    }

    // --- 3. 更新系 ---
    if (action === "update") {
      const sheet = ss.getSheets()[0];
      const now = new Date();
      params.tagIds.forEach(id => {
        sheet.appendRow([params.status, "...", params.status, params.userName, params.status, id, now]);
      });
      return createJsonResponse({ success: true, message: "更新完了" });
    }

    // (その他のアクションも同様に createJsonResponse を使用)

  } catch (e) {
    return createJsonResponse({ success: false, message: e.toString() });
  }
}

// 共通ヘルパー
function createJsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}