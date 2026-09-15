/**
 * Structured schedule data for the Legal Metrology (Packaged Commodities)
 * Rules, 2011.
 *
 * Every record is transcribed at provision level from the official published
 * Rules and carries `status: "needs_verification"` until a human reviewer has
 * compared it with the official document (see docs/legal-sources.md). Nothing
 * here quotes legislative wording; the records are machine-readable summaries
 * used only to decide applicability and to compute deterministic results.
 */

export type ScheduleStatus = "needs_verification" | "verified";

export type QuantityType = "weight" | "volume" | "length" | "area" | "number";

/* ------------------------------------------------------------------ */
/* First Schedule — Maximum Permissible Error (MPE)                    */
/* ------------------------------------------------------------------ */

export interface MpeBand {
  mpeId: string;
  quantityType: QuantityType;
  /** inclusive lower bound expressed in the base unit (g, ml, cm, cm², count) */
  lowerBound: number;
  /** exclusive upper bound, or null for "and above" */
  upperBound: number | null;
  /** percentage of declared quantity when mpeUnit === "percent" */
  mpeValue: number;
  mpeUnit: "percent" | "g" | "ml" | "cm" | "cm2" | "count";
  sourceReference: string;
  status: ScheduleStatus;
}

const FS = "First Schedule (see Rule 22)";

export const FIRST_SCHEDULE_MPE: MpeBand[] = [
  // Weight — base unit grams
  { mpeId: "FS-W-01", quantityType: "weight", lowerBound: 0, upperBound: 50, mpeValue: 9, mpeUnit: "percent", sourceReference: FS, status: "needs_verification" },
  { mpeId: "FS-W-02", quantityType: "weight", lowerBound: 50, upperBound: 100, mpeValue: 4.5, mpeUnit: "g", sourceReference: FS, status: "needs_verification" },
  { mpeId: "FS-W-03", quantityType: "weight", lowerBound: 100, upperBound: 200, mpeValue: 4.5, mpeUnit: "percent", sourceReference: FS, status: "needs_verification" },
  { mpeId: "FS-W-04", quantityType: "weight", lowerBound: 200, upperBound: 300, mpeValue: 9, mpeUnit: "g", sourceReference: FS, status: "needs_verification" },
  { mpeId: "FS-W-05", quantityType: "weight", lowerBound: 300, upperBound: 500, mpeValue: 3, mpeUnit: "percent", sourceReference: FS, status: "needs_verification" },
  { mpeId: "FS-W-06", quantityType: "weight", lowerBound: 500, upperBound: 1000, mpeValue: 15, mpeUnit: "g", sourceReference: FS, status: "needs_verification" },
  { mpeId: "FS-W-07", quantityType: "weight", lowerBound: 1000, upperBound: 10000, mpeValue: 1.5, mpeUnit: "percent", sourceReference: FS, status: "needs_verification" },
  { mpeId: "FS-W-08", quantityType: "weight", lowerBound: 10000, upperBound: 15000, mpeValue: 150, mpeUnit: "g", sourceReference: FS, status: "needs_verification" },
  { mpeId: "FS-W-09", quantityType: "weight", lowerBound: 15000, upperBound: null, mpeValue: 1, mpeUnit: "percent", sourceReference: FS, status: "needs_verification" },

  // Volume — base unit millilitres
  { mpeId: "FS-V-01", quantityType: "volume", lowerBound: 0, upperBound: 50, mpeValue: 9, mpeUnit: "percent", sourceReference: FS, status: "needs_verification" },
  { mpeId: "FS-V-02", quantityType: "volume", lowerBound: 50, upperBound: 100, mpeValue: 4.5, mpeUnit: "ml", sourceReference: FS, status: "needs_verification" },
  { mpeId: "FS-V-03", quantityType: "volume", lowerBound: 100, upperBound: 200, mpeValue: 4.5, mpeUnit: "percent", sourceReference: FS, status: "needs_verification" },
  { mpeId: "FS-V-04", quantityType: "volume", lowerBound: 200, upperBound: 300, mpeValue: 9, mpeUnit: "ml", sourceReference: FS, status: "needs_verification" },
  { mpeId: "FS-V-05", quantityType: "volume", lowerBound: 300, upperBound: 500, mpeValue: 3, mpeUnit: "percent", sourceReference: FS, status: "needs_verification" },
  { mpeId: "FS-V-06", quantityType: "volume", lowerBound: 500, upperBound: 1000, mpeValue: 15, mpeUnit: "ml", sourceReference: FS, status: "needs_verification" },
  { mpeId: "FS-V-07", quantityType: "volume", lowerBound: 1000, upperBound: 10000, mpeValue: 1.5, mpeUnit: "percent", sourceReference: FS, status: "needs_verification" },
  { mpeId: "FS-V-08", quantityType: "volume", lowerBound: 10000, upperBound: null, mpeValue: 1, mpeUnit: "percent", sourceReference: FS, status: "needs_verification" },

  // Length — base unit centimetres
  { mpeId: "FS-L-01", quantityType: "length", lowerBound: 0, upperBound: 500, mpeValue: 2, mpeUnit: "percent", sourceReference: FS, status: "needs_verification" },
  { mpeId: "FS-L-02", quantityType: "length", lowerBound: 500, upperBound: null, mpeValue: 1, mpeUnit: "percent", sourceReference: FS, status: "needs_verification" },

  // Area — base unit square centimetres
  { mpeId: "FS-A-01", quantityType: "area", lowerBound: 0, upperBound: null, mpeValue: 3, mpeUnit: "percent", sourceReference: FS, status: "needs_verification" },

  // Number — base unit count
  { mpeId: "FS-N-01", quantityType: "number", lowerBound: 0, upperBound: 50, mpeValue: 0, mpeUnit: "count", sourceReference: FS, status: "needs_verification" },
  { mpeId: "FS-N-02", quantityType: "number", lowerBound: 50, upperBound: null, mpeValue: 1, mpeUnit: "percent", sourceReference: FS, status: "needs_verification" },
];

export function mpeBandFor(quantityType: QuantityType, baseQuantity: number): MpeBand | null {
  return (
    FIRST_SCHEDULE_MPE.find(
      (b) =>
        b.quantityType === quantityType &&
        baseQuantity >= b.lowerBound &&
        (b.upperBound === null || baseQuantity < b.upperBound),
    ) ?? null
  );
}

/** Absolute permissible error in the base unit for a declared quantity. */
export function mpeAllowance(band: MpeBand, declaredBase: number): number {
  return band.mpeUnit === "percent" ? (declaredBase * band.mpeValue) / 100 : band.mpeValue;
}

/* ------------------------------------------------------------------ */
/* Second Schedule — standard package sizes                            */
/* ------------------------------------------------------------------ */

export interface StandardPack {
  standardPackId: string;
  commodity: string;
  commodityCategory: string;
  /** permitted quantities expressed in `unit` */
  permittedQuantity: number[];
  unit: "g" | "ml" | "kg" | "l" | "m" | "number";
  /** free-form multiples rule, e.g. "and multiples of 1 kg above 5 kg" */
  conditions: string | null;
  exceptions: string | null;
  sourceReference: string;
  status: ScheduleStatus;
  /** OCR/name matching keywords used to attach the provision to a product */
  keywords: string[];
}

const SS = "Second Schedule (see Rule 5)";

const pack = (
  id: string,
  commodity: string,
  category: string,
  permittedQuantity: number[],
  unit: StandardPack["unit"],
  keywords: string[],
  conditions: string | null = null,
  exceptions: string | null = null,
): StandardPack => ({
  standardPackId: id,
  commodity,
  commodityCategory: category,
  permittedQuantity,
  unit,
  conditions,
  exceptions,
  sourceReference: SS,
  status: "needs_verification",
  keywords,
});

export const SECOND_SCHEDULE_PACKS: StandardPack[] = [
  pack("SS-01", "Baby food", "Food", [50, 100, 200, 250, 500, 1000], "g", ["baby food", "infant food", "weaning food"], "Above 1 kg, in multiples of 1 kg."),
  pack("SS-02", "Weaning food / cereal-based infant food", "Food", [100, 200, 250, 500, 1000], "g", ["weaning", "infant cereal", "baby cereal"], "Above 1 kg, in multiples of 1 kg."),
  pack("SS-03", "Biscuits", "Food", [25, 50, 60, 75, 100, 120, 150, 200, 250, 300, 350, 400, 500, 600, 750, 1000], "g", ["biscuit", "cookie", "cracker"], "Above 1 kg, in multiples of 500 g."),
  pack("SS-04", "Bread (including brown bread)", "Food", [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000], "g", ["bread", "bun", "pav"], "Above 1 kg, in multiples of 100 g."),
  pack("SS-05", "Butter and margarine", "Food", [25, 50, 100, 200, 250, 500, 1000], "g", ["butter", "margarine"], "Above 1 kg, in multiples of 1 kg."),
  pack("SS-06", "Cereals and pulses", "Food", [100, 200, 500, 1000, 2000, 5000], "g", ["rice", "wheat", "atta", "flour", "dal", "pulse", "maida", "suji", "rava", "besan", "poha"], "Above 5 kg, in multiples of 5 kg."),
  pack("SS-07", "Coffee", "Food", [25, 50, 100, 200, 250, 500, 1000], "g", ["coffee"], "Above 1 kg, in multiples of 1 kg."),
  pack("SS-08", "Tea", "Food", [25, 50, 100, 250, 500, 750, 1000], "g", ["tea", "chai", "green tea"], "Above 1 kg, in multiples of 1 kg."),
  pack("SS-09", "Edible oils, vanaspati and ghee", "Food", [50, 100, 200, 250, 500, 1000, 2000, 3000, 5000], "ml", ["edible oil", "sunflower oil", "mustard oil", "groundnut oil", "vanaspati", "ghee", "refined oil", "olive oil"], "Above 5 l, in multiples of 5 l.", "Sold by weight where the commodity is declared by weight."),
  pack("SS-10", "Milk powder", "Food", [100, 200, 250, 500, 1000], "g", ["milk powder", "dairy whitener", "skimmed milk powder"], "Above 1 kg, in multiples of 1 kg."),
  pack("SS-11", "Salt", "Food", [100, 200, 500, 1000, 2000, 5000], "g", ["salt", "iodised salt"], "Above 5 kg, in multiples of 5 kg."),
  pack("SS-12", "Sugar", "Food", [100, 200, 500, 1000, 2000, 5000], "g", ["sugar"], "Above 5 kg, in multiples of 5 kg."),
  pack("SS-13", "Aerated soft drinks and non-alcoholic beverages", "Beverage", [65, 100, 125, 150, 200, 250, 300, 500, 750, 1000, 1500, 2000, 2250, 2500], "ml", ["soft drink", "aerated", "cola", "carbonated", "beverage", "juice", "nectar"], "Above 2.5 l, in multiples of 500 ml."),
  pack("SS-14", "Packaged drinking water and mineral water", "Beverage", [100, 150, 200, 250, 300, 500, 750, 1000, 1500, 2000, 5000, 20000], "ml", ["drinking water", "mineral water", "packaged water"], null),
  pack("SS-15", "Detergents (powder and cake)", "Household", [50, 100, 150, 200, 250, 500, 1000], "g", ["detergent", "washing powder", "washing cake"], "Above 1 kg, in multiples of 500 g."),
  pack("SS-16", "Soap (toilet and laundry)", "Household", [25, 50, 75, 100, 125, 150], "g", ["soap", "bathing bar", "toilet soap"], "Above 150 g, in multiples of 25 g."),
  pack("SS-17", "Paints, varnishes and allied products", "Industrial", [50, 100, 200, 500, 1000, 2000, 4000, 5000, 10000, 20000], "ml", ["paint", "varnish", "enamel", "primer", "distemper"], "Above 20 l, in multiples of 5 l."),
  pack("SS-18", "Cement in bags", "Construction", [50], "kg", ["cement"], "Other sizes only where specifically permitted.", "Bulk supply to industrial consumers."),
  pack("SS-19", "Rice bran oil and cooking media in rigid containers", "Food", [500, 1000, 2000, 5000], "ml", ["rice bran oil", "cooking medium"], null),
  pack("SS-20", "Toothpaste / tooth powder", "Personal care", [25, 50, 75, 100, 150, 200, 300], "g", ["toothpaste", "tooth powder", "dental cream"], "Above 300 g, in multiples of 50 g."),
];

export function standardPackFor(productText: string): StandardPack | null {
  const hay = productText.toLowerCase();
  let best: StandardPack | null = null;
  let bestLen = 0;
  for (const p of SECOND_SCHEDULE_PACKS) {
    for (const k of p.keywords) {
      if (hay.includes(k) && k.length > bestLen) {
        best = p;
        bestLen = k.length;
      }
    }
  }
  return best;
}

/* ------------------------------------------------------------------ */
/* Third Schedule — "when packed" conditions                           */
/* ------------------------------------------------------------------ */

export interface WhenPackedCondition {
  conditionId: string;
  commodity: string;
  condition: string;
  requiredTreatment: string;
  sourceReference: string;
  status: ScheduleStatus;
  keywords: string[];
}

const TS = "Third Schedule (see Rule 11)";

const wp = (
  id: string,
  commodity: string,
  condition: string,
  requiredTreatment: string,
  keywords: string[],
): WhenPackedCondition => ({
  conditionId: id,
  commodity,
  condition,
  requiredTreatment,
  sourceReference: TS,
  status: "needs_verification",
  keywords,
});

export const THIRD_SCHEDULE_WHEN_PACKED: WhenPackedCondition[] = [
  wp("TS-01", "Commodities liable to lose weight by evaporation or drying", "Net quantity is the quantity at the time of packing.", "Declare net quantity at the time of packing; deficiency assessment must allow for permitted variation.", ["biscuit", "bread", "bakery", "namkeen", "wafer"]),
  wp("TS-02", "Commodities packed in liquid medium", "Drained weight is required in addition to net weight.", "Declare both net weight and drained weight of the solid contents.", ["in brine", "in syrup", "canned", "pickle", "in oil"]),
  wp("TS-03", "Frozen and chilled commodities", "Net quantity is the quantity of the frozen commodity excluding glaze.", "Declare net quantity excluding glazing water.", ["frozen", "iqf", "chilled"]),
  wp("TS-04", "Aerosol and pressurised packages", "Net quantity refers to the contents excluding the propellant container.", "Declare net contents; state propellant separately where required.", ["aerosol", "spray can", "pressurised"]),
  wp("TS-05", "Hygroscopic commodities", "Moisture gain or loss after packing is recognised.", "Declare net quantity at the time of packing and record ambient conditions at inspection.", ["salt", "sugar", "detergent powder", "milk powder"]),
  wp("TS-06", "Cement and similar bagged commodities", "Net weight determined at the time of packing.", "Declare weight at packing; lot sampling applies at inspection.", ["cement", "fertilizer", "fertiliser"]),
];

export function whenPackedConditionsFor(productText: string): WhenPackedCondition[] {
  const hay = productText.toLowerCase();
  return THIRD_SCHEDULE_WHEN_PACKED.filter((c) => c.keywords.some((k) => hay.includes(k)));
}

/* ------------------------------------------------------------------ */
/* Fourth Schedule — required quantity type by commodity               */
/* ------------------------------------------------------------------ */

export interface QuantityTypeRule {
  quantityTypeId: string;
  commodity: string;
  requiredQuantityType: QuantityType;
  allowedUnits: string[];
  additionalRequirement: string | null;
  conditions: string | null;
  sourceReference: string;
  status: ScheduleStatus;
  keywords: string[];
}

const FoS = "Fourth Schedule (see Rule 12)";

const qt = (
  id: string,
  commodity: string,
  requiredQuantityType: QuantityType,
  allowedUnits: string[],
  keywords: string[],
  additionalRequirement: string | null = null,
  conditions: string | null = null,
): QuantityTypeRule => ({
  quantityTypeId: id,
  commodity,
  requiredQuantityType,
  allowedUnits,
  additionalRequirement,
  conditions,
  sourceReference: FoS,
  status: "needs_verification",
  keywords,
});

export const FOURTH_SCHEDULE_QUANTITY_TYPES: QuantityTypeRule[] = [
  qt("QT-01", "Aerosol", "weight", ["g", "kg"], ["aerosol", "spray can"], "Net contents by weight; volume may be declared additionally."),
  qt("QT-02", "Acids", "weight", ["g", "kg"], ["acid", "hydrochloric", "sulphuric", "nitric"]),
  qt("QT-03", "Compressed or liquefied gas", "weight", ["g", "kg"], ["compressed gas", "liquefied gas", "cylinder gas"], "Declare tare and gross weight where applicable."),
  qt("QT-04", "Liquefied petroleum gas (LPG)", "weight", ["kg"], ["lpg", "liquefied petroleum"], "Declare net weight of gas and tare weight of the cylinder."),
  qt("QT-05", "Curd, yoghurt and dahi", "weight", ["g", "kg"], ["curd", "dahi", "yoghurt", "yogurt"]),
  qt("QT-06", "Cables", "length", ["m", "cm"], ["cable"], "Declare length; conductor size where required."),
  qt("QT-07", "Electric wire", "length", ["m"], ["electric wire", "wire coil", "house wire"]),
  qt("QT-08", "Fencing wire", "weight", ["kg"], ["fencing wire", "barbed wire"], "Length may be declared additionally."),
  qt("QT-09", "Fresh fruits and vegetables", "weight", ["g", "kg"], ["fresh fruit", "vegetable", "fruits"], "May be sold by number where customarily so sold."),
  qt("QT-10", "Furnace oil", "volume", ["l", "ml"], ["furnace oil"]),
  qt("QT-11", "Edible oil", "volume", ["ml", "l"], ["edible oil", "refined oil", "mustard oil", "sunflower oil", "groundnut oil", "olive oil"], "Weight declaration permitted where the commodity is customarily sold by weight."),
  qt("QT-12", "Nails, screws and similar fasteners", "weight", ["g", "kg"], ["nail", "screw", "bolt", "rivet"], "Number may be declared additionally."),
  qt("QT-13", "Paints, varnishes and enamels", "volume", ["ml", "l"], ["paint", "varnish", "enamel", "primer"], "Weight declaration permitted for products customarily sold by weight."),
  qt("QT-14", "Readymade garments", "number", ["number", "pieces"], ["garment", "shirt", "trouser", "t-shirt", "kurta", "saree", "apparel"], "Declare size/dimension as required."),
  qt("QT-15", "Sauces, ketchup and similar semi-liquid foods", "weight", ["g", "kg"], ["sauce", "ketchup", "puree", "paste"], "Volume may be declared additionally."),
  qt("QT-16", "Tyres and tubes", "number", ["number"], ["tyre", "tube", "tire"], "Declare size designation."),
  qt("QT-17", "Yarn", "length", ["m"], ["yarn", "thread"], "Weight may be declared additionally."),
  qt("QT-18", "Cosmetics (liquid)", "volume", ["ml", "l"], ["lotion", "shampoo", "conditioner", "toner", "perfume", "serum"]),
  qt("QT-19", "Cosmetics (solid / semi-solid)", "weight", ["g", "kg"], ["cream", "balm", "lipstick", "talc", "powder", "wax"]),
  qt("QT-20", "Soap and detergent cake", "weight", ["g", "kg"], ["soap", "detergent cake", "bathing bar"]),
  qt("QT-21", "Cement", "weight", ["kg"], ["cement"]),
  qt("QT-22", "Fertilizer", "weight", ["kg"], ["fertilizer", "fertiliser", "urea"]),
  qt("QT-23", "Beverages and packaged water", "volume", ["ml", "l"], ["water", "soft drink", "juice", "beverage", "cola"]),
  qt("QT-24", "Tea and coffee", "weight", ["g", "kg"], ["tea", "coffee"]),
  qt("QT-25", "Biscuits, bread and bakery products", "weight", ["g", "kg"], ["biscuit", "bread", "cookie", "cake", "rusk"]),
  qt("QT-26", "Sheets, films and foils sold as sheets", "number", ["number"], ["sheet", "foil sheet", "tissue"], "Declare dimensions of each sheet."),
  qt("QT-27", "Floor coverings and fabric sold by length", "length", ["m"], ["fabric", "carpet", "floor covering", "cloth"], "Declare width."),
  qt("QT-28", "Paper (sold by area)", "area", ["m2", "cm2"], ["paper ream", "chart paper"], "Number of sheets and dimensions may also be required."),
];

export function quantityTypeRuleFor(productText: string): QuantityTypeRule | null {
  const hay = productText.toLowerCase();
  let best: QuantityTypeRule | null = null;
  let bestLen = 0;
  for (const r of FOURTH_SCHEDULE_QUANTITY_TYPES) {
    for (const k of r.keywords) {
      if (hay.includes(k) && k.length > bestLen) {
        best = r;
        bestLen = k.length;
      }
    }
  }
  return best;
}

/* ------------------------------------------------------------------ */
/* Fifth and Sixth Schedules — physical inspection sampling            */
/* ------------------------------------------------------------------ */

export interface InspectionSamplingRow {
  samplingId: string;
  /** inclusive lot-size lower bound */
  lotFrom: number;
  /** inclusive lot-size upper bound, null for "and above" */
  lotTo: number | null;
  sampleSize: number;
  /** permitted number of non-conforming packages in the sample */
  acceptanceNumber: number;
  sourceReference: string;
  status: ScheduleStatus;
}

export const INSPECTION_SAMPLING: InspectionSamplingRow[] = [
  { samplingId: "SS5-01", lotFrom: 1, lotTo: 50, sampleSize: 3, acceptanceNumber: 0, sourceReference: "Fifth Schedule (see Rule 19)", status: "needs_verification" },
  { samplingId: "SS5-02", lotFrom: 51, lotTo: 150, sampleSize: 5, acceptanceNumber: 0, sourceReference: "Fifth Schedule (see Rule 19)", status: "needs_verification" },
  { samplingId: "SS5-03", lotFrom: 151, lotTo: 4000, sampleSize: 8, acceptanceNumber: 1, sourceReference: "Fifth Schedule (see Rule 19)", status: "needs_verification" },
  { samplingId: "SS5-04", lotFrom: 4001, lotTo: null, sampleSize: 13, acceptanceNumber: 1, sourceReference: "Sixth Schedule (see Rule 19)", status: "needs_verification" },
];

export function samplingForLot(lotSize: number): InspectionSamplingRow | null {
  return (
    INSPECTION_SAMPLING.find(
      (r) => lotSize >= r.lotFrom && (r.lotTo === null || lotSize <= r.lotTo),
    ) ?? null
  );
}
