const MASTER_SHEET_ID = '1_z9SacqBnkhj-VeD5EQhJHiAj38l2H-M60j_ikgGYbA';

// --- 画面表示用 (ログイン画面 or 管理画面の切り替え) ---
function doGet(e) {
  // パラメータに cCode (会社コード) があれば管理画面、なければログイン画面を表示
  const page = e.parameter.cCode ? 'index' : 'login';
  const template = HtmlService.createTemplateFromFile(page);
  
  // テンプレート変数に値をセット（index.htmlで使用）
  template.sheetId = e.parameter.sId || ""; 
  template.companyCode = e.parameter.cCode || "";
  
  return template.evaluate()
    .setTitle('道具管理システム')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// --- ログイン照合関数（login.htmlから呼び出される） ---
function checkLogin(id, pw) {
  try {
    const ss = SpreadsheetApp.openById(MASTER_SHEET_ID);
    // 「ユーザー管理」シートを取得
    const sheet = ss.getSheetByName("ユーザー管理") || ss.getSheets()[0];[cite: 1]
    const data = sheet.getDataRange().getValues();[cite: 1]
    
    for (let i = 1; i < data.length; i++) {
      // ID(0列目)とPW(1列目)を照合
      if (data[i][0].toString().trim() === id.toString().trim() && 
          data[i][1].toString().trim() === pw.toString().trim()) {[cite: 1]
        
        return {
          success: true,
          cCode: data[i][0], // 会社コード
          sId: data[i][2]    // スプレッドシートID
        };
      }
    }
    return { success: false };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

// --- データ取得・操作関数群 (index.htmlから呼び出される) ---

function getFullData(sId) {
  const data = SpreadsheetApp.openById(sId).getSheets()[0].getDataRange().getValues();
  return data;
}

function getToolMasterList(sId) {
  const data = SpreadsheetApp.openById(sId).getSheetByName("道具名簿").getDataRange().getValues();
  return data.slice(1);
}

function getStaffData(sId) {
  const data = SpreadsheetApp.openById(sId).getSheetByName("社員名簿").getDataRange().getValues();
  return data.slice(1);
}

function bulkUpdateByTagIds(sId, tagIds, userName, place, status) {
  const sheet = SpreadsheetApp.openById(sId).getSheets()[0];
  const now = new Date();
  tagIds.forEach(id => {
    sheet.appendRow([status, "...", place, userName, status, id, now]);
  });
  return "✅ " + tagIds.length + "件の更新が完了しました";
}

function addToolMaster(name, tag, sId) {
  const sheet = SpreadsheetApp.openById(sId).getSheetByName("道具名簿");
  sheet.appendRow([name, tag, "", "", ""]);
  return "✅ 登録完了";
}

// --- 外部通信用 doPost (既存の互換性維持) ---
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
    if (action === "login") {
      const result = checkLogin(params.id, params.pw);
      return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
    }
    // ... その他のアクションは以前のまま維持 ...
    if (action === "fetchData") {
      const data = SpreadsheetApp.openById(sId).getSheets()[0].getDataRange().getValues();
      return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
    }
  } catch (e) { return ContentService.createTextOutput("Error: " + e.message); }
}