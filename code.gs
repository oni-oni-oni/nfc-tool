const MASTER_SHEET_ID = '1_z9SacqBnkhj-VeD5EQhJHiAj38l2H-M60j_ikgGYbA';
// Webアプリを表示するための関数を追加
function doGet() {
  return HtmlService.createHtmlOutputFromFile('index') // index_2.htmlを読み込む
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setTitle('道具管理システム');
}
function doPost(e) {
  let params;
  try {
    params = JSON.parse(e.postData.contents);
  } catch (err) {
    return ContentService.createTextOutput("JSON_ERROR").setMimeType(ContentService.MimeType.TEXT);
  }

  const action = params.action;
  const sId = params.sId;

  try {
    // --- 1. ログイン照合 ---
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
            folderId: data[i][5] // F列のフォルダIDをフロントへ渡す
          })).setMimeType(ContentService.MimeType.JSON);
        }
      }
      return ContentService.createTextOutput(JSON.stringify({ success: false })).setMimeType(ContentService.MimeType.JSON);
    }

    // --- 2. 稼働状況データの取得 ---
    if (action === "fetchData") {
      const ss = SpreadsheetApp.openById(sId);
      const data = ss.getSheets()[0].getDataRange().getDisplayValues();
      return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
    }

    // --- 3. 道具名簿の取得 ---
    if (action === "fetchToolMaster" || action === "fetchMaster") {
      const ss = SpreadsheetApp.openById(sId);
      const sheet = ss.getSheetByName("道具名簿");
      if (!sheet) return ContentService.createTextOutput(JSON.stringify([])).setMimeType(ContentService.MimeType.JSON);
      const data = sheet.getDataRange().getValues();
      data.shift(); 
      return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
    }

    // --- 4. 道具マスター登録・編集 ---
    if (action === "addToolMaster") {
      const ss = SpreadsheetApp.openById(sId);
      const toolSheet = ss.getSheetByName("道具名簿");
      const data = toolSheet.getDataRange().getValues();
      const tagId = params.tag.toString().trim();
      
      let targetRow = -1;
      for (let i = 1; i < data.length; i++) {
        if (data[i][1] && data[i][1].toString().trim() === tagId) {
          targetRow = i + 1;
          break;
        }
      }

      let imageUrl = params.existingUrl || "";
      // フロントから送られた folderId を使用して画像保存
      if (params.imageBlob && params.imageBlob.includes("base64,") && params.folderId) {
        try {
          const folder = DriveApp.getFolderById(params.folderId);
          const contentType = params.imageBlob.match(/^data:(.*);base64,/)[1];
          const base64Data = params.imageBlob.split(",")[1];
          const blob = Utilities.newBlob(Utilities.base64Decode(base64Data), contentType, params.name + "_" + tagId + ".jpg");
          const file = folder.createFile(blob);
          file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
          imageUrl = "https://drive.google.com/uc?export=view&id=" + file.getId();
        } catch(e) {
          console.error("画像保存エラー: " + e.message);
        }
      }

      if (targetRow !== -1) {
        toolSheet.getRange(targetRow, 1).setValue(params.name);
        toolSheet.getRange(targetRow, 3).setValue(imageUrl);
        toolSheet.getRange(targetRow, 4).setValue(params.remarks);
        return ContentService.createTextOutput("上書き完了");
      } else {
        toolSheet.appendRow([params.name, tagId, imageUrl, params.remarks]);
        const statusSheet = ss.getSheets()[0];
        statusSheet.appendRow([statusSheet.getLastRow(), params.name, "本部保管", "-", "保管中", tagId, new Date()]);
        return ContentService.createTextOutput("新規登録完了");
      }
    }

    // --- 5. 削除機能 ---
    if (action === "deleteToolFull") {
      const ss = SpreadsheetApp.openById(sId);
      const targetTag = params.tagId ? params.tagId.toString().trim().toUpperCase() : "";
      const masterSheet = ss.getSheetByName("道具名簿");
      if (masterSheet) {
        const mData = masterSheet.getDataRange().getValues();
        for (let i = mData.length - 1; i >= 1; i--) {
          if (mData[i][1] && mData[i][1].toString().trim().toUpperCase() === targetTag) masterSheet.deleteRow(i + 1);
        }
      }
      const statusSheet = ss.getSheets()[0];
      if (statusSheet) {
        const sData = statusSheet.getDataRange().getValues();
        for (let i = sData.length - 1; i >= 1; i--) {
          if (sData[i][5] && sData[i][5].toString().trim().toUpperCase() === targetTag) statusSheet.deleteRow(i + 1);
        }
      }
      return ContentService.createTextOutput("削除完了");
    }

    // --- 6. 一括更新 ---
    if (action === "update") {
      const res = bulkUpdateByTagIds(sId, params.tagIds, params.userName, params.placeName, params.status);
      return ContentService.createTextOutput(res).setMimeType(ContentService.MimeType.TEXT);
    }
  } catch (err) {
    return ContentService.createTextOutput("Error: " + err.message).setMimeType(ContentService.MimeType.TEXT);
  }
}

function bulkUpdateByTagIds(sId, tagIds, userName, placeName, status) {
  const ss = SpreadsheetApp.openById(sId);
  const sheet = ss.getSheets()[0];
  const data = sheet.getDataRange().getValues();
  const now = new Date();
  let count = 0;
  tagIds.forEach(tagId => {
    for (let i = 1; i < data.length; i++) {
      if (data[i][5].toString().trim() === tagId.toString().trim()) {
        sheet.getRange(i + 1, 3).setValue(placeName);
        sheet.getRange(i + 1, 4).setValue(userName);
        sheet.getRange(i + 1, 5).setValue(status);
        sheet.getRange(i + 1, 7).setValue(now);
        count++;
        break;
      }
    }
  });
  return count + "件更新完了";
}