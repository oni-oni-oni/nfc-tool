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
    if (action === "login") {
      const sheet = ss.getSheetByName('社員名簿');
      const data = sheet.getDataRange().getValues();
      for (let i = 1; i < data.length; i++) {
        if (data[i][0].toString() === params.id && data[i][1].toString() === params.pw) {
          return sendJson({ success: true, folderId: data[i][5] });
        }
      }
      return sendJson({ success: false });
    }

    if (action === "fetchItems") {
      const sheet = ss.getSheetByName('道具名簿');
      return sendJson(sheet.getDataRange().getValues().slice(1));
    }

    if (action === "saveItem") {
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
        return ContentService.createTextOutput("更新しました");
      } else {
        sheet.appendRow([params.name, params.tag, imageUrl, params.remarks]);
        return ContentService.createTextOutput("新規登録しました");
      }
    }

    if (action === "regEmployee") {
      const sheet = ss.getSheetByName('社員名簿');
      sheet.appendRow([params.newId, params.newPw, params.newSId, "", "C001", params.newFolderId]);
      return ContentService.createTextOutput("社員を登録しました");
    }
  } catch (err) {
    return ContentService.createTextOutput("Error: " + err.message);
  }
}

function sendJson(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}