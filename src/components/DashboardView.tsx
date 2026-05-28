import React, { useState } from 'react';
import { Vehicle, Reservation, RepairLog } from '../lib/googleSheets';
import { formatKSTDateTime } from '../lib/dateUtils';
import { 
  Car, Calendar, ShieldAlert, Wrench, AlertTriangle, 
  CheckCircle, ChevronRight, Gauge, TrendingUp, DollarSign,
  Info, LogOut
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
  
  // Calculate alerts based on mock/live date
  const todayDate = new Date('2026-05-20');

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
    return r.startDate.startsWith('2026-05-20') || r.startDate.includes('25') || r.startDate.includes('26');
  });

  // 3. 월별 정비 비용 추이 및 기관별 데이터 가공 (2026년 기준)
  const currentYear = 2026;
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
