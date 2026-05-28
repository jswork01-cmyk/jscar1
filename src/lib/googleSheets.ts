export interface Vehicle {
  id: string; // 차량 번호 (e.g., 12가 3456)
  model: string; // 차종 (e.g., 스타리아, 카니발)
  insuranceDate: string; // 보험 갱신일 (YYYY-MM-DD or YYYY.MM.DD)
  lastOilMileage: number; // 마지막 오일교환 누적거리 (km)
  oilChangeCycle: number; // 오일교환 주기 (km)
  currentMileage: number; // 현재 누적거리 (km)
  photoUrl: string; // 차량 사진
  status: '운행가능' | '수리중' | '대기중'; // 상태
  institution?: string; // 관리 주체 기관명
  rowNum: number; // 스프레드시트 내 행 번호
}

export interface Reservation {
  id: string;
  vehicleId: string;
  driverName: string;
  userEmail: string;
  startDate: string; // YYYY-MM-DD HH:mm
  endDate: string; // YYYY-MM-DD HH:mm
  purpose: string;
  destination: string;
  passengers: string;
  status: '대기' | '승인' | '반려' | '완료';
  rowNum: number;
}

export interface DriveLog {
  id: string;
  vehicleId: string;
  driverName: string;
  driveDate: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  purpose: string; // 운행목적
  passengerCount: number; // 탑승인원
  startMileage: number;
  endMileage: number;
  distance: number;
  destination: string;
  notes: string;
  fuelCost: number;
  tollCost: number; // 통행료 분리
  photoUrl: string;
  createdAt: string;
  rowNum: number;
}

export interface RepairLog {
  id: string;
  vehicleId: string;
  repairDate: string; // YYYY-MM-DD
  description: string;
  cost: number;
  mileage: number;
  isOilChanged: boolean;
  workshopName: string;
  createdAt: string;
  rowNum: number;
}

export interface SheetUser {
  username: string;
  accessKey: string;
  role: string;
  rowNum: number;
}

// Initial default records saved in LocalStorage if vacant
const DEFAULT_VEHICLES: Vehicle[] = [
  { id: '12가 3456 (1호차)', model: '카니발 (리프트 리무진)', insuranceDate: '2026-12-15', lastOilMileage: 45000, oilChangeCycle: 10000, currentMileage: 48500, photoUrl: 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&q=80&w=400', status: '운행가능', rowNum: 2 },
  { id: '34나 7890 (2호차)', model: '스타리아 (휠체어 리프트식)', insuranceDate: '2026-06-30', lastOilMileage: 12000, oilChangeCycle: 10000, currentMileage: 21500, photoUrl: 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&q=80&w=400', status: '운행가능', rowNum: 3 },
  { id: '56다 1234 (3호차)', model: '쏠라티 미니버스', insuranceDate: '2027-02-10', lastOilMileage: 80000, oilChangeCycle: 10000, currentMileage: 91200, photoUrl: '', status: '운행가능', rowNum: 4 },
  { id: '78라 5678 (버스)', model: '뉴 카운티 (25인승)', insuranceDate: '2026-08-20', lastOilMileage: 156000, oilChangeCycle: 15000, currentMileage: 169300, photoUrl: '', status: '운행가능', rowNum: 5 }
];

const DEFAULT_RESERVATIONS: Reservation[] = [
  { id: 'RES-1001', vehicleId: '12가 3456 (1호차)', driverName: '김철수 복지사', userEmail: 'westrc1@jeongsim.or.kr', startDate: '2026-05-25 09:00', endDate: '2026-05-25 13:00', purpose: '의료지원 센터 이동 지원', destination: '의료지원 센터', passengers: '이OO 님 외 2명', status: '승인', rowNum: 2 },
  { id: 'RES-1002', vehicleId: '34나 7890 (2호차)', driverName: '이영희 요양보호사', userEmail: 'driver@welfare.org', startDate: '2026-05-26 14:00', endDate: '2026-05-26 18:00', purpose: '재가장애인 주거지원 서비스', destination: '대상자 가정', passengers: '박OO 님', status: '대기', rowNum: 3 }
];

const DEFAULT_LOGS: DriveLog[] = [
  { id: 'LOG-1001', vehicleId: '12가 3456 (1호차)', driverName: '김철수', driveDate: '2026-05-18', startTime: '09:00', endTime: '11:30', purpose: '행정업무', passengerCount: 1, startMileage: 48200, endMileage: 48500, distance: 300, destination: '도청 및 행정지원', notes: '정상 운행완료', fuelCost: 45000, tollCost: 3500, photoUrl: '', createdAt: '2026-05-18 17:30:11', rowNum: 2 }
];

const DEFAULT_REPAIRS: RepairLog[] = [
  { id: 'REP-1001', vehicleId: '12가 3456 (1호차)', repairDate: '2026-04-10', description: '브레이크 패드 및 미션 오일 교체', cost: 250000, mileage: 45000, isOilChanged: false, workshopName: '블루핸즈 대천점', createdAt: '2026-04-10 16:20:00', rowNum: 2 },
  { id: 'REP-1002', vehicleId: '34나 7890 (2호차)', repairDate: '2026-05-02', description: '엔진오일 및 에어컨 필터 교체', cost: 110000, mileage: 12000, isOilChanged: true, workshopName: '스타모터스', createdAt: '2026-05-02 11:30:00', rowNum: 3 }
];

const DEFAULT_USERS: SheetUser[] = [
  { username: '관리자', accessKey: 'admin', role: 'admin', rowNum: 2 },
  { username: '권기은', accessKey: 'kieun', role: 'admin', rowNum: 3 },
  { username: '김대영', accessKey: 'daey', role: 'admin', rowNum: 4 },
  { username: '이미현', accessKey: 'hyun', role: 'admin', rowNum: 5 },
  { username: '천범수', accessKey: '1234', role: 'Staff', rowNum: 6 },
  { username: '김경운', accessKey: '3456', role: 'Staff', rowNum: 7 },
  { username: '문순라', accessKey: '4567', role: 'Staff', rowNum: 8 },
];

export const initializeLocalData = () => {
  if (typeof window === 'undefined') return;
  
  if (!localStorage.getItem('welfare_local_vehicles')) {
    localStorage.setItem('welfare_local_vehicles', JSON.stringify(DEFAULT_VEHICLES));
  }
  if (!localStorage.getItem('welfare_local_reservations')) {
    localStorage.setItem('welfare_local_reservations', JSON.stringify(DEFAULT_RESERVATIONS));
  }
  if (!localStorage.getItem('welfare_local_logs')) {
    localStorage.setItem('welfare_local_logs', JSON.stringify(DEFAULT_LOGS));
  }
  if (!localStorage.getItem('welfare_local_repairs')) {
    localStorage.setItem('welfare_local_repairs', JSON.stringify(DEFAULT_REPAIRS));
  }
  if (!localStorage.getItem('welfare_local_users')) {
    localStorage.setItem('welfare_local_users', JSON.stringify(DEFAULT_USERS));
  }
};

export const getGlobalGasUrl = (): string | null => {
  if (typeof window === 'undefined') return null;
  const stored = localStorage.getItem('welfare_gas_web_app_url');
  if (stored) return stored.trim();
  // 정심작업장 공식 지정 Apps Script 웹앱 URL 기본 탑재 (어느 기기나 로그인 없이 즉시 연동되도록 보장)
  return 'https://script.google.com/macros/s/AKfycbykWL2mhTG9nh15qmTN8AaazpHrOpCPXzaszcc6gZxi27hkavVqYl76GD_yy0ip6fTcOw/exec';
};

/**
 * 구글 드라이브 공유 주소를 <img> 태그에서 렌더링 가능한 웹 주소(LH3 CDN 또는 직접 다운로드 캐시)로 자동 변환하여 리턴합니다.
 */
export const resolveDriveImageUrl = (url: string | null | undefined): string => {
  if (!url) return '';
  const trimmed = url.trim();
  if (!trimmed) return '';

  // base64 이미지 데이터는 그대로 사용
  if (trimmed.startsWith('data:image/')) return trimmed;

  // 구글 드라이브 도메인 포함 여부 확인
  if (
    trimmed.includes('drive.google.com') ||
    trimmed.includes('docs.google.com') ||
    trimmed.includes('googleusercontent.com')
  ) {
    // 1. /file/d/FILE_ID/... 포맷 파싱
    const dMatch = trimmed.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (dMatch && dMatch[1]) {
      return `https://lh3.googleusercontent.com/d/${dMatch[1]}`;
    }

    // 2. id=FILE_ID 쿼리 파라미터 포맷 파싱
    const idMatch = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (idMatch && idMatch[1]) {
      return `https://lh3.googleusercontent.com/d/${idMatch[1]}`;
    }
  }

  return trimmed;
};

export const getSpreadsheetMetadata = async (spreadsheetId: string, accessToken: string) => {
  return true;
};

export const createVehicleSpreadsheet = async (accessToken: string): Promise<string> => {
  return 'local_spreadsheet_id';
};

export const ensureSpreadsheetInitialized = async (spreadsheetId: string, accessToken: string) => {
  initializeLocalData();
};

function safeNumber(val: any, fallback = 0): number {
  if (val === undefined || val === null || val === '') return fallback;
  const num = Number(val);
  return isNaN(num) ? fallback : num;
}

function safeString(val: any, fallback = ''): string {
  if (val === undefined || val === null) return fallback;
  return String(val);
}

function parseVehicles(rows: any[][]): Vehicle[] {
  if (!rows || rows.length <= 1) return [];
  return rows.slice(1).map((row, i) => {
    const rowNum = i + 2;
    return {
      id: safeString(row[0]),
      model: safeString(row[1]),
      insuranceDate: safeString(row[2]),
      lastOilMileage: safeNumber(row[3]),
      oilChangeCycle: safeNumber(row[4], 10000),
      currentMileage: safeNumber(row[5]),
      photoUrl: safeString(row[6]),
      status: (row[7] === '수리중' || row[7] === '대기중' ? row[7] : '운행가능') as any,
      institution: safeString(row[8]),
      rowNum
    };
  }).filter(v => v.id.trim() !== '');
}

function parseReservations(rows: any[][]): Reservation[] {
  if (!rows || rows.length <= 1) return [];
  return rows.slice(1).map((row, i) => {
    const rowNum = i + 2;
    return {
      id: safeString(row[0]),
      vehicleId: safeString(row[1]),
      driverName: safeString(row[2]),
      userEmail: safeString(row[3]),
      startDate: safeString(row[4]),
      endDate: safeString(row[5]),
      purpose: safeString(row[6]),
      destination: safeString(row[7]),
      passengers: safeString(row[8]),
      status: (row[9] || '대기') as any,
      rowNum
    };
  }).filter(r => r.id.trim() !== '');
}

function parseLogs(rows: any[][]): DriveLog[] {
  if (!rows || rows.length <= 1) return [];
  return rows.slice(1).map((row, i) => {
    const rowNum = i + 2;
    return {
      id: safeString(row[0]),
      vehicleId: safeString(row[1]),
      driverName: safeString(row[2]),
      driveDate: safeString(row[3]),
      startTime: safeString(row[4]),
      endTime: safeString(row[5]),
      purpose: safeString(row[6]),
      passengerCount: safeNumber(row[7]),
      startMileage: safeNumber(row[8]),
      endMileage: safeNumber(row[9]),
      distance: safeNumber(row[10]),
      destination: safeString(row[11]),
      notes: safeString(row[12]),
      fuelCost: safeNumber(row[13]),
      tollCost: safeNumber(row[14]),
      photoUrl: safeString(row[15]),
      createdAt: safeString(row[16]),
      rowNum
    };
  }).filter(l => l.id.trim() !== '');
}

function parseRepairs(rows: any[][]): RepairLog[] {
  if (!rows || rows.length <= 1) return [];
  return rows.slice(1).map((row, i) => {
    const rowNum = i + 2;
    return {
      id: safeString(row[0]),
      vehicleId: safeString(row[1]),
      repairDate: safeString(row[2]),
      description: safeString(row[3]),
      cost: safeNumber(row[4]),
      mileage: safeNumber(row[5]),
      isOilChanged: safeString(row[6]).trim() === '예',
      workshopName: safeString(row[7]),
      createdAt: safeString(row[8]),
      rowNum
    };
  }).filter(r => r.id.trim() !== '');
}

function parseUsers(rows: any[][]): SheetUser[] {
  if (!rows || rows.length <= 1) return [];
  return rows.slice(1).map((row, i) => {
    const rowNum = i + 2;
    return {
      username: safeString(row[0]),
      accessKey: safeString(row[1]),
      role: safeString(row[2], 'Staff'),
      rowNum
    };
  }).filter(u => u.username.trim() !== '');
}

// Fetch all persistent datasets: sync with GAS if URL configured, otherwise fallback to LocalStorage
export const fetchSpreadsheetData = async (spreadsheetId: string, accessToken: string) => {
  initializeLocalData();
  const gasUrl = getGlobalGasUrl();

  if (gasUrl) {
    try {
      const fetchUrl = `${gasUrl}${gasUrl.includes('?') ? '&' : '?'}action=read`;
      const response = await fetch(fetchUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        }
      });
      if (response.ok) {
        const rawJson = await response.json();
        const vehicles = parseVehicles(rawJson.vehicles);
        const reservations = parseReservations(rawJson.reservations);
        const logs = parseLogs(rawJson.logs);
        const repairs = parseRepairs(rawJson.repairs);
        const users = parseUsers(rawJson.users);

        // Save downloaded values back into LocalStorage cache for smooth offline instant-boots
        localStorage.setItem('welfare_local_vehicles', JSON.stringify(vehicles));
        localStorage.setItem('welfare_local_reservations', JSON.stringify(reservations));
        localStorage.setItem('welfare_local_logs', JSON.stringify(logs));
        localStorage.setItem('welfare_local_repairs', JSON.stringify(repairs));
        localStorage.setItem('welfare_local_users', JSON.stringify(users));

        return { vehicles, reservations, logs, repairs, users };
      } else {
        console.warn(`GAS Web App read action returned non-OK status: ${response.status}`);
      }
    } catch (err) {
      console.warn('Unable to sync fetch data from Google Apps Script web app, continuing offline-first:', err);
    }
  }

  // Fallback to local storage (or default local storage client view)
  const vehicles = JSON.parse(localStorage.getItem('welfare_local_vehicles') || '[]');
  const reservations = JSON.parse(localStorage.getItem('welfare_local_reservations') || '[]');
  const logs = JSON.parse(localStorage.getItem('welfare_local_logs') || '[]');
  const repairs = JSON.parse(localStorage.getItem('welfare_local_repairs') || '[]');
  const users = JSON.parse(localStorage.getItem('welfare_local_users') || '[]');
  
  return { vehicles, reservations, logs, repairs, users };
};

// Add Vehicle to local storage + sync with GAS web app
export const addVehicleRow = async (
  spreadsheetId: string,
  accessToken: string,
  vehicle: Omit<Vehicle, 'rowNum'>
) => {
  initializeLocalData();
  const vehicles = JSON.parse(localStorage.getItem('welfare_local_vehicles') || '[]');
  const newRowNum = vehicles.length > 0 ? Math.max(...vehicles.map((v: any) => v.rowNum || 0)) + 1 : 2;
  const newVehicle: Vehicle = {
    ...vehicle,
    rowNum: newRowNum
  };
  vehicles.push(newVehicle);
  localStorage.setItem('welfare_local_vehicles', JSON.stringify(vehicles));

  const gasUrl = getGlobalGasUrl();
  if (gasUrl) {
    try {
      const fetchUrl = `${gasUrl}${gasUrl.includes('?') ? '&' : '?'}action=addVehicle&data=${encodeURIComponent(JSON.stringify(newVehicle))}`;
      await fetch(fetchUrl, { method: 'GET' });
    } catch (err) {
      console.warn('Failed to post addVehicle action to web app sync:', err);
    }
  }
};

// Update Vehicle photo, current mileage, or status locally + sync with GAS web app
export const updateVehicleCell = async (
  spreadsheetId: string,
  accessToken: string,
  rowNum: number,
  column: 'insuranceDate' | 'lastOilMileage' | 'currentMileage' | 'photoUrl' | 'status' | 'institution',
  value: string | number
) => {
  initializeLocalData();
  const vehicles = JSON.parse(localStorage.getItem('welfare_local_vehicles') || '[]');
  const updated = vehicles.map((v: any) => {
    if (v.rowNum === rowNum) {
      return { ...v, [column]: value };
    }
    return v;
  });
  localStorage.setItem('welfare_local_vehicles', JSON.stringify(updated));

  const gasUrl = getGlobalGasUrl();
  if (gasUrl) {
    try {
      const fetchUrl = `${gasUrl}${gasUrl.includes('?') ? '&' : '?'}action=updateVehicle&rowNum=${rowNum}&column=${column}&value=${encodeURIComponent(value)}`;
      await fetch(fetchUrl, { method: 'GET' });
    } catch (err) {
      console.warn('Failed to post updateVehicle action to web app sync:', err);
    }
  }
};

// Add Reservation locally + sync with GAS web app
export const addReservationRow = async (
  spreadsheetId: string,
  accessToken: string,
  reservation: Omit<Reservation, 'rowNum'>
) => {
  initializeLocalData();
  const reservations = JSON.parse(localStorage.getItem('welfare_local_reservations') || '[]');
  const newRowNum = reservations.length > 0 ? Math.max(...reservations.map((r: any) => r.rowNum || 0)) + 1 : 2;
  const newReservation: Reservation = {
    ...reservation,
    rowNum: newRowNum
  };
  reservations.push(newReservation);
  localStorage.setItem('welfare_local_reservations', JSON.stringify(reservations));

  const gasUrl = getGlobalGasUrl();
  if (gasUrl) {
    try {
      const fetchUrl = `${gasUrl}${gasUrl.includes('?') ? '&' : '?'}action=addReservation&data=${encodeURIComponent(JSON.stringify(newReservation))}`;
      await fetch(fetchUrl, { method: 'GET' });
    } catch (err) {
      console.warn('Failed to post addReservation action to web app sync:', err);
    }
  }
};

// Update Reservation Status locally + sync with GAS web app
export const updateReservationStatus = async (
  spreadsheetId: string,
  accessToken: string,
  rowNum: number,
  status: '대기' | '승인' | '반려' | '완료'
) => {
  initializeLocalData();
  const reservations = JSON.parse(localStorage.getItem('welfare_local_reservations') || '[]');
  const updated = reservations.map((r: any) => {
    if (r.rowNum === rowNum) {
      return { ...r, status };
    }
    return r;
  });
  localStorage.setItem('welfare_local_reservations', JSON.stringify(updated));

  const gasUrl = getGlobalGasUrl();
  if (gasUrl) {
    try {
      const fetchUrl = `${gasUrl}${gasUrl.includes('?') ? '&' : '?'}action=updateReservationStatus&rowNum=${rowNum}&status=${encodeURIComponent(status)}`;
      await fetch(fetchUrl, { method: 'GET' });
    } catch (err) {
      console.warn('Failed to post updateReservationStatus action to web app sync:', err);
    }
  }
};

// Add Drive Log locally + sync with GAS web app
export const addDriveLogRow = async (
  spreadsheetId: string,
  accessToken: string,
  log: Omit<DriveLog, 'rowNum'>
) => {
  initializeLocalData();
  const logs = JSON.parse(localStorage.getItem('welfare_local_logs') || '[]');
  const newRowNum = logs.length > 0 ? Math.max(...logs.map((l: any) => l.rowNum || 0)) + 1 : 2;
  const newLog: DriveLog = {
    ...log,
    rowNum: newRowNum
  };
  logs.push(newLog);
  localStorage.setItem('welfare_local_logs', JSON.stringify(logs));

  const gasUrl = getGlobalGasUrl();
  if (gasUrl) {
    try {
      const fetchUrl = `${gasUrl}${gasUrl.includes('?') ? '&' : '?'}action=addDriveLog&data=${encodeURIComponent(JSON.stringify(newLog))}`;
      await fetch(fetchUrl, { method: 'GET' });
    } catch (err) {
      console.warn('Failed to post addDriveLog action to web app sync:', err);
    }
  }
};

// Add Repair Log locally + sync with GAS web app
export const addRepairLogRow = async (
  spreadsheetId: string,
  accessToken: string,
  repair: Omit<RepairLog, 'rowNum'>
) => {
  initializeLocalData();
  const repairs = JSON.parse(localStorage.getItem('welfare_local_repairs') || '[]');
  const newRowNum = repairs.length > 0 ? Math.max(...repairs.map((r: any) => r.rowNum || 0)) + 1 : 2;
  const newRepair: RepairLog = {
    ...repair,
    rowNum: newRowNum
  };
  repairs.push(newRepair);
  localStorage.setItem('welfare_local_repairs', JSON.stringify(repairs));

  const gasUrl = getGlobalGasUrl();
  if (gasUrl) {
    try {
      const fetchUrl = `${gasUrl}${gasUrl.includes('?') ? '&' : '?'}action=addRepairLog&data=${encodeURIComponent(JSON.stringify(newRepair))}`;
      await fetch(fetchUrl, { method: 'GET' });
    } catch (err) {
      console.warn('Failed to post addRepairLog action to web app sync:', err);
    }
  }
};

// Convert uploaded local photo into Base64 for fully self-contained spreadsheet image cells (completely bypassed drive storage complexity!)
export const uploadFileToDrive = async (
  file: File,
  accessToken?: string,
  folderId?: string
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      resolve(reader.result as string);
    };
    reader.onerror = () => {
      reject(new Error('파일 변환 오류'));
    };
    reader.readAsDataURL(file);
  });
};

// Add User locally + sync with GAS web app
export const addUserRow = async (
  spreadsheetId: string,
  accessToken: string,
  user: Omit<SheetUser, 'rowNum'>
) => {
  initializeLocalData();
  const users = JSON.parse(localStorage.getItem('welfare_local_users') || '[]');
  const newRowNum = users.length > 0 ? Math.max(...users.map((u: any) => u.rowNum || 0)) + 1 : 2;
  const newUser: SheetUser = {
    ...user,
    rowNum: newRowNum
  };
  users.push(newUser);
  localStorage.setItem('welfare_local_users', JSON.stringify(users));

  const gasUrl = getGlobalGasUrl();
  if (gasUrl) {
    try {
      const fetchUrl = `${gasUrl}${gasUrl.includes('?') ? '&' : '?'}action=addUser&data=${encodeURIComponent(JSON.stringify(newUser))}`;
      await fetch(fetchUrl, { method: 'GET' });
    } catch (err) {
      console.warn('Failed to post addUser action to web app sync:', err);
    }
  }
};

// Update User locally + sync with GAS web app
export const updateUserRow = async (
  spreadsheetId: string,
  accessToken: string,
  rowNum: number,
  user: Omit<SheetUser, 'rowNum'>
) => {
  initializeLocalData();
  const users = JSON.parse(localStorage.getItem('welfare_local_users') || '[]');
  const updated = users.map((u: any) => {
    if (u.rowNum === rowNum) {
      return { ...u, ...user };
    }
    return u;
  });
  localStorage.setItem('welfare_local_users', JSON.stringify(updated));

  const gasUrl = getGlobalGasUrl();
  if (gasUrl) {
    try {
      // Build a fresh virtual user to include everything
      const freshUser: SheetUser = { ...user, rowNum };
      const fetchUrl = `${gasUrl}${gasUrl.includes('?') ? '&' : '?'}action=updateUser&rowNum=${rowNum}&data=${encodeURIComponent(JSON.stringify(freshUser))}`;
      await fetch(fetchUrl, { method: 'GET' });
    } catch (err) {
      console.warn('Failed to post updateUser action to web app sync:', err);
    }
  }
};

// Delete User locally + sync with GAS web app
export const deleteUserRow = async (
  spreadsheetId: string,
  accessToken: string,
  rowNum: number
) => {
  initializeLocalData();
  const users = JSON.parse(localStorage.getItem('welfare_local_users') || '[]');
  const filtered = users.filter((u: any) => u.rowNum !== rowNum);
  localStorage.setItem('welfare_local_users', JSON.stringify(filtered));

  const gasUrl = getGlobalGasUrl();
  if (gasUrl) {
    try {
      const fetchUrl = `${gasUrl}${gasUrl.includes('?') ? '&' : '?'}action=deleteUser&rowNum=${rowNum}`;
      await fetch(fetchUrl, { method: 'GET' });
    } catch (err) {
      console.warn('Failed to post deleteUser action to web app sync:', err);
    }
  }
};
