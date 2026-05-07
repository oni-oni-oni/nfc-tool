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

    // --- 稼働状況の更新 (列の並びを画像に厳密に合わせる) ---
    if (action === "update") {
      const sheet = ss.getSheets()[0]; 
      const now = new Date();
      params.tagIds.forEach(id => {
        // [A:No, B:道具, C:場所, D:ユーザー, E:状況, F:管理タグID, G:更新日]
        sheet.appendRow([
          "",               // A: No
          "...",            // B: 道具
          "",               // C: 場所
          params.userName,  // D: ユーザー (社員名)
          params.status,    // E: 状況 (貸出/返却)
          id,               // F: 管理タグID
          now               // G: 更新日
        ]);
      });
      return createJsonResponse({ success: true, message: params.status + "完了" });
    }

    if (action === "login") {
      const masterSs = SpreadsheetApp.openById(MASTER_SHEET_ID);
      const data = masterSs.getSheets()[0].getDataRange().getValues();
      for (let i = 1; i < data.length; i++) {
        if (data[i][0].toString().trim() === params.id.trim() && data[i][1].toString().trim() === params.pw.trim()) {
          let rawFolder = data[i][5] || ""; 
          let folderId = rawFolder.includes("folders/") ? rawFolder.split("folders/")[1].split("/")[0].split("?")[0] : rawFolder;
          return createJsonResponse({ success: true, sId: data[i][2], folderId: folderId });
        }
      }
      return createJsonResponse({ success: false });
    }

    if (action === "fetchToolMaster") return createJsonResponse(ss.getSheetByName("道具名簿").getDataRange().getValues().slice(1));
    if (action === "fetchStaff") return createJsonResponse(ss.getSheetByName("社員名簿").getDataRange().getValues().slice(1));
    if (action === "fetchHistory") return createJsonResponse(ss.getSheets()[0].getDataRange().getValues().slice(1).reverse());

  } catch (e) {
    return createJsonResponse({ success: false, message: e.toString() });
  }
}

function createJsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}