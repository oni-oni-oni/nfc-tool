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
      const sheet = ss.getSheets()[0];
      const now = new Date();
      
      // 道具名簿から、タグIDに紐づく「道具名」を検索するための準備
      const toolData = ss.getSheetByName("道具名簿").getDataRange().getValues();
      const toolMap = {};
      for (let i = 1; i < toolData.length; i++) {
        if(toolData[i][1]) toolMap[toolData[i][1].toString().trim().toUpperCase()] = toolData[i][0];
      }

      params.tagIds.forEach(id => {
        const tagUpper = id.toString().trim().toUpperCase();
        const toolName = toolMap[tagUpper] || "不明な道具"; // 名簿になければ不明とする

        // 画像のレイアウトに厳格に合わせる
        // [A:No, B:道具, C:場所, D:ユーザー, E:状況, F:管理タグID, G:更新日]
        sheet.appendRow([
          "",                  // A: No
          toolName,            // B: 道具
          params.placeName || "", // C: 場所 (index.htmlから送られる値)
          params.userName,     // D: ユーザー
          params.status,       // E: 状況 (貸出中/保管中)
          id,                  // F: 管理タグID
          now                  // G: 更新日
        ]);
      });
      return createJsonResponse({ success: true, message: "更新完了" });
    }

    // --- 3. 道具の登録・上書き ---
    if (action === "addToolMaster") {
      const sh = ss.getSheetByName("道具名簿");
      const historySheet = ss.getSheets()[0]; // 稼働状況（一番左のシート）
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

      const now = new Date();
      if (rowIndex > 0) {
        // 【上書きの場合】名簿を更新するだけ
        sh.getRange(rowIndex, 1).setValue(params.name);
        if (imageUrl) sh.getRange(rowIndex, 3).setValue(imageUrl);
        sh.getRange(rowIndex, 4).setValue(params.remarks);
        return createJsonResponse({ success: true, message: "名簿を更新しました" });
      } else {
        // 【新規登録の場合】
        // 1. 道具名簿に追加
        sh.appendRow([params.name, params.tag, imageUrl, params.remarks]);
        
        // 2. 稼働状況（履歴）にも「保管中」として自動追加！
        // レイアウト: [A:No, B:道具, C:場所, D:ユーザー, E:状況, F:タグID, G:更新日]
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

  } catch (e) {
    return createJsonResponse({ success: false, message: "Error: " + e.message });
  }
}

// ★最重要：GitHub(外部サイト)から通信エラー(CORS)を出さずに結果を返すための共通関数
function createJsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}