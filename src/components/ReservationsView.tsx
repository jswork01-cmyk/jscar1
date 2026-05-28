import React, { useState } from 'react';
import { Vehicle, Reservation } from '../lib/googleSheets';
import { formatKSTDateTime } from '../lib/dateUtils';
import { 
  Calendar, Clock, User, MessageCircle, Users, Check, X, 
  FileText, MapPin
} from 'lucide-react';

interface ReservationsViewProps {
  reservations: Reservation[];
  vehicles: Vehicle[];
  token: string | null;
  spreadsheetId: string | null;
  userRole: 'driver' | 'admin';
  driverEmail: string;
  onAddReservation: (newRes: Reservation) => Promise<void>;
  onUpdateReservationStatus: (rowNum: number, status: '대기' | '승인' | '반려' | '완료') => Promise<void>;
  onNavigateToLogsWithPreset: (vehicleId: string, driverName: string) => void;
}

export default function ReservationsView({
  reservations,
  vehicles,
  userRole,
  driverEmail,
  onAddReservation,
  onUpdateReservationStatus,
  onNavigateToLogsWithPreset,
}: ReservationsViewProps) {
  const [isBooking, setIsBooking] = useState(false);
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [driverName, setDriverName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endDate, setEndDate] = useState('');
  const [endTime, setEndTime] = useState('18:00');
  const [purpose, setPurpose] = useState('');
  const [destination, setDestination] = useState('');
  const [passengers, setPassengers] = useState('');
  
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Submit handler
  const handleReserve = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVehicleId || !driverName.trim() || !startDate || !endDate || !purpose.trim() || !destination.trim()) {
      setError('모든 필수 입력칸을 기입해 주십시오.');
      return;
    }

    setIsSubmitting(true);
    setError('');

    const parseDateTime = (str: string) => {
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

    try {
      const startDateTime = `${startDate} ${startTime}`;
      const endDateTime = `${endDate} ${endTime}`;
      
      const candidateStart = parseDateTime(startDateTime);
      const candidateEnd = parseDateTime(endDateTime);

      if (candidateStart >= candidateEnd) {
        setError('반납 일시가 출발 일시보다 빠르거나 같을 수 없습니다.');
        setIsSubmitting(false);
        return;
      }

      // Check overlapping reservations for the same vehicle (excluding rejected reservations)
      const overlapping = reservations.find(res => {
        if (res.vehicleId !== selectedVehicleId) return false;
        if (res.status === '반려') return false;

        const resStart = parseDateTime(res.startDate);
        const resEnd = parseDateTime(res.endDate);

        // candidateStart < resEnd && resStart < candidateEnd
        return candidateStart < resEnd && resStart < candidateEnd;
      });

      if (overlapping) {
        const statusLabel = overlapping.status === '대기' ? '대기 중' : overlapping.status;
        setError(`선택하신 차량은 해당 시간대에 이미 예약되어 있습니다. (운전자: ${overlapping.driverName}님 / 예약 상태: ${statusLabel} / 예약 시간: ${overlapping.startDate} ~ ${overlapping.endDate.split(' ').slice(1).join(' ') || overlapping.endDate})`);
        setIsSubmitting(false);
        return;
      }

      const newReservationId = `RES-${Date.now().toString().slice(-6)}`;

      await onAddReservation({
        id: newReservationId,
        vehicleId: selectedVehicleId,
        driverName,
        userEmail: driverEmail || 'unknown@welfare.org',
        startDate: startDateTime,
        endDate: endDateTime,
        purpose,
        destination: destination.trim(),
        passengers,
        status: '대기',
        rowNum: 0
      });

      setIsBooking(false);
      setSelectedVehicleId('');
      setDriverName('');
      setPurpose('');
      setDestination('');
      setPassengers('');
    } catch (err: any) {
      setError(err.message || '예약 등록에 실패했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="px-4 pt-4 flex flex-col gap-4 text-xs bg-[#f4f6f0]">
      
      {/* Title & Floating action header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-extrabold text-[#192310]">배차 예약현황 ({reservations.length})</h2>
          <p className="text-[10px] text-[#7b8f6c] font-medium">복지관 차량 운행을 사전에 신청하고 배정받습니다</p>
        </div>
        <button
          onClick={() => setIsBooking(!isBooking)}
          className="bg-[#516931] hover:bg-[#435728] text-white font-bold py-1.5 px-3 rounded-xl flex items-center gap-1 cursor-pointer transition shadow-md"
        >
          {isBooking ? '목록 보기' : '예약 신청'}
        </button>
      </div>

      {isBooking ? (
        /* Reservation Form Container */
        <div className="bg-white border border-[#d6dfce] p-4 rounded-3xl flex flex-col gap-3 shadow-md">
          <h3 className="text-sm font-bold text-[#516931]">차량 배차 예약 신청</h3>
          
          {error && <div className="p-3 rounded-xl bg-rose-50 text-rose-800 font-medium">{error}</div>}

          <form onSubmit={handleReserve} className="flex flex-col gap-3 text-[#1e2815]">
            {/* Vehicle select */}
            <div>
              <label className="block mb-1 font-semibold text-[#516931]">운행 차량 선택</label>
              <select
                value={selectedVehicleId}
                onChange={e => setSelectedVehicleId(e.target.value)}
                className="w-full bg-[#f4f6f0] border border-[#d6dfce] rounded-xl p-2.5 focus:border-[#516931] text-[#1e2815] focus:outline-none cursor-pointer"
              >
                <option value="">차량을 선택해 주세요</option>
                {vehicles.map(v => (
                  <option key={v.id} value={v.id}>
                    {v.id} - {v.model} ({v.status})
                  </option>
                ))}
              </select>
            </div>

            {/* Driver name */}
            <div>
              <label className="block mb-1 font-semibold text-[#516931]">운전자 성명</label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="예: 홍길동 복지사"
                  value={driverName}
                  onChange={e => setDriverName(e.target.value)}
                  className="w-full bg-[#f4f6f0] border border-[#d6dfce] rounded-xl pl-9 pr-4 py-2.5 focus:border-[#516931] text-[#1e2815] focus:outline-none"
                />
                <User className="absolute left-3 top-3 w-4.5 h-4.5 text-[#7b8f6c]" />
              </div>
            </div>

            {/* Start Date / Time */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block mb-1 font-semibold text-[#516931]">출발 날짜</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="w-full bg-[#f4f6f0] border border-[#d6dfce] rounded-xl p-2.5 focus:border-[#516931] text-[#1e2815] focus:outline-none"
                />
              </div>
              <div>
                <label className="block mb-1 font-semibold text-[#516931]">출발 시간</label>
                <input
                  type="time"
                  value={startTime}
                  onChange={e => setStartTime(e.target.value)}
                  className="w-full bg-[#f4f6f0] border border-[#d6dfce] rounded-xl p-2.5 focus:border-[#516931] text-[#1e2815] focus:outline-none"
                />
              </div>
            </div>

            {/* End Date / Time */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block mb-1 font-semibold text-[#516931]">반납 날짜</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  className="w-full bg-[#f4f6f0] border border-[#d6dfce] rounded-xl p-2.5 focus:border-[#516931] text-[#1e2815] focus:outline-none"
                />
              </div>
              <div>
                <label className="block mb-1 font-semibold text-[#516931]">반납 시간</label>
                <input
                  type="time"
                  value={endTime}
                  onChange={e => setEndTime(e.target.value)}
                  className="w-full bg-[#f4f6f0] border border-[#d6dfce] rounded-xl p-2.5 focus:border-[#516931] text-[#1e2815] focus:outline-none"
                />
              </div>
            </div>

            {/* Purpose */}
            <div>
              <label className="block mb-1 font-semibold text-[#516931]">운행 목적</label>
              <textarea
                rows={2}
                placeholder="예: 재가장애인 의료원 통원 동행 지원 서비스 제공"
                value={purpose}
                onChange={e => setPurpose(e.target.value)}
                className="w-full bg-[#f4f6f0] border border-[#d6dfce] rounded-xl p-2.5 focus:border-[#516931] text-[#1e2815] focus:outline-none resize-none"
              />
            </div>

            {/* Destination */}
            <div>
              <label className="block mb-1 font-semibold text-[#516931]">목적지</label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="예: 홍성보건소 / 충남도청 복지관"
                  value={destination}
                  onChange={e => setDestination(e.target.value)}
                  className="w-full bg-[#f4f6f0] border border-[#d6dfce] rounded-xl pl-9 pr-4 py-2.5 focus:border-[#516931] text-[#1e2815] focus:outline-none"
                />
                <MapPin className="absolute left-3 top-3 w-4.5 h-4.5 text-[#7b8f6c]" />
              </div>
            </div>

            {/* Passengers */}
            <div>
              <label className="block mb-1 font-semibold text-[#516931]">동승자 정보</label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="예: 박재민 님 외 2명"
                  value={passengers}
                  onChange={e => setPassengers(e.target.value)}
                  className="w-full bg-[#f4f6f0] border border-[#d6dfce] rounded-xl pl-9 pr-4 py-2.5 focus:border-[#516931] text-[#1e2815] focus:outline-none"
                />
                <Users className="absolute left-3 top-3 w-4.5 h-4.5 text-[#7b8f6c]" />
              </div>
            </div>

            <button
              disabled={isSubmitting}
              className="w-full bg-[#516931] hover:bg-[#435728] disabled:opacity-50 text-white font-bold p-3 rounded-xl transition duration-200 mt-2 cursor-pointer text-sm shadow-md"
            >
              {isSubmitting ? '구글 스프레드시트에 기입중...' : '신청하기'}
            </button>
          </form>
        </div>
      ) : (
        /* Reservations Log List */
        <div className="flex flex-col gap-3 bg-[#f4f6f0]">
          {reservations.length === 0 ? (
            <div className="bg-white border border-[#d6dfce]/80 p-8 rounded-3xl text-center text-[#7b8f6c]">
              현재 등록된 차량 예약이 존재하지 않습니다.
            </div>
          ) : (
            <div className="flex flex-col gap-3 max-h-[580px] overflow-y-auto pr-1">
              {[...reservations].reverse().map(res => (
                <div 
                  key={res.id} 
                  className="bg-white border border-[#d6dfce]/80 p-4 rounded-3xl flex flex-col gap-2.5 relative transition shadow-sm hover:border-[#516931]/40"
                >
                  {/* Item top status row */}
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[9px] bg-[#516931]/10 border border-[#d6dfce] px-2.5 py-0.5 rounded-full text-[#516931] font-mono font-bold">
                        {res.id}
                      </span>
                      <h4 className="text-xs font-extrabold text-[#11180c] mt-1">{res.vehicleId}</h4>
                    </div>
                    {/* Badge */}
                    <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-lg border uppercase ${
                      res.status === '승인' ? 'bg-emerald-100 text-emerald-800 border-emerald-205' :
                      res.status === '대기' ? 'bg-amber-100 text-amber-805 border-amber-205' :
                      res.status === '완료' ? 'bg-slate-100 text-slate-700 border-slate-205' :
                      'bg-rose-100 text-rose-800 border-rose-205'
                    }`}>
                      {res.status}
                    </span>
                  </div>

                  {/* Body details */}
                  <div className="grid grid-cols-2 gap-2 text-[#1e2815] text-[11px] bg-[#f4f6f0] p-3 rounded-2xl border border-[#d6dfce]/60">
                    <div className="flex items-center gap-1.5 font-medium">
                      <User className="w-3.5 h-3.5 text-[#7b8f6c] shrink-0" />
                      <span>운전자: {res.driverName}</span>
                    </div>
                    <div className="flex items-center gap-1.5 py-0.5 font-bold">
                      <Users className="w-3.5 h-3.5 text-[#7b8f6c] shrink-0" />
                      <span>동승: {res.passengers || '없음'}</span>
                    </div>
                    {res.destination && (
                      <div className="col-span-2 flex items-center gap-1.5 font-semibold text-[#1e2815] border-t border-[#d6dfce]/40 pt-1.5 mt-0.5">
                        <MapPin className="w-3.5 h-3.5 text-[#7b8f6c] shrink-0" />
                        <span>목적지: {res.destination}</span>
                      </div>
                    )}
                    <div className="col-span-2 flex items-center gap-1.5 font-bold text-[#516931] border-t border-[#d6dfce]/40 pt-1.5 mt-0.5">
                      <Calendar className="w-3.5 h-3.5 text-[#516931] shrink-0" />
                      <span className="font-mono text-[10px] text-[#516931]">{formatKSTDateTime(res.startDate)} ~ {formatKSTDateTime(res.endDate)}</span>
                    </div>
                  </div>

                  <div className="flex items-start gap-1 p-1">
                    <MessageCircle className="w-3.5 h-3.5 text-[#7b8f6c] shrink-0 mt-0.5" />
                    <p className="text-[11px] text-[#516931] italic">" {res.purpose} "</p>
                  </div>

                  {/* ADMIN Actions */}
                  {userRole === 'admin' && res.status === '대기' && (
                    <div className="flex items-center gap-2 mt-2 pt-2.5 border-t border-[#d6dfce]/80">
                      <button
                        onClick={() => onUpdateReservationStatus(res.rowNum, '승인')}
                        className="flex-1 bg-emerald-100 hover:bg-emerald-200 border border-emerald-300 text-emerald-900 font-bold py-1.5 px-3 rounded-xl flex items-center justify-center gap-1 cursor-pointer transition"
                      >
                        <Check className="w-3.5 h-3.5" /> 승인
                      </button>
                      <button
                        onClick={() => onUpdateReservationStatus(res.rowNum, '반려')}
                        className="flex-1 bg-rose-100 hover:bg-rose-200 border border-rose-300 text-rose-900 font-bold py-1.5 px-3 rounded-xl flex items-center justify-center gap-1 cursor-pointer transition"
                      >
                        <X className="w-3.5 h-3.5" /> 반려
                      </button>
                    </div>
                  )}

                  {userRole === 'admin' && res.status === '승인' && (
                    <div className="flex items-center gap-2 mt-2 pt-2.5 border-t border-[#d6dfce]/80">
                      <button
                        onClick={() => onUpdateReservationStatus(res.rowNum, '완료')}
                        className="flex-1 bg-indigo-100 hover:bg-indigo-200 border border-indigo-300 text-indigo-900 font-bold py-1.5 px-3 rounded-xl flex items-center justify-center gap-1 cursor-pointer transition"
                      >
                        <Check className="w-3.5 h-3.5" /> 운행 완료 처리
                      </button>
                    </div>
                  )}

                  {/* Approved -> Link to Log Write for drivers */}
                  {res.status === '승인' && (
                    <div className="mt-1 pt-1 border-t border-[#d6dfce]/50 flex justify-end">
                      <button
                        onClick={() => onNavigateToLogsWithPreset(res.vehicleId, res.driverName)}
                        className="text-[10px] text-[#516931] font-bold hover:underline flex items-center gap-1 py-1"
                      >
                        <FileText className="w-3.5 h-3.5" /> 운행 일지 작성으로 바로 연결
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

    </div>
  );
}
