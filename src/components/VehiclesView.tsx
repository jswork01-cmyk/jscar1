import React, { useState } from 'react';
import { Vehicle, uploadFileToDrive, resolveDriveImageUrl } from '../lib/googleSheets';
import { formatKSTDate } from '../lib/dateUtils';
import { 
  Plus, Upload, Sparkles, CheckCircle2, 
  X, Image as ImageIcon, Check, Calendar
} from 'lucide-react';

interface VehiclesViewProps {
  vehicles: Vehicle[];
  token: string | null;
  spreadsheetId: string | null;
  userRole: 'driver' | 'admin';
  onAddVehicle: (newVehicle: Omit<Vehicle, 'rowNum'>) => Promise<void>;
  onUpdateVehicle: (rowNum: number, column: any, value: any) => Promise<void>;
}

export default function VehiclesView({
  vehicles,
  token,
  spreadsheetId,
  userRole,
  onAddVehicle,
  onUpdateVehicle
}: VehiclesViewProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [isUploadingIdx, setIsUploadingIdx] = useState<number | null>(null);
  
  // Filtering & Editing states for Institution (기관)
  const [selectedInst, setSelectedInst] = useState<string>('전체');
  const [editingInstRow, setEditingInstRow] = useState<number | null>(null);
  const [editingInstText, setEditingInstText] = useState('');
  
  // New Vehicle form states
  const [newId, setNewId] = useState('');
  const [newModel, setNewModel] = useState('');
  const [newInsDate, setNewInsDate] = useState('2026-12-31');
  const [newCycle, setNewCycle] = useState(10000);
  const [newCurrent, setNewCurrent] = useState(0);
  const [newInstitution, setNewInstitution] = useState('본관');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [imageErrorRows, setImageErrorRows] = useState<Record<number, boolean>>({});

  // Calculate oil change remaining info
  const getOilStatus = (v: Vehicle) => {
    const driven = v.currentMileage - v.lastOilMileage;
    const progress = Math.max(0, Math.min(100, (driven / v.oilChangeCycle) * 100));
    const remains = v.oilChangeCycle - driven;
    
    let color = 'bg-[#516931]';
    let text = '정상';
    if (remains <= 0) {
      color = 'bg-rose-500';
      text = '즉시교환';
    } else if (remains <= 1000) {
      color = 'bg-amber-500';
      text = '교환임박';
    }

    return { progress, remains, color, text };
  };

  // Upload photo handler
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>, v: Vehicle) => {
    const file = e.target.files?.[0];
    if (!file || !token || !spreadsheetId) return;

    try {
      setIsUploadingIdx(v.rowNum);
      const photoUrl = await uploadFileToDrive(file, token);
      await onUpdateVehicle(v.rowNum, 'photoUrl', photoUrl);
    } catch (err: any) {
      alert(err.message || '사진 업로드에 실패했습니다.');
    } finally {
      setIsUploadingIdx(null);
    }
  };

  const [openStatusMenuId, setOpenStatusMenuId] = useState<string | null>(null);
  const [isUpdatingStatusRow, setIsUpdatingStatusRow] = useState<number | null>(null);

  const handleUpdateStatus = async (v: Vehicle, nextStatus: '운행가능' | '수리중' | '대기중') => {
    try {
      setIsUpdatingStatusRow(v.rowNum);
      await onUpdateVehicle(v.rowNum, 'status', nextStatus);
    } catch (err: any) {
      alert('상태 변경에 실패했습니다: ' + err.message);
    } finally {
      setIsUpdatingStatusRow(null);
      setOpenStatusMenuId(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newId.trim() || !newModel.trim()) {
      setError('차량번호와 차종은 필수 기입 사항입니다.');
      return;
    }

    setIsSubmitting(true);
    setError('');
    try {
      await onAddVehicle({
        id: newId,
        model: newModel,
        insuranceDate: newInsDate,
        lastOilMileage: newCurrent,
        oilChangeCycle: newCycle,
        currentMileage: newCurrent,
        photoUrl: '',
        status: '운행가능',
        institution: newInstitution.trim() || '본관'
      });
      setIsAdding(false);
      setNewId('');
      setNewModel('');
      setNewInstitution('본관');
    } catch (err: any) {
      setError(err.message || '차량 등록에 실패했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Dynamically extract unique institutions inside registered vehicles
  const uniqueInstitutions = Array.from(new Set(vehicles.map(v => v.institution || '본관')));
  const filterList = ['전체', ...uniqueInstitutions];

  const filteredVehicles = vehicles.filter(v => {
    if (selectedInst === '전체') return true;
    return (v.institution || '본관') === selectedInst;
  });

  return (
    <div className="px-4 pt-4 flex flex-col gap-4 bg-[#f4f6f0]">
      {/* Title & Add Action with Access Control */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-extrabold text-[#192310]">복지관 보유 차량 ({vehicles.length})</h2>
          <p className="text-[10px] text-[#7b8f6c] font-medium">차량별 오일 교환 및 보험 갱신 주기를 관리합니다</p>
        </div>
        {userRole === 'admin' && (
          <button
            onClick={() => setIsAdding(true)}
            className="text-xs bg-[#516931] hover:bg-[#435728] text-white font-bold py-1.5 px-3 rounded-xl flex items-center gap-1 cursor-pointer shadow-md"
          >
            <Plus className="w-3.5 h-3.5" /> 차량 등록
          </button>
        )}
      </div>

      {/* Institution Filter Bar */}
      <div className="bg-white border border-[#d6dfce]/85 p-3 rounded-2xl shadow-xs flex flex-col gap-2">
        <div className="text-[10px] uppercase font-bold text-[#516931] tracking-wider flex items-center gap-1 select-none">
          🏢 기관별 차량 간편 검색 / 필터
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
          {filterList.map(inst => {
            const count = inst === '전체' 
              ? vehicles.length 
              : vehicles.filter(v => (v.institution || '본관') === inst).length;
            
            return (
              <button
                key={inst}
                onClick={() => setSelectedInst(inst)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                  selectedInst === inst
                    ? 'bg-[#516931] text-white border-[#516931] shadow-xs'
                    : 'bg-[#f4f6f0] text-[#1e2815] border-[#d6dfce]/60 hover:bg-[#e9eee2] hover:text-[#516931]'
                }`}
              >
                <span>{inst}</span>
                <span className={`text-[9.5px] px-2 py-0.2 rounded-full font-extrabold ${
                  selectedInst === inst ? 'bg-white/20 text-white' : 'bg-[#1e2815]/5 text-[#7b8f6c]'
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Add Vehicle Sliding Drawer */}
      {isAdding && (
        <div className="bg-white border border-[#d6dfce] p-4 rounded-3xl relative flex flex-col gap-3 shadow-md">
          <button 
            onClick={() => setIsAdding(false)} 
            className="absolute top-4 right-4 text-[#7b8f6c] hover:text-[#516931]"
          >
            <X className="w-5 h-5" />
          </button>

          <h3 className="text-xs font-bold uppercase text-[#516931] tracking-wider">새 복지차량 등록</h3>
          
          {error && <p className="text-xs text-rose-600 font-medium bg-rose-50 p-2 rounded-xl">{error}</p>}

          <form onSubmit={handleSubmit} className="flex flex-col gap-3 text-xs text-[#1e2815]">
            <div>
              <label className="block mb-1 font-semibold text-[#516931]">차량번호</label>
              <input
                type="text"
                placeholder="예: 12가 3456"
                value={newId}
                onChange={e => setNewId(e.target.value)}
                className="w-full bg-[#f4f6f0] border border-[#d6dfce] rounded-xl p-2.5 focus:border-[#516931] text-[#1e2815] focus:outline-none"
              />
            </div>

            <div>
              <label className="block mb-1 font-semibold text-[#516931]">차종 명칭</label>
              <input
                type="text"
                placeholder="예: 스타리아 리프트 (1호차)"
                value={newModel}
                onChange={e => setNewModel(e.target.value)}
                className="w-full bg-[#f4f6f0] border border-[#d6dfce] rounded-xl p-2.5 focus:border-[#516931] text-[#1e2815] focus:outline-none"
              />
            </div>

            <div>
              <label className="block mb-1 font-semibold text-[#516931]">관리 주체 기관명</label>
              <div className="flex gap-1.5 mb-1.5 flex-wrap">
                {['본관', '주간보호센터', '직업재활센터'].map(inst => (
                  <button
                    key={inst}
                    type="button"
                    onClick={() => setNewInstitution(inst)}
                    className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold border transition cursor-pointer select-none ${
                      newInstitution === inst
                        ? 'bg-[#516931] text-white border-[#516931] shadow-xs'
                        : 'bg-white text-[#516931] border-[#d6dfce] hover:bg-[#f4f6f0]'
                    }`}
                  >
                    {inst}
                  </button>
                ))}
              </div>
              <input
                type="text"
                placeholder="또는 직접 입력 (예: 공동생활가정)"
                value={newInstitution}
                onChange={e => setNewInstitution(e.target.value)}
                className="w-full bg-[#f4f6f0] border border-[#d6dfce] rounded-xl p-2.5 focus:border-[#516931] text-[#1e2815] focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block mb-1 font-semibold text-[#516931]">현재 주행거리 (km)</label>
                <input
                  type="number"
                  value={newCurrent}
                  onChange={e => setNewCurrent(parseInt(e.target.value) || 0)}
                  className="w-full bg-[#f4f6f0] border border-[#d6dfce] rounded-xl p-2.5 focus:border-[#516931] text-[#1e2815] focus:outline-none"
                />
              </div>
              <div>
                <label className="block mb-1 font-semibold text-[#516931]">오일 교환주기 (km)</label>
                <input
                  type="number"
                  value={newCycle}
                  onChange={e => setNewCycle(parseInt(e.target.value) || 10000)}
                  className="w-full bg-[#f4f6f0] border border-[#d6dfce] rounded-xl p-2.5 focus:border-[#516931] text-[#1e2815] focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block mb-1 font-semibold text-[#516931]">보험 계약갱신 만료일</label>
              <input
                type="date"
                value={newInsDate}
                onChange={e => setNewInsDate(e.target.value)}
                className="w-full bg-[#f4f6f0] border border-[#d6dfce] rounded-xl p-2.5 focus:border-[#516931] text-[#1e2815] focus:outline-none"
              />
            </div>

            <button
              disabled={isSubmitting}
              className="w-full bg-[#516931] hover:bg-[#435728] disabled:opacity-50 text-white font-bold p-3 rounded-xl gap-2 mt-2 transition cursor-pointer"
            >
              {isSubmitting ? '스프레드시트에 등록중...' : '등록 완료'}
            </button>
          </form>
        </div>
      )}

      {/* Grid of Vehicles */}
      <div className="flex flex-col gap-4">
        {filteredVehicles.map(v => {
          const { progress, remains, color, text } = getOilStatus(v);
          const isInsExpired = new Date(v.insuranceDate).getTime() <= new Date('2026-05-20').getTime();

          return (
            <div 
              key={v.id} 
              className="bg-white border border-[#d6dfce]/80 rounded-3xl p-4 flex flex-col gap-3 relative transition shadow-sm hover:border-[#516931]/40"
            >
              {/* Header inside vehicle card */}
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs bg-[#516931]/10 border border-[#d6dfce] px-2.5 py-0.5 rounded-full text-[#516931] font-mono font-bold">
                      {v.id}
                    </span>
                    
                    {editingInstRow === v.rowNum ? (
                      <div className="flex items-center gap-1">
                        <input
                          type="text"
                          value={editingInstText}
                          onChange={e => setEditingInstText(e.target.value)}
                          className="text-[10px] px-2 py-0.5 border border-[#516931] rounded-lg focus:outline-none w-24 font-bold text-[#1e2815]"
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={async () => {
                            await onUpdateVehicle(v.rowNum, 'institution', editingInstText.trim() || '본관');
                            setEditingInstRow(null);
                          }}
                          className="bg-[#516931] text-white p-0.5 rounded hover:bg-[#435728] cursor-pointer"
                        >
                          <Check className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingInstRow(null)}
                          className="bg-gray-150 text-gray-700 p-0.5 rounded hover:bg-gray-200 cursor-pointer"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setSelectedInst(v.institution || '본관')}
                          className="text-[10px] font-extrabold bg-blue-50 text-blue-800 px-2 py-0.5 rounded-md border border-blue-100 hover:bg-blue-600 hover:text-white transition cursor-pointer flex items-center gap-0.5"
                          title="클릭하여 이 기관의 차량만 보기"
                        >
                          🏢 {v.institution || '본관'}
                        </button>
                        {userRole === 'admin' && (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingInstRow(v.rowNum);
                              setEditingInstText(v.institution || '본관');
                            }}
                            className="text-[#7b8f6c] hover:text-[#516931] p-0.5 text-[9px]"
                            title="기관 수정"
                          >
                            ✏️
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  <h4 className="text-sm font-bold text-[#1e2815] mt-1.5">{v.model}</h4>
                </div>

                {/* Status selector */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setOpenStatusMenuId(openStatusMenuId === v.id ? null : v.id)}
                    className={`text-[10px] sm:text-[10.5px] uppercase font-extrabold tracking-wider px-2.5 py-1.5 rounded-xl border transition flex items-center gap-1.5 shadow-xs select-none ${
                      v.status === '운행가능' 
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-200/60 hover:bg-emerald-205' 
                        : v.status === '수리중' 
                        ? 'bg-rose-100 text-rose-800 border-rose-200/60 hover:bg-rose-205' 
                        : 'bg-amber-100 text-amber-800 border-amber-200/60 hover:bg-amber-150'
                    } hover:scale-[1.02] active:scale-[0.98] cursor-pointer`}
                  >
                    <span>{v.status === '대기중' ? '운행대기' : v.status}</span>
                    {isUpdatingStatusRow === v.rowNum ? (
                      <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin shrink-0" />
                    ) : (
                      <span className="text-[7px] text-[#7b8f6c] select-none">▼</span>
                    )}
                  </button>

                  {openStatusMenuId === v.id && (
                    <>
                      {/* Full-screen backdrop overlay for closing */}
                      <div 
                        className="fixed inset-0 z-40 bg-transparent" 
                        onClick={() => setOpenStatusMenuId(null)}
                      />
                      <div className="absolute right-0 top-9 bg-white border border-[#d6dfce] rounded-2xl shadow-xl z-50 py-2 px-1.5 w-[110px] flex flex-col gap-1 animate-in fade-in slide-in-from-top-1.5 duration-100">
                        <div className="text-[8.5px] text-[#7b8f6c] font-black tracking-wider px-2 py-1 select-none uppercase border-b border-[#f4f6f0] mb-1">상태 선택</div>
                        <button
                          type="button"
                          onClick={() => handleUpdateStatus(v, '운행가능')}
                          className={`w-full text-left text-[10px] font-extrabold px-2 py-1.5 rounded-lg flex items-center gap-1.5 transition ${
                            v.status === '운행가능' ? 'bg-emerald-50 text-emerald-850 font-black' : 'text-[#3d4b2d] hover:bg-[#f4f6f0]'
                          }`}
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                          운행가능
                        </button>
                        <button
                          type="button"
                          onClick={() => handleUpdateStatus(v, '대기중')}
                          className={`w-full text-left text-[10px] font-extrabold px-2 py-1.5 rounded-lg flex items-center gap-1.5 transition ${
                            v.status === '대기중' ? 'bg-amber-50 text-amber-850 font-black' : 'text-[#3d4b2d] hover:bg-[#f4f6f0]'
                          }`}
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                          운행대기
                        </button>
                        <button
                          type="button"
                          onClick={() => handleUpdateStatus(v, '수리중')}
                          className={`w-full text-left text-[10px] font-extrabold px-2 py-1.5 rounded-lg flex items-center gap-1.5 transition ${
                            v.status === '수리중' ? 'bg-rose-50 text-rose-850 font-black' : 'text-[#3d4b2d] hover:bg-[#f4f6f0]'
                          }`}
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
                          수리중
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Photo Area with Upload Interface */}
              <div className="relative w-full h-32 bg-[#f4f6f0] rounded-2xl flex items-center justify-center overflow-hidden border border-[#d6dfce]/60 group">
                {v.photoUrl ? (
                  imageErrorRows[v.rowNum] ? (
                    <div className="flex flex-col items-center justify-center text-rose-800 bg-rose-50/70 w-full h-full p-2.5 text-center gap-1 select-none">
                      <X className="w-4 h-4 text-rose-500" />
                      <span className="text-[9.5px] font-black leading-tight">사진 로딩 불가 ⚠️</span>
                      <span className="text-[8px] font-bold text-rose-600/90 leading-snug">
                        드라이브 파일 공유 설정을 <br/>
                        <span className="underline">"링크가 있는 모든 사용자"</span>로<br/>
                        변경해주시면 표시됩니다.
                      </span>
                    </div>
                  ) : (
                    <>
                      <img 
                        src={resolveDriveImageUrl(v.photoUrl)} 
                        alt={v.model}
                        className="w-full h-full object-cover transition duration-300"
                        onError={(e) => {
                          const target = e.currentTarget;
                          // 1단계: 만약 thumbnail 형식이 실패했다면, docs.google.com/uc?export=view 형식으로 조율
                          if (target.src.includes('thumbnail')) {
                            const dMatch = v.photoUrl.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
                            const idMatch = v.photoUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/);
                            const fileId = (dMatch && dMatch[1]) || (idMatch && idMatch[1]);
                            if (fileId) {
                              target.src = `https://docs.google.com/uc?export=view&id=${fileId}`;
                              return;
                            }
                          }
                          // 2단계: 그것도 실패했다면 lh3.googleusercontent.com 형식으로 조율
                          if (target.src.includes('docs.google.com')) {
                            const dMatch = v.photoUrl.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
                            const idMatch = v.photoUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/);
                            const fileId = (dMatch && dMatch[1]) || (idMatch && idMatch[1]);
                            if (fileId) {
                              target.src = `https://lh3.googleusercontent.com/d/${fileId}`;
                              return;
                            }
                          }
                          // 3단계: 모두 다 작동하지 않는 비공개 파일인 경우, 에러 박스 UI 렌더링 전환
                          setImageErrorRows(prev => ({ ...prev, [v.rowNum]: true }));
                        }}
                      />
                      {/* Tiny visual badge */}
                      <div className="absolute top-2 left-2 bg-[#516931] px-2 py-0.5 rounded-md text-[8px] font-bold text-white shadow-sm select-none">
                        구글 드라이브 연동됨
                      </div>
                    </>
                  )
                ) : (
                  <div className="flex flex-col items-center justify-center text-[#7b8f6c] gap-1.5 p-4">
                    <ImageIcon className="w-8 h-8 text-[#7b8f6c]/60" />
                    <span className="text-[10px] font-medium text-[#7b8f6c]">등록된 차량 사진이 없습니다.</span>
                  </div>
                )}

                {/* Photo uploader layer on hover */}
                {spreadsheetId && token && (
                  <label className="absolute inset-0 bg-[#516931]/80 backdrop-blur-sm opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-white text-xs font-semibold cursor-pointer transition duration-200">
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={e => handlePhotoUpload(e, v)}
                      className="hidden" 
                    />
                    <Upload className="w-5 h-5 text-white mb-1" />
                    <span>{v.photoUrl ? '사진 교체하기' : '새 사진 등록'}</span>
                    <span className="text-[8px] font-light text-[#dce7d2] mt-0.5">Google Drive 연결 업로드</span>
                  </label>
                )}

                {/* Loading indicator */}
                {isUploadingIdx === v.rowNum && (
                  <div className="absolute inset-0 bg-[#f4f6f0]/95 flex flex-col items-center justify-center text-xs text-[#516931] gap-2 font-bold z-10">
                    <div className="w-5 h-5 border-2 border-[#516931] border-t-transparent rounded-full animate-spin" />
                    <span>사진 업로드 중...</span>
                  </div>
                )}
              </div>

              {/* Vehicle parameters & alerts */}
              <div className="grid grid-cols-2 gap-3 text-xs border-y border-[#d6dfce]/50 py-2.5">
                <div>
                  <span className="text-[10px] text-[#7b8f6c] block mb-0.5">현재 주행거리</span>
                  <span className="font-mono text-[#1e2815] font-bold">{v.currentMileage.toLocaleString()} km</span>
                </div>
                <div>
                  <span className="text-[10px] text-[#7b8f6c] block mb-0.5">보험 만료일</span>
                  <span className={`font-mono font-bold flex items-center gap-1 select-none ${isInsExpired ? 'text-rose-600' : 'text-[#1e2815]'}`}>
                    {formatKSTDate(v.insuranceDate)}
                  </span>
                </div>
              </div>

              {/* Maintenance Metrics (Engine Oil) */}
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between text-[10px] font-bold text-[#7b8f6c]">
                  <span>엔진오일 상태 ({v.lastOilMileage.toLocaleString()}km에 교체)</span>
                  <span className={remains <= 0 ? 'text-rose-600 animate-pulse' : remains <= 1000 ? 'text-amber-600' : 'text-[#516931]'}>
                    {text} ({remains.toLocaleString()} km 잔여)
                  </span>
                </div>
                
                {/* Custom Gradient Progress Bar */}
                <div className="w-full h-2.5 bg-[#f4f6f0] rounded-full overflow-hidden border border-[#d6dfce]/50">
                  <div 
                    className={`h-full transition-all duration-500 ${color}`}
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>

            </div>
          );
        })}
      </div>
    </div>
  );
}
