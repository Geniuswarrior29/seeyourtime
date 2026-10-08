function doGet(e) {
  var action = e.parameter.action;
  
  if (action === 'getData') {
    return ContentService.createTextOutput(JSON.stringify({
      sessions: getSessions(),
      messages: getMessages()
    })).setMimeType(ContentService.MimeType.JSON);
  }
  
  return ContentService.createTextOutput(JSON.stringify({error: "Invalid action"})).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  var action = e.parameter.action;
  var data = JSON.parse(e.postData.contents);
  
  if (action === 'addSession') {
    addOrUpdateSession(data);
    return ContentService.createTextOutput(JSON.stringify({success: true})).setMimeType(ContentService.MimeType.JSON);
  }
  
  if (action === 'deleteSession') {
    deleteSession(data.id);
    return ContentService.createTextOutput(JSON.stringify({success: true})).setMimeType(ContentService.MimeType.JSON);
  }
  
  if (action === 'addMessage') {
    addMessage(data);
    return ContentService.createTextOutput(JSON.stringify({success: true})).setMimeType(ContentService.MimeType.JSON);
  }
  
  return ContentService.createTextOutput(JSON.stringify({error: "Invalid action"})).setMimeType(ContentService.MimeType.JSON);
}

// --- HELPERS ---
function getSpreadsheet() {
  // Use Active Spreadsheet if bound, or by ID
  return SpreadsheetApp.getActiveSpreadsheet();
}

function getSheet(name) {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    // Initialize headers
    if (name === 'STUDY_SESSIONS') {
      sheet.appendRow(['id', 'user', 'date', 'start_time', 'end_time', 'duration_minutes', 'subject', 'topic', 'created_at']);
    } else if (name === 'MESSAGES') {
      sheet.appendRow(['id', 'sender', 'receiver', 'text', 'timestamp']);
    }
  }
  return sheet;
}

function getSessions() {
  var sheet = getSheet('STUDY_SESSIONS');
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var sessions = [];
  
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var session = {};
    for (var j = 0; j < headers.length; j++) {
      session[headers[j]] = row[j];
    }
    sessions.push(session);
  }
  return sessions;
}

function getMessages() {
  var sheet = getSheet('MESSAGES');
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var messages = [];
  
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var msg = {};
    for (var j = 0; j < headers.length; j++) {
      msg[headers[j]] = row[j];
    }
    messages.push(msg);
  }
  return messages;
}

function addOrUpdateSession(session) {
  var sheet = getSheet('STUDY_SESSIONS');
  var data = sheet.getDataRange().getValues();
  
  var rowIndex = -1;
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === session.id) {
      rowIndex = i + 1; // 1-based index for sheet rows
      break;
    }
  }
  
  var rowData = [
    session.id,
    session.user,
    session.date,
    session.start_time,
    session.end_time,
    session.duration_minutes,
    session.subject,
    session.topic,
    session.created_at
  ];
  
  if (rowIndex > -1) {
    // Update
    sheet.getRange(rowIndex, 1, 1, rowData.length).setValues([rowData]);
  } else {
    // Add new
    sheet.appendRow(rowData);
  }
}

function deleteSession(id) {
  var sheet = getSheet('STUDY_SESSIONS');
  var data = sheet.getDataRange().getValues();
  
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === id) {
      sheet.deleteRow(i + 1);
      break;
    }
  }
}

function addMessage(msg) {
  var sheet = getSheet('MESSAGES');
  sheet.appendRow([
    msg.id,
    msg.sender,
    msg.receiver,
    msg.text,
    msg.timestamp
  ]);
}

// CORS Support for Web App
function doOptions(e) {
  return ContentService.createTextOutput("")
    .setMimeType(ContentService.MimeType.JSON)
    .setHeader("Access-Control-Allow-Origin", "*")
    .setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
    .setHeader("Access-Control-Allow-Headers", "Content-Type");
}
