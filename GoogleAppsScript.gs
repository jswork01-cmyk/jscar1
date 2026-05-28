/**
 * =========================================================================================
 *                   [정심작업장 차량관리시스템 전용 Google Apps Script 배포 코드]
 * =========================================================================================
 * 
 * 이 스크립트는 정심작업장 차량관리시스템 웹 애플리케이션과 구글 스프레드시트 간의 실시간 연동을 
 * 완벽하게 처리해주는 백엔드 API 서비스 코드입니다.
 * 
 * [ 설치 및 설정 가이드 ]
 * -----------------------------------------------------------------------------------------
 * 1. 연동할 구글 스프레드시트의 메뉴에서 [확장 프로그램] > [Apps Script]를 차례로 클릭합니다.
 * 2. 기본으로 열린 코드 편집기 내의 모든 소스코드를 완전히 지우고, 이 파일의 전체 코드를 붙여넣습니다.
 * 3. 코드창 상단 왼쪽의 디스크 모양 아이콘(또는 Ctrl + S)을 눌러 저장합니다.
 * 4. 상단 오른쪽의 [배포] 버튼을 클릭한 후, [새 배포]를 선택합니다.
 * 5. 다음과 같이 설정을 구성한 후 [배포]를 진행해 주십시오.
 *     - 유형 선택 (톱니바퀴 아이콘): [웹 앱]으로 지정
 *     - 설명: 정심작업장 차량관리 실시간 Sync
 *     - 웹 앱을 실행할 사용자: [선택한 사용자 / 본인 계정]으로 유지 (반드시 스프레드시트의 소유주 계정이어야 함)
 *     - 액세스할 수 있는 사용자: [모든 사용자 (Anyone)] 로 설정 (로그인 없이 웹앱 API 통신을 하기 위함)
 * 6. 배포가 완료되면 "웹 앱 URL" (https://script.google.com/macros/s/.../exec 형태)이 나타납니다.
 *    이 URL 주소를 복사하여, 웹앱의 [설정 대시보드 > Apps Script 웹앱 주소 입력창]에 등록하시면 연동이 끝납니다!
 * =========================================================================================
 */

// 전역 시트 이름 정의
var SHEET_VEHICLES = "vehicles";
var SHEET_RESERVATIONS = "reservations";
var SHEET_DRIVE_LOGS = "logs";
var SHEET_REPAIR_LOGS = "repairs";
var SHEET_USERS = "users";

/**
 * 외부에서 들어오는 GET 요청을 통합 라우팅 처리합니다.
 */
function doGet(e) {
  // CORS 요청 및 간단한 브라우저 호출 지원을 위해 아웃풋에 헤더 보조를 연계합니다.
  try {
    var action = e.parameter.action;
    if (!action) {
      return createJsonResponse({ success: false, message: "Action parameter is missing." });
    }

    // 시스템 연결 시 시트가 하나도 없을 경우의 자동 초기화 보장
    ensureInitialized();

    var ss = SpreadsheetApp.getActiveSpreadsheet();

    // 1. 전체 데이터 자동 읽기 (READ)
    if (action === "read") {
      var data = {
        vehicles: getSheetData(ss.getSheetByName(SHEET_VEHICLES)),
        reservations: getSheetData(ss.getSheetByName(SHEET_RESERVATIONS)),
        logs: getSheetData(ss.getSheetByName(SHEET_DRIVE_LOGS)),
        repairs: getSheetData(ss.getSheetByName(SHEET_REPAIR_LOGS)),
        users: getSheetData(ss.getSheetByName(SHEET_USERS))
      };
      return createJsonResponse(data);
    }

    // 2. 관리자 예약 승인 대기 메일 전송 (sendApprovalMail)
    if (action === "sendApprovalMail") {
      var adminEmailsRaw = e.parameter.adminEmails || "";
      var driverName = e.parameter.driverName || "";
      var vehicleId = e.parameter.vehicleId || "";
      var startDate = e.parameter.startDate || "";
      var endDate = e.parameter.endDate || "";
      var purpose = e.parameter.purpose || "";
      var destination = e.parameter.destination || "";

      if (adminEmailsRaw) {
        var emailList = adminEmailsRaw.split(",");
        var subject = "[정심작업장 차량관리] " + driverName + " 복지사의 새로운 배차 예약 신청";
        var body = "<h3>🚗 정심작업장 차량관리 배차 예약 알림</h3>" +
                   "<p>차량사용자가 새로운 배차예약을 신청하였습니다. 관리자께서는 시스템에 접속하여 승인 여부를 결정해 주시기 바랍니다.</p>" +
                   "<table border='1' cellpadding='8' style='border-collapse: collapse; border-color: #d6dfce; width: 100%; max-width: 500px;'>" +
                   "  <tr style='background-color:#f4f6f0;'><th>구분</th><th>상세 신청 내용</th></tr>" +
                   "  <tr><td><b>신청 및 예약자</b></td><td>" + driverName + "</td></tr>" +
                   "  <tr><td><b>신청 차량</b></td><td>" + vehicleId + "</td></tr>" +
                   "  <tr><td><b>목적 및 사유</b></td><td>" + purpose + "</td></tr>" +
                   "  <tr><td><b>행선지 및 동승자</b></td><td>" + destination + "</td></tr>" +
                   "  <tr><td><b>사용 예정 기간</b></td><td>" + startDate + " ~ " + endDate + "</td></tr>" +
                   "</table>" +
                   "<br/>" +
                   "<p>✓ 최고관리자(Admin)께서는 웹브라우저에서 정심작업장 차량관리시스템 웹 주소에 접근 및 로그인 후, 즉시 <b>승인 / 반려 / 수정</b>을 처리하실 수 있습니다.</p>" +
                   "<p><a href='https://ais-pre-utig7edkk25tu2cg44ccvw-10224509173.asia-northeast1.run.app' style='background-color:#516931; color:white; padding: 10px 18px; text-decoration:none; border-radius:8px; font-weight:bold; display: inline-block;'>차량관리 시스템 바로가기</a></p>";

        for (var i = 0; i < emailList.length; i++) {
          var email = emailList[i].trim();
          if (email) {
            try {
              MailApp.sendEmail({
                to: email,
                subject: subject,
                htmlBody: body
              });
            } catch(err) {
              Logger.log("Email dispatch failed to " + email + ": " + err.toString());
            }
          }
        }
      }
      return createJsonResponse({ success: true, message: "Emails sent out to admin list." });
    }

    // 3. 차량 추가 (addVehicle)
    if (action === "addVehicle") {
      var rawData = e.parameter.data;
      var item = JSON.parse(rawData);
      var sheet = ss.getSheetByName(SHEET_VEHICLES);
      
      // 새 행에 칼럼 매핑 (차량번호, 차종, 보험갱신일, 마지막오일교환누적거리, 오일교환주기, 현재누적거리, 차량사진, 상태, 관리기관)
      sheet.appendRow([
        item.id,
        item.model,
        item.insuranceDate,
        item.lastOilMileage,
        item.oilChangeCycle,
        item.currentMileage,
        item.photoUrl,
        item.status || "운행가능",
        item.institution || ""
      ]);
      return createJsonResponse({ success: true });
    }

    // 4. 차량 개별 속성 업데이트 (updateVehicle)
    if (action === "updateVehicle") {
      var rowNum = parseInt(e.parameter.rowNum, 10);
      var column = e.parameter.column;
      var value = e.parameter.value;
      var sheet = ss.getSheetByName(SHEET_VEHICLES);

      if (rowNum && column) {
        var colIdx = -1;
        if (column === "insuranceDate") colIdx = 3;
        else if (column === "lastOilMileage") colIdx = 4;
        else if (column === "currentMileage") colIdx = 6;
        else if (column === "photoUrl") colIdx = 7;
        else if (column === "status") colIdx = 8;
        else if (column === "institution") colIdx = 9;

        if (colIdx !== -1) {
          // 해당 셀 값 다이렉트 갱신
          sheet.getRange(rowNum, colIdx).setValue(value);
          return createJsonResponse({ success: true });
        }
      }
      return createJsonResponse({ success: false, message: "Invalid parameters or column offset." });
    }

    // 5. 배차예약 행 추가 (addReservation)
    if (action === "addReservation") {
      var rawData = e.parameter.data;
      var item = JSON.parse(rawData);
      var sheet = ss.getSheetByName(SHEET_RESERVATIONS);
      
      // 예약ID, 차량ID, 운행자, 이메일, 사용시작일시, 사용종료일시, 운행목적, 행선지/동승자, 탑승인원구성/동승자, 승인상태
      sheet.appendRow([
        item.id,
        item.vehicleId,
        item.driverName,
        item.userEmail,
        item.startDate,
        item.endDate,
        item.purpose,
        item.destination,
        item.passengers,
        item.status || "대기"
      ]);
      return createJsonResponse({ success: true });
    }

    // 6. 예약 승인 상태 업데이트 (updateReservationStatus)
    if (action === "updateReservationStatus") {
      var rowNum = parseInt(e.parameter.rowNum, 10);
      var status = e.parameter.status;
      var sheet = ss.getSheetByName(SHEET_RESERVATIONS);

      if (rowNum && status) {
        // 예약 테이블 10번째 세로열(J열)은 ‘승인상태’입니다.
        sheet.getRange(rowNum, 10).setValue(status);
        return createJsonResponse({ success: true });
      }
      return createJsonResponse({ success: false, message: "Invalid reservation arguments." });
    }

    // 7. 운행 일지 기록 추가 (addDriveLog)
    if (action === "addDriveLog") {
      var rawData = e.parameter.data;
      var item = JSON.parse(rawData);
      var sheet = ss.getSheetByName(SHEET_DRIVE_LOGS);
      
      // 로그ID, 차량ID, 운행자, 운행일자, 시작시간, 종료시간, 운행목적, 탑승인원, 출발누적거리, 도착누적거리, 운행거리, 행선지, 비고/특이사항, 유류비, 통행료, 사진, 등록일시
      sheet.appendRow([
        item.id,
        item.vehicleId,
        item.driverName,
        item.driveDate,
        item.startTime,
        item.endTime,
        item.purpose,
        item.passengerCount,
        item.startMileage,
        item.endMileage,
        item.distance,
        item.destination,
        item.notes,
        item.fuelCost,
        item.tollCost || 0,
        item.photoUrl,
        item.createdAt
      ]);

      // 추가 기능: 운행일지가 제출되면 해당 차량의 현재 최종 누적거리를 해당 "endMileage" 값으로 자동 업데이트합니다.
      try {
        var vehicleIdToUpdate = item.vehicleId;
        var finalMileage = parseInt(item.endMileage, 10);
        if (vehicleIdToUpdate && finalMileage) {
          var vehicleSheet = ss.getSheetByName(SHEET_VEHICLES);
          var vehiclesData = vehicleSheet.getDataRange().getValues();
          for (var rIdx = 1; rIdx < vehiclesData.length; rIdx++) {
            if (vehiclesData[rIdx][0] === vehicleIdToUpdate) {
              vehicleSheet.getRange(rIdx + 1, 6).setValue(finalMileage); // 6번째 열 (현재누적거리)
              break;
            }
          }
        }
      } catch (distErr) {
        Logger.log("Auto-update vehicle currentMileage failed: " + distErr.toString());
      }

      return createJsonResponse({ success: true });
    }

    // 8. 차량 점검/수리기록 기록 추가 (addRepairLog)
    if (action === "addRepairLog") {
      var rawData = e.parameter.data;
      var item = JSON.parse(rawData);
      var sheet = ss.getSheetByName(SHEET_REPAIR_LOGS);
      
      // 정비ID, 차량ID, 정비일자, 정비내용, 정비비용, 정비시누적거리, 오일교환여부, 정비소명, 등록일시
      sheet.appendRow([
        item.id,
        item.vehicleId,
        item.repairDate,
        item.description,
        item.cost,
        item.mileage,
        item.isOilChanged ? "예" : "아니오",
        item.workshopName,
        item.createdAt
      ]);

      // 추가 기능: 오일 교환이 포함된 경우 차량 시트의 '마지막오일교환누적거리'를 정비시누적거리 값으로 자동 갱신합니다.
      try {
        var vehicleIdToUpdate = item.vehicleId;
        var rMileage = parseInt(item.mileage, 10);
        if (item.isOilChanged && vehicleIdToUpdate && rMileage) {
          var vehicleSheet = ss.getSheetByName(SHEET_VEHICLES);
          var vehiclesData = vehicleSheet.getDataRange().getValues();
          for (var rIdx = 1; rIdx < vehiclesData.length; rIdx++) {
            if (vehiclesData[rIdx][0] === vehicleIdToUpdate) {
              vehicleSheet.getRange(rIdx + 1, 4).setValue(rMileage); // 4번째 열 (마지막오일교환누적거리)
              break;
            }
          }
        }
      } catch (oilErr) {
        Logger.log("Auto-update vehicle lastOilMileage failed: " + oilErr.toString());
      }

      return createJsonResponse({ success: true });
    }

    // 9. 사용자 생성 (addUser)
    if (action === "addUser") {
      var rawData = e.parameter.data;
      var item = JSON.parse(rawData);
      var sheet = ss.getSheetByName(SHEET_USERS);

      // 이름, 접속키, 권한, 이메일
      sheet.appendRow([
        item.username,
        item.accessKey,
        item.role || "Staff",
        item.email || ""
      ]);
      return createJsonResponse({ success: true });
    }

    // 10. 사용자 정보 업데이트 (updateUser)
    if (action === "updateUser") {
      var rowNum = parseInt(e.parameter.rowNum, 10);
      var rawData = e.parameter.data;
      var item = JSON.parse(rawData);
      var sheet = ss.getSheetByName(SHEET_USERS);

      if (rowNum && item) {
        // 이름, 접속키, 권한, 이메일 일괄 업데이트
        sheet.getRange(rowNum, 1).setValue(item.username);
        sheet.getRange(rowNum, 2).setValue(item.accessKey);
        sheet.getRange(rowNum, 3).setValue(item.role || "Staff");
        sheet.getRange(rowNum, 4).setValue(item.email || "");
        return createJsonResponse({ success: true });
      }
      return createJsonResponse({ success: false, message: "Invalid user update parameters." });
    }

    // 11. 사용자 삭제 (deleteUser)
    if (action === "deleteUser") {
      var rowNum = parseInt(e.parameter.rowNum, 10);
      var sheet = ss.getSheetByName(SHEET_USERS);

      if (rowNum) {
        // 행번호를 기준으로 바로 행 삭제를 수행합니다.
        sheet.deleteRow(rowNum);
        return createJsonResponse({ success: true });
      }
      return createJsonResponse({ success: false, message: "Invalid user delete parameters." });
    }

    return createJsonResponse({ success: false, message: "Unknown action parameter: " + action });

  } catch (error) {
    return createJsonResponse({ success: false, error: error.toString() });
  }
}

/**
 * 전용 유틸리티: 스프레드시트의 파일명을 단순 열 구조로 읽어옵니다.
 */
function getSheetData(sheet) {
  if (!sheet) return [];
  var range = sheet.getDataRange();
  if (range.getNumRows() === 0) return [];
  return range.getValues();
}

/**
 * 전용 유틸리티: JSON 형태의 Http 응답을 작성해 리턴합니다.
 */
function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
                       .setMimeType(ContentService.MimeType.JSON);
}

/**
 * 테이블 존재여부를 체크하고, 비어있을 경우 고유 헤더로 시트를 자동 구성하는 함수입니다.
 */
function ensureInitialized() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // 1. 차량테이블 초기화
  var sheetVehicles = ss.getSheetByName(SHEET_VEHICLES);
  if (!sheetVehicles) {
    sheetVehicles = ss.insertSheet(SHEET_VEHICLES);
    sheetVehicles.appendRow([
      "차량번호", // A (1)
      "차종", // B (2)
      "보험갱신일", // C (3)
      "마지막오일교환누적거리", // D (4)
      "오일교환주기", // E (5)
      "현재누적거리", // F (6)
      "차량사진", // G (7)
      "상태", // H (8)
      "관리기관" // I (9)
    ]);
    
    // 초기 샘플 차량 등록 (정심작업장 차량 기본 형태 지원)
    sheetVehicles.appendRow(["12가 3456 (1호차)", "카니발 (리프트 리무진)", "2026-12-15", 45000, 10000, 48500, "", "운행가능", "정심작업장"]);
    sheetVehicles.appendRow(["34나 7890 (2호차)", "스타리아 (휠체어 리프트)", "2026-06-30", 12000, 10000, 21500, "", "운행가능", "정심작업장"]);
  }

  // 2. 예약테이블 초기화
  var sheetReservations = ss.getSheetByName(SHEET_RESERVATIONS);
  if (!sheetReservations) {
    sheetReservations = ss.insertSheet(SHEET_RESERVATIONS);
    sheetReservations.appendRow([
      "예약ID", // A (1)
      "차량ID", // B (2)
      "운행자", // C (3)
      "이메일", // D (4)
      "사용시작일시", // E (5)
      "사용종료일시", // F (6)
      "운행목적", // G (7)
      "행선지/동승자", // H (8)
      "탑승인원구성/동승자", // I (9)
      "승인상태" // J (10)
    ]);
  }

  // 3. 운행기록 초기화
  var sheetLogs = ss.getSheetByName(SHEET_DRIVE_LOGS);
  if (!sheetLogs) {
    sheetLogs = ss.insertSheet(SHEET_DRIVE_LOGS);
    sheetLogs.appendRow([
      "로그ID", // A (1)
      "차량ID", // B (2)
      "운행자", // C (3)
      "운행일자", // D (4)
      "시작시간", // E (5)
      "종료시간", // F (6)
      "운행목적", // G (7)
      "탑승인원", // H (8)
      "출발누적거리", // I (9)
      "도착누적거리", // J (10)
      "운행거리", // K (11)
      "행선지", // L (12)
      "비고/특이사항", // M (13)
      "유류비", // N (14)
      "통행료", // O (15)
      "사진", // P (16)
      "등록일시" // Q (17)
    ]);
  }

  // 4. 점검 및 정비기록 초기화
  var sheetRepairs = ss.getSheetByName(SHEET_REPAIR_LOGS);
  if (!sheetRepairs) {
    sheetRepairs = ss.insertSheet(SHEET_REPAIR_LOGS);
    sheetRepairs.appendRow([
      "정비ID", // A (1)
      "차량ID", // B (2)
      "정비일자", // C (3)
      "정비내용", // D (4)
      "정비비용", // E (5)
      "정비시누적거리", // F (6)
      "오일교환여부", // G (7)
      "정비소명", // H (8)
      "등록일시" // I (9)
    ]);
  }

  // 5. 유저 관리 테이블 초기화
  var sheetUsers = ss.getSheetByName(SHEET_USERS);
  if (!sheetUsers) {
    sheetUsers = ss.insertSheet(SHEET_USERS);
    sheetUsers.appendRow([
      "이름", // A (1)
      "접속키", // B (2)
      "권한", // C (3)
      "이메일" // D (4)
    ]);
    
    // 기본 연동 유저 등록 (기존 DEFAULT_USERS의 리스트 반영)
    sheetUsers.appendRow(["관리자", "admin", "admin", "jswork01@jeongsim.or.kr"]);
    sheetUsers.appendRow(["권기은", "kieun", "admin", "westrc1@jeongsim.or.kr"]);
    sheetUsers.appendRow(["김대영", "daey", "admin", "jswork01@jeongsim.or.kr"]);
    sheetUsers.appendRow(["이미현", "hyun", "admin", "jswork01@jeongsim.or.kr"]);
    sheetUsers.appendRow(["천범수", "1234", "Staff", "beomsu@jeongsim.or.kr"]);
  }
  
  // 첫 번째 시트가 아닐 경우 기본 생성된 "시트1" 또는 "Sheet1"의 미사용 기본 인스턴스를 삭제하여 공간을 정화합니다.
  try {
    var rawSheet1 = ss.getSheetByName("시트1") || ss.getSheetByName("Sheet1");
    if (rawSheet1 && ss.getSheets().length > 1) {
      ss.deleteSheet(rawSheet1);
    }
  } catch(e) {
    // 안전 무시
  }
}
