import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type ReactNode
} from "react";
import { Link } from "react-router-dom";

type IconProps = { className?: string };

function SvgIcon({ className = "", children }: IconProps & { children: ReactNode }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={24}
      height={24}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

const ArrowRight = ({ className }: IconProps) => (
  <SvgIcon className={className}>
    <path d="M5 12h14" />
    <path d="m12 5 7 7-7 7" />
  </SvgIcon>
);

const ArrowUpRight = ({ className }: IconProps) => (
  <SvgIcon className={className}>
    <path d="M7 7h10v10" />
    <path d="M7 17 17 7" />
  </SvgIcon>
);

const Building2 = ({ className }: IconProps) => (
  <SvgIcon className={className}>
    <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z" />
    <path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" />
    <path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2" />
    <path d="M10 6h4" />
    <path d="M10 10h4" />
    <path d="M10 14h4" />
    <path d="M10 18h4" />
  </SvgIcon>
);

const Check = ({ className }: IconProps) => (
  <SvgIcon className={className}>
    <path d="M20 6 9 17l-5-5" />
  </SvgIcon>
);

const ChevronRight = ({ className }: IconProps) => (
  <SvgIcon className={className}>
    <path d="m9 18 6-6-6-6" />
  </SvgIcon>
);

const CircleCheck = ({ className }: IconProps) => (
  <SvgIcon className={className}>
    <circle cx="12" cy="12" r="10" />
    <path d="m9 12 2 2 4-4" />
  </SvgIcon>
);

const Clock = ({ className }: IconProps) => (
  <SvgIcon className={className}>
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </SvgIcon>
);

const Compass = ({ className }: IconProps) => (
  <SvgIcon className={className}>
    <path d="m16.24 7.76-1.804 5.411a2 2 0 0 1-1.265 1.265L7.76 16.24l1.804-5.411a2 2 0 0 1 1.265-1.265z" />
    <circle cx="12" cy="12" r="10" />
  </SvgIcon>
);

const Cpu = ({ className }: IconProps) => (
  <SvgIcon className={className}>
    <path d="M12 20v2" />
    <path d="M12 2v2" />
    <path d="M17 20v2" />
    <path d="M17 2v2" />
    <path d="M2 12h2" />
    <path d="M2 17h2" />
    <path d="M2 7h2" />
    <path d="M20 12h2" />
    <path d="M20 17h2" />
    <path d="M20 7h2" />
    <path d="M7 20v2" />
    <path d="M7 2v2" />
    <rect x="4" y="4" width="16" height="16" rx="2" />
    <rect x="8" y="8" width="8" height="8" rx="1" />
  </SvgIcon>
);

const FileText = ({ className }: IconProps) => (
  <SvgIcon className={className}>
    <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
    <path d="M14 2v4a2 2 0 0 0 2 2h4" />
    <path d="M10 9H8" />
    <path d="M16 13H8" />
    <path d="M16 17H8" />
  </SvgIcon>
);

const GitBranch = ({ className }: IconProps) => (
  <SvgIcon className={className}>
    <line x1="6" x2="6" y1="3" y2="15" />
    <circle cx="18" cy="6" r="3" />
    <circle cx="6" cy="18" r="3" />
    <path d="M18 9a9 9 0 0 1-9 9" />
  </SvgIcon>
);

const GitCommitHorizontal = ({ className }: IconProps) => (
  <SvgIcon className={className}>
    <circle cx="12" cy="12" r="3" />
    <line x1="3" x2="9" y1="12" y2="12" />
    <line x1="15" x2="21" y1="12" y2="12" />
  </SvgIcon>
);

const History = ({ className }: IconProps) => (
  <SvgIcon className={className}>
    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
    <path d="M3 3v5h5" />
    <path d="M12 7v5l4 2" />
  </SvgIcon>
);

const IndianRupee = ({ className }: IconProps) => (
  <SvgIcon className={className}>
    <path d="M6 3h12" />
    <path d="M6 8h12" />
    <path d="m6 13 8.5 8" />
    <path d="M6 13h3" />
    <path d="M9 13c6.667 0 6.667-10 0-10" />
  </SvgIcon>
);

const Info = ({ className }: IconProps) => (
  <SvgIcon className={className}>
    <circle cx="12" cy="12" r="10" />
    <path d="M12 16v-4" />
    <path d="M12 8h.01" />
  </SvgIcon>
);

const Lock = ({ className }: IconProps) => (
  <SvgIcon className={className}>
    <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </SvgIcon>
);

const Menu = ({ className }: IconProps) => (
  <SvgIcon className={className}>
    <path d="M4 12h16" />
    <path d="M4 18h16" />
    <path d="M4 6h16" />
  </SvgIcon>
);

const RotateCcw = ({ className }: IconProps) => (
  <SvgIcon className={className}>
    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
    <path d="M3 3v5h5" />
  </SvgIcon>
);

const Scale = ({ className }: IconProps) => (
  <SvgIcon className={className}>
    <path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" />
    <path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" />
    <path d="M7 21h10" />
    <path d="M12 3v18" />
    <path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2" />
  </SvgIcon>
);

const ShieldCheck = ({ className }: IconProps) => (
  <SvgIcon className={className}>
    <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
    <path d="m9 12 2 2 4-4" />
  </SvgIcon>
);

const SlidersVertical = ({ className }: IconProps) => (
  <SvgIcon className={className}>
    <line x1="4" x2="4" y1="21" y2="14" />
    <line x1="4" x2="4" y1="10" y2="3" />
    <line x1="12" x2="12" y1="21" y2="12" />
    <line x1="12" x2="12" y1="8" y2="3" />
    <line x1="20" x2="20" y1="21" y2="16" />
    <line x1="20" x2="20" y1="12" y2="3" />
    <line x1="2" x2="6" y1="14" y2="14" />
    <line x1="10" x2="14" y1="8" y2="8" />
    <line x1="18" x2="22" y1="16" y2="16" />
  </SvgIcon>
);

const Sparkles = ({ className }: IconProps) => (
  <SvgIcon className={className}>
    <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
    <path d="M20 3v4" />
    <path d="M22 5h-4" />
    <path d="M4 17v2" />
    <path d="M5 18H3" />
  </SvgIcon>
);

const TriangleAlert = ({ className }: IconProps) => (
  <SvgIcon className={className}>
    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
    <path d="M12 9v4" />
    <path d="M12 17h.01" />
  </SvgIcon>
);

const Users = ({ className }: IconProps) => (
  <SvgIcon className={className}>
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <path d="M16 3.128a4 4 0 0 1 0 7.744" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
    <circle cx="9" cy="7" r="4" />
  </SvgIcon>
);

const X = ({ className }: IconProps) => (
  <SvgIcon className={className}>
    <path d="M18 6 6 18" />
    <path d="m6 6 12 12" />
  </SvgIcon>
);

type VisualVariant =
  | "hero-toast"
  | "courtyard-dinner"
  | "tablescape-detail"
  | "celebration-dance"
  | "architectural-venue"
  | "closing-lanterns";

const VISUALS: Record<
  VisualVariant,
  { src: string; bgGradient: string; accentColor: string }
> = {
  "hero-toast": {
    src: "/images/hero-toast.jpg",
    bgGradient: "from-[#1B1614] via-[#2D211C] to-[#12100E]",
    accentColor: "#C85A32"
  },
  "courtyard-dinner": {
    src: "/images/courtyard-dinner.jpg",
    bgGradient: "from-[#181512] via-[#2C221E] to-[#141210]",
    accentColor: "#D49B54"
  },
  "tablescape-detail": {
    src: "/images/tablescape-detail.jpg",
    bgGradient: "from-[#2A211B] via-[#3D2E25] to-[#1A1614]",
    accentColor: "#5F6F5E"
  },
  "celebration-dance": {
    src: "/images/celebration-dance.jpg",
    bgGradient: "from-[#1E1715] via-[#33241F] to-[#12100E]",
    accentColor: "#C85A32"
  },
  "architectural-venue": {
    src: "/images/architectural-venue.jpg",
    bgGradient: "from-[#191A17] via-[#282B24] to-[#121311]",
    accentColor: "#D49B54"
  },
  "closing-lanterns": {
    src: "/images/closing-lanterns.jpg",
    bgGradient: "from-[#1A1412] via-[#2E1F1A] to-[#0E0D0C]",
    accentColor: "#C85A32"
  }
};

type EditorialVisualProps = {
  variant?: VisualVariant;
  alt: string;
  className?: string;
  aspectRatio?: string;
  priority?: boolean;
  caption?: { title: string; meta: string };
  badge?: string;
};

function EditorialVisual({
  variant = "hero-toast",
  alt,
  className = "",
  aspectRatio = "aspect-[16/10]",
  priority = false,
  caption,
  badge
}: EditorialVisualProps) {
  const [imgError, setImgError] = useState(false);
  const config = VISUALS[variant];

  return (
    <figure
      className={`relative overflow-hidden bg-gradient-to-br ${config.bgGradient} ${aspectRatio} ${className} select-none group`}
    >
      <svg
        viewBox="0 0 800 500"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="absolute inset-0 w-full h-full object-cover opacity-45"
        aria-hidden="true"
      >
        <defs>
          <radialGradient id={`glow-${variant}`} cx="50%" cy="40%" r="60%">
            <stop offset="0%" stopColor={config.accentColor} stopOpacity="0.38" />
            <stop offset="60%" stopColor="#D49B54" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#12100E" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="800" height="500" fill={`url(#glow-${variant})`} />
        <path
          d="M140 500 V220 C140 130 260 130 260 220 V500"
          stroke="#FAF6F0"
          strokeOpacity="0.14"
          strokeWidth="1.5"
        />
        <path
          d="M310 500 V170 C310 60 490 60 490 170 V500"
          stroke="#D49B54"
          strokeOpacity="0.22"
          strokeWidth="1.5"
        />
        <path
          d="M540 500 V220 C540 130 660 130 660 220 V500"
          stroke="#FAF6F0"
          strokeOpacity="0.14"
          strokeWidth="1.5"
        />
        <circle cx="400" cy="150" r="4" fill="#F5D08A" fillOpacity="0.8" />
        <circle cx="365" cy="185" r="2.5" fill="#F5D08A" fillOpacity="0.6" />
        <circle cx="435" cy="185" r="2.5" fill="#F5D08A" fillOpacity="0.6" />
        <circle cx="200" cy="210" r="3" fill="#F5D08A" fillOpacity="0.5" />
        <circle cx="600" cy="210" r="3" fill="#F5D08A" fillOpacity="0.5" />
        <line x1="400" y1="0" x2="400" y2="150" stroke="#D49B54" strokeOpacity="0.3" />
        <line x1="200" y1="0" x2="200" y2="210" stroke="#FAF6F0" strokeOpacity="0.15" />
        <line x1="600" y1="0" x2="600" y2="210" stroke="#FAF6F0" strokeOpacity="0.15" />
      </svg>
      {!imgError && (
        <img
          src={config.src}
          alt={alt}
          width={1400}
          height={900}
          loading={priority ? "eager" : "lazy"}
          onError={() => setImgError(true)}
          className="relative z-10 w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
        />
      )}
      <div
        className="pointer-events-none absolute inset-0 z-20 bg-gradient-to-t from-[#12100E]/85 via-[#12100E]/25 to-transparent"
        aria-hidden="true"
      />
      {badge && (
        <div className="absolute top-4 left-4 z-30 inline-flex items-center gap-2 rounded-full bg-[#12100E]/80 backdrop-blur-md border border-[#FAF6F0]/15 px-3.5 py-1.5 text-[11px] uppercase tracking-[0.16em] text-[#FAF6F0]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#C85A32]" />
          {badge}
        </div>
      )}
      {caption && (
        <figcaption className="absolute bottom-4 left-4 right-4 z-30 flex items-end justify-between gap-4 text-xs text-[#FAF6F0]/85">
          <span className="font-serif italic text-sm text-[#FAF6F0]">
            {caption.title}
          </span>
          <span className="font-mono text-[11px] uppercase tracking-wider text-[#D49B54]">
            {caption.meta}
          </span>
        </figcaption>
      )}
    </figure>
  );
}

function BotanicalMotif({ className = "", flip = false }: { className?: string; flip?: boolean }) {
  return (
    <svg
      viewBox="0 0 180 260"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`${className} ${flip ? "scale-x-[-1]" : ""}`}
      aria-hidden="true"
    >
      <path
        d="M20 240 C45 180, 65 110, 145 25"
        stroke="#5F6F5E"
        strokeWidth="1.5"
        strokeOpacity="0.45"
        strokeLinecap="round"
      />
      <path
        d="M52 175 C32 152, 34 128, 66 135 C58 158, 48 168, 52 175 Z"
        fill="#5F6F5E"
        fillOpacity="0.22"
        stroke="#5F6F5E"
        strokeWidth="1.2"
        strokeOpacity="0.5"
      />
      <path
        d="M78 130 C105 118, 120 132, 92 152 C82 145, 78 136, 78 130 Z"
        fill="#5F6F5E"
        fillOpacity="0.18"
        stroke="#5F6F5E"
        strokeWidth="1.2"
        strokeOpacity="0.5"
      />
      <path
        d="M95 92 C72 70, 78 46, 108 58 C104 75, 98 85, 95 92 Z"
        fill="#C85A32"
        fillOpacity="0.2"
        stroke="#C85A32"
        strokeWidth="1.2"
        strokeOpacity="0.55"
      />
      <circle cx="145" cy="25" r="7" fill="#C85A32" fillOpacity="0.3" />
      <circle cx="145" cy="25" r="3" fill="#C85A32" />
      <circle cx="38" cy="205" r="4" fill="#D49B54" fillOpacity="0.6" />
    </svg>
  );
}

type VenueKey = "courtyard" | "palace";
type CateringKey = "editorial" | "royal";

type VenueConfig = {
  id: VenueKey;
  name: string;
  maxSeatedCapacity: number;
  maxFloatingCapacity: number;
  baseRental: number;
  overflowSwitchCost: number;
  overflowVenueName: string;
};

type CateringTier = {
  id: CateringKey;
  label: string;
  perPlateCost: number;
  serviceStaffRatio: number;
  prepHoursPer20Guests: number;
};

const VENUE_CONFIGS: Record<VenueKey, VenueConfig> = {
  courtyard: {
    id: "courtyard",
    name: "The Sandstone Courtyard",
    maxSeatedCapacity: 220,
    maxFloatingCapacity: 300,
    baseRental: 68e4,
    overflowSwitchCost: 32e4,
    overflowVenueName: "Grand Durbar Lawn"
  },
  palace: {
    id: "palace",
    name: "Sheesh Mahal Pavilion",
    maxSeatedCapacity: 190,
    maxFloatingCapacity: 260,
    baseRental: 89e4,
    overflowSwitchCost: 41e4,
    overflowVenueName: "Royal Charbagh Terrace"
  }
};

const CATERING_TIERS: Record<CateringKey, CateringTier> = {
  editorial: {
    id: "editorial",
    label: "Regional Tasting & Craft Cocktails",
    perPlateCost: 4200,
    serviceStaffRatio: 8,
    prepHoursPer20Guests: 0.9
  },
  royal: {
    id: "royal",
    label: "Multi-Course Silver Thali & Sommelier Bar",
    perPlateCost: 5600,
    serviceStaffRatio: 6,
    prepHoursPer20Guests: 1.2
  }
};

type Alternative = {
  id: string;
  code: string;
  title: string;
  tag: string;
  totalCost: number;
  deltaFromBaseline: number;
  feasibilityScore: number;
  venueAction: string;
  timelineImpact: string;
  vendorConsequence: string;
  tradeoffSummary: string;
};

type SimulationResult = {
  baselineGuests: number;
  updatedGuests: number;
  guestDelta: number;
  guestDeltaPct: number;
  venue: VenueConfig;
  catering: CateringTier;
  baselineTotal: number;
  updatedRawTotal: number;
  budgetDelta: number;
  budgetDeltaPct: number;
  capacityExceeded: boolean;
  additionalTables: number;
  extraPrepHours: number;
  extraStaff: number;
  alternatives: Alternative[];
};

function runDeterministicSimulation({
  baselineGuests = 180,
  updatedGuests = 240,
  venueKey = "courtyard",
  cateringKey = "editorial"
}: {
  baselineGuests?: number;
  updatedGuests?: number;
  venueKey?: VenueKey;
  cateringKey?: CateringKey;
}): SimulationResult {
  const venue = VENUE_CONFIGS[venueKey];
  const catering = CATERING_TIERS[cateringKey];
  const guestDelta = updatedGuests - baselineGuests;
  const guestDeltaPct = Math.round((guestDelta / baselineGuests) * 1e3) / 10;
  const baseCatering = baselineGuests * catering.perPlateCost;
  const baseTables = Math.ceil(baselineGuests / 10);
  const baseFloralAndDecor = 48e4 + baseTables * 14500;
  const baseProductionAndSound = 32e4;
  const baseContingency = 212e3;
  const baselineTotal =
    venue.baseRental + baseCatering + baseFloralAndDecor + baseProductionAndSound + baseContingency;
  const capacityExceeded = updatedGuests > venue.maxSeatedCapacity;
  const updatedVenueCost = capacityExceeded
    ? venue.baseRental + venue.overflowSwitchCost
    : venue.baseRental;
  const updatedCatering = updatedGuests * catering.perPlateCost;
  const updatedTables = Math.ceil(updatedGuests / 10);
  const additionalTables = updatedTables - baseTables;
  const updatedFloralAndDecor = 48e4 + updatedTables * 14500 + (capacityExceeded ? 95e3 : 0);
  const updatedProductionAndSound = baseProductionAndSound + (capacityExceeded ? 65e3 : 0);
  const updatedContingency = baseContingency + Math.max(0, guestDelta * 450);
  const updatedRawTotal =
    updatedVenueCost +
    updatedCatering +
    updatedFloralAndDecor +
    updatedProductionAndSound +
    updatedContingency;
  const budgetDelta = updatedRawTotal - baselineTotal;
  const budgetDeltaPct = Math.round((budgetDelta / baselineTotal) * 1e3) / 10;
  const extraPrepHours =
    Math.round(Math.max(0, guestDelta / 20) * catering.prepHoursPer20Guests * 10) / 10;
  const extraStaff = Math.ceil(Math.max(0, guestDelta) / catering.serviceStaffRatio);

  const alternatives: Alternative[] = [
    {
      id: "plan-a",
      code: "PROPOSAL A",
      title: capacityExceeded
        ? `Migrate Reception to ${venue.overflowVenueName}`
        : "Retain Full Seated Layout & Absorb Guest Delta",
      tag: "Zero Aesthetic Compromise",
      totalCost: updatedRawTotal,
      deltaFromBaseline: budgetDelta,
      feasibilityScore: 98,
      venueAction: capacityExceeded
        ? `Reallocate Sangeet & Dinner to ${venue.overflowVenueName} (capacity 380 seated)`
        : `Keep ${venue.name} with ${updatedTables} banquet tables`,
      timelineImpact: `+${extraPrepHours} hrs kitchen & rigging lead time; bar load-in shifts to 11:00 AM`,
      vendorConsequence: `Add ${additionalTables} ten-seater tables, ${additionalTables} botanical centerpieces & +${extraStaff} hospitality staff`,
      tradeoffSummary:
        "Preserves full seated silver-service experience for every additional guest; requires budget expansion approval."
    },
    {
      id: "plan-b",
      code: "PROPOSAL B",
      title: "Hybrid Seated Lounge + Floating Tapas Architecture",
      tag: "Recommended Balance",
      totalCost: baselineTotal + Math.round(budgetDelta * 0.44),
      deltaFromBaseline: Math.round(budgetDelta * 0.44),
      feasibilityScore: 95,
      venueAction: `Retain ${venue.name} (${venue.maxFloatingCapacity} pax floating limit verified)`,
      timelineImpact: "+1.0 hr acoustic soundcheck; zero venue zone migration required",
      vendorConsequence: `Convert 6 perimeter tables to high-top grazing stations; save ₹${formatLakhs(venue.overflowSwitchCost)} in lawn transition costs`,
      tradeoffSummary:
        "Eliminates venue overflow surcharge while keeping intimate courtyard acoustics and reducing floral table count."
    },
    {
      id: "plan-c",
      code: "PROPOSAL C",
      title: "Cap-Protected Menu & Botanical Re-allocation",
      tag: "Strict Budget Guardrail",
      totalCost: baselineTotal + Math.round(budgetDelta * 0.17),
      deltaFromBaseline: Math.round(budgetDelta * 0.17),
      feasibilityScore: 91,
      venueAction: `Retain ${venue.name} with high-density长-table Tuscan banquet layout`,
      timelineImpact: "No schedule shift; vendor setup window remains 14:00–18:30",
      vendorConsequence:
        "Shift floral architecture from individual table domes to suspended marigold & jasmine canopy (-₹1.85L decor offset)",
      tradeoffSummary:
        "Accommodates all guests within ~5% of original baseline budget by consolidating linear banquet seating and floral rigging."
    }
  ];

  return {
    baselineGuests,
    updatedGuests,
    guestDelta,
    guestDeltaPct,
    venue,
    catering,
    baselineTotal,
    updatedRawTotal,
    budgetDelta,
    budgetDeltaPct,
    capacityExceeded,
    additionalTables,
    extraPrepHours,
    extraStaff,
    alternatives
  };
}

function formatINR(amount: number) {
  const sign = amount < 0 ? "-" : "";
  const abs = Math.abs(Math.round(amount));
  return `${sign}₹${abs.toLocaleString("en-IN")}`;
}

function formatLakhs(amount: number) {
  const lakhs = (Math.abs(amount) / 1e5).toFixed(2);
  return `${lakhs}L`;
}

const PROBLEM_TRIGGERS = {
  "guest-surge": {
    label: "Guest List +60",
    subtitle: "Extended family RSVPs arrive 18 days before the Sangeet",
    triggerBadge: "180 → 240 Guests",
    impacts: [
      {
        domain: "Venue Capacity",
        severity: "Critical Threshold",
        detail:
          "Sandstone Courtyard caps at 220 seated guests. Adding 60 guests forces either a lawn relocation or a hybrid lounge floorplan."
      },
      {
        domain: "Catering & Bar",
        severity: "+₹2.52L Direct Delta",
        detail:
          "Requires +8 hospitality staff, +2.7 hours kitchen prep lead time, and 18% additional glassware & ice inventory."
      },
      {
        domain: "Tablescape & Floral",
        severity: "+6 Banquet Tables",
        detail:
          "Six additional 10-seater tables require 6 bespoke brass floral centerpieces and 60 hand-calligraphed place cards."
      },
      {
        domain: "Run-of-Show Timeline",
        severity: "+35 Min Buffer",
        detail:
          "Valet arrival wave and welcome thali service must open 35 minutes earlier to prevent courtyard bottleneck."
      }
    ]
  },
  "weather-shift": {
    label: "Unseasonal Rain Forecast",
    subtitle: "40% precipitation alert during outdoor Haldi & Mehendi window",
    triggerBadge: "Outdoor → Covered Pavilion",
    impacts: [
      {
        domain: "Spatial Architecture",
        severity: "Zone Re-mapping",
        detail:
          "Poolside marigold mandap must shift under the colonnade verandah with waterproof acousticdraping."
      },
      {
        domain: "AV & Lighting Rig",
        severity: "+4 Hrs Rigging Lead",
        detail:
          "Truss-mounted warm wash lights replace open-air festoon strings; generator grounding check required."
      },
      {
        domain: "Vendor Contracts",
        severity: "+₹1.40L Weather Tenting",
        detail:
          "Activates standby transparent German hanger canopy clause before the 48-hour vendor lock deadline."
      },
      {
        domain: "Guest Comfort",
        severity: "Zero Disruption",
        detail:
          "Automated WhatsApp itinerary update queued only after host approves the revised rain-safe floorplan."
      }
    ]
  },
  "quote-revision": {
    label: "Vendor Quote +22%",
    subtitle: "Decor studio submits revised production quote after site recce",
    triggerBadge: "+₹3.80L Quote Variance",
    impacts: [
      {
        domain: "Budget Guardrail",
        severity: "Exceeds Decor Cap",
        detail:
          "Pushes total celebration outlay 8.4% above approved family ceiling unless offset across adjacent categories."
      },
      {
        domain: "Material Substitution",
        severity: "3 Feasible Swaps",
        detail:
          "Engine identifies local terracotta & woven cane structures that preserve 94% of visual mood at -₹2.60L."
      },
      {
        domain: "Payment Milestones",
        severity: "Tranche #2 Hold",
        detail:
          "Locks second 40% vendor disbursement until revised line-item diff is reviewed and explicitly approved."
      },
      {
        domain: "Audit Trail",
        severity: "Diff Preserved",
        detail:
          "Original vs. revised BOM line items stored side-by-side in revision history so nothing changes silently."
      }
    ]
  }
} as const;

type ProblemTriggerKey = keyof typeof PROBLEM_TRIGGERS;

const WORKFLOW_STEPS = [
  {
    step: "01",
    title: "Create Baseline Event",
    subtitle: "Venues, ceremonies, guest tiers & budget caps",
    desc: "Establish your multi-day celebration structure—Mehendi, Sangeet, Wedding, Reception—with baseline guest counts, venue capacity limits, and target category allocations."
  },
  {
    step: "02",
    title: "Change Any Constraint",
    subtitle: "Guest count, date window, or vendor quote",
    desc: "Input real-world changes as they happen: +60 family RSVPs, a revised catering per-plate quote, or an outdoor-to-indoor monsoon shift."
  },
  {
    step: "03",
    title: "Simulate Cascading Impacts",
    subtitle: "Deterministic cross-category propagation",
    desc: "The engine computes exact downstream effects across per-plate catering, table counts, floral centerpieces, staffing ratios, and setup lead times."
  },
  {
    step: "04",
    title: "Compare Feasible Alternatives",
    subtitle: "Side-by-side architectural trade-offs",
    desc: "Instead of a single broken budget, review synthesized proposals—such as expanding to a larger lawn vs. converting to a hybrid lounge layout."
  },
  {
    step: "05",
    title: "Approve a Proposal",
    subtitle: "Explicit host & planner sign-off",
    desc: "Stage your preferred alternative, inspect the line-item diff against your current plan, and approve only when every stakeholder agrees."
  },
  {
    step: "06",
    title: "Preserve Revision History",
    subtitle: "Full audit trail & instant rollback",
    desc: "Every approved change is saved as an immutable versioned snapshot (v1.0, v1.1, v1.2) with rationale notes and one-click rollback."
  }
];

const CAPABILITY_ITEMS: Array<{
  icon: ComponentType<IconProps>;
  title: string;
  status: string;
  isLive: boolean;
  desc: string;
}> = [
  {
    icon: IndianRupee,
    title: "Coupled Budget Architecture",
    status: "Available in Engine",
    isLive: true,
    desc: "Links fixed venue retainers, per-guest culinary tiers, table-scaled decor, and contingency buffers so changes propagate accurately."
  },
  {
    icon: Users,
    title: "Guest & Household Cohorts",
    status: "Available in Engine",
    isLive: true,
    desc: "Model RSVP probability waves across ceremonies (Haldi, Sangeet, Reception) and test +15% or +30% attendance surges effortlessly."
  },
  {
    icon: Clock,
    title: "Adaptive Run-of-Show Timelines",
    status: "Available in Engine",
    isLive: true,
    desc: "Automatically calculates kitchen prep lead-time extensions, soundcheck buffers, and load-in shifts when headcount or venues change."
  },
  {
    icon: FileText,
    title: "Vendor Quote Normalization",
    status: "Available in Engine",
    isLive: true,
    desc: "Compare revised vendor quotes against baseline estimates with clear line-item variance flags before approving scope changes."
  },
  {
    icon: SlidersVertical,
    title: "Deterministic Impact Simulation",
    status: "Available in Engine",
    isLive: true,
    desc: "Sandbox any constraint change without touching your saved master plan until you explicitly approve a synthesized proposal."
  },
  {
    icon: History,
    title: "Immutable Revision History",
    status: "Available in Engine",
    isLive: true,
    desc: "Complete version log recording who approved each change, what constraints shifted, and the exact budget delta at each milestone."
  },
  {
    icon: Sparkles,
    title: "Automated PDF Spec & Vendor Dispatch",
    status: "Planned Capability",
    isLive: false,
    desc: "One-click generation of updated banquet event orders (BEOs) and vendor call sheets upon proposal approval."
  },
  {
    icon: Scale,
    title: "Multi-Currency & GST Tax Splits",
    status: "Available in Engine",
    isLive: true,
    desc: "Deterministic breakdown of hospitality GST slabs, venue service charges, and milestone tranche schedules."
  }
];

type Revision = {
  rev: string;
  timestamp: string;
  author: string;
  constraintChange: string;
  proposalChosen: string;
  budgetBefore: number;
  budgetAfter: number;
  delta: string;
  status: string;
  notes: string;
};

const INITIAL_REVISIONS: Revision[] = [
  {
    rev: "v1.2",
    timestamp: "Today, 11:42 AM",
    author: "Aarav & Meera (Host)",
    constraintChange: "Guest Count 180 → 240 (+60 pax)",
    proposalChosen: "Proposal B: Hybrid Seated Lounge + Floating Tapas",
    budgetBefore: 245e4,
    budgetAfter: 2745e3,
    delta: "+₹2,95,000",
    status: "APPROVED",
    notes: "Retained Sandstone Courtyard; avoided ₹3.20L lawn expansion surcharge."
  },
  {
    rev: "v1.1",
    timestamp: "Yesterday, 06:15 PM",
    author: "Studio Kaveri (Planner)",
    constraintChange: "Sangeet Floral Quote +14% (Imported Orchids Unavailable)",
    proposalChosen: "Local Mysore Jasmine & Terracotta Urn Substitution",
    budgetBefore: 2485e3,
    budgetAfter: 245e4,
    delta: "-₹35,000",
    status: "APPROVED",
    notes: "Reduced cold-chain freight lead time by 18 hours."
  },
  {
    rev: "v1.0",
    timestamp: "14 Oct, 09:30 AM",
    author: "System Baseline",
    constraintChange: "Initial Event Architecture Created (180 Guests, 3 Days)",
    proposalChosen: "Baseline Master Plan Locked",
    budgetBefore: 2485e3,
    budgetAfter: 2485e3,
    delta: "₹0",
    status: "BASELINE",
    notes: "Udaipur Heritage Haveli • 3-day celebration schedule initialized."
  }
];

export default function Landing() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeWorkspaceModal, setActiveWorkspaceModal] = useState<
    "planner-route" | "architecture-docs" | null
  >(null);
  const [selectedTrigger, setSelectedTrigger] = useState<ProblemTriggerKey>("guest-surge");
  const [baselineGuests] = useState(180);
  const [updatedGuests, setUpdatedGuests] = useState(240);
  const [venueKey, setVenueKey] = useState<VenueKey>("courtyard");
  const [cateringKey, setCateringKey] = useState<CateringKey>("editorial");
  const [selectedPlanId, setSelectedPlanId] = useState("plan-b");
  const [approvalStatus, setApprovalStatus] = useState("pending_review");
  const [revisionHistory, setRevisionHistory] = useState<Revision[]>(INITIAL_REVISIONS);
  const [selectedRevisionIndex, setSelectedRevisionIndex] = useState(0);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const modalCloseRef = useRef<HTMLButtonElement>(null);

  const simulation = useMemo(
    () =>
      runDeterministicSimulation({
        baselineGuests,
        updatedGuests,
        venueKey,
        cateringKey
      }),
    [baselineGuests, updatedGuests, venueKey, cateringKey]
  );

  const activeAlternative =
    simulation.alternatives.find((a) => a.id === selectedPlanId) || simulation.alternatives[1];

  const handleApproveProposal = () => {
    setApprovalStatus("approved");
    const newRevision: Revision = {
      rev: `v1.${revisionHistory.length}`,
      timestamp: "Just now • Interactive Session",
      author: "You (Interactive Preview)",
      constraintChange: `Guest Count ${baselineGuests} → ${updatedGuests} (${
        simulation.guestDelta >= 0 ? `+${simulation.guestDelta}` : simulation.guestDelta
      } pax)`,
      proposalChosen: `${activeAlternative.code}: ${activeAlternative.title}`,
      budgetBefore: simulation.baselineTotal,
      budgetAfter: activeAlternative.totalCost,
      delta: `${activeAlternative.deltaFromBaseline >= 0 ? "+" : ""}${formatINR(
        activeAlternative.deltaFromBaseline
      )}`,
      status: "APPROVED",
      notes: activeAlternative.tradeoffSummary
    };
    setRevisionHistory((prev) => [newRevision, ...prev.slice(0, 4)]);
    setSelectedRevisionIndex(0);
  };

  const handleRejectProposal = () => {
    setApprovalStatus("rejected");
    setUpdatedGuests(180);
  };

  const handleResetDemo = () => {
    setUpdatedGuests(240);
    setVenueKey("courtyard");
    setCateringKey("editorial");
    setSelectedPlanId("plan-b");
    setApprovalStatus("pending_review");
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (mobileMenuOpen) menuButtonRef.current?.focus();
        setMobileMenuOpen(false);
        setActiveWorkspaceModal(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mobileMenuOpen]);

  useEffect(() => {
    if (activeWorkspaceModal) modalCloseRef.current?.focus();
  }, [activeWorkspaceModal]);

  const currentProblem = PROBLEM_TRIGGERS[selectedTrigger];
  const selectedRevision = revisionHistory[selectedRevisionIndex] || revisionHistory[0];

  return (
    <div className="min-h-screen bg-[#FAF6F0] text-[#181512] antialiased selection:bg-[#C85A32] selection:text-[#FAF6F0] overflow-x-hidden">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:rounded-full focus:bg-[#12100E] focus:px-5 focus:py-2.5 focus:text-sm focus:font-semibold focus:text-[#FAF6F0] focus:ring-2 focus:ring-[#C85A32]"
      >
        Skip to main content
      </a>

      <header className="sticky top-0 z-50 border-b border-[#181512]/10 bg-[#FAF6F0]/90 backdrop-blur-md font-sans-ui">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3.5 sm:px-6 lg:px-8">
          <a
            href="#top"
            className="group flex items-center gap-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C85A32] rounded-lg"
          >
            <img
              src="/brand/utsavos-icon-dark.png"
              alt=""
              width={36}
              height={36}
              className="h-9 w-9 rounded-full object-cover transition-transform group-hover:scale-105"
            />
            <div className="flex flex-col">
              <span className="text-lg font-extrabold tracking-[-0.04em] text-[#12100E] leading-none">
                UTSAV
                <span className="font-serif-editorial italic font-semibold text-[#A84422]">OS</span>
              </span>
              <span className="text-[10px] font-mono-code uppercase tracking-[0.18em] text-[#6E655F] mt-0.5">
                Adaptive Event Engine
              </span>
            </div>
          </a>

          <nav
            aria-label="Primary Navigation"
            className="hidden md:flex items-center gap-7 text-sm font-medium text-[#3E3834]"
          >
            <a
              href="#the-problem"
              className="hover:text-[#C85A32] transition-colors py-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C85A32] rounded"
            >
              The Ripple Effect
            </a>
            <a
              href="#adaptive-studio"
              className="hover:text-[#C85A32] transition-colors py-1 flex items-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C85A32] rounded"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-[#C85A32]" />
              Adaptive Studio
            </a>
            <a
              href="#how-it-works"
              className="hover:text-[#C85A32] transition-colors py-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C85A32] rounded"
            >
              Workflow
            </a>
            <a
              href="#capabilities"
              className="hover:text-[#C85A32] transition-colors py-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C85A32] rounded"
            >
              Capabilities
            </a>
            <a
              href="#trust-control"
              className="hover:text-[#C85A32] transition-colors py-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C85A32] rounded"
            >
              Revision Control
            </a>
          </nav>

          <div className="hidden md:flex items-center gap-3">
            <a
              href="#adaptive-studio"
              className="rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#181512] hover:bg-[#181512]/5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C85A32]"
            >
              Live Demo (180→240)
            </a>
            <button
              type="button"
              onClick={() => setActiveWorkspaceModal("planner-route")}
              className="inline-flex items-center gap-2 rounded-full bg-[#B04B25] px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.14em] text-[#FAF6F0] shadow-sm hover:bg-[#8F3A1D] transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#C85A32]"
            >
              <span>Start Planning</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <button
            ref={menuButtonRef}
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-navigation"
            aria-label="Toggle navigation menu"
            className="md:hidden inline-flex items-center justify-center rounded-full p-2.5 text-[#181512] hover:bg-[#181512]/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C85A32]"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {mobileMenuOpen && (
          <nav
            id="mobile-navigation"
            aria-label="Mobile navigation"
            className="md:hidden border-t border-[#181512]/10 bg-[#FAF6F0] px-4 pt-3 pb-6 space-y-3"
          >
            <div className="flex flex-col space-y-2 text-sm font-medium text-[#181512]">
              <a
                href="#the-problem"
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-lg px-3 py-2 hover:bg-[#181512]/5"
              >
                The Ripple Effect
              </a>
              <a
                href="#adaptive-studio"
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-lg px-3 py-2 hover:bg-[#181512]/5 flex items-center justify-between"
              >
                <span>Adaptive Planning Studio</span>
                <span className="font-mono-code text-[11px] text-[#C85A32]">180 → 240</span>
              </a>
              <a
                href="#how-it-works"
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-lg px-3 py-2 hover:bg-[#181512]/5"
              >
                How It Works
              </a>
              <a
                href="#capabilities"
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-lg px-3 py-2 hover:bg-[#181512]/5"
              >
                Capabilities
              </a>
              <a
                href="#trust-control"
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-lg px-3 py-2 hover:bg-[#181512]/5"
              >
                Trust & Revision Control
              </a>
            </div>
            <div className="pt-2 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  setActiveWorkspaceModal("planner-route");
                }}
                className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-[#B04B25] px-5 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-[#FAF6F0]"
              >
                <span>Start Planning</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </nav>
        )}
      </header>

      <main id="main-content" className="font-sans-ui">
        <section id="top" className="relative pt-6 pb-16 md:pt-10 md:pb-24 overflow-hidden">
          <BotanicalMotif className="pointer-events-none hidden xl:block absolute top-16 -left-6 w-44 h-64 opacity-70" />
          <BotanicalMotif
            flip
            className="pointer-events-none hidden xl:block absolute top-28 -right-6 w-44 h-64 opacity-70"
          />
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="border-b border-[#181512]/15 pb-4 mb-8 md:mb-12 flex flex-col lg:flex-row lg:items-end justify-between gap-4">
              <div className="select-none">
                <p className="font-mono-code text-[11px] uppercase tracking-[0.22em] text-[#A84422] mb-2 flex items-center gap-2">
                  <span className="inline-block h-2 w-2 rounded-full bg-[#C85A32]" />
                  AI-Assisted • Deterministic Event Architecture
                </p>
                <div
                  aria-hidden="true"
                  className="text-[15vw] sm:text-[13vw] lg:text-[112px] font-black tracking-[-0.055em] leading-[0.86] text-[#12100E]"
                >
                  UTSAV
                  <span className="font-serif-editorial italic font-normal text-[#C85A32]">OS</span>
                </div>
              </div>
              <div className="max-w-md lg:text-right pb-1">
                <p className="text-xs font-mono-code uppercase tracking-[0.15em] text-[#5F6F5E]">
                  Create → Constrain → Simulate → Compare → Approve
                </p>
                <p className="mt-1 text-sm text-[#4A433E] leading-relaxed">
                  Built for multi-day celebrations where guest lists evolve, vendor quotes shift,
                  and every decision demands both grace and mathematical certainty.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center">
              <div className="lg:col-span-5 space-y-6">
                <div className="inline-flex items-center gap-2 rounded-full border border-[#C85A32]/30 bg-[#C85A32]/10 px-3.5 py-1.5 text-xs font-medium text-[#9E3E1C]">
                  <GitBranch className="h-3.5 w-3.5" />
                  <span>Adaptive Event Planning Engine</span>
                </div>

                <h1 className="text-4xl sm:text-5xl lg:text-[54px] font-bold tracking-[-0.03em] leading-[1.05] text-[#12100E]">
                  Celebrate beautifully.{" "}
                  <span className="block font-serif-editorial italic font-normal text-[#C85A32] text-5xl sm:text-6xl lg:text-[62px] mt-1">
                    Plan for every possibility.
                  </span>
                </h1>

                <p className="text-base sm:text-lg text-[#4A433E] leading-relaxed">
                  Real celebrations never stay static. When your guest count jumps from{" "}
                  <strong className="font-semibold text-[#181512]">180 to 240</strong> or a
                  courtyard quote changes, UtsavOS simulates cascading budget, venue, and timeline
                  impacts in seconds—generating feasible alternatives you review and approve before
                  your saved plan ever changes.
                </p>

                <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-3.5">
                  <button
                    type="button"
                    onClick={() => setActiveWorkspaceModal("planner-route")}
                    className="inline-flex items-center justify-center gap-3 rounded-full bg-[#12100E] px-7 py-4 text-sm font-semibold text-[#FAF6F0] shadow-lg shadow-[#12100E]/15 hover:bg-[#A84422] transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#12100E]"
                  >
                    <span>Start Planning</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                  <a
                    href="#adaptive-studio"
                    className="inline-flex items-center justify-center gap-2.5 rounded-full border border-[#181512]/25 bg-transparent px-6 py-4 text-sm font-semibold text-[#181512] hover:border-[#C85A32] hover:text-[#C85A32] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C85A32]"
                  >
                    <span>Explore the Experience</span>
                    <ArrowUpRight className="h-4 w-4" />
                  </a>
                </div>

                <div className="pt-4 border-t border-[#181512]/10 grid grid-cols-3 gap-4 text-left">
                  <div>
                    <div className="font-mono-code text-xs uppercase tracking-wider text-[#6E655F]">
                      Calculation Core
                    </div>
                    <div className="mt-0.5 text-sm font-semibold text-[#181512]">
                      100% Deterministic
                    </div>
                  </div>
                  <div>
                    <div className="font-mono-code text-xs uppercase tracking-wider text-[#6E655F]">
                      Plan Governance
                    </div>
                    <div className="mt-0.5 text-sm font-semibold text-[#181512]">
                      Diff &amp; Approval Gate
                    </div>
                  </div>
                  <div>
                    <div className="font-mono-code text-xs uppercase tracking-wider text-[#6E655F]">
                      Audit Trail
                    </div>
                    <div className="mt-0.5 text-sm font-semibold text-[#181512]">
                      Immutable Revisions
                    </div>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-7 relative">
                <div className="relative rounded-2xl overflow-hidden shadow-2xl border border-[#181512]/10">
                  <EditorialVisual
                    variant="hero-toast"
                    priority
                    aspectRatio="aspect-[16/11]"
                    alt="Guests raising champagne glasses under warm evening celebration lights at a heritage courtyard reception"
                    badge="Udaipur Heritage Sangeet • Revision v1.2"
                    caption={{
                      title:
                        "“When 60 additional family members confirmed, we adapted the courtyard in 90 seconds.”",
                      meta: "COURTYARD CAPACITY • 240 PAX"
                    }}
                  />
                </div>

                <div className="mt-4 sm:mt-0 sm:absolute sm:-top-5 sm:right-6 z-30 rounded-2xl bg-[#12100E] text-[#FAF6F0] p-4 shadow-2xl border border-[#FAF6F0]/15 sm:max-w-xs animate-float-card">
                  <div className="flex items-center justify-between gap-4 text-[11px] font-mono-code uppercase tracking-wider text-[#D49B54]">
                    <span>Constraint Change Detected</span>
                    <span className="rounded bg-[#C85A32]/25 px-2 py-0.5 text-[#F7B299]">
                      SIMULATION READY
                    </span>
                  </div>
                  <div className="mt-2.5 flex items-baseline justify-between">
                    <div>
                      <div className="text-xs text-[#FAF6F0]/70">Guest Count</div>
                      <div className="text-lg font-bold tracking-tight">
                        180 <span className="text-[#E08A6A]">→ 240</span>{" "}
                        <span className="text-xs font-mono-code font-normal text-[#FAF6F0]/70">
                          (+33.3%)
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-[#FAF6F0]/70">Proposal B Delta</div>
                      <div className="text-lg font-bold text-[#E7B769]">+₹2.95L</div>
                    </div>
                  </div>
                </div>

                <div className="mt-3 sm:mt-0 sm:absolute sm:-bottom-6 sm:left-6 z-30 rounded-2xl bg-[#FAF6F0] text-[#181512] p-4 shadow-xl border border-[#181512]/15 sm:max-w-sm">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#5F6F5E]/15 text-[#5F6F5E]">
                      <GitCommitHorizontal className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-bold uppercase tracking-wider text-[#181512] truncate">
                          Proposal B • Hybrid Courtyard
                        </p>
                        <span className="font-mono-code text-[10px] rounded-full bg-[#5F6F5E]/15 text-[#3F4D3E] px-2 py-0.5 font-semibold">
                          Feasible
                        </span>
                      </div>
                      <p className="text-xs text-[#5A524C] truncate mt-0.5">
                        Avoids ₹3.2L lawn switch • +8 service staff • Revisable
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 pt-2.5 border-t border-[#181512]/10 flex items-center justify-between text-xs">
                    <span className="font-mono-code text-[11px] text-[#6E655F]">
                      Rev v1.2 staged
                    </span>
                    <a
                      href="#adaptive-studio"
                      className="font-semibold text-[#A84422] hover:underline inline-flex items-center gap-1"
                    >
                      Inspect in Studio <ChevronRight className="h-3.5 w-3.5" />
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section
          id="the-problem"
          className="bg-[#12100E] text-[#FAF6F0] py-20 md:py-28 border-y border-[#FAF6F0]/10"
        >
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl mx-auto text-center mb-16 md:mb-24">
              <p className="font-mono-code text-xs uppercase tracking-[0.22em] text-[#D49B54] mb-4">
                01 / The Fragility of Static Spreadsheets
              </p>
              <h2 className="text-2xl sm:text-4xl md:text-[44px] font-light leading-[1.25] tracking-[-0.02em] text-[#FAF6F0]/90">
                When it’s{" "}
                <span className="font-serif-editorial italic font-normal text-[#C85A32] text-3xl sm:text-5xl md:text-[52px]">
                  high time
                </span>{" "}
                for 60 more seats in the courtyard…
                <span className="block mt-2">
                  When a floral quote shifts{" "}
                  <span className="font-serif-editorial italic font-normal text-[#D49B54] text-3xl sm:text-5xl md:text-[52px]">
                    fourteen days
                  </span>{" "}
                  before the Sangeet…
                </span>
              </h2>
              <p className="mt-6 text-base sm:text-lg text-[#FAF6F0]/65 max-w-2xl mx-auto leading-relaxed">
                In traditional event tools, changing a single assumption quietly breaks five
                spreadsheets, three vendor quotes, and your run-of-show timeline.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-start">
              <div className="lg:col-span-5 space-y-6">
                <EditorialVisual
                  variant="courtyard-dinner"
                  aspectRatio="aspect-[4/5]"
                  className="rounded-2xl border border-[#FAF6F0]/15 shadow-2xl"
                  alt="Candlelit heritage courtyard dinner table set with brass vessels and warm floral runners"
                  badge="Spatial & Financial Coupling"
                  caption={{
                    title:
                      "Every table added alters floral budgets, kitchen prep windows, and acoustic sightlines.",
                    meta: "COURTYARD FLOORPLAN"
                  }}
                />
                <div className="rounded-xl border border-[#FAF6F0]/10 bg-[#1B1815] p-5">
                  <div className="font-mono-code text-[11px] uppercase tracking-[0.18em] text-[#D49B54]">
                    Why Static Templates Fail
                  </div>
                  <p className="mt-2 text-sm text-[#FAF6F0]/75 leading-relaxed">
                    Spreadsheets record numbers in isolation. They don’t know that guest #221
                    exceeds the Sandstone Courtyard’s fire and seating threshold—requiring either a
                    lawn transition or a hybrid cocktail layout.
                  </p>
                </div>
              </div>

              <div className="lg:col-span-7 space-y-8">
                <div>
                  <div className="text-xs font-mono-code uppercase tracking-[0.2em] text-[#E08A6A]">
                    Interactive Cause-and-Effect Inspector
                  </div>
                  <h3 className="mt-2 text-3xl sm:text-4xl font-bold tracking-tight text-[#FAF6F0]">
                    One change never stays in one column.
                  </h3>
                  <p className="mt-2 text-sm sm:text-base text-[#FAF6F0]/70">
                    Select a real-world planning perturbation below to trace how a single
                    constraint change ripples across your entire celebration architecture:
                  </p>
                </div>

                <div
                  role="tablist"
                  aria-label="Constraint perturbation scenarios"
                  className="grid grid-cols-1 sm:grid-cols-3 gap-3"
                >
                  {Object.entries(PROBLEM_TRIGGERS).map(([key, item]) => {
                    const isSelected = selectedTrigger === key;
                    return (
                      <button
                        key={key}
                        role="tab"
                        aria-selected={isSelected}
                        type="button"
                        onClick={() => setSelectedTrigger(key as ProblemTriggerKey)}
                        className={`text-left rounded-xl p-4 border transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C85A32] ${
                          isSelected
                            ? "border-[#C85A32] bg-[#C85A32]/15 text-[#FAF6F0]"
                            : "border-[#FAF6F0]/15 bg-[#1B1815]/70 text-[#FAF6F0]/70 hover:border-[#FAF6F0]/30 hover:text-[#FAF6F0]"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono-code text-[11px] uppercase tracking-wider text-[#D49B54]">
                            {item.triggerBadge}
                          </span>
                          <span
                            className={`h-2 w-2 rounded-full ${
                              isSelected ? "bg-[#C85A32]" : "bg-[#FAF6F0]/20"
                            }`}
                          />
                        </div>
                        <div className="mt-2 font-bold text-base">{item.label}</div>
                      </button>
                    );
                  })}
                </div>

                <div className="rounded-2xl border border-[#FAF6F0]/15 bg-[#191614] p-6 sm:p-8 space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-5 border-b border-[#FAF6F0]/10">
                    <div>
                      <span className="font-mono-code text-xs uppercase tracking-widest text-[#E08A6A]">
                        Active Perturbation
                      </span>
                      <h4 className="text-xl font-semibold text-[#FAF6F0] mt-0.5">
                        {currentProblem.subtitle}
                      </h4>
                    </div>
                    <span className="self-start sm:self-center inline-flex items-center gap-1.5 rounded-full bg-[#C85A32]/20 border border-[#C85A32]/40 px-3 py-1 font-mono-code text-xs text-[#F7B299]">
                      <TriangleAlert className="h-3.5 w-3.5" />4 Coupled Systems Affected
                    </span>
                  </div>

                  <div className="divide-y divide-[#FAF6F0]/10">
                    {currentProblem.impacts.map((imp, idx) => (
                      <div
                        key={imp.domain}
                        className="py-4 first:pt-0 last:pb-0 grid grid-cols-1 sm:grid-cols-12 gap-2 sm:gap-4 items-baseline"
                      >
                        <div className="sm:col-span-4 flex items-baseline gap-2.5">
                          <span className="font-mono-code text-xs text-[#D49B54]">
                            0{idx + 1}
                          </span>
                          <div>
                            <div className="font-semibold text-[#FAF6F0]">{imp.domain}</div>
                            <div className="font-mono-code text-[11px] text-[#E08A6A] mt-0.5">
                              {imp.severity}
                            </div>
                          </div>
                        </div>
                        <p className="sm:col-span-8 text-sm text-[#FAF6F0]/75 leading-relaxed">
                          {imp.detail}
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="pt-4 border-t border-[#FAF6F0]/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <p className="text-xs font-serif-editorial italic text-lg text-[#D49B54]">
                      Instead of silent spreadsheet breakage, UtsavOS computes feasible
                      alternatives.
                    </p>
                    <a
                      href="#adaptive-studio"
                      className="inline-flex items-center gap-2 text-xs font-mono-code uppercase tracking-wider text-[#FAF6F0] hover:text-[#C85A32] transition-colors"
                    >
                      <span>Simulate This in the Studio</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="adaptive-studio" className="py-20 md:py-28 bg-[#FAF6F0] relative">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-12">
              <div className="max-w-2xl">
                <div className="inline-flex items-center gap-2 rounded-full bg-[#181512] text-[#FAF6F0] px-3.5 py-1 text-[11px] font-mono-code uppercase tracking-[0.16em]">
                  <SlidersVertical className="h-3.5 w-3.5 text-[#D49B54]" />
                  <span>02 / Adaptive Planning Studio</span>
                </div>
                <h2 className="mt-4 text-3xl sm:text-5xl font-bold tracking-[-0.03em] text-[#12100E] leading-[1.08]">
                  Change a constraint.{" "}
                  <span className="font-serif-editorial italic font-normal text-[#C85A32]">
                    Compare feasible realities.
                  </span>
                </h2>
                <p className="mt-3 text-base text-[#4A433E] leading-relaxed">
                  Test the deterministic planning engine below. Start with our flagship
                  scenario—expanding the guest list from{" "}
                  <strong className="text-[#181512]">180 to 240 guests</strong>—or adjust the
                  parameters to see how UtsavOS calculates financial deltas, flags spatial
                  thresholds, and stages proposals for your approval.
                </p>
              </div>
              <div className="rounded-xl border border-[#181512]/15 bg-[#F2ECE1] px-4 py-3 max-w-md">
                <div className="flex items-center gap-2 text-xs font-mono-code uppercase tracking-wider text-[#181512] font-semibold">
                  <Info className="h-4 w-4 text-[#C85A32] shrink-0" />
                  <span>Deterministic Simulation Fixture</span>
                </div>
                <p className="mt-1 text-xs text-[#5A524C] leading-relaxed">
                  Runs the client-side deterministic pricing &amp; capacity rule engine on an
                  illustrative Udaipur Sangeet fixture. No unverified server state is mutated until
                  you save in your workspace.
                </p>
              </div>
            </div>

            <div className="rounded-3xl border border-[#181512]/15 bg-[#FFFFFF] shadow-xl overflow-hidden">
              <div className="bg-[#12100E] text-[#FAF6F0] px-6 py-4 flex flex-wrap items-center justify-between gap-4 border-b border-[#FAF6F0]/10">
                <div className="flex items-center gap-3">
                  <div className="flex gap-1.5" aria-hidden="true">
                    <span className="h-2.5 w-2.5 rounded-full bg-[#C85A32]" />
                    <span className="h-2.5 w-2.5 rounded-full bg-[#D49B54]" />
                    <span className="h-2.5 w-2.5 rounded-full bg-[#5F6F5E]" />
                  </div>
                  <span className="font-mono-code text-xs uppercase tracking-widest text-[#FAF6F0]/80">
                    EVENT: MEERA &amp; AARAV SANGEET • BASELINE REV v1.1
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono-code text-xs text-[#D49B54]">
                    Baseline: {baselineGuests} Guests ({formatINR(simulation.baselineTotal)})
                  </span>
                  <button
                    type="button"
                    onClick={handleResetDemo}
                    className="inline-flex items-center gap-1.5 rounded-full border border-[#FAF6F0]/20 bg-[#FAF6F0]/10 px-3 py-1 text-xs font-mono-code text-[#FAF6F0] hover:bg-[#FAF6F0]/20 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C85A32]"
                  >
                    <RotateCcw className="h-3 w-3" />Reset to 180 → 240
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-[#181512]/10">
                <div className="lg:col-span-5 p-6 sm:p-8 bg-[#FAF6F0]/60 space-y-6">
                  <div>
                    <span className="font-mono-code text-[11px] uppercase tracking-[0.16em] text-[#A84422] font-semibold">
                      Step 1 • Modify Constraint
                    </span>
                    <h3 className="text-xl font-bold text-[#12100E] mt-1">
                      Guest Count &amp; Venue Parameters
                    </h3>
                  </div>

                  <div className="rounded-2xl border border-[#181512]/15 bg-[#FFFFFF] p-5 shadow-sm">
                    <div className="flex items-center justify-between text-xs font-mono-code uppercase tracking-wider text-[#6E655F]">
                      <span>Initial Plan</span>
                      <span>Updated Constraint</span>
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-4">
                      <div>
                        <div className="text-2xl font-bold text-[#6E655F] line-through decoration-[#C85A32]/60">
                          {baselineGuests}
                        </div>
                        <div className="text-xs text-[#6E655F]">Baseline Guests</div>
                      </div>
                      <div className="flex flex-col items-center">
                        <span className="rounded-full bg-[#C85A32]/15 text-[#A84422] px-3 py-1 font-mono-code text-xs font-bold">
                          {simulation.guestDelta >= 0
                            ? `+${simulation.guestDelta}`
                            : simulation.guestDelta}{" "}
                          PAX (
                          {simulation.guestDeltaPct >= 0
                            ? `+${simulation.guestDeltaPct}%`
                            : `${simulation.guestDeltaPct}%`}
                          )
                        </span>
                        <ArrowRight className="h-4 w-4 text-[#C85A32] mt-1" />
                      </div>
                      <div className="text-right">
                        <div className="text-3xl font-extrabold text-[#12100E]">
                          {updatedGuests}
                        </div>
                        <div className="text-xs font-semibold text-[#A84422]">
                          Simulated Guests
                        </div>
                      </div>
                    </div>

                    <div className="mt-5">
                      <label
                        htmlFor="guest-slider"
                        className="block text-xs font-medium text-[#4A433E] mb-2"
                      >
                        Adjust Updated Guest Count ({updatedGuests} guests):
                      </label>
                      <input
                        id="guest-slider"
                        type="range"
                        min={150}
                        max={300}
                        step={10}
                        value={updatedGuests}
                        onChange={(e) => {
                          setUpdatedGuests(Number(e.target.value));
                          setApprovalStatus("pending_review");
                        }}
                        className="w-full accent-[#C85A32] cursor-pointer"
                      />
                      <div className="mt-2 flex items-center justify-between gap-1.5">
                        {[160, 180, 210, 240, 280].map((count) => (
                          <button
                            key={count}
                            type="button"
                            onClick={() => {
                              setUpdatedGuests(count);
                              setApprovalStatus("pending_review");
                            }}
                            className={`flex-1 rounded-lg py-1.5 font-mono-code text-xs border transition-colors ${
                              updatedGuests === count
                                ? "bg-[#12100E] text-[#FAF6F0] border-[#12100E] font-bold"
                                : "bg-[#FAF6F0] text-[#4A433E] border-[#181512]/15 hover:border-[#181512]/40"
                            }`}
                          >
                            {count}
                            {count === 180 ? " (Base)" : count === 240 ? " ★" : ""}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label
                        htmlFor="venue-select"
                        className="block text-xs font-semibold uppercase tracking-wider text-[#4A433E] mb-1.5"
                      >
                        Primary Venue Zone
                      </label>
                      <select
                        id="venue-select"
                        value={venueKey}
                        onChange={(e) => {
                          setVenueKey(e.target.value as VenueKey);
                          setApprovalStatus("pending_review");
                        }}
                        className="w-full rounded-xl border border-[#181512]/20 bg-[#FFFFFF] px-3 py-2.5 text-xs font-medium text-[#181512] focus:outline-none focus:ring-2 focus:ring-[#C85A32]"
                      >
                        <option value="courtyard">Sandstone Courtyard (220 cap)</option>
                        <option value="palace">Sheesh Mahal Pavilion (190 cap)</option>
                      </select>
                    </div>
                    <div>
                      <label
                        htmlFor="catering-select"
                        className="block text-xs font-semibold uppercase tracking-wider text-[#4A433E] mb-1.5"
                      >
                        Culinary Program
                      </label>
                      <select
                        id="catering-select"
                        value={cateringKey}
                        onChange={(e) => {
                          setCateringKey(e.target.value as CateringKey);
                          setApprovalStatus("pending_review");
                        }}
                        className="w-full rounded-xl border border-[#181512]/20 bg-[#FFFFFF] px-3 py-2.5 text-xs font-medium text-[#181512] focus:outline-none focus:ring-2 focus:ring-[#C85A32]"
                      >
                        <option value="editorial">Regional Tasting (₹4,200/plate)</option>
                        <option value="royal">Royal Silver Thali (₹5,600/plate)</option>
                      </select>
                    </div>
                  </div>

                  <div className="rounded-2xl bg-[#12100E] text-[#FAF6F0] p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="font-mono-code text-[11px] uppercase tracking-wider text-[#D49B54]">
                        Unmitigated Impact Analysis
                      </span>
                      <span className="font-mono-code text-xs text-[#E08A6A] font-semibold">
                        {simulation.budgetDelta >= 0 ? "+" : ""}
                        {formatINR(simulation.budgetDelta)} ({simulation.budgetDeltaPct}%)
                      </span>
                    </div>
                    <div className="space-y-2.5 text-xs">
                      <div className="flex items-start gap-2.5">
                        <Building2 className="h-4 w-4 text-[#C85A32] shrink-0 mt-0.5" />
                        <div>
                          <span className="font-semibold text-[#FAF6F0]">Venue Consequence: </span>
                          <span className="text-[#FAF6F0]/75">
                            {simulation.capacityExceeded
                              ? `Exceeds ${simulation.venue.name} seated limit (${simulation.venue.maxSeatedCapacity} pax) by ${
                                  updatedGuests - simulation.venue.maxSeatedCapacity
                                } guests.`
                              : `Within ${simulation.venue.name} seated threshold (${simulation.venue.maxSeatedCapacity} pax).`}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-start gap-2.5">
                        <Clock className="h-4 w-4 text-[#D49B54] shrink-0 mt-0.5" />
                        <div>
                          <span className="font-semibold text-[#FAF6F0]">
                            Timeline Consequence:{" "}
                          </span>
                          <span className="text-[#FAF6F0]/75">
                            +{simulation.extraPrepHours}
                            {" hrs culinary prep & plating window; "}
                            {simulation.additionalTables >= 0
                              ? `+${simulation.additionalTables}`
                              : simulation.additionalTables}{" "}
                            banquet tables.
                          </span>
                        </div>
                      </div>
                      <div className="flex items-start gap-2.5">
                        <Users className="h-4 w-4 text-[#5F6F5E] shrink-0 mt-0.5" />
                        <div>
                          <span className="font-semibold text-[#FAF6F0]">Vendor Staffing: </span>
                          <span className="text-[#FAF6F0]/75">
                            +{simulation.extraStaff}
                            {" hospitality & sommelier servers required to maintain service SLA."}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-7 p-6 sm:p-8 flex flex-col justify-between space-y-6">
                  <div>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <span className="font-mono-code text-[11px] uppercase tracking-[0.16em] text-[#5F6F5E] font-semibold">
                          Step 2 • Compare Feasible Alternatives
                        </span>
                        <h3 className="text-xl font-bold text-[#12100E] mt-1">
                          Select a Proposal to Stage for Approval
                        </h3>
                      </div>
                      <span className="font-mono-code text-xs text-[#6E655F]">
                        3 Feasible Paths Synthesized
                      </span>
                    </div>

                    <div className="mt-5 space-y-3.5">
                      {simulation.alternatives.map((alt) => {
                        const isSelected = activeAlternative.id === alt.id;
                        return (
                          <button
                            key={alt.id}
                            type="button"
                            aria-pressed={isSelected}
                            onClick={() => {
                              setSelectedPlanId(alt.id);
                              setApprovalStatus("pending_review");
                            }}
                            className={`w-full text-left rounded-2xl border p-5 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C85A32] ${
                              isSelected
                                ? "border-[#C85A32] bg-[#FAF6F0] shadow-md"
                                : "border-[#181512]/15 bg-[#FFFFFF] hover:border-[#181512]/35"
                            }`}
                          >
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div className="flex items-center gap-2.5">
                                <span
                                  className={`flex h-5 w-5 items-center justify-center rounded-full border text-xs ${
                                    isSelected
                                      ? "border-[#C85A32] bg-[#C85A32] text-[#FAF6F0]"
                                      : "border-[#181512]/30"
                                  }`}
                                >
                                  {isSelected && <Check className="h-3 w-3" />}
                                </span>
                                <span className="font-mono-code text-xs font-bold uppercase tracking-wider text-[#A84422]">
                                  {alt.code}
                                </span>
                                <span className="rounded-full bg-[#181512]/5 px-2.5 py-0.5 text-[11px] font-medium text-[#4A433E]">
                                  {alt.tag}
                                </span>
                              </div>
                              <div className="text-right">
                                <div className="text-base font-extrabold text-[#12100E]">
                                  {formatINR(alt.totalCost)}
                                </div>
                                <div className="font-mono-code text-[11px] text-[#A84422] font-semibold">
                                  {alt.deltaFromBaseline >= 0 ? "+" : ""}
                                  {formatINR(alt.deltaFromBaseline)} vs. baseline
                                </div>
                              </div>
                            </div>
                            <h4 className="mt-2 text-base font-bold text-[#12100E]">{alt.title}</h4>
                            <p className="mt-1 text-xs text-[#4A433E] leading-relaxed">
                              {alt.tradeoffSummary}
                            </p>
                            <div className="mt-3 pt-3 border-t border-[#181512]/10 grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-[#3E3834]">
                              <div className="flex items-start gap-1.5">
                                <Compass className="h-3.5 w-3.5 text-[#5F6F5E] shrink-0 mt-0.5" />
                                <span>{alt.venueAction}</span>
                              </div>
                              <div className="flex items-start gap-1.5">
                                <Clock className="h-3.5 w-3.5 text-[#C85A32] shrink-0 mt-0.5" />
                                <span>{alt.timelineImpact}</span>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-[#181512]/15 bg-[#F4EFE6] p-5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono-code text-[11px] uppercase tracking-wider text-[#181512] font-bold">
                            Step 3 • Governance &amp; Revision Gate
                          </span>
                          {approvalStatus === "approved" && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-[#5F6F5E] px-2.5 py-0.5 text-[10px] font-mono-code uppercase text-[#FAF6F0]">
                              <CircleCheck className="h-3 w-3" /> Committed to History
                            </span>
                          )}
                          {approvalStatus === "rejected" && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-[#C85A32] px-2.5 py-0.5 text-[10px] font-mono-code uppercase text-[#FAF6F0]">
                              Reverted to 180 Pax Baseline
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-xs text-[#4A433E]">
                          {approvalStatus === "approved"
                            ? `${activeAlternative.code} approved! Scroll to Section 8 or inspect the live revision log to see your saved commit.`
                            : `Staged: ${activeAlternative.code} (${formatINR(
                                activeAlternative.totalCost
                              )}). Nothing overwrites your master plan until approved.`}
                        </p>
                      </div>
                      <div className="flex items-center gap-2.5 shrink-0">
                        <button
                          type="button"
                          onClick={handleRejectProposal}
                          className="rounded-full border border-[#181512]/25 bg-[#FFFFFF] px-4 py-2.5 text-xs font-semibold text-[#181512] hover:bg-[#181512]/5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C85A32]"
                        >
                          Reject &amp; Revert
                        </button>
                        <button
                          type="button"
                          onClick={handleApproveProposal}
                          className="inline-flex items-center gap-1.5 rounded-full bg-[#B04B25] px-5 py-2.5 text-xs font-semibold text-[#FAF6F0] shadow-sm hover:bg-[#8F3A1D] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#C85A32]"
                        >
                          <Check className="h-3.5 w-3.5" />
                          <span>Approve Proposal</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section
          id="how-it-works"
          className="py-20 md:py-28 bg-[#F2ECE1] border-t border-[#181512]/10"
        >
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl mb-14">
              <p className="font-mono-code text-xs uppercase tracking-[0.2em] text-[#A84422]">
                03 / The Adaptive Planning Loop
              </p>
              <h2 className="mt-3 text-3xl sm:text-5xl font-bold tracking-[-0.03em] text-[#12100E]">
                Designed for the way celebrations{" "}
                <span className="font-serif-editorial italic font-normal text-[#C85A32]">
                  actually unfold.
                </span>
              </h2>
              <p className="mt-3 text-base text-[#4A433E] leading-relaxed">
                UtsavOS replaces brittle spreadsheets and disconnected WhatsApp threads with a
                structured six-stage decision cycle.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {WORKFLOW_STEPS.map((item) => (
                <div
                  key={item.step}
                  className="group relative rounded-2xl border border-[#181512]/[0.12] bg-[#FAF6F0] p-6 sm:p-7 flex flex-col justify-between transition-all hover:border-[#C85A32] hover:shadow-md"
                >
                  <div>
                    <div className="flex items-center justify-between border-b border-[#181512]/10 pb-4">
                      <span className="font-serif-editorial italic text-3xl font-semibold text-[#C85A32]">
                        {item.step}
                      </span>
                      <span className="font-mono-code text-[10px] uppercase tracking-[0.18em] text-[#6E655F]">
                        Stage {item.step}
                      </span>
                    </div>
                    <h3 className="mt-5 text-xl font-bold text-[#12100E]">{item.title}</h3>
                    <p className="mt-1 font-mono-code text-xs text-[#5F6F5E]">{item.subtitle}</p>
                    <p className="mt-3 text-sm text-[#4A433E] leading-relaxed">{item.desc}</p>
                  </div>
                  <div className="mt-6 pt-3 border-t border-[#181512]/5 flex items-center justify-between text-xs font-medium text-[#181512]/60 group-hover:text-[#C85A32]">
                    <span>Deterministic Step</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section
          id="capabilities"
          className="py-20 md:py-28 bg-[#FAF6F0] border-t border-[#181512]/10"
        >
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-end mb-14">
              <div className="lg:col-span-7">
                <p className="font-mono-code text-xs uppercase tracking-[0.2em] text-[#A84422]">
                  04 / Platform Capabilities
                </p>
                <h2 className="mt-3 text-3xl sm:text-5xl font-bold tracking-[-0.03em] text-[#12100E]">
                  Every dimension of celebration,{" "}
                  <span className="font-serif-editorial italic font-normal text-[#C85A32]">
                    coupled with precision.
                  </span>
                </h2>
              </div>
              <div className="lg:col-span-5 lg:text-right">
                <p className="text-sm text-[#4A433E] leading-relaxed">
                  Every module in UtsavOS feeds the central constraint graph. Below is our
                  transparent capability matrix across live engine modules and upcoming roadmap
                  extensions.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
              <div className="lg:col-span-5 flex flex-col justify-between gap-6">
                <EditorialVisual
                  variant="tablescape-detail"
                  aspectRatio="aspect-[4/3]"
                  className="rounded-2xl border border-[#181512]/10 shadow-lg"
                  alt="Elegant outdoor celebration tablescape with terracotta florals, linen napkins, and warm brass candleholders"
                  badge="Coupled Resource Graph"
                  caption={{
                    title:
                      "Tablescapes, catering ratios, and acoustic timelines stay synchronized.",
                    meta: "BOTANICAL & CULINARY SYNC"
                  }}
                />
                <EditorialVisual
                  variant="celebration-dance"
                  aspectRatio="aspect-[16/10]"
                  className="rounded-2xl border border-[#181512]/10 shadow-lg"
                  alt="Joyful wedding guests celebrating together under warm evening sparklers and stage lights"
                  badge="Multi-Ceremony Run of Show"
                  caption={{
                    title:
                      "Preserve the magic on the dancefloor while the engine guards the logistics.",
                    meta: "SANGEET & RECEPTION"
                  }}
                />
              </div>

              <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-4">
                {CAPABILITY_ITEMS.map((cap) => {
                  const IconComponent = cap.icon;
                  return (
                    <div
                      key={cap.title}
                      className="rounded-2xl border border-[#181512]/[0.12] bg-[#FFFFFF] p-5 flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#FAF6F0] border border-[#181512]/10 text-[#C85A32]">
                            <IconComponent className="h-4 w-4" />
                          </span>
                          <span
                            className={`font-mono-code text-[10px] uppercase tracking-wider px-2.5 py-0.5 rounded-full font-semibold ${
                              cap.isLive
                                ? "bg-[#5F6F5E]/15 text-[#3F4D3E]"
                                : "bg-[#D49B54]/20 text-[#8A5A19]"
                            }`}
                          >
                            {cap.status}
                          </span>
                        </div>
                        <h3 className="mt-3.5 text-base font-bold text-[#12100E]">{cap.title}</h3>
                        <p className="mt-1.5 text-xs text-[#4A433E] leading-relaxed">{cap.desc}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        <section className="py-20 md:py-28 bg-[#181512] text-[#FAF6F0]">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl mb-14">
              <p className="font-mono-code text-xs uppercase tracking-[0.2em] text-[#D49B54]">
                05 / Hybrid Intelligence Architecture
              </p>
              <h2 className="mt-3 text-3xl sm:text-5xl font-bold tracking-[-0.03em]">
                AI explains the trade-offs.{" "}
                <span className="font-serif-editorial italic font-normal text-[#C85A32]">
                  Deterministic logic does the math.
                </span>
              </h2>
              <p className="mt-4 text-base text-[#FAF6F0]/75 leading-relaxed">
                You would never trust a language model to guess your wedding budget or hallucinate
                venue capacities. UtsavOS strictly separates natural-language interpretation from
                financial and spatial calculation.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="rounded-3xl border border-[#FAF6F0]/15 bg-[#211D19] p-7 sm:p-9 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-2 rounded-full bg-[#C85A32]/20 border border-[#C85A32]/40 px-3.5 py-1 text-xs font-mono-code uppercase tracking-wider text-[#F7B299]">
                      <Sparkles className="h-3.5 w-3.5" /> Contextual AI Layer
                    </span>
                    <span className="font-mono-code text-xs text-[#FAF6F0]/50">
                      Preference &amp; Narrative Synthesis
                    </span>
                  </div>
                  <h3 className="mt-6 text-2xl font-bold text-[#FAF6F0]">
                    Interprets intent &amp; summarizes trade-offs in plain language
                  </h3>
                  <p className="mt-2 text-sm text-[#FAF6F0]/70 leading-relaxed">
                    Translates natural-language planning notes into structured constraint inputs
                    and writes human-readable briefings for family decision-makers.
                  </p>
                  <div className="mt-6 rounded-2xl bg-[#12100E] border border-[#FAF6F0]/10 p-4 space-y-3">
                    <div className="text-[11px] font-mono-code uppercase tracking-wider text-[#D49B54]">
                      Example Input Interpreted
                    </div>
                    <p className="font-serif-editorial italic text-lg text-[#FAF6F0]">
                      “Meera’s uncle is bringing 60 additional guests for the Sangeet, but we
                      really want to keep the intimate Sandstone Courtyard vibe and avoid going
                      over ₹28 Lakhs.”
                    </p>
                    <div className="pt-2 border-t border-[#FAF6F0]/10 flex flex-wrap gap-2 text-[11px] font-mono-code">
                      <span className="rounded bg-[#FAF6F0]/10 px-2 py-1 text-[#FAF6F0]">
                        parsed_delta: +60_pax
                      </span>
                      <span className="rounded bg-[#FAF6F0]/10 px-2 py-1 text-[#FAF6F0]">
                        prefer_zone: courtyard
                      </span>
                      <span className="rounded bg-[#FAF6F0]/10 px-2 py-1 text-[#FAF6F0]">
                        soft_cap: ₹28,00,000
                      </span>
                    </div>
                  </div>
                </div>
                <ul className="mt-6 pt-6 border-t border-[#FAF6F0]/10 space-y-2 text-xs text-[#FAF6F0]/80">
                  <li className="flex items-center gap-2">
                    <CircleCheck className="h-4 w-4 text-[#C85A32] shrink-0" />
                    <span>Structures messy vendor quotes &amp; WhatsApp notes into parameters</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CircleCheck className="h-4 w-4 text-[#C85A32] shrink-0" />
                    <span>
                      Explains why Proposal B saves ₹3.75L over Proposal A in clear prose
                    </span>
                  </li>
                </ul>
              </div>

              <div className="rounded-3xl border border-[#D49B54]/35 bg-[#1B1916] p-7 sm:p-9 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-2 rounded-full bg-[#5F6F5E]/30 border border-[#5F6F5E]/60 px-3.5 py-1 text-xs font-mono-code uppercase tracking-wider text-[#C5D6C4]">
                      <Cpu className="h-3.5 w-3.5" /> Deterministic Planning Core
                    </span>
                    <span className="font-mono-code text-xs text-[#D49B54]">
                      Zero Hallucination Guarantee
                    </span>
                  </div>
                  <h3 className="mt-6 text-2xl font-bold text-[#FAF6F0]">
                    Executes 100% of financial math, capacities &amp; feasibility rules
                  </h3>
                  <p className="mt-2 text-sm text-[#FAF6F0]/70 leading-relaxed">
                    Every rupee, table count, staffing ratio, and timeline buffer is computed by
                    auditable TypeScript domain rules—never approximated by an LLM.
                  </p>
                  <div className="mt-6 rounded-2xl bg-[#12100E] border border-[#FAF6F0]/10 p-4 font-mono-code text-xs space-y-2 text-[#FAF6F0]/85">
                    <div className="text-[11px] uppercase tracking-wider text-[#C5D6C4]">
                      Deterministic Verification Trace
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#FAF6F0]/60">courtyard.maxSeated:</span>
                      <span>220 pax (Hard Constraint)</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#FAF6F0]/60">catering.delta(60 * 4200):</span>
                      <span className="text-[#D49B54]">+₹2,52,000 (Exact)</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#FAF6F0]/60">tables.required(240 / 10):</span>
                      <span>24 tables (+6 vs v1.1)</span>
                    </div>
                  </div>
                </div>
                <ul className="mt-6 pt-6 border-t border-[#FAF6F0]/10 space-y-2 text-xs text-[#FAF6F0]/80">
                  <li className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-[#D49B54] shrink-0" />
                    <span>Repeatable, unit-tested arithmetic across every category</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-[#D49B54] shrink-0" />
                    <span>Strict capacity &amp; timeline feasibility checks before staging options</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        <section id="trust-control" className="py-20 md:py-28 bg-[#FAF6F0]">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl mb-12">
              <p className="font-mono-code text-xs uppercase tracking-[0.2em] text-[#A84422]">
                06 / Trust, Governance &amp; Revision Control
              </p>
              <h2 className="mt-3 text-3xl sm:text-5xl font-bold tracking-[-0.03em] text-[#12100E]">
                Nothing mutates your plan{" "}
                <span className="font-serif-editorial italic font-normal text-[#C85A32]">
                  without your signature.
                </span>
              </h2>
              <p className="mt-3 text-base text-[#4A433E] leading-relaxed">
                Simulations are safe sandboxes. UtsavOS maintains a version-controlled ledger of
                every approved proposal—allowing couples, families, and lead planners to inspect
                exact diffs or roll back at any time.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              <div className="lg:col-span-5 space-y-3">
                <div className="flex items-center justify-between text-xs font-mono-code uppercase tracking-wider text-[#6E655F] px-1">
                  <span>Saved Plan Revisions</span>
                  <span>Click to Inspect Diff</span>
                </div>
                {revisionHistory.map((item, idx) => {
                  const isCurrent = selectedRevisionIndex === idx;
                  return (
                    <button
                      key={`${item.rev}-${idx}`}
                      type="button"
                      onClick={() => setSelectedRevisionIndex(idx)}
                      className={`w-full text-left rounded-2xl border p-5 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C85A32] ${
                        isCurrent
                          ? "border-[#12100E] bg-[#12100E] text-[#FAF6F0] shadow-lg"
                          : "border-[#181512]/15 bg-[#FFFFFF] text-[#181512] hover:border-[#181512]/40"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono-code text-xs font-bold px-2 py-0.5 rounded bg-[#B04B25] text-[#FAF6F0]">
                            {item.rev}
                          </span>
                          <span
                            className={`text-xs font-mono-code ${
                              isCurrent ? "text-[#FAF6F0]/70" : "text-[#6E655F]"
                            }`}
                          >
                            {item.timestamp}
                          </span>
                        </div>
                        <span
                          className={`font-mono-code text-xs font-semibold ${
                            isCurrent ? "text-[#D49B54]" : "text-[#A84422]"
                          }`}
                        >
                          {item.delta}
                        </span>
                      </div>
                      <div className="mt-2.5 font-bold text-sm">{item.constraintChange}</div>
                      <div
                        className={`mt-1 text-xs truncate ${
                          isCurrent ? "text-[#FAF6F0]/75" : "text-[#5A524C]"
                        }`}
                      >
                        {item.proposalChosen}
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="lg:col-span-7 rounded-3xl border border-[#181512]/15 bg-[#FFFFFF] p-6 sm:p-8 shadow-lg">
                <div className="space-y-6">
                  <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#181512]/10 pb-5">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono-code text-xs uppercase tracking-widest text-[#A84422] font-bold">
                          REVISION {selectedRevision.rev} SNAPSHOT
                        </span>
                        <span className="rounded-full bg-[#5F6F5E]/15 text-[#3F4D3E] px-2.5 py-0.5 font-mono-code text-[10px] font-semibold">
                          {selectedRevision.status}
                        </span>
                      </div>
                      <h3 className="mt-1 text-2xl font-bold text-[#12100E]">
                        {selectedRevision.proposalChosen}
                      </h3>
                    </div>
                    <div className="text-right font-mono-code text-xs text-[#6E655F]">
                      <div>Approved by: {selectedRevision.author}</div>
                      <div>{selectedRevision.timestamp}</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="rounded-2xl border border-[#181512]/10 bg-[#FAF6F0] p-4">
                      <div className="font-mono-code text-[11px] uppercase tracking-wider text-[#6E655F]">
                        Previous Saved State
                      </div>
                      <div className="mt-1 text-2xl font-bold text-[#4A433E]">
                        {formatINR(selectedRevision.budgetBefore)}
                      </div>
                      <div className="mt-1 text-xs text-[#6E655F]">
                        Prior to {selectedRevision.constraintChange}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-[#C85A32]/30 bg-[#C85A32]/5 p-4">
                      <div className="font-mono-code text-[11px] uppercase tracking-wider text-[#A84422]">
                        Committed Revision State ({selectedRevision.rev})
                      </div>
                      <div className="mt-1 text-2xl font-bold text-[#12100E]">
                        {formatINR(selectedRevision.budgetAfter)}{" "}
                        <span className="text-sm font-mono-code text-[#A84422]">
                          ({selectedRevision.delta})
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-[#4A433E]">
                        Verified feasible &amp; locked in master plan
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl bg-[#F4EFE6] p-4 text-sm text-[#3E3834]">
                    <span className="font-semibold text-[#12100E]">
                      Decision Rationale &amp; Consequence Log:{" "}
                    </span>
                    {selectedRevision.notes}
                  </div>

                  <div className="pt-2 flex flex-wrap items-center justify-between gap-4 text-xs text-[#5A524C]">
                    <div className="flex items-center gap-2">
                      <Lock className="h-4 w-4 text-[#5F6F5E]" />
                      <span>
                        Cryptographic revision hash preserved • Non-destructive history
                      </span>
                    </div>
                    <a href="#adaptive-studio" className="font-semibold text-[#A84422] hover:underline">
                      Stage another simulation in Studio →
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="py-16 md:py-24 bg-[#FAF6F0]">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="relative rounded-3xl overflow-hidden bg-[#12100E] text-[#FAF6F0] shadow-2xl border border-[#181512]/15">
              <div className="grid grid-cols-1 lg:grid-cols-12 items-center">
                <div className="lg:col-span-7 p-8 sm:p-12 lg:p-16 space-y-6 relative z-20">
                  <div className="inline-flex items-center gap-2 rounded-full bg-[#FAF6F0]/10 border border-[#FAF6F0]/15 px-3.5 py-1 text-xs font-mono-code uppercase tracking-widest text-[#D49B54]">
                    <span>Begin Your Celebration Architecture</span>
                  </div>
                  <h2 className="text-3xl sm:text-5xl lg:text-[54px] font-bold tracking-[-0.03em] leading-[1.06]">
                    Hold onto the joy.{" "}
                    <span className="block font-serif-editorial italic font-normal text-[#C85A32] mt-1">
                      Let the plan adapt around you.
                    </span>
                  </h2>
                  <p className="text-base sm:text-lg text-[#FAF6F0]/75 max-w-xl leading-relaxed">
                    Model your baseline guest list, ceremony venues, and vendor quotes today—and
                    step into every family conversation knowing you can simulate any change in
                    seconds.
                  </p>
                  <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
                    <button
                      type="button"
                      onClick={() => setActiveWorkspaceModal("planner-route")}
                      className="inline-flex items-center justify-center gap-3 rounded-full bg-[#B04B25] px-8 py-4 text-sm font-semibold uppercase tracking-[0.12em] text-[#FAF6F0] hover:bg-[#8F3A1D] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FAF6F0]"
                    >
                      <span>Start Planning</span>
                      <ArrowRight className="h-4 w-4" />
                    </button>
                    <a
                      href="#adaptive-studio"
                      className="inline-flex items-center justify-center gap-2 rounded-full border border-[#FAF6F0]/25 bg-[#FAF6F0]/5 px-7 py-4 text-sm font-semibold text-[#FAF6F0] hover:bg-[#FAF6F0]/15 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C85A32]"
                    >
                      <span>Revisit Studio Demo</span>
                    </a>
                  </div>
                </div>
                <div className="lg:col-span-5 h-full">
                  <EditorialVisual
                    variant="closing-lanterns"
                    aspectRatio="aspect-[4/3] lg:aspect-auto lg:h-full min-h-[340px]"
                    alt="Warm celebration lanterns glowing over an evening heritage courtyard gathering"
                    badge="Every Possibility Accounted For"
                    caption={{
                      title: "From intimate 120-guest courtyards to 400-guest palace lawns.",
                      meta: "UTSAVOS ENGINE"
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-[#12100E] text-[#FAF6F0] pt-16 pb-10 border-t border-[#FAF6F0]/10 font-sans-ui overflow-hidden">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-10 pb-14 border-b border-[#FAF6F0]/10">
            <div className="md:col-span-5 space-y-4">
              <div className="flex items-center gap-3">
                <img
                  src="/brand/utsavos-icon-light.png"
                  alt=""
                  width={32}
                  height={32}
                  className="h-8 w-8 rounded-full object-cover"
                />
                <span className="text-xl font-extrabold tracking-tight">
                  UTSAV
                  <span className="font-serif-editorial italic font-normal text-[#E08A6A]">OS</span>
                </span>
              </div>
              <p className="text-sm text-[#FAF6F0]/65 max-w-sm leading-relaxed">
                AI-assisted, deterministic adaptive event planning platform. Create an event,
                modify constraints, simulate cascading impacts, compare feasible alternatives, and
                preserve revision history.
              </p>
              <div className="font-mono-code text-xs text-[#D49B54]">
                Architecture: React • TypeScript • Tailwind CSS • Deterministic Engine
              </div>
            </div>

            <div className="md:col-span-4 grid grid-cols-2 gap-6 text-sm">
              <div>
                <div className="font-mono-code text-xs uppercase tracking-wider text-[#FAF6F0]/50 mb-3">
                  Experience
                </div>
                <ul className="space-y-2.5 text-[#FAF6F0]/80">
                  <li>
                    <a href="#top" className="hover:text-[#C85A32] transition-colors">
                      Overview
                    </a>
                  </li>
                  <li>
                    <a href="#the-problem" className="hover:text-[#C85A32] transition-colors">
                      The Ripple Effect
                    </a>
                  </li>
                  <li>
                    <a href="#adaptive-studio" className="hover:text-[#C85A32] transition-colors">
                      Adaptive Studio
                    </a>
                  </li>
                  <li>
                    <a href="#how-it-works" className="hover:text-[#C85A32] transition-colors">
                      6-Step Workflow
                    </a>
                  </li>
                </ul>
              </div>
              <div>
                <div className="font-mono-code text-xs uppercase tracking-wider text-[#FAF6F0]/50 mb-3">
                  Architecture
                </div>
                <ul className="space-y-2.5 text-[#FAF6F0]/80">
                  <li>
                    <a href="#capabilities" className="hover:text-[#C85A32] transition-colors">
                      Capabilities Matrix
                    </a>
                  </li>
                  <li>
                    <a href="#trust-control" className="hover:text-[#C85A32] transition-colors">
                      Revision Control
                    </a>
                  </li>
                  <li>
                    <button
                      type="button"
                      onClick={() => setActiveWorkspaceModal("planner-route")}
                      className="hover:text-[#C85A32] transition-colors text-left"
                    >
                      Launch Workspace Route
                    </button>
                  </li>
                  <li>
                    <button
                      type="button"
                      onClick={() => setActiveWorkspaceModal("architecture-docs")}
                      className="hover:text-[#C85A32] transition-colors text-left"
                    >
                      docs/DESIGN.md Spec
                    </button>
                  </li>
                </ul>
              </div>
            </div>

            <div className="md:col-span-3 flex flex-col justify-between rounded-2xl border border-[#FAF6F0]/10 bg-[#1B1815] p-5">
              <div>
                <div className="font-mono-code text-[11px] uppercase tracking-wider text-[#E08A6A]">
                  Interactive Sandbox
                </div>
                <p className="mt-1.5 text-xs text-[#FAF6F0]/75 leading-relaxed">
                  Test the 180 → 240 guest surge simulation or initialize a new baseline
                  celebration plan.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveWorkspaceModal("planner-route")}
                className="mt-4 w-full inline-flex items-center justify-center gap-2 rounded-full bg-[#FAF6F0] px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-[#12100E] hover:bg-[#C85A32] hover:text-[#FAF6F0] transition-colors"
              >
                <span>Open Event Planner</span>
                <ArrowUpRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <div className="pt-8 select-none">
            <svg
              aria-hidden="true"
              viewBox="0 0 1000 157"
              preserveAspectRatio="xMidYMid meet"
              className="w-full h-auto text-[#FAF6F0]/[0.07]"
            >
              <text
                x="500"
                y="140"
                textAnchor="middle"
                fontSize="191"
                fontWeight="900"
                letterSpacing="-11.5"
                fill="currentColor"
              >
                UTSAVOS
              </text>
            </svg>
            <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#FAF6F0]/65 font-mono-code">
              <span>UtsavOS — Adaptive Event Planning Engine</span>
              <span>Landing Page Implementation • Separate from Authenticated Dashboard</span>
            </div>
          </div>
        </div>
      </footer>

      {activeWorkspaceModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#12100E]/80 backdrop-blur-sm p-4 overflow-y-auto"
        >
          <div className="relative w-full max-w-2xl rounded-3xl border border-[#181512]/20 bg-[#FAF6F0] text-[#181512] p-6 sm:p-8 shadow-2xl font-sans-ui">
            <div className="flex items-start justify-between gap-4 border-b border-[#181512]/10 pb-4">
              <div>
                <span className="font-mono-code text-xs uppercase tracking-widest text-[#A84422]">
                  {activeWorkspaceModal === "planner-route"
                    ? "Route Handoff • /login"
                    : "Documentation • docs/DESIGN.md"}
                </span>
                <h3 id="modal-title" className="text-2xl font-bold text-[#12100E] mt-1">
                  {activeWorkspaceModal === "planner-route"
                    ? "Initialize Your Baseline Celebration Plan"
                    : "UtsavOS Landing Page Art Direction & Design Spec"}
                </h3>
              </div>
              <button
                ref={modalCloseRef}
                type="button"
                onClick={() => setActiveWorkspaceModal(null)}
                aria-label="Close modal"
                className="rounded-full p-2 text-[#4A433E] hover:bg-[#181512]/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C85A32]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {activeWorkspaceModal === "planner-route" ? (
              <div className="mt-5 space-y-5">
                <p className="text-sm text-[#4A433E] leading-relaxed">
                  You can jump straight into the public deterministic studio with your current
                  parameters (
                  <strong className="text-[#181512]">{updatedGuests} guests</strong>,{" "}
                  <strong className="text-[#181512]">{simulation.venue.name}</strong>) or configure
                  a new multi-day celebration baseline.
                </p>
                <div className="rounded-2xl border border-[#181512]/15 bg-[#FFFFFF] p-4 space-y-3">
                  <div className="text-xs font-mono-code uppercase tracking-wider text-[#6E655F]">
                    Current Staged Simulation Context
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-xs">
                    <div>
                      <div className="text-[#6E655F]">Guest Trajectory</div>
                      <div className="font-bold text-sm text-[#12100E]">
                        {baselineGuests} → {updatedGuests} pax
                      </div>
                    </div>
                    <div>
                      <div className="text-[#6E655F]">Selected Proposal</div>
                      <div className="font-bold text-sm text-[#A84422]">{activeAlternative.code}</div>
                    </div>
                    <div>
                      <div className="text-[#6E655F]">Projected Budget</div>
                      <div className="font-bold text-sm text-[#12100E]">
                        {formatINR(activeAlternative.totalCost)}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setActiveWorkspaceModal(null)}
                    className="w-full sm:w-auto rounded-full border border-[#181512]/25 px-5 py-2.5 text-xs font-semibold text-[#181512] hover:bg-[#181512]/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C85A32]"
                  >
                    Return to Landing Page
                  </button>
                  <Link
                    to="/login"
                    onClick={() => setActiveWorkspaceModal(null)}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-full bg-[#12100E] px-6 py-2.5 text-xs font-semibold uppercase tracking-wider text-[#FAF6F0] hover:bg-[#C85A32] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C85A32]"
                  >
                    <span>Launch Workspace Route</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                  <a
                    href="#adaptive-studio"
                    onClick={() => setActiveWorkspaceModal(null)}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-full bg-[#B04B25] px-6 py-2.5 text-xs font-semibold uppercase tracking-wider text-[#FAF6F0] hover:bg-[#8F3A1D] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C85A32]"
                  >
                    <span>Open Adaptive Studio Workbench</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </a>
                </div>
              </div>
            ) : (
              <div className="mt-5 space-y-4 text-xs text-[#3E3834] leading-relaxed max-h-[60vh] overflow-y-auto pr-2">
                <div>
                  <h4 className="font-bold text-sm text-[#12100E]">1. Reference Synthesis</h4>
                  <p className="mt-1">
                    Combines Reference 1’s dark obsidian editorial storytelling and poetic
                    serif/script typography, Reference 2’s warm parchment ivory (#FAF6F0), burnt
                    terracotta (#C85A32), and botanical filigree, and Reference 3’s bold
                    edge-to-edge architectural wordmark and floating tilted UI cards.
                  </p>
                </div>
                <div>
                  <h4 className="font-bold text-sm text-[#12100E]">
                    2. Deterministic Planning Studio (180 → 240 Guests)
                  </h4>
                  <p className="mt-1">
                    Implements a transparent, repeatable client-side deterministic engine that
                    computes exact financial deltas, venue seating capacity overflows, kitchen prep
                    lead times, and three feasible proposals with an explicit approval gate
                    connected to the revision history log.
                  </p>
                </div>
                <div>
                  <h4 className="font-bold text-sm text-[#12100E]">3. Scope Separation</h4>
                  <p className="mt-1">
                    Preserves strict separation between the public marketing/interactive simulation
                    landing page and the authenticated event dashboard.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

