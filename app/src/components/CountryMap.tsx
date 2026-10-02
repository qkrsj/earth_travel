import { useMemo, useRef, useState } from 'react';
import { PanResponder, Platform, Pressable, StyleSheet, Text, View, type GestureResponderEvent } from 'react-native';
import Svg, { Circle, G, Path, Text as SvgText } from 'react-native-svg';
import { geoArea, geoCentroid, geoMercator, geoPath } from 'd3-geo';
import type { Feature, MultiPolygon, Polygon, Position } from 'geojson';
import { theme } from '../lib/colors';
import type { City, CountryCollection } from '../lib/types';

interface Props {
  shape: CountryCollection;
  cities: City[];
  /** cityId → 사용자가 지정한 색 */
  visited: Map<number, string>;
  selectedCityId: number | null;
  onSelectCity: (city: City) => void;
}

const MIN_K = 1;
const MAX_K = 12;

/**
 * 본토(가장 큰 폴리곤)와 비슷한 크기의 영토만 화면에 맞춤.
 * (예: 프랑스령 기아나, 하와이처럼 멀리 떨어진 작은 섬 때문에 본토가 너무 작아지는 것 방지)
 */
function focusGeometry(shape: CountryCollection): { focus: Feature<MultiPolygon>; center: [number, number] } {
  const polys: Position[][][] = [];
  for (const f of shape.features) {
    if (f.geometry.type === 'Polygon') polys.push((f.geometry as Polygon).coordinates);
    else if (f.geometry.type === 'MultiPolygon') polys.push(...(f.geometry as MultiPolygon).coordinates);
  }
  const areas = polys.map((p) => geoArea({ type: 'Polygon', coordinates: p }));
  const max = Math.max(...areas);
  const kept = polys.filter((_, i) => areas[i] >= max * 0.2);
  const biggest = polys[areas.indexOf(max)];
  const center = geoCentroid({ type: 'Polygon', coordinates: biggest }) as [number, number];
  return {
    focus: { type: 'Feature', properties: {}, geometry: { type: 'MultiPolygon', coordinates: kept } },
    center,
  };
}

export default function CountryMap({ shape, cities, visited, selectedCityId, onSelectCity }: Props) {
  const [width, setWidth] = useState(0);
  const height = Math.round(width * 0.9);
  const [view, setView] = useState({ k: 1, x: 0, y: 0 });
  const viewRef = useRef(view);
  viewRef.current = view;

  const projected = useMemo(() => {
    if (!width) return null;
    const { focus, center } = focusGeometry(shape);
    // 날짜변경선을 넘는 나라(러시아, 피지 등)도 한 덩어리로 보이도록 중심 경도로 회전
    const projection = geoMercator().rotate([-center[0], 0]).fitExtent([[16, 16], [width - 16, height - 16]], focus);
    const path = geoPath(projection);
    const d = shape.features.map((f) => path(f as never) ?? '').join(' ');
    const points = cities
      .map((c) => ({ city: c, p: projection([c.lng, c.lat]) }))
      .filter((x): x is { city: City; p: [number, number] } => !!x.p);
    return { d, points };
  }, [shape, cities, width, height]);

  // 드래그로 이동, 두 손가락으로 확대/축소
  const gesture = useRef({ startX: 0, startY: 0, startDist: 0, startK: 1 });
  const responder = useMemo(() => {
    const dist = (e: GestureResponderEvent) => {
      const t = e.nativeEvent.touches;
      return t.length >= 2 ? Math.hypot(t[0].pageX - t[1].pageX, t[0].pageY - t[1].pageY) : 0;
    };
    return PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 4 || Math.abs(g.dy) > 4,
      onPanResponderGrant: (e) => {
        gesture.current = { startX: viewRef.current.x, startY: viewRef.current.y, startDist: dist(e), startK: viewRef.current.k };
      },
      onPanResponderMove: (e, g) => {
        const s = gesture.current;
        const d = dist(e);
        if (d && s.startDist) {
          const k = Math.min(MAX_K, Math.max(MIN_K, (s.startK * d) / s.startDist));
          setView((v) => ({ ...v, k }));
        } else if (d && !s.startDist) {
          s.startDist = d;
          s.startK = viewRef.current.k;
        } else {
          setView((v) => ({ ...v, x: s.startX + g.dx, y: s.startY + g.dy }));
        }
      },
      onPanResponderTerminationRequest: () => false,
    });
  }, []);

  const zoom = (factor: number) => setView((v) => {
    const k = Math.min(MAX_K, Math.max(MIN_K, v.k * factor));
    // 화면 중앙을 기준으로 확대
    const cx = width / 2;
    const cy = height / 2;
    return { k, x: cx - ((cx - v.x) * k) / v.k, y: cy - ((cy - v.y) * k) / v.k };
  });

  const labelIds = useMemo(() => {
    const top = [...cities].sort((a, b) => b.population - a.population).slice(0, 6).map((c) => c.id);
    return new Set([...top, ...visited.keys()]);
  }, [cities, visited]);

  const k = view.k;
  return (
    <View style={styles.wrap} onLayout={(e) => setWidth(Math.round(e.nativeEvent.layout.width))}>
      {projected && (
        <View {...responder.panHandlers} style={{ height }}>
          <Svg width={width} height={height}>
            <G transform={`translate(${view.x} ${view.y}) scale(${k})`}>
              <Path d={projected.d} fill={theme.surfaceAlt} stroke="#5b6a96" strokeWidth={1 / k} />
              {projected.points.map(({ city, p }) => {
                const color = visited.get(city.id);
                const selected = city.id === selectedCityId;
                return (
                  <G key={city.id}>
                    <Circle
                      cx={p[0]} cy={p[1]}
                      r={(selected ? 8 : color ? 6 : 3.5) / k}
                      fill={color ?? '#8b93ad'}
                      fillOpacity={color ? 1 : 0.6}
                      stroke={selected ? '#fff' : color ? '#0b1020' : 'none'}
                      strokeWidth={(selected ? 2.5 : 1) / k}
                    />
                    {labelIds.has(city.id) || selected ? (
                      <SvgText
                        x={p[0] + 8 / k} y={p[1] + 4 / k}
                        fontSize={(selected ? 13 : 11) / k}
                        fontFamily={Platform.OS === 'web' ? 'system-ui, sans-serif' : undefined}
                        fontWeight={color || selected ? '700' : '400'}
                        fill={color || selected ? '#fff' : theme.textDim}
                      >
                        {city.name}
                      </SvgText>
                    ) : null}
                    {/* 손가락으로 누르기 쉽도록 큰 투명 터치 영역 */}
                    <Circle cx={p[0]} cy={p[1]} r={12 / k} fill="#000" fillOpacity={0.001} onPress={() => onSelectCity(city)} />
                  </G>
                );
              })}
            </G>
          </Svg>
          <View style={styles.zoom}>
            <Pressable style={styles.zoomBtn} onPress={() => zoom(1.6)}><Text style={styles.zoomText}>＋</Text></Pressable>
            <Pressable style={styles.zoomBtn} onPress={() => zoom(1 / 1.6)}><Text style={styles.zoomText}>－</Text></Pressable>
            <Pressable style={styles.zoomBtn} onPress={() => setView({ k: 1, x: 0, y: 0 })}><Text style={styles.zoomText}>⟲</Text></Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: '#0e1630', borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: theme.border },
  zoom: { position: 'absolute', right: 10, top: 10, gap: 6 },
  zoomBtn: {
    width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(21,27,47,0.9)',
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: theme.border,
  },
  zoomText: { color: theme.text, fontSize: 18, fontWeight: '700' },
});
