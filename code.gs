const MASTER_SHEET_ID = '1_z9SacqBnkhj-VeD5EQhJHiAj38l2H-M60j_ikgGYbA';
function doGet(e) {
  // index.htmlを読み込み、スプレッドシートの値を埋め込めるようにする
  const template = HtmlService.createTemplateFromFile('index');
  
  // ログイン後に必要な変数を初期化（エラー防止）
  template.sheetId = ""; 
  template.companyCode = "未ログイン";
  
  return template.evaluate()
    .setTitle('道具管理システム')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL); // 外部連携しやすくする
}
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

          return ContentService.createTextOutput(JSON.stringify({
            success: true, sId: data[i][2], compName: data[i][4] || "Guest", cCode: data[i][0], folderId: folderId 
          })).setMimeType(ContentService.MimeType.JSON);
        }
      }
      return ContentService.createTextOutput(JSON.stringify({success: false}));
    }

    // --- 2. 道具の登録・上書き (A:名前, B:タグ, C:SS保持, D:画像URL, E:備考) ---
    if (action === "addToolMaster") {
      const ss = SpreadsheetApp.openById(sId);
      const sheet = ss.getSheetByName("道具名簿");
      const data = sheet.getDataRange().getValues();
      const targetTag = params.tag.toString().trim().toUpperCase();
      let imageUrl = "";

      // 画像保存
      if (params.imageBlob && params.folderId) {
        const folder = DriveApp.getFolderById(params.folderId);
        const blob = Utilities.newBlob(Utilities.base64Decode(params.imageBlob.split(",")[1]), "image/jpeg", "tool_" + targetTag + ".jpg");
        const file = folder.createFile(blob);
        file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        imageUrl = "https://drive.google.com/uc?export=view&id=" + file.getId();
      }

      let rowIndex = -1;
      for (let i = 1; i < data.length; i++) {
        if (data[i][1] && data[i][1].toString().trim().toUpperCase() === targetTag) { rowIndex = i + 1; break; }
      }

      if (rowIndex > 0) {
        sheet.getRange(rowIndex, 1).setValue(params.name);
        if (imageUrl) sheet.getRange(rowIndex, 4).setValue(imageUrl);
        sheet.getRange(rowIndex, 5).setValue(params.remarks);
        return ContentService.createTextOutput("✅ 上書き完了しました！\n画像URL: " + (imageUrl || "変更なし"));
      } else {
        sheet.appendRow([params.name, params.tag, "", imageUrl, params.remarks]);
        return ContentService.createTextOutput("✅ 新規登録完了しました！\n画像URL: " + (imageUrl || "なし"));
      }
    }

    // --- 3. 取得系 ---
    if (action === "fetchToolMaster") {
      const data = SpreadsheetApp.openById(sId).getSheetByName("道具名簿").getDataRange().getValues();
      return ContentService.createTextOutput(JSON.stringify(data.slice(1))).setMimeType(ContentService.MimeType.JSON);
    }
    if (action === "fetchData") {
      const data = SpreadsheetApp.openById(sId).getSheets()[0].getDataRange().getValues();
      return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
    }
    if (action === "fetchStaff") {
      const data = SpreadsheetApp.openById(sId).getSheetByName("社員名簿").getDataRange().getValues();
      return ContentService.createTextOutput(JSON.stringify(data.slice(1))).setMimeType(ContentService.MimeType.JSON);
    }

    // --- 4. 更新・削除 ---
    if (action === "update") {
      const sheet = SpreadsheetApp.openById(sId).getSheets()[0];
      const now = new Date();
      params.tagIds.forEach(id => {
        sheet.appendRow([params.status, "...", params.status, params.userName, params.status, id, now]);
      });
      return ContentService.createTextOutput("更新完了");
    }
    if (action === "deleteToolFull") {
      const ss = SpreadsheetApp.openById(sId);
      const tag = params.tagId.toString().trim().toUpperCase();
      [ss.getSheetByName("道具名簿"), ss.getSheets()[0]].forEach(sh => {
        if (!sh) return;
        const d = sh.getDataRange().getValues();
        for (let i = d.length - 1; i >= 1; i--) {
          const check = sh.getName() === "道具名簿" ? d[i][1] : d[i][5];
          if (check && check.toString().trim().toUpperCase() === tag) sh.deleteRow(i + 1);
        }
      });
      return ContentService.createTextOutput("削除完了");
    }
  } catch (e) { return ContentService.createTextOutput("Error: " + e.message); }
}

function test(){ DriveApp.getRootFolder(); }