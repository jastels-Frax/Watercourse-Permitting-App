/* data.js — Crossing Assessor
   Data model, localStorage CRUD, auto-increment ID, and serialisation.
   No DOM access. Exposed as window.CA (namespace shared with app.js).
*/

'use strict';

(function () {

  // ── Storage key ──────────────────────────────────────────────────────────────
  const STORAGE_KEY = 'ca_records_v1';

  // ── Default record shape ─────────────────────────────────────────────────────
  // Every field the spec defines is present with a typed zero-value.
  // null  → numeric/nullable field not yet entered
  // ''    → string field not yet entered
  // false → boolean toggle defaulting to No
  // The four metadata fields (id, status, createdAt, updatedAt) are NOT
  // included here; createRecord() stamps them separately.

  const DEFAULTS = {

    // ── Crossing Identification ────────────────────────────────────────────────
    crossingId:  '',        // auto-suggested as CR-###
    projectId:   '',
    assessor:    '',
    date:        '',        // YYYY-MM-DD, set to today by createRecord()
    time:        '',        // HH:MM, set to now  by createRecord()
    lat:         null,      // decimal degrees
    lon:         null,      // decimal degrees
    watershed:   '',        // Salmon/Debert | Phillip/Wallace | Economy |
                            //   Tidnish/Shinimicas | Kelly/Maccan/Hebert |
                            //   Missaguash | Other
    priority:    '',        // P1 | P2 | P3
    sarPolygon:  false,
    notes:       '',

    // ── Section 1: Watercourse Confirmation ───────────────────────────────────
    // null = question not yet answered (distinct from false = explicitly No)
    watercoursePresent: null,

    // ── Section 2: Fish Habitat Assessment ────────────────────────────────────
    watershedArea:       null,   // km²; drives reach-distance guidance display
    depthContinuity:     '',     // Continuous | Intermittent | Ephemeral
    channelConnectivity: false,
    flowCondition:       '',     // No flow | Low flow | Moderate flow | High flow | Flood

    // Substrate composition — percentages that must sum to 100
    substrate: {
      bedrock:      null,
      boulder:      null,
      cobble:       null,
      gravel:       null,
      sand:         null,
      silt:         null,
      clay:         null,
      organic:      null,
      embeddedness: null,   // % embeddedness of coarse substrate; separate field
    },

    // Habitat features (multi-select checkboxes)
    hab: {
      pools:    false,
      riffles:  false,
      runs:     false,
      lwd:      false,      // large woody debris
      undercut: false,
      overhang: false,      // overhanging riparian vegetation
    },

    fishObserved:  false,
    fishSign:      false,   // carcasses, redds, scales, etc.
    reddsObserved: false,
    fishObsNotes:  '',

    // confirmed | likely | non-unsuitable | non-confirmed | undetermined
    fishBearing: '',

    // ── Section 3: Watercourse Geometry and Slope ─────────────────────────────
    bankfullWidth:    null,   // m
    wettedWidth:      null,   // m
    depthLeftBank:    null,   // m — left bank depth
    depthCentre:      null,   // m — centre (mid-channel) depth
    depthRightBank:   null,   // m — right bank depth
    depthThalweg:     null,   // m — thalweg (deepest point) depth
    bankHeight:       null,   // m
    dissolvedOxygen:  null,   // mg/L
    doSaturation:     null,   // % saturation
    conductivity:     null,   // µS/cm
    waterTemp:        null,   // °C
    ph:               null,   // 4.0–10.0
    watercourseSlope: null,   // % (measured in field)
    flowVelocity:     null,   // m/s
    velocityMethod:   '',     // Float method | Flow meter | Not measured

    // ── Section 4: Existing Crossing Condition ────────────────────────────────
    crossingPresent:       false,
    crossingStatus:        '',    // Existing – assess only | Existing – replacement proposed | New installation
    structureType:         '',   // Culvert – round | Culvert – pipe arch |
                                 //   Culvert – box | Bridge | Ford/causeway |
                                 //   Open bottom arch | Unknown | Other
    structureMaterial:     '',   // Corrugated metal | HDPE | Concrete | Wood |
                                 //   Unknown | Other
    numBarrels:            null,
    structureDiameter:     null, // m (diameter or span)
    outletDrop:            null, // m — barrier threshold > 0.15 m
    barrelCondition:       '',   // Good | Fair – minor damage |
                                 //   Poor – significant damage | Collapsed / failed
    blockage:              '',   // None | Partial | Severe | Complete
    dryBarrel:             false,
    structuralDamageNotes: '',
    fishPassageRating:     '',   // P | PB | FB

    // ── Section 5: Wetland Assessment ─────────────────────────────────────────
    wetlandPresent:         null,   // null = not yet answered; false = explicitly No; true = Yes
    wetlandConfirmed:       false,
    wetlandType:            '',   // Bog | Fen | Marsh | Swamp |
                                  //   Shallow open water | Unknown
    wespAc:                 false, // WESP-AC functional assessment completed
    wetlandConnectivity:    '',    // Directly connected | Adjacent/likely connected |
                                   //   No connection | Unknown
    hydrophilicVeg:         false,
    hydricSoils:            false,
    // Hydrological indicators — Primary (strong evidence)
    hydroWaterMarks:          false,
    hydroDriftLines:          false,
    hydroWaterloggedSoil:     false,
    hydroStandingWater:       false,
    // Hydrological indicators — Secondary (supporting evidence)
    hydroWaterStainedLeaves:  false,
    hydroOxidizedRhizospheres: false,
    hydroSedimentDeposits:    false,
    hydroAlgalMats:           false,
    hydroIronDeposits:        false,
    hydroDrainagePatterns:    false,
    hydroButtressedRoots:     false,
    hydroMossLines:           false,
    dominantVeg:            '',
    waaRequired:            '',    // no-mat | yes-road | yes-excavation | unknown
    wetlandNotes:           '',

    // ── Section 6: Photography Checklist ──────────────────────────────────────
    photosConfirmed: false,  // single accountability checkbox for 8 required shots
    photos: {
      // Additional (if applicable) — individually tracked
      fishSign: false,       // Fish or fish sign observed
      damage:   false,       // Structural damage or defects
      wetland:  false,       // Wetland conditions at abutment areas
      sar:      false,       // SAR species observed or suspected
    },

    // ── Section 7: Permitting Pathway ─────────────────────────────────────────
    nseccPathway: '',  // none | notification | approval | waa-wetland | tbd
    dfoPathway:   '',  // none | cop | rfr | rfr-sara | tbd
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
  // Scans all existing records for the pattern CR-### (case-insensitive,
  // any number of digits) and returns the next unused value padded to 3 digits.

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

  /**
   * createRecord(overrides?)
   * Returns a new, unsaved record object with all DEFAULTS applied,
   * metadata stamped (id, status, createdAt, updatedAt), Crossing ID
   * auto-suggested, and date/time set to now.
   * Pass overrides to pre-fill any fields (e.g. { assessor: 'Jane' }).
   */
  function createRecord(overrides = {}) {
    const records = loadRecords();
    const now = new Date().toISOString();

    // Deep-clone defaults so nested objects (substrate, hab, photos) are fresh
    const base = deepClone(DEFAULTS);

    return Object.assign(base, overrides, {
      id:         generateId(),
      status:     'draft',
      createdAt:  now,
      updatedAt:  now,
      crossingId: overrides.crossingId || nextCrossingId(records),
      date:       overrides.date || todayISO(),
      time:       overrides.time || nowTime(),
    });
  }

  /**
   * saveRecord(record)
   * Inserts a new record (unshift, so newest-first) or updates an
   * existing one. Always stamps updatedAt. Returns the stamped record.
   */
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

  /**
   * getRecord(id)
   * Returns the record with the given id, or undefined.
   */
  function getRecord(id) {
    return loadRecords().find(r => r.id === id);
  }

  /**
   * markComplete(id)
   * Sets status to 'complete' and saves. Returns the updated record.
   * Throws if the record is not found.
   */
  function markComplete(id) {
    const record = getRecord(id);
    if (!record) throw new Error(`markComplete: record not found (${id})`);
    return saveRecord({ ...record, status: 'complete' });
  }

  /**
   * deleteRecord(id)
   * Removes the record from storage. Returns true if found, false if not.
   */
  function deleteRecord(id) {
    const records = loadRecords();
    const filtered = records.filter(r => r.id !== id);
    if (filtered.length === records.length) return false;
    persistRecords(filtered);
    return true;
  }

  // ── Serialisation ─────────────────────────────────────────────────────────────

  /**
   * serializeRecord(record)
   * Flattens the nested record object into a single-level plain object
   * ready for CSV row generation or GeoJSON Feature properties.
   *
   * Key conventions:
   *   - All keys are snake_case
   *   - substrate.*  → substrate_<class>_pct
   *   - hab.*        → hab_<feature>
   *   - photos.*     → photo_<shot>
   *   - Numeric fields: number | null (exporters decide how to stringify null)
   *   - Boolean fields: true | false
   *   - String fields:  string (possibly '')
   */
  function serializeRecord(r) {
    return {
      // ── Metadata ─────────────────────────────────────────────────────────────
      record_id:  r.id,
      status:     r.status,
      created_at: r.createdAt,
      updated_at: r.updatedAt,

      // ── Crossing Identification ───────────────────────────────────────────────
      crossing_id:   r.crossingId,
      project_id:    r.projectId,
      assessor:      r.assessor,
      date:          r.date,
      time:          r.time,
      latitude:      r.lat,
      longitude:     r.lon,
      watershed:     r.watershed,
      priority_tier: r.priority,
      sar_polygon:   r.sarPolygon,
      notes:         r.notes,

      // ── Section 1 ─────────────────────────────────────────────────────────────
      watercourse_present: r.watercoursePresent,

      // ── Section 2 ─────────────────────────────────────────────────────────────
      watershed_area_km2:   r.watershedArea,
      depth_continuity:     r.depthContinuity,
      channel_connectivity: r.channelConnectivity,
      flow_condition:       r.flowCondition,

      // Substrate (each size class → own column)
      substrate_bedrock_pct:      r.substrate.bedrock,
      substrate_boulder_pct:      r.substrate.boulder,
      substrate_cobble_pct:       r.substrate.cobble,
      substrate_gravel_pct:       r.substrate.gravel,
      substrate_sand_pct:         r.substrate.sand,
      substrate_silt_pct:         r.substrate.silt,
      substrate_clay_pct:         r.substrate.clay,
      substrate_organic_pct:      r.substrate.organic,
      substrate_embeddedness_pct: r.substrate.embeddedness,

      // Habitat features
      hab_pools:    r.hab.pools,
      hab_riffles:  r.hab.riffles,
      hab_runs:     r.hab.runs,
      hab_lwd:      r.hab.lwd,
      hab_undercut: r.hab.undercut,
      hab_overhang: r.hab.overhang,

      // Fish observations
      fish_observed:           r.fishObserved,
      fish_sign_observed:      r.fishSign,
      spawning_redds_observed: r.reddsObserved,
      fish_observation_notes:  r.fishObsNotes,
      fish_bearing:            r.fishBearing,

      // ── Section 3 ─────────────────────────────────────────────────────────────
      bankfull_width_m:        r.bankfullWidth,
      wetted_width_m:          r.wettedWidth,
      depth_left_bank_m:       r.depthLeftBank,
      depth_centre_m:          r.depthCentre,
      depth_right_bank_m:      r.depthRightBank,
      depth_thalweg_m:         r.depthThalweg,
      bank_height_m:           r.bankHeight,
      dissolved_oxygen_mgl:    r.dissolvedOxygen,
      do_saturation_pct:       r.doSaturation,
      conductivity_us_cm:      r.conductivity,
      water_temp_c:            r.waterTemp,
      ph:                      r.ph,
      watercourse_slope_pct:   r.watercourseSlope,
      flow_velocity_ms:        r.flowVelocity,
      velocity_method:         r.velocityMethod,

      // ── Section 4 ─────────────────────────────────────────────────────────────
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

      // ── Section 5 ─────────────────────────────────────────────────────────────
      wetland_present:         r.wetlandPresent,
      wetland_confirmed:       r.wetlandConfirmed,
      wetland_type:            r.wetlandType,
      wesp_ac_completed:       r.wespAc,
      wetland_connectivity:    r.wetlandConnectivity,
      hydrophilic_veg:              r.hydrophilicVeg,
      hydric_soils:                 r.hydricSoils,
      hydro_water_marks:            r.hydroWaterMarks,
      hydro_drift_lines:            r.hydroDriftLines,
      hydro_waterlogged_soil:       r.hydroWaterloggedSoil,
      hydro_standing_water:         r.hydroStandingWater,
      hydro_water_stained_leaves:   r.hydroWaterStainedLeaves,
      hydro_oxidized_rhizospheres:  r.hydroOxidizedRhizospheres,
      hydro_sediment_deposits:      r.hydroSedimentDeposits,
      hydro_algal_mats:             r.hydroAlgalMats,
      hydro_iron_deposits:          r.hydroIronDeposits,
      hydro_drainage_patterns:      r.hydroDrainagePatterns,
      hydro_buttressed_roots:       r.hydroButtressedRoots,
      hydro_moss_lines:             r.hydroMossLines,
      dominant_vegetation:          r.dominantVeg,
      waa_required:            r.waaRequired,
      wetland_notes:           r.wetlandNotes,

      // ── Section 6: Photo checklist ───────────────────────────────────────────
      photos_confirmed: r.photosConfirmed,
      photo_fish_sign:  r.photos.fishSign,
      photo_damage:     r.photos.damage,
      photo_wetland:    r.photos.wetland,
      photo_sar:        r.photos.sar,

      // ── Section 7 ─────────────────────────────────────────────────────────────
      nsecc_pathway: r.nseccPathway,
      dfo_pathway:   r.dfoPathway,
    };
  }

  // ── Expose on window.CA ───────────────────────────────────────────────────────
  window.CA = Object.assign(window.CA || {}, {
    // Schema reference (read-only copy)
    DEFAULTS: Object.freeze(deepClone(DEFAULTS)),

    // CRUD
    createRecord,
    saveRecord,
    loadRecords,
    getRecord,
    markComplete,
    deleteRecord,

    // Helpers
    nextCrossingId,
    serializeRecord,
  });

}());
