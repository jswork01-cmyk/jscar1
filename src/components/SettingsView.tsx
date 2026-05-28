import React, { useState } from 'react';
import { 
  FileSpreadsheet, LogOut, Globe, UserCheck, CheckCircle, Smartphone, 
  Bell, BellOff, ShieldAlert, Wrench, UserPlus, Trash2, Edit2, Save, X, Key, ShieldCheck
} from 'lucide-react';

interface SettingsViewProps {
  spreadsheetId: string | null;
  userRole: 'driver' | 'admin';
  onChangeRole: (role: 'driver' | 'admin') => void;
  onLinkSpreadsheet: (idOrUrl: string) => Promise<void>;
  onCreateNewSpreadsheet: () => Promise<void>;
  onDisconnectSpreadsheet: () => void;
  onLoadDemoData: () => void;
  onLogout: () => void;
  userEmail: string;
  userName: string;
  userPhoto: string;
  isDemoMode: boolean;
  isLoggedIn: boolean;
  onGoogleLogin: () => Promise<void>;
  notifyInsurance: boolean;
  notifyOil: boolean;
  onToggleNotifyInsurance: (val: boolean) => void;
  onToggleNotifyOil: (val: boolean) => void;
  sheetUsers: any[];
  onAddSheetUser: (user: { username: string; accessKey: string; role: string }) => Promise<void>;
  onUpdateSheetUser: (rowNum: number, user: { username: string; accessKey: string; role: string }) => Promise<void>;
  onDeleteSheetUser: (rowNum: number) => Promise<void>;
  gasWebAppUrl: string | null;
  onConnectGasWebApp: (url: string) => Promise<void>;
}

export default function SettingsView({
  spreadsheetId,
  userRole,
  onChangeRole,
  onLinkSpreadsheet,
  onCreateNewSpreadsheet,
  onDisconnectSpreadsheet,
  onLoadDemoData,
  onLogout,
  userEmail,
  userName,
  userPhoto,
  isDemoMode,
  isLoggedIn,
  onGoogleLogin,
  notifyInsurance,
  notifyOil,
  onToggleNotifyInsurance,
  onToggleNotifyOil,
  sheetUsers,
  onAddSheetUser,
  onUpdateSheetUser,
  onDeleteSheetUser,
  gasWebAppUrl,
  onConnectGasWebApp
}: SettingsViewProps) {

  const [sheetInput, setSheetInput] = useState('');
  const [gasUrlInput, setGasUrlInput] = useState(gasWebAppUrl || '');
  const [isLoading, setIsLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // User CRUD states for Admins
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newAccessKey, setNewAccessKey] = useState('');
  const [newRole, setNewRole] = useState<'admin' | 'Staff'>('Staff');
  
  const [editingRowNum, setEditingRowNum] = useState<number | null>(null);
  const [editUsername, setEditUsername] = useState('');
  const [editAccessKey, setEditAccessKey] = useState('');
  const [editRole, setEditRole] = useState<'admin' | 'Staff'>('Staff');
  const [userCrudError, setUserCrudError] = useState<string | null>(null);
  const [isUserActionLoading, setIsUserActionLoading] = useState(false);

  const handleAddUser = async () => {
    if (!newUsername.trim() || !newAccessKey.trim()) {
      setUserCrudError('이름과 비밀번호(접근 키)를 모두 기입해 주십시오.');
      return;
    }
    const duplicate = sheetUsers.find(
      u => u.accessKey.toLowerCase().trim() === newAccessKey.toLowerCase().trim()
    );
    if (duplicate) {
      setUserCrudError('이미 발급되어 사용 중인 접근 키(비밀번호)입니다.');
      return;
    }

    setIsUserActionLoading(true);
    setUserCrudError(null);
    try {
      await onAddSheetUser({
        username: newUsername.trim(),
        accessKey: newAccessKey.trim(),
        role: newRole
      });
      setNewUsername('');
      setNewAccessKey('');
      setNewRole('Staff');
      setIsAddingUser(false);
    } catch (e: any) {
      setUserCrudError(e.message || '사용자 추가 중 오류가 발생했습니다.');
    } finally {
      setIsUserActionLoading(false);
    }
  };

  const handleStartEdit = (user: any) => {
    setEditingRowNum(user.rowNum);
    setEditUsername(user.username);
    setEditAccessKey(user.accessKey);
    setEditRole(user.role);
    setUserCrudError(null);
  };

  const handleSaveEdit = async (rowNum: number) => {
    if (!editUsername.trim() || !editAccessKey.trim()) {
      setUserCrudError('이름과 접근 키를 모두 기입해 주십시오.');
      return;
    }
    const duplicate = sheetUsers.find(
      u => u.rowNum !== rowNum && u.accessKey.toLowerCase().trim() === editAccessKey.toLowerCase().trim()
    );
    if (duplicate) {
      setUserCrudError('이미 다른 직원이 사용 중인 접근 키입니다.');
      return;
    }

    setIsUserActionLoading(true);
    setUserCrudError(null);
    try {
      await onUpdateSheetUser(rowNum, {
        username: editUsername.trim(),
        accessKey: editAccessKey.trim(),
        role: editRole
      });
      setEditingRowNum(null);
    } catch (e: any) {
      setUserCrudError(e.message || '인물 수정 업데이트에 실패했습니다.');
    } finally {
      setIsUserActionLoading(false);
    }
  };

  const handleDeleteUser = async (rowNum: number, targetName: string) => {
    if (targetName === userName) {
      alert('현재 로그인되어 활동 중인 개인 계정은 자가 해지(삭제)할 수 없습니다.');
      return;
    }
    if (!window.confirm(`[${targetName}] 복지사를 접근 권한 명부에서 영구히 배제하시겠습니까?`)) {
      return;
    }

    setIsUserActionLoading(true);
    setUserCrudError(null);
    try {
      await onDeleteSheetUser(rowNum);
    } catch (e: any) {
      setUserCrudError(e.message || '직원 계정 해제 실패');
    } finally {
      setIsUserActionLoading(false);
    }
  };


  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return Notification.permission;
    }
    return 'default';
  });

  const requestPermission = async () => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      try {
        const permission = await Notification.requestPermission();
        setNotificationPermission(permission);
        if (permission === 'granted') {
          try {
            new Notification('정심작업장 차량관리', {
              body: '브라우저 알림 권한이 성공적으로 설정되었습니다. 보험 만료 및 엔진오일 교체 알림을 실시간으로 수신합니다.',
              icon: '/icon.png'
            });
          } catch (e) {
            console.warn('Silent fallback for notification:', e);
          }
        }
      } catch (err) {
        console.error('Error requesting notification permission:', err);
      }
    } else {
      alert('이 브라우저는 데스크톱 알림 기능을 지원하지 않습니다.');
    }
  };

  const handleLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sheetInput.trim()) return;

    setIsLoading(true);
    setSuccessMsg('');
    setErrorMsg('');
    try {
      await onLinkSpreadsheet(sheetInput);
      setSuccessMsg('스프레드시트가 성공적으로 연결되었습니다.');
      setSheetInput('');
    } catch (err: any) {
      setErrorMsg(err.message || '스프레드시트 접근 제어에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreate = async () => {
    setIsLoading(true);
    setSuccessMsg('');
    setErrorMsg('');
    try {
      await onCreateNewSpreadsheet();
      setSuccessMsg('구글 드라이브에 차량관리 전용 시트가 자동으로 신설되었습니다!');
    } catch (err: any) {
      setErrorMsg(err.message || '스프레드시트 생성에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="px-4 pt-4 flex flex-col gap-4 text-xs bg-[#f4f6f0]">
      
      {/* Title */}
      <div>
        <h2 className="text-base font-extrabold text-[#192310]">시스템 관리 환경설정</h2>
        <p className="text-[10px] text-[#7b8f6c] font-medium">구글 클라우드 및 사용자 권한 설정을 관리합니다</p>
      </div>

      {/* Active Passcode User Session Profile */}
      <div className="bg-white border border-[#d6dfce] p-4 rounded-3xl flex flex-col gap-3 shadow-md">
        <h3 className="text-[10px] font-bold text-[#516931] uppercase tracking-wider flex items-center gap-1.5">
          <UserCheck className="w-3.5 h-3.5" />
          개인 접속 사용자 프로필
        </h3>
        
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#516931] text-white flex items-center justify-center font-black border border-[#d6dfce] text-sm shadow-sm">
            {userName ? userName[0] : 'U'}
          </div>
          <div>
            <div className="text-sm font-black text-[#11180c]">{userName} 복지사님</div>
            <div className="text-[#7b8f6c] text-[10px] font-semibold mt-0.5 leading-none">
              소속 권한: {userRole === 'admin' ? '최고 관리자 (Admin)' : '일반 운전자 (Staff)'}
            </div>
          </div>
        </div>

        <button
          onClick={onLogout}
          className="w-full bg-rose-50 hover:bg-rose-100 text-rose-700 font-extrabold py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 border border-rose-200 cursor-pointer transition text-[11px]"
        >
          <LogOut className="w-4 h-4 text-rose-500" /> 개인 접속 종료 (로그아웃)
        </button>
      </div>

      {/* Admin Information Banner */}
      {userRole === 'admin' && (
        <div className="bg-[#516931]/5 border border-[#516931]/15 p-4 rounded-3xl flex items-start gap-2.5 shadow-sm">
          <FileSpreadsheet className="w-4 h-4 text-[#516931] shrink-0 mt-0.5" />
          <div>
            <h4 className="text-[10.5px] font-extrabold text-[#192a0e]">최고관리자 권한 활성화 상태</h4>
            <p className="text-[9px] text-[#4d613b] leading-relaxed mt-0.5">
              조회용 태블릿 및 모바일 기기의 스마트 오프라인 전용 차량배차 및 운행 검수 대시보드 권한을 제어할 수 있습니다. 아래의 복지관 운전자 명부를 사용해 새로운 사원과 발급할 접근 비밀키를 손쉽게 추가·삭제 관리하실 수 있습니다.
            </p>
          </div>
        </div>
      )}

      {/* Google Apps Script Real-time Sync Controls */}
      {userRole === 'admin' && (
        <div className="bg-white border border-[#d6dfce] p-4 rounded-3xl flex flex-col gap-3 shadow-md">
          <h3 className="text-[10px] font-bold text-[#516931] uppercase tracking-wider flex items-center gap-1.5 font-sans">
            <Globe className="w-3.5 h-3.5 text-[#516931]" />
            구글 스프레드시트 Apps Script 실시간 웹앱 연동
          </h3>
          
          {gasWebAppUrl ? (
            <div className="flex flex-col gap-2.5">
              <div className="p-3 bg-emerald-50 border border-emerald-250 rounded-2xl flex flex-col gap-1.5">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2 w-2 shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  <span className="font-extrabold text-[#11180c] text-[10.5px]">구글 스프레드시트 실시간 양방향 연동 활성화</span>
                </div>
                <p className="text-[#425932] text-[9.5px] font-semibold leading-relaxed">
                  ✓ 현재 정심작업장 차량관리 문서와 완벽하게 양방향 실시간 동기화 및 오프라인-하이브리드 캐싱이 설정되어 오차 없는 데이터 관리가 이루어지고 있습니다.
                </p>
                <div className="text-[9px] text-[#516931] font-mono select-all bg-white py-1.5 px-2.5 rounded-lg border border-[#e2eadd] break-all leading-normal">
                  URL: {gasWebAppUrl}
                </div>
              </div>

              <button
                onClick={() => {
                  if (window.confirm('구글 스프레드시트 웹앱 실시간 연동을 안전하게 해제하시겠습니까? (해제 시 모의 오프라인 연습 모드로 작동합니다)')) {
                    onDisconnectSpreadsheet();
                    setGasUrlInput('');
                    setSuccessMsg('연동이 해제되었습니다. 로컬 데이터베이스 전용 모드로 전환되었습니다.');
                  }
                }}
                className="w-full bg-rose-50 hover:bg-rose-100 text-rose-700 font-extrabold py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 border border-rose-200 cursor-pointer transition text-[11px]"
              >
                웹앱 실시간 연동 해제하기
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="bg-amber-50 border border-amber-200 p-3 rounded-2xl flex flex-col gap-1.5 shadow-sm">
                <span className="text-[10.5px] text-amber-950 font-bold">● 실시간 구글 연동 대기 (로컬 모드)</span>
                <p className="text-[9.5px] text-amber-700 leading-normal font-semibold">
                  아래 구글 스프레드시트 Apps Script 웹앱 배포 주소를 기입해 정심작업장 문서와 실시간 연동을 구성해 주십시오.
                </p>
              </div>

              <div className="flex flex-col gap-2 bg-[#f4f6f0] p-3 rounded-2xl border border-[#d6dfce]">
                <span className="text-[10px] font-black text-[#2e3624]">🔗 Apps Script 웹앱 URL 주소</span>
                <input
                  type="text"
                  placeholder="https://script.google.com/macros/s/.../exec"
                  value={gasUrlInput}
                  onChange={e => setGasUrlInput(e.target.value)}
                  className="w-full bg-white border border-[#d6dfce] rounded-xl p-2.5 text-[10px] text-[#1e2815] focus:outline-none focus:border-[#516931] shadow-inner font-sans"
                />
                <button
                  disabled={isLoading || !gasUrlInput.trim()}
                  onClick={async () => {
                    setIsLoading(true);
                    setErrorMsg('');
                    setSuccessMsg('');
                    try {
                      await onConnectGasWebApp(gasUrlInput);
                      setSuccessMsg('Apps Script 웹앱이 성공적으로 지정 및 연동 완료되었습니다!');
                    } catch (err: any) {
                      setErrorMsg(err.message || 'Apps Script 웹앱 연결에 실패했습니다. 형식 또는 배포 상태를 다시 확인하십시오.');
                    } finally {
                      setIsLoading(false);
                    }
                  }}
                  className="w-full bg-[#516931] hover:bg-[#435728] disabled:opacity-45 text-white font-extrabold py-2.5 px-4 rounded-xl cursor-pointer transition text-center shadow-sm text-[11px]"
                >
                  {isLoading ? '설정 테스트 연결 수신 중...' : '구글 Apps Script 웹앱 실시간 연동 활성화'}
                </button>
              </div>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-[#425932] font-semibold rounded-2xl flex items-center gap-1.5 select-none text-[10.5px]">
              <CheckCircle className="w-4 h-4 shrink-0 text-[#516931]" />
              <span>{successMsg}</span>
            </div>
          )}
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 font-semibold rounded-2xl flex items-center gap-1.5 select-none text-[10.5px]">
              <X className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
          )}
        </div>
      )}


      {/* 4. Users Table Spreadsheet integration for Admin */}
      {userRole === 'admin' && (
        <div className="bg-white border border-[#d6dfce] p-4 rounded-3xl flex flex-col gap-3 shadow-md">
          <div className="flex items-center justify-between">
            <h3 className="text-[10px] font-bold text-[#516931] uppercase tracking-wider flex items-center gap-1.5">
              <UserPlus className="w-3.5 h-3.5 text-[#516931]" />
              복지관 등록 직원 및 차량운전자 관리 명부 ({sheetUsers.length}명)
            </h3>
            
            <button
              onClick={() => {
                setIsAddingUser(!isAddingUser);
                setUserCrudError(null);
                setNewUsername('');
                setNewAccessKey('');
              }}
              className="px-2.5 py-1 bg-[#516931]/10 text-[#516931] hover:bg-[#516931]/20 font-black rounded-lg text-[9px] transition cursor-pointer flex items-center gap-1 shrink-0"
            >
              {isAddingUser ? <X className="w-3 h-3" /> : <UserPlus className="w-3 h-3" />}
              {isAddingUser ? '닫기' : '운전자 추가'}
            </button>
          </div>

          <p className="text-[10px] text-[#7b8f6c] font-medium leading-relaxed">
            구글 스프레드시트의 <code className="bg-[#f4f6f0] px-1 py-0.5 rounded font-mono text-[#516931]">Users</code> 탭과 실시간 공유되는 인증 명단입니다. 등록된 접근 키로 즉시 로그인할 수 있습니다.
          </p>

          {isDemoMode && (
            <div className="p-2.5 bg-amber-50 border border-amber-200 text-amber-800 rounded-2xl flex items-start gap-1.5 text-[9.5px] leading-relaxed">
              <ShieldAlert className="w-3.5 h-3.5 text-amber-650 shrink-0 mt-0.5" />
              <span>현재 <strong>모의 기동 상태(체험용)</strong> 이므로 실제 구글 시트 데이터가 아닌 연동 모형 데이터가 로컬에 기동되어 있습니다. 정상 동기화를 하려면 상단에서 최고관리자 구글 로그인을 먼저 연동하십시오.</span>
            </div>
          )}
          {!isDemoMode && !isLoggedIn && (
            <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl flex items-start gap-1.5 text-[9.5px] leading-relaxed">
              <ShieldAlert className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
              <span>구글 연동 마스터 로그인이 완료되지 않아 실시간 구글 시트 Users 와의 연동이 중단된 상태입니다. 기기 보관 캐시 데이터를 표시 중입니다.</span>
            </div>
          )}

          {/* Form to Add User */}
          {isAddingUser && (
            <div className="bg-[#f4f6f0] p-3 rounded-2xl border border-[#d6dfce]/50 flex flex-col gap-2.5 text-[9.5px]">
              <div className="text-[10px] font-black text-[#1e2815] border-b border-dashed border-[#d6dfce] pb-1 flex items-center gap-1">
                <span>NEW STAFF REGISTER</span>
              </div>
              
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[8px] font-bold text-[#7b8f6c] mb-0.5">성함 (username)</label>
                  <input
                    type="text"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    placeholder="예: 홍길동"
                    className="w-full h-8 px-2 bg-white border border-[#d6dfce] rounded-lg text-[#1e2318] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[8px] font-bold text-[#7b8f6c] mb-0.5">접근 키 (accessKey / 비밀번호)</label>
                  <input
                    type="text"
                    value={newAccessKey}
                    onChange={(e) => setNewAccessKey(e.target.value)}
                    placeholder="예: 7789 (숫자/영어)"
                    className="w-full h-8 px-2 bg-white border border-[#d6dfce] rounded-lg text-[#1e2318] focus:outline-none font-mono font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[8px] font-bold text-[#7b8f6c] mb-0.5">접속 권한 (role)</label>
                <div className="grid grid-cols-2 gap-1.5 p-0.5 bg-white border border-[#d6dfce] rounded-lg">
                  <button
                    type="button"
                    onClick={() => setNewRole('Staff')}
                    className={`py-1 rounded-md text-center font-bold text-[9.5px] ${newRole === 'Staff' ? 'bg-[#516931] text-white' : 'text-[#7b8f6c]'}`}
                  >
                    일반 운전자 (Staff)
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewRole('admin')}
                    className={`py-1 rounded-md text-center font-bold text-[9.5px] ${newRole === 'admin' ? 'bg-[#516931] text-white' : 'text-[#7b8f6c]'}`}
                  >
                    최고 관리자 (Admin)
                  </button>
                </div>
              </div>

              <button
                disabled={isUserActionLoading}
                onClick={handleAddUser}
                className="w-full h-8 bg-[#516931] hover:bg-[#435728] disabled:opacity-50 text-white font-black rounded-lg transition"
              >
                {isUserActionLoading ? '저장 및 구글 연동 중...' : '구글 시트에 즉시 등록하기'}
              </button>
            </div>
          )}

          {/* User Crud Error */}
          {userCrudError && (
            <div className="p-2.5 bg-rose-50 border border-rose-100 text-rose-700 rounded-xl flex items-center gap-1.5 text-[9.5px] leading-relaxed">
              <ShieldAlert className="w-3.5 h-3.5 shrink-0 text-rose-500" />
              <span>{userCrudError}</span>
            </div>
          )}

          {/* Users List */}
          <div className="flex flex-col gap-2 max-h-[220px] overflow-y-auto pr-1">
            {sheetUsers.length === 0 ? (
              <div className="text-center py-4 bg-[#f4f6f0] rounded-2xl text-stone-400 font-semibold text-[10px]">
                등록된 직원이 명부에 없습니다.
              </div>
            ) : (
              sheetUsers.map(u => {
                const isEditing = editingRowNum === u.rowNum;
                
                return (
                  <div
                    key={u.rowNum}
                    className="p-3 border border-[#d6dfce]/80 rounded-2xl bg-[#f4f6f0]/20 hover:bg-white transition flex flex-col gap-2 relative group"
                  >
                    {isEditing ? (
                      /* Inline Editing View */
                      <div className="flex flex-col gap-2">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[7.5px] font-bold text-stone-400">이름</label>
                            <input
                              type="text"
                              value={editUsername}
                              onChange={(e) => setEditUsername(e.target.value)}
                              className="w-full h-7 px-1.5 border border-[#d6dfce] rounded-md font-bold text-[#192310]"
                            />
                          </div>
                          <div>
                            <label className="block text-[7.5px] font-bold text-stone-400">접근 패스코딩</label>
                            <input
                              type="text"
                              value={editAccessKey}
                              onChange={(e) => setEditAccessKey(e.target.value)}
                              className="w-full h-7 px-1.5 border border-[#d6dfce] rounded-md font-mono font-black text-[#192310]"
                            />
                          </div>
                        </div>

                        <div className="flex items-center justify-between gap-2 mt-1">
                          <div className="flex gap-2 p-0.5 bg-stone-100 border rounded-md text-[8.5px] font-bold w-1/2">
                            <button
                              type="button"
                              onClick={() => setEditRole('Staff')}
                              className={`flex-1 py-0.5 rounded text-center ${editRole === 'Staff' ? 'bg-white text-emerald-800 border shadow-xs' : 'text-stone-500'}`}
                            >
                              Staff
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditRole('admin')}
                              className={`flex-1 py-0.5 rounded text-center ${editRole === 'admin' ? 'bg-white text-emerald-800 border shadow-xs' : 'text-stone-500'}`}
                            >
                              Admin
                            </button>
                          </div>

                          <div className="flex gap-1">
                            <button
                              disabled={isUserActionLoading}
                              onClick={() => handleSaveEdit(u.rowNum)}
                              className="px-2.5 h-6 bg-[#516931] hover:bg-[#435728] text-white rounded-md font-black text-[9px] flex items-center gap-0.5 cursor-pointer"
                            >
                              <Save className="w-3 h-3" /> 저장
                            </button>
                            <button
                              disabled={isUserActionLoading}
                              onClick={() => setEditingRowNum(null)}
                              className="px-2 h-6 bg-stone-250 hover:bg-stone-300 text-stone-600 rounded-md font-bold text-[9px] cursor-pointer"
                            >
                              취소
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      /* Read-Only Normal View */
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-[#516931]/10 text-[#516931] flex items-center justify-center font-bold text-xs select-none shadow-xs border border-[#516931]/10">
                            {u.username ? u.username[0] : 'U'}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-extrabold text-[#192310] text-[10.5px]">{u.username}</span>
                              <span className={`text-[8px] font-black px-1.5 py-0.2 rounded-full border ${
                                u.role?.toLowerCase() === 'admin'
                                  ? 'bg-rose-50 border-rose-200 text-rose-700'
                                  : 'bg-emerald-50 border-emerald-200 text-emerald-700'
                              }`}>
                                {u.role?.toLowerCase() === 'admin' ? 'Admin' : 'DRIVER / STAFF'}
                              </span>
                            </div>
                            <div className="flex items-center gap-1 mt-0.5 text-stone-500">
                              <Key className="w-3 h-3 shrink-0 text-stone-400" />
                              <span className="font-mono text-[9px] font-bold bg-white text-slate-750 border px-1 rounded">접근 키: <span className="font-bold select-all tracking-wider text-emerald-900">{u.accessKey}</span></span>
                            </div>
                          </div>
                        </div>

                        {/* Controls */}
                        <div className="flex items-center gap-1 shrink-0 opacity-80 group-hover:opacity-100 transition">
                          <button
                            onClick={() => handleStartEdit(u)}
                            className="p-1.5 text-stone-500 hover:text-[#516931] hover:bg-[#516931]/5 rounded-lg transition cursor-pointer"
                            title="행 수정"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteUser(u.rowNum, u.username)}
                            className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                            title="계정 삭제"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}


      {/* Browser Notification Settings */}
      <div className="bg-white border border-[#d6dfce] p-4 rounded-3xl flex flex-col gap-3 shadow-md">
        <h3 className="text-[10px] font-bold text-[#516931] uppercase tracking-wider flex items-center gap-1.5">
          <Bell className="w-3.5 h-3.5 text-[#516931]" />
          데스크톱 브라우저 알림 설정
        </h3>
        <p className="text-[10px] text-[#7b8f6c] font-medium leading-relaxed">
          보험 계약 만료 기간 및 엔진오일 교체 주기가 도래했을 때, 브라우저 백그라운드 푸시 알림을 발송하여 긴급 점검을 알립니다. (관리자 전용 기능)
        </p>

        {/* Permission Info */}
        <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#f4f6f0] border border-[#d6dfce]/50 text-[10px]">
          <div className="flex items-center gap-1.5 font-bold text-[#1e2815]">
            {notificationPermission === 'granted' ? (
              <>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>알림 권한: 허용됨</span>
              </>
            ) : notificationPermission === 'denied' ? (
              <>
                <span className="w-2 h-2 rounded-full bg-rose-500" />
                <span>알림 권한: 차단됨</span>
              </>
            ) : (
              <>
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                <span>알림 권한: 요청 대기</span>
              </>
            )}
          </div>
          {notificationPermission !== 'granted' && (
            <button
              onClick={requestPermission}
              className="px-2.5 py-1 bg-[#516931] hover:bg-[#435728] text-white font-bold rounded-lg text-[9px] transition cursor-pointer border border-[#435728]"
            >
              알림 사용 동의
            </button>
          )}
        </div>

        {/* Info on iframe */}
        {notificationPermission !== 'granted' && (
          <div className="text-[9px] text-amber-700 font-semibold bg-amber-50/55 p-2 rounded-xl border border-amber-200/50 leading-relaxed">
            ※ 아이프레임(iFrame) 외부 제약으로 권한 창이 안 뜰 경우, 우측 상단 [새 창 열기]를 통해 외부 탭으로 여신 후 다시 클릭해 주십시오.
          </div>
        )}

        {/* Notification toggles */}
        <div className="flex flex-col gap-2 mt-1">
          <div className="flex items-center justify-between p-2.5 border border-[#d6dfce]/60 rounded-2xl bg-[#f4f6f0]/30 hover:bg-[#f4f6f0]/60 transition">
            <div className="flex flex-col">
              <span className="font-extrabold text-[#11180c] flex items-center gap-1 text-[10px]">
                <ShieldAlert className="w-3.5 h-3.5 text-[#516931]" />
                보험 만료 임박 알림 (30일 이내)
              </span>
              <span className="text-[9px] text-[#7b8f6c] mt-0.5">차량 보험기간 소멸 30일 도래 시 알림 발송</span>
            </div>
            <button
              type="button"
              onClick={() => onToggleNotifyInsurance(!notifyInsurance)}
              className={`w-9 h-5 rounded-full p-0.5 transition-colors cursor-pointer duration-200 focus:outline-none shrink-0 ${
                notifyInsurance ? 'bg-[#516931]' : 'bg-stone-300'
              }`}
            >
              <div
                className={`w-4 h-4 bg-white rounded-full shadow-md transform transition-transform duration-200 ${
                  notifyInsurance ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between p-2.5 border border-[#d6dfce]/60 rounded-2xl bg-[#f4f6f0]/30 hover:bg-[#f4f6f0]/60 transition">
            <div className="flex flex-col">
              <span className="font-extrabold text-[#11180c] flex items-center gap-1 text-[10px]">
                <Wrench className="w-3.5 h-3.5 text-[#516931]" />
                엔진오일 교체 주기 대기 알림 (1,000km 이내)
              </span>
              <span className="text-[9px] text-[#7b8f6c] mt-0.5">교체 주기가 도래하기 1,000km 전부터 알림 발송</span>
            </div>
            <button
              type="button"
              onClick={() => onToggleNotifyOil(!notifyOil)}
              className={`w-9 h-5 rounded-full p-0.5 transition-colors cursor-pointer duration-200 focus:outline-none shrink-0 ${
                notifyOil ? 'bg-[#516931]' : 'bg-stone-300'
              }`}
            >
              <div
                className={`w-4 h-4 bg-white rounded-full shadow-md transform transition-transform duration-200 ${
                  notifyOil ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>
      </div>

    </div>
  );
}
