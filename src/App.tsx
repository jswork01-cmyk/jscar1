import React, { useEffect, useState } from 'react';
import IntroScreen from './components/IntroScreen';
import PhoneFrame from './components/PhoneFrame';
import DashboardView from './components/DashboardView';
import VehiclesView from './components/VehiclesView';
import ReservationsView from './components/ReservationsView';
import DriveLogsView from './components/DriveLogsView';
import RepairsView from './components/RepairsView';
import SettingsView from './components/SettingsView';

import { 
  initAuth, googleSignIn, logout, getAccessToken,
  directGoogleSignInWithOptions, getCustomClientId, saveCustomClientId, fetchGoogleUserProfile
} from './lib/firebaseAuth';
import { 
  Vehicle, Reservation, DriveLog, RepairLog,
  fetchSpreadsheetData, createVehicleSpreadsheet,
  addVehicleRow, updateVehicleCell, addReservationRow,
  updateReservationStatus, addDriveLogRow, addRepairLogRow,
  addUserRow, updateUserRow, deleteUserRow, getGlobalGasUrl
} from './lib/googleSheets';

import { 
  Home, Car, Calendar, Gauge, Wrench, ShieldAlert,
  Loader2, LogOut, FileSpreadsheet, Key, HelpCircle,
  Globe, ExternalLink, ShieldCheck, AlertCircle
} from 'lucide-react';
import { User } from 'firebase/auth';
import firebaseConfig from '../firebase-applet-config.json';

// Simulated Mock Data for Guest Demo Mode
const DEFAULT_DEMO_VEHICLES: Vehicle[] = [
  { id: '12가 3456 (1호차)', model: '카니발 (리프트 리무진)', insuranceDate: '2026-12-15', lastOilMileage: 45000, oilChangeCycle: 10000, currentMileage: 48500, photoUrl: 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&q=80&w=400', status: '운행가능', rowNum: 2 },
  { id: '34나 7890 (2호차)', model: '스타리아 (휠체어 리프트식)', insuranceDate: '2026-06-30', lastOilMileage: 12000, oilChangeCycle: 10000, currentMileage: 21500, photoUrl: 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&q=80&w=400', status: '운행가능', rowNum: 3 },
  { id: '56다 1234 (3호차)', model: '쏠라티 미니버스', insuranceDate: '2027-02-10', lastOilMileage: 80000, oilChangeCycle: 10000, currentMileage: 91200, photoUrl: '', status: '운행가능', rowNum: 4 },
  { id: '78라 5678 (버스)', model: '뉴 카운티 (25인승)', insuranceDate: '2026-08-20', lastOilMileage: 156000, oilChangeCycle: 15000, currentMileage: 169300, photoUrl: '', status: '운행가능', rowNum: 5 }
];

const DEFAULT_DEMO_RESERVATIONS: Reservation[] = [
  { id: 'RES-1001', vehicleId: '12가 3456 (1호차)', driverName: '김철수 복지사', userEmail: 'westrc1@jeongsim.or.kr', startDate: '2026-05-25 09:00', endDate: '2026-05-25 13:00', purpose: '충남 의료지원 센터 이동 지원', destination: '충남 의료지원 센터', passengers: '이OO 님 외 2명', status: '승인', rowNum: 2 },
  { id: 'RES-1002', vehicleId: '34나 7890 (2호차)', driverName: '이영희 요양보호사', userEmail: 'driver@welfare.org', startDate: '2026-05-26 14:00', endDate: '2026-05-26 18:00', purpose: '재가장애인 주거지원 서비스', destination: '대상자 가정', passengers: '박OO 님', status: '대기', rowNum: 3 }
];

const DEFAULT_DEMO_LOGS: DriveLog[] = [
  { id: 'LOG-1001', vehicleId: '12가 3456 (1호차)', driverName: '김철수', driveDate: '2026-05-18', startTime: '09:00', endTime: '11:30', purpose: '행정업무', passengerCount: 1, startMileage: 48200, endMileage: 48500, distance: 300, destination: '충남도청 및 행정지원', notes: '정상 운행완료', fuelCost: 45000, tollCost: 3500, photoUrl: '', createdAt: '2026-05-18 17:30:11', rowNum: 2 }
];

const DEFAULT_DEMO_REPAIRS: RepairLog[] = [
  { id: 'REP-1001', vehicleId: '12가 3456 (1호차)', repairDate: '2026-04-10', description: '브레이크 패드 및 미션 오일 교체', cost: 250000, mileage: 45000, isOilChanged: false, workshopName: '현대블루핸즈 대천점', createdAt: '2026-04-10 16:20:00', rowNum: 2 },
  { id: 'REP-1002', vehicleId: '34나 7890 (2호차)', repairDate: '2026-05-02', description: '엔진오일 및 에어컨 필터 교체', cost: 110000, mileage: 12000, isOilChanged: true, workshopName: '스타모터스', createdAt: '2026-05-02 11:30:00', rowNum: 3 }
];

export default function App() {
  const [showIntro, setShowIntro] = useState(true);
  const [needsAuth, setNeedsAuth] = useState(true);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  // Tab selector
  const [activeTab, setActiveTab] = useState<'dashboard' | 'vehicles' | 'reservations' | 'logs' | 'repairs' | 'settings'>('dashboard');

  // Connection config
  const [spreadsheetId, setSpreadsheetId] = useState<string | null>(() => {
    const stored = localStorage.getItem('welfare_vehicle_sheet_id');
    return stored ? stored.trim() : '1Sd1YdefRUQ4MgpeBmxgvPjoW-PSxmgPnxKiRftsac8U';
  });
  const [token, setToken] = useState<string | null>(null);
  const [gasWebAppUrl, setGasWebAppUrl] = useState<string | null>(() => {
    return getGlobalGasUrl();
  });
  const [syncError, setSyncError] = useState<string | null>(null);

  // User details
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [userRole, setUserRole] = useState<'driver' | 'admin'>('driver');

  // Sheet users list & passcode states
  const [sheetUsers, setSheetUsers] = useState<any[]>(() => {
    const stored = localStorage.getItem('welfare_sheet_users_cache');
    try {
      return stored ? JSON.parse(stored) : [
        { username: '관리자', accessKey: 'admin', role: 'admin', rowNum: 2 },
        { username: '권기은', accessKey: 'kieun', role: 'admin', rowNum: 3 },
        { username: '김대영', accessKey: 'daey', role: 'admin', rowNum: 4 },
        { username: '이미현', accessKey: 'hyun', role: 'admin', rowNum: 5 },
        { username: '천범수', accessKey: '1234', role: 'Staff', rowNum: 6 },
        { username: '김경운', accessKey: '3456', role: 'Staff', rowNum: 7 },
        { username: '문순라', accessKey: '4567', role: 'Staff', rowNum: 8 },
      ];
    } catch (e) {
      return [];
    }
  });

  const [inputAccessKey, setInputAccessKey] = useState('');
  const [accessKeyError, setAccessKeyError] = useState<string | null>(null);

  // Custom Direct Login States
  const [loginTab, setLoginTab] = useState<'firebase' | 'direct' | 'manual'>('direct');
  const [loginClientId, setLoginClientId] = useState(() => getCustomClientId());
  const [loginManualToken, setLoginManualToken] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [showTroubleshoot, setShowTroubleshoot] = useState(false);

  // System notification preferences for Admin
  const [notifyInsurance, setNotifyInsurance] = useState<boolean>(() => {
    const val = localStorage.getItem('welfare_notify_insurance');
    return val !== 'false'; // default to true
  });
  const [notifyOil, setNotifyOil] = useState<boolean>(() => {
    const val = localStorage.getItem('welfare_notify_oil');
    return val !== 'false'; // default to true
  });

  // System States
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [logs, setLogs] = useState<DriveLog[]>([]);
  const [repairs, setRepairs] = useState<RepairLog[]>([]);

  // Presets from Reservation Completion link to Log write
  const [presetVehicleId, setPresetVehicleId] = useState('');
  const [presetDriverName, setPresetDriverName] = useState('');

  // 1. Initialize Auth and Session on mount
  useEffect(() => {
    const savedSession = localStorage.getItem('welfare_active_session_user');
    if (savedSession) {
      try {
        const virtualUser = JSON.parse(savedSession);
        setCurrentUser(virtualUser);
        const isUserAdmin = virtualUser.role?.toLowerCase() === 'admin';
        setUserRole(isUserAdmin ? 'admin' : 'driver');
        setNeedsAuth(false);
      } catch (e) {
        console.error('Failed to parse active user session:', e);
        setNeedsAuth(true);
      }
    } else {
      const wasDemo = localStorage.getItem('welfare_vehicle_demo_mode') === 'true';
      if (wasDemo) {
        loadDemoMockData();
        setNeedsAuth(false);
      } else {
        setNeedsAuth(true);
      }
    }

    // Prefetch sheet users from GAS on boot if URL is present so passcode works instantly
    const gasUrl = getGlobalGasUrl();
    if (gasUrl) {
      fetchSpreadsheetData('', '')
        .then(data => {
          if (data.users && data.users.length > 0) {
            setSheetUsers(data.users);
            localStorage.setItem('welfare_sheet_users_cache', JSON.stringify(data.users));
          }
        })
        .catch(err => {
          console.warn('Initial GAS prefetch failed:', err);
        });
    }

    const unsub = initAuth(
      (user, cachedToken) => {
        setToken(cachedToken);
        // Do not overwrite user session if already set.
        const storedId = localStorage.getItem('welfare_vehicle_sheet_id');
        const defaultId = '1Sd1YdefRUQ4MgpeBmxgvPjoW-PSxmgPnxKiRftsac8U';
        if (storedId) {
          setSpreadsheetId(storedId.trim());
        } else {
          setSpreadsheetId(defaultId);
          localStorage.setItem('welfare_vehicle_sheet_id', defaultId);
        }
      },
      () => {
        // Silent
      }
    );

    return () => unsub();
  }, []);

  // 1.2 Fetch server-configured settings (e.g. GOOGLE_SHEET_ID, GOOGLE_CLIENT_ID) automatically on startup
  useEffect(() => {
    fetch('/api/config')
      .then(res => {
        if (!res.ok) throw new Error('Failed to load server config');
        return res.json();
      })
      .then(config => {
        if (config.GOOGLE_SHEET_ID) {
          const stored = localStorage.getItem('welfare_vehicle_sheet_id');
          // If no customized local spreadsheet exists or it matches the default initial ID, override with environmental one
          if (!stored || stored === '1Sd1YdefRUQ4MgpeBmxgvPjoW-PSxmgPnxKiRftsac8U') {
            setSpreadsheetId(config.GOOGLE_SHEET_ID);
            localStorage.setItem('welfare_vehicle_sheet_id', config.GOOGLE_SHEET_ID);
          }
        }
        if (config.GOOGLE_CLIENT_ID) {
          setLoginClientId(config.GOOGLE_CLIENT_ID);
          saveCustomClientId(config.GOOGLE_CLIENT_ID);
        }
      })
      .catch(err => {
        console.warn('Backend configurations lookup bypassed or not running:', err);
      });
  }, []);

  // 1.5 Prevent non-admin users from accessing calculations orsettings views
  useEffect(() => {
    if (activeTab === 'settings' && userRole !== 'admin') {
      alert('설정 메뉴 및 연동 환경설정은 관리자만 접근할 수 있습니다.');
      setActiveTab('dashboard');
    }
  }, [activeTab, userRole]);

  // 1.7 Desktop Notifications Engine for Insurance & Oil changes (Admin only)
  useEffect(() => {
    if (vehicles.length === 0) return;
    if (userRole !== 'admin') return;

    const isNotificationSupported = typeof window !== 'undefined' && 'Notification' in window;
    if (!isNotificationSupported) return;

    if (Notification.permission !== 'granted') return;

    const todayDate = new Date('2026-05-20');

    vehicles.forEach(v => {
      // 1. Insurance Alert (remains expiring in 30 days or less)
      if (notifyInsurance) {
        const target = new Date(v.insuranceDate);
        if (!isNaN(target.getTime())) {
          const diffTime = target.getTime() - todayDate.getTime();
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          
          if (diffDays <= 30) {
            // Track in sessionStorage to notify only once per load session of the app
            const sessionKey = `notified_ins_${v.id}_${v.insuranceDate}`;
            if (!sessionStorage.getItem(sessionKey)) {
              try {
                let statusMsg = diffDays <= 0 ? '만료되었습니다!' : `${diffDays}일 남았습니다.`;
                new Notification(`[차량 보험 만료 안내] ${v.id}`, {
                  body: `${v.model}: 보험기간 만료가 ${statusMsg} 서둘러 갱신해주시기 바랍니다.`,
                  icon: '/icon.png'
                });
                sessionStorage.setItem(sessionKey, 'true');
              } catch (e) {
                console.warn('Silent fallback for notification:', e);
              }
            }
          }
        }
      }

      // 2. Oil Alert (remains expiring in 1000km or less)
      if (notifyOil) {
        const drivenSinceChange = v.currentMileage - v.lastOilMileage;
        const remains = v.oilChangeCycle - drivenSinceChange;

        if (remains <= 1000) {
          const sessionKey = `notified_oil_${v.id}_${v.currentMileage}`;
          if (!sessionStorage.getItem(sessionKey)) {
            try {
              let statusMsg = remains <= 0 ? '교체주기를 초과하였습니다!' : `${remains}km 남았습니다.`;
              new Notification(`[엔진오일 교체 안내] ${v.id}`, {
                body: `${v.model}: 엔진오일 체크 주기까지 ${statusMsg} 정비 예약이나 리프레시 검토를 바랍니다.`,
                icon: '/icon.png'
              });
              sessionStorage.setItem(sessionKey, 'true');
            } catch (e) {
              console.warn('Silent fallback for notification:', e);
            }
          }
        }
      }
    });
  }, [vehicles, notifyInsurance, notifyOil, userRole]);

  // 2. Fetch local storage data (offline-first persistent storage) on boot and session changes
  useEffect(() => {
    loadSpreadsheetData('', '');
  }, [isDemoMode, needsAuth]);

  const loadSpreadsheetData = async (sheetId: string, accToken: string) => {
    setIsLoading(true);
    setSyncError(null);
    try {
      const data = await fetchSpreadsheetData(sheetId, accToken);
      setVehicles(data.vehicles);
      setReservations(data.reservations);
      setLogs(data.logs);
      setRepairs(data.repairs);
      
      if (data.users && data.users.length > 0) {
        setSheetUsers(data.users);
        localStorage.setItem('welfare_sheet_users_cache', JSON.stringify(data.users));
        
        // Sync role changes if logged in
        const savedSession = localStorage.getItem('welfare_active_session_user');
        if (savedSession) {
          try {
            const virtualUser = JSON.parse(savedSession);
            const liveUser = data.users.find(u => u.username === virtualUser.displayName);
            if (liveUser) {
              const updatedSession = { ...virtualUser, role: liveUser.role };
              localStorage.setItem('welfare_active_session_user', JSON.stringify(updatedSession));
              setCurrentUser(updatedSession);
              setUserRole(liveUser.role.toLowerCase() === 'admin' ? 'admin' : 'driver');
            }
          } catch (e) {
            console.warn('Sync role error:', e);
          }
        }
      }
    } catch (err: any) {
      console.error('Failed to load Google sheet data:', err);
      const isAuthError = err.message?.includes('세션') || err.message?.includes('만료') || err.message?.includes('401') || err.message?.includes('로그인');
      setSyncError(err.message || '스프레드시트 로드오류');
      
      // Do not block with a disruptive browser alert if it is just an auth expiry.
      // The user will see a clean, action-oriented sync banner to renew their session instead.
      if (!isAuthError) {
        alert('구글 시트에서 데이터를 불러오는데 실패하였습니다. 설정을 확인해 주십시오.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleAccessKeyLogin = (keyToVerify = inputAccessKey) => {
    const trimmedKey = keyToVerify.trim();
    if (!trimmedKey) {
      setAccessKeyError('접근 키를 입력해 주십시오.');
      return;
    }

    const foundUser = sheetUsers.find(
      u => String(u.accessKey).toLowerCase().trim() === trimmedKey.toLowerCase()
    );

    if (foundUser) {
      const virtualUser = {
        uid: `virtual_${foundUser.username}`,
        email: `${foundUser.accessKey}@jeongsim.or.kr`,
        displayName: foundUser.username,
        photoURL: '',
        role: foundUser.role,
      };

      setCurrentUser(virtualUser);
      const isUserAdmin = foundUser.role.toLowerCase() === 'admin';
      setUserRole(isUserAdmin ? 'admin' : 'driver');
      
      // Deactivate Demo Mode upon real passcode login
      setIsDemoMode(false);
      localStorage.removeItem('welfare_vehicle_demo_mode');
      
      localStorage.setItem('welfare_active_session_user', JSON.stringify(virtualUser));
      setNeedsAuth(false);
      setAccessKeyError(null);
      setInputAccessKey('');
    } else {
      setAccessKeyError('등록되지 않은 접근 키입니다. 대소문자나 비밀번호를 다시 확인해 주십시오.');
    }
  };

  const loadDemoMockData = () => {
    setIsDemoMode(true);
    setNeedsAuth(false);
    setSyncError(null);
    localStorage.setItem('welfare_vehicle_demo_mode', 'true');
    setVehicles(DEFAULT_DEMO_VEHICLES);
    setReservations(DEFAULT_DEMO_RESERVATIONS);
    setLogs(DEFAULT_DEMO_LOGS);
    setRepairs(DEFAULT_DEMO_REPAIRS);
    setUserRole('admin'); // Default mock demo mode to admin for convenient feature exploration
  };

  // Google OAuth Log-in trigger
  const handleGoogleLogin = async () => {
    setIsLoading(true);
    try {
      const result = await googleSignIn();
      if (result) {
        setToken(result.accessToken);
        setCurrentUser(result.user);
        setNeedsAuth(false);
        setIsDemoMode(false);
        localStorage.removeItem('welfare_vehicle_demo_mode');

        // Auto-assign role based on oauth email address: westrc1@jeongsim.or.kr is admin, others are driver (normal user)
        if (result.user && result.user.email) {
          const email = result.user.email.toLowerCase().trim();
          if (email === 'westrc1@jeongsim.or.kr') {
            setUserRole('admin');
          } else {
            setUserRole('driver');
          }
        } else {
          setUserRole('driver');
        }

        // Check for sheets
        const storedId = localStorage.getItem('welfare_vehicle_sheet_id');
        const defaultId = '1Sd1YdefRUQ4MgpeBmxgvPjoW-PSxmgPnxKiRftsac8U';
        if (storedId) {
          setSpreadsheetId(storedId.trim());
        } else {
          setSpreadsheetId(defaultId);
          localStorage.setItem('welfare_vehicle_sheet_id', defaultId);
        }
      }
    } catch (err: any) {
      console.error('Sign-in error:', err);
      const errMsg = err?.message || String(err);
      if (errMsg.includes('credential') || errMsg.includes('client') || errMsg.includes('401')) {
        setAuthError('구글 API 콘솔상의 Client Secret 불일치 오류(invalid_client / auth/invalid-credential)가 감지되었습니다. Firebase Console 에서 비밀 값 동기화가 필요합니다. 하단에 표시된 안내서를 따르거나 "직접 OAuth" 탭을 이용해 주십시오.');
        setLoginTab('direct');
        setShowTroubleshoot(true);
      } else {
        setAuthError(errMsg || '구글 연동 중 오류가 나타났습니다. 아래 "직접 OAuth" 방식 또는 토큰 입력을 권장합니다.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Custom Direct Google OAuth Sign Injection
  const handleDirectGoogleLogin = async (useRedirect = false) => {
    if (!loginClientId || !loginClientId.trim()) {
      setAuthError('구글 OAuth Web Client ID를 먼저 입력해 주십시오.');
      return;
    }
    
    setIsLoading(true);
    setAuthError(null);
    try {
      saveCustomClientId(loginClientId.trim());
      const result = await directGoogleSignInWithOptions(loginClientId.trim(), useRedirect);
      if (result) {
        setToken(result.accessToken);
        // Cast custom user profile object as User
        setCurrentUser(result.user as User);
        setNeedsAuth(false);
        setIsDemoMode(false);
        localStorage.removeItem('welfare_vehicle_demo_mode');
        
        if (result.user && result.user.email) {
          const email = result.user.email.toLowerCase().trim();
          if (email === 'westrc1@jeongsim.or.kr') {
            setUserRole('admin');
          } else {
            setUserRole('driver');
          }
        } else {
          setUserRole('driver');
        }

        // Setup Sheet ID
        const storedId = localStorage.getItem('welfare_vehicle_sheet_id');
        const defaultId = '1Sd1YdefRUQ4MgpeBmxgvPjoW-PSxmgPnxKiRftsac8U';
        if (storedId) {
          setSpreadsheetId(storedId.trim());
        } else {
          setSpreadsheetId(defaultId);
          localStorage.setItem('welfare_vehicle_sheet_id', defaultId);
        }
      }
    } catch (err: any) {
      console.error('Direct Google login error:', err);
      const errMsg = err?.message || '';
      if (errMsg.includes('popup-closed-by-user') || errMsg.includes('닫았습니다')) {
        setAuthError('로그인 팝업창이 닫혔습니다. 새 탭으로 여시거나 Client ID가 완벽한지 대조하십시오.');
      } else {
        setAuthError(err.message || '직접 로그인 수행 중 오류가 발생하였습니다. Web Client ID와 승인된 리다이렉션 도메인을 대조해 주십시오.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Custom Direct Access Token injection
  const handleDirectTokenLogin = async () => {
    if (!loginManualToken || !loginManualToken.trim()) {
      setAuthError('구글 액세스 토큰을 입력해 주십시오.');
      return;
    }

    setIsLoading(true);
    setAuthError(null);
    try {
      const cleanToken = loginManualToken.trim();
      const profile = await fetchGoogleUserProfile(cleanToken);
      
      setToken(cleanToken);
      setCurrentUser(profile as User);
      setNeedsAuth(false);
      setIsDemoMode(false);
      localStorage.removeItem('welfare_vehicle_demo_mode');
      
      localStorage.setItem('welfare_vehicle_google_token', cleanToken);
      localStorage.setItem('welfare_vehicle_user_profile', JSON.stringify(profile));
      
      if (profile && profile.email) {
        const email = profile.email.toLowerCase().trim();
        if (email === 'westrc1@jeongsim.or.kr') {
          setUserRole('admin');
        } else {
          setUserRole('driver');
        }
      } else {
        setUserRole('driver');
      }

      // Setup Sheet ID
      const storedId = localStorage.getItem('welfare_vehicle_sheet_id');
      const defaultId = '1Sd1YdefRUQ4MgpeBmxgvPjoW-PSxmgPnxKiRftsac8U';
      if (storedId) {
        setSpreadsheetId(storedId.trim());
      } else {
        setSpreadsheetId(defaultId);
        localStorage.setItem('welfare_vehicle_sheet_id', defaultId);
      }
    } catch (err: any) {
      console.error('Direct Token interface error:', err);
      setAuthError(err.message || '입력하신 구글 액세스 토큰이 무효하거나 프로필을 가져오는데 실패하였습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  // Logout/Disconnect Handler
  const handleLogout = async () => {
    setCurrentUser(null);
    localStorage.removeItem('welfare_active_session_user');
    setNeedsAuth(true);
    setInputAccessKey('');
    setAccessKeyError(null);
    setActiveTab('dashboard');
  };

  // User CRUD Synchronization Handlers
  const handleAddSheetUser = async (user: { username: string; accessKey: string; role: string }) => {
    if (isDemoMode) {
      const newRowNum = sheetUsers.length > 0 ? Math.max(...sheetUsers.map(u => u.rowNum || 0)) + 1 : 2;
      const newUsers = [...sheetUsers, { ...user, rowNum: newRowNum }];
      setSheetUsers(newUsers);
      localStorage.setItem('welfare_sheet_users_cache', JSON.stringify(newUsers));
      return;
    }

    if (!spreadsheetId || !token) {
      throw new Error('정상적인 연동을 위해 최고관리팀 구글 마스터 로그인이 완료되어 있어야 합니다.');
    }

    await addUserRow(spreadsheetId, token, user);
    await loadSpreadsheetData(spreadsheetId, token);
  };

  const handleUpdateSheetUser = async (rowNum: number, user: { username: string; accessKey: string; role: string }) => {
    if (isDemoMode) {
      const newUsers = sheetUsers.map(u => u.rowNum === rowNum ? { ...u, ...user } : u);
      setSheetUsers(newUsers);
      localStorage.setItem('welfare_sheet_users_cache', JSON.stringify(newUsers));
      return;
    }

    if (!spreadsheetId || !token) {
      throw new Error('구글 연동 활성화 상태가 아닙니다.');
    }

    await updateUserRow(spreadsheetId, token, rowNum, user);
    await loadSpreadsheetData(spreadsheetId, token);
  };

  const handleDeleteSheetUser = async (rowNum: number) => {
    if (isDemoMode) {
      const newUsers = sheetUsers.filter(u => u.rowNum !== rowNum);
      setSheetUsers(newUsers);
      localStorage.setItem('welfare_sheet_users_cache', JSON.stringify(newUsers));
      return;
    }

    if (!spreadsheetId || !token) {
      throw new Error('구글 연동 활성화 상태가 아닙니다.');
    }

    await deleteUserRow(spreadsheetId, token, rowNum);
    await loadSpreadsheetData(spreadsheetId, token);
  };


  // Full Master Disconnect
  const handleMasterDisconnect = async () => {
    await logout();
    setToken(null);
    setCurrentUser(null);
    localStorage.removeItem('welfare_active_session_user');
    const defaultId = '1Sd1YdefRUQ4MgpeBmxgvPjoW-PSxmgPnxKiRftsac8U';
    setSpreadsheetId(defaultId);
    setNeedsAuth(true);
    setIsDemoMode(false);
    setSyncError(null);
    localStorage.removeItem('welfare_vehicle_demo_mode');
    localStorage.setItem('welfare_vehicle_sheet_id', defaultId);
    setVehicles([]);
    setReservations([]);
    setLogs([]);
    setRepairs([]);
    setActiveTab('dashboard');
  };

  // Manual link existing sheet
  const handleLinkSpreadsheet = async (sheetIdOrUrl: string) => {
    if (!token) {
      throw new Error('구글 연동(로그인) 상태가 아닙니다. 상단의 구글 로그인 연동을 먼저 수행해 주십시오.');
    }
    
    // Extract ID if URL is passed
    const trimmedInput = sheetIdOrUrl.trim();
    let sheetId = trimmedInput;
    const regex = /\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/;
    const match = trimmedInput.match(regex);
    if (match && match[1]) {
      sheetId = match[1];
    } else {
      // Direct ID string might contain whitespace or other dirty symbols, clean them
      sheetId = trimmedInput.replace(/\s+/g, '');
    }

    try {
      setIsLoading(true);
      await fetchSpreadsheetData(sheetId, token); // Verify it reads
      setSpreadsheetId(sheetId);
      setSyncError(null);
      localStorage.setItem('welfare_vehicle_sheet_id', sheetId);
      setIsDemoMode(false);
      localStorage.removeItem('welfare_vehicle_demo_mode');
      setActiveTab('dashboard');
    } catch (err: any) {
      setSyncError(err.message || '스프레드시트 로드오류');
      throw new Error('전달해주신 구글 시트 ID 또는 주소가 유효하지 않거나 읽기/쓰기 권한이 부족합니다. (공유설정에서 복지관 계정에 편집자 권한이 부여되었는지 확인하십시오)');
    } finally {
      setIsLoading(false);
    }
  };

  const handleConnectGasWebApp = async (url: string) => {
    const cleanUrl = url.trim();
    if (!cleanUrl) {
      throw new Error('Apps Script 웹앱 URL을 입력해 주십시오.');
    }
    try {
      setIsLoading(true);
      localStorage.setItem('welfare_gas_web_app_url', cleanUrl);
      setGasWebAppUrl(cleanUrl);
      
      const data = await fetchSpreadsheetData('', '');
      setVehicles(data.vehicles);
      setReservations(data.reservations);
      setLogs(data.logs);
      setRepairs(data.repairs);
      if (data.users && data.users.length > 0) {
        setSheetUsers(data.users);
        localStorage.setItem('welfare_sheet_users_cache', JSON.stringify(data.users));
      }
      setIsDemoMode(false);
      localStorage.removeItem('welfare_vehicle_demo_mode');
    } catch (err: any) {
      localStorage.removeItem('welfare_gas_web_app_url');
      setGasWebAppUrl(null);
      throw new Error(err.message || 'Apps Script 연동 실패. URL 및 배포 설정을 확인하십시오.');
    } finally {
      setIsLoading(false);
    }
  };

  // Auto create sheet
  const handleCreateNewSpreadsheet = async () => {
    if (!token) {
      throw new Error('구글 연동(로그인) 상태가 아닙니다. 상단의 구글 로그인 연동을 먼저 수행해 주십시오.');
    }

    try {
      setIsLoading(true);
      const newSheetId = await createVehicleSpreadsheet(token);
      setSpreadsheetId(newSheetId);
      localStorage.setItem('welfare_vehicle_sheet_id', newSheetId);
      setIsDemoMode(false);
      localStorage.removeItem('welfare_vehicle_demo_mode');
      setActiveTab('dashboard');
    } catch (err: any) {
      throw new Error(err.message || '새 스프레드시트 발급에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisconnectSpreadsheet = () => {
    const defaultId = '1Sd1YdefRUQ4MgpeBmxgvPjoW-PSxmgPnxKiRftsac8U';
    setSpreadsheetId(defaultId);
    setSyncError(null);
    localStorage.setItem('welfare_vehicle_sheet_id', defaultId);
    localStorage.removeItem('welfare_gas_web_app_url');
    
    const defaultGasUrl = getGlobalGasUrl();
    setGasWebAppUrl(defaultGasUrl);

    if (defaultGasUrl) {
      loadSpreadsheetData('', '');
    } else if (token) {
      loadSpreadsheetData(defaultId, token);
    } else {
      setVehicles([]);
      setReservations([]);
      setLogs([]);
      setRepairs([]);
    }
    setActiveTab('settings');
  };

  // --- RECONCILING GOOGLE SHEETS WRITES WITH STATE UPDATES ---

  // Add Vehicle Sync
  const handleAddVehicle = async (newVehicle: Omit<Vehicle, 'rowNum'>) => {
    await addVehicleRow('', '', newVehicle);
    await loadSpreadsheetData('', '');
  };

  // Update Vehicle (currentMileage, status, picture, lastOilMileage)
  const handleUpdateVehicle = async (rowNum: number, column: any, value: any) => {
    await updateVehicleCell('', '', rowNum, column, value);
    await loadSpreadsheetData('', '');
  };

  // Add Reservation Sync
  const handleAddReservation = async (newRes: Reservation) => {
    await addReservationRow('', '', newRes);
    await loadSpreadsheetData('', '');
  };

  // Update Reservation status
  const handleUpdateReservationStatus = async (rowNum: number, status: '대기' | '승인' | '반려' | '완료') => {
    await updateReservationStatus('', '', rowNum, status);
    await loadSpreadsheetData('', '');
  };

  // Add Operation Log (Updates driving range + synchronizes current mileage)
  const handleAddDriveLog = async (newLog: DriveLog, updatedMileage: number) => {
    // 1. Log drive row
    await addDriveLogRow('', '', newLog);
    
    // 2. Lookup related vehicle to update cumulative mileage cell
    const matchingVehicle = vehicles.find(v => v.id === newLog.vehicleId);
    if (matchingVehicle) {
      await updateVehicleCell('', '', matchingVehicle.rowNum, 'currentMileage', updatedMileage);
    }
    
    await loadSpreadsheetData('', '');
  };

  // Add Repair record (updates engine oil trigger checkpoint if set to true)
  const handleAddRepairLog = async (newRepair: RepairLog, updateLastOilMileage?: number) => {
    // 1. Add Repair info row
    await addRepairLogRow('', '', newRepair);

    // 2. Resets Engine Oil mileage threshold
    if (updateLastOilMileage !== undefined) {
      const matchingVehicle = vehicles.find(v => v.id === newRepair.vehicleId);
      if (matchingVehicle) {
        // Update both lastOilMileage AND ensure base currentMileage is tied correctly
        await updateVehicleCell('', '', matchingVehicle.rowNum, 'lastOilMileage', updateLastOilMileage);
        if (newRepair.mileage > matchingVehicle.currentMileage) {
          await updateVehicleCell('', '', matchingVehicle.rowNum, 'currentMileage', newRepair.mileage);
        }
      }
    }

    await loadSpreadsheetData('', '');
  };

  // Navigation Preset connector
  const handleNavigateToLogsWithPreset = (vehicleId: string, driverName: string) => {
    setPresetVehicleId(vehicleId);
    setPresetDriverName(driverName);
    setActiveTab('logs');
  };

  const handleClearPresets = () => {
    setPresetVehicleId('');
    setPresetDriverName('');
  };

  // --- RENDERING ROUTINES ---

  if (showIntro) {
    return <IntroScreen onComplete={() => setShowIntro(false)} />;
  }

  return (
    <PhoneFrame>
      {/* 1. Loader screen overlay during active cloud fetch operations */}
      {isLoading && (
        <div className="absolute inset-0 bg-[#f4f6f0]/90 backdrop-blur-sm z-50 flex flex-col items-center justify-center gap-3 text-[#516931] font-bold select-none text-xs">
          <Loader2 className="w-8 h-8 animate-spin" />
          <span>구글 클라우드 동기화 중...</span>
        </div>
      )}

      {/* 2. AUTH SCREEN */}
      {needsAuth ? (
        <div className="flex-1 flex flex-col justify-center items-center p-4 bg-[#2f3d24] text-slate-800 select-none overflow-y-auto min-h-full relative">
          
          {/* Ambient visual background glow */}
          <div className="absolute top-10 left-10 w-44 h-44 bg-[#7b8f6c]/20 rounded-full blur-[80px]" />
          <div className="absolute bottom-10 right-10 w-44 h-44 bg-[#516931]/10 rounded-full blur-[80px]" />

          {/* Clean Main Passcode Lock Card */}
          <div className="bg-white rounded-[28px] p-8 shadow-2xl border border-white/10 w-full max-w-[340px] flex flex-col items-center text-center relative z-10">
            
            {/* Centered clipboard/checklist decorative badge */}
            <div className="w-14 h-14 rounded-2xl bg-[#516931]/10 border border-[#516931]/20 flex items-center justify-center text-[#516931] shadow-sm mb-5">
              <FileSpreadsheet className="w-7 h-7" />
            </div>
            
            {/* Title / Header */}
            <div className="w-full overflow-hidden">
              <h2 className="text-[13px] sm:text-[13.5px] font-black text-[#192310] tracking-tight whitespace-nowrap">정심작업장 차량관리 시스템</h2>
              <p className="text-[11.2px] font-bold text-[#7b8f6c] mt-1 text-center">
                승인된 사용자만 접근 가능합니다.
              </p>
            </div>

            {/* Access Key Input and Connect Trigger */}
            <div className="w-full mt-6 flex flex-col gap-3">
              <div className="relative">
                <input
                  type="password"
                  value={inputAccessKey}
                  onChange={(e) => {
                    setInputAccessKey(e.target.value);
                    setAccessKeyError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleAccessKeyLogin();
                    }
                  }}
                  placeholder="접근 키를 입력하세요"
                  className="w-full h-11 text-center text-sm px-4 py-3 bg-[#f4f7f4] border border-[#d6dfce]/80 rounded-xl text-[#1e2318] focus:outline-none focus:border-[#516931] focus:ring-1 focus:ring-[#516931] placeholder-[#8ea481] font-semibold"
                />
              </div>

              {accessKeyError && (
                <div className="text-[10px] text-red-650 font-bold bg-red-50/70 p-2.5 rounded-lg border border-red-100/50 flex items-center gap-1.5 text-left leading-normal animate-pulse">
                  <AlertCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                  <span>{accessKeyError}</span>
                </div>
              )}

              <button
                onClick={() => handleAccessKeyLogin()}
                className="w-full h-12 bg-[#485935] hover:bg-[#3d4b2d] active:scale-[0.98] text-white font-black py-2.5 px-4 rounded-xl text-xs tracking-wider transition shadow-md cursor-pointer text-center flex items-center justify-center"
              >
                접속하기
              </button>
            </div>

            {/* Footer Text */}
            <div className="flex flex-col items-center gap-1 mt-6 text-[#7b8f6c] border-t border-dashed border-[#e6ecde] pt-4 w-full">
              <div className="flex items-center gap-1 text-[9px] font-black tracking-wider text-[#516931]">
                <ShieldCheck className="w-3.5 h-3.5 text-[#516931]" />
                AUTHORIZED PERSONNEL ONLY
              </div>
              <p className="text-[9px] text-[#8e9d82] text-center font-semibold leading-relaxed">
                구글 스프레드시트에 등록된 접근 키를 입력하세요.
              </p>
            </div>
          </div>

          {/* Removed passcode guide banner */}
        </div>
      ) : (
        /* 3. CORE FLIGHT INTERFACE */
        <div className="flex-1 flex flex-col h-full bg-[#f4f6f0] pb-16 overflow-x-hidden select-none">
          
          {/* Scrollable Core Screen Area */}
          <div className="flex-1 overflow-y-auto pb-4">
            
            {/* Route Tabs content view */}
            {activeTab === 'dashboard' && (
              <DashboardView
                vehicles={vehicles}
                reservations={reservations}
                repairs={repairs}
                userRole={userRole}
                userName={currentUser?.displayName || '충남서부 복지사'}
                onNavigate={(tab) => setActiveTab(tab as any)}
                onSelectVehicle={(vId) => {
                  setActiveTab('vehicles');
                }}
                onCreateDemoSheet={handleCreateNewSpreadsheet}
                spreadsheetId={spreadsheetId}
                isDemoMode={isDemoMode}
                syncError={syncError}
                onGoogleLogin={handleGoogleLogin}
                onLogout={handleLogout}
              />
            )}

            {activeTab === 'vehicles' && (
              <VehiclesView
                vehicles={vehicles}
                token={token}
                spreadsheetId={spreadsheetId}
                userRole={userRole}
                onAddVehicle={handleAddVehicle}
                onUpdateVehicle={handleUpdateVehicle}
              />
            )}

            {activeTab === 'reservations' && (
              <ReservationsView
                reservations={reservations}
                vehicles={vehicles}
                token={token}
                spreadsheetId={spreadsheetId}
                userRole={userRole}
                driverEmail={currentUser?.email || 'driver@welfare.org'}
                onAddReservation={handleAddReservation}
                onUpdateReservationStatus={handleUpdateReservationStatus}
                onNavigateToLogsWithPreset={handleNavigateToLogsWithPreset}
              />
            )}

            {activeTab === 'logs' && (
              <DriveLogsView
                logs={logs}
                vehicles={vehicles}
                repairs={repairs}
                reservations={reservations}
                onUpdateReservationStatus={handleUpdateReservationStatus}
                token={token}
                spreadsheetId={spreadsheetId}
                presetVehicleId={presetVehicleId}
                presetDriverName={presetDriverName}
                onClearPresets={handleClearPresets}
                onAddDriveLog={handleAddDriveLog}
              />
            )}

            {activeTab === 'repairs' && (
              <RepairsView
                repairs={repairs}
                vehicles={vehicles}
                token={token}
                spreadsheetId={spreadsheetId}
                userRole={userRole}
                onAddRepairLog={handleAddRepairLog}
              />
            )}

            {activeTab === 'settings' && (
              <SettingsView
                spreadsheetId={spreadsheetId}
                userRole={userRole}
                onChangeRole={(role) => setUserRole(role)}
                onLinkSpreadsheet={handleLinkSpreadsheet}
                onCreateNewSpreadsheet={handleCreateNewSpreadsheet}
                onDisconnectSpreadsheet={handleDisconnectSpreadsheet}
                onLoadDemoData={loadDemoMockData}
                onLogout={handleLogout}
                userEmail={currentUser?.email || 'offline-demo@westrc1.jeongsim.or.kr'}
                userName={currentUser?.displayName || '체험운영 복지사'}
                userPhoto={currentUser?.photoURL || ''}
                isDemoMode={isDemoMode}
                isLoggedIn={!!currentUser && !!token}
                onGoogleLogin={handleGoogleLogin}
                notifyInsurance={notifyInsurance}
                notifyOil={notifyOil}
                onToggleNotifyInsurance={(val) => {
                  setNotifyInsurance(val);
                  localStorage.setItem('welfare_notify_insurance', String(val));
                }}
                onToggleNotifyOil={(val) => {
                  setNotifyOil(val);
                  localStorage.setItem('welfare_notify_oil', String(val));
                }}
                sheetUsers={sheetUsers}
                onAddSheetUser={handleAddSheetUser}
                onUpdateSheetUser={handleUpdateSheetUser}
                onDeleteSheetUser={handleDeleteSheetUser}
                gasWebAppUrl={gasWebAppUrl}
                onConnectGasWebApp={handleConnectGasWebApp}
              />
            )}

          </div>

          {/* Fixed Smartphone OS bottom toolbar */}
          <div className="absolute bottom-4 inset-x-0 h-16 bg-white/95 backdrop-blur-lg border-t border-[#d6dfce]/85 flex items-center justify-around px-2 z-40 select-none shadow-[0_-4px_12px_rgba(81,105,49,0.05)]">
            
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`flex flex-col items-center justify-center gap-1 py-1 px-3.5 transition rounded-xl ${
                activeTab === 'dashboard' ? 'text-[#516931] font-bold bg-[#516931]/10 border border-[#d6dfce]' : 'text-[#7b8f6c] hover:text-[#516931]'
              }`}
            >
              <Home className="w-5 h-5 shrink-0" />
              <span className="text-[9px]">대시보드</span>
            </button>

            <button
              onClick={() => setActiveTab('vehicles')}
              className={`flex flex-col items-center justify-center gap-1 py-1 px-3.5 transition rounded-xl ${
                activeTab === 'vehicles' ? 'text-[#516931] font-bold bg-[#516931]/10 border border-[#d6dfce]' : 'text-[#7b8f6c] hover:text-[#516931]'
              }`}
            >
              <Car className="w-5 h-5 shrink-0" />
              <span className="text-[9px]">차량현황</span>
            </button>

            <button
              onClick={() => setActiveTab('reservations')}
              className={`flex flex-col items-center justify-center gap-1 py-1 px-3.5 transition rounded-xl ${
                activeTab === 'reservations' ? 'text-[#516931] font-bold bg-[#516931]/10 border border-[#d6dfce]' : 'text-[#7b8f6c] hover:text-[#516931]'
              }`}
            >
              <Calendar className="w-5 h-5 shrink-0" />
              <span className="text-[9px]">배차예약</span>
            </button>

            <button
              onClick={() => setActiveTab('logs')}
              className={`flex flex-col items-center justify-center gap-1 py-1 px-3.5 transition rounded-xl ${
                activeTab === 'logs' ? 'text-[#516931] font-bold bg-[#516931]/10 border border-[#d6dfce]' : 'text-[#7b8f6c] hover:text-[#516931]'
              }`}
            >
              <Gauge className="w-5 h-5 shrink-0" />
              <span className="text-[9px]">운행일지</span>
            </button>

            <button
              onClick={() => setActiveTab('repairs')}
              className={`flex flex-col items-center justify-center gap-1 py-1 px-3.5 transition rounded-xl ${
                activeTab === 'repairs' ? 'text-[#516931] font-bold bg-[#516931]/10 border border-[#d6dfce]' : 'text-[#7b8f6c] hover:text-[#516931]'
              }`}
            >
              <Wrench className="w-5 h-5 shrink-0" />
              <span className="text-[9px]">정비이력</span>
            </button>

          </div>
        </div>
      )}
    </PhoneFrame>
  );
}
