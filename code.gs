const MASTER_SHEET_ID = '1_z9SacqBnkhj-VeD5EQhJHiAj38l2H-M60j_ikgGYbA';
//
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

          // JSON形式で返却（GitHubからのアクセスを許可）
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

    // --- 2. 稼働状況の更新 (画像に基づく列のズレ修正) ---
    if (action === "update") {
      const historySheet = ss.getSheets()[0]; // 稼働状況シート
      const data = historySheet.getDataRange().getValues();
      const tagsToUpdate = params.tagIds || []; // スキャンされたタグIDの配列
      const now = new Date();
      
      // スキャンされたタグの数だけ順番に処理する
      tagsToUpdate.forEach(tagId => {
        let targetRow = -1;
        const targetTag = tagId.toString().trim().toUpperCase();
        
        // 稼働状況シートの中から、同じタグID（F列）を持つ行を探す
        for (let i = 1; i < data.length; i++) {
          if (data[i][5] && data[i][5].toString().trim().toUpperCase() === targetTag) {
            targetRow = i + 1; // 一致した行番号を記憶
            break;
          }
        }
        
        // 見つかった場合のみ、その行のデータを上書きする
        if (targetRow > 0) {
          historySheet.getRange(targetRow, 3).setValue(params.placeName); // C列：場所
          historySheet.getRange(targetRow, 4).setValue(params.userName);  // D列：社員名
          historySheet.getRange(targetRow, 5).setValue(params.status);    // E列：状況（貸出中/返却済など）
          historySheet.getRange(targetRow, 7).setValue(now);              // G列：更新日
        }
      });

      return createJsonResponse({ success: true, message: "状態を更新しました" });
    }

    // --- 3. 道具の登録・上書き ---
    if (action === "addToolMaster") {
      const sh = ss.getSheetByName("道具名簿");
      const historySheet = ss.getSheets()[0]; // 稼働状況（一番左のシート）
      
      // 1. 画像保存処理
      let imageUrl = params.existingUrl || "";
      if (params.imageBlob && params.folderId) {
        const folder = DriveApp.getFolderById(params.folderId);
        const blob = Utilities.newBlob(Utilities.base64Decode(params.imageBlob.split(",")[1]), "image/jpeg", "tool_" + params.tag + ".jpg");
        const file = folder.createFile(blob);
        file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        imageUrl = "https://drive.google.com/uc?export=view&id=" + file.getId();
      }

      // 2. 名簿（マスター）を検索して更新または追加
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
        // 【上書きの場合】名簿の情報を更新
        sh.getRange(rowIndex, 1, 1, 4).setValues([[params.name, params.tag, imageUrl, params.remarks]]);
        
        // ★ここがポイント：稼働状況シート（履歴）の中の古い名前もすべて更新する
        const logData = historySheet.getDataRange().getValues();
        for (let j = 1; j < logData.length; j++) {
          // F列（インデックス5）がタグIDと一致するか確認
          if (logData[j][5] && logData[j][5].toString().trim().toUpperCase() === targetTag) {
            historySheet.getRange(j + 1, 2).setValue(params.name); // B列の名前を書き換え
          }
        }
        return createJsonResponse({ success: true, message: "名簿と履歴を更新しました" });
        
      } else {
        // 【新規登録の場合】
        // 1. 道具名簿に追加
        sh.appendRow([params.name, params.tag, imageUrl, params.remarks]);
        
        // 2. 稼働状況（履歴）にも「保管中」として自動追加
        historySheet.appendRow([
          "",               // A: No
          params.name,      // B: 道具名
          "倉庫",           // C: 初期場所
          "管理者",         // D: ユーザー
          "保管中",         // E: 状況
          params.tag,       // F: 管理タグID
          now               // G: 更新日
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

    // --- 5. 社員の追加・削除 (index.htmlの処理に対応) ---
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
    // ★追加：エラーログを記録する機能
    if (action === "logError") {
      const sheet = ss.getSheetByName("NFCエラーログ");
      sheet.appendRow([new Date(), params.name, params.message]);
      return createJsonResponse({ success: true });
    }
  } catch (e) {
    return createJsonResponse({ success: false, message: "Error: " + e.message });
  }
}

// ★最重要：GitHub(外部サイト)から通信エラー(CORS)を出さずに結果を返すための共通関数
function createJsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
function fixPermission() {
  DriveApp.createFile("test.txt", "test");
}

