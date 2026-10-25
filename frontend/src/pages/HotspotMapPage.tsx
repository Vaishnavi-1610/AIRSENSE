import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import {
  MapPin,
  Flame,
  ShieldAlert,
  Calendar,
  AlertCircle,
  Building2,
  TrendingUp,
  Info,
  CheckCircle2,
  Trophy,
  Filter
} from 'lucide-react';
import { HotspotsResponse, HotspotCity } from '../types';
import { api } from '../services/api';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { AQIBadge } from '../components/AQIBadge';

// Custom Marker for Top 2-3 Hotspots (Glowing, Pulsing with Rank Badge)
const createHotspotMarker = (rank: number, aqi: number, color: string) => {
  return L.divIcon({
    className: 'custom-hotspot-pin-wrapper',
    html: `
      <div style="position: relative; display: flex; align-items: center; justify-content: center;">
        <div style="
          position: absolute;
          width: 44px;
          height: 44px;
          border-radius: 50%;
          background: ${color};
          opacity: 0.35;
          animation: ping 1.8s cubic-bezier(0, 0, 0.2, 1) infinite;
        "></div>
        <div style="
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: ${color};
          border: 3px solid white;
          box-shadow: 0 4px 14px rgba(0,0,0,0.35);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: 800;
          font-size: 11px;
          z-index: 10;
        ">
          <span style="font-size: 8px; line-height: 1; text-transform: uppercase;">#${rank}</span>
          <span style="line-height: 1;">${Math.round(aqi)}</span>
        </div>
      </div>
    `,
    iconSize: [44, 44],
    iconAnchor: [22, 22],
    popupAnchor: [0, -22],
  });
};

// Subtle Neutral Marker for Non-Hotspot Monitoring Cities
const createStandardMarker = (aqi: number) => {
  return L.divIcon({
    className: 'custom-standard-pin-wrapper',
    html: `
      <div style="
        width: 26px;
        height: 26px;
        border-radius: 50%;
        background: #475569;
        border: 2px solid white;
        box-shadow: 0 2px 6px rgba(0,0,0,0.2);
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-weight: 700;
        font-size: 10px;
        opacity: 0.85;
      ">
        ${Math.round(aqi)}
      </div>
    `,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
    popupAnchor: [0, -14],
  });
};

export const HotspotMapPage: React.FC = () => {
  const [data, setData] = useState<HotspotsResponse | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeCity, setActiveCity] = useState<HotspotCity | null>(null);

  const fetchHotspots = async (date?: string) => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.getIndiaHotspots(date || undefined);
      setData(res);
      if (res.top_hotspots.length > 0) {
        setActiveCity(res.top_hotspots[0]);
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'Failed to load hotspot telemetry');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHotspots(selectedDate);
  }, []);

  const handleApplyDate = () => {
    fetchHotspots(selectedDate);
  };

  const handleResetDate = () => {
    setSelectedDate('');
    fetchHotspots(undefined);
  };

  // Center of India: Lat 22.5, Lon 78.9, Zoom 5
  const indiaCenter: [number, number] = [22.5, 78.9];

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Top Header Card */}
      <div className="card-panel p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <Flame className="w-5 h-5 text-rose-600" />
              <h3 className="text-base font-bold text-navy-900">
                Pollution Hotspot Detection on India Map
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Highlighting strictly the top 2–3 Indian cities with the highest air pollution levels based on standardized time-weighted AQI
            </p>
          </div>

          {/* Date Selector */}
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-500 font-semibold flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-teal-600" /> Filter by Date:
            </span>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="text-xs rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
            <button
              onClick={handleApplyDate}
              className="px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-xs"
            >
              Filter
            </button>
            {selectedDate && (
              <button
                onClick={handleResetDate}
                className="px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-xs font-semibold"
              >
                Reset
              </button>
            )}
          </div>
        </div>

        {/* Section 6 Hotspot Criteria Notice */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
          <span>
            <strong>Selection Criteria:</strong> Only the top 2–3 cities exceeding threshold boundaries are highlighted as National Hotspots. Other monitored cities remain visible as standard nodes.
          </span>
          <span className="text-teal-700 font-semibold">
            {data ? `${data.total_cities_evaluated} Indian Cities Evaluated` : ''}
          </span>
        </div>
      </div>

      {loading ? (
        <div className="card-panel my-8">
          <LoadingSpinner message="Calculating national pollution hotspots across India..." />
        </div>
      ) : error ? (
        <div className="card-panel p-6 text-center text-rose-700 bg-rose-50 border-rose-200">
          <AlertCircle className="w-6 h-6 mx-auto mb-2 text-rose-500" />
          <h4 className="text-sm font-bold">Error analyzing hotspots</h4>
          <p className="text-xs text-rose-600 mt-1">{error}</p>
        </div>
      ) : data ? (
        <>
          {/* Top 2-3 Hotspot Cards Grid (Section 6 Requirement) */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-rose-700 flex items-center gap-1.5">
                <Flame className="w-4 h-4 text-rose-600" /> Top {data.top_hotspots.length} National Hotspots Highlighted
              </h4>
              <span className="text-[11px] text-slate-400">Analysis: {data.analysis_period}</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {data.top_hotspots.map((hs) => (
                <div
                  key={hs.city}
                  onClick={() => setActiveCity(hs)}
                  className={`card-panel p-5 cursor-pointer border-t-4 transition-all ${
                    activeCity?.city === hs.city
                      ? 'ring-2 ring-rose-500 shadow-md'
                      : 'hover:border-rose-400'
                  }`}
                  style={{ borderTopColor: hs.color }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-200">
                      <Trophy className="w-3 h-3 text-rose-600" /> Hotspot #{hs.hotspot_rank}
                    </span>
                    <span className="text-[11px] font-semibold text-slate-500">{hs.region}</span>
                  </div>

                  <h3 className="text-base font-extrabold text-navy-900 mt-1">{hs.city}</h3>
                  <div className="text-[11px] text-slate-400">{hs.state}</div>

                  <div className="flex items-baseline gap-2 my-2.5">
                    <span className="text-3xl font-black text-navy-900">{hs.mean_aqi}</span>
                    <span className="text-[11px] text-slate-400">Period Mean AQI</span>
                  </div>

                  <div className="mb-3">
                    <AQIBadge category={hs.category} size="sm" />
                  </div>

                  <p className="text-xs text-slate-600 leading-relaxed pt-2.5 border-t border-slate-100">
                    {hs.hotspot_explanation}
                  </p>

                  <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
                    <span>Coordinates: {hs.latitude.toFixed(2)}°N, {hs.longitude.toFixed(2)}°E</span>
                    <span className="font-semibold text-rose-700">PM2.5: {hs.mean_pm25} µg/m³</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Interactive Leaflet Map Covering India */}
          <div className="card-panel overflow-hidden border border-slate-200/90 shadow-sm">
            <div className="p-4 bg-slate-50/80 border-b border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h4 className="text-sm font-bold text-navy-900 flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-teal-600" /> National Air Quality Map (India)
                </h4>
                <p className="text-[11px] text-slate-500">
                  Top 2-3 hotspots highlighted with glowing ranked beacons. Standard stations displayed in slate.
                </p>
              </div>

              {/* Map legend */}
              <div className="flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1.5 font-semibold text-rose-700">
                  <span className="w-3 h-3 rounded-full bg-rose-600 animate-pulse border border-white" />
                  Top Hotspots (#1, #2, #3)
                </span>
                <span className="flex items-center gap-1.5 text-slate-600">
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-600 border border-white" />
                  Monitored Cities
                </span>
              </div>
            </div>

            <div className="h-[460px] w-full relative z-0">
              <MapContainer
                center={indiaCenter}
                zoom={5}
                scrollWheelZoom={false}
                style={{ height: '100%', width: '100%', zIndex: 0 }}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                {/* Render markers */}
                {data.all_city_rankings.map((city) => {
                  const isHotspot = city.is_top_hotspot && city.hotspot_rank;
                  const icon = isHotspot
                    ? createHotspotMarker(city.hotspot_rank || 1, city.mean_aqi, city.color)
                    : createStandardMarker(city.mean_aqi);

                  return (
                    <Marker
                      key={city.city}
                      position={[city.latitude, city.longitude]}
                      icon={icon}
                    >
                      <Popup>
                        <div className="p-1 min-w-[190px]">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="font-bold text-xs text-navy-900">{city.city}</span>
                            {isHotspot ? (
                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 font-extrabold uppercase">
                                Hotspot #{city.hotspot_rank}
                              </span>
                            ) : (
                              <span className="text-[9px] text-slate-500">Monitored</span>
                            )}
                          </div>
                          <div className="text-lg font-black text-slate-800 my-1">
                            {city.mean_aqi} <span className="text-[10px] font-normal text-slate-500">Mean AQI</span>
                          </div>
                          <div className="mb-2">
                            <AQIBadge category={city.category} size="sm" />
                          </div>
                          <p className="text-[10px] text-slate-600 leading-tight">
                            {isHotspot ? city.hotspot_explanation : 'Ambient air quality station.'}
                          </p>
                        </div>
                      </Popup>
                    </Marker>
                  );
                })}
              </MapContainer>
            </div>
          </div>

          {/* National Rankings Table */}
          <div className="card-panel p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h4 className="text-sm font-bold text-navy-900">
                  National City Air Quality Ranking Table
                </h4>
                <p className="text-xs text-slate-500">
                  Comparative ranking of all monitored Indian cities by time-weighted Mean AQI
                </p>
              </div>
              <span className="text-xs text-slate-400">Total: {data.all_city_rankings.length} Cities</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50/70">
                    <th className="py-3 px-3">Rank</th>
                    <th className="py-3 px-3">City & Region</th>
                    <th className="py-3 px-3">Mean AQI</th>
                    <th className="py-3 px-3">Latest AQI</th>
                    <th className="py-3 px-3">Mean PM2.5</th>
                    <th className="py-3 px-3">Elevated Hours</th>
                    <th className="py-3 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.all_city_rankings.map((c, idx) => (
                    <tr
                      key={c.city}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        c.is_top_hotspot ? 'bg-rose-50/30 font-semibold' : 'text-slate-700'
                      }`}
                    >
                      <td className="py-3 px-3 font-bold">
                        {c.is_top_hotspot ? (
                          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-rose-600 text-white text-[10px]">
                            {idx + 1}
                          </span>
                        ) : (
                          <span className="text-slate-400 font-mono">#{idx + 1}</span>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-bold text-navy-900">{c.city}</div>
                        <div className="text-[10px] text-slate-400">{c.state} • {c.region}</div>
                      </td>
                      <td className="py-3 px-3 font-black text-navy-900 font-mono text-sm">{c.mean_aqi}</td>
                      <td className="py-3 px-3 font-mono text-slate-600">{c.latest_aqi}</td>
                      <td className="py-3 px-3 font-mono text-slate-600">{c.mean_pm25} µg/m³</td>
                      <td className="py-3 px-3 font-mono text-slate-600">{c.elevated_percentage}%</td>
                      <td className="py-3 px-3">
                        {c.is_top_hotspot ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[10px] font-bold border border-rose-200">
                            <Flame className="w-2.5 h-2.5 text-rose-600" /> Hotspot #{c.hotspot_rank}
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400">Monitoring Node</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
};
