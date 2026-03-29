const MASTER_SHEET_ID = '1_z9SacqBnkhj-VeD5EQhJHiAj38l2H-M60j_ikgGYbA';

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
            cCode: data[i][0]
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

    // --- 4. 道具マスター登録・編集（修正版） ---
    if (action === "addToolMaster") {
      const ss = SpreadsheetApp.openById(sId);
      const toolSheet = ss.getSheetByName("道具名簿");
      const data = toolSheet.getDataRange().getValues();
      const tagId = params.tag.toString().trim(); 
      
      let targetRow = -1;
      for (let i = 1; i < data.length; i++) {
        if (data[i][1].toString().trim() === tagId) {
          targetRow = i + 1;
          break;
        }
      }

      let imageUrl = params.existingUrl || ""; 
      // 画像データがある場合のみ保存処理を行う
      if (params.imageBlob && params.imageBlob.includes("base64,")) {
        const masterSS = SpreadsheetApp.openById(MASTER_SHEET_ID);
        const userData = masterSS.getSheets()[0].getDataRange().getValues();
        let folderId = "";
        for (let i = 1; i < userData.length; i++) {
          if (userData[i][0].toString().trim() === params.cCode.toString().trim()) {
            folderId = userData[i][5]; // マスターシートのF列
            break;
          }
        }

        if (folderId) {
          try {
            const folder = DriveApp.getFolderById(folderId);
            const contentType = params.imageBlob.match(/^data:(.*);base64,/)[1];
            const base64Data = params.imageBlob.split(",")[1];
            const blob = Utilities.newBlob(Utilities.base64Decode(base64Data), contentType, params.name + "_" + tagId + ".jpg");
            const file = folder.createFile(blob);
            file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
            
            // 確実に表示可能なURL形式
            imageUrl = "https://drive.google.com/uc?export=view&id=" + file.getId();
          } catch(e) {
            console.error("画像保存エラー: " + e.message);
          }
        }
      }

      if (targetRow !== -1) {
        // 【上書き】C列(3列目)に画像、D列(4列目)に備考
        toolSheet.getRange(targetRow, 1).setValue(params.name);
        toolSheet.getRange(targetRow, 3).setValue(imageUrl);
        toolSheet.getRange(targetRow, 4).setValue(params.remarks);
        return ContentService.createTextOutput("上書き完了");
      } else {
        // 【新規】
        toolSheet.appendRow([params.name, tagId, imageUrl, params.remarks]);
        const statusSheet = ss.getSheets()[0];
        statusSheet.appendRow([statusSheet.getLastRow(), params.name, "本部保管", "-", "保管中", tagId, new Date()]);
        return ContentService.createTextOutput("新規登録完了");
      }
    }

    if (action === "deleteToolFull") {
      const ss = SpreadsheetApp.openById(sId);
      const targetTag = params.tagId ? params.tagId.toString().trim() : "";
      
      // デバッグ用ログ：受け取ったIDを1枚目のシートの空きセル等にメモ（後で確認用）
      // ss.getSheets()[0].appendRow(["DEBUG_DELETE_START", targetTag, new Date()]);

      if (!targetTag) return ContentService.createTextOutput("エラー: タグIDが空です");

      let masterDeleteCount = 0;
      let statusDeleteCount = 0;

      // --- A. 道具名簿シートから削除 ---
      const masterSheet = ss.getSheetByName("道具名簿");
      if (masterSheet) {
        const masterData = masterSheet.getDataRange().getValues();
        for (let i = masterData.length - 1; i >= 1; i--) {
          let sheetTag = masterData[i][1] ? masterData[i][1].toString().trim() : "";
          
          // 一致判定のログ（問題がある場合はここを有効にしてスプレッドシートを確認）
          // console.log("Comparing: '" + sheetTag + "' with '" + targetTag + "'");

          if (sheetTag === targetTag) {
            masterSheet.deleteRow(i + 1);
            masterDeleteCount++;
          }
        }
      }

      // --- B. 稼働状況（1番目のシート）から削除 ---
      const statusSheet = ss.getSheets()[0];
      if (statusSheet) {
        const statusData = statusSheet.getDataRange().getValues();
        for (let i = statusData.length - 1; i >= 1; i--) {
          let sheetTag = statusData[i][5] ? statusData[i][5].toString().trim() : "";
          if (sheetTag === targetTag) {
            statusSheet.deleteRow(i + 1);
            statusDeleteCount++;
          }
        }
      }

      // 結果を詳しく返却
      const resultMsg = "削除完了 (名簿:" + masterDeleteCount + "件, 履歴:" + statusDeleteCount + "件)";
      return ContentService.createTextOutput(resultMsg);
    }

    // --- 6. その他（既存ロジック） ---
    if (action === "update") {
      const res = bulkUpdateByTagIds(sId, params.tagIds, params.userName, params.placeName, params.status);
      return ContentService.createTextOutput(res).setMimeType(ContentService.MimeType.TEXT);
    }
    if (action === "fetchStaff") {
      const ss = SpreadsheetApp.openById(sId);
      const sheet = ss.getSheetByName("社員名簿");
      const staffData = sheet.getDataRange().getValues();
      staffData.shift();
      return ContentService.createTextOutput(JSON.stringify(staffData)).setMimeType(ContentService.MimeType.JSON);
    }
    if (action === "addMyStaff") {
      const ss = SpreadsheetApp.openById(sId);
      const sheet = ss.getSheetByName("社員名簿");
      sheet.appendRow([params.cCode, params.dept, params.name]);
      return ContentService.createTextOutput("登録完了");
    }
    if (action === "deleteStaff") {
      const ss = SpreadsheetApp.openById(sId);
      const sheet = ss.getSheetByName("社員名簿");
      const staffData = sheet.getDataRange().getValues();
      for (let i = staffData.length - 1; i >= 1; i--) {
        if (staffData[i][2] === params.name) sheet.deleteRow(i + 1);
      }
      return ContentService.createTextOutput("削除完了");
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

// 削除実行関数
    async function deleteToolFull(name, tagId) {
        if(!confirm("「" + name + "」を完全に削除しますか？")) return;
        
        try {
            const res = await callGas({ 
                action: "deleteToolFull", 
                sId: session.sId, 
                tagId: String(tagId) // 型エラー防止
            });
            const resultText = await res.text();
            
            // ここで「0件」と出るか「1件」と出るかが運命の分かれ道です
            alert(resultText); 
            
            // 再読み込み
            loadToolMaster();
            if (window.loadAndShowList) loadAndShowList();
            
        } catch (e) {
            alert("通信失敗: " + e);
        }
    }