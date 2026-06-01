import React, { useState } from 'react';
import { Vehicle, RepairLog } from '../lib/googleSheets';
import { formatKSTDate } from '../lib/dateUtils';
import { 
  Wrench, PenTool, Check, 
  MapPin 
} from 'lucide-react';

interface RepairsViewProps {
  repairs: RepairLog[];
  vehicles: Vehicle[];
  token: string | null;
  spreadsheetId: string | null;
  userRole: 'driver' | 'admin';
  onAddRepairLog: (newRepair: RepairLog, updateLastOilMileage?: number) => Promise<void>;
}

export default function RepairsView({
  repairs,
  vehicles,
  userRole,
  onAddRepairLog
}: RepairsViewProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [repairDate, setRepairDate] = useState(() => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  });
  const [description, setDescription] = useState('');
  const [cost, setCost] = useState(0);
  const [mileage, setMileage] = useState(0);
  const [isOilChanged, setIsOilChanged] = useState(false);
  const [workshopName, setWorkshopName] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Repair List Filter
  const [filterVehicleId, setFilterVehicleId] = useState('');

  // Default mileage on vehicle choice
  const handleVehicleSelect = (vId: string) => {
    setSelectedVehicleId(vId);
    if (vId) {
      const v = vehicles.find(item => item.id === vId);
      if (v) {
        setMileage(v.currentMileage);
      }
    } else {
      setMileage(0);
    }
  };

  const handleRepairSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVehicleId || !repairDate || !description.trim() || !workshopName.trim()) {
      setError('모든 필수 정보를 누락없이 기입해 주십시오.');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const repairId = `REP-${Date.now().toString().slice(-6)}`;
      const newRepair: RepairLog = {
        id: repairId,
        vehicleId: selectedVehicleId,
        repairDate,
        description,
        cost,
        mileage,
        isOilChanged,
        workshopName,
        createdAt: new Date().toISOString().replace('T', ' ').slice(0, 19),
        rowNum: 0
      };

      await onAddRepairLog(newRepair, isOilChanged ? mileage : undefined);

      setIsRecording(false);
      setSelectedVehicleId('');
      setDescription('');
      setCost(0);
      setMileage(0);
      setIsOilChanged(false);
      setWorkshopName('');
    } catch (err: any) {
      setError(err.message || '정비 기록 저장에 실패했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredRepairs = repairs.filter(r => 
    filterVehicleId ? r.vehicleId === filterVehicleId : true
  );

  return (
    <div className="px-4 pt-4 flex flex-col gap-4 text-xs bg-[#f4f6f0]">
      
      {/* Title & Add triggers with role validation */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-extrabold text-[#192310]">정비 및 수리 이력 ({repairs.length})</h2>
          <p className="text-[10px] text-[#7b8f6c] font-medium">오일 교체주기 조기 점검 및 수리비용 예산을 실시간 집계합니다</p>
        </div>
        {userRole === 'admin' && (
          <button
            onClick={() => setIsRecording(!isRecording)}
            className="bg-[#516931] hover:bg-[#435728] text-white font-bold py-1.5 px-3 rounded-xl flex items-center gap-1 cursor-pointer transition shadow-md"
          >
            {isRecording ? '정비일람 보기' : '정비기록 작성'}
          </button>
        )}
      </div>

      {isRecording ? (
        /* New Repair Recording Box */
        <div className="bg-white border border-[#d6dfce] p-4 rounded-3xl flex flex-col gap-3 shadow-md">
          <h3 className="text-sm font-bold text-[#516931]">정비/점검 내역 기록</h3>

          {error && <div className="p-3 rounded-xl bg-rose-50 text-rose-800 font-medium">{error}</div>}

          <form onSubmit={handleRepairSubmit} className="flex flex-col gap-3 text-[#1e2815]">
            {/* Vehicle Selection */}
            <div>
              <label className="block mb-1 font-semibold text-[#516931]">대상 차량</label>
              <select
                value={selectedVehicleId}
                onChange={e => handleVehicleSelect(e.target.value)}
                className="w-full bg-[#f4f6f0] border border-[#d6dfce] rounded-xl p-2.5 focus:border-[#516931] text-[#1e2815] focus:outline-none cursor-pointer"
              >
                <option value="">정비 차량을 선택하십시오</option>
                {vehicles.map(v => (
                  <option key={v.id} value={v.id}>{v.id} - {v.model}</option>
                ))}
              </select>
            </div>

            {/* Date */}
            <div>
              <label className="block mb-1 font-semibold text-[#516931]">정비 처리일자</label>
              <input
                type="date"
                value={repairDate}
                onChange={e => setRepairDate(e.target.value)}
                className="w-full bg-[#f4f6f0] border border-[#d6dfce] rounded-xl p-2.5 focus:border-[#516931] text-[#1e2815] focus:outline-none"
              />
            </div>

            {/* Mileage at repair */}
            <div>
              <label className="block mb-1 font-semibold text-[#516931]">정비 당시 계기판 누적거리 (km)</label>
              <input
                type="number"
                value={mileage === 0 ? '' : mileage}
                placeholder="예: 45000"
                onChange={e => setMileage(parseInt(e.target.value) || 0)}
                className="w-full bg-[#f4f6f0] border border-[#d6dfce] rounded-xl p-2.5 focus:border-[#516931] text-[#1e2815] focus:outline-none font-mono text-xs"
              />
            </div>

            {/* Engine Oil Change Checklist Trigger */}
            <div className="bg-[#f4f6f0] p-3.5 rounded-2xl border border-[#d6dfce] flex items-center justify-between">
              <div>
                <span className="block font-bold text-[#1e2815]">엔진오일 교환 여부</span>
                <span className="text-[9.5px] text-[#7b8f6c] font-medium">체크 시 해당 차량의 오일교환 주기가 초기화됩니다.</span>
              </div>
              <button
                type="button"
                onClick={() => setIsOilChanged(!isOilChanged)}
                className={`w-12 h-6 rounded-full p-0.5 transition-colors duration-200 ease-in-out focus:outline-none ${
                  isOilChanged ? 'bg-[#516931]' : 'bg-[#7b8f6c]/30'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full bg-white shadow transform duration-200 ease-in-out ${
                    isOilChanged ? 'translate-x-6' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Repair description */}
            <div>
              <label className="block mb-1 font-semibold text-[#516931]">정비 세부내역</label>
              <textarea
                rows={2}
                placeholder="예: 엔진오일 세트 교환 및 와이퍼 등 소모품 교체 및 뒷문 리프트 윤활유 도포"
                value={description}
                onChange={e => setDescription(e.target.value)}
                className="w-full bg-[#f4f6f0] border border-[#d6dfce] rounded-xl p-2.5 focus:border-[#516931] text-[#1e2815] focus:outline-none resize-none"
              />
            </div>

            {/* Cost */}
            <div>
              <label className="block mb-1 font-semibold text-[#516931]">정비 청구 금액 (원)</label>
              <div className="relative flex items-center">
                <span className="absolute left-3.5 text-xs font-extrabold text-[#7b8f6c] select-none">₩</span>
                <input
                  type="number"
                  placeholder="예: 180000"
                  value={cost === 0 ? '' : cost}
                  onChange={e => setCost(parseInt(e.target.value) || 0)}
                  className="w-full bg-[#f4f6f0] border border-[#d6dfce] rounded-xl pl-8 pr-4 py-2.5 focus:border-[#516931] text-[#1e2815] focus:outline-none font-mono text-xs"
                />
              </div>
            </div>

            {/* Workshop Name */}
            <div>
              <label className="block mb-1 font-semibold text-[#516931]">정비 대리점 / 정비 공업사명</label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="예: 블루핸즈 대천점"
                  value={workshopName}
                  onChange={e => setWorkshopName(e.target.value)}
                  className="w-full bg-[#f4f6f0] border border-[#d6dfce] rounded-xl pl-9 pr-4 py-2.5 focus:border-[#516931] text-[#1e2815] focus:outline-none"
                />
                <MapPin className="absolute left-3 top-3 w-4.5 h-4.5 text-[#7b8f6c]" />
              </div>
            </div>

            <button
              disabled={isSubmitting}
              className="w-full bg-[#516931] hover:bg-[#435728] disabled:opacity-50 text-white font-bold p-3 rounded-xl mt-2 transition text-sm shadow-md cursor-pointer"
            >
              {isSubmitting ? '구글 스프레드시트에 기입 완료...' : '정비기록 저장 완료'}
            </button>
          </form>
        </div>
      ) : (
        /* Repair history list */
        <div className="flex flex-col gap-3">
          
          <div className="bg-white border border-[#d6dfce]/85 p-2.5 rounded-2xl flex items-center justify-between gap-2.5 shadow-sm">
            <span className="text-[10px] font-bold text-[#516931] uppercase">정비 지정 필터</span>
            <select
              value={filterVehicleId}
              onChange={e => setFilterVehicleId(e.target.value)}
              className="bg-[#f4f6f0] border border-[#d6dfce] rounded-xl px-3 py-1.5 focus:outline-none cursor-pointer text-[#1e2815] text-[10px]"
            >
              <option value="">차량 전체보기</option>
              {vehicles.map(v => (
                <option key={v.id} value={v.id}>{v.id}</option>
              ))}
            </select>
          </div>

          {filteredRepairs.length === 0 ? (
            <div className="bg-white border border-[#d6dfce]/80 p-8 rounded-3xl text-center text-[#7b8f6c]">
              저장된 차량 정비 이력이 존재하지 않습니다.
            </div>
          ) : (
            <div className="flex flex-col gap-3 max-h-[500px] overflow-y-auto pr-1">
              {[...filteredRepairs].reverse().map(rep => (
                <div 
                  key={rep.id} 
                  className="bg-white border border-[#d6dfce]/80 p-4 rounded-3xl flex flex-col gap-2.5 relative transition shadow-sm hover:border-[#516931]/40"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[9px] bg-[#516931]/10 border border-[#d6dfce] px-2 py-0.2 rounded-full text-[#516931] font-mono font-bold">
                        {rep.id}
                      </span>
                      <h4 className="text-xs font-bold text-[#11180c] mt-1">{rep.vehicleId}</h4>
                    </div>
                    {/* Date */}
                    <span className="text-[10px] font-mono text-[#7b8f6c] font-bold">
                      {formatKSTDate(rep.repairDate)}
                    </span>
                  </div>

                  {/* Body details */}
                  <div className="bg-[#f4f6f0] border border-[#d6dfce]/50 p-3 rounded-2xl flex flex-col gap-1 text-[11px] text-[#1e2815]">
                    <p className="flex items-start gap-1 font-semibold text-[#1e2815]">
                      <PenTool className="w-4 h-4 text-[#516931] shrink-0 mt-0.5" />
                      <span>{rep.description}</span>
                    </p>
                    
                    <div className="grid grid-cols-2 gap-2 border-t border-[#d6dfce]/50 mt-2.5 pt-2 text-[10px] text-[#7b8f6c]">
                      <div className="flex items-center gap-1 font-medium">
                        <MapPin className="w-3.5 h-3.5 shrink-0 text-[#7b8f6c]" />
                        <span className="truncate">{rep.workshopName}</span>
                      </div>
                      <div className="text-right font-semibold text-[#1e2815] font-mono">
                        {rep.mileage.toLocaleString()} km 점검
                      </div>
                    </div>
                  </div>

                  {/* Highlights and Cost banner */}
                  <div className="flex justify-between items-center text-[11px] border-t border-[#d6dfce]/40 pt-2 bg-white">
                    {rep.isOilChanged ? (
                      <span className="bg-emerald-50 text-emerald-850 font-bold px-2 py-0.5 rounded-lg border border-emerald-200 text-[9.5px] select-none flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" /> 엔진오일 교환 완료!
                      </span>
                    ) : (
                      <span className="text-[#7b8f6c] text-[9.5px]">오일 교환 미포함</span>
                    )}
                    <span className="font-mono text-amber-800 font-bold text-xs bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200">
                      {rep.cost.toLocaleString()} 원 결제
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

    </div>
  );
}
