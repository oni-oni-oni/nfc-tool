function doGet() {
  return HtmlService.createHtmlOutputFromFile('index')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setTitle('道具管理システム');
}

function doPost(e) {
  const params = JSON.parse(e.postData.contents);
  const action = params.action;
  const MASTER_SHEET_ID = '1_z9SacqBnkhj-VeD5EQhJHiAj38l2H-M60j_ikgGYbA';
  const ss = SpreadsheetApp.openById(MASTER_SHEET_ID);

  try {
    // ログイン：権限情報も含めて返す
    if (action === "login") {
      const sheet = ss.getSheetByName('社員名簿');
      const data = sheet.getDataRange().getValues();
      for (let i = 1; i < data.length; i++) {
        if (data[i][0].toString() === params.id && data[i][1].toString() === params.pw) {
          return sendJson({ success: true, sId: data[i][2], folderId: data[i][5], cCode: data[i][4] });
        }
      }
      return sendJson({ success: false });
    }

    // 道具名簿：編集・削除に対応するため全行返す
    if (action === "fetchToolMaster") {
      const sheet = ss.getSheetByName('道具名簿');
      return sendJson(sheet.getDataRange().getValues().slice(1));
    }

    // 道具登録・上書き：画像保存ロジックを維持
    if (action === "addToolMaster") {
      const sheet = ss.getSheetByName('道具名簿');
      const data = sheet.getDataRange().getValues();
      let rowIndex = -1;
      for(let i=0; i<data.length; i++) { if(data[i][1] === params.tag) rowIndex = i + 1; }

      let imageUrl = params.existingUrl || "";
      if (params.imageBlob && params.imageBlob.startsWith("data:image")) {
        const folder = DriveApp.getFolderById(params.folderId);
        const blob = Utilities.newBlob(Utilities.base64Decode(params.imageBlob.split(',')[1]), "image/jpeg", params.name + ".jpg");
        const file = folder.createFile(blob);
        file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        imageUrl = "https://drive.google.com/uc?export=view&id=" + file.getId();
      }

      if (rowIndex > 0) {
        sheet.getRange(rowIndex, 1, 1, 4).setValues([[params.name, params.tag, imageUrl, params.remarks]]);
        return ContentService.createTextOutput("更新完了");
      } else {
        sheet.appendRow([params.name, params.tag, imageUrl, params.remarks]);
        return ContentService.createTextOutput("新規登録完了");
      }
    }

    // 社員登録設定
    if (action === "registerEmployee") {
      const sheet = ss.getSheetByName('社員名簿');
      sheet.appendRow([params.newId, params.newPw, params.newSId, "", params.newCCode, params.newFolderId]);
      return ContentService.createTextOutput("社員登録完了");
    }

    // 道具削除
    if (action === "deleteToolFull") {
      const sheet = ss.getSheetByName('道具名簿');
      const data = sheet.getDataRange().getValues();
      for (let i = 0; i < data.length; i++) {
        if (data[i][1] === params.tagId) {
          sheet.deleteRow(i + 1);
          return ContentService.createTextOutput("削除完了");
        }
      }
    }

  } catch (err) {
    return ContentService.createTextOutput("Error: " + err.message);
  }
}

function sendJson(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}