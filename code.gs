const MASTER_SHEET_ID = '1_z9SacqBnkhj-VeD5EQhJHiAj38l2H-M60j_ikgGYbA';

function doPost(e) {
  let params;
  try {
    params = JSON.parse(e.postData.contents);
  } catch (err) {
    return createJsonResponse({ success: false, message: "JSON_ERROR" });
  }

  const action = params.action;

  try {
    const ss = SpreadsheetApp.openById(MASTER_SHEET_ID);

    // --- 1. ログイン処理 ---
    if (action === "login") {
      const loginSheet = ss.getSheets()[0];
      const data = loginSheet.getDataRange().getValues();
      
      for (let i = 1; i < data.length; i++) {
        if (data[i][0] && data[i][0].toString().trim() === params.id.trim() && 
            data[i][1] && data[i][1].toString().trim() === params.pw.trim()) {
          
          let rawFolder = data[i][5] || ""; 
          let folderId = rawFolder;
          if (rawFolder.includes("folders/")) {
            folderId = rawFolder.split("folders/")[1].split("?")[0].split("/")[0];
          }

          return createJsonResponse({
            success: true,
            sId: data[i][0], // シンプルにIDをそのまま返す
            cCode: data[i][0],
            compName: data[i][2],
            folderId: folderId
          });
        }
      }
      return createJsonResponse({ success: false, message: "IDまたはパスワードが違います" });
    }

    // --- 2. 各種処理（認証なしでスッと通す） ---
    if (action === "update") {
      const sheet = ss.getSheets()[0];
      const masterSheet = ss.getSheetByName("道具名簿");
      const master = masterSheet.getDataRange().getValues();
      
      params.tagIds.forEach(tagId => {
        let toolName = "不明な道具";
        for (let j = 1; j < master.length; j++) {
          if (master[j][1] && master[j][1].toString().trim() === tagId.toString().trim()) {
            toolName = master[j][0];
            break;
          }
        }
        sheet.appendRow([
          params.sId, toolName, params.placeName, params.userName, params.status, tagId, new Date()
        ]);
      });
      return createJsonResponse({ success: true });
    }

    if (action === "addToolMaster") {
      const sheet = ss.getSheetByName("道具名簿");
      const data = sheet.getDataRange().getValues();
      let imageUrl = params.existingUrl || "";

      if (params.imageBlob) {
        const contentType = params.imageBlob.split(":")[1].split(";")[0];
        const decode = Utilities.base64Decode(params.imageBlob.split(",")[1]);
        const blob = Utilities.newBlob(decode, contentType, params.name + ".jpg");
        const folder = DriveApp.getFolderById(params.folderId);
        const file = folder.createFile(blob);
        file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        imageUrl = file.getUrl();
      }

      let found = false;
      for (let i = 1; i < data.length; i++) {
        if (data[i][1] && data[i][1].toString().trim() === params.tag.trim()) {
          sheet.getRange(i + 1, 1, 1, 4).setValues([[params.name, params.tag, imageUrl, params.remarks]]);
          found = true; break;
        }
      }
      if (!found) {
        sheet.appendRow([params.name, params.tag, imageUrl, params.remarks]);
      }
      return createJsonResponse({ success: true });
    }

    if (action === "deleteToolFull") {
      const masterSheet = ss.getSheetByName("道具名簿");
      const data = masterSheet.getDataRange().getValues();
      for (let i = data.length - 1; i >= 1; i--) {
        if (data[i][1] && data[i][1].toString().trim() === params.tagId.trim()) {
          masterSheet.deleteRow(i + 1);
        }
      }
      return createJsonResponse({ success: true });
    }

    if (action === "addMyStaff") {
      const sheet = ss.getSheetByName("社員名簿");
      sheet.appendRow([params.cCode, params.dept, params.name]);
      return createJsonResponse({ success: true });
    }

    if (action === "deleteStaff") {
      const sheet = ss.getSheetByName("社員名簿");
      const d = sheet.getDataRange().getValues();
      for (let i = d.length - 1; i >= 1; i--) {
        if (d[i][2] && d[i][2].toString().trim() === params.name.trim()) {
          sheet.deleteRow(i + 1);
        }
      }
      return createJsonResponse({ success: true });
    }

    if (action === "fetchToolMaster") {
      const data = ss.getSheetByName("道具名簿").getDataRange().getValues();
      return createJsonResponse(data.slice(1));
    }
    if (action === "fetchData") {
      const data = ss.getSheets()[0].getDataRange().getValues();
      return createJsonResponse(data);
    }
    if (action === "fetchStaff") {
      const data = ss.getSheetByName("社員名簿").getDataRange().getValues();
      return createJsonResponse(data.slice(1));
    }

  } catch (e) {
    return createJsonResponse({ success: false, message: "Error: " + e.message });
  }
}

function createJsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  return HtmlService.createHtmlOutputFromFile('index')
      .setTitle('道具管理 Pro')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}