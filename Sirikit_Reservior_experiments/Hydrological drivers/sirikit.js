// =====================================================
// Sirikit — Basin7 (upstream) + Ring (local demand) exports
// Dates: 1987-12-12 to 2023-12-31 (end = 2024-01-01)
// Upstream ROI (basin7): CHIRPS precip + ERA5 soil L1/L2 (land-only)
// Local ROI (ring 3–15 km, land-only): ERA5 t2m_c + PET (demand proxy)
// =====================================================

// -------------------------------
// 0) Dam point
// -------------------------------
var lon = 100.5286;
var lat = 17.8078;
var damPoint = ee.Geometry.Point([lon, lat]);

Map.centerObject(damPoint, 8);
Map.addLayer(damPoint, {color:'red'}, 'Dam point');

// -------------------------------
// 1) Snap pour point using MERIT Hydro UPA
// -------------------------------
var upa = ee.Image('MERIT/Hydro/v1_0_1').select('upa');
var snapRadius = 5000;
var searchRegion = damPoint.buffer(snapRadius);

var samples = upa.sample({
  region: searchRegion,
  scale: 90,
  numPixels: 8000,
  geometries: true
});

var snappedFeature = ee.Feature(samples.sort('upa', false).first());
var snappedPoint = ee.Geometry.Point(snappedFeature.geometry().coordinates());

Map.addLayer(snappedPoint, {color:'yellow'}, 'Snapped point (max UPA)');
Map.addLayer(searchRegion, {color:'white'}, 'Snap radius');

// -------------------------------
// 2) HydroBASINS Level 7 basin (UPSTREAM ROI)
// -------------------------------
var basins7 = ee.FeatureCollection('WWF/HydroSHEDS/v1/Basins/hybas_7');
var basin7 = basins7.filterBounds(snappedPoint).first();
var roi_up = ee.Feature(basin7).geometry();

Map.addLayer(ee.Feature(basin7), {color:'00FF00', fillColor:'00FF0033'}, 'Basin level 7 (upstream)');
print("Basin7 area (km^2):", roi_up.area().divide(1e6));

// -------------------------------
// 3) Local demand ROI: 3–15 km land ring around dam point
// -------------------------------
var inner_m = 3000;
var outer_m = 15000;

var inner = damPoint.buffer(inner_m);
var outer = damPoint.buffer(outer_m);
var roi_ring = outer.difference(inner);

Map.addLayer(roi_ring, {color:'FF0000'}, 'Ring ROI (3–15 km)');

// -------------------------------
// 4) Land mask (avoid water pixels for soil/temp/PET)
// -------------------------------
var gsw = ee.Image('JRC/GSW1_4/GlobalSurfaceWater').select('occurrence');
var waterMask = gsw.gt(50);
var landMask  = waterMask.not();

// Optional visualize reservoir water near dam
Map.addLayer(waterMask.selfMask().clip(searchRegion), {palette:['66CCFF']}, 'Reservoir water (near dam)');

// -------------------------------
// 5) Date range
// -------------------------------
var start = ee.Date('1987-12-12');
var end   = ee.Date('2024-01-01'); // inclusive through 2023-12-31

// -------------------------------
// 6) CHIRPS precip (upstream)
// -------------------------------
var chirps = ee.ImageCollection('UCSB-CHG/CHIRPS/DAILY')
  .filterDate(start, end)
  .select('precipitation'); // mm/day

// -------------------------------
// 7) ERA5-LAND daily (soil + met)
// -------------------------------
var era5 = ee.ImageCollection('ECMWF/ERA5_LAND/DAILY_AGGR')
  .filterDate(start, end);

// Temp 2m (K -> C)
var t2m_c = era5.select('temperature_2m')
  .map(function(img){
    return img.subtract(273.15).rename('t2m_c')
      .copyProperties(img, ['system:time_start']);
  });

// PET proxy: potential_evaporation_sum (m/day, often negative) -> mm/day positive
// (This is "atmospheric demand" proxy; good for storage drawdown)
var pet_mm = era5.select('potential_evaporation_sum')
  .map(function(img){
    return img.multiply(-1000).rename('pet_mm')
      .copyProperties(img, ['system:time_start']);
  });

// Soil layers (m3/m3)
var soil_l1 = era5.select('volumetric_soil_water_layer_1')
  .map(function(img){
    return img.rename('soil_l1').copyProperties(img, ['system:time_start']);
  });

var soil_l2 = era5.select('volumetric_soil_water_layer_2')
  .map(function(img){
    return img.rename('soil_l2').copyProperties(img, ['system:time_start']);
  });


// =====================================================
// A) UPSTREAM export (basin7): CHIRPS precip + soil_l1 + soil_l2
// =====================================================

// For each CHIRPS day, attach soil (same day) from ERA5
var fc_upstream = ee.FeatureCollection(
  chirps.map(function(pImg){

    var date = ee.Date(pImg.get('system:time_start'));

    var s1Img = soil_l1.filterDate(date, date.advance(1,'day')).first();
    var s2Img = soil_l2.filterDate(date, date.advance(1,'day')).first();

    // Precip over upstream basin (include all pixels)
    var precip = pImg.reduceRegion({
      reducer: ee.Reducer.mean(),
      geometry: roi_up,
      scale: 5000,
      bestEffort: true,
      maxPixels: 1e13
    }).get('precipitation');

    // Soil over upstream basin (land-only)
    var s1 = ee.Algorithms.If(
      s1Img,
      ee.Image(s1Img).updateMask(landMask).reduceRegion({
        reducer: ee.Reducer.mean(),
        geometry: roi_up,
        scale: 9000,
        bestEffort: true,
        maxPixels: 1e13
      }).get('soil_l1'),
      null
    );

    var s2 = ee.Algorithms.If(
      s2Img,
      ee.Image(s2Img).updateMask(landMask).reduceRegion({
        reducer: ee.Reducer.mean(),
        geometry: roi_up,
        scale: 9000,
        bestEffort: true,
        maxPixels: 1e13
      }).get('soil_l2'),
      null
    );

    return ee.Feature(null, {
      date: date.format('YYYY-MM-dd'),
      precip_mm_up: precip,
      soil_l1_up: s1,
      soil_l2_up: s2
    });
  })
);

print('Upstream preview (basin7)', fc_upstream.limit(5));

Export.table.toDrive({
  collection: fc_upstream,
  description: 'Sirikit_basin7_upstream_CHIRPS_soil_daily_1987_2023',
  fileNamePrefix: 'Sirikit_basin7_upstream_CHIRPS_soil_daily_1987_2023',
  fileFormat: 'CSV'
});


// =====================================================
// B) LOCAL DEMAND export (ring 3–15 km land-only): t2m_c + pet_mm
// =====================================================

// Map over ERA5 days (t2m collection) and compute ring land-only mean
var fc_local = ee.FeatureCollection(
  t2m_c.map(function(tImg){

    var date = ee.Date(tImg.get('system:time_start'));
    var eImg = pet_mm.filterDate(date, date.advance(1,'day')).first();

    var tempC = ee.Image(tImg).updateMask(landMask).reduceRegion({
      reducer: ee.Reducer.mean(),
      geometry: roi_ring,
      scale: 9000,
      bestEffort: true,
      maxPixels: 1e13
    }).get('t2m_c');

    var pet = ee.Algorithms.If(
      eImg,
      ee.Image(eImg).updateMask(landMask).reduceRegion({
        reducer: ee.Reducer.mean(),
        geometry: roi_ring,
        scale: 9000,
        bestEffort: true,
        maxPixels: 1e13
      }).get('pet_mm'),
      null
    );

    return ee.Feature(null, {
      date: date.format('YYYY-MM-dd'),
      t2m_c_local: tempC,
      pet_mm_local: pet
    });
  })
);

print('Local demand preview (ring)', fc_local.limit(5));

Export.table.toDrive({
  collection: fc_local,
  description: 'Sirikit_ring3_15km_land_MET_daily_1987_2023',
  fileNamePrefix: 'Sirikit_ring3_15km_land_MET_daily_1987_2023',
  fileFormat: 'CSV'
});
