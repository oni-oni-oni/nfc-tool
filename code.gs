const MASTER_SHEET_ID = '1_z9SacqBnkhj-VeD5EQhJHiAj38l2H-M60j_ikgGYbA';

function doPost(e) {
  const p = JSON.parse(e.postData.contents);
  let res;
  switch (p.action) {
    case "login":           res = handleLogin(p.id, p.pw); break;
    case "fetchData":       res = getD(p.sId, "稼働状況"); break;
    case "fetchToolMaster": res = getD(p.sId, "道具名簿"); break;
    case "fetchStaff":      res = getD(p.sId, "社員名簿"); break;
    case "addToolMaster":   res = addM(p.sId, [p.name, p.tag]); break;
    case "addStaff":        res = addS(p.sId, p.dept, p.name, p.companyCode); break;
    default:                res = {success:false};
  }
  return ContentService.createTextOutput(JSON.stringify(res)).setMimeType(ContentService.MimeType.JSON);
}

function handleLogin(id, pw) {
  const rows = SpreadsheetApp.openById(MASTER_SS_ID).getSheetByName("ユーザー管理").getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] == id && rows[i][1] == pw) {
      return { success: true, sId: rows[i][2], companyCode: rows[i][3] };
    }
  }
  return { success: false, message: "認証失敗" };
}

function getD(sId, n) { return SpreadsheetApp.openById(sId).getSheetByName(n).getDataRange().getValues(); }

function addM(sId, row) { 
  SpreadsheetApp.openById(sId).getSheetByName("道具名簿").appendRow(row); 
  return "登録完了"; 
}

function addS(sId, dept, name, comp) {
  SpreadsheetApp.openById(sId).getSheetByName("社員名簿").appendRow([new Date(), dept, name, comp]);
  return "社員登録完了";
}