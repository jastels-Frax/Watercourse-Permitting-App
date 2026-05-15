/* data.js — Crossing Assessor
   Data model, localStorage CRUD, auto-increment ID, and serialisation.
   No DOM access. Exposed as window.CA (namespace shared with app.js).
*/

'use strict';

(function () {

  const STORAGE_KEY = 'ca_records_v1';

  // ── Default shape for a single reach ────────────────────────────────────────
  function defaultReach(n) {
    return {
      reachId:    `R-${n}`,
      reachLabel: `Reach ${n}`,
      // Fish fields
      watershedArea:       null,
      depthContinuity:     '',
      channelConnectivity: false,
      flowCondition:       '',
      substrate: {
        bedrock: null, boulder: null, cobble: null, gravel: null,
        sand: null, silt: null, clay: null, organic: null, embeddedness: null,
      },
      hab: {
        pools: false, riffles: false, runs: false,
        lwd: false, undercut: false, overhang: false,
      },
      fishObserved:  false,
      fishSign:      false,
      reddsObserved: false,
      fishObsNotes:  '',
      fishBearing:   '',
      // Geo fields
      bankfullWidth:    null,
      wettedWidth:      null,
      depthLeftBank:    null,
      depthCentre:      null,
      depthRightBank:   null,
      depthThalweg:     null,
      bankHeight:       null,
      dissolvedOxygen:  null,
      doSaturation:     null,
      conductivity:     null,
      waterTemp:        null,
      ph:               null,
      watercourseSlope: null,
      flowVelocity:     null,
      velocityMethod:   '',
    };
  }

  // ── Default record shape ─────────────────────────────────────────────────────
  const DEFAULTS = {
    // ── Crossing Identification ────────────────────────────────────────────────
    crossingId:  '',
    projectId:   '',
    assessor:    '',
    date:        '',
    time:        '',
    lat:         null,
    lon:         null,
    watershedPrimary:   '',
    watershedSecondary: '',
    priority:    '',
    sarPolygon:  false,
    notes:       '',

    // ── Section 1: Watercourse Confirmation ───────────────────────────────────
    watercoursePresent: null,

    // ── Sections 2 & 3: Reach data (fish + geo, one object per reach) ─────────
    // createRecord() always populates this with [defaultReach(1)].
    reaches: [],

    // ── Section 4: Existing Crossing Condition ────────────────────────────────
    crossingPresent:       null,
    crossingStatus:        '',
    structureType:         '',
    structureMaterial:     '',
    numBarrels:            null,
    structureDiameter:     null,
    outletDrop:            null,
    barrelCondition:       '',
    blockage:              '',
    dryBarrel:             false,
    structuralDamageNotes: '',
    fishPassageRating:     '',

    // ── Section 5: Wetland Assessment ─────────────────────────────────────────
    wetlandPresent:          null,
    wetlandConfirmed:        false,
    wetlandType:             '',
    wespAc:                  false,
    wetlandConnectivity:     '',
    hydrophilicVeg:          false,
    hydricSoils:             false,
    hydroWaterMarks:           false,
    hydroDriftLines:           false,
    hydroWaterloggedSoil:      false,
    hydroStandingWater:        false,
    hydroWaterStainedLeaves:   false,
    hydroOxidizedRhizospheres: false,
    hydroSedimentDeposits:     false,
    hydroAlgalMats:            false,
    hydroIronDeposits:         false,
    hydroDrainagePatterns:     false,
    hydroButtressedRoots:      false,
    hydroMossLines:            false,
    dominantVeg:               '',
    waaRequired:               '',
    wetlandNotes:              '',

    // ── Section 6: Photography Checklist ──────────────────────────────────────
    photosConfirmed: false,
    photos: {
      fishSign: false,
      damage:   false,
      wetland:  false,
      sar:      false,
    },

    // ── Section 7: Permitting Pathway ─────────────────────────────────────────
    nseccPathway: '',
    dfoPathway:   '',
  };

  // ── Private utilities ────────────────────────────────────────────────────────

  function generateId() {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  }

  function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function todayISO() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function nowTime() {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }

  // ── localStorage helpers ─────────────────────────────────────────────────────

  function loadRecords() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  function persistRecords(records) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  }

  // ── Auto-increment Crossing ID ────────────────────────────────────────────────

  function nextCrossingId(records) {
    const nums = records
      .map(r => {
        const match = /^CR-(\d+)$/i.exec((r.crossingId || '').trim());
        return match ? parseInt(match[1], 10) : 0;
      })
      .filter(n => n > 0);
    const next = nums.length ? Math.max(...nums) + 1 : 1;
    return `CR-${String(next).padStart(3, '0')}`;
  }

  // ── Public API ────────────────────────────────────────────────────────────────

  function createRecord(overrides = {}) {
    const records = loadRecords();
    const now = new Date().toISOString();
    const base = deepClone(DEFAULTS);
    const record = Object.assign(base, overrides, {
      id:         generateId(),
      status:     'draft',
      createdAt:  now,
      updatedAt:  now,
      crossingId: overrides.crossingId || nextCrossingId(records),
      date:       overrides.date || todayISO(),
      time:       overrides.time || nowTime(),
    });
    if (!record.reaches || !record.reaches.length) {
      record.reaches = [defaultReach(1)];
    }
    return record;
  }

  function saveRecord(record) {
    const records = loadRecords();
    const stamped = Object.assign({}, record, { updatedAt: new Date().toISOString() });
    const idx = records.findIndex(r => r.id === stamped.id);
    if (idx === -1) {
      records.unshift(stamped);
    } else {
      records[idx] = stamped;
    }
    persistRecords(records);
    return stamped;
  }

  function getRecord(id) {
    return loadRecords().find(r => r.id === id);
  }

  function markComplete(id) {
    const record = getRecord(id);
    if (!record) throw new Error(`markComplete: record not found (${id})`);
    return saveRecord({ ...record, status: 'complete' });
  }

  function deleteRecord(id) {
    const records = loadRecords();
    const filtered = records.filter(r => r.id !== id);
    if (filtered.length === records.length) return false;
    persistRecords(filtered);
    return true;
  }

  // ── Serialisation ─────────────────────────────────────────────────────────────

  function serializeReach(reach) {
    const sub = reach.substrate || {};
    const hab = reach.hab       || {};
    return {
      reach_id:    reach.reachId,
      reach_label: reach.reachLabel,
      // Fish
      watershed_area_km2:         reach.watershedArea,
      depth_continuity:           reach.depthContinuity,
      channel_connectivity:       reach.channelConnectivity,
      flow_condition:             reach.flowCondition,
      substrate_bedrock_pct:      sub.bedrock,
      substrate_boulder_pct:      sub.boulder,
      substrate_cobble_pct:       sub.cobble,
      substrate_gravel_pct:       sub.gravel,
      substrate_sand_pct:         sub.sand,
      substrate_silt_pct:         sub.silt,
      substrate_clay_pct:         sub.clay,
      substrate_organic_pct:      sub.organic,
      substrate_embeddedness_pct: sub.embeddedness,
      hab_pools:    hab.pools,
      hab_riffles:  hab.riffles,
      hab_runs:     hab.runs,
      hab_lwd:      hab.lwd,
      hab_undercut: hab.undercut,
      hab_overhang: hab.overhang,
      fish_observed:           reach.fishObserved,
      fish_sign_observed:      reach.fishSign,
      spawning_redds_observed: reach.reddsObserved,
      fish_observation_notes:  reach.fishObsNotes,
      fish_bearing:            reach.fishBearing,
      // Geo
      bankfull_width_m:      reach.bankfullWidth,
      wetted_width_m:        reach.wettedWidth,
      depth_left_bank_m:     reach.depthLeftBank,
      depth_centre_m:        reach.depthCentre,
      depth_right_bank_m:    reach.depthRightBank,
      depth_thalweg_m:       reach.depthThalweg,
      bank_height_m:         reach.bankHeight,
      dissolved_oxygen_mgl:  reach.dissolvedOxygen,
      do_saturation_pct:     reach.doSaturation,
      conductivity_us_cm:    reach.conductivity,
      water_temp_c:          reach.waterTemp,
      ph:                    reach.ph,
      watercourse_slope_pct: reach.watercourseSlope,
      flow_velocity_ms:      reach.flowVelocity,
      velocity_method:       reach.velocityMethod,
    };
  }

  /**
   * serializeRecord(record)
   * Returns an array of flat row objects — one per reach.
   * Column order: crossing_id, reach_id, reach_label, [reach fields], [other crossing fields].
   */
  function serializeRecord(r) {
    const reaches = (r.reaches && r.reaches.length) ? r.reaches : [defaultReach(1)];
    const photos  = r.photos || {};

    const base = {
      record_id:   r.id,
      status:      r.status,
      created_at:  r.createdAt,
      updated_at:  r.updatedAt,
      project_id:  r.projectId,
      assessor:    r.assessor,
      date:        r.date,
      time:        r.time,
      latitude:    r.lat,
      longitude:   r.lon,
      watershed_primary:   r.watershedPrimary,
      watershed_secondary: r.watershedSecondary,
      priority_tier:       r.priority,
      sar_polygon:         r.sarPolygon,
      notes:               r.notes,
      watercourse_present: r.watercoursePresent,
      crossing_present:        r.crossingPresent,
      crossing_status:         r.crossingStatus,
      structure_type:          r.structureType,
      structure_material:      r.structureMaterial,
      num_barrels:             r.numBarrels,
      structure_diameter_m:    r.structureDiameter,
      outlet_drop_m:           r.outletDrop,
      barrel_condition:        r.barrelCondition,
      blockage:                r.blockage,
      dry_barrel:              r.dryBarrel,
      structural_damage_notes: r.structuralDamageNotes,
      fish_passage_rating:     r.fishPassageRating,
      wetland_present:             r.wetlandPresent,
      wetland_confirmed:           r.wetlandConfirmed,
      wetland_type:                r.wetlandType,
      wesp_ac_completed:           r.wespAc,
      wetland_connectivity:        r.wetlandConnectivity,
      hydrophilic_veg:             r.hydrophilicVeg,
      hydric_soils:                r.hydricSoils,
      hydro_water_marks:           r.hydroWaterMarks,
      hydro_drift_lines:           r.hydroDriftLines,
      hydro_waterlogged_soil:      r.hydroWaterloggedSoil,
      hydro_standing_water:        r.hydroStandingWater,
      hydro_water_stained_leaves:  r.hydroWaterStainedLeaves,
      hydro_oxidized_rhizospheres: r.hydroOxidizedRhizospheres,
      hydro_sediment_deposits:     r.hydroSedimentDeposits,
      hydro_algal_mats:            r.hydroAlgalMats,
      hydro_iron_deposits:         r.hydroIronDeposits,
      hydro_drainage_patterns:     r.hydroDrainagePatterns,
      hydro_buttressed_roots:      r.hydroButtressedRoots,
      hydro_moss_lines:            r.hydroMossLines,
      dominant_vegetation:         r.dominantVeg,
      waa_required:                r.waaRequired,
      wetland_notes:               r.wetlandNotes,
      photos_confirmed: r.photosConfirmed,
      photo_fish_sign:  photos.fishSign,
      photo_damage:     photos.damage,
      photo_wetland:    photos.wetland,
      photo_sar:        photos.sar,
      nsecc_pathway:    r.nseccPathway,
      dfo_pathway:      r.dfoPathway,
    };

    return reaches.map(reach => {
      const sr = serializeReach(reach);
      const { reach_id, reach_label, ...reachFields } = sr;
      return { crossing_id: r.crossingId, reach_id, reach_label, ...reachFields, ...base };
    });
  }

  /**
   * serializeForGeoJSON(record)
   * Returns the properties object for a GeoJSON Feature.
   * Non-reach fields are flat at the top level; reach data is in a reaches sub-array.
   */
  function serializeForGeoJSON(r) {
    const reaches = (r.reaches && r.reaches.length) ? r.reaches : [defaultReach(1)];
    const photos  = r.photos || {};
    return {
      record_id:   r.id,
      status:      r.status,
      created_at:  r.createdAt,
      updated_at:  r.updatedAt,
      crossing_id: r.crossingId,
      project_id:  r.projectId,
      assessor:    r.assessor,
      date:        r.date,
      time:        r.time,
      latitude:    r.lat,
      longitude:   r.lon,
      watershed_primary:   r.watershedPrimary,
      watershed_secondary: r.watershedSecondary,
      priority_tier:       r.priority,
      sar_polygon:         r.sarPolygon,
      notes:               r.notes,
      watercourse_present: r.watercoursePresent,
      crossing_present:        r.crossingPresent,
      crossing_status:         r.crossingStatus,
      structure_type:          r.structureType,
      structure_material:      r.structureMaterial,
      num_barrels:             r.numBarrels,
      structure_diameter_m:    r.structureDiameter,
      outlet_drop_m:           r.outletDrop,
      barrel_condition:        r.barrelCondition,
      blockage:                r.blockage,
      dry_barrel:              r.dryBarrel,
      structural_damage_notes: r.structuralDamageNotes,
      fish_passage_rating:     r.fishPassageRating,
      wetland_present:             r.wetlandPresent,
      wetland_confirmed:           r.wetlandConfirmed,
      wetland_type:                r.wetlandType,
      wesp_ac_completed:           r.wespAc,
      wetland_connectivity:        r.wetlandConnectivity,
      hydrophilic_veg:             r.hydrophilicVeg,
      hydric_soils:                r.hydricSoils,
      hydro_water_marks:           r.hydroWaterMarks,
      hydro_drift_lines:           r.hydroDriftLines,
      hydro_waterlogged_soil:      r.hydroWaterloggedSoil,
      hydro_standing_water:        r.hydroStandingWater,
      hydro_water_stained_leaves:  r.hydroWaterStainedLeaves,
      hydro_oxidized_rhizospheres: r.hydroOxidizedRhizospheres,
      hydro_sediment_deposits:     r.hydroSedimentDeposits,
      hydro_algal_mats:            r.hydroAlgalMats,
      hydro_iron_deposits:         r.hydroIronDeposits,
      hydro_drainage_patterns:     r.hydroDrainagePatterns,
      hydro_buttressed_roots:      r.hydroButtressedRoots,
      hydro_moss_lines:            r.hydroMossLines,
      dominant_vegetation:         r.dominantVeg,
      waa_required:                r.waaRequired,
      wetland_notes:               r.wetlandNotes,
      photos_confirmed: r.photosConfirmed,
      photo_fish_sign:  photos.fishSign,
      photo_damage:     photos.damage,
      photo_wetland:    photos.wetland,
      photo_sar:        photos.sar,
      nsecc_pathway:    r.nseccPathway,
      dfo_pathway:      r.dfoPathway,
      reaches:          reaches.map(serializeReach),
    };
  }

  // ── Expose on window.CA ───────────────────────────────────────────────────────
  window.CA = Object.assign(window.CA || {}, {
    DEFAULTS: Object.freeze(deepClone(DEFAULTS)),
    createRecord,
    saveRecord,
    loadRecords,
    getRecord,
    markComplete,
    deleteRecord,
    nextCrossingId,
    serializeRecord,
    serializeForGeoJSON,
    defaultReach,
  });

}());
