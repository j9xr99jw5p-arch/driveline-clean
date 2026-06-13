export type FitmentRisk = "low" | "medium" | "high";
export type PlanKey = "free" | "builder";

export type VerifiedBuild = {
  id: string;
  year: number;
  make: string;
  model: string;
  trim: string | null;
  cab: string | null;
  bed: string | null;
  tire_size: string;
  tire_brand?: string | null;
  tire_model?: string | null;
  wheel_size: string | null;
  wheel_brand?: string | null;
  wheel_model?: string | null;
  wheel_width?: number | null;
  wheel_diameter?: number | null;
  wheel_offset: number | null;
  lift_height: number | null;
  suspension_setup: string | null;
  suspension_brand?: string | null;
  suspension_model?: string | null;
  suspension_type?: string | null;
  rubbing_severity: string | null;
  trimming_required: boolean | null;
  body_mount_chop: boolean | null;
  fitment_risk: FitmentRisk;
  notes: string | null;
  owner_name: string | null;
  source_url: string | null;
  published: boolean;
  verified_build_photos?: VerifiedBuildPhoto[];
};

export type VerifiedBuildPhoto = {
  id: string;
  build_id: string;
  url: string;
  alt_text: string | null;
  sort_order: number;
};

export type FitmentInput = {
  year: number;
  trim: string;
  cab: string;
  bed: string;
  currentTireSize?: string;
  tireSize: string;
  wheelDiameter: number;
  wheelWidth: number;
  wheelOffset: number;
  liftHeight: number;
  useCase: string;
  rearLoad: string;
  buildGoals?: string;
};

export type FitmentReport = {
  verdict: string;
  rubbingRisk: FitmentRisk;
  trimmingLikely: boolean;
  bodyMountChopLikely: boolean;
  suspensionStress: "low" | "moderate" | "high";
  dailyDrivability: "easy" | "acceptable" | "compromised";
  offRoadPracticality: "limited" | "balanced" | "strong";
  explanation: string;
  warnings: string[];
  recommendations: string[];
  aiExplanation?: FitmentAiReport | null;
};

export type FitmentAiReport = {
  headline: string;
  overviewAdvice: string;
  dailyDrivingAdvice: string;
  offRoadAdvice: string;
  beforeYouCommit: string;
  disclaimer: string;
};

export type StoredFitmentResult = {
  input: FitmentInput;
  report: FitmentReport;
  createdAt: string;
};

export type VehicleConfiguration = {
  id: string;
  vehicleId: string;
  tireSize: string;
  wheelDiameter: number;
  wheelWidth: number;
  wheelOffset: number;
  liftHeight: number;
  useCase: string;
  rearLoad: string;
  buildGoals?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type GarageVehicle = {
  id: string;
  userId: string;
  year: number;
  make: string;
  model: string;
  trim: string;
  cab: string;
  bed: string;
  currentTireSize?: string | null;
  createdAt?: string;
  updatedAt?: string;
  configurations: VehicleConfiguration[];
};
