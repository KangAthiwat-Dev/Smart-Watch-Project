'use client';

import { useState, useEffect, useRef } from 'react';
import { GoogleMap, useJsApiLoader, OverlayView, DirectionsRenderer } from '@react-google-maps/api';
import { Card } from '@/components/ui/card';
import { Heart, Thermometer, Battery, Map as MapIcon, Satellite, ShieldCheck, User } from 'lucide-react';
import { useRouter } from "next/navigation";

const containerStyle = { width: '100%', height: '100%', borderRadius: '1.5rem' };

interface MonitoringViewProps {
    users: any[];
    initialFocusId?: number; 
}

export default function MonitoringView({ users, initialFocusId }: MonitoringViewProps) {
    const router = useRouter();
    const mapRef = useRef<google.maps.Map | null>(null);

    
    
    const [selectedUser, setSelectedUser] = useState<any>(() => {
        if (initialFocusId) {
            const target = users.find(u => u.id === initialFocusId);
            if (target) return target;
        }
        return users[0] || null;
    });

    
    const lastPannedUserId = useRef<number | null>(null);

    
    
    useEffect(() => {
        if (selectedUser) {
            const freshData = users.find(u => u.id === selectedUser.id);
            if (freshData) {
                
                setSelectedUser(freshData);
            }
        }
    }, [users]); 

    
    useEffect(() => {
        if (initialFocusId) {
            const target = users.find(u => u.id === initialFocusId);
            if (target && target.id !== selectedUser?.id) {
                setSelectedUser(target);
                lastPannedUserId.current = null; 
            }
        }
    }, [initialFocusId, users]);

    
    useEffect(() => {
        const interval = setInterval(() => {
            router.refresh();
        }, 5000);
        return () => clearInterval(interval);
    }, [router]);

    
    const { isLoaded } = useJsApiLoader({
        id: 'google-map-script',
        googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAP || ''
    });

    const [mapType, setMapType] = useState<'roadmap' | 'satellite'>('roadmap');
    const [directionsResponse, setDirectionsResponse] = useState<any>(null);

    
    useEffect(() => {
        if (isLoaded && mapRef.current && selectedUser?.location) {
            
            if (lastPannedUserId.current !== selectedUser.id) {
                mapRef.current.panTo({ lat: selectedUser.location.lat, lng: selectedUser.location.lng });
                lastPannedUserId.current = selectedUser.id; 
            }
        }
    }, [selectedUser, isLoaded]);

    
    useEffect(() => {
        if (isLoaded && selectedUser?.isEmergency && selectedUser?.rescuer) {
            const directionsService = new google.maps.DirectionsService();
            directionsService.route({
                origin: { lat: selectedUser.rescuer.lat, lng: selectedUser.rescuer.lng },
                destination: { lat: selectedUser.location.lat, lng: selectedUser.location.lng },
                travelMode: google.maps.TravelMode.DRIVING,
            }, (result, status) => {
                if (status === google.maps.DirectionsStatus.OK) {
                    setDirectionsResponse(result);
                }
            });
        } else {
            setDirectionsResponse(null);
        }
    }, [isLoaded, selectedUser]);

    const handleUserClick = (user: any) => {
        setSelectedUser(user);
        lastPannedUserId.current = null;
    };

    if (!isLoaded) return <div className="h-full flex items-center justify-center animate-pulse text-slate-400">Loading Operations Map...</div>;

    return (
        <div className="flex h-[calc(100vh-12rem)] gap-4">

            {}
            <Card className="w-1/4 flex flex-col overflow-hidden bg-white/90 backdrop-blur border-slate-200 shadow-sm">
                <div className="p-4 bg-slate-50 border-b font-bold text-slate-700 flex justify-between items-center">
                    <span>รายชื่อผู้ใช้งาน</span>
                    <span className="text-xs bg-slate-200 px-2 py-0.5 rounded-full text-slate-500">{users.length}</span>
                </div>
                <div className="overflow-y-auto flex-1 p-2 space-y-2 custom-scrollbar">
                    {users.map(user => (
                        <div
                            key={user.id}
                            onClick={() => handleUserClick(user)}
                            className={`p-3 rounded-xl cursor-pointer border transition-all flex items-center justify-between group ${selectedUser?.id === user.id
                                ? 'bg-blue-50 border-blue-500 shadow-md ring-1 ring-blue-200'
                                : 'hover:bg-slate-50 border-transparent'
                                }`}
                        >
                            <div>
                                <div className={`font-bold transition-colors ${selectedUser?.id === user.id ? 'text-blue-700' : 'text-slate-700'}`}>
                                    {user.firstName} {user.lastName}
                                </div>
                                <div className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                                    {user.isEmergency ? <span className="text-red-500 font-bold flex items-center gap-1"> EMERGENCY</span> : <span className="text-green-600 flex items-center gap-1"><ShieldCheck size={10} /> Normal</span>}
                                </div>
                            </div>
                            {user.isEmergency && (
                                <span className="flex h-3 w-3 relative">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                                </span>
                            )}
                        </div>
                    ))}
                    {users.length === 0 && (
                        <div className="p-8 text-center text-slate-400 text-sm">ไม่พบรายชื่อผู้ใช้งาน</div>
                    )}
                </div>
            </Card>

            {}
            <div className="flex-1 flex flex-col gap-4">
                <Card className="flex-1 relative overflow-hidden shadow-xl border-slate-300 rounded-3xl bg-slate-100">
                    {!selectedUser?.isEmergency ? (
                        <div className="w-full h-full flex flex-col items-center justify-center bg-slate-50/50 text-slate-400 backdrop-blur-sm">
                            <div className="p-8 bg-white rounded-full shadow-lg mb-6">
                                <ShieldCheck className="w-16 h-16 text-emerald-500" />
                            </div>
                            <h2 className="text-2xl font-bold text-slate-700">สถานะปกติ (Safe)</h2>
                            <p className="text-sm mt-2 text-slate-500">ระบบปิดการแสดงผลแผนที่เพื่อความเป็นส่วนตัว</p>
                            <p className="text-xs text-slate-400 mt-1 uppercase tracking-wider">Map activates only on Emergency</p>
                        </div>
                    ) : (
                        <>
                            <div className="absolute top-4 right-4 z-10 flex gap-2 bg-white/90 p-1.5 rounded-full shadow-lg backdrop-blur border border-slate-100">
                                <button
                                    onClick={() => setMapType('roadmap')}
                                    className={`p-2 rounded-full transition-all ${mapType === 'roadmap' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-100'}`}
                                >
                                    <MapIcon size={18} />
                                </button>
                                <button
                                    onClick={() => setMapType('satellite')}
                                    className={`p-2 rounded-full transition-all ${mapType === 'satellite' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-100'}`}
                                >
                                    <Satellite size={18} />
                                </button>
                            </div>

                            <GoogleMap
                                mapContainerStyle={containerStyle}
                                zoom={14}
                                mapTypeId={mapType}
                                onLoad={(map) => { mapRef.current = map; }} 
                                options={{ 
                                    disableDefaultUI: true, 
                                    zoomControl: true,
                                    streetViewControl: false,
                                    mapTypeControl: false,
                                    fullscreenControl: false
                                }}
                            >
                                {selectedUser?.location && (
                                    <OverlayView position={{ lat: selectedUser.location.lat, lng: selectedUser.location.lng }} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
                                        <div className="relative flex items-center justify-center w-12 h-12 -translate-x-1/2 -translate-y-1/2 cursor-pointer group">
                                            <div className="absolute w-full h-full rounded-full bg-red-500 opacity-30 animate-ping"></div>
                                            <div className="relative w-5 h-5 border-2 border-white rounded-full bg-red-600 shadow-lg group-hover:scale-110 transition-transform"></div>
                                            <div className="absolute top-full mt-2 bg-white/90 backdrop-blur px-2 py-1 rounded text-[10px] font-bold shadow-md whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
                                                {selectedUser.firstName}
                                            </div>
                                        </div>
                                    </OverlayView>
                                )}

                                {selectedUser?.rescuer && (
                                    <OverlayView position={{ lat: selectedUser.rescuer.lat, lng: selectedUser.rescuer.lng }} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
                                        <div className="relative flex items-center justify-center w-12 h-12 -translate-x-1/2 -translate-y-1/2">
                                            <div className="absolute w-full h-full rounded-full bg-blue-500 opacity-30 animate-[spin_3s_linear_infinite]"></div>
                                            <div className="relative w-5 h-5 border-2 border-white rounded-full bg-blue-500 shadow-lg"></div>
                                            <div className="absolute bottom-full mb-2 bg-blue-600 text-white text-[10px] px-2 py-1 rounded-full whitespace-nowrap shadow-md flex items-center gap-1">
                                                <span>‍️</span> {selectedUser.rescuer.name}
                                            </div>
                                        </div>
                                    </OverlayView>
                                )}

                                {directionsResponse && (
                                    <DirectionsRenderer directions={directionsResponse} options={{ suppressMarkers: true, polylineOptions: { strokeColor: "#3B82F6", strokeWeight: 6, strokeOpacity: 0.8 } }} />
                                )}
                            </GoogleMap>
                        </>
                    )}
                </Card>

                {}
                {selectedUser && (
                    <Card className="p-4 flex items-center justify-between bg-white border-slate-200 shadow-sm shrink-0">
                        <div className="flex gap-8">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center text-red-500 border border-red-100 shadow-sm">
                                    <Heart size={22} className={selectedUser.health.bpm > 100 ? 'animate-pulse' : ''} />
                                </div>
                                <div>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Heart Rate</p>
                                    <p className="text-2xl font-black text-slate-700 leading-none mt-0.5">{selectedUser.health.bpm} <span className="text-xs font-medium text-slate-400">bpm</span></p>
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-2xl bg-orange-50 flex items-center justify-center text-orange-500 border border-orange-100 shadow-sm">
                                    <Thermometer size={22} />
                                </div>
                                <div>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Temp</p>
                                    <p className="text-2xl font-black text-slate-700 leading-none mt-0.5">{selectedUser.health.temp} <span className="text-xs font-medium text-slate-400">°C</span></p>
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-500 border border-emerald-100 shadow-sm">
                                    <Battery size={22} />
                                </div>
                                <div>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Battery</p>
                                    <p className="text-2xl font-black text-slate-700 leading-none mt-0.5">{selectedUser.location?.battery || 0}<span className="text-sm">%</span></p>
                                </div>
                            </div>
                        </div>

                        <div>
                            {selectedUser.isEmergency ? (
                                selectedUser.status === 'ACKNOWLEDGED' ? (
                                    <div className="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold border border-blue-700 shadow-lg shadow-blue-200 flex items-center gap-3">
                                        <div className="w-2 h-2 rounded-full bg-white animate-pulse"></div>
                                        เจ้าหน้าที่กำลังปฏิบัติงาน
                                    </div>
                                ) : (
                                    <div className="bg-red-500 text-white px-6 py-3 rounded-xl font-bold border border-red-600 shadow-lg shadow-red-200 animate-pulse flex items-center gap-3">
                                        <span className="text-xl"></span> รอการช่วยเหลือ
                                    </div>
                                )
                            ) : (
                                <div className="bg-slate-100 text-slate-500 px-6 py-3 rounded-xl font-medium border border-slate-200 flex items-center gap-2">
                                    <ShieldCheck size={18} /> เหตุการณ์ปกติ
                                </div>
                            )}
                        </div>
                    </Card>
                )}
            </div>
        </div>
    );
}