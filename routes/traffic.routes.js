'use strict';
const express = require('express');
const router = express.Router();

const ZONE_DATA = {
  clear: [
    { zone: 'KORAMANGALA', zone_id: 'KGN-001', congestion_level: 'HIGH', congestion_percentage: 78, confidence_score: 96.2, time_saving_minutes: 18, ai_recommendation: 'Reroute via 80-ft Rd and Sony World Junction.', alternate_route: '80-FT RD BYPASS' },
    { zone: 'INDIRANAGAR', zone_id: 'IND-002', congestion_level: 'MODERATE', congestion_percentage: 52, confidence_score: 98.1, time_saving_minutes: 11, ai_recommendation: 'Minor delays on 100-ft Road. Use CMH Road bypass.', alternate_route: 'CMH RD ALT' },
    { zone: 'WHITEFIELD', zone_id: 'WTF-003', congestion_level: 'LOW', congestion_percentage: 24, confidence_score: 99.3, time_saving_minutes: 4, ai_recommendation: 'Clear conditions. Maintain current routes.', alternate_route: '—' },
    { zone: 'HSR LAYOUT', zone_id: 'HSR-004', congestion_level: 'CRITICAL', congestion_percentage: 92, confidence_score: 97.8, time_saving_minutes: 28, ai_recommendation: 'CRITICAL: Immediate reroute via Agara Lake Rd.', alternate_route: 'AGARA LAKE RD' },
    { zone: 'ELECTRONIC CITY', zone_id: 'ELC-005', congestion_level: 'HIGH', congestion_percentage: 71, confidence_score: 95.4, time_saving_minutes: 16, ai_recommendation: 'Hosur Rd saturated. Use NICE Rd exit.', alternate_route: 'NICE RD CORRIDOR' },
    { zone: 'MARATHAHALLI', zone_id: 'MRT-006', congestion_level: 'MODERATE', congestion_percentage: 58, confidence_score: 97.0, time_saving_minutes: 12, ai_recommendation: 'ORR moderate congestion. Pre-empt via KR Puram.', alternate_route: 'KR PURAM LINK' },
    { zone: 'SILK BOARD', zone_id: 'SLK-007', congestion_level: 'CRITICAL', congestion_percentage: 97, confidence_score: 99.9, time_saving_minutes: 34, ai_recommendation: 'CRITICAL: Avoid junction entirely. Use BTM bypass.', alternate_route: 'BTM LAYOUT BYPASS' },
    { zone: 'RAJAJINAGAR', zone_id: 'RJN-008', congestion_level: 'LOW', congestion_percentage: 31, confidence_score: 98.7, time_saving_minutes: 6, ai_recommendation: 'Western corridor clear. Standard routing optimal.', alternate_route: '—' },
  ],
  rain: [
    { zone: 'KORAMANGALA', zone_id: 'KGN-001', congestion_level: 'CRITICAL', congestion_percentage: 91, confidence_score: 95.1, time_saving_minutes: 26, ai_recommendation: 'Heavy rain reroute via 80-ft Rd.', alternate_route: '80-FT RD BYPASS' },
    { zone: 'INDIRANAGAR', zone_id: 'IND-002', congestion_level: 'HIGH', congestion_percentage: 74, confidence_score: 96.4, time_saving_minutes: 19, ai_recommendation: 'Rain delays — use CMH Road.', alternate_route: 'CMH RD ALT' },
    { zone: 'WHITEFIELD', zone_id: 'WTF-003', congestion_level: 'MODERATE', congestion_percentage: 55, confidence_score: 97.0, time_saving_minutes: 10, ai_recommendation: 'Moderate rain impact. Monitor ITPL road.', alternate_route: 'ITPL ROAD' },
    { zone: 'HSR LAYOUT', zone_id: 'HSR-004', congestion_level: 'CRITICAL', congestion_percentage: 97, confidence_score: 98.2, time_saving_minutes: 33, ai_recommendation: 'CRITICAL: Flooding risk. Avoid junction.', alternate_route: 'AGARA LAKE RD' },
    { zone: 'ELECTRONIC CITY', zone_id: 'ELC-005', congestion_level: 'CRITICAL', congestion_percentage: 89, confidence_score: 94.8, time_saving_minutes: 24, ai_recommendation: 'Hosur Rd flooded. NICE Rd mandatory.', alternate_route: 'NICE RD CORRIDOR' },
    { zone: 'MARATHAHALLI', zone_id: 'MRT-006', congestion_level: 'HIGH', congestion_percentage: 76, confidence_score: 96.1, time_saving_minutes: 18, ai_recommendation: 'ORR waterlogged. Use KR Puram flyover.', alternate_route: 'KR PURAM LINK' },
    { zone: 'SILK BOARD', zone_id: 'SLK-007', congestion_level: 'CRITICAL', congestion_percentage: 99, confidence_score: 99.9, time_saving_minutes: 40, ai_recommendation: 'CRITICAL: Complete gridlock. Full bypass activated.', alternate_route: 'BTM LAYOUT BYPASS' },
    { zone: 'RAJAJINAGAR', zone_id: 'RJN-008', congestion_level: 'MODERATE', congestion_percentage: 61, confidence_score: 97.2, time_saving_minutes: 13, ai_recommendation: 'Rain slowing traffic. Use Chord Rd.', alternate_route: 'CHORD RD' },
  ]
};

// copy rain data for heavy_rain with +10% congestion
ZONE_DATA.heavy_rain = ZONE_DATA.rain.map(z => ({
  ...z,
  congestion_percentage: Math.min(99, z.congestion_percentage + 10),
  congestion_level: z.congestion_percentage + 10 >= 90 ? 'CRITICAL' : z.congestion_level,
  time_saving_minutes: z.time_saving_minutes + 8
}));

// fog: moderate increase
ZONE_DATA.fog = ZONE_DATA.clear.map(z => ({
  ...z,
  congestion_percentage: Math.min(99, z.congestion_percentage + 15),
  confidence_score: z.confidence_score - 3.0,
  time_saving_minutes: z.time_saving_minutes + 5
}));

router.get('/traffic-predict', (req, res) => {
  const weather = req.query.weather || 'clear';
  const zones = (ZONE_DATA[weather] || ZONE_DATA.clear).map(z => ({
    ...z,
    timestamp: new Date().toISOString(),
    // add small random jitter so UI feels live
    congestion_percentage: Math.min(99, Math.max(5, z.congestion_percentage + Math.floor(Math.random() * 7 - 3))),
    confidence_score: +(z.confidence_score + (Math.random() * 1.4 - 0.7)).toFixed(1)
  }));
  res.json({ zones });
});

router.get('/traffic-predict/forecast', (req, res) => {
  const forecast = Array.from({ length: 12 }, (_, i) => ({
    hour: i * 2,
    label: `${String(i * 2).padStart(2, '0')}:00`,
    avg_congestion: Math.floor(30 + Math.random() * 55)
  }));
  res.json({ forecast });
});

module.exports = router;