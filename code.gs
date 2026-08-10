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

  // ==========================================
  // ★原因：ここがごっそり抜けていました！
  // 順番待ちの整理券システム（ロック）を準備して待機する処理
  // ==========================================
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000); 
  } catch (err) {
    return createJsonResponse({ success: false, message: "アクセスが集中しています。少し待ってからやり直してください。" });
  }

  // ★ロックがかかった状態で安全に処理開始
  try {
    // --- エラーをシートに記録する機能 ---
    if (action === "logError") {
      const logSs = SpreadsheetApp.openById(MASTER_SHEET_ID);
      const sheet = logSs.getSheetByName("NFCエラーログ");
      if (sheet) sheet.appendRow([new Date(), params.name, params.message]);
      return createJsonResponse({ success: true });
    }

    // --- 1. ログイン & フォルダID自動抽出 ---
    if (action === "login") {
      const ss = SpreadsheetApp.openById(MASTER_SHEET_ID);
      const data = ss.getSheets()[0].getDataRange().getValues();
      for (let i = 1; i < data.length; i++) {
        if (data[i][0].toString().trim() === params.id.trim() && 
            data[i][1].toString().trim() === params.pw.trim()) {
          
          let rawFolder = data[i][5] || ""; 
          let folderId = rawFolder;
          if (rawFolder.includes("folders/")) {
            folderId = rawFolder.split("folders/")[1].split("?")[0].split("/")[0];
          }

          return createJsonResponse({
            success: true, 
            sId: data[i][2], 
            compName: data[i][4] || "Guest", 
            cCode: data[i][0], 
            folderId: folderId 
          });
        }
      }
      return createJsonResponse({ success: false, message: "IDまたはパスワードが違います" });
    }

    const ss = SpreadsheetApp.openById(sId);

    // --- 2. 稼働状況の更新 ---
    if (action === "update") {
      const historySheet = ss.getSheets()[0];
      const data = historySheet.getDataRange().getValues();
      const tagsToUpdate = params.tagIds || []; 
      const now = new Date();
      
      tagsToUpdate.forEach(tagId => {
        let targetRow = -1;
        const targetTag = tagId.toString().trim().toUpperCase();
        
        for (let i = 1; i < data.length; i++) {
          if (data[i][5] && data[i][5].toString().trim().toUpperCase() === targetTag) {
            targetRow = i + 1; 
            break;
          }
        }
        
        if (targetRow > 0) {
          historySheet.getRange(targetRow, 3).setValue(params.placeName);
          historySheet.getRange(targetRow, 4).setValue(params.userName);  
          historySheet.getRange(targetRow, 5).setValue(params.status);    
          historySheet.getRange(targetRow, 7).setValue(now);              
        }
      });
      return createJsonResponse({ success: true, message: "状態を更新しました" });
    }

    // --- 3. 道具の登録・上書き ---
    if (action === "addToolMaster") {
      const sh = ss.getSheetByName("道具名簿");
      const historySheet = ss.getSheets()[0]; 
      
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
        if (data[i][1] && data[i][1].toString().trim().toUpperCase() === targetTag) { 
          rowIndex = i + 1;
          break; 
        }
      }

      const now = new Date();
      if (rowIndex > 0) {
        sh.getRange(rowIndex, 1, 1, 4).setValues([[params.name, params.tag, imageUrl, params.remarks]]);
        
        const logData = historySheet.getDataRange().getValues();
        for (let j = 1; j < logData.length; j++) {
          if (logData[j][5] && logData[j][5].toString().trim().toUpperCase() === targetTag) {
            historySheet.getRange(j + 1, 2).setValue(params.name);
          }
        }
        return createJsonResponse({ success: true, message: "名簿と履歴を更新しました" });
        
      } else {
        sh.appendRow([params.name, params.tag, imageUrl, params.remarks]);
        historySheet.appendRow([
          "", params.name, "倉庫", "管理者", "保管中", params.tag, now
        ]);
        return createJsonResponse({ success: true, message: "名簿と稼働状況に登録しました" });
      }
    }

    // --- 4. 道具の削除 ---
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

    // --- 5. 社員の追加・削除 ---
    if (action === "addMyStaff") {
      const sheet = ss.getSheetByName("社員名簿");
      sheet.appendRow([params.cCode, params.dept, params.name]);
      return createJsonResponse({ success: true });
    }
    if (action === "deleteStaff") {
      const sheet = ss.getSheetByName("社員名簿");
      const d = sheet.getDataRange().getValues();
      for (let i = d.length - 1; i >= 1; i--) {
        if (d[i][2] && d[i][2].toString().trim() === params.name.trim()) {
          sheet.deleteRow(i + 1);
        }
      }
      return createJsonResponse({ success: true });
    }

    // --- 6. 各種データ取得系 ---
    if (action === "fetchToolMaster") {
      const data = ss.getSheetByName("道具名簿").getDataRange().getValues();
      return createJsonResponse(data.slice(1));
    }
    if (action === "fetchData") {
      const data = ss.getSheets()[0].getDataRange().getValues();
      return createJsonResponse(data);
    }
    if (action === "fetchStaff") {
      const data = ss.getSheetByName("社員名簿").getDataRange().getValues();
      return createJsonResponse(data.slice(1));
    }

  } catch (e) {
    return createJsonResponse({ success: false, message: "Error: " + e.message });
  } finally {
    // ★処理が終わった後、必ず鍵を開ける
    lock.releaseLock();
  }
}

// 共通関数
function createJsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
function fixPermission() {
  DriveApp.createFile("test.txt", "test");
}