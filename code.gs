// スプレッドシートのオブジェクトを取得
const SS_ID = "1_z9SacqBnkhj-VeD5EQhJHiAj38l2H-M60j_ikgGYbA";
const SS = SpreadsheetApp.openById(SS_ID);

/**
 * ウェブアプリにアクセスした際にHTMLを表示する
 */
function doGet() {
  // HTMLファイル名が「index」とのことですので、ここを 'index' に設定します
  return HtmlService.createTemplateFromFile('index') 
    .evaluate()
    .setTitle('道具管理システム')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/**
 * フロントエンド（HTML）からのPOSTリクエストを受け取る
 */
function doPost(e) {
  const json = JSON.parse(e.postData.contents);
  const action = json.action;
  let result = {};

  try {
    switch (action) {
      case "login":
        result = handleLogin(json.id, json.pw);
        break;
      case "addToolMaster":
        result = addToolMaster(json.name, json.tag, json.sId);
        break;
      case "fetchToolMaster":
        result = fetchToolMaster(json.sId);
        break;
      case "deleteTool":
        result = deleteTool(json.name, json.sId);
        break;
      case "fetchData": // 稼働状況一覧
        result = fetchData(json.sId);
        break;
      case "fetchStaff": // 社員名簿取得
        result = fetchStaff(json.sId);
        break;
      default:
        result = { success: false, message: "Invalid Action" };
    }
  } catch (err) {
    result = { success: false, message: "Error: " + err.toString() };
  }

  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * ログイン処理
 */
function handleLogin(id, pw) {
  const sheet = SS.getSheetByName("Users");
  const data = sheet.getDataRange().getValues();
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] == id && data[i][1] == pw) {
      return {
        success: true,
        companyCode: data[i][2], // HTMLの displayCompany に表示されます
        sId: Utilities.base64Encode(id + ":" + new Date().getTime())
      };
    }
  }
  return { success: false, message: "IDまたはパスワードが正しくありません" };
}

/**
 * 道具マスターへの追加
 */
function addToolMaster(name, tag, sId) {
  if (!sId) return { success: false, message: "Session Expired" };
  const sheet = SS.getSheetByName("ToolMaster");
  sheet.appendRow([name, tag, new Date()]);
  return { success: true, message: "「" + name + "」を登録しました" };
}

/**
 * 道具マスターの取得
 */
function fetchToolMaster(sId) {
  if (!sId) return [];
  const sheet = SS.getSheetByName("ToolMaster");
  const data = sheet.getDataRange().getValues();
  return data.slice(1);
}

/**
 * 道具マスターからの削除
 */
function deleteTool(name, sId) {
  if (!sId) return { success: false };
  const sheet = SS.getSheetByName("ToolMaster");
  const data = sheet.getDataRange().getValues();
  for (let i = data.length - 1; i >= 1; i--) {
    if (data[i][0] == name) {
      sheet.deleteRow(i + 1);
    }
  }
  return { success: true };
}

/**
 * 稼働状況（メインデータ）の取得
 */
function fetchData(sId) {
  if (!sId) return [];
  const sheet = SS.getSheetByName("MainLog");
  return sheet.getDataRange().getValues();
}

/**
 * 社員名簿の取得
 */
function fetchStaff(sId) {
  if (!sId) return [];
  const sheet = SS.getSheetByName("StaffMaster");
  return sheet.getDataRange().getValues();
}