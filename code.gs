const MASTER_SHEET_ID = '1_z9SacqBnkhj-VeD5EQhJHiAj38l2H-M60j_ikgGYbA';

function doGet(e) {
  try {
    const page = e.parameter.cCode ? 'index' : 'login';
    const template = HtmlService.createTemplateFromFile(page);
    template.companyCode = e.parameter.cCode || "";
    template.sheetId = e.parameter.sId || "";
    
    return template.evaluate()
      .setTitle('道具管理システム')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  } catch (err) {
    return HtmlService.createHtmlOutput("ページ読み込みエラー: " + err.toString());
  }
}

function checkLogin(id, pw) {
  try {
    const ss = SpreadsheetApp.openById(MASTER_SHEET_ID);
    const sheet = ss.getSheetByName("ユーザー管理") || ss.getSheets()[0];
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (data[i][0].toString().trim() === id.toString().trim() && data[i][1].toString().trim() === pw.toString().trim()) {
        return { success: true, cCode: data[i][4] ? data[i][4].toString() : "No Name", sId: data[i][2] };
      }
    }
    return { success: false };
  } catch (e) { return { success: false, error: e.toString() }; }
}

// --- index.htmlから呼ばれる関数群 ---
function getFullData(sId) { return SpreadsheetApp.openById(sId).getSheets()[0].getDataRange().getValues(); }
function getToolMasterList(sId) { return SpreadsheetApp.openById(sId).getSheetByName("道具名簿").getDataRange().getValues().slice(1); }
function getStaffData(sId) { return SpreadsheetApp.openById(sId).getSheetByName("社員名簿").getDataRange().getValues().slice(1); }

function bulkUpdateByTagIds(sId, tagIds, userName, place, status) {
  const sheet = SpreadsheetApp.openById(sId).getSheets()[0];
  const now = new Date();
  tagIds.forEach(id => { sheet.appendRow([status, "", place, userName, status, id, now]); });
  return "✅ 更新完了";
}

function addToolMaster(name, tag, sId) {
  SpreadsheetApp.openById(sId).getSheetByName("道具名簿").appendRow([name, tag]);
  return "✅ 登録完了";
}

// 💡 不足していた関数を追加
function addMyStaff(dept, name, sId) {
  SpreadsheetApp.openById(sId).getSheetByName("社員名簿").appendRow(["", dept, name]);
  return "✅ 社員登録完了";
}

function deleteMyStaff(name, sId) {
  const sheet = SpreadsheetApp.openById(sId).getSheetByName("社員名簿");
  const data = sheet.getDataRange().getValues();
  for (let i = data.length - 1; i >= 1; i--) {
    if (data[i][2] === name) { sheet.deleteRow(i + 1); break; }
  }
  return "削除しました";
}