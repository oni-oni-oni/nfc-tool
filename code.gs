const MASTER_SHEET_ID = '1_z9SacqBnkhj-VeD5EQhJHiAj38l2H-M60j_ikgGYbA';

function doPost(e) {
// 通信がない状態で実行されたら何もしない
  if (!e || !e.postData || !e.postData.contents) {
    return ContentService.createTextOutput("No data").setMimeType(ContentService.MimeType.TEXT);
  }
  
  const p = JSON.parse(e.postData.contents);
  let res;
  switch (p.action) {
    case "login":           res = handleLogin(p.id, p.pw); break;
    case "fetchData":       res = getD(p.sId, "稼働状況"); break;
    case "fetchToolMaster": res = getD(p.sId, "道具名簿"); break;
    case "fetchStaff":      res = getD(p.sId, "社員名簿"); break;
    case "addToolMaster":   res = addM(p.sId, [p.name, p.tag]); break;
    case "addStaff":        res = addS(p.sId, p.dept, p.name, p.companyCode); break;
    // switch文の中にケースを追加
    case "deleteTool": res = deleteRow(p.sId, "道具名簿", p.name); break;
    default:                res = {success:false};
  }
  return ContentService.createTextOutput(JSON.stringify(res)).setMimeType(ContentService.MimeType.JSON);
}

function handleLogin(id, pw) {
  const rows = SpreadsheetApp.openById(MASTER_SHEET_ID).getSheetByName("ユーザー管理").getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] == id && rows[i][1] == pw) {
      return { success: true, sId: rows[i][2], companyCode: rows[i][3] };
    }
  }
  return { success: false, message: "認証失敗" };
}

function getD(sId, n) { 
  try {
    const ss = SpreadsheetApp.openById(sId);
    const sheet = ss.getSheetByName(n);
    if (!sheet) return [["エラー: シート '" + n + "' がありません"]];
    return sheet.getDataRange().getValues(); 
  } catch (e) {
    // IDが間違っている場合や権限がない場合、ここでエラーをキャッチして返します
    return [["エラー: スプレッドシートが開けません", e.toString()]];
  }
}
function addM(sId, row) { 
  SpreadsheetApp.openById(sId).getSheetByName("道具名簿").appendRow(row); 
  return { success: true, message: "登録完了" }; // オブジェクトで返す
}

function addS(sId, dept, name, comp) {
  SpreadsheetApp.openById(sId).getSheetByName("社員名簿").appendRow([new Date(), dept, name, comp]);
  return { success: true, message: "社員登録完了" }; // オブジェクトで返す
}

// 削除用関数（共通）
function deleteRow(sId, sheetName, key) {
  const sheet = SpreadsheetApp.openById(sId).getSheetByName(sheetName);
  const data = sheet.getDataRange().getValues();
  for (let i = data.length - 1; i >= 0; i--) {
    if (data[i][0] == key) { // 1列目が一致したら削除
      sheet.deleteRow(i + 1);
      return { success: true, message: "削除しました" };
    }
  }
  return { success: false, message: "見つかりませんでした" };
}