const MASTER_SHEET_ID = '1_z9SacqBnkhj-VeD5EQhJHiAj38l2H-M60j_ikgGYbA';

// --- 画面表示用 ---
function doGet(e) {
  const page = e.parameter.cCode ? 'index' : 'login';
  const template = HtmlService.createTemplateFromFile(page);
  template.sheetId = e.parameter.sId || ""; 
  template.companyCode = e.parameter.cCode || "";
  
  return template.evaluate()
    .setTitle('道具管理システム')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
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