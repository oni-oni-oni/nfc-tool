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
          let folderId = rawFolder.includes("folders/") ? rawFolder.split("folders/")[1].split("/")[0].split("?")[0] : rawFolder;

          return createJsonResponse({
            success: true, sId: data[i][2], compName: data[i][4] || "Guest", cCode: data[i][0], folderId: folderId 
          });
        }
      }
      return createJsonResponse({ success: false, message: "認証失敗" });
    }

    // --- 2. 稼働状況の更新 (列のズレを修正) ---
    if (action === "update") {
      const sheet = ss.getSheets()[0];
      const now = new Date();
      
      // 名簿から道具名を取得する準備
      const toolData = ss.getSheetByName("道具名簿").getDataRange().getValues();
      const toolMap = {};
      for (let i = 1; i < toolData.length; i++) {
        if(toolData[i][1]) toolMap[toolData[i][1].toString().trim().toUpperCase()] = toolData[i][0];
      }

      params.tagIds.forEach(id => {
        const toolName = toolMap[id.toString().trim().toUpperCase()] || "...";
        // レイアウト: [A:No, B:道具, C:場所, D:ユーザー, E:状況, F:管理タグID, G:更新日]
        sheet.appendRow([
          "",               // A: No
          toolName,         // B: 道具
          params.placeName || "", // C: 場所
          params.userName,  // D: ユーザー
          params.status,    // E: 状況
          id,               // F: 管理タグID
          now               // G: 更新日
        ]);
      });
      return createJsonResponse({ success: true, message: params.status + "完了" });
    }

    // --- 3. 道具の登録・上書き ---
    if (action === "addToolMaster") {
      const sh = ss.getSheetByName("道具名簿");
      let imageUrl = params.existingUrl || "";
      
      if (params.imageBlob && params.folderId) {
        const folder = DriveApp.getFolderById(params.folderId);
        const blob = Utilities.newBlob(Utilities.base64Decode(params.imageBlob.split(",")[1]), "image/jpeg", "tool_" + params.tag + ".jpg");
        const file = folder.createFile(blob);
        file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        imageUrl = "https://drive.google.com/uc?export=view&id=" + file.getId();
      }

      const data = sh.getDataRange().getValues();
      let rowIndex = -1;
      const targetTag = params.tag.toString().trim().toUpperCase();
      for (let i = 1; i < data.length; i++) {
        if (data[i][1] && data[i][1].toString().trim().toUpperCase() === targetTag) { rowIndex = i + 1; break; }
      }

      if (rowIndex > 0) {
        // [名前, タグID, 場所(空), 画像, 備考]
        sh.getRange(rowIndex, 1).setValue(params.name);
        if (imageUrl) sh.getRange(rowIndex, 4).setValue(imageUrl);
        sh.getRange(rowIndex, 5).setValue(params.remarks);
        return createJsonResponse({ success: true, message: "上書き完了" });
      } else {
        sh.appendRow([params.name, params.tag, "", imageUrl, params.remarks]);
        return createJsonResponse({ success: true, message: "新規登録完了" });
      }
    }

    // --- 4. 削除機能の復元 ---
    if (action === "deleteToolFull") {
      const tag = params.tagId.toString().trim().toUpperCase();
      [ss.getSheetByName("道具名簿"), ss.getSheets()[0]].forEach(sh => {
        if (!sh) return;
        const d = sh.getDataRange().getValues();
        for (let i = d.length - 1; i >= 1; i--) {
          const check = sh.getName() === "道具名簿" ? d[i][1] : d[i][5];
          if (check && check.toString().trim().toUpperCase() === tag) sh.deleteRow(i + 1);
        }
      });
      return createJsonResponse({ success: true, message: "削除完了" });
    }

    // --- 5. 取得系 ---
    if (action === "fetchToolMaster") return createJsonResponse(ss.getSheetByName("道具名簿").getDataRange().getValues().slice(1));
    if (action === "fetchStaff") return createJsonResponse(ss.getSheetByName("社員名簿").getDataRange().getValues().slice(1));
    if (action === "fetchHistory") return createJsonResponse(ss.getSheets()[0].getDataRange().getValues().slice(1).reverse());

  } catch (e) {
    return createJsonResponse({ success: false, message: e.message });
  }
}

function createJsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function test() { DriveApp.getRootFolder(); }