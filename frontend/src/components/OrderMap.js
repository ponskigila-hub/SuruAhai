import React from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

// Fix default marker icons not loading under bundlers like CRA/webpack.
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

const userIcon = new L.Icon({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  className: 'hue-rotate-user',
});

/**
 * Lightweight Leaflet map showing the user's location and one or more mitra markers.
 * Props:
 *  - userLocation: { lat, lng, address }
 *  - mitras: [{ id, name, location: { lat, lng }, distance_km }]
 *  - height: css height string
 */
const OrderMap = ({ userLocation, mitras = [], height = '320px' }) => {
  const points = [];
  if (userLocation?.lat != null && userLocation?.lng != null) {
    points.push([userLocation.lat, userLocation.lng]);
  }
  mitras.forEach((m) => {
    if (m.location?.lat != null && m.location?.lng != null) {
      points.push([m.location.lat, m.location.lng]);
    }
  });

  if (points.length === 0) {
    return (
      <div
        className="flex items-center justify-center rounded-xl bg-slate-100 text-sm text-slate-400"
        style={{ height }}
      >
        Lokasi belum tersedia untuk ditampilkan di peta.
      </div>
    );
  }

  const center = points[0];
  const bounds = points.length > 1 ? points : undefined;

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200" style={{ height }}>
      <MapContainer
        center={center}
        zoom={13}
        bounds={bounds}
        scrollWheelZoom={false}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {userLocation?.lat != null && userLocation?.lng != null && (
          <Marker position={[userLocation.lat, userLocation.lng]} icon={userIcon}>
            <Popup>Lokasi Anda{userLocation.address ? `: ${userLocation.address}` : ''}</Popup>
          </Marker>
        )}
        {mitras.map((m) =>
          m.location?.lat != null && m.location?.lng != null ? (
            <React.Fragment key={m.id}>
              <Marker position={[m.location.lat, m.location.lng]}>
                <Popup>
                  <strong>{m.name}</strong>
                  {m.distance_km != null && <div>{m.distance_km} km dari Anda</div>}
                </Popup>
              </Marker>
              {userLocation?.lat != null && (
                <Polyline
                  positions={[
                    [userLocation.lat, userLocation.lng],
                    [m.location.lat, m.location.lng],
                  ]}
                  pathOptions={{ color: '#FF7A00', weight: 2, dashArray: '6 8' }}
                />
              )}
            </React.Fragment>
          ) : null
        )}
      </MapContainer>
    </div>
  );
};

export default OrderMap;
