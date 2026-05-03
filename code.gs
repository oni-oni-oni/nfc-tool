const MASTER_SHEET_ID = '1_z9SacqBnkhj-VeD5EQhJHiAj38l2H-M60j_ikgGYbA';

function doPost(e) {
  let params;
  try {
    params = JSON.parse(e.postData.contents);
  } catch (err) {
    return ContentService.createTextOutput("JSON_ERROR");
  }

  const action = params.action;
  const sId = params.sId; 

  try {
    // --- ログイン (F列からフォルダIDを取得) ---
    if (action === "login") {
      const ss = SpreadsheetApp.openById(MASTER_SHEET_ID);
      const data = ss.getSheets()[0].getDataRange().getValues();
      for (let i = 1; i < data.length; i++) {
        if (data[i][0].toString().trim() === params.id.trim() && 
            data[i][1].toString().trim() === params.pw.trim()) {
          return ContentService.createTextOutput(JSON.stringify({
            success: true, 
            sId: data[i][2], 
            compName: data[i][4] || "Guest", 
            cCode: data[i][0],
            folderId: data[i][5] // F列(インデックス5)をフォルダIDとして返す
          })).setMimeType(ContentService.MimeType.JSON);
        }
      }
      return ContentService.createTextOutput(JSON.stringify({success: false}));
    }

// --- 道具の登録・上書き (修正版) ---
    if (action === "addToolMaster") {
      const ss = SpreadsheetApp.openById(sId);
      const sheet = ss.getSheetByName("道具名簿");
      const data = sheet.getDataRange().getValues();
      const targetTag = params.tag.toString().trim().toUpperCase();
      
      let imageUrl = params.existingRow ? params.existingRow[2] : ""; // 既存の画像URLを保持

      // 画像が新しく送られてきた場合のみ保存処理
      if (params.imageBlob && params.folderId) {
        try {
          const folder = DriveApp.getFolderById(params.folderId);
          const contentType = params.imageBlob.split(";")[0].split(":")[1];
          const base64Data = params.imageBlob.split(",")[1];
          const blob = Utilities.newBlob(Utilities.base64Decode(base64Data), contentType, "tool_" + targetTag + ".jpg");
          const file = folder.createFile(blob);
          file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
          imageUrl = "https://drive.google.com/uc?export=view&id=" + file.getId();
        } catch(e) {
          // 画像保存エラーでも登録は進める
        }
      }

      // --- 上書き or 追加の判定 ---
      let rowIndex = -1;
      for (let i = 1; i < data.length; i++) {
        if (data[i][1].toString().trim().toUpperCase() === targetTag) {
          rowIndex = i + 1; // 見つかった行番号
          break;
        }
      }

      if (rowIndex > 0) {
        // 【上書き】
        sheet.getRange(rowIndex, 1).setValue(params.name);     // A列: 道具名
        sheet.getRange(rowIndex, 3).setValue(imageUrl);        // C列: 画像URL
        sheet.getRange(rowIndex, 4).setValue(params.remarks);  // D列: 備考
        return ContentService.createTextOutput("上書き保存しました");
      } else {
        // 【新規追加】
        sheet.appendRow([params.name, params.tag, imageUrl, params.remarks]);
        return ContentService.createTextOutput("新規登録しました");
      }
    }
    // --- 完全削除 (名簿 + 履歴) ---
    if (action === "deleteToolFull") {
      const ss = SpreadsheetApp.openById(sId);
      const targetTag = params.tagId ? params.tagId.toString().trim().toUpperCase() : "";
      if (!targetTag) return ContentService.createTextOutput("エラー: タグID不明");

      // 1. 名簿から削除
      const mSheet = ss.getSheetByName("道具名簿");
      if (mSheet) {
        const mData = mSheet.getDataRange().getValues();
        for (let i = mData.length - 1; i >= 1; i--) {
          if (mData[i][1].toString().trim().toUpperCase() === targetTag) mSheet.deleteRow(i + 1);
        }
      }
      // 2. 稼働状況(履歴)から削除
      const sSheet = ss.getSheets()[0];
      const sData = sSheet.getDataRange().getValues();
      for (let i = sData.length - 1; i >= 1; i--) {
        if (sData[i][5].toString().trim().toUpperCase() === targetTag) sSheet.deleteRow(i + 1);
      }
      SpreadsheetApp.flush();
      return ContentService.createTextOutput("削除完了");
    }

    // --- データ取得系 (前回同様) ---
    if (action === "fetchToolMaster") {
      const ss = SpreadsheetApp.openById(sId);
      const sheet = ss.getSheetByName("道具名簿");
      const data = sheet.getDataRange().getValues();
      return ContentService.createTextOutput(JSON.stringify(data.slice(1))).setMimeType(ContentService.MimeType.JSON);
    }
    if (action === "fetchData") {
      const ss = SpreadsheetApp.openById(sId);
      const data = ss.getSheets()[0].getDataRange().getValues();
      return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
    }
    // (以下、update, fetchStaff等の既存機能)
    // ...
  } catch (e) {
    return ContentService.createTextOutput("Error: " + e.message);
  }
}