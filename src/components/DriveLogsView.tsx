import React, { useState, useEffect } from 'react';
import { Vehicle, DriveLog, Reservation, RepairLog, uploadFileToDrive, resolveDriveImageUrl } from '../lib/googleSheets';
import { formatKSTDate, formatKSTDateTime, formatKSTTimeOnly } from '../lib/dateUtils';
import { 
  Gauge, Plus, Compass, CheckCircle2, 
  Search, Sparkles, Filter, Upload, Image as ImageIcon,
  Loader2, Camera, Calendar, Printer, X, Wrench
} from 'lucide-react';

interface DriveLogsViewProps {
  logs: DriveLog[];
  vehicles: Vehicle[];
  repairs: RepairLog[];
  reservations?: Reservation[];
  onUpdateReservationStatus?: (rowNum: number, status: '대기' | '승인' | '반려' | '완료') => Promise<void>;
  token: string | null;
  spreadsheetId: string | null;
  presetVehicleId: string;
  presetDriverName: string;
  onClearPresets: () => void;
  onAddDriveLog: (newLog: DriveLog, updatedMileage: number) => Promise<void>;
}

// Helper to get current HH:MM time
const getCurrentTimeHM = () => {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
};

export default function DriveLogsView({
  logs,
  vehicles,
  repairs = [],
  reservations = [],
  onUpdateReservationStatus,
  token,
  presetVehicleId,
  presetDriverName,
  onClearPresets,
  onAddDriveLog
}: DriveLogsViewProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [driverName, setDriverName] = useState('');
  const [driveDate, setDriveDate] = useState('2026-05-20');
  const [startTime, setStartTime] = useState(getCurrentTimeHM());
  const [endTime, setEndTime] = useState(getCurrentTimeHM());
  const [purpose, setPurpose] = useState('서비스지원');
  const [customPurpose, setCustomPurpose] = useState('');
  const [passengerCount, setPassengerCount] = useState(1);
  const [startMileage, setStartMileage] = useState(0);
  const [endMileage, setEndMileage] = useState(0);
  const [destination, setDestination] = useState('');
  const [notes, setNotes] = useState('');
  const [fuelCost, setFuelCost] = useState(0);
  const [tollCost, setTollCost] = useState(0);
  const [photoUrl, setPhotoUrl] = useState('');
  
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [logImageErrors, setLogImageErrors] = useState<Record<string, boolean>>({});

  const [selectedReservationId, setSelectedReservationId] = useState('');

  // Print modal state variables
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [printVehicleId, setPrintVehicleId] = useState('');
  const [printStartDate, setPrintStartDate] = useState(() => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}-01`;
  });
  const [printEndDate, setPrintEndDate] = useState(() => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });

  // Handle Loading of Reservation details and auto-fill relevant fields
  const handleLoadReservation = (resId: string) => {
    setSelectedReservationId(resId);
    if (!resId) return;

    const res = reservations.find(r => r.id === resId);
    if (res) {
      setSelectedVehicleId(res.vehicleId);
      setDriverName(res.driverName);
      
      // Parse startDate "YYYY-MM-DD HH:MM"
      if (res.startDate && res.startDate.includes(' ')) {
        const parts = res.startDate.split(' ');
        setDriveDate(parts[0] || '2026-05-20');
        setStartTime(parts[1] || '09:00');
      } else {
        setDriveDate(res.startDate || '2026-05-20');
        setStartTime('09:00');
      }

      // Parse endDate "YYYY-MM-DD HH:MM"
      if (res.endDate && res.endDate.includes(' ')) {
        const parts = res.endDate.split(' ');
        setEndTime(parts[1] || '18:00');
      } else {
        setEndTime('18:00');
      }

      // Purpose matching
      const trimPurpose = (res.purpose || '').trim();
      if (trimPurpose === '서비스지원' || trimPurpose === '행정업무') {
        setPurpose(trimPurpose);
        setCustomPurpose('');
      } else {
        setPurpose('기타');
        setCustomPurpose(trimPurpose);
      }

      // Passenger parsing (tries to find digits or defaults to 1)
      const passengersStr = res.passengers || '';
      const digitMatch = passengersStr.match(/\d+/);
      const parsedPassengers = digitMatch ? parseInt(digitMatch[0], 10) : 1;
      setPassengerCount(parsedPassengers);

      // Auto-populate destination
      if (res.destination) {
        setDestination(res.destination);
      }

      // Append passengers list to notes to preserve literal description
      if (passengersStr) {
        const prefix = `[배차예약 동승자: ${passengersStr}]`;
        setNotes(prev => {
          if (prev) {
            return prev.includes(prefix) ? prev : `${prev}\n${prefix}`;
          }
          return prefix;
        });
      }
    }
  };

  // OCR Receipt states
  const [isOcrLoading, setIsOcrLoading] = useState(false);
  const [ocrError, setOcrError] = useState('');
  const [ocrSuccessMsg, setOcrSuccessMsg] = useState('');

  const handleReceiptOcr = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsOcrLoading(true);
    setOcrError('');
    setOcrSuccessMsg('');

    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          const base64String = reader.result as string;
          const base64Data = base64String.split(',')[1];
          const mimeType = file.type;

          const res = await fetch('/api/ocr-receipt', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ base64Data, mimeType }),
          });

          if (!res.ok) {
            const errData = await res.json();
            throw new Error(errData.error || '영수증 정밀 OCR 추출에 실패했습니다.');
          }

          const data = await res.json();
          if (data && typeof data.amount === 'number' && data.amount > 0) {
            let typeLabel = '';
            if (data.type === 'toll') {
              setTollCost(data.amount);
              typeLabel = ' (고속도로 통행료)';
            } else {
              setFuelCost(data.amount);
              typeLabel = ' (주유 영수증)';
            }
            
            let successText = `금액 추출 성공: ${data.amount.toLocaleString()}원${typeLabel}`;
            if (data.merchantName) {
              successText += ` @ ${data.merchantName}`;
            }
            setOcrSuccessMsg(successText);

            let extraLabel = `[영수증 자동추출]`;
            if (data.merchantName) extraLabel += ` ${data.merchantName}`;
            extraLabel += typeLabel;
            
            if (extraLabel) {
              setNotes(prev => prev ? `${prev}\n${extraLabel}` : extraLabel);
            }
          } else {
            throw new Error('영수증 이미지에서 결제 승인 금액을 판독하지 못했습니다. 수동으로 입력해 주시기 바랍니다.');
          }
        } catch (err: any) {
          setOcrError(err.message || '인공지능 영수증 인식을 진행하지 못했습니다.');
        } finally {
          setIsOcrLoading(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      setOcrError('파일 데이터를 전송 규격으로 변환하는 데 실패했습니다.');
      setIsOcrLoading(false);
    }
  };

  // Filtering states
  const [filterVehicleId, setFilterVehicleId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Handle preset presets
  useEffect(() => {
    if (presetVehicleId) {
      setSelectedVehicleId(presetVehicleId);
      setIsRecording(true);

      // Try to find matching active approved reservation to auto-populate
      const matched = reservations.find(
        r => r.status === '승인' && 
        r.vehicleId === presetVehicleId && 
        (!presetDriverName || r.driverName.includes(presetDriverName) || presetDriverName.includes(r.driverName))
      );
      if (matched) {
        handleLoadReservation(matched.id);
      }
    }
    if (presetDriverName) {
      setDriverName(presetDriverName);
    }
  }, [presetVehicleId, presetDriverName, reservations]);

  // Handle automatic start-mileage look-ups
  useEffect(() => {
    if (selectedVehicleId) {
      const v = vehicles.find(item => item.id === selectedVehicleId);
      if (v) {
        setStartMileage(v.currentMileage);
        setEndMileage(v.currentMileage);
      }
    } else {
      setStartMileage(0);
      setEndMileage(0);
    }
  }, [selectedVehicleId, vehicles]);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !token) return;

    try {
      setIsUploadingPhoto(true);
      // Upload operational photo to Google Drive specific folder '1zs65gVNh2l8L3XJPwiI-YBSFWR39Xh_j'
      const url = await uploadFileToDrive(file, token, '1zs65gVNh2l8L3XJPwiI-YBSFWR39Xh_j');
      setPhotoUrl(url);
    } catch (err: any) {
      alert(err.message || '사진 업로드에 실패했습니다.');
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleLogSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVehicleId || !driverName.trim() || !driveDate || !destination.trim()) {
      setError('필수 입력 요소를 기입 완료해주십시오.');
      return;
    }

    if (endMileage < startMileage) {
      setError(`도착 누적거리는 현재 출발 누적거리(${startMileage.toLocaleString()} km) 이상이어야 작동합니다.`);
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const distance = endMileage - startMileage;
      const logId = `LOG-${Date.now().toString().slice(-6)}`;

      const resolvedPurpose = purpose === '기타' ? (customPurpose.trim() || '기타') : purpose;

      await onAddDriveLog({
        id: logId,
        vehicleId: selectedVehicleId,
        driverName,
        driveDate,
        startTime,
        endTime,
        purpose: resolvedPurpose,
        passengerCount,
        startMileage,
        endMileage,
        distance,
        destination,
        notes,
        fuelCost,
        tollCost,
        photoUrl,
        createdAt: new Date().toISOString().replace('T', ' ').slice(0, 19),
        rowNum: 0
      }, endMileage);

      // Successfully logged! Now update corresponding reservation to '완료' status
      if (selectedReservationId && onUpdateReservationStatus) {
        const matchingRes = reservations.find(r => r.id === selectedReservationId);
        if (matchingRes) {
          await onUpdateReservationStatus(matchingRes.rowNum, '완료');
        }
      }

      setIsRecording(false);
      setSelectedVehicleId('');
      setStartTime(getCurrentTimeHM());
      setEndTime(getCurrentTimeHM());
      setPurpose('서비스지원');
      setCustomPurpose('');
      setPassengerCount(1);
      setDestination('');
      setNotes('');
      setFuelCost(0);
      setTollCost(0);
      setPhotoUrl('');
      setSelectedReservationId('');
      onClearPresets();
    } catch (err: any) {
      setError(err.message || '일지 작성 기입에 실패했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter actual logs
  const filteredLogs = logs.filter(log => {
    const matchesVehicle = filterVehicleId ? log.vehicleId === filterVehicleId : true;
    const matchesSearch = searchQuery 
      ? log.driverName.includes(searchQuery) || log.destination.includes(searchQuery) || log.notes.includes(searchQuery)
      : true;
    return matchesVehicle && matchesSearch;
  });

  return (
    <div className="px-4 pt-4 flex flex-col gap-4 text-xs bg-[#f4f6f0]">
      
      {/* View Header */}
      <div className="flex items-center justify-between animate-fadeIn">
        <div>
          <h2 className="text-base font-extrabold text-[#192310]">운행 일지 데이터베이스 ({logs.length})</h2>
          <p className="text-[10px] text-[#7b8f6c] font-medium">차량별 운행거리 및 유류비 정산 로그를 기입합니다</p>
        </div>
        <div className="flex gap-2 shrink-0">
          {!isRecording && (
            <button
              type="button"
              onClick={() => {
                if (vehicles && vehicles.length > 0 && !printVehicleId) {
                  setPrintVehicleId(vehicles[0].id);
                }
                setIsPrintModalOpen(true);
              }}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-1.5 px-3 rounded-xl flex items-center gap-1 cursor-pointer transition shadow-sm text-[11px]"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>일지 출력</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setIsRecording(!isRecording);
              if (isRecording) onClearPresets();
            }}
            className="bg-[#516931] hover:bg-[#435728] text-white font-bold py-1.5 px-3 rounded-xl flex items-center gap-1 cursor-pointer transition shadow-sm text-[11px]"
          >
            {isRecording ? '목록 보기' : '일지 작성'}
          </button>
        </div>
      </div>

      {isRecording ? (
        /* Log Write Form */
        <div className="bg-white border border-[#d6dfce] p-4 rounded-3xl flex flex-col gap-3 shadow-md">
          <h3 className="text-sm font-bold text-[#516931]">새 운행기록 작성</h3>

          {error && <div className="p-3 rounded-xl bg-rose-50 text-rose-800 font-medium">{error}</div>}

          <form onSubmit={handleLogSubmit} className="flex flex-col gap-3 text-[#1e2815]">
            {/* 승인된 배차 예약 불러오기 (Load Approved Reservation) */}
            {reservations.filter(r => r.status === '승인').length > 0 && (
              <div className="bg-[#516931]/5 border border-[#516931]/15 p-3 rounded-2xl flex flex-col gap-1.5">
                <label className="text-[10px] text-[#516931] font-bold flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-[#516931]" />
                  <span>승인된 배차 예약 불러오기</span>
                  <span className="text-[9px] bg-[#516931]/10 px-1.5 py-0.2 rounded font-normal text-[#516931]/85">양식 자동입력</span>
                </label>
                <select
                  value={selectedReservationId}
                  onChange={e => handleLoadReservation(e.target.value)}
                  className="w-full bg-white border border-[#d6dfce] rounded-xl p-2 text-xs focus:border-[#516931] text-[#1e2815] focus:outline-none cursor-pointer"
                >
                  <option value="">배차 예약 불러오기 (선택 안함)</option>
                  {reservations
                    .filter(r => r.status === '승인')
                    .map(r => (
                      <option key={r.id} value={r.id}>
                        [{r.id}] {r.driverName} - {r.vehicleId} ({r.startDate.split(' ')[0]})
                      </option>
                    ))}
                </select>
                {selectedReservationId && (
                  <div className="text-[10px] text-[#516931] font-medium px-1 flex items-center justify-between">
                    <span>* 일지 등록 시 이 배차 예약의 상태가 자동으로 <strong>'완료'</strong> 처리됩니다.</span>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedReservationId('');
                      }}
                      className="text-[#991b1b] font-bold hover:underline"
                    >
                      불러오기 해제
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Vehicle selection */}
            <div>
              <label className="block mb-1 font-semibold text-[#516931]">선택 차량</label>
              <select
                value={selectedVehicleId}
                onChange={e => setSelectedVehicleId(e.target.value)}
                className="w-full bg-[#f4f6f0] border border-[#d6dfce] rounded-xl p-2.5 focus:border-[#516931] text-[#1e2815] focus:outline-none cursor-pointer"
              >
                <option value="">차량을 선택하십시오</option>
                {vehicles.map(v => (
                  <option key={v.id} value={v.id}>{v.id} - {v.model} - {v.institution || '본관'}</option>
                ))}
              </select>
            </div>

            {/* Driver Name */}
            <div>
              <label className="block mb-1 font-semibold text-[#516931]">운전자명</label>
              <input
                type="text"
                placeholder="예: 김길동 주임"
                value={driverName}
                onChange={e => setDriverName(e.target.value)}
                className="w-full bg-[#f4f6f0] border border-[#d6dfce] rounded-xl p-2.5 focus:border-[#516931] text-[#1e2815] focus:outline-none"
              />
            </div>

            {/* Date */}
            <div>
              <label className="block mb-1 font-semibold text-[#516931]">운행 일자</label>
              <input
                type="date"
                value={driveDate}
                onChange={e => setDriveDate(e.target.value)}
                className="w-full bg-[#f4f6f0] border border-[#d6dfce] rounded-xl p-2.5 focus:border-[#516931] text-[#1e2815] focus:outline-none"
              />
            </div>

            {/* Start and End Times */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block mb-1 font-semibold text-[#516931]">운행 시작시간</label>
                <input
                  type="time"
                  value={startTime}
                  onChange={e => setStartTime(e.target.value)}
                  className="w-full bg-[#f4f6f0] border border-[#d6dfce] rounded-xl p-2.5 focus:border-[#516931] text-[#1e2815] focus:outline-none text-xs font-mono"
                />
              </div>
              <div>
                <label className="block mb-1 font-semibold text-[#516931]">운행 종료시간</label>
                <input
                  type="time"
                  value={endTime}
                  onChange={e => setEndTime(e.target.value)}
                  className="w-full bg-[#f4f6f0] border border-[#d6dfce] rounded-xl p-2.5 focus:border-[#516931] text-[#1e2815] focus:outline-none text-xs font-mono"
                />
              </div>
            </div>

            {/* Start Mileage / End Mileage */}
            <div className="grid grid-cols-2 gap-2 bg-[#f4f6f0] p-3 rounded-2xl border border-[#d6dfce]">
              <div>
                <label className="block mb-0.5 text-[10px] text-[#7b8f6c] font-semibold">출발 누적거리 (자동조회)</label>
                <div className="font-mono text-base font-bold text-[#516931] px-1 pt-1">
                  {startMileage.toLocaleString()} km
                </div>
              </div>
              <div>
                <label className="block mb-1 text-[10px] text-[#7b8f6c] font-semibold">도착 누적거리 (입력)</label>
                <input
                  type="number"
                  value={endMileage === 0 ? '' : endMileage}
                  placeholder={`${startMileage} 이상`}
                  onChange={e => setEndMileage(parseInt(e.target.value) || 0)}
                  className="w-full bg-white border border-[#d6dfce] rounded-lg p-1.5 focus:border-[#516931] text-[#1e2815] focus:outline-none font-mono text-xs"
                />
              </div>
              {endMileage > startMileage && (
                <div className="col-span-2 text-[10px] text-[#516931] font-bold border-t border-[#d6dfce] pt-2 flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  <span>운행 거리: {(endMileage - startMileage).toLocaleString()} km 주행 계산</span>
                </div>
              )}
            </div>

            {/* Destination */}
            <div>
              <label className="block mb-1 font-semibold text-[#516931]">목적지 (경로)</label>
              <input
                type="text"
                placeholder="예: 복지관 → 보령시청 → 천안 순천향대병원 왕복"
                value={destination}
                onChange={e => setDestination(e.target.value)}
                className="w-full bg-[#f4f6f0] border border-[#d6dfce] rounded-xl p-2.5 focus:border-[#516931] text-[#1e2815] focus:outline-none"
              />
            </div>

            {/* Drive Purpose & Passengers Group */}
            <div className="grid grid-cols-2 gap-2 bg-[#f4f6f0] p-3 rounded-2xl border border-[#d6dfce]">
              {/* Drive Purpose Select & Input */}
              <div className="flex flex-col gap-1 col-span-1">
                <label className="text-[10px] text-[#7b8f6c] font-semibold">운행 목적</label>
                <select
                  value={purpose}
                  onChange={e => setPurpose(e.target.value)}
                  className="w-full bg-white border border-[#d6dfce] rounded-lg p-1.5 focus:border-[#516931] text-[#1e2815] focus:outline-none cursor-pointer text-xs"
                >
                  <option value="서비스지원">서비스지원</option>
                  <option value="행정업무">행정업무</option>
                  <option value="기타">기타 (직접입력)</option>
                </select>
                {purpose === '기타' && (
                  <input
                    type="text"
                    placeholder="운행 목적 직접 입력"
                    value={customPurpose}
                    onChange={e => setCustomPurpose(e.target.value)}
                    className="w-full mt-1.5 bg-white border border-[#d6dfce] rounded-lg p-1.5 focus:border-[#516931] text-[#1e2815] focus:outline-none text-[11px]"
                  />
                )}
              </div>

              {/* Passengers Count */}
              <div className="flex flex-col gap-1 col-span-1">
                <label className="text-[10px] text-[#7b8f6c] font-semibold">탑승 인원</label>
                <div className="relative flex items-center h-[34px]">
                  <input
                    type="number"
                    min="1"
                    placeholder="예: 3"
                    value={passengerCount}
                    onChange={e => setPassengerCount(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full bg-white border border-[#d6dfce] rounded-lg p-1.5 focus:border-[#516931] text-[#1e2815] focus:outline-none text-xs font-mono pr-8"
                  />
                  <span className="absolute right-3 text-xs text-[#7b8f6c] font-bold select-none">명</span>
                </div>
              </div>
            </div>

             {/* Fuel & Toll splits with AI OCR */}
            <div className="bg-[#f4f6f0] border border-[#d6dfce] p-3.5 rounded-2xl flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-[#516931] text-[11px] uppercase tracking-wider">지출 경비 정산 (원)</span>
                
                {/* AI OCR Scanner Button */}
                <label className="flex items-center gap-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-150 rounded-lg px-2.5 py-1 text-[10px] cursor-pointer transition select-none shadow-sm">
                  <Camera className="w-3.5 h-3.5 text-indigo-700" />
                  <span className="font-bold">AI 영수증 스캔 (OCR)</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleReceiptOcr}
                    className="hidden"
                    disabled={isOcrLoading}
                  />
                </label>
              </div>

              {/* OCR Feedback Alerts */}
              {isOcrLoading && (
                <div className="flex items-center gap-2 text-indigo-900 font-bold py-1.5 px-3 bg-indigo-50 rounded-xl border border-indigo-200 text-[10px] animate-pulse">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-700" />
                  <span>AI가 영수증 기재 금액을 정밀 판독하는 중...</span>
                </div>
              )}
              {ocrError && (
                <div className="text-rose-800 font-bold py-1.5 px-3 bg-rose-50 rounded-xl border border-rose-200 text-[10px]">
                  인식 실패: {ocrError}
                </div>
              )}
              {ocrSuccessMsg && (
                <div className="text-[#3c5123] font-bold py-1.5 px-3 bg-emerald-50 rounded-xl border border-emerald-200 text-[10px] flex items-center gap-1.5 animate-none">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#516931]" />
                  <span>{ocrSuccessMsg}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2 text-[#1e2815]">
                {/* Fuel Cost Input */}
                <div>
                  <label className="block mb-1 text-[10px] font-bold text-[#516931]">주유비 (원)</label>
                  <div className="relative flex items-center">
                    <span className="absolute left-3 text-[11.5px] font-extrabold text-[#7b8f6c] select-none">₩</span>
                    <input
                      type="number"
                      placeholder="예: 45000"
                      value={fuelCost === 0 ? '' : fuelCost}
                      onChange={e => setFuelCost(parseInt(e.target.value) || 0)}
                      className="w-full bg-white border border-[#d6dfce] rounded-xl pl-7 pr-2 py-2 text-[11px] focus:outline-none focus:border-[#516931] font-mono shadow-sm"
                    />
                  </div>
                </div>

                {/* Toll Fee Input */}
                <div>
                  <label className="block mb-1 text-[10px] font-bold text-[#516931]">도로 통행료 (원)</label>
                  <div className="relative flex items-center">
                    <span className="absolute left-3 text-[11.5px] font-extrabold text-[#7b8f6c] select-none">₩</span>
                    <input
                      type="number"
                      placeholder="예: 3200"
                      value={tollCost === 0 ? '' : tollCost}
                      onChange={e => setTollCost(parseInt(e.target.value) || 0)}
                      className="w-full bg-white border border-[#d6dfce] rounded-xl pl-7 pr-2 py-2 text-[11px] focus:outline-none focus:border-[#516931] font-mono shadow-sm"
                    />
                  </div>
                </div>
              </div>

              {(fuelCost > 0 || tollCost > 0) && (
                <div className="bg-emerald-50/75 border border-[#d6dfce] text-[10.5px] text-[#516931] font-extrabold p-2 px-2.5 rounded-xl flex justify-between items-center mt-1 shadow-sm">
                  <span>총 경비 합계</span>
                  <span className="font-mono text-xs text-[#435728]">₩ {(fuelCost + tollCost).toLocaleString()} 원</span>
                </div>
              )}
            </div>

            {/* Notes */}
            <div>
              <label className="block mb-1 font-semibold text-[#516931]">기타 특이사항 (차량 이상유무 등)</label>
              <textarea
                rows={2}
                placeholder="예: 정비 정상, 주유 완료, 앞유리 미세 세차 필요"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                className="w-full bg-[#f4f6f0] border border-[#d6dfce] rounded-xl p-2.5 focus:border-[#516931] text-[#1e2815] focus:outline-none resize-none"
              />
            </div>

            {/* Operations photo upload */}
            <div>
              <span className="block mb-1.5 font-semibold text-[#516931]">운행 사진 촬영 및 등록</span>
              <div className="flex items-center gap-3">
                <label className="flex-1 bg-[#f4f6f0] border border-[#d6dfce] border-dashed hover:border-[#516931]/60 transition p-4 rounded-xl flex flex-col items-center justify-center gap-1 cursor-pointer">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    className="hidden"
                  />
                  {photoUrl ? (
                    <span className="text-[10px] text-[#516931] font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4" /> 등록 완료!
                    </span>
                  ) : isUploadingPhoto ? (
                    <span className="text-[10px] text-[#7b8f6c] animate-pulse">구글 드라이브 업로드 중...</span>
                  ) : (
                    <>
                      <Upload className="w-5 h-5 text-[#7b8f6c]/60 mb-0.5" />
                      <span className="text-[10px] text-[#7b8f6c] font-medium">사진 촬영 또는 첨부</span>
                    </>
                  )}
                </label>
                {photoUrl && (
                  <div className="w-16 h-16 rounded-xl overflow-hidden border border-[#d6dfce] bg-[#f4f6f0]">
                    <img src={resolveDriveImageUrl(photoUrl)} className="w-full h-full object-cover" alt="Preview" />
                  </div>
                )}
              </div>
            </div>

            <button
              disabled={isSubmitting || isUploadingPhoto}
              className="w-full bg-[#516931] hover:bg-[#435728] disabled:opacity-50 text-white font-bold p-3 rounded-xl mt-2 transition text-sm shadow-md cursor-pointer"
            >
              {isSubmitting ? '구글 시트 저장 및 차량 누적거리 동기화중...' : '작성 완료'}
            </button>
          </form>
        </div>
      ) : (
        /* Logs listings with Filters */
        <div className="flex flex-col gap-3">
          
          {/* Quick Filters */}
          <div className="bg-white border border-[#d6dfce]/85 p-3 rounded-2xl flex flex-col gap-2.5 shadow-sm">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-[#516931] uppercase tracking-wider">운행일지 조건 검색</span>
            </div>
            
            <div className="grid grid-cols-2 gap-2">
              <select
                value={filterVehicleId}
                onChange={e => setFilterVehicleId(e.target.value)}
                className="bg-[#f4f6f0] border border-[#d6dfce] rounded-xl p-1.5 text-[10px] text-[#1e2815] focus:outline-none cursor-pointer"
              >
                <option value="">차량 전체</option>
                {vehicles.map(v => (
                  <option key={v.id} value={v.id}>{v.id}</option>
                ))}
              </select>

              <div className="relative">
                <input
                  type="text"
                  placeholder="운전자/경로 검색"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full bg-[#f4f6f0] border border-[#d6dfce] rounded-xl p-1.5 pl-7 text-[10px] text-[#1e2815] focus:outline-none"
                />
                <Search className="absolute left-2.5 top-2.5 w-3 h-3 text-[#7b8f6c]" />
              </div>
            </div>
          </div>

          {/* List display */}
          {filteredLogs.length === 0 ? (
            <div className="bg-white border border-[#d6dfce]/80 p-8 rounded-3xl text-center text-[#7b8f6c]">
              일치하는 운행일지가 존재하지 않습니다.
            </div>
          ) : (
            <div className="flex flex-col gap-3 max-h-[460px] overflow-y-auto pr-1">
              {[...filteredLogs].reverse().map(log => (
                <div 
                  key={log.id} 
                  className="bg-white border border-[#d6dfce]/80 p-4 rounded-3xl flex flex-col gap-2.5 relative transition shadow-sm hover:border-[#516931]/40"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[9px] bg-[#516931]/10 border border-[#d6dfce] px-2 py-0.2 rounded-full text-[#516931] font-mono font-bold">
                        {log.id}
                      </span>
                      <h4 className="text-xs font-bold text-[#11180c] mt-1">{log.vehicleId}</h4>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] font-mono text-[#7b8f6c] font-bold block">
                        {formatKSTDate(log.driveDate)}
                      </span>
                      {log.startTime && log.endTime && (
                        <span className="text-[9px] text-[#516931] font-bold block mt-1 bg-[#516931]/5 px-2 py-0.5 rounded-lg border border-[#516931]/10">
                          ⏱ {formatKSTTimeOnly(log.startTime)} ~ {formatKSTTimeOnly(log.endTime)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Operational indicators structure */}
                  <div className="grid grid-cols-3 gap-2 bg-[#f4f6f0] border border-[#d6dfce]/60 p-2.5 rounded-2xl text-[10pt] font-semibold text-[#1e2815]">
                    <div>
                      <span className="text-[9px] text-[#7b8f6c] block mb-0.5">운전원</span>
                      <span className="text-[#1e2815] font-bold">{log.driverName}</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-[#7b8f6c] block mb-0.5">운행주행</span>
                      <span className="text-indigo-800 font-bold">+{log.distance.toLocaleString()} km</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-[#7b8f6c] block mb-0.5">총 누적</span>
                      <span className="font-mono text-[#516931] font-bold">{log.endMileage.toLocaleString()} km</span>
                    </div>
                  </div>

                  {/* Purpose & Passengers badges */}
                  {(log.purpose || (log.passengerCount !== undefined && log.passengerCount > 0)) && (
                    <div className="flex flex-wrap items-center gap-1.5 border-t border-b border-[#d6dfce]/30 py-1.5 px-0.5 text-[10px]">
                      {log.purpose && (
                        <div className="flex items-center gap-1 bg-[#516931]/5 border border-[#516931]/20 px-2 py-0.5 rounded-lg text-[#3c5123] font-bold">
                          <span className="text-[9px] text-[#7b8f6c] font-normal mr-0.5">목적:</span>
                          {log.purpose}
                        </div>
                      )}
                      {log.passengerCount !== undefined && log.passengerCount > 0 && (
                        <div className="flex items-center gap-1 bg-sky-50 border border-sky-100 px-2 py-0.5 rounded-lg text-sky-800 font-bold">
                          <span className="text-[9px] text-sky-600 font-normal mr-0.5">탑승:</span>
                          {log.passengerCount}명
                        </div>
                      )}
                    </div>
                  )}

                  {/* Destination / Remarks */}
                  <div className="flex flex-col gap-1 text-[11px] text-[#1e2815]">
                    <p className="flex items-start gap-1 font-medium">
                      <Compass className="w-3.5 h-3.5 text-[#516931] shrink-0 mt-0.5" />
                      <span>{log.destination}</span>
                    </p>
                    {log.notes && (
                      <p className="text-[#7b8f6c] italic text-[10px] border-t border-[#d6dfce]/50 mt-1 pt-1.5 pl-1 shrink-0 bg-[#f4f6f0] p-2 rounded-lg">
                        비고: {log.notes}
                      </p>
                    )}
                    {(log.fuelCost > 0 || (log.tollCost !== undefined && log.tollCost > 0)) && (
                      <div className="text-[10px] font-sans text-amber-900 mt-1.5 flex flex-col gap-1.5 bg-amber-50/60 p-2.5 rounded-xl border border-amber-200">
                        <div className="flex items-center gap-1 text-[10.5px] font-extrabold text-amber-950 pb-1 border-b border-amber-200/50">
                          <span className="text-xs font-bold font-sans">₩</span>
                          <span>지출 정산 내역 (원)</span>
                        </div>
                        <div className="flex flex-col gap-1">
                          {log.fuelCost > 0 && (
                            <div className="flex justify-between items-center font-medium">
                              <span className="text-amber-800">● 주유비</span>
                              <span className="font-mono font-bold text-amber-950">₩ {log.fuelCost.toLocaleString()} 원</span>
                            </div>
                          )}
                          {log.tollCost !== undefined && log.tollCost > 0 && (
                            <div className="flex justify-between items-center font-medium">
                              <span className="text-amber-800">● 도로 통행료</span>
                              <span className="font-mono font-bold text-amber-950">₩ {log.tollCost.toLocaleString()} 원</span>
                            </div>
                          )}
                          <div className="flex justify-between items-center border-t border-amber-200/50 pt-1 mt-0.5 font-bold text-amber-950">
                            <span>경비 총액</span>
                            <span className="font-mono text-[11px] text-[#516931]">₩ {(log.fuelCost + (log.tollCost || 0)).toLocaleString()} 원</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Timestamp */}
                  <div className="text-[9px] font-mono text-[#7b8f6c] text-right mt-1.5">
                    기록일시: {formatKSTDateTime(log.createdAt)}
                  </div>

                  {/* Photo attachments */}
                  {log.photoUrl && (
                    <div className="relative w-full h-36 rounded-2xl overflow-hidden border border-[#d6dfce]/85 bg-[#f4f6f0] mt-2 select-none shadow-sm flex items-center justify-center">
                      {logImageErrors[log.id] ? (
                        <div className="flex flex-col items-center justify-center text-rose-800 bg-rose-50/70 w-full h-full p-2 text-center gap-0.5 select-none">
                          <X className="w-4 h-4 text-rose-500" />
                          <span className="text-[9.5px] font-black leading-tight">사진 로딩 불가 ⚠️</span>
                          <span className="text-[8px] font-bold text-rose-600/95 leading-normal">
                            드라이브 공유 권한을 <br/>
                            "링크가 있는 모든 사용자"로 변경 후 새로고침 해주세요.
                          </span>
                        </div>
                      ) : (
                        <img 
                          src={resolveDriveImageUrl(log.photoUrl)} 
                          alt="운행사진" 
                          className="w-full h-full object-cover" 
                          onError={(e) => {
                            const target = e.currentTarget;
                            if (target.src.includes('thumbnail')) {
                              const dMatch = log.photoUrl.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
                              const idMatch = log.photoUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/);
                              const fileId = (dMatch && dMatch[1]) || (idMatch && idMatch[1]);
                              if (fileId) {
                                target.src = `https://docs.google.com/uc?export=view&id=${fileId}`;
                                return;
                              }
                            }
                            if (target.src.includes('docs.google.com')) {
                              const dMatch = log.photoUrl.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
                              const idMatch = log.photoUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/);
                              const fileId = (dMatch && dMatch[1]) || (idMatch && idMatch[1]);
                              if (fileId) {
                                target.src = `https://lh3.googleusercontent.com/d/${fileId}`;
                                return;
                              }
                            }
                            setLogImageErrors(prev => ({ ...prev, [log.id]: true }));
                          }}
                        />
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Print Report Modal Overlay */}
      {isPrintModalOpen && (() => {
        // Evaluate printable records inside the IIFE or scope
        const printableLogs = logs.filter(log => {
          const matchesVehicle = printVehicleId 
            ? log.vehicleId.includes(printVehicleId) || printVehicleId.includes(log.vehicleId)
            : true;
          const matchesStart = printStartDate ? log.driveDate >= printStartDate : true;
          const matchesEnd = printEndDate ? log.driveDate <= printEndDate : true;
          return matchesVehicle && matchesStart && matchesEnd;
        });

        const printableRepairs = repairs.filter(rep => {
          const matchesVehicle = printVehicleId 
            ? rep.vehicleId.includes(printVehicleId) || printVehicleId.includes(rep.vehicleId)
            : true;
          const matchesStart = printStartDate ? rep.repairDate >= printStartDate : true;
          const matchesEnd = printEndDate ? rep.repairDate <= printEndDate : true;
          return matchesVehicle && matchesStart && matchesEnd;
        });

        const selectedVehicleModel = printVehicleId 
          ? vehicles.find(v => v.id === printVehicleId)?.model || ''
          : '';

        const totalLogFuel = printableLogs.reduce((sum, log) => sum + log.fuelCost, 0);
        const totalLogToll = printableLogs.reduce((sum, log) => sum + (log.tollCost || 0), 0);
        const totalRepairCost = printableRepairs.reduce((sum, r) => sum + r.cost, 0);

        return (
          <div id="print-modal-overlay" className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 overflow-y-auto p-4 flex flex-col items-center justify-start">
            {/* Modal Card */}
            <div className="bg-white rounded-3xl w-full max-w-4xl shadow-2xl flex flex-col h-auto max-h-[90vh] overflow-hidden my-4 border border-[#d6dfce] animate-fadeIn">
              
              {/* Modal Header */}
              <div className="bg-[#516931] text-white p-4 flex items-center justify-between shrink-0 no-print">
                <div className="flex items-center gap-2">
                  <Printer className="w-5 h-5 text-emerald-350" />
                  <div>
                    <h3 className="text-sm font-bold text-white">차량별 통합 운행·정비 대장 일지 출력</h3>
                    <p className="text-[10px] text-[#f4f6f0]/80">담당, 국장, 원장 3단 결재란이 포함된 공식 행정 보고 양식입니다</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsPrintModalOpen(false)}
                  className="bg-white/10 hover:bg-white/20 text-white rounded-full p-1.5 transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Modal Filter Settings */}
              <div className="p-4 bg-[#f4f6f0] border-b border-[#d6dfce]/85 grid grid-cols-1 sm:grid-cols-3 gap-3 shrink-0 text-xs no-print">
                {/* Select Vehicle */}
                <div className="flex flex-col gap-1">
                  <label className="font-bold text-[#516931] text-[10.5px]">대상 차량 필터</label>
                  <select
                    value={printVehicleId}
                    onChange={e => setPrintVehicleId(e.target.value)}
                    className="bg-white border border-[#d6dfce] rounded-xl p-2.5 focus:border-[#516931] text-[#1e2815] focus:outline-none text-[11px] cursor-pointer"
                  >
                    <option value="">[전체 운행 차량 출력]</option>
                    {vehicles.map(v => (
                      <option key={v.id} value={v.id}>{v.id} ({v.model})</option>
                    ))}
                  </select>
                </div>

                {/* Start Date */}
                <div className="flex flex-col gap-1">
                  <label className="font-bold text-[#516931] text-[10.5px]">시작 연월일</label>
                  <input
                    type="date"
                    value={printStartDate}
                    onChange={e => setPrintStartDate(e.target.value)}
                    className="bg-white border border-[#d6dfce] rounded-xl p-2.5 focus:border-[#516931] text-[#1e2815] focus:outline-none text-[11px]"
                  />
                </div>

                {/* End Date */}
                <div className="flex flex-col gap-1">
                  <label className="font-bold text-[#516931] text-[10.5px]">종료 연월일</label>
                  <input
                    type="date"
                    value={printEndDate}
                    onChange={e => setPrintEndDate(e.target.value)}
                    className="bg-white border border-[#d6dfce] rounded-xl p-2.5 focus:border-[#516931] text-[#1e2815] focus:outline-none text-[11px]"
                  />
                </div>
              </div>

              {/* Modal Body: Report Preview Sheet */}
              <div className="flex-1 overflow-y-auto p-6 bg-zinc-100 flex justify-center scrollbar-thin print-body-wrapper">
                <div 
                  id="printable-report-container" 
                  className="bg-white border border-gray-300 shadow-lg p-10 w-full max-w-[210mm] min-h-[297mm] text-zinc-900 flex flex-col font-sans relative text-xs"
                >
                  
                  {/* Dynamic Print CSS override */}
                  <style>{`
                    @media print {
                      @page {
                        size: A4 portrait;
                        margin: 0;
                      }
                      /* Complete Hide of everything else */
                      body * {
                        visibility: hidden !important;
                        background-color: transparent !important;
                      }
                      /* Keep print modal elements and printable-report-container visible */
                      #root,
                      #print-modal-overlay,
                      #print-modal-overlay > div,
                      .print-body-wrapper,
                      #printable-report-container, 
                      #printable-report-container * {
                        visibility: visible !important;
                      }
                      
                      /* Reset fixed modal overlay to standard block during print */
                      #print-modal-overlay {
                        position: absolute !important;
                        left: 0 !important;
                        top: 0 !important;
                        width: 100% !important;
                        height: auto !important;
                        background: transparent !important;
                        backdrop-filter: none !important;
                        padding: 0 !important;
                        margin: 0 !important;
                        overflow: visible !important;
                        display: block !important;
                      }

                      /* Reset modal container card */
                      #print-modal-overlay > div {
                        position: absolute !important;
                        left: 0 !important;
                        top: 0 !important;
                        width: 100% !important;
                        height: auto !important;
                        background: transparent !important;
                        border: none !important;
                        box-shadow: none !important;
                        padding: 0 !important;
                        margin: 0 !important;
                        overflow: visible !important;
                        display: block !important;
                      }

                      /* Reset modal layout wrapper */
                      .print-body-wrapper {
                        position: absolute !important;
                        left: 0 !important;
                        top: 0 !important;
                        width: 100% !important;
                        background: transparent !important;
                        padding: 0 !important;
                        margin: 0 !important;
                        overflow: visible !important;
                        display: block !important;
                      }

                      /* Format report sheet container */
                      #printable-report-container {
                        position: absolute !important;
                        left: 0 !important;
                        top: 0 !important;
                        width: 210mm !important;
                        min-height: 297mm !important;
                        height: auto !important;
                        display: block !important;
                        background: white !important;
                        color: black !important;
                        padding: 15mm !important;
                        margin: 0 !important;
                        border: none !important;
                        box-shadow: none !important;
                        box-sizing: border-box !important;
                      }
                      .no-print {
                        display: none !important;
                        visibility: hidden !important;
                      }
                    }
                  `}</style>

                  {/* Print Document Header Layout */}
                  <div className="flex justify-between items-start mb-6">
                    <div className="flex flex-col">
                      <h1 className="text-lg font-black tracking-widest text-zinc-900 border-b-2 border-zinc-950 pb-1.5 inline-block">
                        차량별 운행일지 및 정비 대장
                      </h1>
                      <div className="text-[10px] text-zinc-600 mt-2.5 space-y-0.5 font-medium">
                        <div>출력 구분 : <strong className="text-zinc-900">{printVehicleId ? `${printVehicleId} [${selectedVehicleModel}]` : '센터 등록 차량 전체'}</strong></div>
                        <div>조회 기간 : <strong className="text-zinc-900">{formatKSTDate(printStartDate)} ~ {formatKSTDate(printEndDate)}</strong></div>
                      </div>
                    </div>

                    {/* Korean Standard Approval Box (결재라인) */}
                    <table className="border-collapse border border-zinc-950 w-52 text-center text-[10px] shrink-0 font-medium">
                      <tbody>
                        <tr>
                          <td rowSpan={2} className="border border-zinc-950 bg-zinc-50 font-bold w-9 text-center py-4 text-[9px] leading-tight">
                            결<br/>재
                          </td>
                          <td className="border border-zinc-950 bg-zinc-50 font-bold py-1 w-14">담 당</td>
                          <td className="border border-zinc-950 bg-zinc-50 font-bold py-1 w-14">국 장</td>
                          <td className="border border-zinc-950 bg-zinc-50 font-bold py-1 w-14">원 장</td>
                        </tr>
                        <tr className="h-12">
                          <td className="border border-zinc-950 relative">
                            <span className="absolute inset-0 flex items-center justify-center text-[8px] text-zinc-300 select-none">(인)</span>
                          </td>
                          <td className="border border-zinc-950 relative">
                            <span className="absolute inset-0 flex items-center justify-center text-[8px] text-zinc-300 select-none">(인)</span>
                          </td>
                          <td className="border border-zinc-950 relative">
                            <span className="absolute inset-0 flex items-center justify-center text-[8px] text-zinc-300 select-none">(인)</span>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Statistics Summary Overview Panel */}
                  <div className="border border-zinc-950 bg-zinc-50 p-3 rounded-sm mb-6 grid grid-cols-4 gap-2 text-center text-[10px] leading-tight font-medium text-zinc-800">
                    <div className="border-r border-zinc-200">
                      <span className="text-zinc-500 block text-[9px] mb-1">총 운행건수</span>
                      <strong className="text-zinc-900 font-bold text-xs">{printableLogs.length}건</strong>
                    </div>
                    <div className="border-r border-zinc-200">
                      <span className="text-zinc-500 block text-[9px] mb-1">총 운행거리</span>
                      <strong className="text-zinc-900 font-bold text-xs font-mono">
                        {printableLogs.reduce((sum, log) => sum + log.distance, 0).toLocaleString()} km
                      </strong>
                    </div>
                    <div className="border-r border-zinc-200">
                      <span className="text-zinc-500 block text-[9px] mb-1">소요 유대/통행경비</span>
                      <strong className="text-emerald-800 font-bold text-xs font-mono">
                        {(totalLogFuel + totalLogToll).toLocaleString()}원
                      </strong>
                    </div>
                    <div>
                      <span className="text-zinc-500 block text-[9px] mb-1">차량 정비 지출액</span>
                      <strong className="text-indigo-800 font-bold text-xs font-mono">
                        {totalRepairCost.toLocaleString()}원
                      </strong>
                    </div>
                  </div>

                  {/* Operational Section 1: Driving Logs */}
                  <div className="mb-6 flex-1">
                    <h2 className="text-[11px] font-bold text-zinc-900 border-l-[3px] border-zinc-950 pl-2 mb-2 flex items-center gap-1.5 font-bold">
                      <span>1. 기간내 운행 일지 상세 내역 대장 ({printableLogs.length}건)</span>
                    </h2>
                    
                    {printableLogs.length === 0 ? (
                      <div className="text-[10px] text-zinc-400 py-6 border border-dashed border-zinc-300 text-center rounded-sm text-center">
                        해당 조건 및 기간에 기입된 실운행 통계가 전무합니다.
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse border border-zinc-950 text-center text-[9px] font-normal leading-normal select-none">
                          <thead>
                            <tr className="bg-zinc-100 font-bold text-zinc-950">
                              <th className="border border-zinc-950 p-1 w-6">No.</th>
                              <th className="border border-zinc-950 p-1 w-14">운행일자</th>
                              <th className="border border-zinc-950 p-1 w-14">차량번호</th>
                              <th className="border border-zinc-950 p-1 w-12">운전원</th>
                              <th className="border border-zinc-950 p-1">주요 목적지 및 운행 경로</th>
                              <th className="border border-zinc-950 p-1 w-16">운행목적(동승)</th>
                              <th className="border border-zinc-950 p-1 font-mono w-14">시출발km</th>
                              <th className="border border-zinc-950 p-1 font-mono w-14">종도착km</th>
                              <th className="border border-zinc-950 p-1 font-mono w-12">주행km</th>
                              <th className="border border-zinc-950 p-1 font-mono w-18">경비지출</th>
                            </tr>
                          </thead>
                          <tbody>
                            {printableLogs.map((log, index) => {
                              const costSum = log.fuelCost + (log.tollCost || 0);
                              return (
                                <tr key={log.id} className="hover:bg-zinc-50/50">
                                  <td className="border border-zinc-950 p-1 text-[8px] font-mono">{index + 1}</td>
                                  <td className="border border-zinc-950 p-1 text-[8.5px] font-mono leading-tight">
                                    {formatKSTDate(log.driveDate)}<br/>
                                    <span className="text-zinc-500 text-[8px]">{formatKSTTimeOnly(log.startTime) || '00:00'}~{formatKSTTimeOnly(log.endTime) || '00:00'}</span>
                                  </td>
                                  <td className="border border-zinc-950 p-1 text-[8.5px] font-bold leading-tight">
                                    {log.vehicleId}
                                  </td>
                                  <td className="border border-zinc-950 p-1 font-medium">{log.driverName.split(' ')[0]}</td>
                                  <td className="border border-[#000000] p-1 text-left px-2 max-w-[140px] truncate" title={log.destination}>
                                    {log.destination}
                                  </td>
                                  <td className="border border-[#000000] p-1 text-left px-1.5 leading-tight text-[8px]">
                                    {log.purpose} ({log.passengerCount || 1}명)
                                  </td>
                                  <td className="border border-[#000000] p-1 font-mono text-right pr-1">{log.startMileage.toLocaleString()}</td>
                                  <td className="border border-[#000000] p-1 font-mono text-right pr-1">{log.endMileage.toLocaleString()}</td>
                                  <td className="border border-[#000000] p-1 font-mono text-right pr-1 font-bold text-zinc-900">+{log.distance.toLocaleString()}</td>
                                  <td className="border border-[#000000] p-1 font-mono text-right pr-1">
                                    {costSum > 0 ? (
                                      <span className="font-semibold text-zinc-900">{costSum.toLocaleString()}</span>
                                    ) : (
                                      <span className="text-zinc-400 font-normal">-</span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                            <tr className="bg-zinc-100 font-bold text-zinc-950 text-right pr-2">
                              <td colSpan={4} className="border border-zinc-950 p-1.5 text-center">원 통합 운행 주행 지산계</td>
                              <td colSpan={4} className="border border-zinc-950 p-1.5 text-left pl-3 text-zinc-900">
                                누적 총주행계 : <span className="font-mono">{printableLogs.reduce((sum, log) => sum + log.distance, 0).toLocaleString()} km</span>
                              </td>
                              <td colSpan={2} className="border border-zinc-950 p-1.5 text-right font-bold pr-1 text-emerald-900 font-mono">
                                ₩ {(totalLogFuel + totalLogToll).toLocaleString()} 원
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* Operational Section 2: Repairs */}
                  <div className="mb-6 shrink-0 pt-2">
                    <h2 className="text-[11px] font-bold text-zinc-900 border-l-[3px] border-zinc-950 pl-2 mb-2 flex items-center gap-1.5 font-bold">
                      <span>2. 지정 차량 정비, 고정 소모품 및 정기 수리 상세 점검부 ({printableRepairs.length}건)</span>
                    </h2>

                    {printableRepairs.length === 0 ? (
                      <div className="text-[10px] text-zinc-400 py-6 border border-dashed border-zinc-300 text-center rounded-sm text-center">
                        해당 기간 정비기록 및 기입된 지정 차량 실내역 점검사항이 전무합니다.
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse border border-zinc-950 text-center text-[9px] font-normal leading-normal select-none">
                          <thead>
                            <tr className="bg-zinc-100 font-bold text-zinc-950">
                              <th className="border border-zinc-950 p-1 w-6">No.</th>
                              <th className="border border-zinc-950 p-1 w-16">정비일자</th>
                              <th className="border border-zinc-950 p-1 w-14">차량번호</th>
                              <th className="border border-zinc-950 p-1">정비 및 소모품 수리 정밀 점검 보고 사항</th>
                              <th className="border border-zinc-950 p-1 font-mono w-14">정비시 누적</th>
                              <th className="border border-zinc-950 p-1 w-12">엔진오일</th>
                              <th className="border border-zinc-950 p-1 w-20">정비 정비센터</th>
                              <th className="border border-zinc-950 p-1 font-mono w-18">점검정비비용</th>
                            </tr>
                          </thead>
                          <tbody>
                            {printableRepairs.map((rep, index) => (
                              <tr key={rep.id} className="hover:bg-zinc-50/50">
                                <td className="border border-zinc-950 p-1 text-[8px] font-mono">{index + 1}</td>
                                <td className="border border-zinc-950 p-1 text-[8.5px] font-mono leading-none">
                                  {formatKSTDate(rep.repairDate)}
                                </td>
                                <td className="border border-zinc-950 p-1 text-[8.5px] font-bold leading-tight">
                                  {rep.vehicleId}
                                </td>
                                <td className="border border-[#000000] p-1 text-left px-2 max-w-[160px] truncate" title={rep.description}>
                                  {rep.description}
                                </td>
                                <td className="border border-[#000000] p-1 font-mono text-right pr-1.5">{rep.mileage.toLocaleString()} km</td>
                                <td className="border border-[#000000] p-1">
                                  {rep.isOilChanged ? (
                                    <span className="text-emerald-700 font-bold bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 text-[8px] rounded-xs select-none">교체실시</span>
                                  ) : (
                                    <span className="text-zinc-400 font-normal">-</span>
                                  )}
                                </td>
                                <td className="border border-[#000000] p-1 text-left px-1.5 truncate">{rep.workshopName || '-'}</td>
                                <td className="border border-[#000000] p-1 font-mono text-right pr-1 font-bold text-zinc-900">₩ {rep.cost.toLocaleString()}</td>
                              </tr>
                            ))}
                            <tr className="bg-zinc-100 font-bold text-zinc-950 text-right pr-2">
                              <td colSpan={3} className="border border-zinc-950 p-1.5 text-center">정비 점검 통합 소요합</td>
                              <td colSpan={4} className="border border-zinc-950 p-1.5 text-left pl-3 text-zinc-900">
                                오일 정기 교체합계 : <span className="font-mono text-emerald-800">{printableRepairs.filter(r => r.isOilChanged).length}회 실시</span>
                              </td>
                              <td className="border border-zinc-950 p-1.5 text-right font-extrabold pr-1 text-indigo-900 font-mono">
                                ₩ {totalRepairCost.toLocaleString()} 원
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* Centered official organization title area */}
                  <div className="mt-auto pt-10 text-center flex flex-col items-center">
                    <strong className="text-zinc-900 font-extrabold tracking-widest text-[12px]">정심작업장</strong>
                  </div>

                </div>
              </div>

              {/* Modal Footer Actions */}
              <div className="p-4 bg-zinc-50 border-t border-[#d6dfce]/85 flex items-center justify-end gap-2.5 shrink-0 no-print">
                <button
                  type="button"
                  onClick={() => setIsPrintModalOpen(false)}
                  className="bg-white hover:bg-zinc-100 text-zinc-700 border border-zinc-400 font-bold py-2 px-4 rounded-xl cursor-pointer transition text-xs whitespace-nowrap shadow-sm"
                >
                  취소 및 닫기
                </button>
                <button
                  type="button"
                  onClick={() => {
                    window.print();
                  }}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold py-2 px-5 rounded-xl flex items-center gap-1.5 cursor-pointer shadow-md transition text-xs select-none"
                >
                  <Printer className="w-4 h-4" />
                  <span>인쇄하기 / PDF 저장</span>
                </button>
              </div>

            </div>
          </div>
        );
      })()}

    </div>
  );
}
