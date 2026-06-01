import React, { useState } from 'react';
import { Vehicle, Reservation, RepairLog } from '../lib/googleSheets';
import { formatKSTDateTime, formatKSTDate } from '../lib/dateUtils';
import { 
  Car, Calendar, ShieldAlert, Wrench, AlertTriangle, 
  CheckCircle, ChevronRight, ChevronLeft, Gauge, TrendingUp, DollarSign,
  Info, LogOut, Clock, AlertCircle
} from 'lucide-react';

interface DashboardViewProps {
  vehicles: Vehicle[];
  reservations: Reservation[];
  repairs: RepairLog[];
  userRole: 'driver' | 'admin';
  userName: string;
  onNavigate: (tab: string) => void;
  onSelectVehicle: (id: string) => void;
  onCreateDemoSheet?: () => void;
  spreadsheetId: string | null;
  isDemoMode: boolean;
  syncError?: string | null;
  onGoogleLogin?: () => Promise<void>;
  onLogout?: () => void;
}

export default function DashboardView({
  vehicles,
  reservations,
  repairs = [],
  userRole,
  userName,
  onNavigate,
  onSelectVehicle,
  spreadsheetId,
  isDemoMode,
  syncError,
  onGoogleLogin,
  onLogout
}: DashboardViewProps) {
  
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [selectedRepairInst, setSelectedRepairInst] = useState<string>('전체');
  
  // States for interactive Scheduler / Calendar
  const [calendarViewMode, setCalendarViewMode] = useState<'daily' | 'weekly'>('daily');
  const [calendarDate, setCalendarDate] = useState<Date>(new Date());
  const [selectedCalRes, setSelectedCalRes] = useState<Reservation | null>(null);

  const formatDateStr = (date: Date): string => {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const parseDateTimeToMs = (str: string) => {
    const clean = str.trim().replace(' ', 'T');
    const d = new Date(clean);
    if (!isNaN(d.getTime())) return d.getTime();
    const parts = str.split(' ');
    const dateParts = (parts[0] || '').split('-');
    const timeParts = (parts[1] || '').split(':');
    const year = parseInt(dateParts[0]) || 2026;
    const month = (parseInt(dateParts[1]) || 1) - 1;
    const day = parseInt(dateParts[2]) || 1;
    const hour = parseInt(timeParts[0]) || 0;
    const min = parseInt(timeParts[1]) || 0;
    return new Date(year, month, day, hour, min).getTime();
  };

  const getWeekDates = (date: Date): { dayName: string; dateStr: string; dateObj: Date }[] => {
    const currentDay = date.getDay(); // 0 is Sun, 1 is Mon, etc.
    const distanceToMonday = currentDay === 0 ? -6 : 1 - currentDay;
    const monday = new Date(date);
    monday.setDate(date.getDate() + distanceToMonday);

    const days: { dayName: string; dateStr: string; dateObj: Date }[] = [];
    const dayNames = ['월', '화', '수', '목', '금', '토', '일'];

    for (let i = 0; i < 7; i++) {
      const day = new Date(monday);
      day.setDate(monday.getDate() + i);
      const yyyy = day.getFullYear();
      const mm = String(day.getMonth() + 1).padStart(2, '0');
      const dd = String(day.getDate()).padStart(2, '0');
      days.push({
        dayName: dayNames[i],
        dateStr: `${yyyy}-${mm}-${dd}`,
        dateObj: day
      });
    }
    return days;
  };

  const getOverlapConflicts = (dayReservations: Reservation[]) => {
    const activeRes = dayReservations.filter(r => r.status !== '반려' && r.status !== '완료');
    const conflicts: Array<{ res1: Reservation; res2: Reservation }> = [];
    
    for (let i = 0; i < activeRes.length; i++) {
      for (let j = i + 1; j < activeRes.length; j++) {
        const r1 = activeRes[i];
        const r2 = activeRes[j];
         
        if (r1.vehicleId === r2.vehicleId) {
          const start1 = parseDateTimeToMs(r1.startDate);
          const end1 = parseDateTimeToMs(r1.endDate);
          const start2 = parseDateTimeToMs(r2.startDate);
          const end2 = parseDateTimeToMs(r2.endDate);
          
          if (start1 < end2 && start2 < end1) {
            conflicts.push({ res1: r1, res2: r2 });
          }
        }
      }
    }
    return conflicts;
  };

  const isHasConflict = (resId: string, conflicts: any[]) => {
    return conflicts.some(c => c.res1.id === resId || c.res2.id === resId);
  };

  const getTimelineCoords = (res: Reservation, dateStr: string) => {
    const targetDayStartMs = new Date(`${dateStr}T08:00:00`).getTime();
    const targetDayEndMs = new Date(`${dateStr}T20:00:00`).getTime();
    const totalDurationMs = targetDayEndMs - targetDayStartMs; // 12 hours in ms

    const resStartMs = parseDateTimeToMs(res.startDate);
    const resEndMs = parseDateTimeToMs(res.endDate);

    const clippedStartMs = Math.max(targetDayStartMs, resStartMs);
    const clippedEndMs = Math.min(targetDayEndMs, resEndMs);

    if (clippedEndMs <= clippedStartMs) {
      return null;
    }

    const startPercent = ((clippedStartMs - targetDayStartMs) / totalDurationMs) * 100;
    const widthPercent = ((clippedEndMs - clippedStartMs) / totalDurationMs) * 100;

    const startsBefore = resStartMs < targetDayStartMs;
    const endsAfter = resEndMs > targetDayEndMs;

    return {
      left: startPercent,
      width: widthPercent,
      startsBefore,
      endsAfter
    };
  };

  // Calculate alerts based on mock/live date
  const todayDate = new Date();

  const getDaysRemainingStr = (dateStr: string) => {
    if (!dateStr) return null;
    const target = new Date(dateStr);
    if (isNaN(target.getTime())) return null;
    const diffTime = target.getTime() - todayDate.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getOilProgress = (v: Vehicle) => {
    const drivenSinceChange = v.currentMileage - v.lastOilMileage;
    const pct = Math.max(0, Math.min(100, (drivenSinceChange / v.oilChangeCycle) * 100));
    const remains = v.oilChangeCycle - drivenSinceChange;
    return { pct, remains };
  };

  const alerts: Array<{
    type: 'insurance' | 'oil';
    vehicleId: string;
    model: string;
    message: string;
    urgent: boolean;
  }> = [];

  vehicles.forEach(v => {
    // 1. Insurance Alert (if within 45 days)
    const insDays = getDaysRemainingStr(v.insuranceDate);
    if (insDays !== null) {
      if (insDays <= 0) {
        alerts.push({
          type: 'insurance',
          vehicleId: v.id,
          model: v.model,
          message: `보험기간 만료! 즉시 갱신이 필요합니다 (${Math.abs(insDays)}일 초과)`,
          urgent: true,
        });
      } else if (insDays <= 30) {
        alerts.push({
          type: 'insurance',
          vehicleId: v.id,
          model: v.model,
          message: `보험 갱신까지 ${insDays}일 남았습니다.`,
          urgent: insDays <= 10,
        });
      }
    }

    // 2. Oil Alert (if remaining <= 1000km)
    const oilInfo = getOilProgress(v);
    if (oilInfo.remains <= 0) {
      alerts.push({
        type: 'oil',
        vehicleId: v.id,
        model: v.model,
        message: `엔진오일 교체 주기 초과 (${Math.abs(oilInfo.remains)}km 초과)`,
        urgent: true,
      });
    } else if (oilInfo.remains <= 1000) {
      alerts.push({
        type: 'oil',
        vehicleId: v.id,
        model: v.model,
        message: `엔진오일 교체 임박 (${oilInfo.remains}km 남음)`,
        urgent: false,
      });
    }
  });

  // Calculate generic stats
  const totalVehicles = vehicles.length;
  const inService = vehicles.filter(v => v.status === '운행가능').length;
  const inRepair = vehicles.filter(v => v.status === '수리중').length;
  
  // Today's active reservations
  const todayReservations = reservations.filter(r => {
    const todayS = formatDateStr(todayDate);
    return r.startDate.startsWith(todayS) || (r.startDate <= todayS && r.endDate >= todayS);
  });

  // 3. 월별 정비 비용 추이 및 기관별 데이터 가공
  const currentYear = new Date().getFullYear();
  const monthNames = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];

  // Map vehicle id to designated institution
  const vehicleIdToInst = new Map<string, string>();
  vehicles.forEach(v => {
    vehicleIdToInst.set(v.id, v.institution || '본관');
  });

  // Extract unique institutions and calculate distribution stats
  const uniqueRepairInsts = Array.from(new Set(vehicles.map(v => v.institution || '본관')));
  const repairInstFilters = ['전체', ...uniqueRepairInsts];

  // Overall statistics per institution
  const compStats = uniqueRepairInsts.map(inst => {
    let cost = 0;
    let count = 0;
    repairs.forEach(r => {
      const vInst = vehicleIdToInst.get(r.vehicleId) || '본관';
      if (vInst === inst) {
        cost += Number(r.cost) || 0;
        count += 1;
      }
    });
    return { inst, cost, count };
  });

  const totalOverallSpend = compStats.reduce((acc, curr) => acc + curr.cost, 0);

  // Filter repairs based on selected institution
  const filteredRepairs = repairs.filter(repair => {
    if (selectedRepairInst === '전체') return true;
    const vInst = vehicleIdToInst.get(repair.vehicleId) || '본관';
    return vInst === selectedRepairInst;
  });

  const monthlyCosts = Array(12).fill(0);
  const monthlyCounts = Array(12).fill(0);

  filteredRepairs.forEach(repair => {
    if (!repair.repairDate) return;
    const parts = repair.repairDate.split(/[-.]/);
    if (parts.length >= 2) {
      const year = parseInt(parts[0]);
      const month = parseInt(parts[1]);
      if (year === currentYear && month >= 1 && month <= 12) {
        monthlyCosts[month - 1] += Number(repair.cost) || 0;
        monthlyCounts[month - 1] += 1;
      }
    }
  });

  const totalRepairCost = monthlyCosts.reduce((a, b) => a + b, 0);
  const totalRepairCount = monthlyCounts.reduce((a, b) => a + b, 0);
  
  // Find highest cost month for current view
  let maxCostIndex = 0;
  monthlyCosts.forEach((val, idx) => {
    if (val > monthlyCosts[maxCostIndex]) {
      maxCostIndex = idx;
    }
  });
  const maxMonthlyCostValue = monthlyCosts[maxCostIndex];

  return (
    <div className="flex flex-col gap-5 px-4 pt-4 bg-[#f4f6f0]">
      
      {/* Header Profile with Role Switch */}
      <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-[#d6dfce]/80 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#516931]/10 text-[#516931] flex items-center justify-center font-bold border border-[#516931]/20">
            {userName ? userName.slice(0, 1) : '복'}
          </div>
          <div>
            <div className="text-xs text-[#7b8f6c]">환영합니다</div>
            <div className="text-sm font-semibold text-[#1e2815] flex items-center gap-1.5">
              <span>{userName || '충남서부 복지사'}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                userRole === 'admin' ? 'bg-[#516931]/10 text-[#516931] border border-[#516931]/25' : 'bg-amber-600/10 text-amber-700 border border-amber-600/25'
              }`}>
                {userRole === 'admin' ? '관리자' : '일반운전자/복지사'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {userRole === 'admin' && (
            <button 
              onClick={() => onNavigate('settings')} 
              className="text-xs bg-[#516931]/10 text-[#516931] hover:bg-[#516931]/20 px-2.5 py-1.5 rounded-xl transition font-medium cursor-pointer"
            >
              설정
            </button>
          )}
          {onLogout && (
            <button 
              onClick={onLogout} 
              className="text-xs bg-stone-100 hover:bg-stone-200 text-stone-700 px-2.5 py-1.5 rounded-xl border border-stone-200 transition font-semibold flex items-center gap-1 cursor-pointer"
              id="dashboard-logout-btn"
            >
              <LogOut className="w-3.5 h-3.5 text-stone-500" />
              <span>로그아웃</span>
            </button>
          )}
        </div>
      </div>

      {/* Welfare Center Realtime Stats Box */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white border border-[#d6dfce]/85 shadow-sm p-3 rounded-2xl flex flex-col items-center">
          <Car className="w-5 h-5 text-[#516931] mb-1" />
          <span className="text-[10px] text-[#7b8f6c]">등록차량</span>
          <span className="text-lg font-extrabold text-[#11180c]">{totalVehicles}대</span>
        </div>
        <div className="bg-white border border-[#d6dfce]/85 shadow-sm p-3 rounded-2xl flex flex-col items-center">
          <CheckCircle className="w-5 h-5 text-blue-600 mb-1" />
          <span className="text-[10px] text-[#7b8f6c]">운행가능</span>
          <span className="text-lg font-extrabold text-[#11180c]">{inService}대</span>
        </div>
        <div className="bg-white border border-[#d6dfce]/85 shadow-sm p-3 rounded-2xl flex flex-col items-center">
          <Wrench className="w-5 h-5 text-amber-600 mb-1" />
          <span className="text-[10px] text-[#7b8f6c]">정비/수리중</span>
          <span className="text-lg font-extrabold text-[#11180c]">{inRepair}대</span>
        </div>
      </div>

      {/* Quick Action Panel */}
      <div className="bg-white border border-[#d6dfce]/85 shadow-sm p-4 rounded-3xl flex flex-col gap-3">
        <h3 className="text-xs font-bold text-[#516931] tracking-wider">신속 업무 메뉴</h3>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => onNavigate('reservations')}
            className="flex items-center gap-3 bg-gradient-to-br from-[#516931] to-[#3d5025] hover:opacity-95 text-white p-3.5 rounded-2xl transition shadow-md shadow-[#516931]/10 text-left cursor-pointer"
          >
            <Calendar className="w-5 h-5 text-white shrink-0" />
            <div>
              <div className="text-xs font-bold leading-tight">차량 예약</div>
              <span className="text-[9px] text-[#dce7d2] font-semibold">배차 신청하기</span>
            </div>
          </button>

          <button
            onClick={() => onNavigate('logs')}
            className="flex items-center gap-3 bg-white hover:bg-[#f0f3eb] text-[#1e2815] p-3.5 rounded-2xl border border-[#d6dfce] transition text-left cursor-pointer shadow-sm"
          >
            <Gauge className="w-5 h-5 text-[#516931] shrink-0" />
            <div>
              <div className="text-xs font-bold leading-tight">운행기록 작성</div>
              <span className="text-[9px] text-[#7b8f6c] font-semibold">일지 기록</span>
            </div>
          </button>
        </div>
      </div>

      {/* Auto Alerts Section (보험갱신 & 엔진오일) */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-[#516931] tracking-wider flex items-center gap-1">
            <ShieldAlert className="w-4 h-4 text-[#516931]" />
            상태 갱신 및 경고 알림 ({alerts.length})
          </h3>
        </div>
        
        {alerts.length === 0 ? (
          <div className="bg-emerald-500/5 border border-emerald-500/20 p-4 rounded-2xl flex items-center gap-3 text-[#1e2815] text-xs">
            <CheckCircle className="w-5 h-5 text-[#516931] shrink-0" />
            <span>모든 차량의 보험 갱신 및 엔진오일 조건이 매우 양호합니다!</span>
          </div>
        ) : (
          <div className="flex flex-col gap-2 max-h-44 overflow-y-auto pr-1">
            {alerts.map((alert, idx) => (
              <div 
                key={idx}
                onClick={() => onSelectVehicle(alert.vehicleId)}
                className={`p-3 rounded-xl border flex items-start gap-2.5 transition text-xs cursor-pointer ${
                  alert.urgent 
                    ? 'bg-rose-50 border-rose-200 text-rose-900 hover:bg-rose-100/70' 
                    : 'bg-amber-50 border-amber-200 text-amber-900 hover:bg-amber-100/70'
                }`}
              >
                <AlertTriangle className={`w-4 h-4 shrink-0 ${alert.urgent ? 'text-rose-600' : 'text-amber-600'} mt-0.5`} />
                <div className="flex-1">
                  <div className="font-bold flex items-center justify-between">
                    <span>{alert.vehicleId} ({alert.model})</span>
                    <span className={`text-[8px] font-mono uppercase px-1 py-0.2 rounded ${
                      alert.type === 'insurance' ? 'bg-[#516931]/10 text-[#516931]' : 'bg-amber-600/10 text-amber-800'
                    }`}>
                      {alert.type === 'insurance' ? '보험만료' : '오일점검'}
                    </span>
                  </div>
                  <p className="text-[11px] opacity-90 mt-0.5">{alert.message}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 self-center" />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Current Real-time Schedules */}
      <div className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-[#516931] tracking-wider">
            배차 및 배정 현황 ({todayReservations.length})
          </h3>
          <button 
            onClick={() => onNavigate('reservations')} 
            className="text-[10px] text-[#516931] hover:underline flex items-center font-bold"
          >
            전체 일정 보기 <ChevronRight className="w-3 h-3" />
          </button>
        </div>

        {todayReservations.length === 0 ? (
          <div className="bg-white border border-[#d6dfce]/80 p-5 rounded-2xl text-center text-xs text-[#7b8f6c] shadow-sm">
            당분간 대기중인 배차가 없습니다.
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {todayReservations.slice(0, 3).map((res) => (
              <div 
                key={res.id} 
                className="bg-white border border-[#d6dfce]/80 p-3 rounded-xl flex items-center justify-between text-xs shadow-sm"
              >
                <div className="flex items-start gap-2.5">
                  <div className="mt-1 w-2 h-2 rounded-full bg-[#516931] animate-pulse" />
                  <div>
                    <div className="font-bold text-[#1e2815]">{res.vehicleId}</div>
                    <div className="text-[10px] text-[#7b8f6c] mt-0.5">
                      운전: {res.driverName} | {formatKSTDateTime(res.startDate)} ~ 
                    </div>
                    <div className="text-[10px] text-[#516931] font-medium truncate max-w-[200px] mt-1">
                      목적: {res.purpose}
                    </div>
                  </div>
                </div>
                <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold self-start ${
                  res.status === '승인' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' :
                  res.status === '대기' ? 'bg-amber-100 text-amber-800 border border-amber-200' : 'bg-slate-100 text-slate-700'
                }`}>
                  {res.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 🗓️ 배차 예약 시각화 캘린더 (일별/주별 캘린더 뷰) */}
      <div className="bg-white border border-[#d6dfce]/85 shadow-sm p-4 rounded-3xl flex flex-col gap-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-[#d6dfce]/40 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#516931]/10 text-[#516931]">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#1e2815]">배차 예약 캘린더 (일별/주별 시각화)</h3>
              <p className="text-[10px] text-[#7b8f6c] font-semibold">동일 차량 배차 예약 시간 중복(오버랩)을 실시간 체크하여 충돌을 방지합니다.</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* View Toggle */}
            <div className="inline-flex bg-[#f4f6f0] p-1 rounded-xl border border-[#d6dfce]/65 text-[10px] font-bold select-none">
              <button
                type="button"
                onClick={() => setCalendarViewMode('daily')}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  calendarViewMode === 'daily'
                    ? 'bg-[#516931] text-white shadow-xs'
                    : 'text-[#516931] hover:bg-[#e9eee2]'
                }`}
              >
                일별 타임라인
              </button>
              <button
                type="button"
                onClick={() => setCalendarViewMode('weekly')}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  calendarViewMode === 'weekly'
                    ? 'bg-[#516931] text-white shadow-xs'
                    : 'text-[#516931] hover:bg-[#e9eee2]'
                }`}
              >
                주별 일정표
              </button>
            </div>

            {/* Date Pickers / Nav */}
            <div className="flex items-center gap-1.5 bg-[#f4f6f0] p-1 rounded-xl border border-[#d6dfce]/50">
              <button
                type="button"
                onClick={() => {
                  const newDate = new Date(calendarDate);
                  if (calendarViewMode === 'daily') {
                    newDate.setDate(calendarDate.getDate() - 1);
                  } else {
                    newDate.setDate(calendarDate.getDate() - 7);
                  }
                  setCalendarDate(newDate);
                }}
                className="p-1 hover:bg-[#e9eee2] text-[#516931] rounded-lg transition cursor-pointer"
                title={calendarViewMode === 'daily' ? '이전 1일' : '이전 1주'}
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              
              <button
                type="button"
                onClick={() => setCalendarDate(new Date())}
                className="text-[9.5px] font-extrabold px-2.5 py-1 text-[#516931] hover:bg-[#e9eee2] rounded-lg transition cursor-pointer font-sans"
                title="오늘 날짜로 신속히 이동합니다."
              >
                오늘
              </button>

              <button
                type="button"
                onClick={() => {
                  const newDate = new Date(calendarDate);
                  if (calendarViewMode === 'daily') {
                    newDate.setDate(calendarDate.getDate() + 1);
                  } else {
                    newDate.setDate(calendarDate.getDate() + 7);
                  }
                  setCalendarDate(newDate);
                }}
                className="p-1 hover:bg-[#e9eee2] text-[#516931] rounded-lg transition cursor-pointer"
                title={calendarViewMode === 'daily' ? '다음 1일' : '다음 1주'}
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Native Date Input */}
            <input 
              type="date"
              value={formatDateStr(calendarDate)}
              onChange={(e) => {
                const val = e.target.value;
                if (val) {
                  setCalendarDate(new Date(val));
                }
              }}
              className="px-2.5 py-1.5 border border-[#d6dfce] rounded-xl text-[10.5px] font-bold text-[#1e2815] focus:outline-none focus:ring-1 focus:ring-[#516931] bg-[#f4f6f0]/65 text-center"
            />
          </div>
        </div>

        {/* Current Date Label */}
        <div className="flex items-center justify-between text-xs bg-[#f4f6f0]/50 px-3 py-2.5 rounded-2xl border border-[#d6dfce]/45">
          <div className="flex items-center gap-1.5 font-bold text-[#1e2815]">
            <Clock className="w-3.5 h-3.5 text-[#516931]" />
            <span>조회 기준:</span>
            <strong className="text-[#516931]">
              {calendarViewMode === 'daily' 
                ? (() => {
                    const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
                    const formatted = formatDateStr(calendarDate);
                    return `${formatted} (${dayNames[calendarDate.getDay()]})`;
                  })()
                : (() => {
                    const weeks = getWeekDates(calendarDate);
                    return `${weeks[0].dateStr} ~ ${weeks[6].dateStr} (주간 통합 일정)`;
                  })()
              }
            </strong>
          </div>
          <span className="text-[9.5px] font-bold text-[#7b8f6c]">
            * 예약 카드 클릭 시 상세 정보 팝업
          </span>
        </div>

        {/* Main Calendar Render Stage */}
        <div className="w-full">
          {calendarViewMode === 'daily' ? (
            <div className="flex flex-col gap-3">
              {/* Daily Timeline Axis Headings */}
              <div className="hidden sm:flex items-center text-[10px] font-bold text-[#7b8f6c] select-none border-b border-[#d6dfce]/30 pb-1.5 pl-[140px] pr-2">
                <div className="flex-1 flex justify-between">
                  <span>08:00</span>
                  <span>10:00</span>
                  <span>12:00</span>
                  <span>14:00</span>
                  <span>16:00</span>
                  <span>18:00</span>
                  <span>20:00</span>
                </div>
              </div>

              {/* Vehicle Rows */}
              <div className="flex flex-col gap-2.5">
                {vehicles.map((v) => {
                  const dateStr = formatDateStr(calendarDate);
                  const vRes = reservations.filter(res => {
                    if (res.vehicleId !== v.id) return false;
                    if (res.status === '반려') return false;
                    
                    const startD = res.startDate.split(' ')[0];
                    const endD = res.endDate.split(' ')[0];
                    return dateStr >= startD && dateStr <= endD;
                  });

                  // Calculate conflicts specifically for this vehicle on this day
                  const vConflicts = getOverlapConflicts(vRes);
                  const hasVConflict = vConflicts.length > 0;

                  return (
                    <div 
                      key={v.id} 
                      className={`flex flex-col sm:flex-row sm:items-center gap-2 p-2.5 rounded-2xl border transition-all ${
                        hasVConflict 
                          ? 'bg-rose-50/20 border-rose-250 shadow-xs' 
                          : 'bg-stone-50/40 border-stone-100 hover:bg-stone-50/80 hover:border-[#d6dfce]/80'
                      }`}
                    >
                      {/* Left Column: Vehicle Plate / Tag */}
                      <div className="w-[130px] shrink-0 flex flex-col justify-center select-none">
                        <span className="text-[11px] font-extrabold text-[#1e2815] truncate flex items-center gap-1.5">
                          <span>{v.id.split(' ')[0] || v.id}</span>
                          {hasVConflict && (
                            <span className="text-[8px] font-extrabold px-1.5 py-0.5 bg-rose-600 text-white rounded-full animate-pulse shrink-0">
                              중복!
                            </span>
                          )}
                        </span>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[9px] text-[#7b8f6c] truncate max-w-[85px]">{v.model}</span>
                          <span className="text-[8px] font-extrabold bg-[#516931]/10 text-[#516931] px-1 rounded-sm shrink-0">
                            {v.institution || '본관'}
                          </span>
                        </div>
                      </div>

                      {/* Right Column: Timeline Box */}
                      <div className="flex-1 relative h-9 bg-white rounded-xl border border-stone-150 flex items-center overflow-hidden">
                        {/* Vertical hour division grid lines */}
                        {Array.from({ length: 11 }).map((_, i) => {
                          const leftPct = ((i + 1) / 12) * 100;
                          return (
                            <div 
                              key={i} 
                              className="absolute h-full w-[1px] bg-[#d6dfce]/20 pointer-events-none" 
                              style={{ left: `${leftPct}%` }} 
                            />
                          );
                        })}

                        {/* Reservation blocks */}
                        {vRes.length === 0 ? (
                          <span className="text-[9.5px] text-[#7b8f6c] pl-3 italic select-none">
                            배차 예약 일정 없음
                          </span>
                        ) : (
                          vRes.map((res) => {
                            const coords = getTimelineCoords(res, dateStr);
                            if (!coords) return null;

                            const isOverlap = isHasConflict(res.id, vConflicts);

                            return (
                              <button
                                key={res.id}
                                type="button"
                                onClick={() => setSelectedCalRes(res)}
                                style={{
                                  left: `${coords.left}%`,
                                  width: `${coords.width}%`,
                                }}
                                className={`absolute h-7 rounded-lg text-[9px] font-bold px-2 flex flex-col justify-center transition-all shadow-xs truncate text-left border cursor-pointer hover:scale-[1.015] hover:z-20 ${
                                  isOverlap
                                    ? 'bg-gradient-to-r from-rose-50 to-amber-50 hover:from-rose-100 hover:to-amber-100 border-rose-350 text-rose-950 shadow-xs shadow-rose-100'
                                    : res.status === '대기'
                                      ? 'bg-orange-50 hover:bg-orange-100 border-orange-250 text-orange-950'
                                      : 'bg-emerald-50 hover:bg-emerald-100 border-emerald-250 text-emerald-950'
                                }`}
                                title={`${res.driverName} (${res.startDate.split(' ')[1]}~${res.endDate.split(' ')[1]}) - ${res.purpose}`}
                              >
                                <div className="flex items-center gap-1 truncate font-extrabold text-[9px] leading-tight">
                                  {isOverlap && <AlertTriangle className="w-3 h-3 text-rose-600 shrink-0" />}
                                  <span className="truncate">{res.driverName} ({res.startDate.split(' ')[1]}~${res.endDate.split(' ')[1]})</span>
                                </div>
                                <span className="text-[8px] opacity-80 truncate leading-none mt-0.5 font-medium">{res.purpose}</span>
                              </button>
                            );
                          })
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* Weekly Layout Grid */
            <div className="flex flex-col gap-1 sm:gap-0">
              <div className="flex gap-2.5 overflow-x-auto pb-2.5 sm:grid sm:grid-cols-7 sm:gap-2 sm:overflow-visible">
                {getWeekDates(calendarDate).map((day) => {
                  const dayRes = reservations.filter(res => {
                    if (res.status === '반려') return false;
                    const startD = res.startDate.split(' ')[0];
                    const endD = res.endDate.split(' ')[0];
                    return day.dateStr >= startD && day.dateStr <= endD;
                  });

                  const dayConflicts = getOverlapConflicts(dayRes);
                  const isSelectedDay = formatDateStr(calendarDate) === day.dateStr;

                  return (
                    <div 
                      key={day.dateStr}
                      className={`flex-1 min-w-[125px] rounded-2xl border p-2.5 flex flex-col gap-2 transition-all ${
                        isSelectedDay 
                          ? 'bg-[#516931]/5 border-[#516931] shadow-xs' 
                          : 'bg-[#f4f6f0]/30 border-[#d6dfce]/40 hover:bg-[#e9eee2]/45'
                      }`}
                    >
                      {/* Day Label Header */}
                      <button
                        type="button"
                        onClick={() => setCalendarDate(day.dateObj)}
                        className="flex items-center justify-between text-left cursor-pointer w-full group"
                      >
                        <div>
                          <span className={`text-xs font-extrabold ${isSelectedDay ? 'text-[#516931]' : 'text-stone-900 group-hover:text-[#516931]'}`}>
                            {day.dateStr.slice(8)}일
                          </span>
                          <span className="text-[10px] font-bold text-[#7b8f6c] ml-1">({day.dayName})</span>
                        </div>
                        {dayRes.length > 0 && (
                          <span className={`text-[8.5px] font-extrabold px-1.5 py-0.2 rounded-full font-mono ${
                            isSelectedDay ? 'bg-[#516931] text-white' : 'bg-[#1e2815]/10 text-[#516931]'
                          }`}>
                            {dayRes.length}
                          </span>
                        )}
                      </button>

                      {/* Under Line */}
                      <div className={`h-[1.5px] w-full rounded-full ${isSelectedDay ? 'bg-[#516931]' : 'bg-[#d6dfce]/40'}`} />

                      {/* Reservations List items container */}
                      <div className="flex flex-col gap-1.5 flex-1 min-h-[160px] justify-start">
                        {dayRes.length === 0 ? (
                          <span className="text-[9px] text-[#7b8f6c]/70 py-10 text-center italic">일정 없음</span>
                        ) : (
                          dayRes.map((res) => {
                            const isItemConflict = isHasConflict(res.id, dayConflicts);
                            
                            return (
                              <button
                                key={res.id}
                                type="button"
                                onClick={() => setSelectedCalRes(res)}
                                className={`w-full text-left p-2 rounded-xl border text-[9px] flex flex-col gap-1 transition hover:shadow-xs hover:border-[#516931]/60 hover:scale-[1.01] cursor-pointer ${
                                  isItemConflict
                                    ? 'bg-rose-50 hover:bg-rose-100 border-rose-200 text-rose-950 shadow-xs'
                                    : res.status === '대기'
                                      ? 'bg-orange-50 hover:bg-orange-100 border-orange-200 text-orange-950'
                                      : 'bg-white hover:bg-stone-50 border-stone-200 text-stone-900 shadow-3xs'
                                }`}
                              >
                                <div className="flex items-center justify-between font-extrabold gap-1 leading-none">
                                  <span className="truncate">{res.driverName}</span>
                                  <span className={`text-[7.5px] px-1 font-extrabold rounded-full ${
                                    res.status === '승인' ? 'bg-emerald-100 text-emerald-800' :
                                    res.status === '대기' ? 'bg-orange-100 text-orange-850' : 'bg-slate-100 text-slate-700'
                                  }`}>
                                    {res.status}
                                  </span>
                                </div>

                                <div className="text-[7.5px] text-[#516931] font-bold truncate leading-tight mt-0.5">
                                  {res.vehicleId.split(' ')[0]}
                                </div>

                                <div className="text-[8px] font-mono font-bold text-stone-500 mt-0.5">
                                  {res.startDate.split(' ')[1]}~{res.endDate.split(' ')[1]}
                                </div>
                              </button>
                            );
                          })
                        )}
                      </div>

                      {dayConflicts.length > 0 && (
                        <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-xl p-1 text-[8px] font-extrabold text-center mt-auto flex items-center justify-center gap-0.5 shrink-0 select-none">
                          <AlertTriangle className="w-2.5 h-2.5 shrink-0 text-rose-600 animate-pulse" />
                          <span>배차 일정 중복!</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* ⚠️ Conflicts Alert Panel (Only visible when conflicts exist on searched day) */}
        {(() => {
          const dateStr = formatDateStr(calendarDate);
          const dayReservations = reservations.filter(res => {
            if (res.status === '반려') return false;
            const startD = res.startDate.split(' ')[0];
            const endD = res.endDate.split(' ')[0];
            return dateStr >= startD && dateStr <= endD;
          });
          const dayConflicts = getOverlapConflicts(dayReservations);

          if (dayConflicts.length === 0) return null;

          return (
            <div className="bg-rose-50 border border-rose-250 rounded-2xl p-3 text-xs text-rose-950 flex flex-col gap-1.5 animate-fadeIn">
              <div className="flex items-center gap-1.5 font-bold text-rose-800 select-none">
                <AlertCircle className="w-4 h-4 text-rose-600 animate-pulse" />
                <span>⚠️ 배차 예약 일정 중복 안내 ({dayConflicts.length}건 감지)</span>
              </div>
              <div className="flex flex-col gap-1 pl-5">
                {dayConflicts.map((c, idx) => (
                  <div key={idx} className="font-semibold leading-relaxed text-[11px]">
                    <span className="text-[#516931] font-extrabold">[{c.res1.vehicleId}]</span> 차량:{' '}
                    <strong className="text-stone-900 font-bold">{c.res1.driverName}님</strong>
                    <span className="text-stone-500 font-mono text-[9.5px] ml-1">({c.res1.startDate.split(' ')[1]}~{c.res1.endDate.split(' ')[1]})</span>
                    <span className="text-stone-400 font-normal mx-1 font-mono">↔</span>
                    <strong className="text-stone-900 font-bold">{c.res2.driverName}님</strong>
                    <span className="text-stone-500 font-mono text-[9.5px] ml-1">({c.res2.startDate.split(' ')[1]}~{c.res2.endDate.split(' ')[1]})</span>
                    <span className="text-[#bf3b3b] font-bold ml-1.5">교차 중복</span>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-rose-700 font-bold pl-5 mt-0.5 select-none hover:underline cursor-pointer" onClick={() => onNavigate('reservations')}>
                * 관리자께서는 신속히 일정을 승인/반려 조치하거나 예약 담당자와 이용 차량을 조정해주시기 바랍니다. (누르면 예약 관리 탭으로 이동)
              </p>
            </div>
          );
        })()}

      </div>

      {/* 팝업 모달: 배차 예약 세부 정보 */}
      {selectedCalRes && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 overflow-y-auto p-4 flex items-center justify-center animate-fadeIn no-print">
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl border border-[#d6dfce]/85 p-5 flex flex-col gap-4">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[#d6dfce]/35 pb-2.5">
              <div className="flex items-center gap-2 text-[#516931]">
                <Clock className="w-4 h-4" />
                <h3 className="font-bold text-xs text-[#1e2815]">배차 상세 예약 안내</h3>
              </div>
              <button
                onClick={() => setSelectedCalRes(null)}
                className="text-stone-400 hover:text-stone-600 font-bold text-lg p-1 transition cursor-pointer"
              >
                &times;
              </button>
            </div>

            {/* Content */}
            <div className="flex flex-col gap-2.5 text-[11px]">
              <div className="flex justify-between border-b border-stone-50 pb-2">
                <span className="text-stone-550 font-bold">신청 차량</span>
                <span className="font-extrabold text-[#1e2815]">{selectedCalRes.vehicleId}</span>
              </div>
              <div className="flex justify-between border-b border-stone-50 pb-2">
                <span className="text-stone-550 font-bold">운전 사원</span>
                <span className="font-bold text-stone-900">{selectedCalRes.driverName}님</span>
              </div>
              <div className="flex justify-between border-b border-stone-50 pb-2">
                <span className="text-stone-550 font-bold">예약 기간</span>
                <span className="font-extrabold text-stone-850">{selectedCalRes.startDate} ~ {selectedCalRes.endDate.split(' ').slice(1).join(' ') || selectedCalRes.endDate}</span>
              </div>
              <div className="flex flex-col gap-1 border-b border-stone-50 pb-2 text-[11px]">
                <span className="text-stone-550 font-bold">목적/행선지</span>
                <div className="bg-[#f4f6f0] p-2 rounded-xl text-stone-900 font-bold leading-relaxed text-[10px]">
                  <div>🎯 목적: {selectedCalRes.purpose}</div>
                  <div className="mt-1">📍 목적지: {selectedCalRes.destination}</div>
                </div>
              </div>
              <div className="flex justify-between border-b border-stone-50 pb-2">
                <span className="text-stone-550 font-bold">탑승 인원</span>
                <span className="text-stone-700 font-extrabold">{selectedCalRes.passengers || '미기재'}</span>
              </div>
              <div className="flex justify-between border-b border-stone-50 pb-2">
                <span className="text-stone-550 font-bold">승인구분</span>
                <span className={`px-2 py-0.5 rounded-full font-extrabold text-[9px] ${
                  selectedCalRes.status === '승인' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' :
                  selectedCalRes.status === '대기' ? 'bg-orange-100 text-orange-850 border border-orange-200' : 'bg-rose-100 text-rose-800'
                }`}>
                  {selectedCalRes.status}
                </span>
              </div>
            </div>

            {/* Footer */}
            <div className="flex gap-2 justify-end mt-1 pt-2.5 border-t border-stone-100">
              <button
                onClick={() => setSelectedCalRes(null)}
                className="px-3.5 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl font-bold text-xs cursor-pointer transition"
              >
                닫기
              </button>
              <button
                onClick={() => {
                  setSelectedCalRes(null);
                  onNavigate('reservations');
                }}
                className="px-3.5 py-1.5 bg-[#516931] hover:bg-[#3d5025] text-white rounded-xl font-bold text-xs flex items-center gap-1 cursor-pointer transition shadow-xs"
              >
                <span>일정 승인/조정하기</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 월별 정비 비용 추이 시각화 차트 */}
      <div className="bg-white border border-[#d6dfce]/85 shadow-sm p-4 rounded-3xl flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xs font-bold text-[#516931] tracking-wider flex items-center gap-1.5 uppercase">
              <TrendingUp className="w-4 h-4 text-[#516931]" />
              월별 정비 비용 추이 ({currentYear}년)
            </h3>
            <p className="text-[10px] text-[#7b8f6c] font-medium leading-tight mt-0.5">
              {selectedRepairInst === '전체' ? '모든 등록 기관의' : `[${selectedRepairInst}] 기관의`} 월간 정비 지출 현황
            </p>
          </div>
          {hoveredIdx !== null && monthlyCosts[hoveredIdx] > 0 && (
            <span className="text-[10px] bg-[#516931] text-white px-2 py-0.5 rounded-full font-bold transition-all animate-fade-in">
              {hoveredIdx + 1}월: {monthlyCosts[hoveredIdx].toLocaleString()}원 ({monthlyCounts[hoveredIdx]}건)
            </span>
          )}
        </div>

        {/* Institution filter selector tabs */}
        <div className="flex gap-1 overflow-x-auto pb-1.5 scrollbar-thin select-none">
          {repairInstFilters.map(inst => {
            const isSelected = selectedRepairInst === inst;
            const instSpent = inst === '전체'
              ? totalOverallSpend
              : compStats.find(s => s.inst === inst)?.cost || 0;

            return (
              <button
                key={inst}
                onClick={() => setSelectedRepairInst(inst)}
                className={`px-2.5 py-1.5 rounded-xl text-[10px] font-bold border transition whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-[#516931] text-white border-[#516931] shadow-xs'
                    : 'bg-[#f4f6f0] text-[#1e2815] border-[#d6dfce]/60 hover:bg-[#e9eee2] hover:text-[#516931]'
                }`}
              >
                <span>{inst}</span>
                <span className={`text-[8.5px] px-1.5 py-0.2 rounded-full font-extrabold ${
                  isSelected ? 'bg-white/20 text-white' : 'bg-[#1e2815]/5 text-[#7b8f6c]'
                }`}>
                  {instSpent >= 10000 ? `${Math.round(instSpent / 10000)}만원` : `${instSpent.toLocaleString()}원`}
                </span>
              </button>
            );
          })}
        </div>

        {/* Aggregate overview metrics with sleek layout */}
        <div className="grid grid-cols-3 gap-2 bg-[#f4f6f0] p-2.5 rounded-2xl border border-[#d6dfce]/50 text-center">
          <div>
            <div className="text-[9px] text-[#6b7c5c] font-bold">선택 기관 누적 비용</div>
            <div className="text-xs font-extrabold text-[#11180c] mt-0.5">
              {totalRepairCost.toLocaleString()}원
            </div>
          </div>
          <div>
            <div className="text-[9px] text-[#6b7c5c] font-bold">가장 지출 많은 달</div>
            <div className="text-xs font-extrabold text-amber-700 mt-0.5">
              {maxMonthlyCostValue > 0 ? `${maxCostIndex + 1}월 (${Math.round(maxMonthlyCostValue / 10000)}만원)` : '-'}
            </div>
          </div>
          <div>
            <div className="text-[9px] text-[#6b7c5c] font-bold">정비 횟수</div>
            <div className="text-xs font-extrabold text-blue-700 mt-0.5">
              {totalRepairCount}건
            </div>
          </div>
        </div>

        {/* Responsive Custom SVG Chart with full tooltips and layout details */}
        <div className="relative w-full overflow-hidden select-none">
          {repairs.length === 0 ? (
            <div className="h-44 flex flex-col items-center justify-center text-center bg-[#f4f6f0]/50 border border-dashed border-[#d6dfce]/85 rounded-2xl gap-1.5 p-4">
              <Wrench className="w-6 h-6 text-[#7b8f6c] opacity-60 animate-pulse" />
              <p className="text-[10px] text-[#7b8f6c] font-semibold">아직 등록된 차량 정비 내역이 없습니다.</p>
              <p className="text-[9px] text-[#a0af93]">정비 탭에서 내역을 입력하시면 실시간 월간 추이가 여기에 표시됩니다.</p>
            </div>
          ) : totalRepairCost === 0 ? (
            <div className="h-44 flex flex-col items-center justify-center text-center bg-[#f4f6f0]/50 border border-dashed border-[#d6dfce]/85 rounded-2xl gap-1.5 p-4">
              <Info className="w-6 h-6 text-[#7b8f6c] opacity-60" />
              <p className="text-[10px] text-[#7b8f6c] font-semibold">[{selectedRepairInst}] 기관의 정비 내역이 없습니다.</p>
              <p className="text-[9px] text-[#a0af93]">해당 기관 차량에 지출되거나 기록된 정비 비용이 아직 0원입니다.</p>
            </div>
          ) : (
            <svg viewBox="0 0 480 180" className="w-full h-auto">
              {/* Draw Horizontal Grid/Guide lines */}
              <line x1="45" y1="20" x2="465" y2="20" stroke="#d6dfce" strokeWidth="0.8" strokeDasharray="3 3" />
              <line x1="45" y1="75" x2="465" y2="75" stroke="#d6dfce" strokeWidth="0.8" strokeDasharray="3 3" />
              <line x1="45" y1="130" x2="465" y2="130" stroke="#d6dfce" strokeWidth="0.8" strokeDasharray="3 3" />
              <line x1="45" y1="150" x2="465" y2="150" stroke="#516931" strokeWidth="1.2" />

              {/* Grid cost indicators (in 만원) */}
              <text x="38" y="24" className="text-[9px] fill-[#7b8f6c] font-bold font-mono text-right" textAnchor="end">
                {Math.round((maxMonthlyCostValue || 100000) / 10000).toLocaleString()}만
              </text>
              <text x="38" y="79" className="text-[9px] fill-[#7b8f6c] font-bold font-mono text-right" textAnchor="end">
                {Math.round(((maxMonthlyCostValue || 100000) / 2) / 10000).toLocaleString()}만
              </text>
              <text x="38" y="134" className="text-[9px] fill-[#7b8f6c] font-bold font-mono text-right" textAnchor="end">
                기본
              </text>
              <text x="38" y="154" className="text-[9px] fill-[#7b8f6c] font-bold font-mono text-right" textAnchor="end">
                0
              </text>

              {/* SVG Gradient declaration for glowing bars */}
              <defs>
                <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#516931" />
                  <stop offset="100%" stopColor="#7b8f6c" stopOpacity="0.7" />
                </linearGradient>
                <linearGradient id="barGradActive" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3d5025" />
                  <stop offset="100%" stopColor="#516931" />
                </linearGradient>
              </defs>

              {/* Monthly Cost Bars */}
              {monthlyCosts.map((val, idx) => {
                const colWidth = 35; // 420 / 12 slots is 35
                const x = 45 + idx * colWidth + 5;
                const barWidth = 24;
                
                // Max height of bar is 130px (from y=20 to y=150)
                const barHeight = val > 0 ? (val / (maxMonthlyCostValue || 100000)) * 130 : 2; // tiny indicator if 0
                const y = 150 - barHeight;

                const isActive = hoveredIdx === idx;

                return (
                  <g 
                    key={idx}
                    onMouseEnter={() => setHoveredIdx(idx)}
                    onMouseLeave={() => setHoveredIdx(null)}
                    className="cursor-pointer"
                  >
                    {/* Invisible hover area for easier touch/cursor target */}
                    <rect
                      x={45 + idx * colWidth}
                      y="10"
                      width={colWidth}
                      height="150"
                      fill="transparent"
                    />

                    {/* Visual Bar */}
                    <rect
                      x={x}
                      y={y}
                      width={barWidth}
                      height={barHeight}
                      rx="3"
                      fill={isActive ? 'url(#barGradActive)' : 'url(#barGrad)'}
                      className="transition-all duration-250 hover:filter hover:brightness-105"
                      stroke={isActive ? '#3d5025' : 'none'}
                      strokeWidth="1"
                    />

                    {/* Numeric text on top of high bars on hover */}
                    {isActive && val > 0 && (
                      <text
                        x={x + barWidth / 2}
                        y={Math.max(15, y - 5)}
                        textAnchor="middle"
                        className="text-[8.5px] fill-[#1e2815] font-extrabold font-mono filter drop-shadow-sm"
                      >
                        {Math.round(val / 1000) >= 1000 ? `${(val / 1000000).toFixed(1)}M` : `${Math.round(val / 10000)}만`}
                      </text>
                    )}

                    {/* Month Label */}
                    <text
                      x={x + barWidth / 2}
                      y="167"
                      textAnchor="middle"
                      className={`text-[9px] font-bold font-sans transition-colors duration-200 ${
                        isActive ? 'fill-[#516931] font-extrabold' : 'fill-[#7b8f6c]'
                      }`}
                    >
                      {idx + 1}월
                    </text>
                  </g>
                );
              })}
            </svg>
          )}
        </div>

        {/* 기관별 비교 분포 차트 (Legend & Breakdown segment) */}
        {totalOverallSpend > 0 && (
          <div className="flex flex-col gap-2.5 mt-1 p-3 bg-[#f4f6f0]/45 rounded-2xl border border-[#d6dfce]/50">
            <div className="flex justify-between items-center text-[10px] font-bold text-[#516931]">
              <span>🏢 기관별 지출 비교 요약 (%)</span>
              <span className="text-stone-500 font-normal">비용 점유율 비율</span>
            </div>
            {/* Multi-colored stacked segment bar */}
            <div className="h-3.5 w-full bg-stone-100 rounded-full flex overflow-hidden border border-white shadow-inner">
              {compStats.map((stat, i) => {
                const pct = totalOverallSpend > 0 ? (stat.cost / totalOverallSpend) * 100 : 0;
                if (pct === 0) return null;
                
                // Pick beautiful earthy/welfare tone segments
                const bgColors = [
                  'bg-[#516931]',       // Forest / 본관
                  'bg-teal-600',        // Teal / 주간보호센터
                  'bg-amber-600',       // Amber / 직업재활센터
                  'bg-blue-600',        // Blue
                  'bg-[#7b8f6c]'        // Light olive
                ];
                const bgClass = bgColors[i % bgColors.length];
                
                return (
                  <div 
                    key={stat.inst}
                    style={{ width: `${pct}%` }} 
                    className={`${bgClass} h-full transition-all duration-300 hover:opacity-85 cursor-pointer relative`}
                    title={`${stat.inst}: ${pct.toFixed(1)}% (${stat.cost.toLocaleString()}원)`}
                    onClick={() => setSelectedRepairInst(stat.inst)}
                  />
                );
              })}
            </div>
            
            {/* Interactive Grid summary details */}
            <div className="grid grid-cols-2 xs:grid-cols-3 gap-1.5 mt-0.5">
              {compStats.map((stat, i) => {
                const pct = totalOverallSpend > 0 ? (stat.cost / totalOverallSpend) * 100 : 0;
                const textColors = [
                  'text-[#516931]',
                  'text-teal-700',
                  'text-amber-700',
                  'text-blue-700',
                  'text-[#7b8f6c]'
                ];
                const borderColors = [
                  'border-[#516931]/30',
                  'border-teal-200',
                  'border-amber-200',
                  'border-blue-200',
                  'border-[#7b8f6c]/30'
                ];
                const dotColors = [
                  'bg-[#516931]',
                  'bg-teal-600',
                  'bg-amber-600',
                  'bg-blue-600',
                  'bg-[#7b8f6c]'
                ];
                const textColor = textColors[i % textColors.length];
                const borderColor = borderColors[i % borderColors.length];
                const dotColor = dotColors[i % dotColors.length];
                
                const isCurrentFilter = selectedRepairInst === stat.inst;
                
                return (
                  <button
                    key={stat.inst} 
                    type="button"
                    onClick={() => setSelectedRepairInst(stat.inst)}
                    className={`p-2 rounded-xl border transition-all text-left flex flex-col justify-between cursor-pointer ${
                      isCurrentFilter 
                        ? `bg-white ${borderColor} shadow-xs border-2 -translate-y-0.5` 
                        : 'bg-white/50 border-stone-100 hover:bg-white hover:border-stone-200'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 text-[9px] font-bold text-stone-700 truncate w-full">
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColor}`} />
                      <span className="truncate">{stat.inst}</span>
                    </div>
                    <div className="flex items-baseline justify-between mt-1 gap-1">
                      <span className="text-[10px] font-extrabold text-stone-900 leading-none">
                        {stat.cost >= 10000 ? `${(stat.cost / 10000).toLocaleString()}만` : `${stat.cost.toLocaleString()}원`}
                      </span>
                      <span className={`text-[8px] font-bold font-mono ${textColor}`}>
                        {pct.toFixed(0)}%
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
        
        {/* Additional information footer or interactive helper line */}
        <div className="flex items-start gap-1.5 bg-[#f4f6f0]/65 p-2 rounded-xl text-[9px] text-[#6b7c5c] font-semibold border border-[#d6dfce]/40 leading-relaxed">
          <Info className="w-3.5 h-3.5 text-[#516931] shrink-0 mt-0.5" />
          <span>
            상단의 기관 필터 탭 또는 하단의 기관별 지출 비교 칩(%)을 클릭하시면, 활성 기관별 월별 정비 지출 트렌드가 맞춤형으로 상단에 시각화됩니다.
          </span>
        </div>
      </div>

      {/* Local Storage Connection State Board */}
      <div className="bg-emerald-50/70 border border-emerald-250/50 p-4 rounded-2xl flex items-start gap-2.5 shadow-sm mt-3">
        <span className="relative flex h-2 w-2 shrink-0 mt-1">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
        </span>
        <div>
          <div className="text-xs font-extrabold text-[#192a0e]">로컬 데이터베이스 활성화 상태</div>
          <p className="text-[9.5px] text-[#425932] font-semibold mt-0.5 leading-relaxed">
            정심작업장 스마트 검수팀의 차량 현황, 예약 일정, 운행 일지 및 정비 비용 내역 전체가 기기 웹 저장소(LocalStorage)에 완벽하게 실시간 보관 중입니다. 
          </p>
        </div>
      </div>

    </div>
  );
}
