const MASTER_SHEET_ID = '1_z9SacqBnkhj-VeD5EQhJHiAj38l2H-M60j_ikgGYbA';

// --- 画面表示用 ---
function doGet(e) {
  try {
    // 💡 重要：ファイル名が「index_2」ならここを 'index_2' に書き換えてください
    const page = e.parameter.cCode ? 'index' : 'login'; 
    const template = HtmlService.createTemplateFromFile(page);
    
    template.sheetId = e.parameter.sId || ""; 
    template.companyCode = e.parameter.cCode || "";
    
    return template.evaluate()
      .setTitle('道具管理システム')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
      
  } catch (err) {
    // 💡 これがデバッグコードです。画面にエラーを表示させます。
    return HtmlService.createHtmlOutput(
      "<body style='padding:20px; color:red;'><h3>🚨 GAS実行エラー</h3>" +
      "<p><b>エラー:</b> " + err.message + "</p>" +
      "<p><b>スタック:</b> " + err.stack + "</p></body>"
    );
  }
}

// 権限確認用（GASエディタの「実行」ボタンでこれを選択して動かしてください）
function debug_test_access() {
  const ss = SpreadsheetApp.openById(MASTER_SHEET_ID);
  console.log("マスターシート名: " + ss.getName());
  const data = ss.getSheets()[0].getDataRange().getValues();
  console.log("データ取得成功: " + data.length + "行");
}

// --- ログイン照合関数 ---
function checkLogin(id, pw) {
  try {
    const ss = SpreadsheetApp.openById(MASTER_SHEET_ID);
    const sheet = ss.getSheetByName("ユーザー管理") || ss.getSheets()[0];
    const data = sheet.getDataRange().getValues();
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][0].toString().trim() === id.toString().trim() && 
          data[i][1].toString().trim() === pw.toString().trim()) {
        
        // C列(ID)は [2]、D列(会社名)は [3] です
        return { 
          success: true, 
          cCode: data[i][3], // ここが index.html の <?!= companyCode ?> に入ります
          sId: data[i][2]    // ここが index.html の <?!= sheetId ?> に入ります
        };
      }
    }
    return { success: false };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

// --- データ取得関数群 ---
function getFullData(sId) { return SpreadsheetApp.openById(sId).getSheets()[0].getDataRange().getValues(); }
function getToolMasterList(sId) { return SpreadsheetApp.openById(sId).getSheetByName("道具名簿").getDataRange().getValues().slice(1); }
function getStaffData(sId) { return SpreadsheetApp.openById(sId).getSheetByName("社員名簿").getDataRange().getValues().slice(1); }
function bulkUpdateByTagIds(sId, tagIds, userName, place, status) {
  const sheet = SpreadsheetApp.openById(sId).getSheets()[0];
  const now = new Date();
  tagIds.forEach(id => { sheet.appendRow([status, "...", place, userName, status, id, now]); });
  return "✅ 更新完了";
}
function addToolMaster(name, tag, sId) {
  SpreadsheetApp.openById(sId).getSheetByName("道具名簿").appendRow([name, tag, "", "", ""]);
  return "✅ 登録完了";
}