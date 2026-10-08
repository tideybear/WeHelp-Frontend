/** 简化中国地图 GeoJSON（ECharts registerMap 用） */
const chinaMap = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: {
        name: '北京',
      },
      geometry: {
        type: 'Point',
        coordinates: [116.4074, 39.9042],
      },
    },
    {
      type: 'Feature',
      properties: {
        name: '上海',
      },
      geometry: {
        type: 'Point',
        coordinates: [121.4737, 31.2304],
      },
    },
    // 其他省份数据...
  ],
} as const

export default chinaMap
